
import { Router } from "express";
import { normalizeRole, isEmployee, isManager, isPrivileged, canViewTeamPerformance } from "../../shared/roles";
import { storage } from "../storage";
import { z } from "zod";
import { requireTenant, requireTenantAndPermission } from "../middleware";
import * as XLSX from "xlsx";
import { format } from "date-fns";

const router = Router();

// ==========================================
// PERFORMANCE & KPI API (Гүйцэтгэлийн Удирдлага)
// ==========================================

// Helper for Audit Logging
const logPerformanceAction = async (
    req: any,
    action: string,
    entityId: string | null,
    details: { before?: any; after?: any; message?: string }
) => {
    try {
        await storage.createAuditLog({
            tenantId: req.tenantId,
            actorId: req.user?.id || "system",
            entity: "performance_goal",
            entityId: entityId || "unknown",
            action,

            beforeData: details.before || null,
            afterData: details.after || null,

            ipAddress: req.ip,
            userAgent: req.get("User-Agent"),
        });
    } catch (e) {
        console.error("Failed to log audit action:", e);
        // Don't fail the request just because audit log failed (or maybe we should? for enterprise -> yes, but for now log error)
    }
};

// ==========================================
// PERFORMANCE & KPI API (Гүйцэтгэлийн Удирдлага)
// ==========================================

// Get all performance periods
router.get("/performance/periods", requireTenant, async (req: any, res) => {
    // ... existing ...
    try {
        const periods = await storage.getPerformancePeriods(req.tenantId);
        res.json(periods);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching performance periods" });
    }
});

// Get goals audit logs
router.get("/performance/goals/:id/audit", requireTenant, async (req: any, res) => {
    try {
        const logs = await storage.getAuditLogs(req.tenantId, {
            entityType: "performance_goal",
            entityId: req.params.id
        });
        res.json(logs);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching audit logs" });
    }
});


// Get single period
router.get("/performance/periods/:id", requireTenant, async (req: any, res) => {
    try {
        const period = await storage.getPerformancePeriod(req.params.id);
        if (!period || period.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Performance period not found" });
        }
        res.json(period);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching performance period" });
    }
});

// Create period
router.post("/performance/periods", requireTenantAndPermission, async (req: any, res) => {
    try {
        const periodSchema = z.object({
            name: z.string().min(1, "Үеийн нэр оруулна уу"),
            startDate: z.string(),
            endDate: z.string(),
            status: z.enum(["active", "closed", "archived"]).optional().default("active"),
        });
        const data = periodSchema.parse(req.body);
        const period = await storage.createPerformancePeriod({
            ...data,
            tenantId: req.tenantId,
        });
        res.status(201).json(period);
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error(err);
            res.status(500).json({ message: err.message || "Error creating performance period" });
        }
    }
});

// Update period
router.patch("/performance/periods/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const period = await storage.getPerformancePeriod(req.params.id);
        if (!period || period.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Performance period not found" });
        }
        const updated = await storage.updatePerformancePeriod(req.params.id, req.body);
        res.json(updated);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error updating performance period" });
    }
});

// Lock period
router.post("/performance/periods/:id/lock", requireTenantAndPermission, async (req: any, res) => {
    try {
        const period = await storage.getPerformancePeriod(req.params.id);
        if (!period || period.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Performance period not found" });
        }

        // Gate: Can only lock active periods (or allow re-locking if unlocked)
        // Also optional: Check if all goals are evaluated? For now, straight lock.

        const updated = await storage.updatePerformancePeriod(req.params.id, { status: "locked" });

        // Also update all goals to 'locked' status? 
        // Or just rely on period.status === 'locked' check?
        // User request says "Locked period/goal -> immutable". 
        // Efficient way: relying on period check is safer than bulk updating 1000 goals.
        // But for visual consistency, we might want to bulk update goals later.
        // For MVP Phase 2, let's stick to PERIOD level lock guarding.

        res.json(updated);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error locking performance period" });
    }
});

