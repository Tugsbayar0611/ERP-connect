import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { eq, and, sql } from "drizzle-orm";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { z } from "zod";
import { calculateMongolianPayroll } from "@shared/payroll-calculator";
import {
    insertEmployeeSchema,
    insertDepartmentSchema,
    insertAttendanceDaySchema,
    insertPayrollRunSchema,
    insertPayslipSchema,
    type DbInsertEmployee,
    type DbInsertDepartment,
    type DbInsertAttendanceDay,
    type DbInsertPayrollRun,
    type DbInsertPayslip,
    type Payslip
} from "@shared/schema";
import { createAuditLog, getAuditContext } from "../audit-log";
import { requireTenant, requireTenantAndPermission, getCurrentUserContext } from "../middleware";
import { isPrivileged } from "../../shared/roles";

import {
    insertSafetyIncidentSchema,
    insertSalaryAdvanceSchema,
    insertEmployeeAllowanceSchema,
    insertCompanyPostSchema,
    insertPostCommentSchema,
    postLikes, postComments,
    type DbInsertCompanyPost,
    type DbInsertPostComment,
    type DbInsertSalaryAdvance,
    type DbInsertEmployeeAllowance
} from "@shared/schema";

const router = Router();

// Helper: Calculate working days in month (excluding weekends)
function calculateWorkingDaysInMonth(monthStr: string): number {
    // monthStr format: "YYYY-MM"
    const [year, month] = monthStr.split('-').map(Number);
    const date = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0);

    let workingDays = 0;
    const current = new Date(date);

    while (current <= endDate) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Exclude Sunday (0) and Saturday (6)
            workingDays++;
        }
        current.setDate(current.getDate() + 1);
    }

    return workingDays;
}

// ==========================================
// 0. ME (Profile)
// ==========================================

router.get("/me", requireTenant, async (req: any, res) => {
    try {
        const userId = req.user.id;
        const employee = await storage.getEmployeeByUserId(userId);

        // Return combined user and employee data
        res.json({
            user: {
                id: req.user.id,
                username: req.user.username,
                email: req.user.email,
                role: req.user.role,
                fullName: req.user.fullName,
            },
            employee: employee || null
        });
    } catch (err: any) {
        console.error("GET /me error:", err);
        res.status(500).json({ message: "Failed to fetch profile" });
    }
});

// ==========================================
// EMPLOYEES
// ==========================================

router.get("/employees", requireTenant, async (req: any, res) => {
    try {
        const employees = await storage.getEmployees(req.tenantId);
        const userRole = req.user.role?.toLowerCase();

        // If Admin or HR, return full list
        if (userRole === "admin" || userRole === "hr") {
            return res.json(employees);
        }

        // For regular employees, return specific "Directory" fields only
        const directory = employees.map(emp => ({
            id: emp.id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            position: emp.position,
            departmentId: emp.departmentId,
            phone: emp.phone,
            email: emp.email,
            // Explicitly exclude: baseSalary, nationalId, bankAccount, birthDate, etc.
        }));

        res.json(directory);
    } catch (err: any) {
        console.error("GET /employees error:", err);
        res.status(500).json({ message: "Failed to fetch employees" });
    }
});

router.get("/employees/:id", requireTenant, async (req: any, res) => {
    try {
        const employee = await storage.getEmployee(req.params.id);
        if (!employee || employee.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Employee not found" });
        }

        // Strict RBAC: Allow if Admin/HR OR if requesting own record
        const userRole = req.user.role?.toLowerCase();
        const currentEmployee = await storage.getEmployeeByUserId(req.user.id);
        const isSelf = currentEmployee?.id === employee.id;

        if (userRole !== "admin" && userRole !== "hr" && !isSelf) {
            return res.status(403).json({ message: "Access denied" });
        }

        res.json(employee);
    } catch (err: any) {
        console.error("GET /employees/:id error:", err);
        res.status(500).json({ message: "Failed to fetch employee" });
    }
});

// Real-time Salary Display API
router.get("/employees/:id/realtime-salary", requireTenant, async (req: any, res) => {
    try {
        const employeeId = req.params.id;
        const currentMonth = req.query.month as string || format(new Date(), "yyyy-MM");

        // Get employee
        const employee = await storage.getEmployee(employeeId);
        if (!employee || employee.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Employee not found" });
        }

        // Get current month attendance
        const monthStart = `${currentMonth}-01`;
        const monthEnd = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 0)
            .toISOString().split('T')[0];

        const attendance = await storage.getAttendanceByEmployeeAndDateRange(
            req.tenantId,
            employeeId,
            monthStart,
            monthEnd
        );

        // Calculate days worked
        const daysWorked = attendance.filter((a: any) => a.status === "present" || a.status === "late").length;
        const lateDays = attendance.filter((a: any) => a.status === "late").length;

        // Get working days in month
        const totalWorkingDays = calculateWorkingDaysInMonth(currentMonth);

        // Get allowances
        const allowances = await storage.getEmployeeAllowances(req.tenantId, employeeId);
        const activeAllowances = allowances.filter((a: any) => {
            if (!a.isRecurring) return false;
            const effectiveFrom = new Date(a.effectiveFrom);
            const effectiveTo = a.effectiveTo ? new Date(a.effectiveTo) : null;
            return effectiveFrom <= new Date(monthEnd) && (!effectiveTo || effectiveTo >= new Date(monthStart));
        });

        // Get approved advances
        const advances = await storage.getSalaryAdvances(req.tenantId, employeeId, "approved");
        const activeAdvances = advances.filter((a: any) => {
            const remaining = Number(a.amount) - Number(a.deductedAmount || 0);
            return remaining > 0;
        });

        // ... Advances logic ...

        // Calculate base salary for current period
        const baseSalary = Number(employee.baseSalary || 0);
        const calculatedBaseSalary = Math.round((baseSalary / totalWorkingDays) * daysWorked);

        // Format allowances for calculator (matching Allowance interface)
        const allowanceData = activeAllowances.map((a: any) => ({
            id: a.id,
            code: a.code || '',
            name: a.name || '',
            amount: Number(a.amount),
            isTaxable: a.isTaxable !== false,
            isSHI: a.isSHI !== false,
            isPIT: a.isPIT !== false
        }));

        // Format advances for calculator (matching SalaryAdvance interface)
        const advanceData = activeAdvances.map((a: any) => ({
            id: a.id,
            amount: Number(a.amount),
            deductedAmount: Number(a.deductedAmount || 0),
            deductionType: (a.deductionType || 'monthly') as 'monthly' | 'one-time',
            monthlyDeductionAmount: Number(a.monthlyDeduction || 0)
        }));

        // Get Payroll Staging (e.g. Canteen Deductions)
        // Staging lines have NEGATIVE amount for deduction. We need positive for calculator input.
        const stagingLines = await storage.getPayrollStagingLines(req.tenantId, currentMonth);
        const employeeStagingLines = stagingLines.filter((l: any) => l.employeeId === employeeId && l.status !== 'voided');

        const otherDeductions = employeeStagingLines.map((l: any) => ({
            description: l.description || l.sourceType,
            amount: Math.abs(Number(l.amount)) // Convert -50000 to 50000
        }));

        const calculation = calculateMongolianPayroll({
            baseSalary: calculatedBaseSalary,
            allowances: allowanceData,
            advances: advanceData,
            otherDeductions: otherDeductions,
            minimumWage: 550000,
            employeeSHIRate: 11.5,
            employerSHIRate: 12.5,
        });

        // Calculate projected (if works all days)
        const projectedCalculation = calculateMongolianPayroll({
            baseSalary: baseSalary,
            allowances: allowanceData,
            advances: advanceData,
            minimumWage: 550000,
            employeeSHIRate: 11.5,
            employerSHIRate: 12.5,
        });

        res.json({
            employeeId,
            currentMonth,
            baseSalary,
            daysWorked,
            lateDays,
            totalWorkingDays,
            calculatedBaseSalary,
            allowances: {
                list: activeAllowances,
                total: calculation.allowances.taxable + calculation.allowances.nonTaxable,
            },
            advances: {
                count: activeAdvances.length,
                deductedThisMonth: calculation.advances.deducted,
            },
            current: {
                grossPay: calculation.grossPay,
                totalDeductions: calculation.totalDeductions,
                netPay: calculation.netPay,
            },
            projected: {
                grossPay: projectedCalculation.grossPay,
                totalDeductions: projectedCalculation.totalDeductions,
                netPay: projectedCalculation.netPay,
            },
            breakdown: {
                shi: calculation.shi,
                pit: calculation.pit,
                advances: calculation.advances,
            },
        });
    } catch (err: any) {
        console.error("Real-time salary error:", err);
        res.status(500).json({ message: err.message || "Error calculating real-time salary" });
    }
});

