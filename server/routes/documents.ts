
import { Router } from "express";
import { storage } from "../storage";
import { requireTenant, requireTenantAndPermission } from "../middleware";

// import { requirePermission } from "../permissions"; // Removed to avoid circular dep
import { createAuditLog, getAuditContext } from "../audit-log";
import multer from "multer";
import fs from "fs";
import path from "path";
import { isEmployee, isPrivileged, isManager, normalizeRole } from "../../shared/roles";
import { type DbInsertDocument } from "@shared/schema";

const router = Router();

// Configure Multer
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storageConfig = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir)
    },
    filename: function (req, file, cb) {
        // sanitize filename to avoid issues
        const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + '-' + safeName);
    }
});
const upload = multer({ storage: storageConfig });

// --- Documents ---
function serializeDocumentForUser(doc: any, user: any) {
    if (!doc) return doc;
    const role = (user?.role || "").toLowerCase();
    const isAdminOrHR = role === 'admin' || role === 'hr';
    if (isAdminOrHR) return doc;

    // For employees, redact internal fields if they are not the owner
    const isOwner = doc.createdBy === user.id || doc.uploadedBy === user.id;
    const redacted = { ...doc };
    if (!isOwner) {
        redacted.internalNotes = null;
    }
    return redacted;
}

router.get("/documents", requireTenant, async (req: any, res) => {
    const parentId = req.query.parentId === 'null' ? null : (req.query.parentId as string | undefined);
    const archived = req.query.archived === 'true';
    const role = (req.user.role || "").toLowerCase();

    // Scope results for employees
    const userId = isEmployee(role) ? req.user.id : undefined;

    const docs = await storage.getDocuments(req.tenantId, parentId, archived, userId, req.user.id);
    res.json(docs.map(d => serializeDocumentForUser(d, req.user)));
});

router.get("/documents/stats", requireTenant, async (req: any, res) => {
    try {
        const count = await storage.getUnreadDocumentsCount(req.tenantId, req.user.id);
        res.json({ unreadCount: count });
    } catch (err: any) {
        console.error("Stats Error:", err);
        res.status(500).json({ message: err.message });
    }
});

router.post("/documents/:id/read", requireTenant, async (req: any, res) => {
    try {
        await storage.markDocumentAsRead(req.tenantId, req.user.id, req.params.id);
        res.sendStatus(200);
    } catch (err: any) {
        console.error("Mark Read Error:", err);
        res.status(500).json({ message: err.message });
    }
});

router.post("/documents", requireTenant, upload.single('file'), requireTenantAndPermission, async (req: any, res) => {
    try {
        console.log("DEBUG: POST /documents body:", req.body);
        console.log("DEBUG: POST /documents file:", req.file);

        const rawParentId = req.body.parentId;
        const parentId = (rawParentId === 'null' || rawParentId === '') ? null : rawParentId;
        console.log("DEBUG: Resolved parentId:", parentId);

        let docData: any = {
            name: req.body.name,
            type: req.body.type,
            parentId: parentId,
            description: req.body.description,
            priority: req.body.priority || 'normal',
            tenantId: req.tenantId,
            createdBy: req.user.id,
            path: '', // Default hash/empty for non-file documents
        };

        // Auto-set deadline logic (Server-side fallback/enforcement)
        if (docData.priority) {
            const now = new Date();
            if (docData.priority === 'normal') {
                docData.deadline = new Date(now.setDate(now.getDate() + 7));
            } else if (docData.priority === 'urgent') {
                docData.deadline = new Date(now.setDate(now.getDate() + 1));
            } else if (docData.priority === 'critical') {
                docData.deadline = new Date(now.setHours(now.getHours() + 4));
            }
        }
        // If user provided a specific deadline, override it (passed in body)
        if (req.body.deadline) {
            docData.deadline = new Date(req.body.deadline);
        }

        if (req.file) {
            docData = {
                ...docData,
                mimeType: req.file.mimetype,
                size: req.file.size,
                path: `/uploads/${req.file.filename}`,
                uploadedBy: req.user.id,
            };
        }

        const doc = await storage.createDocument(docData);

        // Audit
        await createAuditLog(
            getAuditContext(req),
            "document",
            doc.id,
            "create",
            undefined,
            { name: doc.name },
            `Document ${doc.name} created`
        );

        res.status(201).json(serializeDocumentForUser(doc, req.user));
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error creating document" });
    }
});

