import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { requirePermission } from "./permissions";
import { getRoutePermission, requiresPermission } from "./route-permissions";
import { logRBACEvent } from "./rbac-audit";
import { apiRateLimiter } from "./security";
import { z } from "zod";
import {
  insertEmployeeSchema, insertDepartmentSchema, insertAttendanceDaySchema, insertPayrollRunSchema, insertPayslipSchema,
  insertSalaryAdvanceSchema, insertEmployeeAllowanceSchema,
  insertProductSchema, insertProductCategorySchema, insertContactSchema, insertWarehouseSchema,
  insertSalesOrderSchema, insertSalesOrderLineSchema, insertPurchaseOrderSchema, insertPurchaseOrderLineSchema,
  insertInvoiceSchema, insertInvoiceLineSchema,
  insertCurrencySchema, insertAccountSchema, insertJournalSchema, insertJournalEntrySchema, insertJournalLineSchema,
  insertTaxCodeSchema, insertPaymentSchema,
  type DbInsertEmployee, type DbInsertDepartment, type DbInsertAttendanceDay, type DbInsertPayrollRun,
  type DbInsertPayslip, type Payslip, type PayrollRun, type DbInsertDocument, type DbInsertProduct, type DbInsertProductCategory,
  type DbInsertSalaryAdvance, type DbInsertEmployeeAllowance,
  type DbInsertEmployeeAchievement, type DbInsertEmployeePoints, type DbInsertPointsHistory,
  branches, type DbInsertBranch, insertBranchSchema,
  companyPosts, postLikes, postComments, insertCompanyPostSchema, insertPostCommentSchema,
  type DbInsertCompanyPost, type DbInsertPostComment, type InsertBranch,
  weatherAlerts, weatherSettings, insertWeatherSettingsSchema, taxCodes,
  type DbInsertWeatherAlert, type DbInsertWeatherSettings,
  type DbInsertContact, type DbInsertWarehouse, type DbInsertSalesOrder, type DbInsertSalesOrderLine,
  type DbInsertPurchaseOrder, type DbInsertPurchaseOrderLine, type DbInsertInvoice, type DbInsertInvoiceLine,
  type DbInsertCurrency, type DbInsertAccount, type DbInsertJournal, type DbInsertJournalEntry, type DbInsertJournalLine,
  type DbInsertTaxCode, type DbInsertPayment,
  accounts, journalLines, bankAccounts, rolePermissions,
} from "@shared/schema";
import { createAuditLog, getAuditContext } from "./audit-log";
import multer from "multer";
import fs from "fs";
import path from "path";
import express from "express";

import { format } from "date-fns";
import { calculateMongolianPayroll } from "@shared/payroll-calculator";
import { db } from "./db";
import { sql, eq, and } from "drizzle-orm";


