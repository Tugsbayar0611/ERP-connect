import {
    employees, departments, attendanceDays, payrollRuns, payslips,
    salaryAdvances, employeeAllowances, employeeAchievements, employeePoints, pointsHistory,
    safetyIncidents, leaveRequests, performancePeriods, performanceGoals,
    type Employee, type InsertEmployee, type Department, type InsertDepartment,
    type AttendanceDay, type InsertAttendanceDay, type PayrollRun, type InsertPayrollRun,
    type Payslip, type InsertPayslip, type DbInsertEmployee, type DbInsertAttendanceDay,
    type DbInsertPayrollRun, type DbInsertPayslip, type DbInsertSalaryAdvance, type DbInsertEmployeeAllowance,
    type EmployeeAchievement, type InsertEmployeeAchievement, type EmployeePoints, type InsertEmployeePoints,
    type PointsHistory, type InsertPointsHistory, type DbInsertEmployeeAchievement, type DbInsertPointsHistory,
    type SafetyIncident, type InsertSafetyIncident, type DbInsertSafetyIncident,
    type PerformancePeriod, type InsertPerformancePeriod, type PerformanceGoal, type InsertPerformanceGoal,
    kpiEvidence, insertKpiEvidenceSchema, type InsertKpiEvidence, type KpiEvidence,
    auditLogs, users, jobTitles, type JobTitle, type InsertJobTitle, type DbInsertJobTitle
} from "@shared/schema";
import { db } from "../db";
import { eq, and, desc, asc, or, like, sql, inArray, isNull, getTableColumns, ne } from "drizzle-orm";
import { UserStorage } from "./user";

export class HRStorage extends UserStorage {
    // --- Employees ---
    async getEmployees(tenantId: string): Promise<any[]> {
        return await db.select({
            ...getTableColumns(employees),
            role: users.role
        })
            .from(employees)
            .leftJoin(users, eq(employees.userId, users.id))
            .where(eq(employees.tenantId, tenantId));
    }

    async getEmployee(id: string): Promise<Employee | undefined> {
        const [employee] = await db.select().from(employees).where(eq(employees.id, id));
        return employee;
    }

    async getEmployeeByUserId(userId: string): Promise<Employee | undefined> {
        const [employee] = await db.select().from(employees).where(eq(employees.userId, userId));
        return employee;
    }

    async createEmployee(insertEmployee: DbInsertEmployee): Promise<Employee> {
        const [employee] = await db.insert(employees).values(insertEmployee).returning();
        return employee;
    }

    async updateEmployee(id: string, update: Partial<InsertEmployee>): Promise<Employee> {
        const [employee] = await db.update(employees).set(update).where(eq(employees.id, id)).returning();
        return employee;
    }

    async deleteEmployee(id: string): Promise<void> {
        await db.delete(employees).where(eq(employees.id, id));
    }

    // --- Departments ---
    async getDepartments(tenantId: string): Promise<Department[]> {
        return await db.select().from(departments).where(eq(departments.tenantId, tenantId));
    }

    async getDepartment(tenantId: string, departmentId: string): Promise<Department | undefined> {
        const [dept] = await db
            .select()
            .from(departments)
            .where(and(eq(departments.id, departmentId), eq(departments.tenantId, tenantId)))
            .limit(1);
        return dept;
    }

