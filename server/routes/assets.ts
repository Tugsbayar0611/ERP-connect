
import { Router } from "express";
import { storage } from "../storage";
import { requireTenant } from "../middleware/tenant";
import { z } from "zod";
import { insertAssetIssuanceSchema } from "@shared/schema";
import { isEmployee, isAdmin, isHR } from "@shared/roles";
import { createAuditLog } from "../audit-log";

const router = Router();

// --- Schema ---
const issueSchema = z.object({
    employeeId: z.string().uuid(),
    productId: z.string().uuid(),
    quantity: z.number().int().positive().default(1),
    serialNumber: z.string().optional(),
    note: z.string().optional()
});

// --- Routes ---

// 1. Issue Asset (Admin/HR)
router.post("/issue", requireTenant, async (req: any, res) => {
    try {
        if (!isAdmin(req.user.role) && !isHR(req.user.role)) return res.status(403).json({ message: "Forbidden" });

        const data = issueSchema.parse(req.body);

        // Check if serial number already exists and issued (strict constraint per tenant)
        if (data.serialNumber) {
            const existing = await storage.getAssetBySerial(req.tenantId, data.serialNumber);
            if (existing) {
                return res.status(409).json({ message: "Asset with this serial number already exists" });
            }
        }

        const asset = await storage.issueAsset({
            ...data,
            tenantId: req.tenantId,
            issuedBy: req.user.id,
            status: "issued"
        });

        await createAuditLog({
            tenantId: req.tenantId,
            userId: req.user.id,
            ip: req.ip
        }, "asset_issuance", asset.id, "create", null, asset);

        res.json(asset);
    } catch (e: any) {
        if (e.code === '23505') return res.status(409).json({ message: "Asset with this serial number already issued" });
        if (e instanceof z.ZodError) return res.status(400).json(e.errors);
        console.error(e);
        res.status(500).json({ message: "Failed to issue asset" });
    }
});

// 2. Return Asset (Admin/HR)
router.post("/:id/return", requireTenant, async (req: any, res) => {
    try {
        if (!isAdmin(req.user.role) && !isHR(req.user.role)) return res.status(403).json({ message: "Forbidden" });

        const asset = await storage.getAsset(req.params.id);
        if (!asset) return res.status(404).json({ message: "Asset not found" });
        if (asset.tenantId !== req.tenantId) return res.status(403).json({ message: "Forbidden" });

        if (asset.status === "returned") {
            return res.status(409).json({ message: "Asset already returned" });
        }

        const updated = await storage.returnAsset(req.params.id, req.user.id);

        await createAuditLog({
            tenantId: req.tenantId,
            userId: req.user.id,
            ip: req.ip
        }, "asset_issuance", asset.id, "update", asset, updated, "Asset returned");

        res.json(updated);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to return asset" });
    }
});

// 3. Get Employee Assets (Admin/HR or Self)
router.get("/employee/:id", requireTenant, async (req: any, res) => {
    try {
        const targetId = req.params.id;

        if (targetId !== req.user.id) {
            if (!isAdmin(req.user.role) && !isHR(req.user.role)) {
                return res.status(403).json({ message: "Forbidden" });
            }
        }

        const assets = await storage.getEmployeeAssets(req.tenantId, targetId);
        res.json(assets);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to fetch assets" });
    }
});

// 4. Get My Assets (Convenience)
router.get("/my", requireTenant, async (req: any, res) => {
    try {
        const employee = await storage.getEmployeeByUserId(req.user.id);
        if (!employee) return res.status(404).json({ message: "Employee profile not found" });

        const assets = await storage.getEmployeeAssets(req.tenantId, employee.id);
        res.json(assets);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to fetch my assets" });
    }
});

export default router;