router.post("/employees", requireTenantAndPermission, async (req: any, res) => {
    try {
        const { createUser, password, role, ...otherData } = req.body;

        let userId = undefined;

        // 1. Enforce jobTitleId validation FIRST
        if (!otherData.jobTitleId) {
            return res.status(400).json({ message: "Албан тушаал сонгоно уу." });
        }
        const existingTitle = await storage.getJobTitle(req.tenantId, otherData.jobTitleId);
        if (!existingTitle) {
            return res.status(400).json({ message: "Сонгосон албан тушаал олдсонгүй." });
        }

        // 2. Create User Login if requested
        if (createUser) {
            if (!otherData.email || !role) {
                return res.status(400).json({ message: "Системийн эрх үүсгэхэд имэйл болон эрх шаардлагатай" });
            }

            // Check if user with email already exists
            const existingUser = await storage.getUserByUsername(otherData.email);
            if (existingUser) {
                return res.status(400).json({ message: "Энэ имэйл хаягтай хэрэглэгч аль хэдийн бүртгэгдсэн байна" });
            }

            const crypto = await import("crypto");
            const { sendInvitationEmail } = await import("../email");

            const rawToken = crypto.randomBytes(32).toString("hex");
            const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");

            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 48); // Valid for 48 hours

            const newUser = await storage.createUser({
                tenantId: req.tenantId,
                email: otherData.email,
                username: otherData.email,
                passwordHash: null as any, // Nullable initially
                inviteTokenHash: tokenHash,
                inviteExpiresAt: expiresAt,
                fullName: `${otherData.firstName} ${otherData.lastName || ''}`.trim(),
                role: role,
                status: "invited", // Different from active
                isActive: true,
                mustChangePassword: false, // They'll set it during invite acceptance
            });
            userId = newUser.id;

            // Send invite email asynchronously
            sendInvitationEmail(otherData.email, rawToken, otherData.firstName).catch(console.error);
        }

        const input = {
            ...insertEmployeeSchema.parse(otherData),
            tenantId: req.tenantId,
            userId: userId
        } as DbInsertEmployee;

        const employee = await storage.createEmployee(input);

        // Audit log
        await createAuditLog(
            getAuditContext(req),
            "employee",
            employee.id,
            "create",
            undefined,
            employee,
            `Employee ${employee.employeeNo || employee.firstName} created${userId ? ' with user account' : ''}`
        );

        res.status(201).json(employee);
    } catch (err) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error(err);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
});

router.put("/employees/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        // Validate ownership
        const existing = await storage.getEmployee(req.params.id);
        if (!existing || existing.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Employee not found" });
        }

        const { role, ...employeeFields } = req.body;
        const input = insertEmployeeSchema.partial().parse(employeeFields); // Allow partial updates
        
        // Update user role if user exists and role is submitted
        let userRoleUpdated = false;
        if (existing.userId && role) {
            await storage.updateUser(existing.userId, { role });
            userRoleUpdated = true;
        }

        const employeeBefore = existing;
        const employee = await storage.updateEmployee(req.params.id, input);

        // Audit log
        await createAuditLog(
            getAuditContext(req),
            "employee",
            req.params.id,
            "update",
            employeeBefore,
            employee,
            `Employee ${employee.employeeNo || employee.firstName} updated`
        );

        res.json(employee);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Error updating employee" });
    }
});

router.delete("/employees/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const existing = await storage.getEmployee(req.params.id);
        if (!existing || existing.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Ажилтан олдсонгүй" });
        }

        await storage.deleteEmployee(req.params.id);

        // Audit log
        await createAuditLog(
            getAuditContext(req),
            "employee",
            req.params.id,
            "delete",
            existing,
            null,
            `Employee ${existing.employeeNo || existing.firstName} deleted`
        );

        res.status(204).send();
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Ажилтан устгахад алдаа гарлаа" });
    }
});

// ==========================================
// LEAVE REQUESTS
// ==========================================

router.get("/leave-requests", requireTenant, async (req: any, res) => {
    try {
        const status = req.query.status as string | undefined;
        const employeeId = req.query.employeeId as string | undefined;
        const requests = await storage.getLeaveRequests(req.tenantId, status, employeeId);
        res.json(requests);
    } catch (err: any) {
        console.error("Get leave requests error:", err);
        res.status(500).json({ message: "Error fetching leave requests" });
    }
});

router.get("/leave-requests/pending-count", requireTenant, async (req: any, res) => {
    try {
        const count = await storage.getPendingLeaveRequestsCount(req.tenantId);
        res.json({ count });
    } catch (err: any) {
        console.error("Get pending leave requests count error:", err);
        res.status(500).json({ message: "Error fetching pending count" });
    }
});

router.post("/leave-requests", requireTenantAndPermission, async (req: any, res) => {
    try {
        const { employeeId, type, startDate, endDate, reason } = req.body;

        if (!employeeId || !type || !startDate || !endDate) {
            return res.status(400).json({ message: "employeeId, type, startDate, endDate шаардлагатай" });
        }

        const request = await storage.createLeaveRequest({
            tenantId: req.tenantId,
            employeeId,
            type,
            startDate,
            endDate,
            reason,
        });

        // Audit log
        await createAuditLog(
            getAuditContext(req),
            "leave_request",
            request.id,
            "create",
            undefined,
            request,
            `Чөлөөний хүсэлт үүсгэв (${type})`
        );

        res.status(201).json(request);
    } catch (err: any) {
        console.error("Create leave request error:", err);
        res.status(500).json({ message: err.message || "Error creating leave request" });
    }
});

router.patch("/leave-requests/:id/status", requireTenantAndPermission, async (req: any, res) => {
    try {
        const { status, rejectionReason } = req.body;

        if (!status || !["approved", "rejected", "pending"].includes(status)) {
            return res.status(400).json({ message: "status буруу байна (approved, rejected, pending)" });
        }

        const update: any = {
            status,
            updatedAt: new Date(),
        };

        if (status === "approved") {
            update.approvedBy = req.user.id;
            update.approvedAt = new Date();
        } else if (status === "rejected") {
            update.rejectionReason = rejectionReason;
        }

        const updated = await storage.updateLeaveRequest(req.params.id, update);

        // Audit log
        await createAuditLog(
            getAuditContext(req),
            "leave_request",
            req.params.id,
            status === "approved" ? "approve" : status === "rejected" ? "reject" : "update",
            undefined,
            updated,
            status === "approved" ? "Чөлөөний хүсэлт батлагдсан" : status === "rejected" ? "Чөлөөний хүсэлт татгалзсан" : "Чөлөөний хүсэлт шинэчлэгдсэн"
        );

        res.json(updated);
    } catch (err: any) {
        console.error("Update leave request error:", err);
        res.status(500).json({ message: err.message || "Error updating leave request" });
    }
});

router.post("/leave-requests/:id/cancel", requireTenantAndPermission, async (req: any, res) => {
    try {
        // Use plural method and filter by ID (workaround)
        const allRequests = await storage.getLeaveRequests(req.tenantId);
        const existing = allRequests.find((r: any) => String(r.id) === String(req.params.id));

        if (!existing || existing.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Request not found" });
        }

        // Logic: Only owner can cancel (or admin). And only if pending.
        const isOwner = existing.employeeId === (req.user.employeeId || (await storage.getEmployeeByUserId(req.user.id))?.id);
        const isAdmin = isPrivileged(req.user.role);

        if (!isOwner && !isAdmin) {
            return res.status(403).json({ message: "Permission denied" });
        }

        if (existing.status !== "pending") {
            return res.status(400).json({ message: "Only pending requests can be cancelled" });
        }

        const updated = await storage.updateLeaveRequest(req.params.id, {
            status: "cancelled"
        });

        // Audit log
        await createAuditLog(
            getAuditContext(req),
            "leave_request",
            req.params.id,
            "cancel",
            undefined,
            updated,
            "Чөлөөний хүсэлт цуцлагдлаа"
        );

        res.json(updated);
        // ... (previous code)

    } catch (err: any) {
        console.error("Cancel leave request error:", err);
        res.status(500).json({ message: err.message || "Error cancelling request" });
    }
});

