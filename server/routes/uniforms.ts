/**
 * UNIFORM / WORKWEAR ISSUANCE API
 * ================================
 * 
 * GET  /api/uniforms/policies        - Норм бодлогын жагсаалт
 * POST /api/uniforms/policies        - Норм бодлого үүсгэх
 * GET  /api/uniforms/issuances       - Хувцас олголтын жагсаалт
 * POST /api/uniforms/issuances       - Хувцас олгох
 * POST /api/uniforms/issuances/:id/return - Хувцас буцааж авах
 * GET  /api/uniforms/due             - Ойрын хугацааны сануулга жагсаалт
 * GET  /api/uniforms/my              - Миний хувцасны мэдээлэл
 */

import { Router } from "express";
import { db } from "../db";
import {
    uniformPolicies, uniformIssuances, employees, departments, jobTitles, users,
    type InsertUniformPolicy, type InsertUniformIssuance
} from "@shared/schema";
import { eq, and, lte, gte, desc, asc, isNull, or } from "drizzle-orm";
import { requireTenant } from "../middleware";
import { storage } from "../storage";
import { z } from "zod";

const router = Router();

// ══════════════════════════════════════════════════════════════════
// ROUTE 1: Норм бодлогын удирдлага
// ══════════════════════════════════════════════════════════════════

router.get("/policies", requireTenant, async (req: any, res) => {
    const policies = await db.select({
        id: uniformPolicies.id,
        name: uniformPolicies.name,
        issuanceIntervalMonths: uniformPolicies.issuanceIntervalMonths,
        notifyBeforeDays: uniformPolicies.notifyBeforeDays,
        isActive: uniformPolicies.isActive,
        jobTitleId: uniformPolicies.jobTitleId,
        departmentId: uniformPolicies.departmentId,
        createdAt: uniformPolicies.createdAt,
        jobTitleName: jobTitles.name,
        departmentName: departments.name,
    })
        .from(uniformPolicies)
        .leftJoin(jobTitles, eq(uniformPolicies.jobTitleId, jobTitles.id))
        .leftJoin(departments, eq(uniformPolicies.departmentId, departments.id))
        .where(eq(uniformPolicies.tenantId, req.tenantId))
        .orderBy(asc(uniformPolicies.name));

    res.json(policies);
});

const policySchema = z.object({
    name: z.string().min(1),
    issuanceIntervalMonths: z.number().int().min(1).max(120).default(12),
    notifyBeforeDays: z.number().int().min(0).max(365).default(30),
    jobTitleId: z.string().uuid().optional().nullable(),
    departmentId: z.string().uuid().optional().nullable(),
    isActive: z.boolean().default(true),
});

router.post("/policies", requireTenant, async (req: any, res) => {
    const parsed = policySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });

    const [policy] = await db.insert(uniformPolicies)
        .values({ ...parsed.data, tenantId: req.tenantId })
        .returning();
    res.status(201).json(policy);
});

router.patch("/policies/:id", requireTenant, async (req: any, res) => {
    const parsed = policySchema.partial().safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });

    const [updated] = await db.update(uniformPolicies)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(and(eq(uniformPolicies.id, req.params.id), eq(uniformPolicies.tenantId, req.tenantId)))
        .returning();

    if (!updated) return res.status(404).json({ message: "Policy not found" });
    res.json(updated);
});

router.delete("/policies/:id", requireTenant, async (req: any, res) => {
    await db.delete(uniformPolicies)
        .where(and(eq(uniformPolicies.id, req.params.id), eq(uniformPolicies.tenantId, req.tenantId)));
    res.sendStatus(204);
});

// ══════════════════════════════════════════════════════════════════
// ROUTE 2: Хувцасны олголт
// ══════════════════════════════════════════════════════════════════

router.get("/issuances", requireTenant, async (req: any, res) => {
    const { employeeId, status } = req.query;

    const conditions: any[] = [eq(uniformIssuances.tenantId, req.tenantId)];
    if (employeeId) conditions.push(eq(uniformIssuances.employeeId, employeeId as string));
    if (status) conditions.push(eq(uniformIssuances.status, status as string));

    const issuances = await db.select({
        id: uniformIssuances.id,
        employeeId: uniformIssuances.employeeId,
        policyId: uniformIssuances.policyId,
        items: uniformIssuances.items,
        issuedAt: uniformIssuances.issuedAt,
        nextIssueDue: uniformIssuances.nextIssueDue,
        status: uniformIssuances.status,
        note: uniformIssuances.note,
        returnedAt: uniformIssuances.returnedAt,
        // Employee info
        employeeFirstName: employees.firstName,
        employeeLastName: employees.lastName,
        policyName: uniformPolicies.name,
        issuedByName: users.fullName,
    })
        .from(uniformIssuances)
        .leftJoin(employees, eq(uniformIssuances.employeeId, employees.id))
        .leftJoin(uniformPolicies, eq(uniformIssuances.policyId, uniformPolicies.id))
        .leftJoin(users, eq(uniformIssuances.issuedBy, users.id))
        .where(and(...conditions))
        .orderBy(desc(uniformIssuances.issuedAt));

    res.json(issuances);
});

const issuanceSchema = z.object({
    employeeId: z.string().uuid(),
    policyId: z.string().uuid().optional().nullable(),
    /** [{name: "Гэдэс", qty: 2, size: "L", productId?: "..."}, ...] */
    items: z.array(z.object({
        name: z.string(),
        qty: z.number().int().min(1),
        size: z.string().optional(),
        productId: z.string().uuid().optional(),
    })).min(1),
    issuedAt: z.string().optional(), // ISO date, default now
    note: z.string().optional(),
});

