
import { Router, Request, Response } from "express";
import { db } from "../db";
import { sql, eq, and } from "drizzle-orm";
import { rosters, shifts, rosterDays, rosterAssignments, employees, insertRosterSchema, insertShiftSchema } from "../../shared/schema";
import { requireTenant } from "../middleware/tenant";
import { requirePermission } from "../middleware/rbac";

const router = Router();

// Apply Tenant Middleware to all roster routes
router.use(requireTenant);

// ==========================================
// SHIFTS
// ==========================================

router.get("/shifts", requirePermission("roster", "read"), async (req: Request, res: Response) => {
    const tenantId = (req as any).tenantId;
    const results = await db.select().from(shifts).where(eq(shifts.tenantId, tenantId));
    res.json(results);
});

router.post("/shifts", requirePermission("roster", "write"), async (req: Request, res: Response) => {
    const tenantId = (req as any).tenantId;
    const parse = insertShiftSchema.safeParse({ ...req.body, tenantId });
    if (!parse.success) return res.status(400).json(parse.error);

    const result = await db.insert(shifts).values(parse.data).returning();
    res.status(201).json(result[0]);
});

// ==========================================
// ROSTERS
// ==========================================

router.get("/", requirePermission("roster", "read"), async (req: Request, res: Response) => {
    const tenantId = (req as any).tenantId;
    const results = await db.select().from(rosters).where(eq(rosters.tenantId, tenantId));
    res.json(results);
});

router.post("/", requirePermission("roster", "write"), async (req: Request, res: Response) => {
    const tenantId = (req as any).tenantId;
    const parse = insertRosterSchema.safeParse({ ...req.body, tenantId });
    if (!parse.success) return res.status(400).json(parse.error);

    const result = await db.insert(rosters).values(parse.data).returning();
    res.status(201).json(result[0]);
});

// Get Roster Days (Pattern)
router.get("/:id/days", requirePermission("roster", "read"), async (req: Request, res: Response) => {
    const tenantId = (req as any).tenantId;
    const rosterId = req.params.id;
    const results = await db.select().from(rosterDays)
        .where(
            and(
                eq(rosterDays.tenantId, tenantId),
                eq(rosterDays.rosterId, rosterId)
            )
        )
        .orderBy(rosterDays.dayIndex);
    res.json(results);
});