// Unlock period (Admin only)
router.post("/performance/periods/:id/unlock", requireTenantAndPermission, async (req: any, res) => {
    try {
        // TODO: Strict Admin check needed here (req.user.role === 'admin')
        // For now, relying on requireTenantAndPermission

        const period = await storage.getPerformancePeriod(req.params.id);
        if (!period || period.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Performance period not found" });
        }

        const updated = await storage.updatePerformancePeriod(req.params.id, { status: "active" });
        res.json(updated);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error unlocking performance period" });
    }
});

// Delete period
router.delete("/performance/periods/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const period = await storage.getPerformancePeriod(req.params.id);
        if (!period || period.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Performance period not found" });
        }
        await storage.deletePerformancePeriod(req.params.id);
        res.status(204).send();
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error deleting performance period" });
    }
});

// Get performance goals (with optional filters)
router.get("/performance/goals", requireTenant, async (req: any, res) => {
    try {
        const periodId = req.query.periodId as string | undefined;
        let employeeId = req.query.employeeId as string | undefined;

        const role = req.user.role;
        const isAdmin = isPrivileged(role);
        const scope = req.query.scope as string | undefined; // "my" | "team"

        // RBAC: Employee (User) can only see own goals
        if (isEmployee(role) && !isAdmin) {
            if (scope === "team") {
                return res.status(403).json({ message: "Та багийн зорилтыг харах эрхгүй." });
            }
            const emp = await storage.getEmployeeByUserId(req.user.id);
            if (!emp) {
                return res.json([]);
            }
            employeeId = emp.id;
        } else if (scope === "team") {
            // Manager/Admin/HR team-level access
            if (!canViewTeamPerformance(role)) {
                return res.status(403).json({ message: "Та багийн зорилтыг харах эрхгүй." });
            }
            // If team scope, we use a different storage method or handle it inside getPerformanceGoals (if updated)
            // For now, let's stick to the existing structure where /team is a separate endpoint, 
            // OR we can make this endpoint polymorphic.
            // But let's keep consistency with existing routes structure if possible.
        }

        const goals = await storage.getPerformanceGoals(req.tenantId, periodId, employeeId);
        res.json(goals);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching performance goals" });
    }
});

// Get team goals (for managers)
router.get("/performance/team", requireTenant, async (req: any, res) => {
    try {
        const role = req.user.role;
        if (!canViewTeamPerformance(role)) {
            return res.status(403).json({ message: "Та багийн зорилтыг харах эрхгүй." });
        }

        const periodId = req.query.periodId as string | undefined;
        // The user requesting is the manager
        const managerId = req.user.id;

        const goals = await storage.getTeamGoals(req.tenantId, managerId, periodId);
        res.json(goals);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching team goals" });
    }
});

// Get single goal
router.get("/performance/goals/:id", requireTenant, async (req: any, res) => {
    try {
        const goal = await storage.getPerformanceGoal(req.params.id);
        if (!goal || goal.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Performance goal not found" });
        }
        res.json(goal);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching performance goal" });
    }
});

// Create goal (Revised)
router.post("/performance/goals", requireTenantAndPermission, async (req: any, res) => {
    try {
        // Guard: Check if period is locked
        const periodId = req.body.periodId;
        const period = await storage.getPerformancePeriod(periodId);
        if (period && period.status === "locked") {
            return res.status(403).json({ message: "Cannot create goals in a locked period" });
        }

        const goalSchema = z.object({
            periodId: z.string().uuid("Invalid period ID"),
            employeeId: z.string().uuid("Invalid employee ID"),
            title: z.string().min(1, "Зорилтын нэр оруулна уу"),
            description: z.string().optional(),
            metricType: z.enum(["percent", "number", "currency", "boolean"]).optional().default("percent"),
            targetValue: z.string().optional().default("100"),
            currentValue: z.string().optional().default("0"),
            weight: z.number().min(0).max(100),
            status: z.enum(["draft", "submitted", "approved", "evaluated", "locked"]).optional().default("draft"),
            dueDate: z.string().optional(),
        });
        const data = goalSchema.parse(req.body);
        // Auto-assign manager if not provided
        let managerId = data.status === 'draft' ? undefined : req.user.id; // Default to creator if not draft? No, use logic.

        // Better: Use the same manager lookup logic as submit
        const employee = await storage.getEmployee(data.employeeId);
        if (employee && employee.departmentId) {
            const department = await storage.getDepartment(req.tenantId, employee.departmentId);
            if (department && department.managerId) {
                const managerEmployee = await storage.getEmployee(department.managerId);
                if (managerEmployee && managerEmployee.userId) {
                    managerId = managerEmployee.userId;
                }
            }
        }

        const goal = await storage.createPerformanceGoal({
            ...data,
            managerId,
            progress: 0,
            tenantId: req.tenantId,
        });

        await logPerformanceAction(req, "create", goal.id, { after: goal, message: "Goal created" });

        res.status(201).json(goal);
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error(err);
            res.status(500).json({ message: err.message || "Error creating performance goal" });
        }
    }
});