router.post("/issuances", requireTenant, async (req: any, res) => {
    const parsed = issuanceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });

    const { employeeId, policyId, items, issuedAt, note } = parsed.data;

    // Бодлогын интервалаас next issue date тооцоолох
    let nextIssueDue: string | undefined;
    if (policyId) {
        const [policy] = await db.select()
            .from(uniformPolicies)
            .where(and(eq(uniformPolicies.id, policyId), eq(uniformPolicies.tenantId, req.tenantId)))
            .limit(1);

        if (policy) {
            const issueDate = issuedAt ? new Date(issuedAt) : new Date();
            const nextDate = new Date(issueDate);
            nextDate.setMonth(nextDate.getMonth() + policy.issuanceIntervalMonths);
            nextIssueDue = nextDate.toISOString().split("T")[0];
        }
    }

    const [issuance] = await db.insert(uniformIssuances)
        .values({
            tenantId: req.tenantId,
            employeeId,
            policyId: policyId ?? null,
            items,
            issuedAt: issuedAt ? new Date(issuedAt) : new Date(),
            issuedBy: req.user.id,
            nextIssueDue: nextIssueDue ?? null,
            note: note ?? null,
            status: "issued",
        })
        .returning();

    // Audit log
    await storage.createAuditLog({
        tenantId: req.tenantId,
        actorId: req.user.id,
        entity: "uniform_issuance",
        entityId: issuance.id,
        action: "create",
        ipAddress: req.ip,
        message: `Нормын хувцас олгосон: ${items.length} төрлийн зүйл, Дараагийн олгох: ${nextIssueDue ?? "тодорхойгүй"}`,
    });

    res.status(201).json(issuance);
});

// Хувцас буцааж авах
router.post("/issuances/:id/return", requireTenant, async (req: any, res) => {
    const [existing] = await db.select()
        .from(uniformIssuances)
        .where(and(eq(uniformIssuances.id, req.params.id), eq(uniformIssuances.tenantId, req.tenantId)))
        .limit(1);

    if (!existing) return res.status(404).json({ message: "Issuance not found" });
    if (existing.status !== "issued") return res.status(400).json({ message: "This issuance is not in 'issued' status" });

    const { note } = req.body;

    const [updated] = await db.update(uniformIssuances)
        .set({
            status: "returned",
            returnedAt: new Date(),
            returnedBy: req.user.id,
            note: note ? `${existing.note ?? ""} | Буцаалт: ${note}` : existing.note,
        })
        .where(eq(uniformIssuances.id, req.params.id))
        .returning();

    res.json(updated);
});

// ══════════════════════════════════════════════════════════════════
// ROUTE 3: Ойрын хугацааны сануулга (Dashboard / notification)
// GET /api/uniforms/due?days=30
// ══════════════════════════════════════════════════════════════════
router.get("/due", requireTenant, async (req: any, res) => {
    const daysAhead = parseInt(req.query.days as string) || 30;
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + daysAhead);

    const futureDateStr = futureDate.toISOString().split("T")[0];
    const todayStr = new Date().toISOString().split("T")[0];

    const dueSoon = await db.select({
        id: uniformIssuances.id,
        employeeId: uniformIssuances.employeeId,
        nextIssueDue: uniformIssuances.nextIssueDue,
        items: uniformIssuances.items,
        employeeFirstName: employees.firstName,
        employeeLastName: employees.lastName,
    })
        .from(uniformIssuances)
        .leftJoin(employees, eq(uniformIssuances.employeeId, employees.id))
        .where(and(
            eq(uniformIssuances.tenantId, req.tenantId),
            eq(uniformIssuances.status, "issued"),
            // nextIssueDue <= daysAhead-ийн дотор
            lte(uniformIssuances.nextIssueDue, futureDateStr),
        ))
        .orderBy(asc(uniformIssuances.nextIssueDue));

    // Хэтэрсэн ба ойрын гэж ялгах
    const overdue = dueSoon.filter(d => d.nextIssueDue && d.nextIssueDue <= todayStr);
    const upcoming = dueSoon.filter(d => d.nextIssueDue && d.nextIssueDue > todayStr);

    res.json({ overdue, upcoming, total: dueSoon.length });
});

// ══════════════════════════════════════════════════════════════════
// ROUTE 4: Ажилтан өөрийн хувцасны мэдээлэл харах
// GET /api/uniforms/my
// ══════════════════════════════════════════════════════════════════
router.get("/my", requireTenant, async (req: any, res) => {
    const employee = await storage.getEmployeeByUserId(req.user.id);
    if (!employee) return res.status(404).json({ message: "Employee not found" });

    const issuances = await db.select({
        id: uniformIssuances.id,
        items: uniformIssuances.items,
        issuedAt: uniformIssuances.issuedAt,
        nextIssueDue: uniformIssuances.nextIssueDue,
        status: uniformIssuances.status,
        note: uniformIssuances.note,
        policyName: uniformPolicies.name,
    })
        .from(uniformIssuances)
        .leftJoin(uniformPolicies, eq(uniformIssuances.policyId, uniformPolicies.id))
        .where(and(
            eq(uniformIssuances.tenantId, req.tenantId),
            eq(uniformIssuances.employeeId, employee.id)
        ))
        .orderBy(desc(uniformIssuances.issuedAt));

    res.json(issuances);
});

export default router;