router.get("/leave-requests/:id/history", requireTenant, async (req: any, res) => {
    try {
        const { id } = req.params;

        // Verify existence
        const request = (await storage.getLeaveRequests(req.tenantId)).find((r: any) => String(r.id) === String(id));
        if (!request) return res.status(404).json({ message: "Leave request not found" });

        // Query Audit Logs
        // We need to implement getAuditLogsForEntity in storage or query directly
        // For now, let's assume storage has a general getAuditLogs method or similar. 
        // If not, we might need to add it or use raw query.
        // Looking at storage.ts might be needed. 
        // Let's assume we can reuse storage.getRequestEvents-like logic but for audit logs.
        // Or simply query audit_logs table.

        // Since I cannot easily add method to storage class without seeing it, 
        // I will use `db` directly here as `hr.ts` imports `db` and schema.

        const { auditLogs, users, employees } = await import("@shared/schema");
        const { eq, and, desc } = await import("drizzle-orm");

        const logs = await db
            .select()
            .from(auditLogs)
            .where(
                and(
                    eq(auditLogs.entity, "leave_request"),
                    eq(auditLogs.entityId, id)
                )
            )
            .orderBy(desc(auditLogs.createdAt));

        // Enrich with actor names
        const enrichedLogs = await Promise.all(logs.map(async (log) => {
            let actorName = "System";
            if (log.actorId) {
                const actor = await storage.getUser(log.actorId);
                if (actor) {
                    const emp = await storage.getEmployeeByUserId(actor.id);
                    actorName = emp ? `${emp.firstName} ${emp.lastName}` : (actor.fullName || actor.username);
                }
            }

            // Map action/message to clearer text if needed
            let comment = log.action;
            if (log.action === 'reject' && log.afterData) {
                const data = log.afterData as any;
                if (data.rejectionReason) comment = data.rejectionReason;
            }

            return {
                id: log.id,
                requestId: id,
                actorId: log.actorId,
                actorName,
                eventType: log.action === 'update' ? 'updated' : log.action === 'create' ? 'created' : log.action === 'approve' ? 'decision' : log.action === 'reject' ? 'decision' : log.action,
                toStatus: log.action === 'approve' ? 'approved' : log.action === 'reject' ? 'rejected' : undefined,
                comment: comment,
                createdAt: log.createdAt,
                meta: log.beforeData || {}
            };
        }));

        res.json(enrichedLogs);
    } catch (err: any) {
        console.error("Get leave request history error:", err);
        res.status(500).json({ message: "Error fetching history" });
    }
});

// ... (previous code)

// ==========================================
// DEPARTMENTS
// ==========================================