// Bulk Upsert Roster Days (Pattern)
router.post("/:id/days", requirePermission("roster", "write"), async (req: Request, res: Response) => {
    const tenantId = (req as any).tenantId;
    const rosterId = req.params.id;
    const days = req.body.days; // Array of { dayIndex, shiftId, isOff }

    if (!Array.isArray(days)) return res.status(400).json({ error: "INVALID_DAYS_ARRAY" });

    // Use transaction for bulk upsert
    try {
        const result = await db.transaction(async (tx) => {
            // Clear existing days for this roster (simplest strategy for full template update)
            // Or upsert. Let's do clear and insert for simplicity of pattern definition
            await tx.delete(rosterDays)
                .where(and(eq(rosterDays.tenantId, tenantId), eq(rosterDays.rosterId, rosterId)));

            if (days.length > 0) {
                const toInsert = days.map((d: any) => ({
                    tenantId,
                    rosterId,
                    dayIndex: d.dayIndex,
                    shiftId: d.shiftId || null,
                    isOff: d.isOff || false
                }));
                return await tx.insert(rosterDays).values(toInsert).returning();
            }
            return [];
        });
        res.json(result);
    } catch (error: any) {
        console.error("Roster pattern update error:", error);
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// ASSIGNMENTS (The Critical Path)
// ==========================================

// Get Assignments (Filtered)
router.get("/assignments", requirePermission("roster", "read"), async (req: Request, res: Response) => {
    const tenantId = (req as any).tenantId;
    const { from, to, scope, employeeId, departmentId } = req.query;



    const filters = [];

    // Filter by Employee
    if (employeeId) {
        filters.push(eq(rosterAssignments.employeeId, employeeId as string));
    }

    // Filter by Department
    if (departmentId) {
        filters.push(eq(employees.departmentId, departmentId as string));
    }

    // Filter by Date Range
    if (from || to) {
        const f = from ? new Date(from as string) : new Date("1900-01-01");
        const t = to ? new Date(to as string) : new Date("2100-01-01");

        filters.push(sql`${rosterAssignments.startDate} <= ${t.toISOString()}::date`);
        filters.push(sql`(${rosterAssignments.endDate} IS NULL OR ${rosterAssignments.endDate} >= ${f.toISOString()}::date)`);
    }

    // Initial query construction above was not chained completely. Drizzle query builder style:
    let baseQuery = db.select({
        id: rosterAssignments.id,
        tenantId: rosterAssignments.tenantId,
        rosterId: rosterAssignments.rosterId,
        employeeId: rosterAssignments.employeeId,
        startDate: rosterAssignments.startDate,
        endDate: rosterAssignments.endDate,
        status: rosterAssignments.status,
        createdAt: rosterAssignments.createdAt,
        firstName: employees.firstName,
        lastName: employees.lastName
    })
        .from(rosterAssignments)
        .innerJoin(employees, eq(rosterAssignments.employeeId, employees.id))
        .where(and(
            eq(rosterAssignments.tenantId, tenantId),
            ...filters
        ));

    const results = await baseQuery;
    res.json(results);
});

// My Roster (Shortcut)
router.get("/my", requirePermission("roster", "read"), async (req: Request, res: Response) => {
    const tenantId = (req as any).tenantId;
    const userId = (req as any).user?.id;

    if (!userId) return res.status(401).json({ error: "UNAUTHORIZED" });

    // 1. Find Employee ID
    const employee = await db.select().from(employees)
        .where(and(eq(employees.tenantId, tenantId), eq(employees.userId, userId)))
        .limit(1);

    if (employee.length === 0) {
        return res.status(404).json({ error: "EMPLOYEE_NOT_FOUND" });
    }

    const empId = employee[0].id;
    const { from, to } = req.query;

    // 2. Fetch Assignments
    const filters = [
        eq(rosterAssignments.tenantId, tenantId),
        eq(rosterAssignments.employeeId, empId)
    ];

    if (from || to) {
        const f = from ? new Date(from as string) : new Date("1900-01-01");
        const t = to ? new Date(to as string) : new Date("2100-01-01");
        filters.push(sql`${rosterAssignments.startDate} <= ${t.toISOString()}::date`);
        filters.push(sql`(${rosterAssignments.endDate} IS NULL OR ${rosterAssignments.endDate} >= ${f.toISOString()}::date)`);
    }

    const results = await db.select().from(rosterAssignments).where(and(...filters));
    res.json(results);
});

type AssignInput = {
    rosterId: string;
    employeeId: string;
    startDate: string; // 'YYYY-MM-DD'
    endDate?: string | null; // 'YYYY-MM-DD' | null
};

// Bulk Assign with Overlap Check
router.post("/assign", requirePermission("roster", "write"), async (req: Request, res: Response) => {
    const tenantId = (req as any).tenantId;
    const assignments: AssignInput[] = req.body.assignments ?? [];

    if (!Array.isArray(assignments) || assignments.length === 0) {
        return res.status(400).json({ error: "EMPTY_ASSIGNMENTS" });
    }

    try {
        const result = await db.transaction(async (tx) => {
            const created: any[] = [];

            for (const a of assignments) {
                // Overlap check (active assignments only)
                // Logic: daterange(start, end) && daterange(newStart, newEnd)
                // Note: Postgres 'daterange' includes lower bound, excludes upper bound usually [), so '[]' is inclusive.
                // We use explicit overlap logic with SQL

                const overlap = await tx.execute(sql`
          SELECT 1
          FROM roster_assignments
          WHERE tenant_id = ${tenantId}
            AND employee_id = ${a.employeeId}
            AND status = 'active'
            AND daterange(start_date, coalesce(end_date, 'infinity'::date), '[]')
                && daterange(${a.startDate}::date, coalesce(${a.endDate ?? null}::date, 'infinity'::date), '[]')
          LIMIT 1
        `);

                if ((overlap as any).rows?.length > 0) {
                    throw Object.assign(new Error("ROSTER_OVERLAP"), {
                        code: "ROSTER_OVERLAP",
                        employeeId: a.employeeId,
                    });
                }

                const inserted = await tx
                    .insert(rosterAssignments)
                    .values({
                        tenantId,
                        rosterId: a.rosterId,
                        employeeId: a.employeeId,
                        startDate: a.startDate,
                        endDate: a.endDate ?? null,
                        status: "active",
                    })
                    .returning();

                created.push(inserted[0]);
            }

            return created;
        });

        res.json({ ok: true, created: result });
    } catch (e: any) {
        if (e?.code === "ROSTER_OVERLAP") {
            return res.status(409).json({ error: "ROSTER_OVERLAP", employeeId: e.employeeId });
        }
        console.error("Bulk assign error:", e);
        res.status(500).json({ error: "INTERNAL_ERROR" });
    }
});

export default router;
