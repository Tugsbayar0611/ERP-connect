
import { Router } from "express";
import { storage } from "../storage";
import { requireTenant } from "../middleware/tenant";
import { z } from "zod";
import { isAdmin, isHR, isManager, isPrivileged } from "@shared/roles";
import { createAuditLog } from "../audit-log";

const router = Router();

// --- Schemas ---
const createSchema = z.object({
    type: z.enum(['leave', 'official_letter', 'asset_request', 'transport_request']),
    title: z.string().optional(),
    payload: z.record(z.any()), // Dynamic
    clientRequestId: z.string().optional()
});

const decisionSchema = z.object({
    decision: z.enum(['approved', 'rejected']),
    comment: z.string().optional()
});

// --- Routes ---

// 1. Create Draft
router.post("/requests", requireTenant, async (req: any, res) => {
    try {
        const data = createSchema.parse(req.body);

        // Find employee profile for this user
        const employee = await storage.getEmployeeByUserId(req.user.id);
        if (!employee) return res.status(400).json({ message: "No employee profile found for user" });

        const request = await storage.createRequest({
            tenantId: req.tenantId,
            type: data.type,
            status: 'draft',
            createdBy: req.user.id,
            employeeId: employee.id,
            title: data.title || `${data.type} request`,
            payload: data.payload,
            clientRequestId: data.clientRequestId,
            currentStep: 0
        });

        await storage.logRequestEvent({
            tenantId: req.tenantId,
            requestId: request.id,
            actorId: req.user.id,
            event: 'created',
            meta: { payload: data.payload }
        });

        res.json(request);
    } catch (e: any) {
        if (e.code === '23505') return res.status(409).json({ message: "Duplicate request ID" });
        if (e instanceof z.ZodError) {
            const message = e.errors.map(err => `${err.path.join('.')}: ${err.message}`).join(', ');
            return res.status(400).json({ message });
        }
        console.error(e);
        res.status(500).json({ message: "Failed to create request" });
    }
});

// 2. Submit
router.post("/requests/:id/submit", requireTenant, async (req: any, res) => {
    try {
        const request = await storage.getRequest(req.params.id);
        if (!request) return res.status(404).json({ message: "Request not found" });
        if (request.createdBy !== req.user.id) return res.status(403).json({ message: "Forbidden" });
        if (request.status !== 'draft') return res.status(400).json({ message: "Request already submitted" });

        const employee = await storage.getEmployee(request.employeeId);

        const approvals = [];
        let stepCounter = 1;

        // Step 1: Manager (if employee has one - currently schema doesn't have managerId)
        // TODO: Add managerId to employees schema when needed
        // For now, auto-approve if no explicit manager chain
        if (employee && (employee as any).managerId) {
            const manager = await storage.getEmployee((employee as any).managerId);
            if (manager && manager.userId) {
                approvals.push({
                    tenantId: req.tenantId,
                    requestId: request.id,
                    step: stepCounter++,
                    approverId: manager.userId // The User ID
                });
            }
        }

        // Fallback: If no manager found, assign to Admin (so it appears in Action Center)
        // Fallback: If no manager found, assign to Admin (so it appears in Action Center)
        if (approvals.length === 0) {
            const allUsers = await storage.getUsers(req.tenantId);

            // 1. Try to find OTHER Admin/Manager first (Standard Separation of Duties)
            let admin = allUsers.find(u =>
                (isPrivileged(u.role) || isManager(u.role)) &&
                u.id !== req.user.id
            );

            // 2. Fallback: If NO other admin exists, and I am Admin/Manager, assign to self (Solo Mode/Testing)
            if (!admin && (isPrivileged(req.user.role) || isManager(req.user.role))) {
                admin = allUsers.find(u => u.id === req.user.id);
            }

            if (admin) {
                approvals.push({
                    tenantId: req.tenantId,
                    requestId: request.id,
                    step: stepCounter++,
                    approverId: admin.id
                });

                // Add log event
                await storage.logRequestEvent({
                    tenantId: req.tenantId,
                    requestId: request.id,
                    actorId: req.user.id,
                    event: 'assigned_to_admin',
                    meta: { adminId: admin.id, reason: "No manager defined" }
                });
            }
        }

        // Auto-approve ONLY if really no one to approve (e.g. Sole Admin)
        if (approvals.length === 0) {
            await storage.setRequestStatus(request.id, 'approved');
            await storage.logRequestEvent({
                tenantId: req.tenantId,
                requestId: request.id,
                actorId: req.user.id,
                event: 'approved',
                meta: { auto: true, reason: "No approvers defined" }
            });
            return res.json({ ...request, status: 'approved' });
        } else {
            await storage.createApprovals(approvals);
            await storage.submitRequest(request.id, 1); // Go to step 1
            await storage.logRequestEvent({
                tenantId: req.tenantId,
                requestId: request.id,
                actorId: req.user.id,
                event: 'submitted',
                meta: { steps: approvals.length }
            });
            return res.json({ ...request, status: 'submitted' });
        }

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to submit request" });
    }
});