router.get("/departments", requireTenant, async (req: any, res) => {
    try {
        const context = await getCurrentUserContext(req);
        const withStats = req.query.stats === "true";

        let depts: any[];
        if (withStats) {
            depts = await storage.getDepartmentsWithStats(req.tenantId);
        } else {
            depts = await storage.getDepartments(req.tenantId);
        }

        // RBAC Filtering:
        if (!context.isAdmin) {
            if (context.managedDepartmentId) {
                // Dept Manager: Only their department
                depts = depts.filter((d: any) => d.id === context.managedDepartmentId);
            } else {
                // Staff: Summary only (remove sensitive data)
                depts = depts.map((d: any) => ({
                    id: d.id,
                    name: d.name,
                    code: d.code,
                    employeeCount: d.employeeCount || 0,
                    ...(withStats ? {
                        attendanceKPI: d.attendanceKPI,
                        topEmployees: d.topEmployees?.slice(0, 3) || [],
                    } : {}),
                }));
            }
        }

        res.json(depts);
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

router.post("/departments", requireTenant, async (req: any, res) => {
    try {
        const input = { ...insertDepartmentSchema.parse(req.body), tenantId: req.tenantId } as DbInsertDepartment;
        const dept = await storage.createDepartment(input);

        await createAuditLog(
            getAuditContext(req),
            "department",
            dept.id,
            "create",
            undefined,
            { name: dept.name, code: dept.code, managerId: dept.managerId },
            `${dept.name} хэлтэс үүсгэлээ`
        );

        res.status(201).json(dept);
    } catch (err) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error(err);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
});

router.get("/departments/:id/details", requireTenant, async (req: any, res) => {
    try {
        const context = await getCurrentUserContext(req);
        const departmentId = req.params.id;

        if (!context.isAdmin && context.managedDepartmentId !== departmentId) {
            if (!context.managedDepartmentId) {
                const dept = await storage.getDepartment(req.tenantId, departmentId);
                if (!dept) {
                    return res.status(404).json({ message: "Department not found" });
                }

                const deptsWithStats = await storage.getDepartmentsWithStats(req.tenantId);
                const deptStats = deptsWithStats.find((d: any) => d.id === departmentId);

                return res.json({
                    id: dept.id,
                    name: dept.name,
                    code: dept.code,
                    employeeCount: deptStats?.employeeCount || 0,
                    attendanceKPI: deptStats?.attendanceKPI || 0,
                    topEmployees: deptStats?.topEmployees?.slice(0, 3) || [],
                });
            } else {
                return res.status(403).json({
                    message: "Permission denied: You can only view your own department details"
                });
            }
        }

        const details = await storage.getDepartmentDetails(req.tenantId, departmentId);
        res.json(details);
    } catch (err: any) {
        if (err.message === "Department not found") {
            res.status(404).json({ message: err.message });
        } else {
            console.error(err);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
});

router.put("/departments/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const existing = await storage.getDepartment(req.tenantId, req.params.id);
        if (!existing) {
            return res.status(404).json({ message: "Department not found" });
        }

        const updates = insertDepartmentSchema.partial().parse(req.body);

        const isParentChange = updates.parentDepartmentId !== undefined &&
            updates.parentDepartmentId !== existing.parentDepartmentId;

        if (updates.parentDepartmentId === req.params.id) {
            return res.status(400).json({ message: "Хэлтэс өөрийн эцэг хэлтэс болж болохгүй" });
        }

        if (updates.parentDepartmentId) {
            const parentDept = await storage.getDepartment(req.tenantId, updates.parentDepartmentId);
            if (!parentDept) {
                return res.status(400).json({ message: "Эцэг хэлтэс олдсонгүй" });
            }
        }

        const updated = await storage.updateDepartment(req.params.id, updates);

        // Audit log
        if (isParentChange) {
            const oldParentName = existing.parentDepartmentId
                ? (await storage.getDepartment(req.tenantId, existing.parentDepartmentId))?.name || "Эцэг хэлтэсгүй"
                : "Эцэг хэлтэсгүй";
            const newParentName = updated.parentDepartmentId
                ? (await storage.getDepartment(req.tenantId, updated.parentDepartmentId))?.name || "Эцэг хэлтэсгүй"
                : "Эцэг хэлтэсгүй";

            await createAuditLog(
                getAuditContext(req),
                "department",
                updated.id,
                "update",
                {
                    name: existing.name,
                    parentDepartmentId: existing.parentDepartmentId,
                    parentDepartmentName: oldParentName
                },
                {
                    name: updated.name,
                    parentDepartmentId: updated.parentDepartmentId,
                    parentDepartmentName: newParentName
                },
                `${updated.name} хэлтэсийн бүтэц өөрчлөгдлөө: "${oldParentName}" → "${newParentName}"`
            );
        } else {
            await createAuditLog(
                getAuditContext(req),
                "department",
                updated.id,
                "update",
                existing ? { name: existing.name, code: existing.code } : undefined,
                { name: updated.name, code: updated.code },
                `${updated.name} хэлтэс засагдлаа`
            );
        }

        res.json(updated);
    } catch (err: any) {
        if (err.message === "Department not found") {
            res.status(404).json({ message: err.message });
        } else if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error(err);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
});

router.put("/departments/:id/manager", requireTenantAndPermission, async (req: any, res) => {
    const context = await getCurrentUserContext(req);
    if (!context.isAdmin) {
        return res.status(403).json({
            message: "Permission denied: Only HR Admin can assign department managers"
        });
    }
    try {
        const { employeeId } = req.body;
        const existing = await storage.getDepartment(req.tenantId, req.params.id);
        let oldManager = null;
        let newManager = null;

        if (existing?.managerId) {
            const oldMgr = await storage.getEmployee(existing.managerId);
            if (oldMgr) {
                oldManager = { id: oldMgr.id, name: `${oldMgr.firstName} ${oldMgr.lastName || ""}` };
            }
        }

        const updated = await storage.assignManagerToDepartment(req.params.id, employeeId || null);

        if (employeeId) {
            const newMgr = await storage.getEmployee(employeeId);
            if (newMgr) {
                newManager = { id: newMgr.id, name: `${newMgr.firstName} ${newMgr.lastName || ""}` };
            }
        }

        const message = employeeId
            ? `${newManager?.name || employeeId}-г ${updated.name} хэлтсийн даргаар томилов`
            : `${updated.name} хэлтсийн даргыг арилгав`;

        await createAuditLog(
            getAuditContext(req),
            "department",
            updated.id,
            "update",
            oldManager ? { managerId: oldManager.id, managerName: oldManager.name } : undefined,
            newManager ? { managerId: newManager.id, managerName: newManager.name } : { managerId: null },
            message
        );

        res.json(updated);
    } catch (err: any) {
        if (err.message === "Department not found") {
            res.status(404).json({ message: err.message });
        } else {
            console.error(err);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
});

router.delete("/departments/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const existing = await storage.getDepartment(req.tenantId, req.params.id);

        if (!existing) {
            return res.status(404).json({ message: "Department not found" });
        }

        await storage.deleteDepartment(req.params.id);

        await createAuditLog(
            getAuditContext(req),
            "department",
            req.params.id,
            "delete",
            { name: existing.name, code: existing.code, managerId: existing.managerId },
            undefined,
            `${existing.name} хэлтэс устгагдлаа`
        );

        res.json({ message: "Department deleted successfully" });
    } catch (err: any) {
        if (err.message === "Department not found") {
            res.status(404).json({ message: err.message });
        } else {
            console.error(err);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
});

router.post("/departments/:id/assign-employees", requireTenantAndPermission, async (req: any, res) => {
    const context = await getCurrentUserContext(req);
    if (!context.isAdmin) {
        return res.status(403).json({
            message: "Permission denied: Only HR Admin can assign employees to departments"
        });
    }
    try {
        const { employeeIds } = z.object({ employeeIds: z.array(z.string().uuid()) }).parse(req.body);

        const dept = await storage.getDepartment(req.tenantId, req.params.id);
        if (!dept) {
            return res.status(404).json({ message: "Department not found" });
        }

        const employees = await storage.getEmployees(req.tenantId);
        const assignedEmployees = employees
            .filter(emp => employeeIds.includes(emp.id))
            .map(emp => ({ id: emp.id, name: `${emp.firstName} ${emp.lastName || ""}`, employeeNo: emp.employeeNo }));

        const oldAssignments = employees
            .filter(emp => employeeIds.includes(emp.id) && emp.departmentId)
            .map(emp => ({
                employeeId: emp.id,
                employeeName: `${emp.firstName} ${emp.lastName || ""}`,
                oldDepartmentId: emp.departmentId
            }));

        await storage.batchAssignEmployeesToDepartment(req.params.id, employeeIds);

        const employeeNames = assignedEmployees.map(e => e.name).join(", ");
        const message = `${dept.name} хэлтэст ${employeeIds.length} ажилтан хуваарилав: ${employeeNames}`;

        await createAuditLog(
            getAuditContext(req),
            "department",
            req.params.id,
            "update",
            oldAssignments.length > 0 ? { oldAssignments } : undefined,
            {
                employeeIds,
                employeeNames: assignedEmployees.map(e => e.name),
                departmentName: dept.name
            },
            message
        );

        res.json({ message: "Employees assigned successfully" });
    } catch (err: any) {
        if (err.message === "Department not found") {
            res.status(404).json({ message: err.message });
        } else if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error(err);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
});

// ==========================================
// ATTENDANCE
// ==========================================

router.get("/attendance", requireTenant, async (req: any, res) => {
    let { employeeId, startDate, endDate } = req.query;

    // RBAC: Non-admin users can only see their own attendance
    const userRole = req.user.role?.toLowerCase();
    if (userRole !== "admin" && userRole !== "hr" && userRole !== "manager") {
        const currentEmployee = await storage.getEmployeeByUserId(req.user.id);
        if (!currentEmployee) {
            return res.status(403).json({ message: "No employee record linked to user" });
        }
        // Force employeeId to self, ignore query param
        employeeId = currentEmployee.id;
    }

    if (employeeId && startDate && endDate) {
        const att = await storage.getAttendanceByEmployeeAndDateRange(
            req.tenantId,
            employeeId as string,
            startDate as string,
            endDate as string
        );
        res.json(att);
    } else if (employeeId) {
        // If only employeeId specified, get all attendance for that employee
        const att = await storage.getAttendanceByEmployee(req.tenantId, employeeId as string);
        res.json(att);
    } else {
        // Admin/HR can get all attendance
        if (userRole !== "admin" && userRole !== "hr" && userRole !== "manager") {
            return res.status(403).json({ message: "Access denied" });
        }
        const att = await storage.getAttendance(req.tenantId);
        res.json(att);
    }
});

router.post("/attendance", requireTenantAndPermission, async (req: any, res) => {
    try {
        const input = { ...insertAttendanceDaySchema.parse(req.body), tenantId: req.tenantId } as DbInsertAttendanceDay;
        const att = await storage.createAttendance(input);

        // TODO: Extract gamification helpers
        // awardAttendancePoints(req.tenantId, att.employeeId, att.status).catch(console.error);
        // checkAndAwardEarlyBirdBadge(req.tenantId, att.employeeId).catch(console.error);

        res.status(201).json(att);
    } catch (err) {
        if (err instanceof z.ZodError) {
            console.error("Validation error:", err.errors);
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error(err);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
});

router.put("/attendance/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const existing = await storage.getAttendanceRecord(req.params.id);
        if (!existing || existing.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Attendance record not found" });
        }

        const input = insertAttendanceDaySchema.partial().parse(req.body);
        const att = await storage.updateAttendance(req.params.id, input);

        // TODO: Extract gamification helpers
        // if (input.status) {
        //   awardAttendancePoints(req.tenantId, att.employeeId, input.status).catch(console.error);
        // }
        // checkAndAwardEarlyBirdBadge(req.tenantId, att.employeeId).catch(console.error);

        res.json(att);
    } catch (err) {
        if (err instanceof z.ZodError) {
            console.error("Validation error:", err.errors);
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error(err);
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
});

router.delete("/attendance/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const existing = await storage.getAttendanceRecord(req.params.id);
        if (!existing || existing.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Attendance record not found" });
        }

        await storage.deleteAttendance(req.params.id);
        res.status(204).send();
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
    }
});

// New Employee-Centric Endpoints
// ==========================================

router.get("/attendance/me", requireTenant, async (req: any, res) => {
    try {
        const currentEmployee = await storage.getEmployeeByUserId(req.user.id);
        if (!currentEmployee) {
            return res.status(404).json({ message: "Employee record not found for this user" });
        }

        // Default to current month
        const today = new Date();
        const startDate = req.query.startDate || format(startOfMonth(today), "yyyy-MM-dd");
        const endDate = req.query.endDate || format(endOfMonth(today), "yyyy-MM-dd");

        const history = await storage.getAttendanceByEmployeeAndDateRange(
            req.tenantId,
            currentEmployee.id,
            startDate as string,
            endDate as string
        );
        res.json(history);
    } catch (err: any) {
        console.error("GET /attendance/me error:", err);
        res.status(500).json({ message: "Failed to fetch attendance history" });
    }
});

router.post("/attendance/check-in", requireTenant, async (req: any, res) => {
    try {
        const user = req.user;
        const { latitude, longitude, checkInPhoto } = req.body;

        // 1. Get Employee ID
        const employee = await storage.getEmployeeByUserId(user.id);
        if (!employee) {
            return res.status(403).json({ message: "Таньд ажилтны бүртгэл үүсээгүй байна." });
        }

        // 2. Check overlap (already checked in today?)
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const existing = await storage.getAttendanceByEmployeeAndDateRange(
            req.tenantId,
            employee.id,
            todayStr,
            todayStr
        );

        if (existing.length > 0) {
            return res.status(409).json({ message: "Өнөөдөр аль хэдийн ирц бүртгүүлсэн байна." });
        }

        // 3. Create Check-in
        const now = new Date();

        // Fetch company settings for dynamic work hours
        const settings = await storage.getCompanySettings(req.tenantId);
        const workStartTime = settings?.workStartTime || "09:00";
        const [startHour, startMinute] = workStartTime.split(':').map(Number);

        const lateThreshold = new Date();
        lateThreshold.setHours(startHour, startMinute, 0, 0);

        // Add grace period if any
        if (settings?.lateThresholdMinutes) {
            lateThreshold.setMinutes(lateThreshold.getMinutes() + settings.lateThresholdMinutes);
        }

        const status = now > lateThreshold ? "late" : "present";

        const input: DbInsertAttendanceDay = {
            tenantId: req.tenantId,
            employeeId: employee.id,
            workDate: todayStr,
            checkIn: now,
            status: status,
            checkInPhoto: checkInPhoto || null,
            minutesWorked: 0,
            note: latitude && longitude ? `Location: ${latitude}, ${longitude}` : ""
        };

        const att = await storage.createAttendance(input);

        // Optional: Award early bird points if actually early
        // checkAndAwardEarlyBirdBadge(...)

        res.status(201).json(att);
    } catch (err: any) {
        console.error("Check-in error:", err);
        res.status(500).json({ message: err.message || "Server error during check-in" });
    }
});

router.post("/attendance/check-out", requireTenant, async (req: any, res) => {
    try {
        const user = req.user;
        const { checkOutPhoto } = req.body;

        // 1. Get Employee ID
        const employee = await storage.getEmployeeByUserId(user.id);
        if (!employee) {
            return res.status(403).json({ message: "Таньд ажилтны бүртгэл үүсээгүй байна." });
        }

        // 2. Find today's open record
        const todayStr = format(new Date(), "yyyy-MM-dd");
        const records = await storage.getAttendanceByEmployeeAndDateRange(
            req.tenantId,
            employee.id,
            todayStr,
            todayStr
        );

        // Sort by checkIn time desc to get the latest
        const latestInfo = records.sort((a: any, b: any) =>
            new Date(b.checkIn).getTime() - new Date(a.checkIn).getTime()
        )[0];

        if (!latestInfo) {
            return res.status(404).json({ message: "Өнөөдрийн ирц олдсонгүй. Эхлээд 'Ирлээ' дарна уу." });
        }

        if (latestInfo.checkOut) {
            return res.status(409).json({ message: "Өнөөдөр аль хэдийн 'Гарсан' байна." });
        }

        if (!latestInfo.checkIn) {
            return res.status(400).json({ message: "Invalid check-in record" });
        }

        // 3. Update Check-out
        const now = new Date();
        const checkInTime = new Date(latestInfo.checkIn);
        const diffMs = now.getTime() - checkInTime.getTime();
        const minutesWorked = Math.floor(diffMs / 60000);

        const updated = await storage.updateAttendance(latestInfo.id, {
            checkOut: now,
            minutesWorked: minutesWorked,
            checkOutPhoto: checkOutPhoto || null
        });

        res.json(updated);
    } catch (err: any) {
        console.error("Check-out error:", err);
        res.status(500).json({ message: err.message || "Server error during check-out" });
    }
});

// ==========================================

router.get("/payroll-runs", requireTenant, async (req: any, res) => {
    // Restrict to Admin/HR only
    const userRole = req.user.role?.toLowerCase();
    if (userRole !== "admin" && userRole !== "hr") {
        return res.status(403).json({ message: "Access denied" });
    }
    const payslips = await storage.getAllPayslips(req.tenantId);
    res.json(payslips);
});

// New restricted endpoint for payslips
router.get("/payslips", requireTenant, async (req: any, res) => {
    try {
        const userRole = req.user.role?.toLowerCase();
        const currentEmployee = await storage.getEmployeeByUserId(req.user.id);

        let employeeId = req.query.employeeId as string;

        // Enforce ownership for non-admins
        if (userRole !== "admin" && userRole !== "hr") {
            if (!currentEmployee) {
                return res.status(403).json({ message: "No employee record linked to user" });
            }
            // Force query to be for self
            employeeId = currentEmployee.id;
        }

        if (employeeId) {
            const payslips = await storage.getPayslipsByEmployee(req.tenantId, employeeId);
            return res.json(payslips);
        } else {
            // If admin requesting all, shouldn't really happen via this endpoint but possible
            if (userRole === "admin" || userRole === "hr") {
                const payslips = await storage.getAllPayslips(req.tenantId);
                return res.json(payslips);
            }
            return res.status(400).json({ message: "Employee ID required" });
        }
    } catch (err: any) {
        console.error("GET /payslips error:", err);
        res.status(500).json({ message: "Failed to fetch payslips" });
    }
});

router.get("/payroll", requireTenant, async (req: any, res) => {
    // Restrict to Admin/HR only
    const userRole = req.user.role?.toLowerCase();
    if (userRole !== "admin" && userRole !== "hr") {
        return res.status(403).json({ message: "Access denied" });
    }
    const payslips = await storage.getAllPayslips(req.tenantId);
    res.json(payslips);
});

const payrollSubmissionSchema = z.object({
    employeeId: z.string(),
    periodStart: z.string(),
    periodEnd: z.string(),
    paymentDate: z.string(),
    baseSalary: z.number().or(z.string()),
    netSalary: z.number().or(z.string()),
    tax: z.number().or(z.string()).optional(),
    socialInsurance: z.number().or(z.string()).optional(),
    status: z.enum(["Pending", "Processing", "Paid"]),
});

router.post("/payroll", requireTenantAndPermission, async (req: any, res) => {
    try {
        const data = payrollSubmissionSchema.parse(req.body);

        // 1. Find or Create Payroll Run (Period)
        let run = await storage.getPayrollRunByPeriod(req.tenantId, data.periodStart, data.periodEnd);

        if (!run) {
            run = await storage.createPayrollRun({
                tenantId: req.tenantId,
                periodStart: data.periodStart,
                periodEnd: data.periodEnd,
                payDate: data.paymentDate,
                status: "draft"
            } as DbInsertPayrollRun);
        }

        // 2. Check if payslip already exists
        const existingPayslip = await storage.getPayslipByEmployeeAndRun(
            req.tenantId,
            run.id,
            data.employeeId
        );

        const totalDeductions = (Number(data.tax || 0) + Number(data.socialInsurance || 0)).toString();
        const payslipData = {
            tenantId: req.tenantId,
            payrollRunId: run.id,
            employeeId: data.employeeId,
            grossPay: data.baseSalary.toString(),
            netPay: data.netSalary.toString(),
            totalDeductions: totalDeductions,
            status: data.status === "Paid" ? "paid" : "draft",
        } as DbInsertPayslip;

        let payslip: Payslip;
        if (existingPayslip) {
            payslip = await storage.updatePayslip(existingPayslip.id, payslipData);
            res.status(200).json(payslip);
        } else {
            payslip = await storage.createPayslip(payslipData);
            res.status(201).json(payslip);
        }
    } catch (err) {
        console.error("Payroll Error:", err);
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            res.status(500).json({ message: "Internal Server Error" });
        }
    }
});

// Safety & HSE Routes
// ==========================================

router.get("/safety/debug", requireTenantAndPermission, async (req: any, res) => {
    try {
        const tenantId = req.tenantId;
        const userId = req.user?.id;
        const role = req.user?.role;

        // Only admins should see debug info
        if (role !== "admin") {
            return res.status(403).json({ message: "Access denied" });
        }

        const allIncidents = await storage.getSafetyIncidents(tenantId);

        res.json({
            message: "Debug Info",
            tenantId,
            userId,
            role,
            totalCountInDB: allIncidents.length,
            serverTime: new Date().toISOString()
        });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
});

router.get("/safety", requireTenantAndPermission, async (req: any, res) => {
    try {
        const userRole = req.user.role?.toLowerCase();
        const isAdmin = (req.user as any).isAdmin || userRole === "admin";
        const isHR = (req.user as any).isHR || userRole === "hr";
        const isManager = (req.user as any).isManager || userRole === "manager";
        const canManageAll = isAdmin || isHR || isManager;

        if (canManageAll) {
            // Admins, HR, and Managers see everything full
            const incidents = await storage.getSafetyIncidents(req.tenantId);
            return res.json(incidents);
        }

        // --- Role: Employee ---
        // 1. Fetch ALL incidents to categorize them
        const allIncidents = await storage.getSafetyIncidents(req.tenantId);

        // 2. Separate into "My Reports" and "Public Feed"
        const myReports = allIncidents.filter(i => i.reportedBy === req.user.id);

        // 3. Redact Public Feed (everything that isn't their own)
        const publicFeed = allIncidents
            .filter(i => i.reportedBy !== req.user.id) // Exclude own

            .map(i => ({
                id: i.id,
                title: i.title,
                incidentType: i.incidentType,
                date: i.date,
                location: i.location, // General location is okay
                severity: i.severity,
                status: i.status,
                resolutionDate: i.resolutionDate,
                // HIDDEN fields for privacy:
                reportedBy: null,
                description: null, // Keep description hidden in public feed for privacy
                isAnonymous: true,
                correctiveAction: i.status === 'resolved' || i.status === 'closed' ? "Арга хэмжээ авсан" : null,
                assignedTo: null,
                imageUrl: null,
                isPublicRecord: true // Helper flag for UI
            }));

        res.json({
            my: myReports,
            public: publicFeed
        });
    } catch (error) {
        console.error("GET /api/safety error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.post("/safety", requireTenantAndPermission, async (req: any, res) => {
    try {
        // We omit fields that are handled by the backend or not required from the frontend form
        const data = insertSafetyIncidentSchema.omit({
            reportedBy: true,
            assignedTo: true
        }).parse(req.body);

        if (!req.user || !req.user.id) {
            return res.status(401).json({ message: "Authentication required: User ID missing" });
        }

        const incident = await storage.createSafetyIncident({
            ...data,
            tenantId: req.tenantId,
            reportedBy: req.user.id,
        } as any);

        await createAuditLog(
            getAuditContext(req),
            "safety_incident",
            incident.id,
            "create",
            undefined,
            incident,
            `Safety incident reported: ${incident.title}`
        );

        res.status(201).json(incident);
    } catch (error: any) {
        console.error("POST /safety error message:", error.message);
        if (error instanceof z.ZodError) {
            res.status(400).json({ message: "Validation error", details: error.errors });
        } else {
            res.status(500).json({ message: "Internal server error" });
        }
    }
});

router.patch("/safety/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const incident = await storage.getSafetyIncident(req.params.id);
        if (!incident || incident.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Incident not found" });
        }

        const userRole = req.user.role?.toLowerCase();
        const canManageAll = ["admin", "hr", "manager"].includes(userRole);
        const isOwner = incident.reportedBy === req.user.id;

        const updates = insertSafetyIncidentSchema.partial().parse(req.body);

        // --- SECURITY CHECK ---

        // 1. Status Changes: ONLY Manager/HR/Admin
        if (updates.status && updates.status !== incident.status) {
            if (!canManageAll) {
                await createAuditLog(
                    getAuditContext(req),
                    "safety_incident",
                    incident.id,
                    "reject",
                    { attemptedAction: "status_change", from: incident.status, to: updates.status },
                    null,
                    "Unauthorized status change attempt by employee"
                );
                return res.status(403).json({ message: "Permission denied: Only managers can change status." });
            }
        }

        // 2. Content Changes: Owner OR Manager
        const contentFields = ["title", "description", "location", "date", "incidentType", "severity", "isAnonymous"];
        const hasContentUpdate = contentFields.some(field => field in updates);

        if (hasContentUpdate) {
            if (canManageAll) {
                // Admin/Manager can edit anytime
            } else if (isOwner) {
                // Owner can ONLY edit if status is Reported or Investigating
                if (!["reported", "investigating"].includes(incident.status)) {
                    return res.status(403).json({ message: "Cannot edit report after it has been resolved or closed." });
                }
            } else {
                return res.status(403).json({ message: "Permission denied: You can only edit your own reports." });
            }
        }

        const updated = await storage.updateSafetyIncident(req.params.id, updates);

        await createAuditLog(
            getAuditContext(req),
            "safety_incident",
            incident.id,
            "update",
            incident,
            updated,
            `Safety incident updated`
        );

        res.json(updated);
    } catch (error) {
        console.error("PATCH /api/safety error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

router.delete("/safety/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const incident = await storage.getSafetyIncident(req.params.id);
        if (!incident || incident.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Incident not found" });
        }

        const userRole = req.user.role?.toLowerCase();
        const canManageAll = ["admin", "hr", "manager"].includes(userRole);
        const isOwner = incident.reportedBy === req.user.id;

        // --- SECURITY CHECK ---
        if (canManageAll) {
            // Admin/Manager can delete
        } else if (isOwner) {
            // Owner can ONLY delete if 'reported' (not yet investigated)
            if (incident.status !== 'reported') {
                return res.status(403).json({ message: "Cannot delete report that is already under investigation or resolved." });
            }
        } else {
            return res.status(403).json({ message: "Permission denied." });
        }

        await storage.deleteSafetyIncident(req.params.id);

        await createAuditLog(
            getAuditContext(req),
            "safety_incident",
            incident.id,
            "delete",
            incident,
            null,
            `Safety incident deleted`
        );

        res.sendStatus(204);
    } catch (error) {
        console.error("DELETE /api/safety error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
});

// Delete payslip
router.delete("/payslips/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const payslip = await storage.getAllPayslips(req.tenantId);
        const existing = payslip.find((p: any) => p.id === req.params.id);

        if (!existing || existing.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Цалингийн бүртгэл олдсонгүй" });
        }

        await storage.deletePayslip(req.params.id);

        // Audit log
        await createAuditLog(
            getAuditContext(req),
            "payslip",
            req.params.id,
            "delete",
            existing,
            null,
            `Payslip deleted for employee ${existing.employeeId}`
        );

        res.status(204).send();
    } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Цалин устгахад алдаа гарлаа" });
    }
});

// --- Salary Advances ---
router.get("/salary-advances", requireTenant, async (req: any, res) => {
    try {
        const employeeId = req.query.employeeId;
        const status = req.query.status;
        const advances = await storage.getSalaryAdvances(req.tenantId, employeeId, status);
        res.json(advances);
    } catch (err: any) {
        console.error("Salary advances error:", err);
        res.status(500).json({ message: err.message || "Error fetching salary advances" });
    }
});

router.get("/salary-advances/:id", requireTenant, async (req: any, res) => {
    try {
        const advance = await storage.getSalaryAdvance(req.params.id);
        if (!advance || advance.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Salary advance not found" });
        }
        res.json(advance);
    } catch (err: any) {
        console.error("Salary advance error:", err);
        res.status(500).json({ message: err.message || "Error fetching salary advance" });
    }
});

router.post("/salary-advances", requireTenantAndPermission, async (req: any, res) => {
    try {
        const input = { ...insertSalaryAdvanceSchema.parse(req.body), tenantId: req.tenantId } as DbInsertSalaryAdvance;
        const advance = await storage.createSalaryAdvance(input);
        res.status(201).json(advance);
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error("Salary advance creation error:", err);
            res.status(500).json({ message: err.message || "Error creating salary advance" });
        }
    }
});

router.put("/salary-advances/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const existing = await storage.getSalaryAdvance(req.params.id);
        if (!existing || existing.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Salary advance not found" });
        }

        const update = insertSalaryAdvanceSchema.partial().parse(req.body);
        const updated = await storage.updateSalaryAdvance(req.params.id, update);
        res.json(updated);
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error("Salary advance update error:", err);
            res.status(500).json({ message: err.message || "Error updating salary advance" });
        }
    }
});

router.post("/salary-advances/:id/approve", requireTenantAndPermission, async (req: any, res) => {
    try {
        const existing = await storage.getSalaryAdvance(req.params.id);
        if (!existing || existing.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Salary advance not found" });
        }

        if (existing.status !== "pending") {
            return res.status(400).json({ message: `Cannot approve advance with status: ${existing.status} ` });
        }

        const update = {
            status: "approved" as const,
            approvedBy: req.user.id,
            approvedAt: new Date(),
            paidAt: new Date(), // Auto-pay on approval
        };

        const updated = await storage.updateSalaryAdvance(req.params.id, update);
        res.json(updated);
    } catch (err: any) {
        console.error("Salary advance approval error:", err);
        res.status(500).json({ message: err.message || "Error approving salary advance" });
    }
});

router.post("/salary-advances/:id/reject", requireTenantAndPermission, async (req: any, res) => {
    try {
        const existing = await storage.getSalaryAdvance(req.params.id);
        if (!existing || existing.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Salary advance not found" });
        }

        if (existing.status !== "pending") {
            return res.status(400).json({ message: `Cannot reject advance with status: ${existing.status} ` });
        }

        const { rejectionReason } = req.body;
        const update = {
            status: "rejected" as const,
            approvedBy: req.user.id,
            approvedAt: new Date(),
            rejectionReason: rejectionReason || "Rejected",
        };

        const updated = await storage.updateSalaryAdvance(req.params.id, update);
        res.json(updated);
    } catch (err: any) {
        console.error("Salary advance rejection error:", err);
        res.status(500).json({ message: err.message || "Error rejecting salary advance" });
    }
});

router.delete("/salary-advances/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const existing = await storage.getSalaryAdvance(req.params.id);
        if (!existing || existing.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Salary advance not found" });
        }

        await storage.deleteSalaryAdvance(req.params.id);
        res.status(204).send();
    } catch (err: any) {
        console.error("Salary advance deletion error:", err);
        res.status(500).json({ message: err.message || "Error deleting salary advance" });
    }
});

// --- Employee Allowances ---
router.get("/employee-allowances", requireTenant, async (req: any, res) => {
    try {
        const employeeId = req.query.employeeId;
        const allowances = await storage.getEmployeeAllowances(req.tenantId, employeeId);
        res.json(allowances);
    } catch (err: any) {
        console.error("Employee allowances error:", err);
        res.status(500).json({ message: err.message || "Error fetching employee allowances" });
    }
});

router.get("/employee-allowances/:id", requireTenant, async (req: any, res) => {
    try {
        const allowance = await storage.getEmployeeAllowance(req.params.id);
        if (!allowance || allowance.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Employee allowance not found" });
        }
        res.json(allowance);
    } catch (err: any) {
        console.error("Employee allowance error:", err);
        res.status(500).json({ message: err.message || "Error fetching employee allowance" });
    }
});

router.post("/employee-allowances", requireTenantAndPermission, async (req: any, res) => {
    try {
        const input = { ...insertEmployeeAllowanceSchema.parse(req.body), tenantId: req.tenantId } as DbInsertEmployeeAllowance;
        const allowance = await storage.createEmployeeAllowance(input);
        res.status(201).json(allowance);
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error("Employee allowance creation error:", err);
            res.status(500).json({ message: err.message || "Error creating employee allowance" });
        }
    }
});

router.put("/employee-allowances/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const existing = await storage.getEmployeeAllowance(req.params.id);
        if (!existing || existing.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Employee allowance not found" });
        }

        const update = insertEmployeeAllowanceSchema.partial().parse(req.body);
        const updated = await storage.updateEmployeeAllowance(req.params.id, update);
        res.json(updated);
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error("Employee allowance update error:", err);
            res.status(500).json({ message: err.message || "Error updating employee allowance" });
        }
    }
});