export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupAuth(app);

  // General API rate limiting (applied to all API routes)
  app.use("/api", apiRateLimiter);

  // Serve uploads directory
  const uploadDir = path.join(process.cwd(), "uploads");
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
  app.use('/uploads', express.static(uploadDir));

  // Configure Multer
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

  // Helper to ensure tenant context
  const requireTenant = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(403).send("No tenant associated with user");
    req.tenantId = tenantId;
    next();
  };

  // Helper: Get current user's employee record and role info
  const getCurrentUserContext = async (req: any) => {
    const userId = req.user?.id;
    const tenantId = req.tenantId;

    // Get user roles
    const userRoles = userId ? await storage.getUserRoles(userId) : [];
    const isAdmin = userRoles.some((r: any) => r.name.toLowerCase() === "admin" || r.isSystem);

    // Get current user's employee record
    let currentEmployee = null;
    if (userId && tenantId) {
      const employees = await storage.getEmployees(tenantId);
      currentEmployee = employees.find((e: any) =>
        e.email === req.user?.email ||
        e.userId === userId
      ) || null;
    }

    // Check if user is a department manager
    let managedDepartmentId = null;
    if (currentEmployee && tenantId) {
      const departments = await storage.getDepartments(tenantId);
      const managedDept = departments.find((d: any) => d.managerId === currentEmployee.id);
      managedDepartmentId = managedDept?.id || null;
    }

    return {
      userId,
      tenantId,
      isAdmin,
      currentEmployee,
      managedDepartmentId,
      userRoles,
    };
  };

  // Permission check wrapper (used in requireTenantAndPermission)
  const checkPermission = async (req: any, res: any, next: any) => {
    // DEFAULT-DENY: All write operations require explicit permission
    const isWriteOperation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);

    if (isWriteOperation) {
      // Check if route has explicit permission mapping
      const permission = getRoutePermission(req.method, req.path);
      if (!permission) {
        // No explicit permission mapping = DENY by default
        return res.status(403).json({
          message: "Permission denied: Write operations require explicit permission mapping",
          path: req.path,
          method: req.method,
        });
      }

      // Special case: Allow users to create/update their own attendance without permission
      if (permission.resource === "attendance" && (permission.action === "create" || permission.action === "update")) {
        // If creating/updating attendance, check if it's for the current user's employee record
        if (req.method === "POST" && req.body?.employeeId) {
          const employees = await storage.getEmployees(req.tenantId);
          const currentEmployee = employees.find((e: any) =>
            e.email === req.user?.email ||
            e.userId === req.user?.id
          );

          // Allow if creating attendance for self
          if (currentEmployee && currentEmployee.id === req.body.employeeId) {
            return next();
          }
        }

        if ((req.method === "PUT" || req.method === "PATCH") && req.params?.id) {
          const existing = await storage.getAttendanceRecord(req.params.id);
          if (existing) {
            const employees = await storage.getEmployees(req.tenantId);
            const currentEmployee = employees.find((e: any) =>
              e.email === req.user?.email ||
              e.userId === req.user?.id
            );

            // Allow if updating own attendance
            if (currentEmployee && currentEmployee.id === existing.employeeId) {
              return next();
            }
          }
        }
      }

      // Special case: Allow users to update their own signature (profile)
      if (permission.resource === "profile" && permission.action === "update") {
        // If route contains "/users/me/signature", it's a self-update
        if (req.path.includes("/users/me/signature")) {
          return next();
        }
      }

      // Check permission using requirePermission middleware
      requirePermission(permission.resource, permission.action)(req, res, next);
    } else {
      // Read operations (GET) - allow by default if authenticated
      return next();
    }
  };

  // Enhanced requireTenant that also checks permissions
  const requireTenantAndPermission = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(403).send("No tenant associated with user");
    req.tenantId = tenantId;

    // Check permission after tenant is set
    checkPermission(req, res, next);
  };

  // --- Employees ---
  app.get("/api/employees", requireTenant, async (req: any, res) => {
    const employees = await storage.getEmployees(req.tenantId);
    res.json(employees);
  });

  app.get("/api/employees/:id", requireTenant, async (req: any, res) => {
    const employee = await storage.getEmployee(req.params.id);
    if (!employee || employee.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json(employee);
  });

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

  // Real-time Salary Display API
  app.get("/api/employees/:id/realtime-salary", requireTenant, async (req: any, res) => {
    try {
      const employeeId = req.params.id;
      const currentMonth = req.query.month || format(new Date(), "yyyy-MM");

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

      // Calculate current salary
      const baseSalary = Number(employee.baseSalary || 0);
      const dailyRate = totalWorkingDays > 0 ? baseSalary / totalWorkingDays : 0;
      const calculatedBaseSalary = dailyRate * daysWorked;

      // Calculate using payroll calculator
      const allowanceData = activeAllowances.map((a: any) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        amount: Number(a.amount || 0),
        isTaxable: a.isTaxable ?? true,
        isSHI: a.isSHI ?? true,
        isPIT: a.isPIT ?? true,
      }));

      const advanceData = activeAdvances.map((a: any) => ({
        id: a.id,
        amount: Number(a.amount || 0),
        deductedAmount: Number(a.deductedAmount || 0),
        deductionType: a.deductionType || "monthly",
        monthlyDeductionAmount: a.monthlyDeductionAmount ? Number(a.monthlyDeductionAmount) : undefined,
      }));

      const calculation = calculateMongolianPayroll({
        baseSalary: calculatedBaseSalary,
        allowances: allowanceData,
        advances: advanceData,
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

  app.post("/api/employees", requireTenantAndPermission, async (req: any, res) => {
    try {
      const input = { ...insertEmployeeSchema.parse(req.body), tenantId: req.tenantId } as DbInsertEmployee;
      const employee = await storage.createEmployee(input);

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        "employee",
        employee.id,
        "create",
        undefined,
        employee,
        `Employee ${employee.employeeNo || employee.firstName} created`
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

  app.put("/api/employees/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
      // Validate ownership
      const existing = await storage.getEmployee(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Employee not found" });
      }

      const input = insertEmployeeSchema.partial().parse(req.body); // Allow partial updates
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

  app.delete("/api/employees/:id", requireTenantAndPermission, async (req: any, res) => {
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
  // LEAVE REQUESTS (Чөлөөний хүсэлт)
  // ==========================================

  // Get all leave requests (with optional status filter)
  app.get("/api/leave-requests", requireTenant, async (req: any, res) => {
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

  // Get pending leave requests count (for Dashboard widget)
  app.get("/api/leave-requests/pending-count", requireTenant, async (req: any, res) => {
    try {
      const count = await storage.getPendingLeaveRequestsCount(req.tenantId);
      res.json({ count });
    } catch (err: any) {
      console.error("Get pending leave requests count error:", err);
      res.status(500).json({ message: "Error fetching pending count" });
    }
  });

  // Create leave request
  app.post("/api/leave-requests", requireTenantAndPermission, async (req: any, res) => {
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

  // Update leave request (approve/reject)
  app.put("/api/leave-requests/:id", requireTenantAndPermission, async (req: any, res) => {
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

  // --- RBAC ---
  app.get("/api/permissions", requireTenant, async (req: any, res) => {
    try {
      const permissions = await storage.getPermissions();
      res.json(permissions);
    } catch (err: any) {
      console.error("Get permissions error:", err);
      res.status(500).json({ message: "Error fetching permissions" });
    }
  });

  app.get("/api/roles", requireTenant, async (req: any, res) => {
    try {
      const roles = await storage.getRoles(req.tenantId);
      res.json(roles);
    } catch (err: any) {
      console.error("Get roles error:", err);
      res.status(500).json({ message: "Error fetching roles" });
    }
  });

  app.get("/api/roles/:id", requireTenant, async (req: any, res) => {
    try {
      const role = await storage.getRole(req.tenantId, req.params.id);
      if (!role) return res.status(404).json({ message: "Role not found" });
      res.json(role);
    } catch (err: any) {
      console.error("Get role error:", err);
      res.status(500).json({ message: "Error fetching role" });
    }
  });

  app.post("/api/roles", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { insertRoleSchema } = await import("@shared/schema");
      const { permissionIds, ...roleData } = req.body;

      const insertData = insertRoleSchema.parse({
        ...roleData,
        tenantId: req.tenantId
      });

      const role = await storage.createRole(req.tenantId, insertData, permissionIds || []);

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        "role",
        role.id,
        "create",
        undefined,
        { name: role.name },
        `Role ${role.name} created`
      );

      res.status(201).json(role);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error("Create role error:", err);
        res.status(500).json({ message: err.message || "Error creating role" });
      }
    }
  });

  app.put("/api/roles/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
      const existing = await storage.getRole(req.tenantId, req.params.id);
      if (!existing) return res.status(404).json({ message: "Role not found" });

      const { insertRoleSchema } = await import("@shared/schema");
      const { permissionIds, ...roleData } = req.body;

      const updateData = insertRoleSchema.partial().parse(roleData);

      const updated = await storage.updateRole(req.params.id, updateData, permissionIds);

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        "role",
        updated.id,
        "update",
        existing,
        updated,
        `Role ${updated.name} updated`
      );

      res.json(updated);
    } catch (err: any) {
      console.error("Update role error:", err);
      res.status(500).json({ message: err.message || "Error updating role" });
    }
  });

  app.delete("/api/roles/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
      await storage.deleteRole(req.tenantId, req.params.id);

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        "role",
        req.params.id,
        "delete",
        undefined,
        undefined,
        `Role deleted`
      );

      res.status(204).send();
    } catch (err: any) {
      console.error("Delete role error:", err);
      res.status(500).json({ message: err.message || "Error deleting role" });
    }
  });

  app.post("/api/roles/:id/permissions", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { permissionId } = req.body;
      if (!permissionId) return res.status(400).json({ message: "permissionId required" });

      const role = await storage.getRole(req.tenantId, req.params.id);
      if (!role) return res.status(404).json({ message: "Role not found" });

      // Check if permission exists properly? Assume yes if ID provided.
      // Upsert
      const [existing] = await db.select().from(rolePermissions).where(and(
        eq(rolePermissions.roleId, role.id),
        eq(rolePermissions.permissionId, permissionId)
      ));

      if (!existing) {
        await db.insert(rolePermissions).values({
          roleId: role.id,
          permissionId,
        });

        // Audit log
        await createAuditLog(
          getAuditContext(req),
          "permission",
          permissionId,
          "create", // or 'assign'
          undefined,
          { roleId: role.id, permissionId },
          `Assigned permission to role ${role.name}`
        );
      }

      res.status(200).json({ message: "Permission assigned" });
    } catch (err: any) {
      console.error("Assign permission error:", err);
      res.status(500).json({ message: err.message || "Error assigning permission" });
    }
  });

  app.delete("/api/roles/:id/permissions/:permissionId", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { permissionId, id } = req.params;

      const role = await storage.getRole(req.tenantId, id);
      if (!role) return res.status(404).json({ message: "Role not found" });

      await db.delete(rolePermissions).where(and(
        eq(rolePermissions.roleId, role.id),
        eq(rolePermissions.permissionId, permissionId)
      ));

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        "permission",
        permissionId,
        "delete",
        { roleId: role.id, permissionId },
        undefined,
        `Removed permission from role ${role.name}`
      );

      res.status(200).json({ message: "Permission removed" });
    } catch (err: any) {
      console.error("Remove permission error:", err);
      res.status(500).json({ message: err.message || "Error removing permission" });
    }
  });

  // ==========================================
  // ADMIN APPROVAL API (Pending Users)
  // ==========================================

  // Get pending users in current tenant (for admin approval)
  app.get("/api/pending-users", requireTenant, async (req: any, res) => {
    try {
      const allUsers = await storage.getUsers(req.tenantId);
      const pendingUsers = allUsers.filter((u: any) => u.status === "pending");
      res.json(pendingUsers);
    } catch (err: any) {
      console.error("Get pending users error:", err);
      res.status(500).json({ message: err.message || "Error fetching pending users" });
    }
  });

  // Get all users in current tenant (for user management)
  app.get("/api/tenant-users", requireTenant, async (req: any, res) => {
    try {
      const allUsers = await storage.getUsers(req.tenantId);
      res.json(allUsers);
    } catch (err: any) {
      console.error("Get tenant users error:", err);
      res.status(500).json({ message: err.message || "Error fetching tenant users" });
    }
  });

  // Approve a pending user
  app.post("/api/users/:id/approve", requireTenantAndPermission, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });
      }

      // Ensure same tenant
      if (user.tenantId !== req.tenantId) {
        return res.status(403).json({ message: "Та өөр компанийн хэрэглэгчийг батлах эрхгүй" });
      }

      if ((user as any).status !== "pending") {
        return res.status(400).json({ message: "Энэ хэрэглэгч аль хэдийн баталгаажсан эсвэл татгалзагдсан" });
      }

      // Update status to active
      const updated = await storage.updateUser(userId, { status: "active" } as any);

      // Also try to link to employee if not already linked
      if (user.email) {
        await storage.linkUserToEmployeeByEmail(userId, user.email, req.tenantId);
      }

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        "user",
        userId,
        "approve",
        { status: "pending" },
        { status: "active" },
        `User ${user.username} approved`
      );

      res.json({
        message: "Хэрэглэгч амжилттай батлагдлаа",
        user: updated
      });
    } catch (err: any) {
      console.error("Approve user error:", err);
      res.status(500).json({ message: err.message || "Error approving user" });
    }
  });

  // Reject a pending user
  app.post("/api/users/:id/reject", requireTenantAndPermission, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { reason } = req.body;
      const user = await storage.getUser(userId);

      if (!user) {
        return res.status(404).json({ message: "Хэрэглэгч олдсонгүй" });
      }

      // Ensure same tenant
      if (user.tenantId !== req.tenantId) {
        return res.status(403).json({ message: "Та өөр компанийн хэрэглэгчийг татгалзах эрхгүй" });
      }

      if ((user as any).status !== "pending") {
        return res.status(400).json({ message: "Энэ хэрэглэгч аль хэдийн баталгаажсан эсвэл татгалзагдсан" });
      }

      // Update status to rejected
      const updated = await storage.updateUser(userId, { status: "rejected" } as any);

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        "user",
        userId,
        "reject",
        { status: "pending" },
        { status: "rejected" },
        `User ${user.username} rejected. Reason: ${reason || 'No reason provided'}`
      );

      res.json({
        message: "Хэрэглэгчийн хүсэлт татгалзагдлаа",
        user: updated
      });
    } catch (err: any) {
      console.error("Reject user error:", err);
      res.status(500).json({ message: err.message || "Error rejecting user" });
    }
  });

  // Get company info including code (for admins to share with employees)
  app.get("/api/company-info", requireTenant, async (req: any, res) => {
    try {
      const tenant = await storage.getTenant(req.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Company not found" });
      }
      res.json({
        id: tenant.id,
        name: tenant.name,
        code: tenant.code,
        status: tenant.status,
      });
    } catch (err: any) {
      console.error("Get company info error:", err);
      res.status(500).json({ message: err.message || "Error fetching company info" });
    }
  });

  // --- Branches ---
  app.get("/api/branches", requireTenant, async (req: any, res) => {
    const branches = await storage.getBranches(req.tenantId);
    res.json(branches);
  });

  app.post("/api/branches", requireTenantAndPermission, async (req: any, res) => {
    try {
      const input = insertBranchSchema.parse(req.body);
      const branch = await storage.createBranch({ ...input, tenantId: req.tenantId } as DbInsertBranch);
      res.status(201).json(branch);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.put("/api/branches/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
      const existing = await storage.getBranches(req.tenantId);
      const branch = existing.find((b: any) => b.id === req.params.id);

      if (!branch || branch.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Branch not found" });
      }

      const updateData = insertBranchSchema.partial().parse(req.body);

      // Update branch manually
      const updated = await db.update(branches)
        .set({ ...updateData, updatedAt: new Date() })
        .where(eq(branches.id, req.params.id))
        .returning();

      res.json(updated[0]);
    } catch (err: any) {
      console.error("Branch update error:", err);
      res.status(500).json({ message: err.message || "Error updating branch" });
    }
  });

  // --- Departments ---
  app.get("/api/departments", requireTenant, async (req: any, res) => {
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
      // - HR Admin: See all departments
      // - Dept Manager: See only their department
      // - Staff: See summary only (limited data)
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
            // Remove detailed stats for staff
            ...(withStats ? {
              attendanceKPI: d.attendanceKPI,
              topEmployees: d.topEmployees?.slice(0, 3) || [], // Limited to 3
            } : {}),
            // No manager info, no full employee list for staff
          }));
        }
      }

      res.json(depts);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.post("/api/departments", requireTenant, async (req: any, res) => {
    try {
      const input = { ...insertDepartmentSchema.parse(req.body), tenantId: req.tenantId } as DbInsertDepartment;
      const dept = await storage.createDepartment(input);

      // Audit log: Department created
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

  // Get department details with full stats
  app.get("/api/departments/:id/details", requireTenant, async (req: any, res) => {
    try {
      const context = await getCurrentUserContext(req);
      const departmentId = req.params.id;

      // RBAC Check: Dept Manager can only see their department
      if (!context.isAdmin && context.managedDepartmentId !== departmentId) {
        // Staff can see summary, but not full details
        if (!context.managedDepartmentId) {
          // Staff: Return limited summary
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
            // No full employee list, no detailed stats for staff
          });
        } else {
          // Not manager of this department
          return res.status(403).json({
            message: "Permission denied: You can only view your own department details"
          });
        }
      }

      // Admin or Dept Manager: Full details
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

  // Update department (PUT /api/departments/:id)
  app.put("/api/departments/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
      // Get existing department for audit log
      const existing = await storage.getDepartment(req.tenantId, req.params.id);
      if (!existing) {
        return res.status(404).json({ message: "Department not found" });
      }

      const updates = insertDepartmentSchema.partial().parse(req.body);

      // Check for parent department change (structure reorganization)
      const isParentChange = updates.parentDepartmentId !== undefined &&
        updates.parentDepartmentId !== existing.parentDepartmentId;

      // Prevent circular references: a department cannot be its own parent
      if (updates.parentDepartmentId === req.params.id) {
        return res.status(400).json({ message: "Хэлтэс өөрийн эцэг хэлтэс болж болохгүй" });
      }

      // If setting a parent, check that parent exists and belongs to same tenant
      if (updates.parentDepartmentId) {
        const parentDept = await storage.getDepartment(req.tenantId, updates.parentDepartmentId);
        if (!parentDept) {
          return res.status(400).json({ message: "Эцэг хэлтэс олдсонгүй" });
        }
      }

      const updated = await storage.updateDepartment(req.params.id, updates);

      // Audit log: Department updated with special handling for structure changes
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
        // Regular update
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

  // Assign manager to department (PUT /api/departments/:id/manager)
  app.put("/api/departments/:id/manager", requireTenantAndPermission, async (req: any, res) => {
    // Additional RBAC: Only HR Admin can assign managers
    const context = await getCurrentUserContext(req);
    if (!context.isAdmin) {
      return res.status(403).json({
        message: "Permission denied: Only HR Admin can assign department managers"
      });
    }
    try {
      const { employeeId } = req.body; // null to remove manager

      // Get existing department and manager info for audit log
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

      // Audit log: Manager assigned/removed
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

  // Delete department (DELETE /api/departments/:id)
  app.delete("/api/departments/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
      // Get existing department for audit log
      const existing = await storage.getDepartment(req.tenantId, req.params.id);

      if (!existing) {
        return res.status(404).json({ message: "Department not found" });
      }

      await storage.deleteDepartment(req.params.id);

      // Audit log: Department deleted
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

  // Batch assign employees to department (POST /api/departments/:id/assign-employees)
  app.post("/api/departments/:id/assign-employees", requireTenantAndPermission, async (req: any, res) => {
    // Additional RBAC: Only HR Admin can assign employees
    const context = await getCurrentUserContext(req);
    if (!context.isAdmin) {
      return res.status(403).json({
        message: "Permission denied: Only HR Admin can assign employees to departments"
      });
    }
    try {
      const { employeeIds } = z.object({ employeeIds: z.array(z.string().uuid()) }).parse(req.body);

      // Get department and employee info for audit log
      const dept = await storage.getDepartment(req.tenantId, req.params.id);

      if (!dept) {
        return res.status(404).json({ message: "Department not found" });
      }

      // Get employee names for audit log
      const employees = await storage.getEmployees(req.tenantId);
      const assignedEmployees = employees
        .filter(emp => employeeIds.includes(emp.id))
        .map(emp => ({ id: emp.id, name: `${emp.firstName} ${emp.lastName || ""}`, employeeNo: emp.employeeNo }));

      // Get old department assignments for audit log
      const oldAssignments = employees
        .filter(emp => employeeIds.includes(emp.id) && emp.departmentId)
        .map(emp => ({
          employeeId: emp.id,
          employeeName: `${emp.firstName} ${emp.lastName || ""}`,
          oldDepartmentId: emp.departmentId
        }));

      await storage.batchAssignEmployeesToDepartment(req.params.id, employeeIds);

      // Audit log: Employees assigned
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

  // --- Attendance ---
  app.get("/api/attendance", requireTenant, async (req: any, res) => {
    const { employeeId, startDate, endDate } = req.query;

    if (employeeId && startDate && endDate) {
      // Get attendance for specific employee and date range
      const att = await storage.getAttendanceByEmployeeAndDateRange(
        req.tenantId,
        employeeId,
        startDate,
        endDate
      );
      res.json(att);
    } else {
      // Get all attendance
      const att = await storage.getAttendance(req.tenantId);
      res.json(att);
    }
  });

  app.post("/api/attendance", requireTenantAndPermission, async (req: any, res) => {
    try {
      const input = { ...insertAttendanceDaySchema.parse(req.body), tenantId: req.tenantId } as DbInsertAttendanceDay;
      const att = await storage.createAttendance(input);

      // Award points for attendance (background, don't block response)
      awardAttendancePoints(req.tenantId, att.employeeId, att.status).catch(console.error);

      // Check for Early Bird badge (background, don't block response)
      checkAndAwardEarlyBirdBadge(req.tenantId, att.employeeId).catch(console.error);

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

  app.put("/api/attendance/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
      // Validate ownership
      const existing = await storage.getAttendanceRecord(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Attendance record not found" });
      }

      const input = insertAttendanceDaySchema.partial().parse(req.body);
      const att = await storage.updateAttendance(req.params.id, input);

      // Award points if status changed (background, don't block response)
      if (input.status) {
        awardAttendancePoints(req.tenantId, att.employeeId, input.status).catch(console.error);
      }

      // Check for Early Bird badge (background, don't block response)
      checkAndAwardEarlyBirdBadge(req.tenantId, att.employeeId).catch(console.error);

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

  app.delete("/api/attendance/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
      // Validate ownership
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

  // --- Payroll ---
  app.get("/api/payroll-runs", requireTenant, async (req: any, res) => {
    // Return Payslips (flat list with Period info)
    const payslips = await storage.getAllPayslips(req.tenantId);
    res.json(payslips);
  });

  // Alias for frontend compatibility
  app.get("/api/payroll", requireTenant, async (req: any, res) => {
    // Return Payslips (flat list with Period info)
    const payslips = await storage.getAllPayslips(req.tenantId);
    res.json(payslips);
  });

  const payrollSubmissionSchema = z.object({
    employeeId: z.string(),
    periodStart: z.string(), // YYYY-MM-DD
    periodEnd: z.string(),   // YYYY-MM-DD
    paymentDate: z.string(),
    baseSalary: z.number().or(z.string()),
    netSalary: z.number().or(z.string()),
    tax: z.number().or(z.string()).optional(),
    socialInsurance: z.number().or(z.string()).optional(),
    status: z.enum(["Pending", "Processing", "Paid"]),
  });

  // Payroll submission endpoint (frontend uses /api/payroll)
  app.post("/api/payroll", requireTenantAndPermission, async (req: any, res) => {
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

      // 2. Check if payslip already exists for this employee in this payroll run
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
        // Update existing payslip
        payslip = await storage.updatePayslip(existingPayslip.id, payslipData);
        res.status(200).json(payslip);
      } else {
        // Create new payslip
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

  // Delete payslip
  app.delete("/api/payslips/:id", requireTenantAndPermission, async (req: any, res) => {
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
  app.get("/api/salary-advances", requireTenant, async (req: any, res) => {
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

  app.get("/api/salary-advances/:id", requireTenant, async (req: any, res) => {
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

  app.post("/api/salary-advances", requireTenantAndPermission, async (req: any, res) => {
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

  app.put("/api/salary-advances/:id", requireTenantAndPermission, async (req: any, res) => {
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

  app.post("/api/salary-advances/:id/approve", requireTenantAndPermission, async (req: any, res) => {
    try {
      const existing = await storage.getSalaryAdvance(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Salary advance not found" });
      }

      if (existing.status !== "pending") {
        return res.status(400).json({ message: `Cannot approve advance with status: ${existing.status}` });
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

  app.post("/api/salary-advances/:id/reject", requireTenantAndPermission, async (req: any, res) => {
    try {
      const existing = await storage.getSalaryAdvance(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Salary advance not found" });
      }

      if (existing.status !== "pending") {
        return res.status(400).json({ message: `Cannot reject advance with status: ${existing.status}` });
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

  app.delete("/api/salary-advances/:id", requireTenantAndPermission, async (req: any, res) => {
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
  app.get("/api/employee-allowances", requireTenant, async (req: any, res) => {
    try {
      const employeeId = req.query.employeeId;
      const allowances = await storage.getEmployeeAllowances(req.tenantId, employeeId);
      res.json(allowances);
    } catch (err: any) {
      console.error("Employee allowances error:", err);
      res.status(500).json({ message: err.message || "Error fetching employee allowances" });
    }
  });

  app.get("/api/employee-allowances/:id", requireTenant, async (req: any, res) => {
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

  app.post("/api/employee-allowances", requireTenantAndPermission, async (req: any, res) => {
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

  app.put("/api/employee-allowances/:id", requireTenantAndPermission, async (req: any, res) => {
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

  app.delete("/api/employee-allowances/:id", requireTenantAndPermission, async (req: any, res) => {
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
  app.get("/api/employees/:id/achievements", requireTenant, async (req: any, res) => {
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

  app.get("/api/employees/:id/points", requireTenant, async (req: any, res) => {
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

  app.get("/api/employees/:id/points-history", requireTenant, async (req: any, res) => {
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

  app.get("/api/achievements/leaderboard", requireTenant, async (req: any, res) => {
    try {
      // Get all employees with their points
      const employees = await storage.getEmployees(req.tenantId);
      const leaderboard = await Promise.all(
        employees.map(async (emp: any) => {
          const points = await storage.getEmployeePoints(req.tenantId, emp.id);
          const achievements = await storage.getEmployeeAchievements(req.tenantId, emp.id);
          return {
            employeeId: emp.id,
            employeeName: `${emp.firstName} ${emp.lastName}`,
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
  app.get("/api/posts", requireTenant, async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 50;
      const posts = await storage.getCompanyPosts(req.tenantId, limit);

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

  app.get("/api/posts/:id", requireTenant, async (req: any, res) => {
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

  app.post("/api/posts", requireTenantAndPermission, async (req: any, res) => {
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

  app.put("/api/posts/:id", requireTenantAndPermission, async (req: any, res) => {
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

  app.delete("/api/posts/:id", requireTenantAndPermission, async (req: any, res) => {
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

  app.post("/api/posts/:id/like", requireTenant, async (req: any, res) => {
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

  app.get("/api/posts/:id/likes", requireTenant, async (req: any, res) => {
    try {
      const likes = await storage.getPostLikes(req.tenantId, req.params.id);
      res.json(likes.map((like: any) => ({
        ...like,
        employeeName: `${like.employeeFirstName || ""} ${like.employeeLastName || ""}`.trim() || "Unknown",
      })));
    } catch (err: any) {
      console.error("Post likes error:", err);
      res.status(500).json({ message: err.message || "Error fetching likes" });
    }
  });

  app.post("/api/posts/:id/comments", requireTenant, async (req: any, res) => {
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
        createdAt: new Date(),
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

  app.get("/api/posts/:id/comments", requireTenant, async (req: any, res) => {
    try {
      const comments = await storage.getPostComments(req.tenantId, req.params.id);
      res.json(comments.map((comment: any) => ({
        ...comment,
        employeeName: `${comment.employeeFirstName || ""} ${comment.employeeLastName || ""}`.trim() || "Unknown",
      })));
    } catch (err: any) {
      console.error("Post comments error:", err);
      res.status(500).json({ message: err.message || "Error fetching comments" });
    }
  });

  app.delete("/api/posts/:postId/comments/:commentId", requireTenant, async (req: any, res) => {
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

      if (comment.employeeId !== currentEmployee?.id && req.user.role !== "Admin") {
        return res.status(403).json({ message: "Only comment author or admin can delete" });
      }

      await storage.deletePostComment(req.params.commentId);
      res.status(204).send();
    } catch (err: any) {
      console.error("Comment deletion error:", err);
      res.status(500).json({ message: err.message || "Error deleting comment" });
    }
  });

  // --- Weather Widget ---
  app.get("/api/weather", requireTenant, async (req: any, res) => {
    try {
      const settings = await storage.getWeatherSettings(req.tenantId);

      // Default mock data for development/testing
      const mockWeatherData = {
        temp: -30,
        feelsLike: -35,
        condition: "extreme_cold",
        description: "Хүйтэн",
        city: "Ulaanbaatar",
        settings: {
          cityName: "Ulaanbaatar",
          alertEnabled: true,
          coldThreshold: -25,
          heatThreshold: 35,
        },
        alert: {
          alertType: "extreme_cold",
          temperatureCelsius: -35,
          conditionText: "Хүйтэн",
          message: "Маргааш -35°C хүйтэн байна. Ажилтнууддаа гэрээсээ ажиллах санал тавих уу?",
          suggestedAction: "work_from_home",
        },
      };

      if (!settings) {
        return res.json(mockWeatherData);
      }

      // Fetch current weather
      const { fetchWeatherData, checkWeatherAlerts } = await import("./weather-service");
      const apiKey = settings.apiKey || process.env.WEATHER_API_KEY || process.env.OPENWEATHERMAP_API_KEY;

      // If no API key, return mock data
      if (!apiKey) {
        console.warn("No weather API key found in settings or environment");
        return res.json(mockWeatherData);
      }

      const weatherData = await fetchWeatherData(
        settings.cityName || "Ulaanbaatar",
        settings.countryCode || "MN",
        apiKey
      );

      // If API fails, return mock data instead of error
      if (!weatherData) {
        console.warn("Weather API failed, returning mock data");
        return res.json(mockWeatherData);
      }

      // Check for alerts
      let alert = null;
      if (settings.alertEnabled) {
        alert = checkWeatherAlerts(
          weatherData,
          Number(settings.coldThreshold) || -25,
          Number(settings.heatThreshold) || 35
        );

        // Create alert if needed and not already sent today
        if (alert) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          const existingAlerts = await storage.getWeatherAlerts(req.tenantId, 1);
          const todayAlert = existingAlerts.find((a: any) =>
            a.alertType === alert!.alertType &&
            new Date(a.createdAt) >= today &&
            !a.isSent
          );

          if (!todayAlert) {
            await storage.createWeatherAlert({
              tenantId: req.tenantId,
              alertType: alert.alertType,
              temperatureCelsius: String(alert.temperatureCelsius),
              conditionText: alert.conditionText,
              message: alert.message,
              suggestedAction: alert.suggestedAction,
              isSent: false,
              createdAt: new Date(),
            } as any);
          }
        }
      }

      res.json({
        ...weatherData,
        settings: {
          cityName: settings.cityName,
          alertEnabled: settings.alertEnabled,
          coldThreshold: Number(settings.coldThreshold),
          heatThreshold: Number(settings.heatThreshold),
        },
        alert,
      });
    } catch (err: any) {
      console.error("Weather error:", err);
      res.status(500).json({ message: err.message || "Цаг агаарын мэдээлэл авахад алдаа гарлаа" });
    }
  });

  app.get("/api/weather/alerts", requireTenant, async (req: any, res) => {
    try {
      const limit = req.query.limit ? parseInt(req.query.limit) : 10;
      const alerts = await storage.getWeatherAlerts(req.tenantId, limit);
      res.json(alerts);
    } catch (err: any) {
      console.error("Weather alerts error:", err);
      res.status(500).json({ message: err.message || "Алдаа гарлаа" });
    }
  });

  app.put("/api/weather/settings", requireTenantAndPermission, async (req: any, res) => {
    try {
      const input = insertWeatherSettingsSchema.parse(req.body);
      const settings = await storage.upsertWeatherSettings(req.tenantId, input);
      res.json(settings);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error("Weather settings error:", err);
        res.status(500).json({ message: err.message || "Алдаа гарлаа" });
      }
    }
  });

  app.post("/api/weather/alerts/:id/send", requireTenantAndPermission, async (req: any, res) => {
    try {
      await storage.markWeatherAlertAsSent(req.params.id);

      // TODO: Send notification to all employees or admins
      // This could be integrated with email/SMS service

      res.json({ success: true, message: "Анхааруулга илгээгдлээ" });
    } catch (err: any) {
      console.error("Send alert error:", err);
      res.status(500).json({ message: err.message || "Алдаа гарлаа" });
    }
  });

  // --- Documents ---
  app.get("/api/documents", requireTenant, async (req: any, res) => {
    const parentId = req.query.parentId as string | undefined;

    // Auto-seed default folders if verifying for the first time
    if (!parentId) {
      await storage.seedDocuments(req.tenantId, req.user.id);
    }

    const docs = await storage.getDocuments(req.tenantId, parentId);
    res.json(docs);
  });

  app.post("/api/documents/upload", requireTenant, upload.single('file'), async (req: any, res) => {
    try {
      if (!req.file) return res.status(400).json({ message: "No file uploaded" });

      const body = req.body;
      const fileUrl = `/uploads/${req.file.filename}`;

      const input = {
        tenantId: req.tenantId,
        name: Buffer.from(req.file.originalname, 'latin1').toString('utf8'), // Fix encoding if needed, or just use originalName
        type: "file",
        mimeType: req.file.mimetype,
        size: req.file.size,
        path: fileUrl,
        uploadedBy: req.user.id,
        parentId: body.parentId || undefined
      } as DbInsertDocument;

      const doc = await storage.createDocument(input);
      res.status(201).json(doc);
    } catch (err: any) {
      console.error("Upload error:", err);
      res.status(500).json({ message: err.message || "Upload failed" });
    }
  });

  app.post("/api/documents", requireTenant, async (req: any, res) => {
    try {
      const { uploadedBy, ...body } = req.body;

      console.log("DEBUG: createDocument body:", body);

      // Auto-file Invoices: If it's an invoice and no parent specified, put it in "Invoices" folder
      let parentId = body.parentId;
      if (body.relatedEntityType === 'invoice' && !parentId) {
        console.log("DEBUG: Auto-filing Invoice trigger!");
        parentId = await storage.ensureInvoiceFolder(req.tenantId, req.user.id);
        console.log("DEBUG: New Parent ID:", parentId);
      }

      const input = {
        ...body,
        parentId,
        tenantId: req.tenantId,
        uploadedBy: req.user.id
      } as DbInsertDocument;
      const doc = await storage.createDocument(input);
      res.status(201).json(doc);
    } catch (err) {
      console.error("Document Error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Bulk Delete Documents
  app.post("/api/documents/bulk-delete", requireTenant, async (req: any, res) => {
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
  app.patch("/api/documents/:id", requireTenant, async (req: any, res) => {
    try {
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
  app.patch("/api/users/me/signature", async (req: any, res) => {
    if (!req.user) return res.sendStatus(401);
    try {
      const { signatureUrl, jobTitle } = req.body;
      const user = await storage.updateUserSignature(req.user.id, signatureUrl, jobTitle);
      res.json(user);
    } catch (err) {
      console.error("Signature Update Error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  // Admin: Update User Permissions (canSignDocuments, jobTitle)
  app.patch("/api/admin/users/:id/permissions", async (req: any, res) => {
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

      // Return minimal payload for UI update
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

  app.delete("/api/documents/:id", requireTenant, async (req: any, res) => {
    try {
      await storage.deleteDocument(req.params.id);
      res.sendStatus(200);
    } catch (err: any) {
      console.error("Document deletion error:", err);
      res.status(500).json({ message: err.message || "Баримт устгахад алдаа гарлаа" });
    }
  });

  app.post("/api/documents/:id/sign", requireTenant, async (req: any, res) => {
    try {
      const doc = await storage.signDocument(req.params.id, req.user.id);
      res.json(doc);
    } catch (err: any) {
      console.error("Document sign error:", err);
      res.status(500).json({ message: err.message || "Баримт баталгаажуулахад алдаа гарлаа" });
    }
  });

  // --- Stats ---
  app.get("/api/stats", requireTenant, async (req: any, res) => {
    // Debug: Log tenantId to ensure correct tenant context
    console.log(`[API /api/stats] tenantId: ${req.tenantId}, userId: ${req.user?.id}`);
    const stats = await storage.getStats(req.tenantId);
    res.json(stats);
  });

  // --- Company Settings (Tenant) ---
  app.get("/api/company", requireTenant, async (req: any, res) => {
    const tenant = await storage.getTenant(req.tenantId);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    res.json(tenant);
  });

  app.put("/api/company", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { insertTenantSchema } = await import("@shared/schema");
      const updateData = insertTenantSchema.partial().parse(req.body);
      const updated = await storage.updateTenant(req.tenantId, updateData);
      res.status(200).json(updated);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error updating company" });
    }
  });

  // --- QPay Settings ---
  app.get("/api/qpay/settings", requireTenant, async (req: any, res) => {
    try {
      const settings = await storage.getQPaySettings(req.tenantId);
      if (!settings) {
        return res.json({
          enabled: false,
          mode: "sandbox",
          clientId: null,
          clientSecret: null,
          invoiceCode: null,
          callbackSecret: null,
          webhookUrl: null,
          autoPosting: false,
        });
      }
      // Mask secrets in response
      const response = { ...settings };
      if (response.clientSecret) response.clientSecret = "********";
      if (response.callbackSecret) response.callbackSecret = "********";
      res.json(response);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching QPay settings" });
    }
  });

  app.put("/api/qpay/settings", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { clientSecret, callbackSecret, ...rest } = req.body;
      const existing = await storage.getQPaySettings(req.tenantId);

      // Only update secrets if provided (not masked)
      const updateData: any = { ...rest };
      if (clientSecret && clientSecret !== "********") {
        updateData.clientSecret = clientSecret;
      } else if (existing && clientSecret === "********") {
        updateData.clientSecret = existing.clientSecret;
      }

      if (callbackSecret && callbackSecret !== "********") {
        updateData.callbackSecret = callbackSecret;
      } else if (existing && callbackSecret === "********") {
        updateData.callbackSecret = existing.callbackSecret;
      }

      // Generate webhook URL
      const publicBaseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:5000";
      updateData.webhookUrl = `${publicBaseUrl}/api/payments/qpay/webhook`;

      const settings = await storage.updateQPaySettings(req.tenantId, updateData);
      const response = { ...settings };
      if (response.clientSecret) response.clientSecret = "********";
      if (response.callbackSecret) response.callbackSecret = "********";
      res.json(response);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error updating QPay settings" });
    }
  });

  // --- QPay QR Generation ---
  app.post("/api/qpay/generate-qr", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { invoiceId } = req.body;
      if (!invoiceId) {
        return res.status(400).json({ message: "invoiceId is required" });
      }

      const settings = await storage.getQPaySettings(req.tenantId);
      if (!settings || !settings.enabled) {
        return res.status(400).json({ message: "QPay is not enabled" });
      }

      const invoice = await storage.getInvoice(invoiceId);
      if (!invoice || invoice.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Check if QR already exists
      let qpayInvoice = await storage.getQPayInvoiceByInvoiceId(invoiceId);

      if (!qpayInvoice) {
        // Generate callback URL
        const publicBaseUrl = process.env.PUBLIC_BASE_URL || "http://localhost:5000";
        const tenantKey = req.tenantId; // In production, use tenant public key
        const callbackUrl = `${publicBaseUrl}/api/payments/qpay/webhook?t=${tenantKey}&inv=${invoiceId}`;

        // Create QPay service and call API
        const { createQPayService } = await import("./qpay-service");
        const qpayService = await createQPayService(req.tenantId, storage);

        if (!qpayService || !qpayService.isConfigured()) {
          return res.status(400).json({ message: "QPay service is not properly configured" });
        }

        // Call QPay API to create invoice
        const result = await qpayService.createInvoice({
          senderInvoiceNo: invoice.invoiceNumber,
          invoiceDescription: `Invoice ${invoice.invoiceNumber}`,
          amount: parseFloat(invoice.totalAmount.toString()),
          callbackUrl,
        });

        if (!result.success || !result.data) {
          return res.status(500).json({
            message: result.error || "Failed to create QPay invoice",
            errorCode: result.errorCode
          });
        }

        // Store QPay invoice in database
        qpayInvoice = await storage.createQPayInvoice({
          tenantId: req.tenantId,
          invoiceId,
          qpayInvoiceId: result.data.invoiceId,
          amount: invoice.totalAmount,
          qrText: result.data.qrText,
          qrImage: result.data.qrImage,
          status: "pending",
          callbackUrl,
        } as any);
      }

      res.json({
        invoiceId: qpayInvoice.qpayInvoiceId,
        qrImage: qpayInvoice.qrImage,
        qrText: qpayInvoice.qrText,
        callbackUrl: qpayInvoice.callbackUrl,
        status: qpayInvoice.status,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error generating QR" });
    }
  });

  // --- QPay Check Payment Status ---
  app.get("/api/qpay/check-payment/:invoiceId", requireTenant, async (req: any, res) => {
    try {
      const { invoiceId } = req.params;
      const invoice = await storage.getInvoice(invoiceId);

      if (!invoice || invoice.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const qpayInvoice = await storage.getQPayInvoiceByInvoiceId(invoiceId);
      if (!qpayInvoice || !qpayInvoice.qpayInvoiceId) {
        return res.status(404).json({ message: "QPay invoice not found" });
      }

      const { createQPayService } = await import("./qpay-service");
      const qpayService = await createQPayService(req.tenantId, storage);

      if (!qpayService || !qpayService.isConfigured()) {
        return res.status(400).json({ message: "QPay service is not properly configured" });
      }

      const result = await qpayService.checkPaymentStatus({
        objectType: "INVOICE",
        objectId: qpayInvoice.qpayInvoiceId,
      });

      if (!result.success) {
        return res.status(500).json({
          message: result.error || "Failed to check payment status",
          errorCode: result.errorCode
        });
      }

      res.json({
        count: result.data?.count || 0,
        paidAmount: result.data?.paidAmount || 0,
        payments: result.data?.rows || [],
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error checking payment status" });
    }
  });

  // --- QPay Webhook ---
  app.post("/api/payments/qpay/webhook", async (req: any, res) => {
    try {
      const { t: tenantKey, inv: invoiceId } = req.query;
      if (!tenantKey || !invoiceId) {
        return res.status(400).json({ message: "Missing tenant or invoice parameter" });
      }

      const qpayInvoice = await storage.getQPayInvoiceByInvoiceId(invoiceId as string);
      if (!qpayInvoice) {
        return res.status(404).json({ message: "QPay invoice link not found" });
      }

      const settings = await storage.getQPaySettings(qpayInvoice.tenantId);
      if (!settings || !settings.enabled) {
        return res.status(400).json({ message: "QPay is not enabled for this tenant" });
      }

      // Create QPay service
      const { createQPayService } = await import("./qpay-service");
      const qpayService = await createQPayService(qpayInvoice.tenantId, storage);

      if (!qpayService || !qpayService.isConfigured()) {
        return res.status(400).json({ message: "QPay service is not properly configured" });
      }

      // Verify webhook signature if callbackSecret is configured
      if (settings.callbackSecret) {
        const signature = req.headers["x-qpay-signature"] || req.query.signature;
        const payload = JSON.stringify(req.body);

        if (signature && !qpayService.verifyWebhookSignature(signature, payload)) {
          console.warn("QPay webhook signature verification failed");
          return res.status(401).json({ message: "Invalid signature" });
        }
      }

      // Idempotency check
      if (qpayInvoice.paymentId) {
        return res.json({ status: "OK", message: "Already processed" });
      }

      // Check payment status from QPay
      if (!qpayInvoice.qpayInvoiceId) {
        return res.status(400).json({ message: "QPay invoice ID not found" });
      }

      const paymentCheckResult = await qpayService.checkPaymentStatus({
        objectType: "INVOICE",
        objectId: qpayInvoice.qpayInvoiceId,
      });

      if (!paymentCheckResult.success || !paymentCheckResult.data) {
        return res.status(500).json({
          message: paymentCheckResult.error || "Failed to check payment status"
        });
      }

      // Find paid payment
      const paidPayment = paymentCheckResult.data.rows.find(
        (p) => p.paymentStatus === "PAID"
      );

      if (!paidPayment) {
        return res.json({ status: "NOT_PAID" });
      }

      // Payment is confirmed, create payment record
      const invoice = await storage.getInvoice(invoiceId as string);
      if (!invoice) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Create payment
      const payment = await storage.createPayment({
        tenantId: qpayInvoice.tenantId,
        invoiceId: invoiceId as string,
        paymentDate: new Date(paidPayment.paymentDate).toISOString().split("T")[0],
        amount: paidPayment.paymentAmount.toString(),
        currencyCode: paidPayment.paymentCurrency || "MNT",
        paymentMethod: "qr_code",
        reference: paidPayment.paymentId,
        status: "completed",
      } as any);

      // Attach payment to QPay invoice
      await storage.attachPaymentToQPayInvoice(qpayInvoice.id, payment.id);

      // Allocate payment to invoice
      await storage.createPaymentAllocation(
        payment.id,
        invoiceId as string,
        paidPayment.paymentAmount,
        new Date(paidPayment.paymentDate).toISOString().split("T")[0]
      );

      // Update invoice status if fully paid
      const totalPaid = parseFloat(invoice.paidAmount?.toString() || "0") + paidPayment.paymentAmount;
      if (totalPaid >= parseFloat(invoice.totalAmount.toString())) {
        await storage.updateInvoiceStatus(invoiceId as string, "paid", totalPaid);
      } else {
        await storage.updateInvoiceStatus(invoiceId as string, invoice.status, totalPaid);
      }

      // Auto-posting if enabled
      if (settings.autoPosting) {
        const { postDocument } = await import("./posting-engine");
        try {
          await postDocument(qpayInvoice.tenantId, "payment", payment.id);
        } catch (postError) {
          console.error("Auto-posting failed:", postError);
          // Don't fail the webhook if posting fails
        }
      }

      res.json({
        status: "OK",
        message: "Payment processed successfully",
        paymentId: payment.id
      });
    } catch (err: any) {
      console.error("QPay webhook error:", err);
      res.status(500).json({ message: err.message || "Error processing webhook" });
    }
  });

  // --- Products ---
  app.get("/api/products", requireTenant, async (req: any, res) => {
    const products = await storage.getProducts(req.tenantId);
    res.json(products);
  });

  app.get("/api/products/:id", requireTenant, async (req: any, res) => {
    const product = await storage.getProduct(req.params.id);
    if (!product || product.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  });

  app.post("/api/products", requireTenant, async (req: any, res) => {
    try {
      const input = { ...insertProductSchema.parse(req.body), tenantId: req.tenantId } as DbInsertProduct;
      const product = await storage.createProduct(input);
      res.status(201).json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.put("/api/products/:id", requireTenant, async (req: any, res) => {
    try {
      const existing = await storage.getProduct(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Product not found" });
      }
      const productBefore = existing;
      const input = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, input);

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        "product",
        req.params.id,
        "update",
        productBefore,
        product,
        `Product ${product.sku || product.name} updated`
      );

      res.json(product);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error updating product" });
    }
  });

  // --- Product Categories ---
  app.get("/api/product-categories", requireTenant, async (req: any, res) => {
    const categories = await storage.getProductCategories(req.tenantId);
    res.json(categories);
  });

  app.post("/api/product-categories", requireTenant, async (req: any, res) => {
    try {
      const input = { ...insertProductCategorySchema.parse(req.body), tenantId: req.tenantId } as any;
      const category = await storage.createProductCategory(input);
      res.status(201).json(category);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  // --- Contacts (CRM) ---
  app.get("/api/contacts", requireTenant, async (req: any, res) => {
    const type = req.query.type as string | undefined;
    const contacts = await storage.getContacts(req.tenantId, type);
    res.json(contacts);
  });

  app.get("/api/contacts/:id", requireTenant, async (req: any, res) => {
    const contact = await storage.getContact(req.params.id);
    if (!contact || contact.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Contact not found" });
    }
    res.json(contact);
  });

  app.post("/api/contacts", requireTenant, async (req: any, res) => {
    try {
      const input = { ...insertContactSchema.parse(req.body), tenantId: req.tenantId } as DbInsertContact;
      const contact = await storage.createContact(input);
      res.status(201).json(contact);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.put("/api/contacts/:id", requireTenant, async (req: any, res) => {
    try {
      const existing = await storage.getContact(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const input = insertContactSchema.partial().parse(req.body);
      const contact = await storage.updateContact(req.params.id, input);
      res.json(contact);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error updating contact" });
    }
  });

  // --- Warehouses ---
  app.get("/api/warehouses", requireTenant, async (req: any, res) => {
    const warehouses = await storage.getWarehouses(req.tenantId);
    res.json(warehouses);
  });

  app.post("/api/warehouses", requireTenant, async (req: any, res) => {
    try {
      const input = { ...insertWarehouseSchema.parse(req.body), tenantId: req.tenantId } as DbInsertWarehouse;
      const warehouse = await storage.createWarehouse(input);
      res.status(201).json(warehouse);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  // --- Stock Levels ---
  app.get("/api/stock-levels", requireTenant, async (req: any, res) => {
    const warehouseId = req.query.warehouseId as string | undefined;
    const levels = await storage.getStockLevels(req.tenantId, warehouseId);
    res.json(levels);
  });

  // --- Stock Movements ---
  app.get("/api/stock/movements", requireTenant, async (req: any, res) => {
    try {
      const movements = await storage.getStockMovements(
        req.tenantId,
        req.query.warehouseId,
        req.query.productId
      );
      res.json(movements);
    } catch (err: any) {
      console.error("Stock movements error:", err);
      res.status(500).json({ message: err.message || "Error fetching stock movements" });
    }
  });

  app.post("/api/stock/movements", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { warehouseId, productId, quantity, type, batchNumber, expiryDate, reference, referenceId, note } = req.body;

      if (!warehouseId || !productId || !quantity || !type) {
        return res.status(400).json({ message: "warehouseId, productId, quantity, and type are required" });
      }

      // Validate product trackExpiry
      const product = await storage.getProduct(productId);
      if (!product || product.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (type === "out" && (product as any).trackExpiry) {
        if (!batchNumber) {
          return res.status(400).json({ message: "Batch number is required for products with expiry tracking" });
        }
        if (!expiryDate) {
          return res.status(400).json({ message: "Expiry date is required for products with expiry tracking" });
        }
      }

      // Validate expiry date is not in the future
      if (expiryDate) {
        const expiry = new Date(expiryDate);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (expiry > today) {
          return res.status(400).json({ message: "Expiry date cannot be in the future" });
        }
      }

      await storage.updateStock(
        req.tenantId,
        warehouseId,
        productId,
        Number(quantity),
        type,
        reference,
        referenceId,
        batchNumber || null,
        expiryDate || null
      );

      res.status(201).json({ message: "Stock movement created successfully" });
    } catch (err: any) {
      console.error("Stock movement creation error:", err);
      if (err.message.includes("required")) {
        res.status(400).json({ message: err.message });
      } else {
        res.status(500).json({ message: err.message || "Error creating stock movement" });
      }
    }
  });

  // --- Expiry Alerts ---
  app.get("/api/stock/expiry-alerts", requireTenant, async (req: any, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days) : 30;
      const warehouseId = req.query.warehouseId;

      const alerts = await storage.getExpiryAlerts(req.tenantId, days, warehouseId);
      res.json(alerts);
    } catch (err: any) {
      console.error("Expiry alerts error:", err);
      res.status(500).json({ message: err.message || "Error fetching expiry alerts" });
    }
  });

  // FEFO Auto-Suggest API
  app.get("/api/stock/fefo-suggest", requireTenant, async (req: any, res) => {
    try {
      const { productId, warehouseId, quantity } = req.query;

      if (!productId || !warehouseId) {
        return res.status(400).json({ message: "productId and warehouseId are required" });
      }

      const suggestions = await storage.getFEFOSuggest(
        req.tenantId,
        productId,
        warehouseId,
        Number(quantity) || 0
      );
      res.json(suggestions);
    } catch (err: any) {
      console.error("FEFO suggest error:", err);
      res.status(500).json({ message: err.message || "Error fetching FEFO suggestions" });
    }
  });

  app.get("/api/inventory/stats", requireTenant, async (req: any, res) => {
    try {
      const stats = await storage.getInventoryStats(req.tenantId);
      res.json(stats);
    } catch (err: any) {
      console.error("Inventory Stats error:", err);
      res.status(500).json({ message: err.message || "Error calculating inventory stats" });
    }
  });

  app.post("/api/inventory/bulk-actions", requireTenant, async (req: any, res) => {
    try {
      const { action, ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs required" });
      }

      if (action === "delete") {
        await storage.bulkDeleteStockLevels(req.tenantId, ids);
      } else if (action === "reset") {
        await storage.bulkResetStockLevels(req.tenantId, ids);
      } else {
        return res.status(400).json({ message: "Invalid action" });
      }

      res.json({ success: true, count: ids.length });
    } catch (err: any) {
      console.error("Inventory Bulk Action error:", err);
      res.status(500).json({ message: err.message || "Bulk action failed" });
    }
  });

  // --- Sales Orders ---
  app.get("/api/sales-orders", requireTenant, async (req: any, res) => {
    const orders = await storage.getSalesOrders(req.tenantId);
    res.json(orders);
  });

  app.get("/api/sales-orders/:id", requireTenant, async (req: any, res) => {
    const order = await storage.getSalesOrder(req.params.id);
    if (!order || order.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Sales order not found" });
    }
    res.json(order);
  });

  const salesOrderSchema = z.object({
    customerId: z.string(),
    branchId: z.string().optional(),
    warehouseId: z.string().optional(),
    orderDate: z.string(),
    deliveryDate: z.string().optional().transform(val => val === "" ? undefined : val), // Empty string → undefined for optional date
    notes: z.string().optional(),
    lines: z.array(z.object({
      productId: z.string(),
      quantity: z.number().or(z.string()),
      unitPrice: z.number().or(z.string()),
      discount: z.number().or(z.string()).optional(),
      taxRate: z.number().or(z.string()).optional(),
      description: z.string().optional()
    }))
  });

  app.post("/api/sales-orders", requireTenant, async (req: any, res) => {
    try {
      const data = salesOrderSchema.parse(req.body);

      // Generate order number
      const orderCount = (await storage.getSalesOrders(req.tenantId)).length;
      const orderNumber = `SO-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`;

      // Calculate totals
      let subtotal = 0;
      const lines: Omit<DbInsertSalesOrderLine, 'salesOrderId'>[] = data.lines.map((line: any) => {
        const qty = Number(line.quantity);
        const price = Number(line.unitPrice);
        const discount = Number(line.discount || 0);
        const taxRate = Number(line.taxRate || 10);

        const lineSubtotal = qty * price * (1 - discount / 100);
        const lineTax = lineSubtotal * (taxRate / 100);
        const lineTotal = lineSubtotal + lineTax;

        subtotal += lineSubtotal;

        return {
          tenantId: req.tenantId,
          productId: line.productId,
          quantity: qty.toString(),
          unitPrice: price.toString(),
          discount: discount.toString(),
          taxRate: taxRate.toString(),
          subtotal: lineSubtotal.toString(),
          taxAmount: lineTax.toString(),
          total: lineTotal.toString(),
          description: line.description
        };
      });

      const taxAmount = subtotal * 0.1; // 10% ХХОАТ
      const totalAmount = subtotal + taxAmount;

      const order = await storage.createSalesOrder({
        tenantId: req.tenantId,
        branchId: data.branchId || undefined,
        warehouseId: data.warehouseId || undefined,
        customerId: data.customerId,
        orderNumber,
        orderDate: data.orderDate,
        deliveryDate: data.deliveryDate || undefined, // Convert empty string to undefined for optional date field
        status: "draft",
        paymentStatus: "unpaid",
        subtotal: subtotal.toString(),
        taxAmount: taxAmount.toString(),
        discountAmount: "0",
        totalAmount: totalAmount.toString(),
        notes: data.notes,
        createdBy: req.user.id
      } as DbInsertSalesOrder, lines);

      res.status(201).json(order);
    } catch (err) {
      console.error("Sales Order Error:", err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  // Get single sales order with details (for drawer view)
  app.get("/api/sales-orders/:id", requireTenant, async (req: any, res) => {
    try {
      const order = await storage.getSalesOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "Sales order not found" });
      }
      // Verify tenant access
      if (order.tenantId !== req.tenantId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json(order);
    } catch (err) {
      console.error("Get Sales Order Error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });


  // --- Sales Stats (for KPI cards) ---
  app.get("/api/sales/stats", requireTenant, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;

      // Calculate this month's date range
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // Get all sales orders
      const orders = await storage.getSalesOrders(req.tenantId);

      // Calculate this month's confirmed sales
      const thisMonthSales = orders
        .filter(o =>
          o.status === 'confirmed' &&
          o.orderDate >= thisMonthStart &&
          o.orderDate <= thisMonthEnd
        )
        .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

      // Get AR outstanding from sales invoices
      const invoices = await storage.getInvoices(req.tenantId, 'sales');
      const arOutstanding = invoices
        .filter(inv => inv.status !== 'paid')
        .reduce((sum, inv) => {
          const total = Number(inv.totalAmount || 0);
          const paid = Number(inv.paidAmount || 0);
          return sum + (total - paid);
        }, 0);

      // Filter orders by date range if provided
      const filteredOrders = startDate && endDate
        ? orders.filter(o => o.orderDate >= startDate && o.orderDate <= endDate)
        : orders;

      res.json({
        thisMonthSales: Math.max(0, thisMonthSales),
        arOutstanding: Math.max(0, arOutstanding),
        totalOrders: filteredOrders.length,
      });
    } catch (err: any) {
      console.error("Sales stats error:", err);
      res.status(500).json({ message: err.message || "Error fetching sales stats" });
    }
  });

  // Bulk cancel orders
  app.post("/api/sales-orders/bulk-cancel", requireTenant, async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const result = await storage.bulkCancelOrders(ids, req.tenantId);
      res.json({
        success: true,
        updated: result.updated,
        errors: result.errors,
        message: `${result.updated} захиалга цуцлагдлаа`
      });
    } catch (err: any) {
      console.error("Bulk cancel error:", err);
      res.status(500).json({ message: err.message || "Bulk cancel failed" });
    }
  });

  // Bulk delete draft orders
  app.post("/api/sales-orders/bulk-delete", requireTenant, async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const result = await storage.bulkDeleteDraftOrders(ids, req.tenantId);
      if (result.errors.length > 0 && result.deleted === 0) {
        return res.status(400).json({ message: "Алдаа гарлаа", errors: result.errors });
      }
      res.json({
        success: true,
        deleted: result.deleted,
        errors: result.errors,
        message: `${result.deleted} ноорог захиалга устгагдлаа`
      });
    } catch (err: any) {
      console.error("Bulk delete error:", err);
      res.status(500).json({ message: err.message || "Bulk delete failed" });
    }
  });

  // --- Purchase Stats (for KPI cards) ---
  app.get("/api/purchase/stats", requireTenant, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;

      // Calculate this month's date range
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // Get all purchase orders
      const orders = await storage.getPurchaseOrders(req.tenantId);

      // Calculate this month's spend (confirmed orders)
      const thisMonthSpend = orders
        .filter(o =>
          (o.status === 'confirmed' || o.status === 'received') &&
          o.orderDate >= thisMonthStart &&
          o.orderDate <= thisMonthEnd
        )
        .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

      // Calculate pending deliveries (confirmed but not fully received)
      // For now, we count 'confirmed' status as pending delivery
      const pendingDelivery = orders
        .filter(o => o.status === 'confirmed')
        .length;

      // Get overdue bills (unpaid invoices)
      // We look at purchase invoices that are not paid
      const invoices = await storage.getInvoices(req.tenantId, 'purchase');
      const overdueBills = invoices
        .filter(inv => inv.status !== 'paid')
        .reduce((sum, inv) => {
          const total = Number(inv.totalAmount || 0);
          const paid = Number(inv.paidAmount || 0);
          return sum + (total - paid);
        }, 0);

      res.json({
        thisMonthSpend: Math.max(0, thisMonthSpend),
        pendingDelivery: Math.max(0, pendingDelivery),
        overdueBills: Math.max(0, overdueBills),
      });
    } catch (err: any) {
      console.error("Purchase stats error:", err);
      res.status(500).json({ message: err.message || "Error fetching purchase stats" });
    }
  });

  // --- Purchase Orders ---
  app.get("/api/purchase-orders", requireTenant, async (req: any, res) => {
    const orders = await storage.getPurchaseOrders(req.tenantId);
    res.json(orders);
  });

  app.get("/api/purchase-orders/:id", requireTenant, async (req: any, res) => {
    const order = await storage.getPurchaseOrder(req.params.id);
    if (!order || order.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Purchase order not found" });
    }
    res.json(order);
  });

  const purchaseOrderSchema = z.object({
    supplierId: z.string(),
    branchId: z.string().optional(),
    warehouseId: z.string().optional(),
    orderDate: z.string(),
    expectedDate: z.string().optional().transform(val => val === "" ? undefined : val),
    notes: z.string().optional(),
    lines: z.array(z.object({
      productId: z.string(),
      quantity: z.number().or(z.string()),
      unitPrice: z.number().or(z.string()),
      discount: z.number().or(z.string()).optional(),
      taxRate: z.number().or(z.string()).optional(),
      description: z.string().optional()
    }))
  });

  app.post("/api/purchase-orders", requireTenant, async (req: any, res) => {
    try {
      const data = purchaseOrderSchema.parse(req.body);

      const orderCount = (await storage.getPurchaseOrders(req.tenantId)).length;
      const orderNumber = `PO-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`;

      let subtotal = 0;
      const lines: Omit<DbInsertPurchaseOrderLine, 'purchaseOrderId'>[] = data.lines.map((line: any) => {
        const qty = Number(line.quantity);
        const price = Number(line.unitPrice);
        const discount = Number(line.discount || 0);
        const taxRate = Number(line.taxRate || 10);

        const lineSubtotal = qty * price * (1 - discount / 100);
        const lineTax = lineSubtotal * (taxRate / 100);
        const lineTotal = lineSubtotal + lineTax;

        subtotal += lineSubtotal;

        return {
          tenantId: req.tenantId,
          productId: line.productId,
          quantity: qty.toString(),
          unitPrice: price.toString(),
          discount: discount.toString(),
          taxRate: taxRate.toString(),
          subtotal: lineSubtotal.toString(),
          taxAmount: lineTax.toString(),
          total: lineTotal.toString(),
          description: line.description
        };
      });

      const taxAmount = subtotal * 0.1;
      const totalAmount = subtotal + taxAmount;

      const order = await storage.createPurchaseOrder({
        tenantId: req.tenantId,
        branchId: data.branchId,
        warehouseId: data.warehouseId,
        supplierId: data.supplierId,
        orderNumber,
        orderDate: data.orderDate,
        expectedDate: data.expectedDate || undefined,
        status: "draft",
        paymentStatus: "unpaid",
        subtotal: subtotal.toString(),
        taxAmount: taxAmount.toString(),
        discountAmount: "0",
        totalAmount: totalAmount.toString(),
        notes: data.notes,
        createdBy: req.user.id
      } as DbInsertPurchaseOrder, lines);

      res.status(201).json(order);
    } catch (err) {
      console.error("Purchase Order Error:", err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.post("/api/purchase-orders/bulk-delete", requireTenant, async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const result = await storage.bulkDeleteDraftPurchaseOrders(ids, req.tenantId);
      if (result.errors.length > 0 && result.deleted === 0) {
        return res.status(400).json({ message: "Алдаа гарлаа", errors: result.errors });
      }
      res.json({
        success: true,
        deleted: result.deleted,
        errors: result.errors,
        message: `${result.deleted} ноорог захиалга устгагдлаа`
      });
    } catch (err: any) {
      console.error("Bulk delete error:", err);
      res.status(500).json({ message: err.message || "Bulk delete failed" });
    }
  });

  // --- Invoices ---
  app.get("/api/invoices", requireTenant, async (req: any, res) => {
    const type = req.query.type as string | undefined;
    const invoices = await storage.getInvoices(req.tenantId, type);
    res.json(invoices);
  });

  // Get unpaid invoices (for reconciliation matching) - MUST be before /:id route
  app.get("/api/invoices/unpaid", requireTenant, async (req: any, res) => {
    try {
      const type = req.query.type as string | undefined; // 'sales' or 'purchase'
      const invoices = await storage.getUnpaidInvoices(req.tenantId, type);
      res.json(invoices);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching unpaid invoices" });
    }
  });

  app.get("/api/invoices/:id", requireTenant, async (req: any, res) => {
    const invoice = await storage.getInvoice(req.params.id);
    if (!invoice || invoice.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Invoice not found" });
    }
    res.json(invoice);
  });

  const invoiceSchema = z.object({
    contactId: z.string(),
    salesOrderId: z.string().optional(),
    branchId: z.string().optional(),
    invoiceDate: z.string(),
    dueDate: z.string(),
    type: z.enum(["sales", "purchase"]).default("sales"),
    paymentMethod: z.string().optional(),
    notes: z.string().optional(),
    lines: z.array(z.object({
      productId: z.string().optional(),
      description: z.string(),
      quantity: z.number().or(z.string()),
      unitPrice: z.number().or(z.string()),
      taxRate: z.number().or(z.string()).optional()
    }))
  });

  app.post("/api/invoices", requireTenantAndPermission, async (req: any, res) => {
    try {
      const data = invoiceSchema.parse(req.body);

      // Use concurrency-safe numbering
      const { getNextInvoiceNumber } = await import("./numbering");
      const invoiceDate = new Date(data.invoiceDate);
      const invoiceNumber = await getNextInvoiceNumber(
        req.tenantId,
        data.branchId || null,
        invoiceDate.getFullYear()
      );

      let subtotal = 0;
      const lines: Omit<DbInsertInvoiceLine, 'invoiceId'>[] = data.lines.map((line: any) => {
        const qty = Number(line.quantity);
        const price = Number(line.unitPrice);
        const taxRate = Number(line.taxRate || 10);

        const lineSubtotal = qty * price;
        const lineTax = lineSubtotal * (taxRate / 100);
        const lineTotal = lineSubtotal + lineTax;

        subtotal += lineSubtotal;

        return {
          tenantId: req.tenantId,
          productId: line.productId,
          description: line.description,
          quantity: qty.toString(),
          unitPrice: price.toString(),
          taxRate: taxRate.toString(),
          subtotal: lineSubtotal.toString(),
          taxAmount: lineTax.toString(),
          total: lineTotal.toString()
        };
      });

      const taxAmount = subtotal * 0.1;
      const totalAmount = subtotal + taxAmount;

      const invoice = await storage.createInvoice({
        tenantId: req.tenantId,
        branchId: data.branchId,
        contactId: data.contactId,
        salesOrderId: data.salesOrderId,
        invoiceNumber,
        invoiceDate: data.invoiceDate,
        dueDate: data.dueDate,
        type: data.type,
        status: "draft",
        subtotal: subtotal.toString(),
        taxAmount: taxAmount.toString(),
        totalAmount: totalAmount.toString(),
        paidAmount: "0",
        paymentMethod: data.paymentMethod,
        notes: data.notes,
        createdBy: req.user.id
      } as DbInsertInvoice, lines);

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        "invoice",
        invoice.id,
        "create",
        undefined,
        invoice,
        `Invoice ${invoiceNumber} created`
      );

      res.status(201).json(invoice);
    } catch (err) {
      console.error("Invoice Error:", err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.put("/api/invoices/:id/status", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { status, paidAmount } = req.body;
      const invoiceId = req.params.id;

      // Get invoice before update to check if it's becoming "paid"
      const invoiceBefore = await storage.getInvoice(invoiceId);
      const wasPaid = invoiceBefore?.status === "paid";

      await storage.updateInvoiceStatus(invoiceId, status, paidAmount);

      // Auto-send to E-barimt if status changed to "paid" and auto_send is enabled
      if (status === "paid" && !wasPaid) {
        try {
          const ebarimtSettings = await storage.getEBarimtSettings(req.tenantId);

          if (ebarimtSettings?.enabled && ebarimtSettings?.autoSend) {
            // Create E-barimt service and send invoice
            const { createEBarimtService } = await import("./ebarimt-service");
            const ebarimtService = await createEBarimtService(req.tenantId, storage);

            if (ebarimtService && ebarimtService.isConfigured()) {
              // Check if already sent
              const invoiceForEbarimt = await storage.getInvoice(invoiceId);
              if (!invoiceForEbarimt?.ebarimtDocumentId) {
                const invoiceData = await ebarimtService.prepareInvoiceData(invoiceId, req.tenantId);
                const result = await ebarimtService.sendInvoice(invoiceData);

                if (result.success) {
                  await storage.updateInvoiceEBarimt(
                    invoiceId,
                    result.documentId || "",
                    result.qrCode,
                    result.receiptNumber,
                    result.lotteryNumber
                  );
                  console.log(`✅ Auto-sent invoice ${invoiceId} to E-barimt`);
                } else {
                  console.warn(`⚠️  Failed to auto-send invoice ${invoiceId} to E-barimt:`, result.error);
                }
              }
            }
          }
        } catch (ebarimtError: any) {
          // Don't fail the status update if E-barimt fails
          console.error("E-barimt auto-send error:", ebarimtError);
        }
      }

      // Audit log (after all updates)
      const invoiceAfterUpdate = await storage.getInvoice(invoiceId);
      await createAuditLog(
        getAuditContext(req),
        "invoice",
        invoiceId,
        "update",
        invoiceBefore,
        invoiceAfterUpdate,
        `Invoice status changed to ${status}`
      );

      res.json({ message: "Invoice status updated" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error updating invoice status" });
    }
  });

  app.delete("/api/invoices/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
      const invoiceId = req.params.id;
      const invoice = await storage.getInvoice(invoiceId);

      if (!invoice || invoice.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (invoice.status !== "draft") {
        return res.status(400).json({ message: "Only draft invoices can be deleted. Use Void for active invoices." });
      }

      await storage.deleteInvoice(invoiceId);

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        "invoice",
        invoiceId,
        "delete",
        invoice,
        null,
        `Invoice ${invoice.invoiceNumber} deleted`
      );

      res.status(204).send();
    } catch (err: any) {
      console.error("Delete invoice error:", err);
      res.status(500).json({ message: err.message || "Error deleting invoice" });
    }
  });

  // ==========================================
  // E-BARIMT INTEGRATION (QPay-тэй ижил загвар)
  // ==========================================

  // --- E-barimt Settings ---
  app.get("/api/ebarimt/settings", requireTenant, async (req: any, res) => {
    try {
      const settings = await storage.getEBarimtSettings(req.tenantId);
      if (!settings) {
        return res.json({
          enabled: false,
          mode: "sandbox",
          posEndpoint: null,
          apiKey: null,
          apiSecret: null,
          autoSend: false,
        });
      }
      // Mask secrets in response
      const response = { ...settings };
      if (response.apiSecret) response.apiSecret = "********";
      res.json(response);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching E-barimt settings" });
    }
  });

  app.put("/api/ebarimt/settings", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { apiSecret, ...rest } = req.body;
      const existing = await storage.getEBarimtSettings(req.tenantId);

      // Only update secret if provided (not masked)
      const updateData: any = { ...rest };
      if (apiSecret && apiSecret !== "********") {
        updateData.apiSecret = apiSecret;
      } else if (existing && apiSecret === "********") {
        updateData.apiSecret = existing.apiSecret;
      }

      const settings = await storage.updateEBarimtSettings(req.tenantId, updateData);
      const response = { ...settings };
      if (response.apiSecret) response.apiSecret = "********";
      res.json(response);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error updating E-barimt settings" });
    }
  });

  // --- E-barimt Send Invoice ---
  app.post("/api/invoices/:id/ebarimt", requireTenantAndPermission, async (req: any, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice || invoice.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      // Get E-barimt settings
      const settings = await storage.getEBarimtSettings(req.tenantId);
      if (!settings || !settings.enabled) {
        return res.status(400).json({ message: "E-barimt is not enabled" });
      }

      // Create E-barimt service with provider
      const { createEBarimtService, EBarimtService } = await import("./ebarimt-service");
      const ebarimtService = await createEBarimtService(req.tenantId, storage);

      if (!ebarimtService || !ebarimtService.isConfigured()) {
        return res.status(400).json({
          message: "E-barimt service is not configured. Please configure in Settings."
        });
      }

      // Prepare invoice data
      const invoiceData = await ebarimtService.prepareInvoiceData(req.params.id, req.tenantId);

      // Send to E-barimt using provider
      const result = await ebarimtService.sendInvoice(invoiceData);

      if (!result.success) {
        return res.status(500).json({
          message: result.error || "Failed to send invoice to E-barimt",
          errorCode: result.errorCode
        });
      }

      // Store E-barimt document ID in invoice table
      await storage.updateInvoiceEBarimt(
        req.params.id,
        result.documentId || "",
        result.qrCode,
        result.receiptNumber,
        result.lotteryNumber
      );

      res.json({
        success: true,
        documentId: result.documentId,
        qrCode: result.qrCode,
        receiptNumber: result.receiptNumber,
        lotteryNumber: result.lotteryNumber,
        message: "Invoice successfully sent to E-barimt",
      });
    } catch (err: any) {
      console.error("E-barimt error:", err);
      res.status(500).json({ message: err.message || "Error sending invoice to E-barimt" });
    }
  });

  // E-barimt Verify
  app.get("/api/invoices/:id/ebarimt/verify", requireTenant, async (req: any, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice || invoice.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      const { createEBarimtService } = await import("./ebarimt-service");
      const ebarimtService = await createEBarimtService(req.tenantId, storage);

      if (!ebarimtService || !ebarimtService.isConfigured()) {
        return res.status(400).json({ message: "E-barimt service is not configured" });
      }

      // Get document ID from invoice
      const documentId = invoice.ebarimtDocumentId || (req.query.documentId as string);
      if (!documentId) {
        return res.status(400).json({ message: "Document ID is required. Invoice has not been sent to E-barimt." });
      }

      const result = await ebarimtService.verifyInvoice(documentId);
      res.json(result);
    } catch (err: any) {
      console.error("E-barimt verify error:", err);
      res.status(500).json({ message: err.message || "Error verifying invoice" });
    }
  });

  // --- Padan PDF Endpoints ---
  // Generate Dispatch Padan PDF (Зарлагын Падан) for Sales Invoice
  // RBAC: Invoice read/view permission required (Sales, Accounting, Warehouse, Admin roles)
  // Note: For read operations, we allow if user has invoice.read OR invoice.view OR is Admin/Sales/Accounting/Warehouse role
  app.get("/api/invoices/:id/padan/dispatch",
    requireTenant,
    requirePermission("invoice", "read"),
    async (req: any, res) => {
      try {
        const invoice = await storage.getInvoice(req.params.id);
        if (!invoice || invoice.tenantId !== req.tenantId) {
          return res.status(404).json({ message: "Invoice not found" });
        }

        if (invoice.type !== "sales") {
          return res.status(400).json({ message: "Dispatch Padan can only be generated for sales invoices" });
        }

        // Invoice state check: Allow padan generation for any status (including draft)
        // Policy: User can generate padan anytime, but can mark as "draft" in padan if needed

        // Get tenant info
        const tenant = await storage.getTenant(req.tenantId);
        if (!tenant) {
          return res.status(404).json({ message: "Tenant not found" });
        }

        // Get contact info
        const contact = await storage.getContact(invoice.contactId);

        // Get warehouse and branch info (if available)
        let warehouseName: string | undefined;
        let branchName: string | undefined;

        // Get warehouse from sales order (if invoice is from sales order)
        if (invoice.salesOrderId) {
          const salesOrder = await storage.getSalesOrder(invoice.salesOrderId);
          if (salesOrder?.warehouseId) {
            const warehouses = await storage.getWarehouses(req.tenantId);
            const warehouse = warehouses.find((w: any) => w.id === salesOrder.warehouseId);
            warehouseName = warehouse?.name;
          }
        }

        if (invoice.branchId) {
          const branches = await storage.getBranches(req.tenantId);
          const branch = branches.find((b: any) => b.id === invoice.branchId);
          branchName = branch?.name;
        }

        // Get products for unit info
        const { products } = await import("@shared/schema");
        const { db } = await import("./db");
        const { eq, and, inArray } = await import("drizzle-orm");

        // Fetch product units for invoice lines
        const productIds = (invoice.lines || [])
          .map((line: any) => line.productId)
          .filter((id: string | null) => id !== null);

        const productUnits: Record<string, string> = {};
        if (productIds.length > 0) {
          const productRows = await db
            .select({ id: products.id, unit: products.unit })
            .from(products)
            .where(inArray(products.id, productIds));
          productRows.forEach((p: any) => {
            productUnits[p.id] = p.unit || "Ширхэг";
          });
        }

        // Get or generate Padan number (idempotent)
        const { getOrGeneratePadanNumber } = await import("./padan-numbering");
        const padanNumber = await getOrGeneratePadanNumber(
          req.tenantId,
          invoice.id,
          "sales",
          "DISPATCH"
        );

        // Prepare Padan PDF data
        // Handle missing address fields gracefully (for backwards compatibility)
        const tenantAddress = (tenant as any).address;
        const tenantDistrict = (tenant as any).district;
        const tenantCity = (tenant as any).city;
        const companyAddress = tenantAddress
          ? `${tenantCity || "Улаанбаатар"}, ${tenantDistrict || ""} дүүрэг, ${tenantAddress}`
          : undefined;

        const padanData = {
          padanNumber: padanNumber,
          padanDate: invoice.invoiceDate || new Date().toISOString().split("T")[0],
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate || "",
          companyName: tenant.legalName || tenant.name,
          companyAddress: companyAddress,
          companyRegNo: tenant.regNo || undefined,
          companyVatNo: tenant.vatNo || undefined,
          contactName: invoice.contactName || contact?.companyName || `${contact?.firstName || ""} ${contact?.lastName || ""}`.trim(),
          contactAddress: contact?.address || undefined,
          contactRegNo: contact?.regNo || undefined,
          contactVatNo: contact?.vatNo || undefined,
          lines: (invoice.lines || []).map((line: any) => {
            const unit = line.productId && productUnits[line.productId] ? productUnits[line.productId] : "Ширхэг";
            return {
              description: line.description || "",
              quantity: parseFloat(line.quantity?.toString() || "0"),
              unit: unit,
              unitPrice: parseFloat(line.unitPrice?.toString() || "0"),
              total: parseFloat(line.total?.toString() || "0"),
            };
          }),
          totalAmount: parseFloat(invoice.totalAmount?.toString() || "0"),
          warehouseName: warehouseName,
          branchName: branchName,
          notes: invoice.notes || undefined,
        };

        // Audit log: Padan generated
        await createAuditLog(
          getAuditContext(req),
          "padan",
          req.params.id,
          "create",
          null,
          {
            type: "dispatch",
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            padanNumber: padanData.padanNumber,
          },
          `Dispatch Padan generated for invoice ${invoice.invoiceNumber}`
        );

        // Return Padan data for client-side PDF generation
        res.json({
          success: true,
          padanData,
          type: "dispatch",
        });
      } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error generating Padan data" });
      }
    });

  // Generate Receipt Padan PDF (Орлогын Падан) for Purchase Invoice
  // RBAC: Invoice read/view permission required (Sales, Accounting, Warehouse, Admin roles)
  app.get("/api/invoices/:id/padan/receipt",
    requireTenant,
    requirePermission("invoice", "read"),
    async (req: any, res) => {
      try {
        const invoice = await storage.getInvoice(req.params.id);
        if (!invoice || invoice.tenantId !== req.tenantId) {
          return res.status(404).json({ message: "Invoice not found" });
        }

        if (invoice.type !== "purchase") {
          return res.status(400).json({ message: "Receipt Padan can only be generated for purchase invoices" });
        }

        // Get tenant info
        const tenant = await storage.getTenant(req.tenantId);
        if (!tenant) {
          return res.status(404).json({ message: "Tenant not found" });
        }

        // Get contact info
        const contact = await storage.getContact(invoice.contactId);

        // Get warehouse and branch info (if available)
        let warehouseName: string | undefined;
        let branchName: string | undefined;

        // Get warehouse from sales order (if invoice is from sales order)
        if (invoice.salesOrderId) {
          const salesOrder = await storage.getSalesOrder(invoice.salesOrderId);
          if (salesOrder?.warehouseId) {
            const warehouses = await storage.getWarehouses(req.tenantId);
            const warehouse = warehouses.find((w: any) => w.id === salesOrder.warehouseId);
            warehouseName = warehouse?.name;
          }
        }

        if (invoice.branchId) {
          const branches = await storage.getBranches(req.tenantId);
          const branch = branches.find((b: any) => b.id === invoice.branchId);
          branchName = branch?.name;
        }

        // Get products for unit info
        const { products } = await import("@shared/schema");
        const { db } = await import("./db");
        const { inArray } = await import("drizzle-orm");

        // Fetch product units for invoice lines
        const productIds = (invoice.lines || [])
          .map((line: any) => line.productId)
          .filter((id: string | null) => id !== null);

        const productUnits: Record<string, string> = {};
        if (productIds.length > 0) {
          const productRows = await db
            .select({ id: products.id, unit: products.unit })
            .from(products)
            .where(inArray(products.id, productIds));
          productRows.forEach((p: any) => {
            productUnits[p.id] = p.unit || "Ширхэг";
          });
        }

        // Get or generate Padan number (idempotent)
        const { getOrGeneratePadanNumber } = await import("./padan-numbering");
        const padanNumber = await getOrGeneratePadanNumber(
          req.tenantId,
          invoice.id,
          "purchase",
          "RECEIPT"
        );

        // Prepare Padan PDF data
        // Handle missing address fields gracefully (for backwards compatibility)
        const tenantAddress = (tenant as any).address;
        const tenantDistrict = (tenant as any).district;
        const tenantCity = (tenant as any).city;
        const companyAddress = tenantAddress
          ? `${tenantCity || "Улаанбаатар"}, ${tenantDistrict || ""} дүүрэг, ${tenantAddress}`
          : undefined;

        const padanData = {
          padanNumber: padanNumber,
          padanDate: invoice.invoiceDate || new Date().toISOString().split("T")[0],
          invoiceNumber: invoice.invoiceNumber,
          invoiceDate: invoice.invoiceDate || "",
          companyName: tenant.legalName || tenant.name,
          companyAddress: companyAddress,
          companyRegNo: tenant.regNo || undefined,
          companyVatNo: tenant.vatNo || undefined,
          contactName: invoice.contactName || contact?.companyName || `${contact?.firstName || ""} ${contact?.lastName || ""}`.trim(),
          contactAddress: contact?.address || undefined,
          contactRegNo: contact?.regNo || undefined,
          contactVatNo: contact?.vatNo || undefined,
          lines: (invoice.lines || []).map((line: any) => {
            const unit = line.productId && productUnits[line.productId] ? productUnits[line.productId] : "Ширхэг";
            return {
              description: line.description || "",
              quantity: parseFloat(line.quantity?.toString() || "0"),
              unit: unit,
              unitPrice: parseFloat(line.unitPrice?.toString() || "0"),
              total: parseFloat(line.total?.toString() || "0"),
            };
          }),
          totalAmount: parseFloat(invoice.totalAmount?.toString() || "0"),
          warehouseName: warehouseName,
          branchName: branchName,
          notes: invoice.notes || undefined,
        };

        // Audit log: Padan generated
        await createAuditLog(
          getAuditContext(req),
          "padan",
          req.params.id,
          "create",
          null,
          {
            type: "receipt",
            invoiceId: invoice.id,
            invoiceNumber: invoice.invoiceNumber,
            padanNumber: padanData.padanNumber,
          },
          `Receipt Padan generated for invoice ${invoice.invoiceNumber}`
        );

        // Return Padan data for client-side PDF generation
        res.json({
          success: true,
          padanData,
          type: "receipt",
        });
      } catch (err: any) {
        console.error(err);
        res.status(500).json({ message: err.message || "Error generating Padan data" });
      }
    });

  // Odoo-style workflow endpoints
  app.put("/api/sales-orders/:id/confirm", requireTenant, async (req: any, res) => {
    try {
      await storage.updateSalesOrderStatus(req.params.id, "confirmed");
      res.json({ message: "Sales order confirmed" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error confirming sales order" });
    }
  });

  app.put("/api/sales-orders/:id/send", requireTenant, async (req: any, res) => {
    try {
      await storage.updateSalesOrderStatus(req.params.id, "sent");
      res.json({ message: "Sales order sent" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error sending sales order" });
    }
  });

  app.post("/api/sales-orders/:id/create-invoice", requireTenant, async (req: any, res) => {
    try {
      const invoice = await storage.createInvoiceFromSalesOrder(req.params.id);
      res.status(201).json(invoice);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error creating invoice from sales order" });
    }
  });

  app.put("/api/purchase-orders/:id/confirm", requireTenant, async (req: any, res) => {
    try {
      await storage.updatePurchaseOrderStatus(req.params.id, "confirmed");
      res.json({ message: "Purchase order confirmed" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error confirming purchase order" });
    }
  });

  app.put("/api/purchase-orders/:id/receive", requireTenant, async (req: any, res) => {
    try {
      await storage.updatePurchaseOrderStatus(req.params.id, "received");
      res.json({ message: "Purchase order received, stock updated" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error receiving purchase order" });
    }
  });

  // ==========================================
  // ACCOUNTING API ENDPOINTS
  // ==========================================

  // --- Currencies ---
  app.get("/api/currencies", requireTenant, async (req: any, res) => {
    const currencies = await storage.getCurrencies(req.tenantId);
    res.json(currencies);
  });

  app.post("/api/currencies", requireTenant, async (req: any, res) => {
    try {
      const input = { ...insertCurrencySchema.parse(req.body), tenantId: req.tenantId } as DbInsertCurrency;
      const currency = await storage.createCurrency(input);
      res.status(201).json(currency);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  // --- Accounts (Chart of Accounts) ---
  app.get("/api/accounts", requireTenant, async (req: any, res) => {
    const accounts = await storage.getAccounts(req.tenantId);
    res.json(accounts);
  });

  app.get("/api/accounts/:id", requireTenant, async (req: any, res) => {
    const account = await storage.getAccount(req.params.id);
    if (!account || account.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Account not found" });
    }
    res.json(account);
  });

  app.post("/api/accounts", requireTenantAndPermission, async (req: any, res) => {
    try {
      const input = { ...insertAccountSchema.parse(req.body), tenantId: req.tenantId } as DbInsertAccount;
      const account = await storage.createAccount(input);
      res.status(201).json(account);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.put("/api/accounts/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
      const existing = await storage.getAccount(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Account not found" });
      }
      const input = insertAccountSchema.partial().parse(req.body);
      const account = await storage.updateAccount(req.params.id, input);
      res.json(account);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error updating account" });
    }
  });

  // Delete account (with safety check)
  app.delete("/api/accounts/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
      const existing = await storage.getAccount(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Account not found" });
      }

      // Safety check: Check if account is used in journal_lines
      const journalUsage = await db
        .select({ count: sql<number>`count(*)` })
        .from(journalLines)
        .where(eq(journalLines.accountId, req.params.id));

      if (journalUsage[0]?.count > 0) {
        return res.status(400).json({
          message: "Гүйлгээ хийгдсэн дансыг устгах боломжгүй. Түүний оронд идэвхгүй болгоно уу."
        });
      }

      // Safety check: Check if account is used in bank_accounts
      const bankUsage = await db
        .select({ count: sql<number>`count(*)` })
        .from(bankAccounts)
        .where(eq(bankAccounts.accountId, req.params.id));

      if (bankUsage[0]?.count > 0) {
        return res.status(400).json({
          message: "Банкны данстай холбогдсон дансыг устгах боломжгүй. Түүний оронд идэвхгүй болгоно уу."
        });
      }

      // Safe to delete
      await db.delete(accounts).where(eq(accounts.id, req.params.id));
      res.json({ message: "Account deleted successfully" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error deleting account" });
    }
  });

  // --- Journals ---

  app.get("/api/journals", requireTenant, async (req: any, res) => {
    const journals = await storage.getJournals(req.tenantId);
    res.json(journals);
  });

  app.get("/api/journals/:id", requireTenant, async (req: any, res) => {
    const journal = await storage.getJournal(req.params.id);
    if (!journal || journal.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Journal not found" });
    }
    res.json(journal);
  });

  app.post("/api/journals", requireTenant, async (req: any, res) => {
    try {
      const input = { ...insertJournalSchema.parse(req.body), tenantId: req.tenantId } as DbInsertJournal;
      const journal = await storage.createJournal(input);
      res.status(201).json(journal);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  // --- Journal Entries ---
  app.get("/api/journal-entries", requireTenant, async (req: any, res) => {
    const filters = {
      journalId: req.query.journalId as string | undefined,
      status: req.query.status as string | undefined,
      startDate: req.query.startDate as string | undefined,
      endDate: req.query.endDate as string | undefined,
    };
    const entries = await storage.getJournalEntries(req.tenantId, filters);
    res.json(entries);
  });

  app.get("/api/journal-entries/:id", requireTenant, async (req: any, res) => {
    const entry = await storage.getJournalEntry(req.params.id);
    if (!entry || entry.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Journal entry not found" });
    }
    res.json(entry);
  });

  const journalEntrySchema = z.object({
    journalId: z.string().optional(),
    entryDate: z.string(),
    description: z.string().optional(),
    reference: z.string().optional(),
    currencyId: z.string().optional(),
    exchangeRate: z.number().optional(),
    lines: z.array(z.object({
      accountId: z.string(),
      debit: z.number().or(z.string()),
      credit: z.number().or(z.string()),
      amountCurrency: z.number().or(z.string()).optional(),
      currencyId: z.string().optional(),
      currencyRate: z.number().optional(),
      partnerId: z.string().optional(),
      description: z.string().optional(),
      reference: z.string().optional(),
    })).min(1),
  });

  app.post("/api/journal-entries", requireTenantAndPermission, async (req: any, res) => {
    try {
      const data = journalEntrySchema.parse(req.body);

      // Generate entry number (concurrency-safe)
      const { getNextJournalEntryNumber } = await import("./numbering");
      const entryDateObj = new Date(data.entryDate);
      const entryNumber = await getNextJournalEntryNumber(
        req.tenantId,
        null, // branchId
        entryDateObj.getFullYear()
      );

      const entry = await storage.createJournalEntry(
        {
          tenantId: req.tenantId,
          journalId: data.journalId || null,
          entryNumber,
          entryDate: data.entryDate,
          description: data.description || null,
          reference: data.reference || null,
          currencyId: data.currencyId || null,
          exchangeRate: data.exchangeRate?.toString() || "1.0000",
          status: "draft",
          createdBy: req.user?.id || null,
        } as DbInsertJournalEntry,
        data.lines.map((line: any) => ({
          accountId: line.accountId,
          debit: line.debit.toString(),
          credit: line.credit.toString(),
          amountCurrency: line.amountCurrency?.toString() || null,
          currencyId: line.currencyId || null,
          currencyRate: line.currencyRate?.toString() || "1.0000",
          partnerId: line.partnerId || null,
          description: line.description || null,
          reference: line.reference || null,
        })) as DbInsertJournalLine[]
      );

      res.status(201).json(entry);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Error creating journal entry" });
      }
    }
  });

  app.put("/api/journal-entries/:id/post", requireTenantAndPermission, async (req: any, res) => {
    try {
      const entryId = req.params.id;
      const entryBefore = await storage.getJournalEntry(entryId);

      await storage.updateJournalEntryStatus(entryId, "posted", req.user?.id);

      // Audit log
      const entryAfter = await storage.getJournalEntry(entryId);
      await createAuditLog(
        getAuditContext(req),
        "journal_entry",
        entryId,
        "post",
        entryBefore,
        entryAfter,
        `Journal entry ${entryAfter?.entryNumber || entryId} posted`
      );

      res.json({ message: "Journal entry posted" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error posting journal entry" });
    }
  });

  app.post("/api/journal-entries/:id/reverse", requireTenantAndPermission, async (req: any, res) => {
    try {
      const entryId = req.params.id;
      const entryBefore = await storage.getJournalEntry(entryId);
      const { entryDate, description } = req.body;

      const reversal = await storage.reverseJournalEntry(
        entryId,
        entryDate || new Date().toISOString().split("T")[0],
        description,
        req.user?.id || ""
      );

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        "journal_entry",
        entryId,
        "reverse",
        entryBefore,
        { ...entryBefore, reversedByEntryId: reversal.id },
        `Journal entry ${entryBefore?.entryNumber || entryId} reversed`
      );

      res.status(201).json(reversal);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error reversing journal entry" });
    }
  });

  // --- Tax Codes ---
  app.get("/api/tax-codes", requireTenant, async (req: any, res) => {
    const taxCodes = await storage.getTaxCodes(req.tenantId);
    res.json(taxCodes);
  });

  app.post("/api/tax-codes", requireTenantAndPermission, async (req: any, res) => {
    try {
      const input = { ...insertTaxCodeSchema.parse(req.body), tenantId: req.tenantId } as DbInsertTaxCode;
      const taxCode = await storage.createTaxCode(input);
      res.status(201).json(taxCode);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  // --- Payments ---
  app.get("/api/payments", requireTenant, async (req: any, res) => {
    const type = req.query.type as string | undefined;
    const payments = await storage.getPayments(req.tenantId, type);
    res.json(payments);
  });

  app.get("/api/payments/:id", requireTenant, async (req: any, res) => {
    const payment = await storage.getPayment(req.params.id);
    if (!payment || payment.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Payment not found" });
    }
    res.json(payment);
  });

  const paymentSchema = z.object({
    paymentDate: z.string(),
    type: z.enum(["payment", "receipt"]),
    amount: z.number().or(z.string()),
    currencyId: z.string().optional(),
    bankAccountId: z.string().optional(),
    paymentMethod: z.string().optional(),
    reference: z.string().optional(),
  });

  app.post("/api/payments", requireTenantAndPermission, async (req: any, res) => {
    try {
      const data = paymentSchema.parse(req.body);

      // Generate payment number
      const paymentCount = (await storage.getPayments(req.tenantId)).length;
      const paymentNumber = `PAY-${new Date().getFullYear()}-${String(paymentCount + 1).padStart(4, '0')}`;

      const payment = await storage.createPayment({
        tenantId: req.tenantId,
        paymentNumber,
        paymentDate: data.paymentDate,
        type: data.type,
        amount: data.amount.toString(),
        currencyId: data.currencyId || null,
        bankAccountId: data.bankAccountId || null,
        paymentMethod: data.paymentMethod || null,
        status: "draft",
        reference: data.reference || null,
        createdBy: req.user?.id || null,
      } as DbInsertPayment);

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        "payment",
        payment.id,
        "create",
        undefined,
        payment,
        `Payment ${paymentNumber} created`
      );

      res.status(201).json(payment);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Error creating payment" });
      }
    }
  });

  app.post("/api/payments/:id/allocate", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { invoiceId, amount, allocationDate } = req.body;
      await storage.createPaymentAllocation(req.params.id, invoiceId, parseFloat(amount), allocationDate);
      res.json({ message: "Payment allocated" });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error allocating payment" });
    }
  });

  // ==========================================
  // POSTING ENGINE API
  // ==========================================

  // Preview posting (before actually posting)
  app.post("/api/posting/preview", requireTenant, async (req: any, res) => {
    try {
      const { modelType, modelId } = req.body;
      if (!modelType || !modelId) {
        return res.status(400).json({ message: "modelType and modelId are required" });
      }

      const preview = await storage.previewPosting(modelType, modelId);
      res.json(preview);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error previewing posting" });
    }
  });

  // Post document (create journal entry)
  app.post("/api/posting/post", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { modelType, modelId, journalId, entryDate } = req.body;
      if (!modelType || !modelId) {
        return res.status(400).json({ message: "modelType and modelId are required" });
      }

      const journalEntry = await storage.postDocument(
        modelType,
        modelId,
        journalId,
        entryDate,
        req.user?.id
      );

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        modelType,
        modelId,
        "post",
        undefined,
        { journalEntryId: journalEntry.id, entryNumber: journalEntry.entryNumber },
        `${modelType} ${modelId} posted as journal entry ${journalEntry.entryNumber}`
      );

      res.status(201).json(journalEntry);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error posting document" });
    }
  });

  // ==========================================
  // REPORTS API
  // ==========================================

  // Trial Balance
  app.get("/api/reports/trial-balance", requireTenant, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      const report = await storage.getTrialBalance(
        req.tenantId,
        startDate as string | undefined,
        endDate as string | undefined
      );
      res.json(report);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error generating trial balance" });
    }
  });

  // Balance Sheet
  app.get("/api/reports/balance-sheet", requireTenant, async (req: any, res) => {
    try {
      const { asOfDate } = req.query;
      const report = await storage.getBalanceSheet(
        req.tenantId,
        asOfDate as string | undefined
      );
      res.json(report);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error generating balance sheet" });
    }
  });

  // Profit & Loss
  app.get("/api/reports/profit-and-loss", requireTenant, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      const report = await storage.getProfitAndLoss(
        req.tenantId,
        startDate as string | undefined,
        endDate as string | undefined
      );
      res.json(report);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error generating profit and loss" });
    }
  });

  // VAT Report
  app.get("/api/reports/vat", requireTenant, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      const report = await storage.getVATReport(
        req.tenantId,
        startDate as string | undefined,
        endDate as string | undefined
      );
      res.json(report);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error generating VAT report" });
    }
  });

  // VAT Report Export (Excel/CSV)
  app.get("/api/reports/vat/export", requireTenant, async (req: any, res) => {
    try {
      const { startDate, endDate, format = "excel" } = req.query;
      const report = await storage.getVATReport(
        req.tenantId,
        startDate as string | undefined,
        endDate as string | undefined
      );

      const { exportVATReportToExcel, exportVATReportToCSV } = await import("./export-utils");

      if (format === "csv") {
        const csv = exportVATReportToCSV(report);
        res.setHeader("Content-Type", "text/csv; charset=utf-8");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="vat-report-${report.startDate}-${report.endDate}.csv"`
        );
        res.send("\ufeff" + csv); // BOM for Excel UTF-8 support
      } else {
        const excelBuffer = exportVATReportToExcel(report);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        res.setHeader(
          "Content-Disposition",
          `attachment; filename="vat-report-${report.startDate}-${report.endDate}.xlsx"`
        );
        res.send(excelBuffer);
      }
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error exporting VAT report" });
    }
  });

  // TT-03 Report Export (Official TT-03 format)
  app.get("/api/reports/tt03/export", requireTenant, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;
      if (!startDate || !endDate) {
        return res.status(400).json({ message: "startDate and endDate are required" });
      }

      // Get VAT report
      const report = await storage.getVATReport(
        req.tenantId,
        startDate as string,
        endDate as string
      );

      // Get tenant info for header
      const tenant = await storage.getTenant(req.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      const { exportTT03ReportToExcel } = await import("./export-utils");
      const excelBuffer = exportTT03ReportToExcel(report, {
        name: tenant.name,
        legalName: tenant.legalName || undefined,
        vatNo: tenant.vatNo || undefined,
        address: (tenant as any).address || undefined,
        district: (tenant as any).district || undefined,
        city: (tenant as any).city || undefined,
      });

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="tt03-report-${startDate}-${endDate}.xlsx"`
      );
      res.send(excelBuffer);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error exporting TT-03 report" });
    }
  });

  // НД-7 Report (Ажилтнуудын мэдээлэл)
  app.get("/api/reports/nd7", requireTenant, async (req: any, res) => {
    try {
      const { periodStart, periodEnd } = req.query;
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ message: "periodStart and periodEnd are required" });
      }

      const { getND7Report } = await import("./reports");
      const report = await getND7Report(
        req.tenantId,
        periodStart as string,
        periodEnd as string,
        storage
      );
      res.json(report);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error generating НД-7 report" });
    }
  });

  // НД-7 Report Export (Excel)
  app.get("/api/reports/nd7/export", requireTenant, async (req: any, res) => {
    try {
      const { periodStart, periodEnd } = req.query;
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ message: "periodStart and periodEnd are required" });
      }

      const { getND7Report } = await import("./reports");
      const { exportND7ReportToExcel } = await import("./export-utils");

      const report = await getND7Report(
        req.tenantId,
        periodStart as string,
        periodEnd as string,
        storage
      );

      const excelBuffer = exportND7ReportToExcel(report);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="nd7-report-${periodStart}-${periodEnd}.xlsx"`
      );
      res.send(excelBuffer);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error exporting НД-7 report" });
    }
  });

  // НД-8 Report (Цалингийн мэдээлэл)
  app.get("/api/reports/nd8", requireTenant, async (req: any, res) => {
    try {
      const { periodStart, periodEnd } = req.query;
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ message: "periodStart and periodEnd are required" });
      }

      const { getND8Report } = await import("./reports");
      const report = await getND8Report(
        req.tenantId,
        periodStart as string,
        periodEnd as string,
        storage
      );
      res.json(report);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error generating НД-8 report" });
    }
  });

  // НД-8 Report Export (Excel)
  app.get("/api/reports/nd8/export", requireTenant, async (req: any, res) => {
    try {
      const { periodStart, periodEnd } = req.query;
      if (!periodStart || !periodEnd) {
        return res.status(400).json({ message: "periodStart and periodEnd are required" });
      }

      const { getND8Report } = await import("./reports");
      const { exportND8ReportToExcel } = await import("./export-utils");

      const report = await getND8Report(
        req.tenantId,
        periodStart as string,
        periodEnd as string,
        storage
      );

      const excelBuffer = exportND8ReportToExcel(report);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="nd8-report-${periodStart}-${periodEnd}.xlsx"`
      );
      res.send(excelBuffer);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error exporting НД-8 report" });
    }
  });

  // ==========================================
  // BANK STATEMENTS API
  // ==========================================

  // Get Bank Accounts
  app.get("/api/bank-accounts", requireTenant, async (req: any, res) => {
    try {
      const accounts = await storage.getBankAccounts(req.tenantId);
      res.json(accounts);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching bank accounts" });
    }
  });

  // Create Bank Account
  app.post("/api/bank-accounts", requireTenant, async (req: any, res) => {

    try {
      const { bankName, accountNumber, balance } = req.body;

      if (!bankName || !accountNumber) {
        return res.status(400).json({ message: "Банкны нэр болон дансны дугаар шаардлагатай" });
      }

      const bankAccount = await storage.createBankAccount({
        tenantId: req.tenantId,
        bankName,
        accountNumber,
        balance: balance || "0",
      });

      res.status(201).json(bankAccount);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error creating bank account" });
    }
  });

  // Get Bank Statements

  app.get("/api/bank-statements", requireTenant, async (req: any, res) => {
    try {
      const bankAccountId = req.query.bankAccountId as string | undefined;
      const statements = await storage.getBankStatements(req.tenantId, bankAccountId);
      res.json(statements);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching bank statements" });
    }
  });

  // Get Bank Statement with Lines
  app.get("/api/bank-statements/:id", requireTenant, async (req: any, res) => {
    try {
      const statement = await storage.getBankStatement(req.params.id);
      if (!statement || statement.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Bank statement not found" });
      }
      const lines = await storage.getBankStatementLines(req.params.id);
      res.json({ ...statement, lines });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching bank statement" });
    }
  });

  // Import Bank Statement from Excel/CSV
  app.post("/api/bank-statements/import", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { bankAccountId, fileData, fileName } = req.body;

      if (!bankAccountId) {
        return res.status(400).json({ message: "Bank account ID is required" });
      }

      if (!fileData) {
        return res.status(400).json({ message: "File data is required" });
      }

      // Verify bank account exists and belongs to tenant
      const bankAccount = await storage.getBankAccount(bankAccountId);
      if (!bankAccount || bankAccount.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Bank account not found" });
      }

      // Parse file based on extension
      const {
        parseBankStatementExcel,
        parseBankStatementCSV,
        detectBankFormat,
        parseKhanBankExcel,
        parseGolomtBankExcel,
        parseTDBBankExcel
      } = await import("./import-utils");
      let parsed: any;

      if (fileName?.endsWith(".xlsx") || fileName?.endsWith(".xls")) {
        // Excel file - fileData should be base64
        const buffer = Buffer.from(fileData, "base64");

        // Detect bank format and use appropriate parser
        const bankFormat = detectBankFormat(buffer);

        if (bankFormat === "khan") {
          parsed = parseKhanBankExcel(buffer);
        } else if (bankFormat === "golomt") {
          parsed = parseGolomtBankExcel(buffer);
        } else if (bankFormat === "tdb") {
          parsed = parseTDBBankExcel(buffer);
        } else {
          // Fallback to generic parser
          parsed = parseBankStatementExcel(buffer);
        }
      } else if (fileName?.endsWith(".csv")) {
        // CSV file - fileData should be text
        parsed = parseBankStatementCSV(fileData);
      } else {
        return res.status(400).json({ message: "Unsupported file format. Please use Excel (.xlsx, .xls) or CSV (.csv)" });
      }

      // Create bank statement
      const statement = await storage.createBankStatement(
        {
          tenantId: req.tenantId,
          bankAccountId,
          statementDate: parsed.statementDate,
          openingBalance: parsed.openingBalance.toString(),
          closingBalance: parsed.closingBalance.toString(),
          importedBy: req.user?.id || null,
        },
        parsed.lines
      );

      res.status(201).json({
        ...statement,
        lines: parsed.lines,
        message: `Successfully imported ${parsed.lines.length} transactions`,
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error importing bank statement" });
    }
  });

  // ==========================================
  // BANK RECONCILIATION API
  // ==========================================

  // Get unreconciled bank statement lines
  app.get("/api/bank-statement-lines/unreconciled", requireTenant, async (req: any, res) => {
    try {
      const bankAccountId = req.query.bankAccountId as string | undefined;
      const lines = await storage.getUnreconciledBankLines(req.tenantId, bankAccountId);
      res.json(lines);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching unreconciled lines" });
    }
  });

  // Get all reconciliations

  app.get("/api/reconciliations", requireTenant, async (req: any, res) => {
    try {
      const status = req.query.status as string | undefined;
      const recs = await storage.getReconciliations(req.tenantId, status);
      res.json(recs);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching reconciliations" });
    }
  });

  // Create reconciliation and match with invoice
  app.post("/api/reconciliations", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { statementLineId, invoiceId, matchedAmount, notes } = req.body;

      if (!statementLineId) {
        return res.status(400).json({ message: "Statement line ID is required" });
      }
      if (!invoiceId) {
        return res.status(400).json({ message: "Invoice ID is required" });
      }
      if (!matchedAmount || matchedAmount <= 0) {
        return res.status(400).json({ message: "Matched amount must be greater than 0" });
      }

      // Create reconciliation
      const rec = await storage.createReconciliation({
        tenantId: req.tenantId,
        statementLineId,
        status: "draft",
        notes,
      });

      // Add match
      const today = new Date().toISOString().split("T")[0];
      await storage.addReconciliationMatch({
        reconciliationId: rec.id,
        invoiceId,
        matchedAmount,
        matchDate: today,
        notes,
      });

      res.status(201).json(rec);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error creating reconciliation" });
    }
  });

  // Add match to existing reconciliation
  app.post("/api/reconciliations/:id/matches", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { invoiceId, paymentId, journalLineId, matchedAmount, notes } = req.body;

      if (!matchedAmount || matchedAmount <= 0) {
        return res.status(400).json({ message: "Matched amount must be greater than 0" });
      }

      const today = new Date().toISOString().split("T")[0];
      const match = await storage.addReconciliationMatch({
        reconciliationId: req.params.id,
        invoiceId,
        paymentId,
        journalLineId,
        matchedAmount,
        matchDate: today,
        notes,
      });

      res.status(201).json(match);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error adding reconciliation match" });
    }
  });

  // Get reconciliation matches
  app.get("/api/reconciliations/:id/matches", requireTenant, async (req: any, res) => {
    try {
      const matches = await storage.getReconciliationMatches(req.params.id);
      res.json(matches);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching reconciliation matches" });
    }
  });

  // Confirm/Complete reconciliation
  app.put("/api/reconciliations/:id/confirm", requireTenantAndPermission, async (req: any, res) => {
    try {
      const rec = await storage.confirmReconciliation(req.params.id, req.user?.id);
      res.json(rec);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error confirming reconciliation" });
    }
  });

  // --- RBAC: Roles ---

  app.get("/api/roles", requireTenant, async (req: any, res) => {
    try {
      const roles = await storage.getRoles(req.tenantId);
      res.json(roles);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching roles" });
    }
  });

  app.get("/api/roles/:id", requireTenant, async (req: any, res) => {
    try {
      const role = await storage.getRole(req.tenantId, req.params.id);
      if (!role || role.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Role not found" });
      }
      const rolePermissions = await storage.getRolePermissions(role.id);
      res.json({ ...role, permissions: rolePermissions });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching role" });
    }
  });

  app.post("/api/roles", requireTenantAndPermission, async (req: any, res) => {
    try {
      const roleSchema = z.object({
        name: z.string().min(1, "Role name is required"),
        description: z.string().optional(),
        isSystem: z.boolean().optional().default(false),
      });
      const data = roleSchema.parse(req.body);
      const role = await storage.createRole(req.tenantId, {
        ...data,
        tenantId: req.tenantId,
      } as any, []);

      // Audit log
      logRBACEvent({
        type: "role.create",
        userId: req.user.id,
        tenantId: req.tenantId,
        details: {
          roleId: role.id,
          roleName: role.name,
        },
      });

      res.status(201).json(role);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: err.message || "Error creating role" });
      }
    }
  });

  app.put("/api/roles/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
      const role = await storage.getRole(req.tenantId, req.params.id);
      if (!role || role.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Role not found" });
      }
      if (role.isSystem) {
        return res.status(403).json({ message: "Cannot modify system role" });
      }
      const roleSchema = z.object({
        name: z.string().min(1).optional(),
        description: z.string().optional(),
      });
      const data = roleSchema.parse(req.body);
      const updated = await storage.updateRole(req.params.id, data);
      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: err.message || "Error updating role" });
      }
    }
  });

  app.delete("/api/roles/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
      const role = await storage.getRole(req.tenantId, req.params.id);
      if (!role || role.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Role not found" });
      }
      if (role.isSystem) {
        return res.status(403).json({ message: "Cannot delete system role" });
      }
      await storage.deleteRole(req.tenantId, req.params.id);
      res.status(204).send();
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error deleting role" });
    }
  });

  // --- RBAC: Permissions ---
  app.get("/api/permissions", requireTenant, async (req: any, res) => {
    try {
      const permissions = await storage.getPermissions();
      res.json(permissions);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching permissions" });
    }
  });

  // --- RBAC: Role Permissions ---
  app.get("/api/roles/:id/permissions", requireTenant, async (req: any, res) => {
    try {
      const role = await storage.getRole(req.tenantId, req.params.id);
      if (!role || role.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Role not found" });
      }
      const permissions = await storage.getRolePermissions(req.params.id);
      res.json(permissions);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching role permissions" });
    }
  });

  app.post("/api/roles/:id/permissions", requireTenantAndPermission, async (req: any, res) => {
    try {
      const role = await storage.getRole(req.tenantId, req.params.id);
      if (!role || role.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Role not found" });
      }
      const permissionSchema = z.object({
        permissionId: z.string().uuid("Invalid permission ID"),
      });
      const { permissionId } = permissionSchema.parse(req.body);
      await storage.assignPermissionToRole(req.params.id, permissionId);

      // Get permission details for audit
      const permission = await storage.getPermission(permissionId);

      // Audit log
      logRBACEvent({
        type: "permission.assign",
        userId: req.user.id,
        tenantId: req.tenantId,
        details: {
          roleId: role.id,
          roleName: role.name,
          permissionId,
          permissionResource: permission?.resource,
          permissionAction: permission?.action,
        },
      });

      res.status(201).json({ message: "Permission assigned" });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: err.message || "Error assigning permission" });
      }
    }
  });

  app.delete("/api/roles/:id/permissions/:permissionId", requireTenantAndPermission, async (req: any, res) => {
    try {
      const role = await storage.getRole(req.tenantId, req.params.id);
      if (!role || role.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Role not found" });
      }
      await storage.removePermissionFromRole(req.params.id, req.params.permissionId);
      res.status(204).send();
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error removing permission" });
    }
  });

  // --- Users ---
  app.get("/api/users", requireTenant, async (req: any, res) => {
    try {
      const users = await storage.getUsers(req.tenantId);
      res.json(users);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching users" });
    }
  });

  app.post("/api/users", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { email, password, fullName } = req.body;

      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      // Check if user already exists
      const existingUser = await storage.getUserByUsername(email);
      if (existingUser) {
        return res.status(400).json({ message: "User with this email already exists" });
      }

      // Validate password strength
      const { validatePasswordStrength } = await import("./security");
      const passwordValidation = validatePasswordStrength(password);
      if (!passwordValidation.valid) {
        return res.status(400).json({ message: passwordValidation.message });
      }

      // Hash password
      const { hashPassword } = await import("./auth");
      const hashedPassword = await hashPassword(password);

      // Create user
      const user = await storage.createUser({
        tenantId: req.tenantId,
        email,
        passwordHash: hashedPassword,
        fullName: fullName || email,
        isActive: true,
      });

      res.status(201).json(user);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error creating user" });
    }
  });

  // --- RBAC: User Roles ---
  app.get("/api/users/:id/roles", requireTenant, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user || user.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "User not found" });
      }
      const roles = await storage.getUserRoles(req.params.id);
      res.json(roles);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching user roles" });
    }
  });

  app.get("/api/users/:id/permissions", requireTenant, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user || user.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "User not found" });
      }
      const permissions = await storage.getUserPermissions(req.params.id);
      res.json(permissions);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching user permissions" });
    }
  });

  app.post("/api/users/:id/roles", requireTenantAndPermission, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user || user.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "User not found" });
      }
      const roleSchema = z.object({
        roleId: z.string().uuid("Invalid role ID"),
      });
      const { roleId } = roleSchema.parse(req.body);
      const role = await storage.getRole(req.tenantId, roleId);
      if (!role || role.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Role not found" });
      }
      await storage.assignRoleToUser(req.params.id, roleId);
      res.status(201).json({ message: "Role assigned" });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: err.message || "Error assigning role" });
      }
    }
  });

  app.delete("/api/users/:id/roles/:roleId", requireTenantAndPermission, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user || user.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "User not found" });
      }
      await storage.removeRoleFromUser(req.params.id, req.params.roleId);
      res.status(204).send();
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error removing role" });
    }
  });

  // --- Audit Log ---
  app.get("/api/audit-logs", requireTenant, async (req: any, res) => {
    try {
      const filters: any = {};

      if (req.query.entityType) filters.entityType = req.query.entityType;
      if (req.query.entityId) filters.entityId = req.query.entityId;
      if (req.query.action) filters.action = req.query.action;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate);
      if (req.query.limit) filters.limit = parseInt(req.query.limit, 10);

      const logs = await storage.getAuditLogs(req.tenantId, Object.keys(filters).length > 0 ? filters : undefined);
      res.json(logs);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching audit logs" });
    }
  });

  // ==========================================
  // TAX CODES API
  // ==========================================

  app.get("/api/tax-codes", requireTenant, async (req: any, res) => {
    try {
      const allTaxCodes = await db.select().from(taxCodes).where(eq(taxCodes.tenantId, req.tenantId));
      res.json(allTaxCodes);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error fetching tax codes" });
    }
  });

  app.post("/api/tax-codes", requireTenantAndPermission, async (req: any, res) => {
    try {
      const input = { ...insertTaxCodeSchema.parse(req.body), tenantId: req.tenantId };

      if (input.isDefault) {
        await db.update(taxCodes)
          .set({ isDefault: false })
          .where(eq(taxCodes.tenantId, req.tenantId));
      }

      const [taxCode] = await db.insert(taxCodes).values(input).returning();

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        "other",
        taxCode.id,
        "create",
        undefined,
        taxCode,
        `Tax code ${taxCode.code} created`
      );

      res.status(201).json(taxCode);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: err.message || "Error creating tax code" });
      }
    }
  });

  app.patch("/api/tax-codes/:id/default", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { id } = req.params;
      const { isDefault } = req.body;

      await db.transaction(async (tx) => {
        if (isDefault) {
          await tx.update(taxCodes)
            .set({ isDefault: false })
            .where(eq(taxCodes.tenantId, req.tenantId));
        }

        await tx.update(taxCodes)
          .set({ isDefault: isDefault })
          .where(and(eq(taxCodes.id, id), eq(taxCodes.tenantId, req.tenantId)));
      });

      res.json({ message: "Default tax code updated" });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error updating default tax code" });
    }
  });

  app.put("/api/tax-codes/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
      // Validate ownership
      const existing = await db.select().from(taxCodes).where(and(eq(taxCodes.id, req.params.id), eq(taxCodes.tenantId, req.tenantId))).limit(1);
      if (!existing || existing.length === 0) {
        return res.status(404).json({ message: "Tax code not found" });
      }

      const input = insertTaxCodeSchema.partial().parse(req.body);

      // If setting default, unset others
      if (input.isDefault) {
        await db.update(taxCodes)
          .set({ isDefault: false })
          .where(eq(taxCodes.tenantId, req.tenantId));
      }

      const [updated] = await db.update(taxCodes)
        .set({ ...input })
        .where(and(eq(taxCodes.id, req.params.id), eq(taxCodes.tenantId, req.tenantId)))
        .returning();

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        "other",
        req.params.id,
        "update",
        existing[0],
        updated,
        `Tax code ${updated.code} updated`
      );

      res.json(updated);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: err.message || "Error updating tax code" });
      }
    }
  });

  app.delete("/api/tax-codes/:id", requireTenantAndPermission, async (req: any, res) => {
    try {
      const existing = await db.select().from(taxCodes).where(and(eq(taxCodes.id, req.params.id), eq(taxCodes.tenantId, req.tenantId))).limit(1);
      if (!existing || existing.length === 0) {
        return res.status(404).json({ message: "Tax code not found" });
      }

      await db.delete(taxCodes)
        .where(and(eq(taxCodes.id, req.params.id), eq(taxCodes.tenantId, req.tenantId)));

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        "other",
        req.params.id,
        "delete",
        existing[0],
        undefined,
        `Tax code ${existing[0].code} deleted`
      );

      res.status(204).send();
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error deleting tax code" });
    }
  });

  return httpServer;
}