// 3. Generic Requests Search (used by RequestsPage)
router.get("/requests", requireTenant, async (req: any, res) => {
    try {
        const scope = req.query.scope as string || "my";
        const type = req.query.type as string || "all";
        const status = req.query.status as string || "all";

        let requests = [];

        if (scope === 'approvals') {
            // Fetch approvals (manager/admin view)
            // 'pending' (or all) means items waiting in inbox
            if (status === 'all' || status === 'pending' || status === 'submitted') {
                requests = await storage.getApproverInbox(req.tenantId, req.user.id, 'submitted');
            } else {
                // If they ask for 'approved'/'rejected', we currently don't have a specific method 
                // to show "History of requests I handled". 
                // Returning empty for now to avoid confusion/errors.
                // TODO: Implement getApproverHistory(userId, status)
                requests = [];
            }
        } else {
            // My Requests
            const employee = await storage.getEmployeeByUserId(req.user.id);
            if (!employee) return res.json([]);

            const targetStatus = status === 'all' ? undefined : status;
            requests = await storage.getMyRequests(req.tenantId, employee.id, targetStatus);
        }

        // In-memory filter for Type
        if (type !== 'all') {
            requests = requests.filter((r: any) => r.type === type);
        }

        res.json(requests);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to fetch requests" });
    }
});

// 3. Inbox (Legacy/Specific)
router.get("/requests/inbox", requireTenant, async (req: any, res) => {
    try {
        const items = await storage.getApproverInbox(req.tenantId, req.user.id);
        res.json(items);
    } catch (e) {
        res.status(500).json({ message: "Failed to fetch inbox" });
    }
});

// 4. Approve/Reject
router.post("/requests/:id/decide", requireTenant, async (req: any, res) => {
    try {
        const { decision, comment } = decisionSchema.parse(req.body);

        const request = await storage.getRequest(req.params.id);
        if (!request) return res.status(404).json({ message: "Request not found" });

        // Find the pending approval for this user at current step
        const approvals = await storage.getApprovals(request.id);
        const currentApproval = approvals.find(a =>
            a.step === request.currentStep &&
            a.approverId === req.user.id &&
            a.decision === null
        );

        if (!currentApproval) {
            return res.status(403).json({ message: "Not your turn or already decided" });
        }

        if (decision === 'rejected') {
            await storage.rejectStep(currentApproval.id, comment || "");
            await storage.setRequestStatus(request.id, 'rejected'); // Fail entire request
            await storage.logRequestEvent({
                tenantId: req.tenantId,
                requestId: request.id,
                actorId: req.user.id,
                event: 'rejected',
                meta: { comment }
            });
        } else {
            await storage.approveStep(currentApproval.id, comment);

            // Check if there is next step
            const nextStep = request.currentStep! + 1;
            const hasNext = approvals.some(a => a.step === nextStep);

            if (hasNext) {
                await storage.setRequestStatus(request.id, 'submitted', nextStep); // Move pointer
                if (request.type === 'official_letter') {
                    await storage.assignOfficialLetterNumber(request.id);
                }
            } else {
                await storage.setRequestStatus(request.id, 'approved'); // Final approval

                // Phase 5.2: Official Letter
                if (request.type === 'official_letter') {
                    await storage.assignOfficialLetterNumber(request.id);
                }
            }
            await storage.logRequestEvent({
                tenantId: req.tenantId,
                requestId: request.id,
                actorId: req.user.id,
                event: 'approved',
                meta: { comment, isFinal: !hasNext }
            });
        }

        res.json({ message: "Success" });
    } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json(e.errors);
        console.error(e);
        res.status(500).json({ message: "Failed to decide" });
    }
});