router.delete("/employee-allowances/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const existing = await storage.getEmployeeAllowance(req.params.id);
        if (!existing || existing.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Employee allowance not found" });
        }

        await storage.deleteEmployeeAllowance(req.params.id);
        res.status(204).send();
    } catch (err: any) {
        console.error("Employee allowance deletion error:", err);
        res.status(500).json({ message: err.message || "Error deleting employee allowance" });
    }
});

// Helper function: Check and award Early Bird badge (7 days consecutive on-time attendance)
async function checkAndAwardEarlyBirdBadge(tenantId: string, employeeId: string): Promise<void> {
    try {
        // Get last 7 days of attendance
        const today = new Date();
        const sevenDaysAgo = new Date(today);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const attendance = await storage.getAttendanceByEmployeeAndDateRange(
            tenantId,
            employeeId,
            sevenDaysAgo.toISOString().split('T')[0],
            today.toISOString().split('T')[0]
        );

        // Check if we have 7 consecutive days with "present" status (not late, not absent)
        if (attendance.length < 7) return;

        // Sort by date and check last 7 days
        const sortedAttendance = attendance
            .sort((a: any, b: any) => new Date(a.workDate).getTime() - new Date(b.workDate).getTime())
            .slice(-7);

        // Check if all 7 days are "present" (on-time)
        const allOnTime = sortedAttendance.every((a: any) => a.status === "present");

        if (allOnTime) {
            // Check if badge already awarded today
            const todayStr = today.toISOString().split('T')[0];
            const existingAchievements = await storage.getEmployeeAchievements(tenantId, employeeId);
            const alreadyAwarded = existingAchievements.some(
                (a: any) => a.achievementType === "early_bird" &&
                    new Date(a.achievedAt).toISOString().split('T')[0] === todayStr
            );

            if (!alreadyAwarded) {
                // Award badge
                await storage.createAchievement({
                    tenantId,
                    employeeId,
                    achievementType: "early_bird",
                    achievedAt: new Date(),
                    metadata: { streakDays: 7, awardedDate: todayStr },
                    createdAt: new Date()
                });

                // Award points: 50 points for Early Bird badge
                await storage.awardPoints(
                    tenantId,
                    employeeId,
                    50,
                    "Early Bird Badge - 7 days consecutive on-time attendance",
                    "achievement",
                    undefined
                );
            }
        }
    } catch (err) {
        console.error("Error checking Early Bird badge:", err);
        // Don't throw - this is a background check
    }
}

