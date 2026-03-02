/**
 * Digital ID Routes - QR Code Generation and Verification
 * Phase 6: Employee identification via signed QR codes
 */

import { Router } from "express";
import { storage } from "../storage";
import { requireTenant } from "../middleware/tenant";
import { generateQRPayload, verifyQrString } from "../utils/qr-signing";
import { db } from "../db";
import { employees } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { createRateLimiter } from "../security";
import { createAuditLog } from "../audit-log";

const router = Router();

// Helper: Get employee by employeeNo
async function getEmployeeByEmployeeNo(tenantId: string, employeeNo: string) {
    const [emp] = await db.select()
        .from(employees)
        .where(and(eq(employees.tenantId, tenantId), eq(employees.employeeNo, employeeNo)));
    return emp;
}

// 1. Generate QR for current employee (Profile)
router.get("/qr/me", requireTenant, async (req: any, res) => {
    try {
        // Get employee profile for current user
        const employee = await storage.getEmployeeByUserId(req.user.id);

        if (!employee) {
            return res.status(404).json({ message: "Employee profile not found" });
        }

        // Use employeeNo as the employee code
        const employeeCode = employee.employeeNo || `EMP${String(employee.id).slice(0, 8).toUpperCase()}`;

        // Generate QR payload (valid for 60 minutes)
        const { payload, qrString } = generateQRPayload(
            req.tenantId,
            employeeCode,
            60 // 60 minutes expiry
        );

        res.json({
            qrString,
            expiresAt: new Date(payload.exp * 1000).toISOString(),
            employeeCode
        });
    } catch (e) {
        console.error("Failed to generate QR:", e);
        res.status(500).json({ message: "Failed to generate QR code" });
    }
});

// 2. Verify QR (Terminal/Registry scan)
router.post("/verify", requireTenant, createRateLimiter(60 * 1000, 10), async (req: any, res) => {
    // Log attempt context
    const auditContext = {
        tenantId: (req as any).tenantId || "unknown",
        userId: (req.user as any)?.id || "system",
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.headers["user-agent"]
    };

    try {
        const { qrString } = req.body;

        if (!qrString || typeof qrString !== 'string') {
            return res.status(400).json({ ok: false, error: "QR string required" });
        }

        // Verify signature and expiry
        const result = verifyQrString(qrString);

        if (!result.valid || !result.payload) {
            return res.status(400).json({ ok: false, error: result.error });
        }

        const payload = result.payload;

        // CRITICAL: Tenant isolation - QR must match scanner's tenant
        if (payload.tenantId !== req.tenantId) {
            await createAuditLog(
                auditContext,
                "digital_id",
                payload.employeeCode,
                "post",
                undefined,
                {
                    qrTenantId: payload.tenantId,
                    scannerTenantId: (req as any).tenantId
                },
                "Cross-tenant QR scan attempted",
                "error"
            );
            return res.status(403).json({ ok: false, error: "Invalid QR for this organization" });
        }

        // Lookup employee by employeeNo
        const employee = await getEmployeeByEmployeeNo(req.tenantId, payload.employeeCode);

        if (!employee) {
            return res.status(404).json({ ok: false, error: "Employee not found" });
        }

        // Check employee status
        if (employee.status !== 'active') {
            return res.json({
                ok: false,
                error: `Employee status: ${employee.status}`,
                employee: {
                    name: `${employee.firstName} ${employee.lastName}`,
                    status: employee.status
                }
            });
        }

        // Get department name
        let departmentName = null;
        if (employee.departmentId) {
            const dept = await storage.getDepartment(req.tenantId, employee.departmentId);
            departmentName = dept?.name;
        }

        // Log success
        await createAuditLog(
            { ...auditContext, tenantId: payload.tenantId },
            "digital_id",
            employee.id,
            "post",
            undefined,
            { employeeCode: payload.employeeCode },
            "QR verified successfully",
            "success"
        );

        res.json({
            ok: true,
            employee: {
                id: employee.id,
                name: `${employee.firstName} ${employee.lastName}`,
                employeeCode: payload.employeeCode,
                department: departmentName,
                status: employee.status
            }
        });
    } catch (e) {
        console.error("QR Verification Error:", e);
        // Log generic error
        await createAuditLog(
            {
                tenantId: (req as any).tenantId || "unknown",
                userId: (req.user as any)?.id || "system",
                ip: req.ip || req.connection.remoteAddress,
            },
            "digital_id",
            "system",
            "post",
            undefined,
            { error: String(e) },
            "QR verification system error",
            "error"
        );
        res.status(500).json({ ok: false, error: "Verification failed" });
    }
});

export default router;