// 4.5 Get Request Timeline/Events
router.get("/requests/:id/events", requireTenant, async (req: any, res) => {
    try {
        const request = await storage.getRequest(req.params.id);
        if (!request || request.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Not found" });
        }

        const events = await storage.getRequestEvents(req.params.id);

        // Enrich with actor names
        const enrichedEvents = await Promise.all(events.map(async (ev: any) => {
            const actor = await storage.getUser(ev.actorId);
            return {
                id: ev.id,
                requestId: ev.requestId,
                actorId: ev.actorId,
                actorName: actor?.fullName || "Системийн хэрэглэгч",
                actorRole: actor?.role || "system",
                eventType: ev.event,
                toStatus: ev.event, // Map event to status for existing timeline component
                comment: (ev.meta as any)?.comment,
                createdAt: ev.createdAt,
                meta: ev.meta
            };
        }));

        res.json(enrichedEvents);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to fetch events" });
    }
});

import { jsPDF } from "jspdf";

// 5. Download Official Letter PDF
router.get("/requests/:id/official-letter.pdf", requireTenant, async (req: any, res) => {
    try {
        const request = await storage.getRequest(req.params.id);
        if (!request || request.tenantId !== req.tenantId) return res.status(404).send("Not found");
        if (request.type !== 'official_letter' || request.status !== 'approved' || !request.officialLetterNo) {
            return res.status(400).send("Letter not ready");
        }

        // Fetch Template
        let templateContent = "Default Content";
        if (request.officialLetterTemplateVersion) {
            // Need a method to get template by version
            const tmpl = await storage.getTemplateByVersion(req.tenantId, 'official_letter', request.officialLetterTemplateVersion);
            if (tmpl) templateContent = tmpl.htmlTemplate;
        }

        // Generate PDF
        // Note: For MVP in this environment, using basic text generation. 
        // In production with Playwright, we would render the HTML template properly.
        const doc = new jsPDF();

        doc.setFontSize(16);
        doc.text("OFFICIAL LETTER", 105, 20, { align: 'center' });

        doc.setFontSize(12);
        doc.text(`Ref: ${request.officialLetterNo}`, 20, 40);
        doc.text(`Date: ${new Date(request.finalizedAt || Date.now()).toLocaleDateString()}`, 20, 50);

        doc.text("To Whom It May Concern,", 20, 70);

        // Simple content dump (stripping HTML tags for MVP text-only PDF)
        const plainText = templateContent.replace(/<[^>]*>?/gm, '');
        const splitText = doc.splitTextToSize(plainText, 170);
        doc.text(splitText, 20, 80);

        // Signature Placeholder
        doc.text("Sincerely,", 20, 200);
        doc.text("Authorized Signature", 20, 230);

        const pdfBuffer = doc.output('arraybuffer');

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=${request.officialLetterNo}.pdf`);
        res.send(Buffer.from(pdfBuffer));

    } catch (e) {
        console.error(e);
        res.status(500).send("Failed to generate PDF");
    }
});

// 5. My Requests
router.get("/requests/my", requireTenant, async (req: any, res) => {
    try {
        const employee = await storage.getEmployeeByUserId(req.user.id);
        if (!employee) return res.json([]);
        const requests = await storage.getMyRequests(req.tenantId, employee.id, req.query.status as string);
        res.json(requests);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to fetch requests" });
    }
});

// 6. Get Single
router.get("/requests/:id", requireTenant, async (req: any, res) => {
    try {
        const request = await storage.getRequest(req.params.id);
        if (!request) return res.status(404).json({ message: "Not found" });

        const approvals = await storage.getApprovals(request.id);

        // RBAC: Owner, Approver, or Admin/HR
        const isOwner = request.createdBy === req.user.id;
        if (!isOwner && !isAdmin(req.user.role) && !isHR(req.user.role)) {
            const isApprover = approvals.some(a => a.approverId === req.user.id);
            if (!isApprover) return res.status(403).json({ message: "Forbidden" });
        }
        res.json({ ...request, approvals });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Error" });
    }
});

export default router;