// Award points for daily attendance (called when attendance is created/updated)
async function awardAttendancePoints(tenantId: string, employeeId: string, status: string): Promise<void> {
    try {
        if (status === "present") {
            // Award 10 points for attendance
            await storage.awardPoints(tenantId, employeeId, 10, "Daily attendance", "attendance", undefined);
        } else if (status === "late") {
            // Award 5 points for late (less than on-time)
            await storage.awardPoints(tenantId, employeeId, 5, "Late attendance", "attendance", undefined);
        }
    } catch (err) {
        console.error("Error awarding attendance points:", err);
    }
}

// --- HR Gamification ---
router.get("/employees/:id/achievements", requireTenant, async (req: any, res) => {
    try {
        const employeeId = req.params.id;
        const employee = await storage.getEmployee(employeeId);
        if (!employee || employee.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Employee not found" });
        }

        const achievements = await storage.getEmployeeAchievements(req.tenantId, employeeId);
        res.json(achievements);
    } catch (err: any) {
        console.error("Achievements error:", err);
        res.status(500).json({ message: err.message || "Error fetching achievements" });
    }
});

router.get("/employees/:id/points", requireTenant, async (req: any, res) => {
    try {
        const employeeId = req.params.id;
        const employee = await storage.getEmployee(employeeId);
        if (!employee || employee.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Employee not found" });
        }

        const points = await storage.getEmployeePoints(req.tenantId, employeeId);
        res.json(points || { points: 0, employeeId, tenantId: req.tenantId });
    } catch (err: any) {
        console.error("Points error:", err);
        res.status(500).json({ message: err.message || "Error fetching points" });
    }
});