    async getDepartmentsWithStats(tenantId: string): Promise<any[]> {
        // Get all departments
        const deptList = await db.select().from(departments).where(eq(departments.tenantId, tenantId));

        // Get all active employees with their departments
        const allEmployees = await db
            .select({
                id: employees.id,
                firstName: employees.firstName,
                lastName: employees.lastName,
                departmentId: employees.departmentId,
                employeeNo: employees.employeeNo,
            })
            .from(employees)
            .where(and(eq(employees.tenantId, tenantId), eq(employees.status, "active")))
            .orderBy(asc(employees.firstName)); // Order by name for consistent top employees

        // Build employee count map and top employees map
        const employeeCountMap = new Map<string, number>();
        const topEmployeesMap = new Map<string, any[]>();
        const employeesByDept = new Map<string, any[]>();

        // Group employees by department
        for (const emp of allEmployees) {
            if (emp.departmentId) {
                const count = employeeCountMap.get(emp.departmentId) || 0;
                employeeCountMap.set(emp.departmentId, count + 1);

                const deptEmps = employeesByDept.get(emp.departmentId) || [];
                deptEmps.push(emp);
                employeesByDept.set(emp.departmentId, deptEmps);
            }
        }

        // Get top 4 employees for each department
        // @ts-ignore - pre-existing type issue with Map entries()
        for (const [deptId, empList] of employeesByDept.entries()) {
            topEmployeesMap.set(deptId, empList.slice(0, 4));
        }

        // Get manager info for departments that have managers
        const managerIds = deptList.filter(d => d.managerId).map(d => d.managerId!);
        const managers = managerIds.length > 0
            ? await db
                .select({
                    id: employees.id,
                    firstName: employees.firstName,
                    lastName: employees.lastName,
                    employeeNo: employees.employeeNo,
                })
                .from(employees)
                .where(
                    and(
                        eq(employees.tenantId, tenantId),
                        inArray(employees.id, managerIds)
                    )
                )
            : [];

        const managerMap = new Map(managers.map(m => [m.id, m]));

        // Get today's attendance for all employees to calculate KPI
        const today = new Date().toISOString().split("T")[0];
        const allEmployeeIds = allEmployees.map(e => e.id);
        const todayAttendance = allEmployeeIds.length > 0
            ? await db
                .select()
                .from(attendanceDays)
                .where(
                    and(
                        eq(attendanceDays.tenantId, tenantId),
                        eq(attendanceDays.workDate, today),
                        inArray(attendanceDays.employeeId, allEmployeeIds)
                    )
                )
            : [];

        const attendanceByEmployee = new Map(todayAttendance.map(a => [a.employeeId, a]));

        // Calculate attendance KPI per department
        const attendanceKPIMap = new Map<string, number>();
        // @ts-ignore - pre-existing type issue with Map entries()
        for (const [deptId, empList] of employeesByDept.entries()) {
            // @ts-ignore - pre-existing type issue
            const presentCount = empList.filter((emp: any) => {
                const att = attendanceByEmployee.get(emp.id);

                return att && att.status === "present";
            }).length;
            const kpi = empList.length > 0 ? (presentCount / empList.length) * 100 : 0;
            attendanceKPIMap.set(deptId, Math.round(kpi * 100) / 100);
        }

        // Combine data
        return deptList.map(dept => ({
            ...dept,
            employeeCount: employeeCountMap.get(dept.id) || 0,
            manager: dept.managerId ? managerMap.get(dept.managerId) || null : null,
            topEmployees: topEmployeesMap.get(dept.id) || [],
            attendanceKPI: attendanceKPIMap.get(dept.id) || 0,
        }));
    }

    async createDepartment(dept: any): Promise<Department> {
        const [d] = await db.insert(departments).values(dept).returning();
        return d;
    }

