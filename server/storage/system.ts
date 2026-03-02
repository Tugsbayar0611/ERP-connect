import {
    employees, departments, products, contacts, invoices,
    attendanceDays, pointsHistory, employeeAchievements, users,
    companySettings, type CompanySettings, type InsertCompanySettings,
    requests, type Request, type InsertRequest, type DbInsertRequest,
    requestEvents, type RequestEvent, type InsertRequestEvent
} from "@shared/schema";
import { subDays, startOfMonth, startOfDay, endOfDay, format } from "date-fns";
import { db } from "../db";
import { eq, and, sql, desc } from "drizzle-orm";
import { RequestsStorage } from "./requests-storage";

import { normalizeRole, isEmployee } from "../../shared/roles";

export class SystemStorage extends RequestsStorage {
    // --- Stats ---
    async getStats(tenantId: string, userId?: string, role?: string): Promise<any> {
        const userRole = normalizeRole(role);
        const isEmployeeRole = isEmployee(userRole);
        let empId: string | undefined;

        if (userId) {
            const emp = await this.getEmployeeByUserId(userId);
            empId = emp?.id.toString();
        }

        const [empCount] = await db.select({ count: sql<number>`count(*)` }).from(employees).where(eq(employees.tenantId, tenantId));
        const [deptCount] = await db.select({ count: sql<number>`count(*)` }).from(departments).where(eq(departments.tenantId, tenantId));
        const [activeEmpCount] = await db.select({ count: sql<number>`count(*)` }).from(employees).where(and(eq(employees.tenantId, tenantId), eq(employees.status, "active")));

        // Calculate monthly payroll from payslips
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        const payslips = await this.getAllPayslips(tenantId);
        console.log("DEBUG: Total Payslips found:", payslips.length);
        if (payslips.length > 0) {
            console.log("DEBUG: Sample Payslip:", JSON.stringify(payslips[0]));
        }
        const monthlyPayroll = payslips
            .filter((p: any) => {
                if (!p.periodStart) return false;
                const periodDate = new Date(p.periodStart);
                return periodDate.getMonth() + 1 === currentMonth && periodDate.getFullYear() === currentYear;
            })
            .reduce((sum: number, p: any) => sum + Number(p.netPay || 0), 0);

        // Get attendance stats for last 30 days (for better chart display)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        thirtyDaysAgo.setHours(0, 0, 0, 0);
        const attendanceRecords = await this.getAttendance(tenantId);
        const recentAttendance = attendanceRecords.filter((a: any) => {
            const recordDate = new Date(a.workDate || a.date);
            recordDate.setHours(0, 0, 0, 0);
            return recordDate >= thirtyDaysAgo;
        });

        // Calculate attendance stats by day of week
        const attendanceByDay: Record<string, { present: number; late: number; total: number }> = {};
        recentAttendance.forEach((a: any) => {
            const date = new Date(a.workDate || a.date);
            const dayName = ['Ня', 'Да', 'Мя', 'Лх', 'Пү', 'Ба', 'Бя'][date.getDay()];
            if (!attendanceByDay[dayName]) {
                attendanceByDay[dayName] = { present: 0, late: 0, total: 0 };
            }
            attendanceByDay[dayName].total++;
            // Check status - could be 'present', 'late', 'absent', etc.
            const status = a.status?.toLowerCase() || '';
            if (status === 'present' || status === 'ирсэн') {
                attendanceByDay[dayName].present++;
            } else if (status === 'late' || status === 'хоцорсон') {
                attendanceByDay[dayName].late++;
            }
        });

        // Get payroll data for last 6 months
        // Get payroll data for last 6 months
        const payrollByMonth: Array<{ name: string; value: number; net: number; gross: number; deductions: number }> = [];
        for (let i = 5; i >= 0; i--) {
            const monthDate = new Date();
            monthDate.setDate(1); // Avoid 31st day overflow
            monthDate.setMonth(monthDate.getMonth() - i);
            const monthStr = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
            const monthName = `${monthDate.getMonth() + 1}-р сар`;
            const monthStats = payslips
                .filter((p: any) => {
                    if (!p.periodStart) return false;
                    // Robust string comparison
                    return p.periodStart.startsWith(monthStr);
                })
                .reduce((acc: any, p: any) => {
                    const net = Number(p.netPay || 0);
                    const gross = Number(p.grossPay || 0);
                    acc.net += isNaN(net) ? 0 : net;
                    acc.gross += isNaN(gross) ? 0 : gross;
                    return acc;
                }, { net: 0, gross: 0 });

            const net = Math.round(monthStats.net);
            const gross = Math.round(monthStats.gross);
            const deductions = gross - net;

            payrollByMonth.push({
                name: monthName,
                value: gross, // Total height is Gross
                net,
                gross,
                deductions
            });
        }

        // Ensure we have data for all 6 months (fill with 0 if missing)
        if (payrollByMonth.length === 0) {
            for (let i = 5; i >= 0; i--) {
                const monthDate = new Date();
                monthDate.setMonth(monthDate.getMonth() - i);
                const monthName = `${monthDate.getMonth() + 1}-р сар`;
                payrollByMonth.push({ name: monthName, value: 0, net: 0, gross: 0, deductions: 0 });
            }
        }

        // Get additional stats
        const [productCount] = await db.select({ count: sql<number>`count(*)` }).from(products).where(eq(products.tenantId, tenantId));
        const [customerCount] = await db.select({ count: sql<number>`count(*)` }).from(contacts).where(and(eq(contacts.tenantId, tenantId), eq(contacts.type, "customer")));
        const [invoiceCount] = await db.select({ count: sql<number>`count(*)` }).from(invoices).where(eq(invoices.tenantId, tenantId));








        // Get sales revenue for current month - only posted invoices
        const allInvoices = await db.select({
            totalAmount: invoices.totalAmount,
            invoiceDate: invoices.invoiceDate,
            type: invoices.type,
            status: invoices.status,
            // Need items for cash flow calculation? The original implementation used allInvoices in calculateCashFlowProjection
            // Let's assume we need more fields for cash flow
            paidAmount: invoices.paidAmount,
            dueDate: invoices.dueDate,
            ebarimtDocumentId: invoices.ebarimtDocumentId,
            ebarimtLotteryNumber: invoices.ebarimtLotteryNumber,
            createdAt: invoices.createdAt,
            invoiceNumber: invoices.invoiceNumber,
            id: invoices.id,
        })
            .from(invoices)
            .where(and(eq(invoices.tenantId, tenantId), eq(invoices.status, "posted")));

        const currentMonthInvoices = allInvoices.filter((inv) => {
            if (!inv.invoiceDate) return false;
            const invDate = new Date(inv.invoiceDate);
            return invDate.getMonth() + 1 === currentMonth && invDate.getFullYear() === currentYear && inv.type === "sales" && inv.status === "posted";
        });

        const monthlyRevenue = currentMonthInvoices.reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

        // Get sales revenue for last 6 months
        const salesByMonth: Array<{ name: string; value: number }> = [];
        for (let i = 5; i >= 0; i--) {
            const monthDate = new Date();
            monthDate.setMonth(monthDate.getMonth() - i);
            const monthName = `${monthDate.getMonth() + 1}-р сар`;
            const monthInvoices = allInvoices.filter((inv) => {
                if (!inv.invoiceDate || inv.type !== "sales" || inv.status !== "posted") return false;
                const invDate = new Date(inv.invoiceDate);
                return invDate.getMonth() === monthDate.getMonth() && invDate.getFullYear() === monthDate.getFullYear();
            });
            const monthRevenue = monthInvoices.reduce((sum, inv) => {
                const amount = Number(inv.totalAmount || 0);
                return sum + (isNaN(amount) ? 0 : amount);
            }, 0);
            salesByMonth.push({ name: monthName, value: Math.round(monthRevenue) });
        }

        // Ensure we have data for all 6 months (fill with 0 if missing)
        if (salesByMonth.length === 0) {
            for (let i = 5; i >= 0; i--) {
                const monthDate = new Date();
                monthDate.setMonth(monthDate.getMonth() - i);
                const monthName = `${monthDate.getMonth() + 1}-р сар`;
                salesByMonth.push({ name: monthName, value: 0 });
            }
        }

        // Get recent invoices (last 5)
        const recentInvoices = await db.select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            totalAmount: invoices.totalAmount,
            invoiceDate: invoices.invoiceDate,
            status: invoices.status,
            contactName: sql<string>`COALESCE(${contacts.companyName}, ${contacts.firstName} || ' ' || ${contacts.lastName})`,
        })
            .from(invoices)
            .leftJoin(contacts, eq(invoices.contactId, contacts.id))
            .where(eq(invoices.tenantId, tenantId))
            .orderBy(sql`${invoices.createdAt} DESC`)
            .limit(5);

        // Get today's attendance stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        const todayAttendance = attendanceRecords.filter((a: any) => {
            const recordDate = new Date(a.workDate || a.date);
            recordDate.setHours(0, 0, 0, 0);
            return recordDate.toISOString().split('T')[0] === todayStr;
        });
        const todayPresent = Number(todayAttendance.filter((a: any) => a.status === 'present' || a.status?.toLowerCase() === 'present').length) || 0;
        const todayLate = Number(todayAttendance.filter((a: any) => a.status === 'late' || a.status?.toLowerCase() === 'late').length) || 0;
        const activeCount = Number(activeEmpCount?.count || 0);
        const todayAbsent = Math.max(0, activeCount - todayPresent - todayLate); // Ensure non-negative
        const todayAttendanceRate = activeCount > 0 ? Math.round((todayPresent / activeCount) * 100) : null;

        // Get pending requests (salary advances + leave requests with status="pending")
        const pendingAdvances = await this.getSalaryAdvances(tenantId, undefined, "pending");
        const pendingLeaveRequests = await this.getPendingLeaveRequestsCount(tenantId);
        const pendingRequestsCount = pendingAdvances.length + pendingLeaveRequests;

        // Get birthdays (today)
        const allEmployees = await this.getEmployees(tenantId);
        const todayBirthdays = allEmployees.filter((emp: any) => {
            if (!emp.birthDate) return false;
            const birthDate = new Date(emp.birthDate);
            const today = new Date();
            return birthDate.getMonth() === today.getMonth() && birthDate.getDate() === today.getDate();
        }).map((emp: any) => ({
            id: emp.id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            employeeNo: emp.employeeNo,
            birthDate: emp.birthDate,
        }));

        // Get contract expiry reminders (next 30 days)
        const thirtyDaysFromNow = new Date();
        thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
        const contractExpiry = allEmployees.filter((emp: any) => {
            if (!emp.hireDate) return false;
            const hireDate = new Date(emp.hireDate);
            const contractEndDate = new Date(hireDate);
            contractEndDate.setFullYear(contractEndDate.getFullYear() + 1); // Assume 1 year contract
            const today = new Date();
            return contractEndDate >= today && contractEndDate <= thirtyDaysFromNow;
        }).map((emp: any) => {
            const hireDate = new Date(emp.hireDate);
            const contractEndDate = new Date(hireDate);
            contractEndDate.setFullYear(contractEndDate.getFullYear() + 1);
            return {
                id: emp.id,
                firstName: emp.firstName,
                lastName: emp.lastName,
                employeeNo: emp.employeeNo,
                contractEndDate: contractEndDate.toISOString().split('T')[0],
            };
        });

        // Get trial period reminders (next 3 months) - employees hired within last 3 months
        const threeMonthsAgo = new Date();
        threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
        const trialPeriod = allEmployees.filter((emp: any) => {
            if (!emp.hireDate) return false;
            const hireDate = new Date(emp.hireDate);
            const today = new Date();
            return hireDate >= threeMonthsAgo && hireDate <= today;
        }).map((emp: any) => ({
            id: emp.id,
            firstName: emp.firstName,
            lastName: emp.lastName,
            employeeNo: emp.employeeNo,
            hireDate: emp.hireDate,
        }));

        // Calculate payroll budget usage (current month / projected annual)
        const annualPayrollBudget = monthlyPayroll * 12; // Simple projection
        const payrollBudgetUsage = annualPayrollBudget > 0 ? Math.round((monthlyPayroll / annualPayrollBudget) * 100 * 12) : 0; // Percentage of annual budget

        // Get E-barimt status - detailed statistics
        // Filter sales invoices from allInvoices which is already fetched above
        // Note: allInvoices query above filters by tenantId and status=posted, but not filtered by ebarimt fields.
        // We need 'sales' type invoices
        const allInvoicesForEbarimt = allInvoices.filter(inv => inv.type === "sales");

        const unsentEbarimtCount = allInvoicesForEbarimt.filter(inv => !inv.ebarimtDocumentId).length;
        const sentWithLottery = allInvoicesForEbarimt.filter(inv => inv.ebarimtLotteryNumber).length;
        const totalSent = allInvoicesForEbarimt.length - unsentEbarimtCount;

        // Today's sent invoices (reuse the 'today' variable already declared above)
        const todaySent = allInvoicesForEbarimt.filter(inv =>
            inv.ebarimtDocumentId &&
            inv.createdAt &&
            new Date(inv.createdAt) >= today
        ).length;

        // Successful vs failed (assuming failed = no documentId after some time)
        const successful = totalSent;
        const failed = 0; // Could be tracked separately if we add error field

        // Last sync time (from ebarimt settings or latest invoice)
        const latestSent = allInvoicesForEbarimt
            .filter(inv => inv.ebarimtDocumentId)
            .sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
                const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
                return dateB - dateA;
            })[0];

        // @ts-ignore
        const lastSyncTime = latestSent?.createdAt ? format(new Date(latestSent.createdAt), "HH:mm") : null;

        // Calculate "lottery win probability" (just for fun - based on sent invoices)
        const lotteryWinProbability = totalSent > 0 ? Math.min(98, Math.round((sentWithLottery / totalSent) * 100 + Math.random() * 10)) : 0;

        // Get recent activity feed from audit logs (last 20 events)
        const recentActivities = await this.getAuditLogs(tenantId, { limit: 20 });
        const activityFeed = recentActivities.map((log: any) => {
            let message = "";
            let icon = "activity";
            let severity = "info"; // info, warning, success, critical
            let url = "";
            let entityLabel = "";
            let actorName = log.actorId === "00000000-0000-0000-0000-000000000000" ? "System" : "User"; // Placeholder for name lookup

            const data = log.afterData || log.beforeData || {};

            if (log.entity === "employee") {
                if (log.action === "create") {
                    const firstName = data.firstName || data.first_name;
                    const lastName = data.lastName || data.last_name;
                    entityLabel = `${lastName?.substring(0, 1) || ""}.${firstName || ""}`;
                    message = `Шинэ ажилтан ${entityLabel} ажилд орлоо`;
                    icon = "user-plus";
                    severity = "success";
                    url = `/employees?id=${log.entityId}`;
                } else if (log.action === "update") {
                    const firstName = data.firstName || data.first_name;
                    entityLabel = firstName || "Ажилтан";
                    message = `${entityLabel}-ны мэдээлэл шинэчлэгдлээ`;
                    icon = "user-edit";
                    severity = "info";
                    url = `/employees?id=${log.entityId}`;
                } else if (log.action === "delete") {
                    const firstName = data.firstName || data.first_name;
                    entityLabel = firstName || "Ажилтан";
                    message = `${entityLabel} ажлаас гарлаа`;
                    icon = "user-minus";
                    severity = "warning";
                    url = `/employees`;
                }
            } else if (log.entity === "salary_advance") {
                if (log.action === "create") {
                    const empName = data.employeeName || data.firstName;
                    const amount = data.amount;
                    entityLabel = empName || "Ажилтан";
                    message = `${entityLabel} цалингийн урьдчилгаа хүсэлт (${amount ? amount + "₮" : ""}) илгээлээ`;
                    icon = "credit-card";
                    severity = "warning";
                    url = `/salary-advances?status=pending`; // Or to requests tab
                } else if (log.action === "approve") {
                    const empName = data.employeeName || data.firstName;
                    entityLabel = empName || "Ажилтан";
                    message = `${entityLabel}-ны урьдчилгаа хүсэлт батлагдлаа`;
                    icon = "check-circle";
                    severity = "success";
                    url = `/salary-advances`;
                } else if (log.action === "reject") {
                    const empName = data.employeeName || data.firstName;
                    entityLabel = empName || "Ажилтан";
                    message = `${entityLabel}-ны урьдчилгаа хүсэлт цуцлагдлаа`;
                    icon = "x-circle";
                    severity = "error";
                    url = `/salary-advances`;
                }
            } else if (log.entity === "attendance" || log.entity === "attendance_day") {
                if (log.action === "create") {
                    const empName = data.employeeName || data.firstName;
                    const time = data.timeIn ? format(new Date(data.timeIn), "HH:mm") : "";
                    entityLabel = empName || "Ажилтан";
                    message = `${entityLabel} ирц бүртгүүллээ ${time ? "(" + time + ")" : ""}`;
                    icon = "clock-in";
                    severity = "info";
                    url = `/attendance`;
                }
            } else if (log.entity === "invoice") {
                if (log.action === "create") {
                    const invoiceNumber = data.invoiceNumber || data.invoice_number;
                    const amount = data.totalAmount || data.amount;
                    entityLabel = invoiceNumber || "Invoice";
                    message = `Нэхэмжлэх ${entityLabel} үүсгэгдлээ ${amount ? "(" + Number(amount).toLocaleString() + "₮)" : ""}`;
                    icon = "file-text";
                    severity = "info";
                    url = `/invoices?search=${invoiceNumber}`;
                } else if (log.action === "post") {
                    const invoiceNumber = data.invoiceNumber || data.invoice_number;
                    entityLabel = invoiceNumber || "Invoice";
                    message = `Нэхэмжлэх ${entityLabel} батлагдлаа`;
                    icon = "check-circle";
                    severity = "success";
                    url = `/invoices?search=${invoiceNumber}`;
                } else if (log.action === "paid" || log.status === "paid" || (log.action === "update" && data.status === "paid")) {
                    const invoiceNumber = data.invoiceNumber || data.invoice_number;
                    entityLabel = invoiceNumber || "Invoice";
                    message = `Нэхэмжлэх ${entityLabel} төлөгдлөө`;
                    icon = "dollar-sign";
                    severity = "success";
                    url = `/invoices?search=${invoiceNumber}`;
                }
            } else if (log.entity === "payroll" || log.entity === "payroll_run") {
                if (log.action === "create") {
                    const periodStart = data.periodStart || data.period_start;
                    entityLabel = periodStart || "Payroll";
                    message = `Цалингийн бодолт (${periodStart}) бэлтгэгдлээ`;
                    icon = "dollar-sign";
                    severity = "warning";
                    url = `/payroll`;
                }
            }

            if (!message) {
                message = log.message || `${log.entity || "Үйл явдал"} - ${log.action || "шинэчлэлт"}`;
            }

            return {
                id: log.id,
                message,
                icon,
                eventTime: log.createdAt, // Was log.eventTime
                actorUserId: log.actorId, // Was log.actorUserId
                actorName,
                entityType: log.entity, // Was log.entityType
                entityId: log.entityId,
                entityLabel,
                severity,
                url,
                rawAction: log.action, // Useful for grouping
                rawData: data
            };
        });

        // Filter Activity Feed for Employees
        let filteredActivityFeed: any[] = [];
        if (isEmployeeRole && userId) {
            filteredActivityFeed = (activityFeed || []).filter((item: any) => {
                // Allow if actor is the user
                if (item.actorUserId && String(item.actorUserId) === String(userId)) return true;
                // Allow if entity is the employee
                if (empId && item.entityId && String(item.entityId) === String(empId)) return true;
                return false;
            });
        } else {
            filteredActivityFeed = activityFeed || [];
        }

        return {
            totalEmployees: isEmployeeRole ? 0 : Number(empCount?.count || 0),
            activeEmployees: isEmployeeRole ? 0 : Number(activeEmpCount?.count || 0),
            totalDepartments: isEmployeeRole ? 0 : Number(deptCount?.count || 0),
            monthlyPayroll: isEmployeeRole ? 0 : (monthlyPayroll || 0),
            totalProducts: isEmployeeRole ? 0 : Number(productCount?.count || 0),
            totalCustomers: isEmployeeRole ? 0 : Number(customerCount?.count || 0),
            totalInvoices: isEmployeeRole ? 0 : Number(invoiceCount?.count || 0),
            monthlyRevenue: isEmployeeRole ? 0 : (monthlyRevenue || 0),
            payrollByMonth: isEmployeeRole ? [] : (payrollByMonth.length > 0 ? payrollByMonth : []),
            salesByMonth: isEmployeeRole ? [] : (salesByMonth.length > 0 ? salesByMonth : []),
            attendanceByDay: isEmployeeRole ? [] : (Object.keys(attendanceByDay).length > 0 ? Object.entries(attendanceByDay).map(([name, data]) => ({
                name,
                present: data.present,
                late: data.late,
                absent: Math.max(0, data.total - data.present - data.late),
                total: data.total,
                rate: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0
            })) : []),
            recentInvoices: isEmployeeRole ? [] : recentInvoices.map((inv: any) => ({
                id: inv.id,
                invoiceNumber: inv.invoiceNumber,
                totalAmount: Number(inv.totalAmount || 0),
                invoiceDate: inv.invoiceDate,
                status: inv.status,
                contactName: inv.contactName || "Unknown",
            })),
            todayAttendance: isEmployeeRole ? {
                present: todayAttendance.find((a: any) => String(a.employeeId) === String(empId) && (a.status === 'present' || a.status === 'ирсэн')) ? 1 : 0,
                late: todayAttendance.find((a: any) => String(a.employeeId) === String(empId) && (a.status === 'late' || a.status === 'хоцорсон')) ? 1 : 0,
                absent: !todayAttendance.find((a: any) => String(a.employeeId) === String(empId)) ? 1 : 0,
                rate: todayAttendance.find((a: any) => String(a.employeeId) === String(empId) && (['present', 'late', 'ирсэн', 'хоцорсон'].includes(a.status?.toLowerCase()))) ? 100 : 0
            } : {
                present: Number(todayPresent) || 0,
                late: Number(todayLate) || 0,
                absent: Number(todayAbsent) || 0,
                rate: todayAttendanceRate,
            },
            pendingRequests: isEmployeeRole ? (pendingAdvances.filter(p => String(p.employeeId) === String(empId)).length) : pendingRequestsCount,
            birthdays: todayBirthdays,
            contractExpiry: isEmployeeRole ? [] : contractExpiry,
            trialPeriod: isEmployeeRole ? [] : trialPeriod,
            payrollBudgetUsage: isEmployeeRole ? 0 : payrollBudgetUsage,
            activityFeed: filteredActivityFeed,
            ebarimtStatus: isEmployeeRole ? null : {
                unsentCount: unsentEbarimtCount,
                lotteryWinProbability,
                totalSent,
                todaySent,
                successful,
                failed,
                lastSyncTime,
            },
            cashFlowProjection: isEmployeeRole ? null : this.calculateCashFlowProjection(
                monthlyPayroll,
                monthlyRevenue,
                allInvoices,
                payslips,
                currentMonth,
                currentYear
            ),
            wallOfFame: await this.getLeaderboardData(tenantId, 5),
            recentPosts: await this.getCompanyPosts(tenantId, { limit: 5 }),
            invoicePaymentStatus: isEmployeeRole ? null : await this.calculateInvoicePaymentStatus(tenantId),
        };
    }

    // Helper: Calculate invoice payment status for cashflow widget
    private async calculateInvoicePaymentStatus(tenantId: string): Promise<{
        todayPaid: number;
        overdue: number;
        next7Days: number;
        totalUnpaid: number;
    }> {
        // Optimized: Reuse getInvoices or select specific fields if needed
        // But since getInvoices returns all fields, let's use it or optimize if slow.
        // For now use getInvoices from FinanceStorage
        const invoices = await this.getInvoices(tenantId, "sales");
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const sevenDaysFromNow = new Date();
        sevenDaysFromNow.setDate(sevenDaysFromNow.getDate() + 7);
        sevenDaysFromNow.setHours(23, 59, 59, 999);

        let todayPaid = 0;
        let overdue = 0;
        let next7Days = 0;
        let totalUnpaid = 0;

        for (const inv of invoices) {
            if (inv.status !== "posted") continue;

            const invoiceDate = inv.invoiceDate ? new Date(inv.invoiceDate) : null;
            const dueDate = inv.dueDate ? new Date(inv.dueDate) : invoiceDate;
            if (!dueDate) continue;

            const totalAmount = Number(inv.totalAmount) || 0;
            const paidAmount = Number(inv.paidAmount) || 0;
            const unpaidAmount = totalAmount - paidAmount;

            if (unpaidAmount <= 0) {
                if (inv.status === "paid" && invoiceDate && invoiceDate >= today) {
                    todayPaid += paidAmount;
                }
                continue;
            }

            totalUnpaid += unpaidAmount;

            if (dueDate < today) {
                overdue += unpaidAmount;
            } else if (dueDate <= sevenDaysFromNow) {
                next7Days += unpaidAmount;
            }
        }

        return {
            todayPaid,
            overdue,
            next7Days,
            totalUnpaid,
        };
    }

    // Helper: Get leaderboard data for dashboard
    async getLeaderboardData(tenantId: string, limit: number = 5, timeRange: string = 'all_time'): Promise<any[]> {
        const employees = await this.getEmployees(tenantId);

        // Define date range filter
        let startDate: Date | null = null;
        const now = new Date();

        if (timeRange === 'today') {
            startDate = startOfDay(now);
        } else if (timeRange === '7days') {
            startDate = subDays(now, 7);
        } else if (timeRange === '30days') {
            startDate = subDays(now, 30);
        } else if (timeRange === 'this_month') {
            startDate = startOfMonth(now);
        }

        const leaderboard = await Promise.all(
            employees.map(async (emp: any) => {
                let points = 0;
                let lastActiveAt = new Date(0);

                if (timeRange === 'all_time') {
                    const pt = await this.getEmployeePoints(tenantId, emp.id);
                    points = pt ? Number(pt.points) : 0;
                    // For all time, try to find latest history for lastActive
                    const history = await this.getPointsHistory(tenantId, emp.id, 1);
                    if (history.length > 0) {
                        lastActiveAt = new Date(history[0].createdAt);
                    }
                } else if (startDate) {
                    // Fetch history within range
                    const history = await db.select()
                        .from(pointsHistory)
                        .where(and(
                            eq(pointsHistory.tenantId, tenantId),
                            eq(pointsHistory.employeeId, emp.id),
                            sql`${pointsHistory.createdAt} >= ${startDate.toISOString()}`
                        ));

                    points = history.reduce((sum, h) => sum + Number(h.points), 0);
                    if (history.length > 0) {
                        // Find latest
                        lastActiveAt = history.reduce((latest, h) => {
                            const d = new Date(h.createdAt);
                            return d > latest ? d : latest;
                        }, new Date(0));
                    }
                }

                // Get achievements (badges)
                const achievements = await this.getEmployeeAchievements(tenantId, emp.id);

                // Calculate "Early Bird" streak (7 days without being late)
                // We check last 7 attendance records
                const recentAttendance = await db.select()
                    .from(attendanceDays)
                    .where(and(
                        eq(attendanceDays.tenantId, tenantId),
                        eq(attendanceDays.employeeId, emp.id)
                    ))
                    .orderBy(desc(attendanceDays.workDate))
                    .limit(7);

                const hasEarlyBirdStreak = recentAttendance.length >= 7 && recentAttendance.every(a => a.status === 'present' || a.status === 'ирсэн');

                // Breakdown for tooltip
                // For simplicity, we'll estimate breakdown if exact source isn't easy to query in bulk
                // Or better, query history types if within range
                let breakdown = { present: 0, late: 0, badges: 0, manual: 0 };

                // If we have history (filtered), use it. If all_time, we might just give rough estimates or skip
                // For MVP, let's just return total points and let frontend handle generic tooltip or
                // if we have filtered history, classify it
                if (startDate) {
                    // We have the 'history' array in memory ideally, but i didn't save it above. 
                    // Let's refactor slightly to be more efficient if needed, but for now:
                    const history = await db.select()
                        .from(pointsHistory)
                        .where(and(
                            eq(pointsHistory.tenantId, tenantId),
                            eq(pointsHistory.employeeId, emp.id),
                            startDate ? sql`${pointsHistory.createdAt} >= ${startDate.toISOString()}` : undefined
                        ));

                    history.forEach(h => {
                        const reason = (h.reason || "").toLowerCase();
                        const pts = Number(h.points);
                        if (reason.includes("irsen") || reason.includes("attendance") || reason.includes("present")) breakdown.present += pts;
                        else if (reason.includes("late") || reason.includes("hotsorson")) breakdown.late += pts;
                        else if (reason.includes("badge") || reason.includes("achievement") || h.sourceType === "achievement") breakdown.badges += pts;
                        else breakdown.manual += pts;
                    });
                } else {
                    // All time breakdown - expensive to calc all history. 
                    // Let's just put all in 'manual' or try to fetch summary.
                    // For now leave 0s to indicate "Not available for all-time" or implement later
                }

                return {
                    id: emp.id,
                    name: `${emp.firstName} ${emp.lastName}`,
                    employeeNo: emp.employeeNo,
                    points,
                    breakdown,
                    achievementsCount: achievements.length,
                    hasEarlyBirdStreak,  // New field
                    lastActiveAt,
                    latestAchievement: achievements.length > 0 ? {
                        type: achievements[0].achievementType,
                        achievedAt: achievements[0].achievedAt,
                    } : null,
                };
            })
        );

        // Sort by Points DESC, then Tie-breaker (Recent activity or Total Present/Streak)
        leaderboard.sort((a: any, b: any) => {
            if (b.points !== a.points) {
                return b.points - a.points;
            }
            // Tie-breaker: Recent activity (lastActiveAt DESC)
            return b.lastActiveAt.getTime() - a.lastActiveAt.getTime();
        });

        return leaderboard.slice(0, limit).map((item: any, index: number) => ({
            ...item,
            rank: String(index + 1),
            kudos: item.points,
        }));
    }

    // Helper: Calculate Cash Flow Projection
    private calculateCashFlowProjection(
        monthlyPayroll: number,
        monthlyRevenue: number,
        allInvoices: any[],
        payslips: any[],
        currentMonth: number,
        currentYear: number
    ): {
        next7DaysRevenue: number;
        next7DaysExpenses: number;
        netCashFlow: number;
        recommendation: string;
        confidenceLevel?: string;
        dataPointsUsed?: number;
    } {
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
        const daysPassed = new Date().getDate();
        const avgDailyRevenue = daysPassed > 0 ? monthlyRevenue / daysPassed : monthlyRevenue / daysInMonth;

        const next7DaysRevenue = avgDailyRevenue * 7;

        const avgDailyPayroll = daysInMonth > 0 ? monthlyPayroll / daysInMonth : monthlyPayroll / 30;

        const next7DaysExpenses = avgDailyPayroll * 7;

        const netCashFlow = next7DaysRevenue - next7DaysExpenses;

        let recommendation = "";
        // Threshold: 5% of weekly revenue forecast
        const thresholdWarning = -(next7DaysRevenue * 0.05);

        if (netCashFlow >= 0) {
            recommendation = "Эерэг урсгалтай байна";
        } else if (netCashFlow > thresholdWarning) {
            recommendation = "Анхаарах: Бага хэмжээний сөрөг урсгал";
        } else {
            recommendation = "Яаралтай арга хэмжээ авах шаардлагатай";
        }

        // Confidence Calculation (high, medium, low)
        // Based on data points (e.g. number of invoices used for avg calculation)
        const dataPoints = allInvoices.length;
        let confidenceLevel = "low";
        if (dataPoints > 10) confidenceLevel = "high";
        else if (dataPoints >= 5) confidenceLevel = "medium";

        return {
            next7DaysRevenue: Math.round(next7DaysRevenue),
            next7DaysExpenses: Math.round(next7DaysExpenses),
            netCashFlow: Math.round(netCashFlow),
            recommendation,
            confidenceLevel,
            dataPointsUsed: dataPoints
        };
    }
    // --- Generic Requests ---
    async createRequest(request: DbInsertRequest): Promise<Request> {
        const [newRequest] = await db.insert(requests).values(request).returning();
        return newRequest;
    }

    async getRequests(tenantId: string, filters?: { type?: string, status?: string, userId?: string, scope?: string }): Promise<Request[]> {
        const conditions = [eq(requests.tenantId, tenantId)];

        if (filters?.type) {
            conditions.push(eq(requests.type, filters.type));
        }
        if (filters?.status) {
            conditions.push(eq(requests.status, filters.status));
        }
        if (filters?.userId) {
            conditions.push(eq(requests.createdBy, filters.userId));
        }

        // Scope logic might be handled by caller by setting userId, but let's keep it simple here
        // If scope='approvals', we might need complex logic, but usually that means filtering by currentApproverRoleId or similar.
        // For now, let's assume 'approvals' logic is handled by 'status' or specific queries.
        // Or if we strictly follow the interface: scope logic needs to be here.
        // But for generic retrieve, just filtering by fields is cleaner.

        return await db.select()
            .from(requests)
            .where(and(...conditions))
            .orderBy(desc(requests.createdAt));
    }

    async getRequest(id: string): Promise<Request | undefined> {
        const [request] = await db.select().from(requests).where(eq(requests.id, id));
        return request;
    }

    async updateRequest(id: string, updates: Partial<InsertRequest>): Promise<Request> {
        const [updated] = await db.update(requests)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(requests.id, id))
            .returning();
        return updated;
    }

    async createRequestEvent(event: InsertRequestEvent): Promise<RequestEvent> {
        const [created] = await db.insert(requestEvents).values(event).returning();
        return created;
    }

    async getRequestEvents(requestId: string): Promise<RequestEvent[]> {
        return await db.select()
            .from(requestEvents)
            .where(eq(requestEvents.requestId, requestId))
            .orderBy(desc(requestEvents.createdAt));
    }

    // --- Company Settings ---
    async getCompanySettings(tenantId: string): Promise<CompanySettings | undefined> {
        const [settings] = await db.select().from(companySettings).where(eq(companySettings.tenantId, tenantId));
        return settings;
    }

    async upsertCompanySettings(tenantId: string, settings: InsertCompanySettings): Promise<CompanySettings> {
        const existing = await this.getCompanySettings(tenantId);
        if (existing) {
            const [updated] = await db.update(companySettings)
                .set({ ...settings, updatedAt: new Date() })
                .where(eq(companySettings.id, existing.id))
                .returning();
            return updated;
        } else {
            const [created] = await db.insert(companySettings)
                .values({ ...settings, tenantId })
                .returning();
            return created;
        }
    }
}