router.get("/employees/:id/points-history", requireTenant, async (req: any, res) => {
    try {
        const employeeId = req.params.id;
        const employee = await storage.getEmployee(employeeId);
        if (!employee || employee.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Employee not found" });
        }

        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const history = await storage.getPointsHistory(req.tenantId, employeeId, limit);
        res.json(history);
    } catch (err: any) {
        console.error("Points history error:", err);
        res.status(500).json({ message: err.message || "Error fetching points history" });
    }
});

router.get("/achievements/leaderboard", requireTenant, async (req: any, res) => {
    try {
        // Get all employees with their points
        const employees = await storage.getEmployees(req.tenantId);
        const leaderboard = await Promise.all(
            employees.map(async (emp: any) => {
                const points = await storage.getEmployeePoints(req.tenantId, emp.id);
                const achievements = await storage.getEmployeeAchievements(req.tenantId, emp.id);
                return {
                    employeeId: emp.id,
                    employeeName: `${emp.firstName} ${emp.lastName} `,
                    employeeNo: emp.employeeNo,
                    points: points ? Number(points.points) : 0,
                    achievementsCount: achievements.length,
                    achievements: achievements.slice(0, 5) // Last 5 achievements
                };
            })
        );

        // Sort by points descending
        leaderboard.sort((a: any, b: any) => b.points - a.points);

        res.json(leaderboard);
    } catch (err: any) {
        console.error("Leaderboard error:", err);
        res.status(500).json({ message: err.message || "Error fetching leaderboard" });
    }
});

// --- News Feed ---
router.get("/posts", requireTenant, async (req: any, res) => {
    try {
        const limit = req.query.limit ? parseInt(req.query.limit) : 50;
        const posts = await storage.getCompanyPosts(req.tenantId, { limit });

        // Get current user's employee ID by email
        const employees = await storage.getEmployees(req.tenantId);
        const currentEmployee = employees.find((e: any) =>
            e.email === req.user.email ||
            (req.user.email && req.user.email.toLowerCase() === e.email?.toLowerCase())
        ) || null;

        // Get likes for each post if current employee exists
        const postsWithLikes = await Promise.all(
            posts.map(async (post: any) => {
                if (currentEmployee) {
                    const [isLiked] = await db.select()
                        .from(postLikes)
                        .where(and(
                            eq(postLikes.tenantId, req.tenantId),
                            eq(postLikes.postId, post.id),
                            eq(postLikes.employeeId, currentEmployee.id)
                        ));
                    return { ...post, isLiked: !!isLiked };
                }
                return { ...post, isLiked: false };
            })
        );

        res.json(postsWithLikes);
    } catch (err: any) {
        console.error("Posts error:", err);
        res.status(500).json({ message: err.message || "Error fetching posts" });
    }
});

router.get("/posts/:id", requireTenant, async (req: any, res) => {
    try {
        const post = await storage.getCompanyPost(req.params.id);
        if (!post || post.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Post not found" });
        }
        res.json(post);
    } catch (err: any) {
        console.error("Post error:", err);
        res.status(500).json({ message: err.message || "Error fetching post" });
    }
});

router.post("/posts", requireTenantAndPermission, async (req: any, res) => {
    try {
        // Get current user's employee ID - find employee by email or username
        const employees = await storage.getEmployees(req.tenantId);
        let currentEmployee = employees.find((e: any) =>
            e.email === req.user.email ||
            e.email === req.user.username ||
            (req.user.email && req.user.email.toLowerCase() === e.email?.toLowerCase())
        );

        // If no employee found but user is Admin/Manager, create a default employee record
        if (!currentEmployee && (req.user.role === "Admin" || req.user.role === "Manager")) {
            const defaultEmployee = await storage.createEmployee({
                tenantId: req.tenantId,
                firstName: req.user.fullName || req.user.email.split("@")[0] || "System",
                lastName: "",
                email: req.user.email,
                hireDate: new Date().toISOString().split("T")[0],
                status: "active",
            } as any);
            currentEmployee = defaultEmployee;
        }

        if (!currentEmployee) {
            return res.status(403).json({ message: "Ажилтны мэдээлэл олдсонгүй. Эхлээд ажилтны мэдээлэл үүсгэнэ үү." });
        }

        const input = insertCompanyPostSchema.parse(req.body);
        const post = await storage.createCompanyPost({
            ...input,
            tenantId: req.tenantId,
            authorId: currentEmployee.id,
            createdAt: new Date(),
        } as DbInsertCompanyPost);

        res.status(201).json(post);
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error("Post creation error:", err);
            res.status(500).json({ message: err.message || "Error creating post" });
        }
    }
});