router.get("/documents/forward-recipients", requireTenant, async (req: any, res) => {
    try {
        const recipients = await getForwardRecipientsForUser(req.tenantId, req.user);
        res.json(recipients);
    } catch (err: any) {
        console.error("Get Forward Recipients Error:", err);
        res.status(500).json({ message: err.message || "Error fetching recipients" });
    }
});

// GET single document with access check
router.get("/documents/:id", requireTenant, async (req: any, res) => {
    try {
        const hasAccess = await storage.canUserAccessDocument(req.tenantId, req.params.id, req.user.id);
        if (!hasAccess) {
            return res.status(403).json({ message: "Танд энэ баримтыг үзэх эрх байхгүй байна." });
        }

        const doc = await storage.getDocument(req.params.id);
        if (!doc) return res.status(404).json({ message: "Document not found" });

        res.json(serializeDocumentForUser(doc, req.user));
    } catch (err: any) {
        console.error("Get Document Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.patch("/documents/:id/archive", requireTenantAndPermission, async (req: any, res) => {
    try {
        const hasAccess = await storage.canUserAccessDocument(req.tenantId, req.params.id, req.user.id);
        if (!hasAccess) {
            return res.status(403).json({ message: "Танд энэ үйлдлийг хийх эрх байхгүй байна." });
        }

        const doc = await storage.getDocument(req.params.id);
        if (!doc || doc.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Document not found" });
        }

        const { isArchived } = req.body;
        if (typeof isArchived !== 'boolean') {
            return res.status(400).json({ message: "isArchived (boolean) required" });
        }

        const updated = await storage.toggleDocumentArchive(req.params.id, isArchived);

        // Audit
        await createAuditLog(
            getAuditContext(req),
            "document",
            updated.id,
            "update",
            doc,
            updated,
            isArchived ? `Document ${doc.name} archived` : `Document ${doc.name} unarchived`
        );

        res.json(serializeDocumentForUser(updated, req.user));
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error updating document archive status" });
    }
});

router.post("/documents/upload", requireTenant, upload.single('file'), async (req: any, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No file uploaded" });

        const body = req.body;
        const fileUrl = `/uploads/${req.file.filename}`;

        const input = {
            tenantId: req.tenantId,
            name: Buffer.from(req.file.originalname, 'latin1').toString('utf8'), // Fix encoding
            type: "file",
            mimeType: req.file.mimetype,
            size: req.file.size,
            path: fileUrl,
            uploadedBy: req.user.id,
            parentId: body.parentId || undefined
        } as DbInsertDocument;

        const doc = await storage.createDocument(input);
        res.status(201).json(serializeDocumentForUser(doc, req.user));
    } catch (err: any) {
        console.error("Upload error:", err);
        res.status(500).json({ message: err.message || "Upload failed" });
    }
});

// FIXME: This route might be dead code or shadowed by the previous POST /documents
// I've renamed it to /documents/create-v2 but kept original logic just in case it was intended for different usage.
// Actually, I'll keep it as is but be aware it might not be reached if order is same.
// In a router file, order matters.
// I will place it AFTER the upload one.
router.post("/documents-v2", requireTenant, async (req: any, res) => {
    try {
        const { uploadedBy, ...body } = req.body;

        // SLA Logic: Calculate deadline if not provided
        let deadline = body.deadline ? new Date(body.deadline) : undefined;
        if (!deadline) {
            const now = new Date();
            if (body.priority === 'urgent' || body.priority === 'critical') {
                now.setHours(now.getHours() + 24); // 24 hours for urgent
            } else {
                now.setDate(now.getDate() + 7); // 7 days default
            }
            deadline = now;
        }

        const currentHolderId = body.currentHolderId || req.user.id; // Default to creator

        // Auto-file Invoices logic
        let parentId = body.parentId;
        if (body.relatedEntityType === 'invoice' && !parentId) {
            parentId = await storage.ensureInvoiceFolder(req.tenantId, req.user.id);
        }

        const input = {
            ...body,
            parentId,
            deadline,
            status: body.status || 'draft',
            priority: body.priority || 'normal',
            currentHolderId,
            tenantId: req.tenantId,
            uploadedBy: req.user.id,
            createdBy: req.user.id
        } as DbInsertDocument;

        const doc = await storage.createDocument(input);

        // Log creation
        try {
            await storage.createDocumentLog({
                documentId: doc.id,
                actorId: req.user.id,
                action: 'created',
                comment: 'Document created',
            });
        } catch (logErr) {
            console.error("Failed to create document log:", logErr);
        }

        res.status(201).json(serializeDocumentForUser(doc, req.user));
    } catch (err) {
        console.error("Document Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// DMS: Forward Document
// DMS: Forward Document
router.post("/documents/:id/forward", requireTenant, async (req: any, res) => {
    try {
        const hasAccess = await storage.canUserAccessDocument(req.tenantId, req.params.id, req.user.id);
        if (!hasAccess) {
            return res.status(403).json({ message: "Танд энэ баримтыг шилжүүлэх эрх байхгүй байна." });
        }

        const { toUserId, comment } = req.body;
        if (!toUserId) return res.status(400).json({ message: "UserId required" });

        // --- STRICT VALIDATION: Check if recipient is allowed ---
        const userRole = (req.user.role || "").toLowerCase();

        // Allowed for everyone
        if (userRole === 'admin' || userRole === 'hr') {
            // No restrictions (tenant check implied by storage usually, but let's verify recipient exists in tenant)
            const recipient = await storage.getUser(toUserId);
            if (!recipient || recipient.tenantId !== req.tenantId) {
                return res.status(404).json({ message: "Хүлээн авагч олдсонгүй." });
            }
        } else {
            // Employee / Manager restrictions
            const allRecipients = await getForwardRecipientsForUser(req.tenantId, req.user);
            const isAllowed = allRecipients.some(r => r.id === toUserId);

            if (!isAllowed) {
                return res.status(403).json({ message: "Та зөвхөн Менежер / HR / Бичиг хэрэг рүү шилжүүлж болно." });
            }
        }
        // -----------------------------------------------------

        const updatedDoc = await storage.updateDocument(req.params.id, {
            currentHolderId: toUserId,
            status: 'pending'
        });

        // Log forwarding
        await storage.createDocumentLog({
            documentId: req.params.id,
            actorId: req.user.id,
            action: 'forwarded',
            fromUserId: req.user.id,
            toUserId: toUserId,
            comment: comment || 'Forwarded',
        });

        res.json(updatedDoc);
    } catch (err: any) {
        console.error("Forward Error:", err);
        res.status(500).json({ message: err.message || "Internal Server Error" });
    }
});

// Helper function for logic reuse
async function getForwardRecipientsForUser(tenantId: string, user: any) {
    let isUserPrivileged = isPrivileged(user.role);

    // Robust RBAC Check
    if (!isUserPrivileged && user.id) {
        try {
            const userRoles = await storage.getUserRoles(user.id);
            if (userRoles.some((r: any) => isPrivileged(r.name))) {
                isUserPrivileged = true;
            }
        } catch (err) {
            console.error("Error checking RBAC roles:", err);
        }
    }

    const allUsers = await storage.getUsers(tenantId);
    console.log(`DEBUG: getForwardRecipientsForUser tenant=${tenantId} user=${user.email} role=${user.role} isPrivileged=${isUserPrivileged} totalUsers=${allUsers.length}`);

    // For Admins/HR: Return everyone
    if (isUserPrivileged) {
        return allUsers.map(u => {
            const r = normalizeRole(u.role);
            const jt = (u.jobTitle || "").toLowerCase();

            let category = 'Employee';
            if (isPrivileged(r)) category = 'HR';
            else if (r === 'registry' || jt.includes('registry') || jt.includes('бичиг хэрэг')) category = 'Registry';
            else if (isManager(r)) category = 'Manager';

            return {
                id: u.id,
                fullName: u.fullName || u.username || u.email || 'Unnamed',
                jobTitle: u.jobTitle,
                category: category
            };
        });
    }

    // For others: Include HR, Registry, Managers and Team
    const employees = await storage.getEmployees(tenantId);
    const departments = await storage.getDepartments(tenantId);
    const myEmployee = employees.find(e => e.userId === user.id);

    const allowedUserIds = new Set<string>();

    // Add HR, Administrators and Registry
    allUsers.forEach(u => {
        const r = normalizeRole(u.role);
        const jt = (u.jobTitle || "").toLowerCase();
        if (isPrivileged(r) || r === 'registry' || jt.includes('registry') || jt.includes('бичиг хэрэг')) {
            allowedUserIds.add(u.id);
        }
    });

    if (myEmployee) {
        // Add Manager
        if (myEmployee.departmentId) {
            const myDept = departments.find(d => d.id === myEmployee.departmentId);
            if (myDept && myDept.managerId) {
                const managerEmp = employees.find(e => e.id === myDept.managerId);
                if (managerEmp && managerEmp.userId) allowedUserIds.add(managerEmp.userId);
            }
        }

        // Add Team Members (if Manager)
        const managedDepts = departments.filter(d => d.managerId === myEmployee.id);
        const teamEmployees = employees.filter(e =>
            managedDepts.some(d => d.id === e.departmentId) && e.userId
        );
        teamEmployees.forEach(e => { if (e.userId) allowedUserIds.add(e.userId); });
    }

    return allUsers
        .filter(u => allowedUserIds.has(u.id))
        .map(u => {
            const r = normalizeRole(u.role);
            const jt = (u.jobTitle || "").toLowerCase();
            let category = 'Employee';
            if (isPrivileged(r)) category = 'HR';
            else if (r === 'registry' || jt.includes('registry') || jt.includes('бичиг хэрэг')) category = 'Registry';
            else {
                // Secondary check for Manager status relative to current user
                let isMyManager = false;
                if (myEmployee && myEmployee.departmentId) {
                    const depts = departments.filter(d => d.id === myEmployee.departmentId);
                    isMyManager = depts.some(d => {
                        const mgr = employees.find(e => e.id === d.managerId);
                        return mgr && mgr.userId === u.id;
                    });
                }
                if (isMyManager) category = 'Manager';
            }

            return {
                id: u.id,
                fullName: u.fullName || u.username || u.email || 'Unnamed',
                jobTitle: u.jobTitle,
                category: category
            };
        });
}


// DMS: Update Status
router.patch("/documents/:id/status", requireTenant, async (req: any, res) => {
    try {
        const hasAccess = await storage.canUserAccessDocument(req.tenantId, req.params.id, req.user.id);
        if (!hasAccess) {
            return res.status(403).json({ message: "Танд энэ үйлдлийг хийх эрх байхгүй байна." });
        }

        const { status, comment } = req.body;
        if (!status) return res.status(400).json({ message: "Status required" });

        const updatedDoc = await storage.updateDocument(req.params.id, { status });

        // Log status change
        await storage.createDocumentLog({
            documentId: req.params.id,
            actorId: req.user.id,
            action: status,
            comment: comment || `Status updated to ${status}`,
        });

        res.json(updatedDoc);
    } catch (err: any) {
        console.error("Status Update Error:", err);
        res.status(500).json({ message: err.message || "Internal Server Error" });
    }
});

// DMS: Get Logs
router.get("/documents/:id/logs", requireTenant, async (req: any, res) => {
    try {
        const hasAccess = await storage.canUserAccessDocument(req.tenantId, req.params.id, req.user.id);
        if (!hasAccess) {
            return res.status(403).json({ message: "Танд энэ түүхийг үзэх эрх байхгүй байна." });
        }

        const logs = await storage.getDocumentLogs(req.params.id);
        res.json(logs);
    } catch (err: any) {
        console.error("Get Logs Error:", err);
        res.status(500).json({ message: err.message || "Internal Server Error" });
    }
});

// Bulk Delete Documents
router.post("/documents/bulk-delete", requireTenant, async (req: any, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids)) {
            return res.status(400).json({ message: "ids must be an array" });
        }
        await storage.bulkDeleteDocuments(ids);
        res.sendStatus(200);
    } catch (err: any) {
        console.error("Bulk Delete Error:", err);
        res.status(500).json({ message: err.message || "Internal Server Error" });
    }
});

// Rename Document
router.patch("/documents/:id", requireTenant, async (req: any, res) => {
    try {
        const hasAccess = await storage.canUserAccessDocument(req.tenantId, req.params.id, req.user.id);
        if (!hasAccess) {
            return res.status(403).json({ message: "Танд нэрийг өөрчлөх эрх байхгүй байна." });
        }

        const { name } = req.body;
        if (!name) return res.status(400).json({ message: "name is required" });

        const doc = await storage.updateDocument(req.params.id, { name });
        res.json(doc);
    } catch (err) {
        console.error("Rename Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// User Signature & Job Title
router.patch("/users/me/signature", async (req: any, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
        const signatureUrl = req.body.signatureUrl?.trim();
        const signatureTitleRaw = req.body.signatureTitle;

        let signatureTitle: string | null | undefined = undefined;
        if (typeof signatureTitleRaw === 'string') {
            const trimmed = signatureTitleRaw.trim();
            // User sent empty string -> save as NULL to trigger fallback
            // User sent non-empty string -> save as is
            signatureTitle = trimmed === "" ? null : trimmed;
        }

        // NOTE: We do NOT update jobTitle from here anymore.
        const user = await storage.updateUserSignature(req.user.id, {
            signatureUrl,
            signatureTitle
        });
        res.json(user);
    } catch (err) {
        console.error("Signature Update Error:", err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// Admin: Update User Permissions (canSignDocuments, jobTitle)
router.patch("/admin/users/:id/permissions", async (req: any, res) => {
    // Note: This endpoint checks req.user inside. Middleware in routes.ts usually checked requirePermission?
    // Start of the block in routes.ts didn't have requireTenant wrapper, it checked manually.
    if (!req.user) return res.sendStatus(401);
    if (req.user.role !== "Admin") {
        return res.status(403).json({ message: "Admin эрх шаардлагатай" });
    }

    try {
        const { id } = req.params;
        const { canSignDocuments, jobTitle } = req.body;

        // Validation
        if (canSignDocuments !== undefined && typeof canSignDocuments !== "boolean") {
            return res.status(400).json({ message: "canSignDocuments boolean байх ёстой" });
        }
        if (jobTitle !== undefined && typeof jobTitle !== "string") {
            return res.status(400).json({ message: "jobTitle string байх ёстой" });
        }

        const user = await storage.updateUserPermissions(id, { canSignDocuments, jobTitle });

        res.json({
            id: user.id,
            canSignDocuments: user.canSignDocuments,
            jobTitle: user.jobTitle,
        });
    } catch (err: any) {
        console.error("Update user permissions error:", err);
        res.status(500).json({ message: err.message || "Хэрэглэгчийн эрх өөрчлөхөд алдаа гарлаа" });
    }
});

router.delete("/documents/:id", requireTenant, async (req: any, res) => {
    try {
        const hasAccess = await storage.canUserAccessDocument(req.tenantId, req.params.id, req.user.id);
        const user = req.user;
        const isAdmin = user.role === 'Admin' || user.role === 'HR';

        if (!hasAccess && !isAdmin) {
            return res.status(403).json({ message: "Танд устгах эрх байхгүй байна." });
        }

        await storage.deleteDocument(req.params.id);
        res.sendStatus(200);
    } catch (err: any) {
        console.error("Document deletion error:", err);
        res.status(500).json({ message: err.message || "Баримт устгахад алдаа гарлаа" });
    }
});

router.post("/documents/:id/sign", requireTenant, async (req: any, res) => {
    try {
        const hasAccess = await storage.canUserAccessDocument(req.tenantId, req.params.id, req.user.id);
        if (!hasAccess) {
            return res.status(403).json({ message: "Танд гарын үсэг зурах эрх байхгүй байна." });
        }

        const doc = await storage.signDocument(req.params.id, req.user.id);
        res.json(doc);
    } catch (err: any) {
        console.error("Document sign error:", err);
        res.status(500).json({ message: err.message || "Баримт баталгаажуулахад алдаа гарлаа" });
    }
});

export default router;