// Update goal
router.patch("/performance/goals/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const goal = await storage.getPerformanceGoal(req.params.id);
        if (!goal || goal.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Performance goal not found" });
        }

        const isAdmin = isPrivileged(req.user.role);

        // Prevent editing if locked (even for admin, unless explicit requirement?)
        if (goal.status === "locked" && !isAdmin) {
            return res.status(403).json({ message: "Cannot edit locked goal" });
        }

        if (goal.status === "evaluated" && isEmployee(req.user.role) && !isAdmin) {
            return res.status(403).json({ message: "Cannot edit evaluated goal once finalized" });
        }

        // Guard: Check if period is locked
        const period = await storage.getPerformancePeriod(goal.periodId);
        if (period && period.status === "locked" && !isAdmin) {
            return res.status(403).json({ message: "Period is locked. Cannot edit goals." });
        }

        const updated = await storage.updatePerformanceGoal(req.params.id, req.body);

        await logPerformanceAction(req, "update", goal.id, { before: goal, after: updated });

        res.json(updated);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error updating performance goal" });
    }
});

// Submit goal
router.post("/performance/goals/:id/submit", requireTenantAndPermission, async (req: any, res) => {
    try {
        const goal = await storage.getPerformanceGoal(req.params.id);
        if (!goal || goal.tenantId !== req.tenantId) return res.status(404).send();

        // Guard: Check if period is locked
        const period = await storage.getPerformancePeriod(goal.periodId);
        if (period && period.status === "locked") {
            return res.status(403).json({ message: "Period is locked. Cannot submit goals." });
        }

        // Workflow Gate: Only Draft can be submitted
        if (goal.status !== "draft") {
            return res.status(400).json({ message: "Only draft goals can be submitted" });
        }

        // Weight Validation: specific to 'submit' action
        // Check if total weight of ALL goals (including this one) is 100%
        const allGoals = await storage.getPerformanceGoals(req.tenantId, goal.periodId, goal.employeeId);
        const totalWeight = allGoals.reduce((sum, g) => sum + (g.weight || 0), 0);

        if (totalWeight !== 100) {
            return res.status(400).json({
                message: `Total weight must be exactly 100% to submit. Current total: ${totalWeight}%`
            });
        }

        // Auto-assign to Department Manager
        let managerId: string | undefined;
        const employee = await storage.getEmployee(goal.employeeId);
        if (employee && employee.departmentId) {
            const department = await storage.getDepartment(req.tenantId, employee.departmentId);
            if (department && department.managerId) {
                // Get the manager's User ID (not Employee ID)
                const managerEmployee = await storage.getEmployee(department.managerId);
                if (managerEmployee && managerEmployee.userId) {
                    managerId = managerEmployee.userId;
                }
            }
        }

        const updated = await storage.updatePerformanceGoal(req.params.id, {
            status: "submitted",
            managerId: managerId
        });

        await logPerformanceAction(req, "submit", goal.id, { before: goal, after: updated, message: "Goal submitted for approval" });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// Approve goal (Manager)
router.post("/performance/goals/:id/approve", requireTenantAndPermission, async (req: any, res) => {
    try {
        const goal = await storage.getPerformanceGoal(req.params.id);
        if (!goal || goal.tenantId !== req.tenantId) return res.status(404).send();

        // Guard: Check if period is locked
        const period = await storage.getPerformancePeriod(goal.periodId);
        if (period && period.status === "locked") {
            return res.status(403).json({ message: "Period is locked. Cannot approve goals." });
        }

        // Workflow Gate: Only Submitted can be approved
        if (goal.status !== "submitted") {
            return res.status(400).json({ message: "Only submitted goals can be approved" });
        }

        // TODO: Verify user is manager? (Currently relying on basic permission)
        const updated = await storage.updatePerformanceGoal(req.params.id, {
            status: "approved",
            managerId: req.user.id // Auto-assign approver
        });

        await logPerformanceAction(req, "approve", goal.id, { before: goal, after: updated, message: "Goal approved" });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// Evaluate goal
router.post("/performance/goals/:id/evaluate", requireTenantAndPermission, async (req: any, res) => {
    try {
        const schema = z.object({
            qualityRating: z.number().min(1).max(5),
            managerComment: z.string().optional(),
            finalScore: z.number().optional() // Can be calculated or overridden
        });
        const { qualityRating, managerComment } = schema.parse(req.body);

        const goal = await storage.getPerformanceGoal(req.params.id);
        if (!goal || goal.tenantId !== req.tenantId) return res.status(404).send();

        // Guard: Check if period is locked
        const period = await storage.getPerformancePeriod(goal.periodId);
        if (period && period.status === "locked") {
            return res.status(403).json({ message: "Period is locked. Cannot evaluate goals." });
        }

        // Workflow Gate: Only Approved can be evaluated
        // (Allow re-evaluation if already evaluated? Maybe yes, for corrections. But user asked for Strict flows)
        // Let's allow 'approved' or 'evaluated' (update) but not Locked.
        if (!["approved", "evaluated"].includes(goal.status)) {
            return res.status(400).json({ message: "Only approved or evaluated goals can be evaluated" });
        }
        const isAdmin = isPrivileged(req.user.role);

        // Final Workflow Security: Prevent employees from evaluating themselves
        // Only Admin or Manager (or specifically assigned manager) can evaluate
        const isManagerOrAdmin = !isEmployee(req.user.role) || isAdmin;
        if (!isManagerOrAdmin) {
            return res.status(403).json({ message: "Only managers can evaluate goals" });
        }

        if (goal.managerId && goal.managerId !== req.user.id && !isAdmin) {
            // Optional: allow only the assigned manager or admin
            // return res.status(403).json({ message: "You are not the assigned manager for this goal" });
        }

        // Evidence Requirement: Must have at least one evidence item
        const evidence = await storage.getKpiEvidence(req.params.id);
        if (evidence.length === 0) {
            return res.status(400).json({ message: "Evidence is required to evaluate a goal" });
        }

        const updated = await storage.updatePerformanceGoal(req.params.id, {
            status: "evaluated",
            qualityRating,
            managerComment,
            evaluatedBy: req.user.id,
            evaluatedAt: new Date(),
        });

        await logPerformanceAction(req, "evaluate", goal.id, {
            before: goal,
            after: updated,
            message: `Evaluated: Rating ${qualityRating}/5`
        });

        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

// Evidence handling
router.post("/performance/goals/:id/evidence", requireTenant, async (req: any, res) => {
    try {
        const goal = await storage.getPerformanceGoal(req.params.id);
        if (!goal || goal.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Goal not found" });
        }

        const isAdmin = isPrivileged(req.user.role);

        // RBAC Check:
        // 1. Managers/Admins can always add evidence
        // 2. Employees can ONLY add evidence to their OWN goals
        if (isEmployee(req.user.role) && !isAdmin) {
            const emp = await storage.getEmployeeByUserId(req.user.id);
            if (!emp || emp.id !== goal.employeeId) {
                return res.status(403).json({ message: "You can only add evidence to your own goals." });
            }
        }

        // Guard: Check if period or goal is locked/evaluated
        const period = await storage.getPerformancePeriod(goal.periodId);
        if (period && period.status === "locked" && !isAdmin) {
            return res.status(403).json({ message: "Period is locked. Cannot add evidence." });
        }
        if (goal.status === "locked" && !isAdmin) {
            return res.status(403).json({ message: "Goal is locked. Cannot add evidence." });
        }

        if (goal.status === "evaluated" && isEmployee(req.user.role) && !isAdmin) {
            return res.status(403).json({ message: "Cannot add evidence to an evaluated goal." });
        }

        const schema = z.object({
            type: z.enum(["file", "link"]).default("file"),
            title: z.string(),
            url: z.string(),
        });
        const data = schema.parse(req.body);

        const evidence = await storage.createKpiEvidence({
            goalId: req.params.id,
            type: data.type,
            title: data.title,
            url: data.url,
            uploadedBy: req.user.id
        });

        await logPerformanceAction(req, "evidence", req.params.id, {
            message: `Evidence added: ${data.title}`
        });

        res.status(201).json(evidence);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

router.delete("/performance/goals/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const goal = await storage.getPerformanceGoal(req.params.id);
        if (!goal || goal.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Performance goal not found" });
        }
        await storage.deletePerformanceGoal(req.params.id);
        res.status(204).send();
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error deleting performance goal" });
    }
});

// Get performance summary (calculated scores)
router.get("/performance/summary", requireTenant, async (req: any, res) => {
    try {
        const periodId = req.query.periodId as string;
        let employeeId = req.query.employeeId as string | undefined;

        if (!periodId) {
            return res.status(400).json({ message: "periodId is required" });
        }

        // RBAC: Strict scoping for employees
        const isAdmin = isPrivileged(req.user.role);

        if (isEmployee(req.user.role) && !isAdmin) {
            const emp = await storage.getEmployeeByUserId(req.user.id);
            if (!emp) {
                return res.json({ totalScore: 0, totalWeight: 0, goalsCount: 0, completedCount: 0 });
            }
            // Force employeeId to be their own
            employeeId = emp.id;
        }

        const summary = await storage.getPerformanceSummary(req.tenantId, periodId, employeeId);
        res.json(summary);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching performance summary" });
    }
});

// ==========================================
// REPORTS & EXPORT
// ==========================================

// Helper to aggregate team summary
async function getTeamSummaryData(tenantId: string, periodId: string) {
    // 1. Fetch Master Data
    const [period, employees, departments, goals] = await Promise.all([
        storage.getPerformancePeriod(periodId),
        storage.getEmployees(tenantId),
        storage.getDepartments(tenantId),
        storage.getPerformanceGoals(tenantId, periodId)
    ]);

    if (!period || period.tenantId !== tenantId) {
        throw new Error("Period not found");
    }

    // 2. Map Master Data
    const deptMap = new Map(departments.map(d => [d.id, d.name]));
    // goal filtering is implicitly done by getPerformanceGoals(tenantId, periodId)

    // 3. Aggregate Goals by Employee
    const rows = new Map<string, any>(); // employeeId -> stats

    // Initialize all employees with 0 stats
    employees.forEach(e => {
        rows.set(e.id, {
            employeeId: e.id,
            employeeName: `${e.lastName?.substring(0, 1)}.${e.firstName}`,
            position: e.position || "-",
            department: e.departmentId ? deptMap.get(e.departmentId) : "-",
            totalScore: 0,
            totalWeight: 0,
            goalsTotal: 0,
            goalsCompleted: 0,
            goalsOverdue: 0,
            qualitySum: 0,
            qualityCount: 0,
            statusCounts: { draft: 0, submitted: 0, approved: 0, evaluated: 0, locked: 0, other: 0 }
        });
    });

    const now = new Date();

    goals.forEach(g => {
        let stats = rows.get(g.employeeId);
        if (!stats) return;

        // Status Counts
        const status = (g.status || 'draft') as string;
        if (stats.statusCounts[status] !== undefined) {
            stats.statusCounts[status]++;
        } else {
            stats.statusCounts.other++;
        }

        // Weight
        stats.totalWeight += g.weight || 0;

        // Score 
        const progressFactor = (g.progress || 0) / 100;
        let qualityFactor = 1.0;
        if (g.qualityRating) {
            qualityFactor = g.qualityRating / 5.0;
        }

        const goalScore = (g.weight || 0) * progressFactor * qualityFactor;
        stats.totalScore += goalScore;

        stats.goalsTotal++;

        // Completed
        if (g.progress === 100) {
            stats.goalsCompleted++;
        }

        // Overdue check
        if (g.dueDate && new Date(g.dueDate) < now && (g.progress || 0) < 100 && !['evaluated', 'locked'].includes(g.status)) {
            stats.goalsOverdue++;
        }

        // Quality Avg
        if (g.qualityRating) {
            stats.qualitySum += g.qualityRating;
            stats.qualityCount++;
        }
    });

    // 4. Finalize Averages
    const flatRows = Array.from(rows.values()).map(r => ({
        ...r,
        avgQuality: r.qualityCount > 0 ? (r.qualitySum / r.qualityCount).toFixed(1) : "-",
        totalScore: r.totalScore.toFixed(1),
        qualitySum: undefined,
        qualityCount: undefined
    }));

    // Sort by name
    flatRows.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

    // 5. Calculate Grand Totals
    const grandTotals = {
        employeeCount: employees.length,
        goalCount: goals.length,
        avgScore: flatRows.length > 0 ? (flatRows.reduce((a, b) => a + parseFloat(b.totalScore), 0) / flatRows.length).toFixed(1) : 0,
        avgCompletion: goals.length > 0 ? (goals.reduce((a, b) => a + (b.progress || 0), 0) / goals.length).toFixed(1) : 0,
        overdueGoals: flatRows.reduce((a, b) => a + b.goalsOverdue, 0)
    };

    return { period, rows: flatRows, totals: grandTotals, goals };
}

// JSON Endpoint
router.get("/performance/reports/team-summary", requireTenant, async (req: any, res) => {
    try {
        const { periodId } = req.query;
        if (!periodId) return res.status(400).json({ message: "Period ID required" });

        const data = await getTeamSummaryData(req.tenantId, periodId as string);
        res.json(data);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error generating report" });
    }
});

// Excel Endpoint
router.get("/performance/reports/team-summary.xlsx", requireTenant, async (req: any, res) => {
    try {
        const { periodId } = req.query;
        if (!periodId) return res.status(400).send("Period ID required");

        const data = await getTeamSummaryData(req.tenantId, periodId as string);

        // Create Workbook
        const wb = XLSX.utils.book_new();

        // 1. Summary Sheet
        const summaryData = data.rows.map(r => ({
            "Ажилтан": r.employeeName,
            "Албан тушаал": r.position,
            "Хэлтэс": r.department,
            "Нийт Оноо": parseFloat(r.totalScore),
            "Нийт Жин": r.totalWeight,
            "Зорилт": r.goalsTotal,
            "Биелсэн": r.goalsCompleted,
            "Хугацаа хэтэрсэн": r.goalsOverdue,
            "Чанар (Дундаж)": r.avgQuality,
            "Төлөв (Draft)": r.statusCounts.draft,
            "Төлөв (Submitted)": r.statusCounts.submitted,
            "Төлөв (Approved)": r.statusCounts.approved,
            "Төлөв (Evaluated)": r.statusCounts.evaluated
        }));

        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, "Team Summary");

        // 2. Details Sheet (Raw Goals)
        const detailsData = data.goals.map((g: any) => {
            const emp = data.rows.find(r => r.employeeId === g.employeeId);

            return {
                "Ажилтан": emp?.employeeName || "-",
                "Зорилт": g.title,
                "Төлөв": g.status,
                "Жин": g.weight,
                "Гүйцэтгэл (%)": g.progress,
                "Чанар (1-5)": g.qualityRating || "-",
                "Дуусах огноо": g.dueDate || "-",
                "Тайлбар": g.description || ""
            };
        });

        const wsDetails = XLSX.utils.json_to_sheet(detailsData);
        XLSX.utils.book_append_sheet(wb, wsDetails, "Goal Details");

        // Generate Buffer
        const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

        // Send Headers
        const fileName = `Performance_Report_${data.period.name}_${format(new Date(), "yyyy-MM-dd")}.xlsx`;
        res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(fileName)}"`);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

        res.send(buf);

    } catch (err: any) {
        console.error(err);
        res.status(500).send("Error generating Excel: " + err.message);
    }
});

// Get inbox
router.get("/performance/inbox", requireTenant, async (req: any, res) => {
    try {
        const role = req.user.role;
        // Allow Admins, HRs, Managers. Block Employees.
        if (isEmployee(role) && !isPrivileged(role) && !isManager(role)) {
            return res.status(403).json({ message: "Access denied." });
        }

        const inbox = await storage.getPerformanceInbox(req.tenantId, req.user.id, role);
        res.json(inbox);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error fetching inbox" });
    }
});

export default router;