router.put("/posts/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const existing = await storage.getCompanyPost(req.params.id);
        if (!existing || existing.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Check if user is author or admin
        const employees = await storage.getEmployees(req.tenantId);
        const currentEmployee = employees.find((e: any) =>
            e.email === req.user.email ||
            (req.user.email && req.user.email.toLowerCase() === e.email?.toLowerCase())
        );

        if (existing.authorId !== currentEmployee?.id && req.user.role !== "Admin") {
            return res.status(403).json({ message: "Only post author or admin can edit" });
        }

        const updateData = insertCompanyPostSchema.partial().parse(req.body);
        const updated = await storage.updateCompanyPost(req.params.id, updateData);
        res.json(updated);
    } catch (err: any) {
        console.error("Post update error:", err);
        res.status(500).json({ message: err.message || "Error updating post" });
    }
});

router.delete("/posts/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const existing = await storage.getCompanyPost(req.params.id);
        if (!existing || existing.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Check if user is author or admin
        const employees = await storage.getEmployees(req.tenantId);
        const currentEmployee = employees.find((e: any) =>
            e.email === req.user.email ||
            (req.user.email && req.user.email.toLowerCase() === e.email?.toLowerCase())
        );

        if (existing.authorId !== currentEmployee?.id && req.user.role !== "Admin") {
            return res.status(403).json({ message: "Only post author or admin can delete" });
        }

        await storage.deleteCompanyPost(req.params.id);
        res.status(204).send();
    } catch (err: any) {
        console.error("Post deletion error:", err);
        res.status(500).json({ message: err.message || "Error deleting post" });
    }
});

router.post("/posts/:id/like", requireTenant, async (req: any, res) => {
    try {
        const post = await storage.getCompanyPost(req.params.id);
        if (!post || post.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Get current user's employee ID - find employee by email or username
        const employees = await storage.getEmployees(req.tenantId);
        const currentEmployee = employees.find((e: any) =>
            e.email === req.user.email ||
            e.email === req.user.username ||
            (req.user.email && req.user.email.toLowerCase() === e.email?.toLowerCase())
        );

        if (!currentEmployee) {
            return res.status(403).json({ message: "Employee record not found for user. Please create employee profile first." });
        }

        const result = await storage.togglePostLike(req.tenantId, req.params.id, currentEmployee.id);
        res.json(result);
    } catch (err: any) {
        console.error("Post like error:", err);
        res.status(500).json({ message: err.message || "Error toggling like" });
    }
});

router.get("/posts/:id/likes", requireTenant, async (req: any, res) => {
    try {
        const likes = await storage.getPostLikes(req.tenantId, req.params.id);
        res.json(likes.map((like: any) => ({
            ...like,
            employeeName: `${like.employeeFirstName || ""} ${like.employeeLastName || ""} `.trim() || "Unknown",
        })));
    } catch (err: any) {
        console.error("Post likes error:", err);
        res.status(500).json({ message: err.message || "Error fetching likes" });
    }
});

router.post("/posts/:id/comments", requireTenant, async (req: any, res) => {
    try {
        const post = await storage.getCompanyPost(req.params.id);
        if (!post || post.tenantId !== req.tenantId) {
            return res.status(404).json({ message: "Post not found" });
        }

        // Get current user's employee ID - find employee by email or username
        const employees = await storage.getEmployees(req.tenantId);
        const currentEmployee = employees.find((e: any) =>
            e.email === req.user.email ||
            e.email === req.user.username ||
            (req.user.email && req.user.email.toLowerCase() === e.email?.toLowerCase())
        );

        if (!currentEmployee) {
            return res.status(403).json({ message: "Employee record not found for user. Please create employee profile first." });
        }

        // Parse only content from request body, we add postId and employeeId ourselves
        const { content } = req.body;
        if (!content || typeof content !== 'string' || content.trim().length === 0) {
            return res.status(400).json({ message: "Content is required" });
        }

        const comment = await storage.createPostComment({
            content: content.trim(),
            tenantId: req.tenantId,
            postId: req.params.id,
            employeeId: currentEmployee.id,
            // Let DB set createdAt with defaultNow() for correct timezone
        } as DbInsertPostComment);

        res.status(201).json(comment);
    } catch (err: any) {
        if (err instanceof z.ZodError) {
            res.status(400).json({ message: "Validation Error", details: err.errors });
        } else {
            console.error("Comment creation error:", err);
            res.status(500).json({ message: err.message || "Error creating comment" });
        }
    }
});

router.get("/posts/:id/comments", requireTenant, async (req: any, res) => {
    try {
        const comments = await storage.getPostComments(req.tenantId, req.params.id);
        res.json(comments.map((comment: any) => ({
            ...comment,
            employeeName: `${comment.employeeFirstName || ""} ${comment.employeeLastName || ""} `.trim()
                || comment.userFullName
                || "Unknown",
        })));
    } catch (err: any) {
        console.error("Post comments error:", err);
        res.status(500).json({ message: err.message || "Error fetching comments" });
    }
});

router.delete("/posts/:postId/comments/:commentId", requireTenant, async (req: any, res) => {
    try {
        // Get comment to check ownership
        const comments = await storage.getPostComments(req.tenantId, req.params.postId);
        const comment = comments.find((c: any) => c.id === req.params.commentId);

        if (!comment) {
            return res.status(404).json({ message: "Comment not found" });
        }

        // Check if user is comment author or admin
        const employees = await storage.getEmployees(req.tenantId);
        const currentEmployee = employees.find((e: any) => e.userId === req.user.id);
        const userRole = req.user.role?.toLowerCase();

        if (comment.employeeId !== currentEmployee?.id && userRole !== "admin") {
            return res.status(403).json({ message: "Only comment author or admin can delete" });
        }

        await storage.deletePostComment(req.params.commentId);
        res.status(204).send();
    } catch (err: any) {
        console.error("Comment deletion error:", err);
        res.status(500).json({ message: err.message || "Error deleting comment" });
    }
});

// ==========================================
// JOB TITLES (Directory)
// ==========================================

router.get("/job-titles", requireTenant, async (req: any, res) => {
    try {
        const isActive = req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined;
        const titles = await storage.getJobTitles(req.tenantId, { isActive });
        res.json(titles);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

router.post("/job-titles", requireTenantAndPermission, async (req: any, res) => {
    try {
        const { name, code } = req.body;

        if (!name) {
            return res.status(400).json({ message: "Албан тушаалын нэр заавал." });
        }

        const data = { ...req.body, tenantId: req.tenantId };

        // Check duplicates
        const existing = await storage.getJobTitles(req.tenantId);
        if (existing.some(t => t.name.toLowerCase() === name.toLowerCase())) {
            return res.status(409).json({ message: "Ийм нэртэй албан тушаал байна." });
        }
        if (code && existing.some(t => (t.code || "").toLowerCase() === code.toLowerCase())) {
            return res.status(409).json({ message: "Ийм код аль хэдийн ашиглагдаж байна." });
        }

        const jobTitle = await storage.createJobTitle(data);
        res.status(201).json(jobTitle);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

router.patch("/job-titles/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        const { isActive } = req.body;
        if (typeof isActive !== "boolean") {
            return res.status(400).json({ message: "isActive boolean value required" });
        }

        const existing = await storage.getJobTitle(req.tenantId, req.params.id);
        if (!existing) {
            return res.status(404).json({ message: "Job title not found" });
        }

        const updated = await storage.updateJobTitle(req.params.id, { isActive });
        res.json(updated);
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

router.delete("/job-titles/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
        // Soft delete preference: The user should DEACTIVATE, not delete if used.
        // For now we allow delete if it's not used, but frontend should encourage Toggle.
        // We will just return 405 Method Not Allowed as per request "Modify DELETE ... to return 405"
        // OR we can leave it for "hard delete" unused ones.
        // User instruction: "Modify DELETE ... into return 405 (Not Allowed) or remove it."
        // I will return 405 and message.
        return res.status(405).json({ message: "Устгах боломжгүй. Түүний оронд идэвхгүй болгоно уу." });
    } catch (err: any) {
        res.status(500).json({ message: err.message });
    }
});

export default router;