    async updateDepartment(departmentId: string, updates: any): Promise<Department> {
        const [updated] = await db
            .update(departments)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(departments.id, departmentId))
            .returning();
        if (!updated) throw new Error("Department not found");
        return updated;
    }

    async deleteDepartment(departmentId: string): Promise<void> {
        await db.delete(departments).where(eq(departments.id, departmentId));
    }

    async getJobTitles(tenantId: string, options?: { isActive?: boolean }): Promise<JobTitle[]> {
        return await db.select().from(jobTitles).where(
            and(
                eq(jobTitles.tenantId, tenantId),
                options?.isActive !== undefined ? eq(jobTitles.isActive, options.isActive) : undefined
            )
        );
    }

    async getJobTitle(tenantId: string, id: string): Promise<JobTitle | undefined> {
        const [title] = await db.select().from(jobTitles).where(and(eq(jobTitles.id, id), eq(jobTitles.tenantId, tenantId)));
        return title;
    }

    async createJobTitle(jobTitle: DbInsertJobTitle): Promise<JobTitle> {
        const [title] = await db.insert(jobTitles).values(jobTitle).returning();
        return title;
    }

    async updateJobTitle(id: string, update: Partial<DbInsertJobTitle>): Promise<JobTitle> {
        const [title] = await db.update(jobTitles).set({ ...update, updatedAt: new Date() }).where(eq(jobTitles.id, id)).returning();
        return title;
    }

    async deleteJobTitle(id: string): Promise<void> {
        await db.delete(jobTitles).where(eq(jobTitles.id, id));
    }

    async assignManagerToDepartment(departmentId: string, employeeId: string | null): Promise<Department> {
        const [updated] = await db
            .update(departments)
            .set({ managerId: employeeId, updatedAt: new Date() })
            .where(eq(departments.id, departmentId))
            .returning();
        if (!updated) throw new Error("Department not found");
        return updated;
    }

    async batchAssignEmployeesToDepartment(departmentId: string, employeeIds: string[]): Promise<void> {
        if (employeeIds.length === 0) return;

        // Get department's tenantId first
        const [dept] = await db.select({ tenantId: departments.tenantId }).from(departments).where(eq(departments.id, departmentId)).limit(1);
        if (!dept) throw new Error("Department not found");

        await db
            .update(employees)
            .set({ departmentId, updatedAt: new Date() })
            .where(
                and(
                    inArray(employees.id, employeeIds),
                    eq(employees.tenantId, dept.tenantId)
                )
            );
    }

    async getDepartmentDetails(tenantId: string, departmentId: string): Promise<any> {
        // Get department
        const [dept] = await db.select().from(departments).where(and(eq(departments.id, departmentId), eq(departments.tenantId, tenantId)));
        if (!dept) throw new Error("Department not found");

        // Get all employees in department
        const deptEmployees = await db
            .select()
            .from(employees)
            .where(and(eq(employees.tenantId, tenantId), eq(employees.departmentId, departmentId), eq(employees.status, "active")));

        // Get manager if exists
        let manager = null;
        if (dept.managerId) {
            const [mgr] = await db.select().from(employees).where(eq(employees.id, dept.managerId));
            manager = mgr ? {
                id: mgr.id,
                firstName: mgr.firstName,
                lastName: mgr.lastName,
                employeeNo: mgr.employeeNo,
            } : null;
        }

        // Get today's attendance KPI
        const today = new Date().toISOString().split("T")[0];
        const todayAttendance = await db
            .select()
            .from(attendanceDays)
            .where(
                and(
                    eq(attendanceDays.tenantId, tenantId),
                    eq(attendanceDays.workDate, today),
                    inArray(attendanceDays.employeeId, deptEmployees.map(e => e.id))
                )
            );

        const presentCount = todayAttendance.filter(a => a.status === "present").length;
        const attendanceKPI = deptEmployees.length > 0 ? (presentCount / deptEmployees.length) * 100 : 0;

        // Top 5 employees for avatar stack
        const topEmployees = deptEmployees.slice(0, 5).map(emp => ({
            id: emp.id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            employeeNo: emp.employeeNo,
        }));

        return {
            ...dept,
            employeeCount: deptEmployees.length,
            manager,
            topEmployees,
            attendanceKPI: Math.round(attendanceKPI * 100) / 100, // Round to 2 decimals
            employees: deptEmployees,
            todayAttendance,
        };
    }

    // --- Attendance ---
    async getAttendance(tenantId: string): Promise<AttendanceDay[]> {
        return await db.select().from(attendanceDays).where(eq(attendanceDays.tenantId, tenantId));
    }

    async getAttendanceRecord(id: string): Promise<AttendanceDay | undefined> {
        const [a] = await db.select().from(attendanceDays).where(eq(attendanceDays.id, id));
        return a;
    }

    async getAttendanceByEmployee(tenantId: string, employeeId: string): Promise<AttendanceDay[]> {
        return await db
            .select()
            .from(attendanceDays)
            .where(
                and(
                    eq(attendanceDays.tenantId, tenantId),
                    eq(attendanceDays.employeeId, employeeId)
                )
            )
            .orderBy(desc(attendanceDays.workDate));
    }

    async getAttendanceByEmployeeAndDateRange(tenantId: string, employeeId: string, startDate: string, endDate: string): Promise<AttendanceDay[]> {
        return await db
            .select()
            .from(attendanceDays)
            .where(
                and(
                    eq(attendanceDays.tenantId, tenantId),
                    eq(attendanceDays.employeeId, employeeId),
                    sql`${attendanceDays.workDate} >= ${startDate}`,
                    sql`${attendanceDays.workDate} <= ${endDate}`
                )
            )
            .orderBy(attendanceDays.workDate);
    }

    async createAttendance(att: DbInsertAttendanceDay): Promise<AttendanceDay> {
        const [a] = await db.insert(attendanceDays).values(att).returning();
        return a;
    }

    async updateAttendance(id: string, update: Partial<DbInsertAttendanceDay>): Promise<AttendanceDay> {
        const [a] = await db.update(attendanceDays).set(update).where(eq(attendanceDays.id, id)).returning();
        return a;
    }

    async deleteAttendance(id: string): Promise<void> {
        await db.delete(attendanceDays).where(eq(attendanceDays.id, id));
    }

    // --- Payroll ---
    async getPayrollRuns(tenantId: string): Promise<PayrollRun[]> {
        return await db.select().from(payrollRuns).where(eq(payrollRuns.tenantId, tenantId));
    }

    async getPayrollRunByPeriod(tenantId: string, start: string, end: string): Promise<PayrollRun | undefined> {
        const [run] = await db.select().from(payrollRuns).where(
            and(
                eq(payrollRuns.tenantId, tenantId),
                eq(payrollRuns.periodStart, start),
                eq(payrollRuns.periodEnd, end)
            )
        );
        return run;
    }

    async createPayrollRun(run: DbInsertPayrollRun): Promise<PayrollRun> {
        const [p] = await db.insert(payrollRuns).values(run).returning();
        return p;
    }

    async getPayslips(runId: string): Promise<Payslip[]> {
        return await db.select().from(payslips).where(eq(payslips.payrollRunId, runId));
    }

    async getAllPayslips(tenantId: string): Promise<any[]> {
        return await db.select({
            id: payslips.id,
            tenantId: payslips.tenantId,
            payrollRunId: payslips.payrollRunId,
            employeeId: payslips.employeeId,
            grossPay: payslips.grossPay,
            totalDeductions: payslips.totalDeductions,
            netPay: payslips.netPay,
            status: payslips.status,
            createdAt: payslips.createdAt,
            periodStart: payrollRuns.periodStart,
            periodEnd: payrollRuns.periodEnd,
            payDate: payrollRuns.payDate,
            employeeFirstName: employees.firstName,
            employeeLastName: employees.lastName,
            employeePosition: employees.position,
            employeeNo: employees.employeeNo,
            employeeDepartmentId: employees.departmentId
        })
            .from(payslips)
            .leftJoin(payrollRuns, eq(payslips.payrollRunId, payrollRuns.id))
            .leftJoin(employees, eq(payslips.employeeId, employees.id))
            .where(eq(payslips.tenantId, tenantId))
            .orderBy(desc(payrollRuns.periodStart));
    }

    async getPayslipsByEmployee(tenantId: string, employeeId: string): Promise<any[]> {
        return await db.select({
            id: payslips.id,
            tenantId: payslips.tenantId,
            payrollRunId: payslips.payrollRunId,
            employeeId: payslips.employeeId,
            grossPay: payslips.grossPay,
            totalDeductions: payslips.totalDeductions,
            netPay: payslips.netPay,
            status: payslips.status,
            createdAt: payslips.createdAt,
            periodStart: payrollRuns.periodStart,
            periodEnd: payrollRuns.periodEnd,
            payDate: payrollRuns.payDate,
            employeeFirstName: employees.firstName,
            employeeLastName: employees.lastName,
            employeePosition: employees.position,
            employeeNo: employees.employeeNo,
            employeeDepartmentId: employees.departmentId
        })
            .from(payslips)
            .leftJoin(payrollRuns, eq(payslips.payrollRunId, payrollRuns.id))
            .leftJoin(employees, eq(payslips.employeeId, employees.id))
            .where(
                and(
                    eq(payslips.tenantId, tenantId),
                    eq(payslips.employeeId, employeeId)
                )
            )
            .orderBy(desc(payrollRuns.periodStart));
    }

    async createPayslip(slip: DbInsertPayslip): Promise<Payslip> {
        const [p] = await db.insert(payslips).values(slip).returning();
        return p;
    }

    async getPayslipByEmployeeAndRun(tenantId: string, payrollRunId: string, employeeId: string): Promise<Payslip | undefined> {
        const [payslip] = await db
            .select()
            .from(payslips)
            .where(
                and(
                    eq(payslips.tenantId, tenantId),
                    eq(payslips.payrollRunId, payrollRunId),
                    eq(payslips.employeeId, employeeId)
                )
            )
            .limit(1);
        return payslip;
    }

    async updatePayslip(id: string, update: Partial<DbInsertPayslip>): Promise<Payslip> {
        const [updated] = await db
            .update(payslips)
            .set({ ...update, updatedAt: new Date() })
            .where(eq(payslips.id, id))
            .returning();
        return updated;
    }

    async deletePayslip(id: string): Promise<void> {
        await db.delete(payslips).where(eq(payslips.id, id));
    }

    // --- Salary Advances ---
    async getSalaryAdvances(tenantId: string, employeeId?: string, status?: string): Promise<any[]> {
        const conditions = [eq(salaryAdvances.tenantId, tenantId)];
        if (employeeId) {
            conditions.push(eq(salaryAdvances.employeeId, employeeId));
        }
        if (status) {
            conditions.push(eq(salaryAdvances.status, status));
        }

        return await db.select({
            id: salaryAdvances.id,
            tenantId: salaryAdvances.tenantId,
            employeeId: salaryAdvances.employeeId,
            requestDate: salaryAdvances.requestDate,
            amount: salaryAdvances.amount,
            reason: salaryAdvances.reason,
            status: salaryAdvances.status,
            requestedBy: salaryAdvances.requestedBy,
            approvedBy: salaryAdvances.approvedBy,
            approvedAt: salaryAdvances.approvedAt,
            rejectionReason: salaryAdvances.rejectionReason,
            deductionType: salaryAdvances.deductionType,
            monthlyDeductionAmount: salaryAdvances.monthlyDeductionAmount,
            totalDeductionMonths: salaryAdvances.totalDeductionMonths,
            deductedAmount: salaryAdvances.deductedAmount,
            isLoan: salaryAdvances.isLoan,
            loanInterestRate: salaryAdvances.loanInterestRate,
            paidAt: salaryAdvances.paidAt,
            fullyDeductedAt: salaryAdvances.fullyDeductedAt,
            note: salaryAdvances.note,
            createdAt: salaryAdvances.createdAt,
            updatedAt: salaryAdvances.updatedAt,
            employeeName: sql<string>`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`,
            employeeNo: employees.employeeNo,
        })
            .from(salaryAdvances)
            .leftJoin(employees, eq(salaryAdvances.employeeId, employees.id))
            .where(and(...conditions))
            .orderBy(desc(salaryAdvances.createdAt));
    }

    async getSalaryAdvance(id: string): Promise<any | undefined> {
        const [advance] = await db.select({
            id: salaryAdvances.id,
            tenantId: salaryAdvances.tenantId,
            employeeId: salaryAdvances.employeeId,
            requestDate: salaryAdvances.requestDate,
            amount: salaryAdvances.amount,
            reason: salaryAdvances.reason,
            status: salaryAdvances.status,
            requestedBy: salaryAdvances.requestedBy,
            approvedBy: salaryAdvances.approvedBy,
            approvedAt: salaryAdvances.approvedAt,
            rejectionReason: salaryAdvances.rejectionReason,
            deductionType: salaryAdvances.deductionType,
            monthlyDeductionAmount: salaryAdvances.monthlyDeductionAmount,
            totalDeductionMonths: salaryAdvances.totalDeductionMonths,
            deductedAmount: salaryAdvances.deductedAmount,
            isLoan: salaryAdvances.isLoan,
            loanInterestRate: salaryAdvances.loanInterestRate,
            paidAt: salaryAdvances.paidAt,
            fullyDeductedAt: salaryAdvances.fullyDeductedAt,
            note: salaryAdvances.note,
            createdAt: salaryAdvances.createdAt,
            updatedAt: salaryAdvances.updatedAt,
        })
            .from(salaryAdvances)
            .where(eq(salaryAdvances.id, id))
            .limit(1);
        return advance;
    }

    async createSalaryAdvance(advance: DbInsertSalaryAdvance): Promise<any> {
        const [newAdvance] = await db.insert(salaryAdvances).values(advance).returning();
        return newAdvance;
    }

    async updateSalaryAdvance(id: string, update: Partial<DbInsertSalaryAdvance>): Promise<any> {
        const [updated] = await db
            .update(salaryAdvances)
            .set({ ...update, updatedAt: new Date() })
            .where(eq(salaryAdvances.id, id))
            .returning();
        return updated;
    }

    async deleteSalaryAdvance(id: string): Promise<void> {
        await db.delete(salaryAdvances).where(eq(salaryAdvances.id, id));
    }

    // --- Employee Allowances ---
    async getEmployeeAllowances(tenantId: string, employeeId?: string): Promise<any[]> {
        const conditions = [eq(employeeAllowances.tenantId, tenantId)];
        if (employeeId) {
            conditions.push(eq(employeeAllowances.employeeId, employeeId));
        }

        return await db.select({
            id: employeeAllowances.id,
            tenantId: employeeAllowances.tenantId,
            employeeId: employeeAllowances.employeeId,
            code: employeeAllowances.code,
            name: employeeAllowances.name,
            amount: employeeAllowances.amount,
            isTaxable: employeeAllowances.isTaxable,
            isSHI: employeeAllowances.isSHI,
            isPIT: employeeAllowances.isPIT,
            isRecurring: employeeAllowances.isRecurring,
            effectiveFrom: employeeAllowances.effectiveFrom,
            effectiveTo: employeeAllowances.effectiveTo,
            note: employeeAllowances.note,
            createdAt: employeeAllowances.createdAt,
            updatedAt: employeeAllowances.updatedAt,
            employeeName: sql<string>`CONCAT(${employees.firstName}, ' ', ${employees.lastName})`,
            employeeNo: employees.employeeNo,
        })
            .from(employeeAllowances)
            .leftJoin(employees, eq(employeeAllowances.employeeId, employees.id))
            .where(and(...conditions))
            .orderBy(employeeAllowances.code);
    }

    async getEmployeeAllowance(id: string): Promise<any | undefined> {
        const [allowance] = await db.select().from(employeeAllowances).where(eq(employeeAllowances.id, id)).limit(1);
        return allowance;
    }

    async createEmployeeAllowance(allowance: DbInsertEmployeeAllowance): Promise<any> {
        const [newAllowance] = await db.insert(employeeAllowances).values(allowance).returning();
        return newAllowance;
    }

    async updateEmployeeAllowance(id: string, update: Partial<DbInsertEmployeeAllowance>): Promise<any> {
        const [updated] = await db
            .update(employeeAllowances)
            .set({ ...update, updatedAt: new Date() })
            .where(eq(employeeAllowances.id, id))
            .returning();
        return updated;
    }

    async deleteEmployeeAllowance(id: string): Promise<void> {
        await db.delete(employeeAllowances).where(eq(employeeAllowances.id, id));
    }

    // --- HR Gamification ---
    async getEmployeeAchievements(tenantId: string, employeeId?: string): Promise<EmployeeAchievement[]> {
        const conditions = [eq(employeeAchievements.tenantId, tenantId)];
        if (employeeId) {
            conditions.push(eq(employeeAchievements.employeeId, employeeId));
        }
        return await db.select()
            .from(employeeAchievements)
            .where(and(...conditions))
            .orderBy(desc(employeeAchievements.achievedAt));
    }

    async createAchievement(achievement: DbInsertEmployeeAchievement): Promise<EmployeeAchievement> {
        const [created] = await db.insert(employeeAchievements).values(achievement).returning();
        return created;
    }

    async getEmployeePoints(tenantId: string, employeeId: string): Promise<EmployeePoints | undefined> {
        const [points] = await db.select()
            .from(employeePoints)
            .where(and(
                eq(employeePoints.tenantId, tenantId),
                eq(employeePoints.employeeId, employeeId)
            ));
        return points;
    }

    async upsertEmployeePoints(tenantId: string, employeeId: string, pointsChange: number): Promise<EmployeePoints> {
        // Try to get existing points
        const existing = await this.getEmployeePoints(tenantId, employeeId);

        if (existing) {
            const newPoints = Math.max(0, Number(existing.points) + pointsChange); // Ensure non-negative
            const [updated] = await db.update(employeePoints)
                .set({
                    // @ts-ignore - pre-existing type issue
                    points: newPoints.toString(),
                    updatedAt: new Date()
                })
                .where(eq(employeePoints.id, existing.id))
                .returning();
            return updated;
        } else {
            const newPoints = Math.max(0, pointsChange); // Ensure non-negative
            const [created] = await db.insert(employeePoints).values({
                tenantId,
                employeeId,
                points: newPoints,
                updatedAt: new Date()
            }).returning();
            return created;
        }
    }

    async addPointsHistory(history: DbInsertPointsHistory): Promise<PointsHistory> {
        const [created] = await db.insert(pointsHistory).values(history).returning();
        return created;
    }

    async getPointsHistory(tenantId: string, employeeId?: string, limit: number = 50): Promise<PointsHistory[]> {
        const conditions = [eq(pointsHistory.tenantId, tenantId)];
        if (employeeId) {
            conditions.push(eq(pointsHistory.employeeId, employeeId));
        }
        return await db.select()
            .from(pointsHistory)
            .where(and(...conditions))
            .orderBy(desc(pointsHistory.createdAt))
            .limit(limit);
    }

    async awardPoints(tenantId: string, employeeId: string, points: number, reason: string, sourceType?: string, sourceId?: string): Promise<void> {
        // Update points balance
        await this.upsertEmployeePoints(tenantId, employeeId, points);

        // Add to history
        await this.addPointsHistory({
            tenantId,
            employeeId,
            points,
            reason,
            sourceType: sourceType || null,
            sourceId: sourceId || null,
            createdAt: new Date()
        });
    }

    // ==========================================
    // LEAVE REQUESTS (Чөлөөний хүсэлт)
    // ==========================================

    async getLeaveRequests(tenantId: string, status?: string, employeeId?: string): Promise<any[]> {
        const conditions = [eq(leaveRequests.tenantId, tenantId)];

        if (status) {
            conditions.push(eq(leaveRequests.status, status));
        }
        if (employeeId) {
            conditions.push(eq(leaveRequests.employeeId, employeeId));
        }

        return await db.query.leaveRequests.findMany({
            where: and(...conditions),
            with: {
                employee: {
                    with: {
                        department: true
                    }
                }
            },
            orderBy: desc(leaveRequests.createdAt)
        });
    }

    async createLeaveRequest(data: {
        tenantId: string;
        employeeId: string;
        type: string;
        startDate: string;
        endDate: string;
        reason?: string;
    }): Promise<any> {
        const [created] = await db.insert(leaveRequests).values({
            tenantId: data.tenantId,
            employeeId: data.employeeId,
            type: data.type,
            startDate: data.startDate,
            endDate: data.endDate,
            reason: data.reason,
            status: "pending",
        }).returning();
        return created;
    }

    async updateLeaveRequest(id: string, update: {
        status?: string;
        approvedBy?: string;
        approvedAt?: Date;
        rejectionReason?: string;
    }): Promise<any> {
        const [updated] = await db
            .update(leaveRequests)
            .set({
                ...update,
                updatedAt: new Date(),
            })
            .where(eq(leaveRequests.id, id))
            .returning();
        return updated;
    }

    async getPendingLeaveRequestsCount(tenantId: string): Promise<number> {
        const [result] = await db
            .select({ count: sql<number>`count(*)` })
            .from(leaveRequests)
            .where(and(eq(leaveRequests.tenantId, tenantId), eq(leaveRequests.status, "pending")));
        return Number(result?.count || 0);
    }

    // ==========================================
    // Performance & KPI (Гүйцэтгэлийн Удирдлага)
    // ==========================================

    async getPerformancePeriods(tenantId: string): Promise<PerformancePeriod[]> {
        return await db
            .select()
            .from(performancePeriods)
            .where(eq(performancePeriods.tenantId, tenantId))
            .orderBy(desc(performancePeriods.startDate));
    }

    async getPerformancePeriod(id: string): Promise<PerformancePeriod | undefined> {
        const [period] = await db
            .select()
            .from(performancePeriods)
            .where(eq(performancePeriods.id, id));
        return period;
    }

    async createPerformancePeriod(period: InsertPerformancePeriod & { tenantId: string }): Promise<PerformancePeriod> {
        const [created] = await db
            .insert(performancePeriods)
            .values(period)
            .returning();
        return created;
    }

    async updatePerformancePeriod(id: string, updates: Partial<InsertPerformancePeriod>): Promise<PerformancePeriod> {
        const [updated] = await db
            .update(performancePeriods)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(performancePeriods.id, id))
            .returning();
        if (!updated) throw new Error("Performance period not found");
        return updated;
    }

    async deletePerformancePeriod(id: string): Promise<void> {
        await db.delete(performanceGoals).where(eq(performanceGoals.periodId, id));
        await db.delete(performancePeriods).where(eq(performancePeriods.id, id));
    }

    async getPerformanceGoals(tenantId: string, periodId?: string, employeeId?: string): Promise<any[]> {
        const conditions = [eq(performanceGoals.tenantId, tenantId)];
        if (periodId) conditions.push(eq(performanceGoals.periodId, periodId));
        if (employeeId) conditions.push(eq(performanceGoals.employeeId, employeeId));

        return await db.query.performanceGoals.findMany({
            where: and(...conditions),
            with: {
                evidence: true,
                manager: true,
                evaluator: true,
            },
            orderBy: desc(performanceGoals.createdAt),
        });
    }

    async getTeamGoals(tenantId: string, managerId: string, periodId?: string): Promise<any[]> {
        const conditions = [
            eq(performanceGoals.tenantId, tenantId),
            eq(performanceGoals.managerId, managerId),
            or(
                eq(performanceGoals.status, "submitted"),
                eq(performanceGoals.status, "approved"),
                eq(performanceGoals.status, "evaluated"),
                eq(performanceGoals.status, "locked")
            )
        ];
        if (periodId) conditions.push(eq(performanceGoals.periodId, periodId));

        return await db.query.performanceGoals.findMany({
            where: and(...conditions),
            with: {
                employee: true,
                evidence: true,
                evaluator: true,
            },
            orderBy: desc(performanceGoals.createdAt),
        });
    }

    async getPerformanceGoal(id: string): Promise<PerformanceGoal | undefined> {
        const [goal] = await db
            .select()
            .from(performanceGoals)
            .where(eq(performanceGoals.id, id));
        return goal;
    }

    async createPerformanceGoal(goal: InsertPerformanceGoal & { tenantId: string }): Promise<PerformanceGoal> {
        const [created] = await db
            .insert(performanceGoals)
            .values(goal)
            .returning();
        return created;
    }

    async updatePerformanceGoal(id: string, updates: Partial<InsertPerformanceGoal>): Promise<PerformanceGoal> {
        const [updated] = await db
            .update(performanceGoals)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(performanceGoals.id, id))
            .returning();
        if (!updated) throw new Error("Performance goal not found");
        return updated;
    }

    async deletePerformanceGoal(id: string): Promise<void> {
        await db.delete(performanceGoals).where(eq(performanceGoals.id, id));
    }

    async createKpiEvidence(evidence: InsertKpiEvidence): Promise<any> {
        const [created] = await db
            .insert(kpiEvidence)
            .values(evidence)
            .returning();
        return created;
    }

    async getKpiEvidence(goalId: string): Promise<any[]> {
        return await db
            .select()
            .from(kpiEvidence)
            .where(eq(kpiEvidence.goalId, goalId));
    }

    async deleteKpiEvidence(id: string): Promise<void> {
        await db.delete(kpiEvidence).where(eq(kpiEvidence.id, id));
    }

    async getPerformanceSummary(tenantId: string, periodId: string, employeeId?: string): Promise<{
        totalWeight: number;
        totalScore: number;
        goalsCount: number;
        completedCount: number;
    }> {
        const goals = await this.getPerformanceGoals(tenantId, periodId, employeeId);

        const totalWeight = goals.reduce((sum, g) => sum + (g.weight || 0), 0);
        // Score = Σ(weight × progress/100 × qualityRating/5)
        // If qualityRating is missing (e.g. not evaluated yet), assume 5/5 (1.0 factor) for projection
        const totalScore = goals.reduce((sum, g) => {
            const weight = g.weight || 0;
            const progress = g.progress || 0;
            const rating = g.qualityRating || 5; // Default to max score logic for MVP
            const ratingFactor = rating / 5;

            return sum + (weight * (progress / 100) * ratingFactor);
        }, 0);
        const goalsCount = goals.length;
        const completedCount = goals.filter(g => g.status === "completed").length;

        return {
            totalWeight,
            totalScore: Math.round(totalScore * 100) / 100,
            goalsCount,
            completedCount,
        };
    }

    // ==========================================
    // Safety & HSE (Аюулгүй ажиллагаа)
    // ==========================================

    async getSafetyIncidents(tenantId: string, reporterUserId?: string): Promise<SafetyIncident[]> {
        let query = db.select().from(safetyIncidents).where(eq(safetyIncidents.tenantId, tenantId));

        if (reporterUserId) {
            query = db.select().from(safetyIncidents)
                .where(and(
                    eq(safetyIncidents.tenantId, tenantId),
                    eq(safetyIncidents.reportedBy, reporterUserId)
                ));
        }

        return await query.orderBy(desc(safetyIncidents.date));
    }

    async getSafetyIncident(id: string): Promise<SafetyIncident | undefined> {
        const [incident] = await db
            .select()
            .from(safetyIncidents)
            .where(eq(safetyIncidents.id, id));
        return incident;
    }

    async createSafetyIncident(incident: DbInsertSafetyIncident): Promise<SafetyIncident> {
        const [created] = await db
            .insert(safetyIncidents)
            .values(incident)
            .returning();
        return created;
    }

    async updateSafetyIncident(id: string, updates: Partial<InsertSafetyIncident>): Promise<SafetyIncident> {
        const [updated] = await db
            .update(safetyIncidents)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(safetyIncidents.id, id))
            .returning();
        if (!updated) throw new Error("Safety incident not found");
        return updated;
    }

    async deleteSafetyIncident(id: string): Promise<void> {
        await db.delete(safetyIncidents).where(eq(safetyIncidents.id, id));
    }
    async getPerformanceInbox(tenantId: string, observerUserId: string, role: string) {
        let actorIds: string[] = [];

        if (role === 'manager') {
            const observerEmp = await this.getEmployeeByUserId(observerUserId);
            if (!observerEmp) return [];

            const managedDepts = await db.select().from(departments)
                .where(and(eq(departments.tenantId, tenantId), eq(departments.managerId, observerEmp.id)));

            if (managedDepts.length === 0) return [];

            const deptIds = managedDepts.map(d => d.id);
            const teamEmps = await db.select().from(employees)
                .where(and(eq(employees.tenantId, tenantId), inArray(employees.departmentId, deptIds)));

            actorIds = teamEmps.map(e => e.userId).filter(id => id !== null) as string[];
            actorIds = actorIds.filter(id => id !== observerUserId);
            if (actorIds.length === 0) return [];
        }

        const condition = role === 'manager'
            ? inArray(auditLogs.actorId, actorIds)
            : undefined;

        const EXCLUDE_SELF = observerUserId
            ? sql`${auditLogs.actorId} != ${observerUserId}`
            : undefined;

        const raw = await db.select({
            log: auditLogs,
            goal: performanceGoals,
            actor: users,
            actorEmp: employees
        })
            .from(auditLogs)
            .innerJoin(performanceGoals, eq(auditLogs.entityId, performanceGoals.id))
            .leftJoin(users, eq(auditLogs.actorId, users.id))
            .leftJoin(employees, eq(users.id, employees.userId))
            .where(and(
                eq(auditLogs.tenantId, tenantId),
                // Only Goal/Review types
                eq(auditLogs.entity, "performance_goal"),
                // eq(auditLogs.entity, "performance_review"), // Optional expansion
                inArray(auditLogs.action, ["create", "update", "submit", "approve", "evaluate", "evidence"]),
                condition,
                EXCLUDE_SELF
            ))
            .orderBy(desc(auditLogs.createdAt))
            .limit(100);

        const grouped = new Map();
        raw.forEach(row => {
            if (!grouped.has(row.log.entityId)) {
                grouped.set(row.log.entityId, row);
            }
        });

        return Array.from(grouped.values()).map(r => ({
            logId: r.log.id,
            createdAt: r.log.eventTime,
            actorName: r.actorEmp ? `${r.actorEmp.firstName} ${r.actorEmp.lastName}` : (r.actor?.fullName || "Unknown"),
            goalId: r.goal.id,
            goalTitle: r.goal.title,
            action: r.log.action,
            message: r.log.message,
            dueDate: r.goal.dueDate,
            goalStatus: r.goal.status
        }));
    }
}
