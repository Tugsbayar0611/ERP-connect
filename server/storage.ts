import {
  users, tenants, branches, departments, employees, attendanceDays, payrollRuns, payslips,
  roles, permissions, rolePermissions, userRoles, leaveRequests,
  type User, type InsertUser, type Tenant, type InsertTenant, type Branch, type InsertBranch,
  type Department, type InsertDepartment, type Employee, type InsertEmployee,
  type AttendanceDay, type InsertAttendanceDay, type PayrollRun, type InsertPayrollRun,
  type Payslip, type InsertPayslip, type Document, type InsertDocument, categories, documents,
  type Role, type InsertRole, type Permission, type InsertPermission,
  type DbInsertUser, type DbInsertTenant, type DbInsertBranch, type DbInsertRole, type DbInsertDepartment,
  type DbInsertEmployee, type DbInsertAttendanceDay, type DbInsertPayrollRun, type DbInsertPayslip,
  type DbInsertDocument, type DbInsertSalaryAdvance, type DbInsertEmployeeAllowance,
  type EmployeeAchievement, type InsertEmployeeAchievement, type EmployeePoints, type InsertEmployeePoints,
  type PointsHistory, type InsertPointsHistory,
  type DbInsertEmployeeAchievement, type DbInsertEmployeePoints, type DbInsertPointsHistory,
  type CompanyPost, type InsertCompanyPost, type PostLike, type InsertPostLike, type PostComment, type InsertPostComment,
  type DbInsertCompanyPost, type DbInsertPostLike, type DbInsertPostComment,
  type WeatherAlert, type InsertWeatherAlert, type WeatherSettings, type InsertWeatherSettings,
  type DbInsertWeatherAlert, type DbInsertWeatherSettings,
  salaryAdvances, employeeAllowances,
  employeeAchievements, employeePoints, pointsHistory,
  companyPosts, postLikes, postComments,
  weatherAlerts, weatherSettings,
  products, productCategories, contacts, warehouses, stockLevels, stockMovements,
  salesOrders, salesOrderLines, purchaseOrders, purchaseOrderLines, invoices, invoiceLines,
  currencies, accounts, journals, journalEntries, journalLines, taxCodes, taxLines,
  payments, paymentAllocations, bankAccounts, bankStatements, bankStatementLines,
  reconciliations, reconciliationMatches, fiscalYears, fiscalPeriods, periodLocks,
  type BankAccount, type InsertBankAccount, type BankStatement, type InsertBankStatement,
  type BankStatementLine, type InsertBankStatementLine,
  type DbInsertBankAccount, type DbInsertBankStatement,
  type Product, type InsertProduct, type ProductCategory, type InsertProductCategory,
  type Contact, type InsertContact, type Warehouse, type InsertWarehouse,
  type StockLevel, type InsertStockLevel, type StockMovement, type InsertStockMovement,
  type SalesOrder, type InsertSalesOrder, type SalesOrderLine, type InsertSalesOrderLine,
  type PurchaseOrder, type InsertPurchaseOrder, type PurchaseOrderLine, type InsertPurchaseOrderLine,
  type Invoice, type InsertInvoice, type InvoiceLine, type InsertInvoiceLine,
  type Currency, type InsertCurrency, type Account, type InsertAccount,
  type Journal, type InsertJournal, type JournalEntry, type InsertJournalEntry,
  type JournalLine, type InsertJournalLine, type TaxCode, type InsertTaxCode,
  type Payment, type InsertPayment, type FiscalYear, type InsertFiscalYear,
  type FiscalPeriod, type InsertFiscalPeriod,
  type DbInsertProduct, type DbInsertProductCategory, type DbInsertContact, type DbInsertWarehouse,
  type DbInsertStockLevel, type DbInsertStockMovement, type DbInsertSalesOrder, type DbInsertSalesOrderLine,
  type DbInsertPurchaseOrder, type DbInsertPurchaseOrderLine, type DbInsertInvoice, type DbInsertInvoiceLine,
  type DbInsertCurrency, type DbInsertAccount, type DbInsertJournal, type DbInsertJournalEntry,
  type DbInsertJournalLine, type DbInsertTaxCode, type DbInsertPayment, type InsertTaxLine,
  qpaySettings, qpayInvoices, type QPaySettings, type DbInsertQPaySettings, type QPayInvoice, type DbInsertQPayInvoice,
  ebarimtSettings, type EBarimtSettings, type DbInsertEBarimtSettings,
  auditLogs, type AuditLog, type InsertAuditLog, type DbInsertAuditLog,
} from "@shared/schema";
import { type InferSelectModel } from "drizzle-orm";

type RolePermission = typeof rolePermissions.$inferSelect;
type RoleWithPermissions = Role & {
  permissions: (RolePermission & { permission: Permission })[];
  userCount: number;
};
import { db } from "./db";
import { eq, and, desc, asc, or, like, sql, inArray } from "drizzle-orm";
import { previewPosting, postDocument } from "./posting-engine";
import { getTrialBalance, getBalanceSheet, getProfitAndLoss, getVATReport } from "./reports";

export interface IStorage {
  // User & Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUsers(tenantId: string): Promise<User[]>;
  createUser(user: DbInsertUser): Promise<User>;
  updateUser(userId: string, updates: Partial<DbInsertUser>): Promise<User>;
  updateUserLastLogin(userId: string): Promise<void>;

  // RBAC
  getPermissions(): Promise<Permission[]>;
  getRoles(tenantId: string): Promise<RoleWithPermissions[]>;
  getRole(tenantId: string, roleId: string): Promise<RoleWithPermissions | undefined>;
  createRole(tenantId: string, role: InsertRole, permissionIds: string[]): Promise<Role>;
  updateRole(roleId: string, role: Partial<InsertRole>, permissionIds?: string[]): Promise<Role>;
  deleteRole(tenantId: string, roleId: string): Promise<void>;
  getUserRoles(userId: string): Promise<Role[]>;
  getUserPermissions(userId: string): Promise<Permission[]>;
  getPermission(id: string): Promise<Permission | undefined>;
  createPermission(permission: InsertPermission): Promise<Permission>;
  getRolePermissions(roleId: string): Promise<Permission[]>;
  assignPermissionToRole(roleId: string, permissionId: string): Promise<void>;
  removePermissionFromRole(roleId: string, permissionId: string): Promise<void>;
  assignRoleToUser(userId: string, roleId: string): Promise<void>;
  removeRoleFromUser(userId: string, roleId: string): Promise<void>;

  // Tenants & Branches
  getTenant(id: string): Promise<Tenant | undefined>;
  getTenantByCode(code: string): Promise<Tenant | undefined>;
  generateUniqueCompanyCode(): Promise<string>;
  createTenant(tenant: DbInsertTenant): Promise<Tenant>;
  updateTenant(id: string, updates: Partial<DbInsertTenant>): Promise<Tenant>;
  getUserByEmailInTenant(email: string, tenantId: string): Promise<User | undefined>;
  linkUserToEmployeeByEmail(userId: string, email: string, tenantId: string): Promise<void>;
  getBranches(tenantId: string): Promise<Branch[]>;
  createBranch(branch: DbInsertBranch): Promise<Branch>;

  // Employees
  getEmployees(tenantId: string): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  createEmployee(employee: DbInsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee>;
  deleteEmployee(id: string): Promise<void>;

  // Departments
  getDepartments(tenantId: string): Promise<Department[]>;
  getDepartment(tenantId: string, departmentId: string): Promise<Department | undefined>;
  getDepartmentsWithStats(tenantId: string): Promise<any[]>;
  getDepartmentDetails(tenantId: string, departmentId: string): Promise<any>;
  createDepartment(dept: DbInsertDepartment): Promise<Department>;
  updateDepartment(departmentId: string, updates: Partial<DbInsertDepartment>): Promise<Department>;
  deleteDepartment(departmentId: string): Promise<void>;
  assignManagerToDepartment(departmentId: string, employeeId: string | null): Promise<Department>;
  batchAssignEmployeesToDepartment(departmentId: string, employeeIds: string[]): Promise<void>;

  // Attendance
  getAttendance(tenantId: string): Promise<AttendanceDay[]>;
  getAttendanceRecord(id: string): Promise<AttendanceDay | undefined>;
  getAttendanceByEmployeeAndDateRange(tenantId: string, employeeId: string, startDate: string, endDate: string): Promise<AttendanceDay[]>;
  createAttendance(att: DbInsertAttendanceDay): Promise<AttendanceDay>;
  updateAttendance(id: string, update: Partial<DbInsertAttendanceDay>): Promise<AttendanceDay>;
  deleteAttendance(id: string): Promise<void>;

  // Payroll
  getPayrollRuns(tenantId: string): Promise<PayrollRun[]>;
  getPayrollRunByPeriod(tenantId: string, start: string, end: string): Promise<PayrollRun | undefined>;
  createPayrollRun(run: DbInsertPayrollRun): Promise<PayrollRun>;
  getPayslips(runId: string): Promise<Payslip[]>;
  getAllPayslips(tenantId: string): Promise<any[]>;
  createPayslip(slip: DbInsertPayslip): Promise<Payslip>;
  getPayslipByEmployeeAndRun(tenantId: string, payrollRunId: string, employeeId: string): Promise<Payslip | undefined>;
  updatePayslip(id: string, update: Partial<DbInsertPayslip>): Promise<Payslip>;
  deletePayslip(id: string): Promise<void>;

  // Salary Advances
  getSalaryAdvances(tenantId: string, employeeId?: string, status?: string): Promise<any[]>;
  getSalaryAdvance(id: string): Promise<any | undefined>;
  createSalaryAdvance(advance: DbInsertSalaryAdvance): Promise<any>;
  updateSalaryAdvance(id: string, update: Partial<DbInsertSalaryAdvance>): Promise<any>;
  deleteSalaryAdvance(id: string): Promise<void>;

  // Employee Allowances
  getEmployeeAllowances(tenantId: string, employeeId?: string): Promise<any[]>;
  getEmployeeAllowance(id: string): Promise<any | undefined>;
  createEmployeeAllowance(allowance: DbInsertEmployeeAllowance): Promise<any>;
  updateEmployeeAllowance(id: string, update: Partial<DbInsertEmployeeAllowance>): Promise<any>;
  deleteEmployeeAllowance(id: string): Promise<void>;

  // HR Gamification
  getEmployeeAchievements(tenantId: string, employeeId?: string): Promise<EmployeeAchievement[]>;
  createAchievement(achievement: DbInsertEmployeeAchievement): Promise<EmployeeAchievement>;
  getEmployeePoints(tenantId: string, employeeId: string): Promise<EmployeePoints | undefined>;
  upsertEmployeePoints(tenantId: string, employeeId: string, pointsChange: number): Promise<EmployeePoints>;
  addPointsHistory(history: DbInsertPointsHistory): Promise<PointsHistory>;
  getPointsHistory(tenantId: string, employeeId?: string, limit?: number): Promise<PointsHistory[]>;
  awardPoints(tenantId: string, employeeId: string, points: number, reason: string, sourceType?: string, sourceId?: string): Promise<void>;

  // News Feed
  getCompanyPosts(tenantId: string, limit?: number): Promise<any[]>;
  getCompanyPost(id: string): Promise<any | undefined>;
  createCompanyPost(post: DbInsertCompanyPost): Promise<CompanyPost>;
  updateCompanyPost(id: string, updates: Partial<DbInsertCompanyPost>): Promise<CompanyPost>;
  deleteCompanyPost(id: string): Promise<void>;
  togglePostLike(tenantId: string, postId: string, employeeId: string): Promise<{ liked: boolean; likesCount: number }>;
  getPostLikes(tenantId: string, postId: string): Promise<any[]>;
  createPostComment(comment: DbInsertPostComment): Promise<PostComment>;
  getPostComments(tenantId: string, postId: string): Promise<any[]>;
  deletePostComment(id: string): Promise<void>;

  // Weather Widget
  getWeatherSettings(tenantId: string): Promise<WeatherSettings | undefined>;
  upsertWeatherSettings(tenantId: string, settings: Partial<DbInsertWeatherSettings>): Promise<WeatherSettings>;
  getWeatherAlerts(tenantId: string, limit?: number): Promise<WeatherAlert[]>;
  createWeatherAlert(alert: DbInsertWeatherAlert): Promise<WeatherAlert>;
  markWeatherAlertAsSent(id: string): Promise<void>;

  // Documents
  getDocuments(tenantId: string, parentId?: string | null): Promise<Document[]>;
  createDocument(doc: DbInsertDocument): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  signDocument(id: string, userId: string): Promise<Document>;
  seedDocuments(tenantId: string, userId: string): Promise<void>;
  ensureInvoiceFolder(tenantId: string, userId: string): Promise<string>;

  // New Features
  updateUserSignature(userId: string, signatureUrl: string | null, jobTitle?: string | null): Promise<User>;
  updateUserPermissions(userId: string, permissions: { canSignDocuments?: boolean; jobTitle?: string | null }): Promise<User>;
  bulkDeleteDocuments(ids: string[]): Promise<void>;
  updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document>;

  // Stats
  getStats(tenantId: string): Promise<any>;

  // Products
  getProducts(tenantId: string): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: DbInsertProduct): Promise<Product>;
  updateProduct(id: string, product: Partial<InsertProduct>): Promise<Product>;

  // Product Categories
  getProductCategories(tenantId: string): Promise<ProductCategory[]>;
  createProductCategory(category: DbInsertProductCategory): Promise<ProductCategory>;

  // Contacts
  getContacts(tenantId: string, type?: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: DbInsertContact): Promise<Contact>;
  updateContact(id: string, contact: Partial<InsertContact>): Promise<Contact>;

  // Warehouses
  getWarehouses(tenantId: string): Promise<Warehouse[]>;
  createWarehouse(warehouse: DbInsertWarehouse): Promise<Warehouse>;

  // Stock
  getStockLevels(tenantId: string, warehouseId?: string): Promise<any[]>;
  bulkDeleteStockLevels(tenantId: string, ids: string[]): Promise<void>;
  bulkResetStockLevels(tenantId: string, ids: string[]): Promise<void>;

  updateStock(tenantId: string, warehouseId: string, productId: string, quantity: number, type: string, reference?: string, referenceId?: string, batchNumber?: string | null, expiryDate?: string | null): Promise<void>;
  getStockMovements(tenantId: string, warehouseId?: string, productId?: string): Promise<any[]>;
  getExpiryAlerts(tenantId: string, days?: number, warehouseId?: string): Promise<any[]>;
  getFEFOSuggest(tenantId: string, productId: string, warehouseId: string, quantity: number): Promise<any[]>;

  // Sales Orders
  getSalesOrders(tenantId: string): Promise<any[]>;
  getSalesOrder(id: string): Promise<any | undefined>;
  createSalesOrder(order: DbInsertSalesOrder, lines: DbInsertSalesOrderLine[]): Promise<SalesOrder>;
  updateSalesOrderStatus(id: string, status: string): Promise<void>;

  // Purchase Orders
  getPurchaseOrders(tenantId: string): Promise<any[]>;
  getPurchaseOrder(id: string): Promise<any | undefined>;
  createPurchaseOrder(order: DbInsertPurchaseOrder, lines: DbInsertPurchaseOrderLine[]): Promise<PurchaseOrder>;
  updatePurchaseOrderStatus(id: string, status: string): Promise<void>;
  bulkDeleteDraftPurchaseOrders(ids: string[], tenantId: string): Promise<{ deleted: number; errors: string[] }>;

  // Invoices
  getInvoices(tenantId: string, type?: string): Promise<any[]>;
  getInvoice(id: string): Promise<any | undefined>;
  createInvoice(invoice: DbInsertInvoice, lines: DbInsertInvoiceLine[]): Promise<Invoice>;
  updateInvoiceStatus(id: string, status: string, paidAmount?: number): Promise<void>;
  createInvoiceFromSalesOrder(salesOrderId: string): Promise<Invoice>;
  deleteInvoice(id: string): Promise<void>;

  // Accounting - Currencies
  getCurrencies(tenantId: string): Promise<Currency[]>;
  createCurrency(currency: DbInsertCurrency): Promise<Currency>;

  // Accounting - Accounts (Chart of Accounts)
  getAccounts(tenantId: string): Promise<Account[]>;
  getAccount(id: string): Promise<Account | undefined>;
  createAccount(account: DbInsertAccount): Promise<Account>;
  updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account>;

  // Accounting - Journals
  getJournals(tenantId: string): Promise<Journal[]>;
  getJournal(id: string): Promise<Journal | undefined>;
  createJournal(journal: DbInsertJournal): Promise<Journal>;

  // Accounting - Journal Entries
  getJournalEntries(tenantId: string, filters?: { journalId?: string; status?: string; startDate?: string; endDate?: string }): Promise<any[]>;
  getJournalEntry(id: string): Promise<any | undefined>;
  createJournalEntry(entry: DbInsertJournalEntry, lines: DbInsertJournalLine[]): Promise<JournalEntry>;
  updateJournalEntryStatus(id: string, status: string, postedBy?: string): Promise<void>;
  reverseJournalEntry(id: string, entryDate: string, description: string, reversedBy: string): Promise<JournalEntry>;

  // Accounting - Posting Engine
  previewPosting(modelType: string, modelId: string): Promise<any>;
  postDocument(modelType: string, modelId: string, journalId?: string, entryDate?: string): Promise<JournalEntry>;

  // Accounting - Tax Codes
  getTaxCodes(tenantId: string): Promise<TaxCode[]>;
  createTaxCode(taxCode: DbInsertTaxCode): Promise<TaxCode>;

  // Accounting - Payments
  getPayments(tenantId: string, type?: string): Promise<any[]>;
  getPayment(id: string): Promise<any | undefined>;
  createPayment(payment: DbInsertPayment): Promise<Payment>;
  createPaymentAllocation(paymentId: string, invoiceId: string, amount: number, allocationDate: string): Promise<void>;

  // Accounting - Invoices
  updateInvoiceEBarimt(id: string, documentId: string, qrCode?: string, receiptNumber?: string, lotteryNumber?: string): Promise<void>;

  // Accounting - Bank Accounts
  getBankAccounts(tenantId: string): Promise<any[]>;
  getBankAccount(id: string): Promise<any | undefined>;

  // Accounting - Bank Statements
  getBankStatements(tenantId: string, bankAccountId?: string): Promise<any[]>;
  getBankStatement(id: string): Promise<any | undefined>;
  createBankStatement(statement: any, lines: any[]): Promise<any>;
  getBankStatementLines(statementId: string): Promise<any[]>;

  // Accounting - Reports
  getTrialBalance(tenantId: string, startDate?: string, endDate?: string): Promise<any>;
  getBalanceSheet(tenantId: string, asOfDate?: string): Promise<any>;
  getProfitAndLoss(tenantId: string, startDate?: string, endDate?: string): Promise<any>;
  getVATReport(tenantId: string, startDate?: string, endDate?: string): Promise<any>;



  // QPay
  getQPaySettings(tenantId: string): Promise<QPaySettings | undefined>;
  updateQPaySettings(tenantId: string, settings: Partial<QPaySettings>): Promise<QPaySettings>;
  getQPayInvoiceByInvoiceId(invoiceId: string): Promise<QPayInvoice | undefined>;
  createQPayInvoice(qpayInvoice: DbInsertQPayInvoice): Promise<QPayInvoice>;
  updateQPayInvoice(id: string, qpayInvoice: Partial<QPayInvoice>): Promise<QPayInvoice>;
  attachPaymentToQPayInvoice(qpayInvoiceId: string, paymentId: string): Promise<void>;

  // E-barimt
  getEBarimtSettings(tenantId: string): Promise<EBarimtSettings | undefined>;
  updateEBarimtSettings(tenantId: string, settings: Partial<EBarimtSettings>): Promise<EBarimtSettings>;

  // Audit Log
  createAuditLog(log: DbInsertAuditLog): Promise<AuditLog>;
  getAuditLogs(tenantId: string, filters?: { entityType?: string; entityId?: string; action?: string; startDate?: Date; endDate?: Date; limit?: number }): Promise<AuditLog[]>;
}

export class DatabaseStorage implements IStorage {
  // --- User & Auth ---
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(insertUser: DbInsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(userId: string, updates: Partial<DbInsertUser>): Promise<User> {
    const [updated] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    if (!updated) throw new Error("User not found");
    return updated;
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
  }

  async getUsers(tenantId: string): Promise<User[]> {
    return await db.select().from(users).where(eq(users.tenantId, tenantId)).orderBy(users.email);
  }



  // --- RBAC ---
  async getPermissions(): Promise<Permission[]> {
    return await db.select().from(permissions).orderBy(permissions.resource, permissions.action);
  }

  async getRoles(tenantId: string): Promise<RoleWithPermissions[]> {
    const rows = await db.query.roles.findMany({
      where: eq(roles.tenantId, tenantId),
      with: {
        permissions: {
          with: {
            permission: true,
          },
        },
        users: true,
      },
      orderBy: [asc(roles.name)],
    });

    return rows.map((r) => ({
      ...r,
      userCount: r.users.length,
    }));
  }

  async getRole(tenantId: string, roleId: string): Promise<RoleWithPermissions | undefined> {
    const role = await db.query.roles.findFirst({
      where: and(eq(roles.id, roleId), eq(roles.tenantId, tenantId)),
      with: {
        permissions: {
          with: {
            permission: true,
          },
        },
        users: true,
      },
    });

    if (!role) return undefined;

    return {
      ...role,
      userCount: role.users.length,
    };
  }

  async createRole(tenantId: string, insertRole: InsertRole, permissionIds: string[]): Promise<Role> {
    // Transactional create
    return await db.transaction(async (tx) => {
      const [role] = await tx.insert(roles).values({ ...insertRole, tenantId }).returning();

      if (permissionIds.length > 0) {
        await tx.insert(rolePermissions).values(
          permissionIds.map((pid) => ({
            roleId: role.id,
            permissionId: pid,
          }))
        );
      }

      return role;
    });
  }

  async updateRole(roleId: string, updates: Partial<InsertRole>, permissionIds?: string[]): Promise<Role> {
    return await db.transaction(async (tx) => {
      // Update role details
      const [updatedRole] = await tx
        .update(roles)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(roles.id, roleId))
        .returning();

      if (!updatedRole) throw new Error("Role not found");

      // Update permissions if provided
      if (permissionIds !== undefined) {
        // Delete existing
        await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

        // Insert new
        if (permissionIds.length > 0) {
          await tx.insert(rolePermissions).values(
            permissionIds.map((pid) => ({
              roleId: roleId,
              permissionId: pid,
            }))
          );
        }
      }

      return updatedRole;
    });
  }

  async deleteRole(tenantId: string, roleId: string): Promise<void> {
    // First check if system role (frontend should block too, but safe backend check)
    const [role] = await db.select().from(roles).where(and(eq(roles.id, roleId), eq(roles.tenantId, tenantId)));
    if (role && role.isSystem) {
      throw new Error("Cannot delete system role");
    }

    // Cascade delete
    await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
    await db.delete(userRoles).where(eq(userRoles.roleId, roleId));

    await db.delete(roles).where(and(eq(roles.id, roleId), eq(roles.tenantId, tenantId)));
  }

  async getUserRoles(userId: string): Promise<Role[]> {
    const rows = await db.query.userRoles.findMany({
      where: eq(userRoles.userId, userId),
      with: {
        role: true,
      },
    });
    return rows.map((r) => r.role).filter((r): r is Role => !!r);
  }

  async getUserPermissions(userId: string): Promise<Permission[]> {
    const userRoleRows = await db.query.userRoles.findMany({
      where: eq(userRoles.userId, userId),
    });

    const roleIds = userRoleRows.map((ur) => ur.roleId);

    if (roleIds.length === 0) return [];

    const rolePerms = await db.query.rolePermissions.findMany({
      where: inArray(rolePermissions.roleId, roleIds),
      with: {
        permission: true,
      },
    });

    // Deduplicate permissions
    const uniquePerms = new Map<string, Permission>();
    rolePerms.forEach((rp) => {
      uniquePerms.set(rp.permission.id, rp.permission);
    });

    return Array.from(uniquePerms.values());
  }

  async getPermission(id: string): Promise<Permission | undefined> {
    const [permission] = await db.select().from(permissions).where(eq(permissions.id, id));
    return permission;
  }

  async createPermission(insertPermission: InsertPermission): Promise<Permission> {
    const [permission] = await db.insert(permissions).values(insertPermission).returning();
    return permission;
  }

  async getRolePermissions(roleId: string): Promise<Permission[]> {
    const rows = await db
      .select({
        id: permissions.id,
        resource: permissions.resource,
        action: permissions.action,
        description: permissions.description,
      })
      .from(rolePermissions)
      .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
      .where(eq(rolePermissions.roleId, roleId));
    return rows;
  }

  async assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
    await db.insert(rolePermissions).values({ roleId, permissionId }).onConflictDoNothing();
  }

  async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
    await db
      .delete(rolePermissions)
      .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)));
  }

  async assignRoleToUser(userId: string, roleId: string): Promise<void> {
    await db.insert(userRoles).values({ userId, roleId }).onConflictDoNothing();
  }

  async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
    await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
  }

  // --- Tenants & Branches ---
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async getTenantByCode(code: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(
      sql`UPPER(${tenants.code}) = UPPER(${code})`
    );
    return tenant;
  }

  async generateUniqueCompanyCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, 0, I, 1 to avoid confusion
    let code: string;
    let attempts = 0;

    do {
      // Generate format: ERP-XXXX
      let random = '';
      for (let i = 0; i < 4; i++) {
        random += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      code = `ERP-${random}`;

      // Check if code exists
      const existing = await this.getTenantByCode(code);
      if (!existing) {
        return code;
      }
      attempts++;
    } while (attempts < 100);

    // Fallback: Use timestamp-based code
    return `ERP-${Date.now().toString(36).toUpperCase().slice(-4)}`;
  }

  async createTenant(insertTenant: DbInsertTenant): Promise<Tenant> {
    const [tenant] = await db.insert(tenants).values(insertTenant).returning();
    return tenant;
  }

  async updateTenant(id: string, updates: Partial<DbInsertTenant>): Promise<Tenant> {
    const [updated] = await db
      .update(tenants)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(tenants.id, id))
      .returning();
    if (!updated) {
      throw new Error("Tenant not found");
    }
    return updated;
  }

  async getUserByEmailInTenant(email: string, tenantId: string): Promise<User | undefined> {
    const normalizedEmail = email.trim().toLowerCase();
    const [user] = await db.select().from(users).where(
      and(
        sql`LOWER(${users.email}) = ${normalizedEmail}`,
        eq(users.tenantId, tenantId)
      )
    );
    return user;
  }

  async linkUserToEmployeeByEmail(userId: string, email: string, tenantId: string): Promise<void> {
    const normalizedEmail = email.trim().toLowerCase();

    // Find employee with matching email in the same tenant, not yet linked
    const matchingEmployees = await db.select().from(employees).where(
      and(
        sql`LOWER(${employees.email}) = ${normalizedEmail}`,
        eq(employees.tenantId, tenantId),
        sql`${employees.userId} IS NULL`
      )
    );

    if (matchingEmployees.length === 1) {
      // Link user to employee
      await db.update(employees)
        .set({ userId: userId, updatedAt: new Date() })
        .where(eq(employees.id, matchingEmployees[0].id));
      console.log(`Linked user ${userId} to employee ${matchingEmployees[0].id} by email match`);
    } else if (matchingEmployees.length > 1) {
      console.warn(`Multiple unlinked employees found for email ${email}, skipping auto-link`);
    }
  }

  async getBranches(tenantId: string): Promise<Branch[]> {
    return await db.select().from(branches).where(eq(branches.tenantId, tenantId));
  }

  async createBranch(insertBranch: DbInsertBranch): Promise<Branch> {
    const [branch] = await db.insert(branches).values(insertBranch).returning();
    return branch;
  }

  // --- Employees ---
  async getEmployees(tenantId: string): Promise<Employee[]> {
    return await db.select().from(employees).where(eq(employees.tenantId, tenantId));
  }

  async getEmployee(id: string): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
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

  async createDepartment(dept: DbInsertDepartment): Promise<Department> {
    const [d] = await db.insert(departments).values(dept).returning();
    return d;
  }

  async updateDepartment(departmentId: string, updates: Partial<DbInsertDepartment>): Promise<Department> {
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
      payDate: payrollRuns.payDate
    })
      .from(payslips)
      .leftJoin(payrollRuns, eq(payslips.payrollRunId, payrollRuns.id))
      .where(eq(payslips.tenantId, tenantId))
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

  // --- News Feed ---
  async getCompanyPosts(tenantId: string, limit: number = 50): Promise<any[]> {
    const posts = await db.select({
      id: companyPosts.id,
      tenantId: companyPosts.tenantId,
      authorId: companyPosts.authorId,
      authorFirstName: sql<string>`${employees.firstName}`,
      authorLastName: sql<string>`${employees.lastName}`,
      title: companyPosts.title,
      content: companyPosts.content,
      postType: companyPosts.postType,
      images: companyPosts.images,
      likesCount: companyPosts.likesCount,
      commentsCount: companyPosts.commentsCount,
      isPinned: companyPosts.isPinned,
      createdAt: companyPosts.createdAt,
    })
      .from(companyPosts)
      .leftJoin(employees, eq(companyPosts.authorId, employees.id))
      .where(eq(companyPosts.tenantId, tenantId))
      .orderBy(desc(companyPosts.isPinned), desc(companyPosts.createdAt))
      .limit(limit);

    return posts.map((post: any) => ({
      ...post,
      authorName: `${post.authorFirstName || ""} ${post.authorLastName || ""}`.trim() || "Unknown",
    }));
  }

  async getCompanyPost(id: string): Promise<any | undefined> {
    const [post] = await db.select({
      id: companyPosts.id,
      tenantId: companyPosts.tenantId,
      authorId: companyPosts.authorId,
      authorFirstName: sql<string>`${employees.firstName}`,
      authorLastName: sql<string>`${employees.lastName}`,
      title: companyPosts.title,
      content: companyPosts.content,
      postType: companyPosts.postType,
      images: companyPosts.images,
      likesCount: companyPosts.likesCount,
      commentsCount: companyPosts.commentsCount,
      isPinned: companyPosts.isPinned,
      createdAt: companyPosts.createdAt,
    })
      .from(companyPosts)
      .leftJoin(employees, eq(companyPosts.authorId, employees.id))
      .where(eq(companyPosts.id, id));

    if (!post) return undefined;

    return {
      ...post,
      authorName: `${post.authorFirstName || ""} ${post.authorLastName || ""}`.trim() || "Unknown",
    };
  }

  async createCompanyPost(post: DbInsertCompanyPost): Promise<CompanyPost> {
    const [created] = await db.insert(companyPosts).values(post).returning();
    return created;
  }

  async updateCompanyPost(id: string, updates: Partial<DbInsertCompanyPost>): Promise<CompanyPost> {
    const [updated] = await db.update(companyPosts)
      .set(updates)
      .where(eq(companyPosts.id, id))
      .returning();
    if (!updated) throw new Error("Post not found");
    return updated;
  }

  async deleteCompanyPost(id: string): Promise<void> {
    await db.delete(companyPosts).where(eq(companyPosts.id, id));
  }

  async togglePostLike(tenantId: string, postId: string, employeeId: string): Promise<{ liked: boolean; likesCount: number }> {
    // Check if already liked
    const [existing] = await db.select()
      .from(postLikes)
      .where(and(
        eq(postLikes.tenantId, tenantId),
        eq(postLikes.postId, postId),
        eq(postLikes.employeeId, employeeId)
      ));

    if (existing) {
      // Unlike - remove like
      await db.delete(postLikes).where(eq(postLikes.id, existing.id));

      // Update likes count
      const [post] = await db.select().from(companyPosts).where(eq(companyPosts.id, postId));
      if (post) {
        await db.update(companyPosts)
          .set({ likesCount: Math.max(0, Number(post.likesCount) - 1) })
          .where(eq(companyPosts.id, postId));
      }

      const [updated] = await db.select().from(companyPosts).where(eq(companyPosts.id, postId));
      return {
        liked: false,
        likesCount: updated ? Number(updated.likesCount) : 0,
      };
    } else {
      // Like - add like
      await db.insert(postLikes).values({
        tenantId,
        postId,
        employeeId,
        createdAt: new Date(),
      });

      // Update likes count
      const [post] = await db.select().from(companyPosts).where(eq(companyPosts.id, postId));
      if (post) {
        await db.update(companyPosts)
          .set({ likesCount: Number(post.likesCount) + 1 })
          .where(eq(companyPosts.id, postId));
      }

      // Award points for giving kudos (5 points)
      await this.awardPoints(tenantId, employeeId, 5, "Kudos өгсөн", "kudos", postId).catch(console.error);

      const [updated] = await db.select().from(companyPosts).where(eq(companyPosts.id, postId));
      return {
        liked: true,
        likesCount: updated ? Number(updated.likesCount) : 0,
      };
    }
  }

  async getPostLikes(tenantId: string, postId: string): Promise<any[]> {
    return await db.select({
      id: postLikes.id,
      employeeId: postLikes.employeeId,
      employeeFirstName: sql<string>`${employees.firstName}`,
      employeeLastName: sql<string>`${employees.lastName}`,
      createdAt: postLikes.createdAt,
    })
      .from(postLikes)
      .leftJoin(employees, eq(postLikes.employeeId, employees.id))
      .where(and(eq(postLikes.tenantId, tenantId), eq(postLikes.postId, postId)))
      .orderBy(desc(postLikes.createdAt));
  }

  async createPostComment(comment: DbInsertPostComment): Promise<PostComment> {
    const [created] = await db.insert(postComments).values(comment).returning();

    // Update comments count
    const [post] = await db.select().from(companyPosts).where(eq(companyPosts.id, comment.postId));
    if (post) {
      await db.update(companyPosts)
        .set({ commentsCount: Number(post.commentsCount) + 1 })
        .where(eq(companyPosts.id, comment.postId));
    }

    return created;
  }

  async getPostComments(tenantId: string, postId: string): Promise<any[]> {
    return await db.select({
      id: postComments.id,
      tenantId: postComments.tenantId,
      postId: postComments.postId,
      employeeId: postComments.employeeId,
      employeeFirstName: sql<string>`${employees.firstName}`,
      employeeLastName: sql<string>`${employees.lastName}`,
      content: postComments.content,
      createdAt: postComments.createdAt,
    })
      .from(postComments)
      .leftJoin(employees, eq(postComments.employeeId, employees.id))
      .where(and(eq(postComments.tenantId, tenantId), eq(postComments.postId, postId)))
      .orderBy(asc(postComments.createdAt));
  }

  async deletePostComment(id: string): Promise<void> {
    // Get comment to update post count
    const [comment] = await db.select().from(postComments).where(eq(postComments.id, id));

    await db.delete(postComments).where(eq(postComments.id, id));

    // Update comments count
    if (comment) {
      const [post] = await db.select().from(companyPosts).where(eq(companyPosts.id, comment.postId));
      if (post) {
        await db.update(companyPosts)
          .set({ commentsCount: Math.max(0, Number(post.commentsCount) - 1) })
          .where(eq(companyPosts.id, comment.postId));
      }
    }
  }

  // --- Weather Widget ---
  async getWeatherSettings(tenantId: string): Promise<WeatherSettings | undefined> {
    const [settings] = await db.select()
      .from(weatherSettings)
      .where(eq(weatherSettings.tenantId, tenantId))
      .limit(1);
    return settings;
  }

  async upsertWeatherSettings(tenantId: string, settings: Partial<DbInsertWeatherSettings>): Promise<WeatherSettings> {
    const existing = await this.getWeatherSettings(tenantId);

    if (existing) {
      const [updated] = await db.update(weatherSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(weatherSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(weatherSettings)
        .values({
          ...settings,
          tenantId,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as DbInsertWeatherSettings)
        .returning();
      return created;
    }
  }

  async getWeatherAlerts(tenantId: string, limit: number = 10): Promise<WeatherAlert[]> {
    return await db.select()
      .from(weatherAlerts)
      .where(eq(weatherAlerts.tenantId, tenantId))
      .orderBy(desc(weatherAlerts.createdAt))
      .limit(limit);
  }

  async createWeatherAlert(alert: DbInsertWeatherAlert): Promise<WeatherAlert> {
    const [created] = await db.insert(weatherAlerts).values(alert).returning();
    return created;
  }

  async markWeatherAlertAsSent(id: string): Promise<void> {
    await db.update(weatherAlerts)
      .set({ isSent: true, sentAt: new Date() })
      .where(eq(weatherAlerts.id, id));
  }

  // --- Documents ---
  async getDocuments(tenantId: string, parentId?: string | null): Promise<Document[]> {
    if (parentId) {
      return await db.select().from(documents)
        .where(
          and(
            eq(documents.tenantId, tenantId),
            eq(documents.parentId, parentId)
          )
        )
        .orderBy(desc(documents.type), asc(documents.name)); // Folders first
    } else {
      return await db.select().from(documents)
        .where(
          and(
            eq(documents.tenantId, tenantId),
            sql`${documents.parentId} IS NULL`
          )
        )
        .orderBy(desc(documents.type), asc(documents.name));
    }
  }

  async createDocument(doc: DbInsertDocument): Promise<Document> {
    const [d] = await db.insert(documents).values(doc).returning();
    return d;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  async signDocument(id: string, userId: string): Promise<Document> {
    const [signedDoc] = await db
      .update(documents)
      .set({
        isSigned: true,
        signedBy: userId,
        signedAt: new Date(),
        updatedAt: new Date()
      })
      .where(eq(documents.id, id))
      .returning();

    if (!signedDoc) throw new Error("Document not found");
    return signedDoc;
  }

  async seedDocuments(tenantId: string, userId: string): Promise<void> {
    const existing = await db.select().from(documents).where(eq(documents.tenantId, tenantId)).limit(1);
    if (existing.length > 0) return;

    // Create System Generated folder
    const [systemFolder] = await db.insert(documents).values({
      tenantId,
      name: "System Generated",
      type: "folder",
      path: "/System Generated",
      uploadedBy: userId,
    } as any).returning();

    // Create Invoices folder
    const [invoicesFolder] = await db.insert(documents).values({
      tenantId,
      name: "Invoices",
      type: "folder",
      path: "/System Generated/Invoices",
      parentId: systemFolder.id,
      uploadedBy: userId,
    } as any).returning();

    // Create Mock Files
    const files = ["INV-2024-001.pdf", "INV-2024-002.pdf", "INV-2024-003.pdf"];
    for (const name of files) {
      await db.insert(documents).values({
        tenantId,
        name,
        type: "file",
        path: `/System Generated/Invoices/${name}`,
        parentId: invoicesFolder.id,
        mimeType: "application/pdf",
        size: Math.floor(Math.random() * 500000) + 100000,
        uploadedBy: userId,
      } as any);
    }
  }

  async ensureInvoiceFolder(tenantId: string, userId: string): Promise<string> {
    // 1. Check System Generated
    let [systemFolder] = await db.select().from(documents).where(and(eq(documents.tenantId, tenantId), eq(documents.name, "System Generated"), eq(documents.type, "folder")));

    if (!systemFolder) {
      [systemFolder] = await db.insert(documents).values({
        tenantId,
        name: "System Generated",
        type: "folder",
        path: "/System Generated",
        uploadedBy: userId,
      } as any).returning();
    }

    // 2. Check Invoices
    let [invoicesFolder] = await db.select().from(documents).where(and(eq(documents.tenantId, tenantId), eq(documents.name, "Invoices"), eq(documents.parentId, systemFolder.id)));

    if (!invoicesFolder) {
      [invoicesFolder] = await db.insert(documents).values({
        tenantId,
        name: "Invoices",
        type: "folder",
        path: "/System Generated/Invoices",
        parentId: systemFolder.id,
        uploadedBy: userId,
      } as any).returning();
    }

    return invoicesFolder.id;
  }

  async updateUserSignature(userId: string, signatureUrl: string | null, jobTitle?: string | null): Promise<User> {
    const updateData: any = { signatureUrl, updatedAt: new Date() };
    if (jobTitle !== undefined) {
      updateData.jobTitle = jobTitle;
    }
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async updateUserPermissions(userId: string, permissions: { canSignDocuments?: boolean; jobTitle?: string | null }): Promise<User> {
    const updateData: any = { updatedAt: new Date() };
    if (permissions.canSignDocuments !== undefined) {
      updateData.canSignDocuments = permissions.canSignDocuments;
    }
    if (permissions.jobTitle !== undefined) {
      updateData.jobTitle = permissions.jobTitle?.trim().slice(0, 80) || null;
    }
    const [user] = await db
      .update(users)
      .set(updateData)
      .where(eq(users.id, userId))
      .returning();
    if (!user) throw new Error("User not found");
    return user;
  }

  async bulkDeleteDocuments(ids: string[]): Promise<void> {
    if (!ids.length) return;

    // 1. Check for non-empty folders
    const contents = await db.select().from(documents).where(inArray(documents.id, ids));

    for (const doc of contents) {
      if (doc.type === 'folder') {
        const [child] = await db.select({ id: documents.id }).from(documents).where(eq(documents.parentId, doc.id)).limit(1);
        if (child) {
          throw new Error(`Хавтас хоосон биш байна: ${doc.name}`);
        }
      }
    }

    // 2. Proceed with delete if all checks pass
    await db.delete(documents).where(inArray(documents.id, ids));
  }

  async updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document> {
    const [doc] = await db
      .update(documents)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(documents.id, id))
      .returning();

    if (!doc) throw new Error("Document not found");
    return doc;
  }

  // --- Helper: Calculate Cash Flow Projection ---
  // Calculate projected cash flow for next 7 days based on historical patterns
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
  } {
    // Calculate average daily revenue (based on current month)
    const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
    const daysPassed = new Date().getDate();
    const avgDailyRevenue = daysPassed > 0 ? monthlyRevenue / daysPassed : monthlyRevenue / daysInMonth;

    // Project next 7 days revenue
    const next7DaysRevenue = avgDailyRevenue * 7;

    // Calculate average daily payroll (based on current month)
    const avgDailyPayroll = daysInMonth > 0 ? monthlyPayroll / daysInMonth : monthlyPayroll / 30;

    // Project next 7 days expenses (mainly payroll)
    const next7DaysExpenses = avgDailyPayroll * 7;

    // Net cash flow
    const netCashFlow = next7DaysRevenue - next7DaysExpenses;

    // Generate recommendation
    let recommendation = "";
    if (netCashFlow > 0) {
      recommendation = "Эрүүл мэнд сайн";
    } else if (netCashFlow > -1000000) {
      recommendation = "Эртхэн арга хэмжээ аваарай";
    } else {
      recommendation = "Яаралтай арга хэмжээ шаардлагатай";
    }

    return {
      next7DaysRevenue: Math.round(next7DaysRevenue),
      next7DaysExpenses: Math.round(next7DaysExpenses),
      netCashFlow: Math.round(netCashFlow),
      recommendation,
    };
  }

  // --- Stats ---
  async getStats(tenantId: string): Promise<any> {
    const [empCount] = await db.select({ count: sql<number>`count(*)` }).from(employees).where(eq(employees.tenantId, tenantId));
    const [deptCount] = await db.select({ count: sql<number>`count(*)` }).from(departments).where(eq(departments.tenantId, tenantId));
    const [activeEmpCount] = await db.select({ count: sql<number>`count(*)` }).from(employees).where(and(eq(employees.tenantId, tenantId), eq(employees.status, "active")));

    // Calculate monthly payroll from payslips
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();
    const payslips = await this.getAllPayslips(tenantId);
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
    const payrollByMonth: Array<{ name: string; value: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date();
      monthDate.setMonth(monthDate.getMonth() - i);
      const monthName = `${monthDate.getMonth() + 1}-р сар`;
      const monthPayroll = payslips
        .filter((p: any) => {
          if (!p.periodStart) return false;
          const periodDate = new Date(p.periodStart);
          return periodDate.getMonth() === monthDate.getMonth() && periodDate.getFullYear() === monthDate.getFullYear();
        })
        .reduce((sum: number, p: any) => {
          const netPay = Number(p.netPay || 0);
          return sum + (isNaN(netPay) ? 0 : netPay);
        }, 0);
      payrollByMonth.push({ name: monthName, value: Math.round(monthPayroll) });
    }

    // Ensure we have data for all 6 months (fill with 0 if missing)
    if (payrollByMonth.length === 0) {
      for (let i = 5; i >= 0; i--) {
        const monthDate = new Date();
        monthDate.setMonth(monthDate.getMonth() - i);
        const monthName = `${monthDate.getMonth() + 1}-р сар`;
        payrollByMonth.push({ name: monthName, value: 0 });
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

    // Debug logging (temporary)
    console.log(`[getStats] tenantId: ${tenantId}, totalInvoices: ${allInvoices.length}, salesByMonth length: ${salesByMonth.length}, first value: ${salesByMonth[0]?.value || 0}`);

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
      .orderBy(desc(invoices.createdAt))
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
    // Fix: Ensure proper calculation order with parentheses
    const activeCount = Number(activeEmpCount?.count || 0);
    const todayAbsent = Math.max(0, activeCount - todayPresent - todayLate); // Ensure non-negative
    // Ensure rate is always a number (never null)
    const todayAttendanceRate = activeCount > 0 ? Math.round((todayPresent / activeCount) * 100) : 0;

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
      // Check if employee has contractEnd field (may need to add this to schema)
      // For now, we'll use hireDate + 365 days as a placeholder
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
    const allInvoicesForEbarimt = await db.select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      ebarimtDocumentId: invoices.ebarimtDocumentId,
      ebarimtLotteryNumber: invoices.ebarimtLotteryNumber,
      status: invoices.status,
      type: invoices.type,
      invoiceDate: invoices.invoiceDate,
      createdAt: invoices.createdAt,
    })
      .from(invoices)
      .where(and(eq(invoices.tenantId, tenantId), eq(invoices.type, "sales"), eq(invoices.status, "posted")));

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

    const lastSyncTime = latestSent?.createdAt
      // @ts-ignore - pre-existing type issue
      ? format(new Date(latestSent.createdAt), "HH:mm")
      : null;


    // Calculate "lottery win probability" (just for fun - based on sent invoices)
    const lotteryWinProbability = totalSent > 0 ? Math.min(98, Math.round((sentWithLottery / totalSent) * 100 + Math.random() * 10)) : 0;

    // Get recent activity feed from audit logs (last 20 events)
    const recentActivities = await this.getAuditLogs(tenantId, { limit: 20 });
    const activityFeed = recentActivities.map((log: any) => {
      // Format activity message based on entity type and action
      let message = "";
      let icon = "activity";

      // Extract data from afterData or beforeData (JSONB fields)
      const data = log.afterData || log.beforeData || {};

      if (log.entityType === "employee") {
        if (log.action === "create") {
          const firstName = data.firstName || data.first_name;
          const lastName = data.lastName || data.last_name;
          message = `${firstName || ""} ${lastName || ""}`.trim() || "Шинэ ажилтан";
          message += " ажилд орлоо";
          icon = "user-plus";
        } else if (log.action === "update") {
          const firstName = data.firstName || data.first_name;
          message = `${firstName || "Ажилтан"} мэдээлэл шинэчлэгдлээ`;
          icon = "user-edit";
        } else if (log.action === "delete") {
          const firstName = data.firstName || data.first_name;
          message = `${firstName || "Ажилтан"} ажлаас гарлаа`;
          icon = "user-minus";
        }
      } else if (log.entityType === "salary_advance") {
        if (log.action === "create") {
          const empName = data.employeeName || data.firstName;
          message = `${empName || "Ажилтан"} цалингийн урьдчилгаа хүсэлт илгээлээ`;
          icon = "credit-card";
        } else if (log.action === "approve") {
          const empName = data.employeeName || data.firstName;
          message = `${empName || "Ажилтны"} урьдчилгаа хүсэлт батлагдлаа`;
          icon = "check-circle";
        } else if (log.action === "reject") {
          const empName = data.employeeName || data.firstName;
          message = `${empName || "Ажилтны"} урьдчилгаа хүсэлт хүлээсэн`;
          icon = "x-circle";
        }
      } else if (log.entityType === "attendance" || log.entityType === "attendance_day") {
        if (log.action === "create") {
          const empName = data.employeeName || data.firstName;
          message = `${empName || "Ажилтан"} ирц бүртгүүллээ`;
          icon = "clock-in";
        }
      } else if (log.entityType === "invoice") {
        if (log.action === "create") {
          const invoiceNumber = data.invoiceNumber || data.invoice_number;
          message = `Нэхэмжлэх ${invoiceNumber || ""} үүсгэгдлээ`.trim();
          icon = "file-text";
        } else if (log.action === "post") {
          const invoiceNumber = data.invoiceNumber || data.invoice_number;
          message = `Нэхэмжлэх ${invoiceNumber || ""} батлагдлаа`.trim();
          icon = "check-circle";
        }
      } else if (log.entityType === "payroll" || log.entityType === "payroll_run") {
        if (log.action === "create") {
          const periodStart = data.periodStart || data.period_start;
          message = `Цалингийн бодолт ${periodStart || ""} бэлтгэгдлээ`.trim();
          icon = "dollar-sign";
        }
      }

      // If no specific message, use log.message or generic format
      if (!message) {
        message = log.message || `${log.entityType || "Үйл явдал"} - ${log.action || "шинэчлэлт"}`;
      }

      return {
        id: log.id,
        message,
        icon,
        eventTime: log.eventTime,
        actorUserId: log.actorUserId,
        entityType: log.entityType,
        entityId: log.entityId,
      };
    });

    return {
      totalEmployees: Number(empCount?.count || 0),
      activeEmployees: Number(activeEmpCount?.count || 0),
      totalDepartments: Number(deptCount?.count || 0),
      monthlyPayroll: monthlyPayroll || 0,
      totalProducts: Number(productCount?.count || 0),
      totalCustomers: Number(customerCount?.count || 0),
      totalInvoices: Number(invoiceCount?.count || 0),
      monthlyRevenue: monthlyRevenue || 0,
      payrollByMonth: payrollByMonth.length > 0 ? payrollByMonth : [],
      salesByMonth: salesByMonth.length > 0 ? salesByMonth : [],
      attendanceByDay: Object.keys(attendanceByDay).length > 0 ? Object.entries(attendanceByDay).map(([name, data]) => ({
        name,
        present: data.total > 0 ? Math.round((data.present / data.total) * 100) : 0,
        late: data.total > 0 ? Math.round((data.late / data.total) * 100) : 0,
      })) : [],
      recentInvoices: recentInvoices.map((inv: any) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        totalAmount: Number(inv.totalAmount || 0),
        invoiceDate: inv.invoiceDate,
        status: inv.status,
        contactName: inv.contactName || "Unknown",
      })),
      // New fields for enhanced dashboard
      todayAttendance: {
        present: Number(todayPresent) || 0,
        late: Number(todayLate) || 0,
        absent: Number(todayAbsent) || 0,
        rate: Number(todayAttendanceRate) || 0, // Ensure rate is never null
      },
      pendingRequests: pendingRequestsCount,
      birthdays: todayBirthdays,
      contractExpiry,
      trialPeriod,
      payrollBudgetUsage,
      activityFeed,
      // E-barimt status
      ebarimtStatus: {
        unsentCount: unsentEbarimtCount,
        lotteryWinProbability,
        totalSent,
        todaySent,
        successful,
        failed,
        lastSyncTime,
      },
      // AI Cash Flow - Project next 7 days based on historical data
      cashFlowProjection: this.calculateCashFlowProjection(
        monthlyPayroll,
        monthlyRevenue,
        allInvoices,
        payslips,
        currentMonth,
        currentYear
      ),
      // HR Gamification: Leaderboard (top 5 by points)
      wallOfFame: await this.getLeaderboardData(tenantId, 5),
      // News Feed: Recent posts (last 5)
      recentPosts: await this.getCompanyPosts(tenantId, 5),

      // Invoice Payment Status (Cashflow) - Get all invoices for calculation
      invoicePaymentStatus: await this.calculateInvoicePaymentStatus(tenantId),
    };
  }

  // Helper: Calculate invoice payment status for cashflow widget
  private async calculateInvoicePaymentStatus(tenantId: string): Promise<{
    todayPaid: number;
    overdue: number;
    next7Days: number;
    totalUnpaid: number;
  }> {
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
        // Check if paid today (simplified - check if status is paid)
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
  private async getLeaderboardData(tenantId: string, limit: number = 5): Promise<any[]> {
    const employees = await this.getEmployees(tenantId);
    const leaderboard = await Promise.all(
      employees.map(async (emp: any) => {
        const points = await this.getEmployeePoints(tenantId, emp.id);
        const achievements = await this.getEmployeeAchievements(tenantId, emp.id);
        return {
          id: emp.id,
          name: `${emp.firstName} ${emp.lastName}`,
          employeeNo: emp.employeeNo,
          points: points ? Number(points.points) : 0,
          achievementsCount: achievements.length,
          latestAchievement: achievements.length > 0 ? {
            type: achievements[0].achievementType,
            achievedAt: achievements[0].achievedAt,
          } : null,
        };
      })
    );

    // Sort by points descending
    leaderboard.sort((a: any, b: any) => b.points - a.points);
    return leaderboard.slice(0, limit).map((item: any, index: number) => ({
      ...item,
      rank: String(index + 1), // Convert to string to match schema
      kudos: item.points, // For compatibility with Dashboard
    }));
  }

  // --- Products ---
  async getProducts(tenantId: string): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.tenantId, tenantId)).orderBy(desc(products.createdAt));
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product;
  }

  async createProduct(insertProduct: DbInsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: string, update: Partial<InsertProduct>): Promise<Product> {
    const [product] = await db.update(products).set(update).where(eq(products.id, id)).returning();
    return product;
  }

  // --- Product Categories ---
  async getProductCategories(tenantId: string): Promise<ProductCategory[]> {
    return await db.select().from(productCategories).where(eq(productCategories.tenantId, tenantId));
  }

  async createProductCategory(category: DbInsertProductCategory): Promise<ProductCategory> {
    const [cat] = await db.insert(productCategories).values(category).returning();
    return cat;
  }

  // --- Contacts ---
  async getContacts(tenantId: string, type?: string): Promise<Contact[]> {
    if (type) {
      return await db.select().from(contacts).where(and(eq(contacts.tenantId, tenantId), eq(contacts.type, type))).orderBy(desc(contacts.createdAt));
    }
    return await db.select().from(contacts).where(eq(contacts.tenantId, tenantId)).orderBy(desc(contacts.createdAt));
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
    return contact;
  }

  async createContact(insertContact: DbInsertContact): Promise<Contact> {
    const [contact] = await db.insert(contacts).values(insertContact).returning();
    return contact;
  }

  async updateContact(id: string, update: Partial<InsertContact>): Promise<Contact> {
    const [contact] = await db.update(contacts).set(update).where(eq(contacts.id, id)).returning();
    return contact;
  }

  // --- Warehouses ---
  async getWarehouses(tenantId: string): Promise<Warehouse[]> {
    return await db.select().from(warehouses).where(eq(warehouses.tenantId, tenantId));
  }

  async createWarehouse(warehouse: DbInsertWarehouse): Promise<Warehouse> {
    const [w] = await db.insert(warehouses).values(warehouse).returning();
    return w;
  }

  // --- Stock ---
  async getStockLevels(tenantId: string, warehouseId?: string): Promise<any[]> {
    const baseCondition = warehouseId
      ? and(eq(stockLevels.tenantId, tenantId), eq(stockLevels.warehouseId, warehouseId))
      : eq(stockLevels.tenantId, tenantId);

    return await db.select({
      id: stockLevels.id,
      warehouseId: stockLevels.warehouseId,
      productId: stockLevels.productId,
      quantity: stockLevels.quantity,
      reservedQuantity: stockLevels.reservedQuantity,
      warehouseName: warehouses.name,
      productName: products.name,
      productSku: products.sku
    })
      .from(stockLevels)
      .leftJoin(warehouses, eq(stockLevels.warehouseId, warehouses.id))
      .leftJoin(products, eq(stockLevels.productId, products.id))
      .where(baseCondition);
  }

  async bulkDeleteStockLevels(tenantId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await db.delete(stockLevels)
      .where(
        and(
          eq(stockLevels.tenantId, tenantId),
          inArray(stockLevels.id, ids)
        )
      );
  }

  async bulkResetStockLevels(tenantId: string, ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await db.update(stockLevels)
      .set({ quantity: "0", updatedAt: new Date() })
      .where(
        and(
          eq(stockLevels.tenantId, tenantId),
          inArray(stockLevels.id, ids)
        )
      );
  }

  async updateStock(
    tenantId: string,
    warehouseId: string,
    productId: string,
    quantity: number,
    type: string,
    reference?: string,
    referenceId?: string,
    batchNumber?: string | null,
    expiryDate?: string | null
  ): Promise<void> {
    // Validate batch/expiry for trackExpiry products
    if (type === "out") {
      const product = await this.getProduct(productId);
      if (product && (product as any).trackExpiry) {
        if (!batchNumber) {
          throw new Error("Batch number is required for products with expiry tracking");
        }
        if (!expiryDate) {
          throw new Error("Expiry date is required for products with expiry tracking");
        }
        // Validate expiry date is not in the future
        const expiry = new Date(expiryDate);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (expiry > today) {
          // Allow future dates for IN movements, but warn for OUT
          console.warn(`Expiry date ${expiryDate} is in the future for OUT movement`);
        }
      }
    }

    // Update or create stock level
    const existing = await db.select().from(stockLevels).where(
      and(
        eq(stockLevels.warehouseId, warehouseId),
        eq(stockLevels.productId, productId)
      )
    );

    if (existing.length > 0) {
      const currentQty = Number(existing[0].quantity);
      const newQty = type === "in" ? currentQty + quantity : currentQty - quantity;
      await db.update(stockLevels).set({ quantity: newQty.toString(), updatedAt: new Date() }).where(eq(stockLevels.id, existing[0].id));
    } else if (type === "in") {
      await db.insert(stockLevels).values({
        tenantId,
        warehouseId,
        productId,
        quantity: quantity.toString(),
        reservedQuantity: "0"
      });
    }

    // Log stock movement with batch/expiry
    await db.insert(stockMovements).values({
      tenantId,
      warehouseId,
      productId,
      type,
      quantity: quantity.toString(),
      reference,
      referenceId,
      batchNumber: batchNumber || null,
      expiryDate: expiryDate || null
    });
  }

  async getStockMovements(tenantId: string, warehouseId?: string, productId?: string): Promise<any[]> {
    const conditions = [eq(stockMovements.tenantId, tenantId)];
    if (warehouseId) conditions.push(eq(stockMovements.warehouseId, warehouseId));
    if (productId) conditions.push(eq(stockMovements.productId, productId));

    return await db.select({
      id: stockMovements.id,
      warehouseId: stockMovements.warehouseId,
      productId: stockMovements.productId,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
      batchNumber: stockMovements.batchNumber,
      expiryDate: stockMovements.expiryDate,
      reference: stockMovements.reference,
      referenceId: stockMovements.referenceId,
      note: stockMovements.note,
      createdAt: stockMovements.createdAt,
      warehouseName: warehouses.name,
      productName: products.name,
      productSku: products.sku
    })
      .from(stockMovements)
      .leftJoin(warehouses, eq(stockMovements.warehouseId, warehouses.id))
      .leftJoin(products, eq(stockMovements.productId, products.id))
      .where(and(...conditions))
      .orderBy(desc(stockMovements.createdAt));
  }

  async getExpiryAlerts(tenantId: string, days: number = 30, warehouseId?: string): Promise<any[]> {
    // Get current date in Asia/Ulaanbaatar timezone
    // Note: PostgreSQL stores dates in UTC, but we calculate in local timezone
    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + days);

    const conditions = [
      eq(stockMovements.tenantId, tenantId),
      sql`${stockMovements.expiryDate} IS NOT NULL`,
      sql`${stockMovements.expiryDate} <= ${targetDate.toISOString().split('T')[0]}`
    ];

    if (warehouseId) {
      conditions.push(eq(stockMovements.warehouseId, warehouseId));
    }

    // Get all movements with expiry dates
    const movements = await db.select({
      warehouseId: stockMovements.warehouseId,
      productId: stockMovements.productId,
      batchNumber: stockMovements.batchNumber,
      expiryDate: stockMovements.expiryDate,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
      productName: products.name,
      productSku: products.sku,
      warehouseName: warehouses.name
    })
      .from(stockMovements)
      .leftJoin(products, eq(stockMovements.productId, products.id))
      .leftJoin(warehouses, eq(stockMovements.warehouseId, warehouses.id))
      .where(and(...conditions));

    // Calculate remaining stock per batch
    const stockMap = new Map<string, {
      productId: string;
      productName: string;
      productSku: string | null;
      warehouseId: string;
      warehouseName: string;
      batchNumber: string | null;
      expiryDate: string;
      quantity: number;
      daysUntilExpiry: number;
    }>();

    for (const mov of movements) {
      const key = `${mov.productId}-${mov.warehouseId}-${mov.batchNumber || 'no-batch'}-${mov.expiryDate}`;
      const current = stockMap.get(key) || {
        productId: mov.productId,
        productName: mov.productName || '',
        productSku: mov.productSku,
        warehouseId: mov.warehouseId,
        warehouseName: mov.warehouseName || '',
        batchNumber: mov.batchNumber,
        expiryDate: mov.expiryDate,
        quantity: 0,
        daysUntilExpiry: 0
      };

      const qty = Number(mov.quantity);
      if (mov.type === 'in') {
        current.quantity += qty;
      } else if (mov.type === 'out') {
        current.quantity -= qty;
      }

      // Calculate days until expiry
      // @ts-ignore - pre-existing type issue with expiryDate
      const expiry = new Date(mov.expiryDate);
      const diffTime = expiry.getTime() - today.getTime();
      current.daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      // @ts-ignore - pre-existing type issue with Map
      stockMap.set(key, current);
    }

    // Filter out zero or negative quantities and return as array
    return Array.from(stockMap.values())
      .filter(item => item.quantity > 0)
      .sort((a, b) => {
        // Sort by days until expiry (soonest first)
        return a.daysUntilExpiry - b.daysUntilExpiry;
      });
  }

  async getFEFOSuggest(tenantId: string, productId: string, warehouseId: string, quantity: number): Promise<any[]> {
    // Get all IN movements with expiry dates for this product/warehouse
    const movements = await db.select({
      batchNumber: stockMovements.batchNumber,
      expiryDate: stockMovements.expiryDate,
      type: stockMovements.type,
      quantity: stockMovements.quantity,
    })
      .from(stockMovements)
      .where(
        and(
          eq(stockMovements.tenantId, tenantId),
          eq(stockMovements.productId, productId),
          eq(stockMovements.warehouseId, warehouseId),
          sql`${stockMovements.expiryDate} IS NOT NULL`
        )
      )
      .orderBy(asc(stockMovements.expiryDate), asc(stockMovements.createdAt));

    // Calculate remaining stock per batch
    const stockMap = new Map<string, {
      batchNumber: string | null;
      expiryDate: string;
      quantity: number;
      daysUntilExpiry: number;
    }>();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const mov of movements) {
      if (!mov.expiryDate) continue;

      const key = `${mov.batchNumber || 'no-batch'}-${mov.expiryDate}`;
      const current = stockMap.get(key) || {
        batchNumber: mov.batchNumber,
        expiryDate: mov.expiryDate,
        quantity: 0,
        daysUntilExpiry: 0
      };

      const qty = Number(mov.quantity);
      if (mov.type === 'in') {
        current.quantity += qty;
      } else if (mov.type === 'out') {
        current.quantity -= qty;
      }

      // Calculate days until expiry
      const expiry = new Date(mov.expiryDate);
      const diffTime = expiry.getTime() - today.getTime();
      current.daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      stockMap.set(key, current);
    }

    // Filter out zero/negative quantities, sort by expiry date (FEFO)
    return Array.from(stockMap.values())
      .filter(item => item.quantity > 0)
      .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
      .slice(0, 10); // Return top 10 suggestions
  }

  async getInventoryStats(tenantId: string): Promise<{ totalValue: number; lowStockCount: number; expiringCount: number }> {
    // Get all stock levels
    const levels = await this.getStockLevels(tenantId);

    let totalValue = 0;
    let lowStockCount = 0;
    let expiringCount = 0;

    for (const level of levels) {
      // Calculate Total Value (Quantity * Cost Price)
      // Note: level object from getStockLevels already joins with products but might not select costPrice
      // We might need to fetch cost price if it's not in the view, but let's check product schema or join matches.
      // Assuming getStockLevels joins product. checking level properties... 
      // Actually getStockLevels implementation joins stockMovements but aggregates them. 
      // It doesn't seem to pull costPrice directly in the aggregation if not explicitly added.
      // Let's rely on products table lookup or update getStockLevels. 
      // For now, let's just fetch products to get cost prices.
      // Optimization: Fetch all products first to map cost prices.
    }

    // Optimization: Calculate aggregates directly in SQL if possible, but given the logic in getStockLevels is complex (aggregating movements),
    // we might need to iterate.

    // Better approach: Let's reuse existing logic but optimized.
    // 1. Total Value: derived from current quantity * product cost.
    // 2. Low Stock: quantity < 10.
    // 3. Expiring: expiryDate < 30 days.

    const allProducts = await db.select().from(products).where(eq(products.tenantId, tenantId));
    const productMap = new Map(allProducts.map(p => [p.id, Number(p.costPrice || 0)]));

    // Re-calculating stats from levels
    for (const level of levels) {
      const qty = Number(level.quantity || 0);
      const cost = productMap.get(level.productId) || 0;

      totalValue += qty * cost;

      // Low Stock Logic (Simple < 10 threshold)
      if (qty < 10) {
        lowStockCount++;
      }
    }

    // For expiring count, we need the expiry alerts.
    // Reuse existing query logic for expiry
    const alerts = await this.getExpiryAlerts(tenantId, 30);
    expiringCount = alerts.length;

    return {
      totalValue,
      lowStockCount,
      expiringCount
    };
  }

  // --- Sales Orders ---
  async getSalesOrders(tenantId: string): Promise<any[]> {
    return await db.select({
      id: salesOrders.id,
      orderNumber: salesOrders.orderNumber,
      orderDate: salesOrders.orderDate,
      deliveryDate: salesOrders.deliveryDate,
      status: salesOrders.status,
      paymentStatus: salesOrders.paymentStatus,
      totalAmount: salesOrders.totalAmount,
      // Customer name with proper null handling - prevents "null null" or " -" displays
      customerName: sql<string>`COALESCE(
        ${contacts.companyName}, 
        NULLIF(TRIM(COALESCE(${contacts.firstName}, '') || ' ' || COALESCE(${contacts.lastName}, '')), ''),
        'Үйлчлүүлэгч сонгоогүй'
      )`,
      customerEmail: contacts.email // For email action in UI
    })
      .from(salesOrders)
      .leftJoin(contacts, eq(salesOrders.customerId, contacts.id))
      .where(eq(salesOrders.tenantId, tenantId))
      .orderBy(desc(salesOrders.createdAt));
  }

  async getSalesOrder(id: string): Promise<any | undefined> {
    // Get order with customer details
    const [order] = await db.select({
      id: salesOrders.id,
      tenantId: salesOrders.tenantId,
      branchId: salesOrders.branchId,
      warehouseId: salesOrders.warehouseId,
      customerId: salesOrders.customerId,
      orderNumber: salesOrders.orderNumber,
      orderDate: salesOrders.orderDate,
      deliveryDate: salesOrders.deliveryDate,
      status: salesOrders.status,
      paymentStatus: salesOrders.paymentStatus,
      subtotal: salesOrders.subtotal,
      taxAmount: salesOrders.taxAmount,
      discountAmount: salesOrders.discountAmount,
      totalAmount: salesOrders.totalAmount,
      notes: salesOrders.notes,
      createdBy: salesOrders.createdBy,
      createdAt: salesOrders.createdAt,
      updatedAt: salesOrders.updatedAt,
      // Customer info
      customerName: sql<string>`COALESCE(
        ${contacts.companyName}, 
        NULLIF(TRIM(COALESCE(${contacts.firstName}, '') || ' ' || COALESCE(${contacts.lastName}, '')), ''),
        'Үйлчлүүлэгч сонгоогүй'
      )`,
      customerEmail: contacts.email,
      customerPhone: contacts.phone
    })
      .from(salesOrders)
      .leftJoin(contacts, eq(salesOrders.customerId, contacts.id))
      .where(eq(salesOrders.id, id));

    if (!order) return undefined;

    // Get order lines with product details
    const lines = await db.select({
      id: salesOrderLines.id,
      productId: salesOrderLines.productId,
      productName: products.name,
      quantity: salesOrderLines.quantity,
      unitPrice: salesOrderLines.unitPrice,
      discount: salesOrderLines.discount,
      taxRate: salesOrderLines.taxRate,
      subtotal: salesOrderLines.subtotal,
      taxAmount: salesOrderLines.taxAmount,
      total: salesOrderLines.total,
      description: salesOrderLines.description
    })
      .from(salesOrderLines)
      .leftJoin(products, eq(salesOrderLines.productId, products.id))
      .where(eq(salesOrderLines.salesOrderId, id));

    // Calculate paid amount from related invoices
    const invoiceData = await db.select({
      paidAmount: invoices.paidAmount
    })
      .from(invoices)
      .where(eq(invoices.salesOrderId, id));

    const paidAmount = invoiceData.reduce((sum, inv) => sum + parseFloat(inv.paidAmount || '0'), 0);
    const totalAmount = parseFloat(order.totalAmount || '0');
    const remainingAmount = Math.max(0, totalAmount - paidAmount);

    return {
      ...order,
      lines,
      paidAmount: paidAmount.toString(),
      remainingAmount: remainingAmount.toString()
    };
  }

  async createSalesOrder(order: DbInsertSalesOrder, lines: Omit<DbInsertSalesOrderLine, 'salesOrderId'>[]): Promise<SalesOrder> {
    const [newOrder] = await db.insert(salesOrders).values(order).returning();

    for (const line of lines) {
      await db.insert(salesOrderLines).values({ ...line, salesOrderId: newOrder.id, tenantId: order.tenantId });
    }

    return newOrder;
  }

  async updateSalesOrderStatus(id: string, status: string): Promise<void> {
    const order = await this.getSalesOrder(id);
    if (!order) throw new Error("Sales order not found");

    // Odoo workflow: draft -> quotation -> sent -> confirmed -> delivered -> invoiced
    // When confirming order, reserve stock
    if (status === "confirmed" && order.status !== "confirmed") {
      // Reserve stock for each line
      if (order.lines && order.warehouseId) {
        for (const line of order.lines) {
          await this.updateStock(
            order.tenantId,
            order.warehouseId,
            line.productId,
            Number(line.quantity),
            "out",
            order.orderNumber,
            id
          );
        }
      }
    }

    await db.update(salesOrders).set({ status, updatedAt: new Date() }).where(eq(salesOrders.id, id));
  }

  // Create invoice from sales order (Odoo workflow)
  async createInvoiceFromSalesOrder(salesOrderId: string): Promise<Invoice> {
    const order = await this.getSalesOrder(salesOrderId);
    if (!order || !order.lines) throw new Error("Sales order not found or has no lines");

    // Use concurrency-safe numbering
    const { getNextInvoiceNumber } = await import("./numbering");
    const invoiceNumber = await getNextInvoiceNumber(order.tenantId, order.branchId || null);

    const lines: DbInsertInvoiceLine[] = order.lines.map((line: any) => ({
      tenantId: order.tenantId,
      productId: line.productId,
      description: line.description || "",
      quantity: line.quantity,
      unitPrice: line.unitPrice,
      taxRate: line.taxRate || "10.00",
      subtotal: line.subtotal,
      taxAmount: line.taxAmount,
      total: line.total
    }));

    const invoice = await this.createInvoice({
      tenantId: order.tenantId,
      branchId: order.branchId,
      contactId: order.customerId,
      salesOrderId: order.id,
      invoiceNumber,
      invoiceDate: new Date().toISOString().split('T')[0],
      dueDate: order.deliveryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      type: "sales",
      status: "draft",
      subtotal: order.subtotal,
      taxAmount: order.taxAmount,
      totalAmount: order.totalAmount,
      paidAmount: "0",
      createdBy: order.createdBy
    } as DbInsertInvoice, lines);

    // Update sales order status to invoiced
    await db.update(salesOrders).set({ status: "invoiced", updatedAt: new Date() }).where(eq(salesOrders.id, salesOrderId));

    return invoice;
  }

  // Bulk operations for sales orders
  async bulkCancelOrders(ids: string[], tenantId: string): Promise<{ updated: number; errors: string[] }> {
    const errors: string[] = [];
    let updated = 0;

    for (const id of ids) {
      try {
        const order = await this.getSalesOrder(id);
        if (!order) {
          errors.push(`Order ${id} not found`);
          continue;
        }
        if (order.tenantId !== tenantId) {
          errors.push(`Order ${id} access denied`);
          continue;
        }
        // Can cancel any order except already cancelled
        if (order.status === 'cancelled') {
          errors.push(`Order ${id} already cancelled`);
          continue;
        }
        await db.update(salesOrders).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(salesOrders.id, id));
        updated++;
      } catch (err: any) {
        errors.push(`Order ${id}: ${err.message}`);
      }
    }

    return { updated, errors };
  }

  async bulkDeleteDraftOrders(ids: string[], tenantId: string): Promise<{ deleted: number; errors: string[] }> {
    const errors: string[] = [];
    let deleted = 0;

    for (const id of ids) {
      try {
        const order = await this.getSalesOrder(id);
        if (!order) {
          errors.push(`Order ${id} not found`);
          continue;
        }
        if (order.tenantId !== tenantId) {
          errors.push(`Order ${id} access denied`);
          continue;
        }
        // CRITICAL: Only allow deleting DRAFT orders
        if (order.status !== 'draft') {
          errors.push(`Order ${id} cannot be deleted - status: ${order.status} (only draft can be deleted)`);
          continue;
        }

        // Delete order lines first, then order
        await db.delete(salesOrderLines).where(eq(salesOrderLines.salesOrderId, id));
        await db.delete(salesOrders).where(eq(salesOrders.id, id));
        deleted++;
      } catch (err: any) {
        errors.push(`Order ${id}: ${err.message}`);
      }
    }

    return { deleted, errors };
  }

  // --- Purchase Orders ---
  async getPurchaseOrders(tenantId: string): Promise<any[]> {
    return await db.select({
      id: purchaseOrders.id,
      orderNumber: purchaseOrders.orderNumber,
      orderDate: purchaseOrders.orderDate,
      expectedDate: purchaseOrders.expectedDate,
      status: purchaseOrders.status,
      paymentStatus: purchaseOrders.paymentStatus,
      totalAmount: purchaseOrders.totalAmount,
      supplierName: sql<string>`COALESCE(${contacts.companyName}, ${contacts.firstName} || ' ' || ${contacts.lastName})`
    })
      .from(purchaseOrders)
      .leftJoin(contacts, eq(purchaseOrders.supplierId, contacts.id))
      .where(eq(purchaseOrders.tenantId, tenantId))
      .orderBy(desc(purchaseOrders.createdAt));
  }

  async getPurchaseOrder(id: string): Promise<any | undefined> {
    const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
    if (!order) return undefined;

    const lines = await db.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.purchaseOrderId, id));
    return { ...order, lines };
  }

  async createPurchaseOrder(order: DbInsertPurchaseOrder, lines: Omit<DbInsertPurchaseOrderLine, 'purchaseOrderId'>[]): Promise<PurchaseOrder> {
    const [newOrder] = await db.insert(purchaseOrders).values(order).returning();

    for (const line of lines) {
      await db.insert(purchaseOrderLines).values({ ...line, purchaseOrderId: newOrder.id, tenantId: order.tenantId });
    }

    return newOrder;
  }

  async updatePurchaseOrderStatus(id: string, status: string): Promise<void> {
    const order = await this.getPurchaseOrder(id);
    if (!order) throw new Error("Purchase order not found");

    // Odoo workflow: draft -> sent -> confirmed -> received -> bill
    // When receiving order, increase stock
    if (status === "received" && order.status !== "received") {
      // Add stock for each line
      if (order.lines && order.warehouseId) {
        for (const line of order.lines) {
          await this.updateStock(
            order.tenantId,
            order.warehouseId,
            line.productId,
            Number(line.quantity),
            "in",
            order.orderNumber,
            id
          );
        }
      }
    }

    await db.update(purchaseOrders).set({ status, updatedAt: new Date() }).where(eq(purchaseOrders.id, id));
  }

  async bulkDeleteDraftPurchaseOrders(ids: string[], tenantId: string): Promise<{ deleted: number; errors: string[] }> {
    const results = { deleted: 0, errors: [] as string[] };

    for (const id of ids) {
      try {
        const [order] = await db
          .select()
          .from(purchaseOrders)
          .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)));

        if (!order) {
          results.errors.push(`Order ${id} not found`);
          continue;
        }

        if (order.status !== "draft") {
          results.errors.push(`Order ${order.orderNumber} is not a draft`);
          continue;
        }

        // Delete lines first
        await db.delete(purchaseOrderLines).where(eq(purchaseOrderLines.purchaseOrderId, id));
        // Delete order
        await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));

        results.deleted++;
      } catch (error: any) {
        results.errors.push(`Error deleting order ${id}: ${error.message}`);
      }
    }

    return results;
  }

  // --- Invoices ---
  async getInvoices(tenantId: string, type?: string): Promise<any[]> {
    const baseCondition = type
      ? and(eq(invoices.tenantId, tenantId), eq(invoices.type, type))
      : eq(invoices.tenantId, tenantId);

    return await db.select({
      id: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      invoiceDate: invoices.invoiceDate,
      dueDate: invoices.dueDate,
      type: invoices.type,
      status: invoices.status,
      totalAmount: invoices.totalAmount,
      paidAmount: invoices.paidAmount,
      contactName: sql<string>`COALESCE(${contacts.companyName}, ${contacts.firstName} || ' ' || ${contacts.lastName})`
    })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(baseCondition)
      .orderBy(desc(invoices.createdAt));
  }

  async getInvoice(id: string): Promise<any | undefined> {
    const [invoice] = await db
      .select({
        id: invoices.id,
        tenantId: invoices.tenantId,
        contactId: invoices.contactId,
        salesOrderId: invoices.salesOrderId,
        branchId: invoices.branchId,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        type: invoices.type,
        status: invoices.status,
        subtotal: invoices.subtotal,
        taxAmount: invoices.taxAmount,
        totalAmount: invoices.totalAmount,
        paidAmount: invoices.paidAmount,
        notes: invoices.notes,
        ebarimtQrCode: invoices.ebarimtQrCode,
        ebarimtReceiptNumber: invoices.ebarimtReceiptNumber,
        ebarimtLotteryNumber: invoices.ebarimtLotteryNumber,
        ebarimtDocumentId: invoices.ebarimtDocumentId,
        createdBy: invoices.createdBy,
        createdAt: invoices.createdAt,
        updatedAt: invoices.updatedAt,
        contactName: sql<string>`COALESCE(${contacts.companyName}, ${contacts.firstName} || ' ' || ${contacts.lastName})`,
      })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(eq(invoices.id, id));
    if (!invoice) return undefined;

    const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id));
    return { ...invoice, lines };
  }

  async createInvoice(invoice: DbInsertInvoice, lines: Omit<DbInsertInvoiceLine, 'invoiceId'>[]): Promise<Invoice> {
    const [newInvoice] = await db.insert(invoices).values(invoice).returning();

    for (const line of lines) {
      await db.insert(invoiceLines).values({ ...line, invoiceId: newInvoice.id, tenantId: invoice.tenantId });
    }

    return newInvoice;
  }

  async updateInvoiceStatus(id: string, status: string, paidAmount?: number): Promise<void> {
    const update: any = { status, updatedAt: new Date() };
    if (paidAmount !== undefined) {
      update.paidAmount = paidAmount.toString();
    }
    await db.update(invoices).set(update).where(eq(invoices.id, id));
  }

  async updateInvoiceEBarimt(
    id: string,
    documentId: string,
    qrCode?: string,
    receiptNumber?: string,
    lotteryNumber?: string
  ): Promise<void> {
    await db
      .update(invoices)
      .set({
        ebarimtDocumentId: documentId,
        ebarimtQrCode: qrCode || null,
        ebarimtReceiptNumber: receiptNumber || null,
        ebarimtLotteryNumber: lotteryNumber || null,
        ebarimtSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, id));
  }

  async deleteInvoice(id: string): Promise<void> {
    // Delete lines first
    await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id));
    // Delete invoice
    await db.delete(invoices).where(eq(invoices.id, id));
  }

  // --- Accounting: Currencies ---
  async getCurrencies(tenantId: string): Promise<Currency[]> {
    return await db.select().from(currencies).where(eq(currencies.tenantId, tenantId));
  }

  async createCurrency(currency: DbInsertCurrency): Promise<Currency> {
    const [newCurrency] = await db.insert(currencies).values(currency).returning();
    return newCurrency;
  }

  // --- Accounting: Accounts (Chart of Accounts) ---
  async getAccounts(tenantId: string): Promise<Account[]> {
    return await db.select().from(accounts).where(eq(accounts.tenantId, tenantId));
  }

  async getAccount(id: string): Promise<Account | undefined> {
    const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
    return account;
  }

  async createAccount(account: DbInsertAccount): Promise<Account> {
    const [newAccount] = await db.insert(accounts).values(account).returning();
    return newAccount;
  }

  async updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account> {
    const [updated] = await db.update(accounts).set(account).where(eq(accounts.id, id)).returning();
    return updated;
  }

  // --- Accounting: Journals ---
  async getJournals(tenantId: string): Promise<Journal[]> {
    return await db.select().from(journals).where(eq(journals.tenantId, tenantId));
  }

  async getJournal(id: string): Promise<Journal | undefined> {
    const [journal] = await db.select().from(journals).where(eq(journals.id, id));
    return journal;
  }

  async createJournal(journal: DbInsertJournal): Promise<Journal> {
    const [newJournal] = await db.insert(journals).values(journal).returning();
    return newJournal;
  }

  // --- Accounting: Journal Entries ---
  async getJournalEntries(tenantId: string, filters?: { journalId?: string; status?: string; startDate?: string; endDate?: string }): Promise<any[]> {
    const conditions = [eq(journalEntries.tenantId, tenantId)];

    if (filters?.journalId) {
      conditions.push(eq(journalEntries.journalId, filters.journalId));
    }
    if (filters?.status) {
      conditions.push(eq(journalEntries.status, filters.status));
    }
    if (filters?.startDate) {
      conditions.push(sql`${journalEntries.entryDate} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${journalEntries.entryDate} <= ${filters.endDate}`);
    }

    const query = db.select({
      id: journalEntries.id,
      entryNumber: journalEntries.entryNumber,
      entryDate: journalEntries.entryDate,
      description: journalEntries.description,
      status: journalEntries.status,
      reference: journalEntries.reference,
      journalId: journalEntries.journalId,
      journalName: journals.name,
      postedBy: journalEntries.postedBy,
      postedAt: journalEntries.postedAt,
      createdAt: journalEntries.createdAt,
    })
      .from(journalEntries)
      .leftJoin(journals, eq(journalEntries.journalId, journals.id))
      .where(and(...conditions))
      .orderBy(desc(journalEntries.createdAt));

    return await query;
  }

  async getJournalEntry(id: string): Promise<any | undefined> {
    const [entry] = await db.select({
      id: journalEntries.id,
      tenantId: journalEntries.tenantId,
      entryNumber: journalEntries.entryNumber,
      entryDate: journalEntries.entryDate,
      description: journalEntries.description,
      status: journalEntries.status,
      reference: journalEntries.reference,
      journalId: journalEntries.journalId,
      journalName: journals.name,
      postedBy: journalEntries.postedBy,
      postedAt: journalEntries.postedAt,
      reversalEntryId: journalEntries.reversalEntryId,
      reversedByEntryId: journalEntries.reversedByEntryId,
      createdAt: journalEntries.createdAt,
    })
      .from(journalEntries)
      .leftJoin(journals, eq(journalEntries.journalId, journals.id))
      .where(eq(journalEntries.id, id));

    if (!entry) return undefined;

    const lines = await db.select({
      id: journalLines.id,
      entryId: journalLines.entryId,
      accountId: journalLines.accountId,
      accountCode: accounts.code,
      accountName: accounts.name,
      debit: journalLines.debit,
      credit: journalLines.credit,
      description: journalLines.description,
      partnerId: journalLines.partnerId,
      amountCurrency: journalLines.amountCurrency,
      currencyId: journalLines.currencyId,
      currencyRate: journalLines.currencyRate,
      reference: journalLines.reference,
    })
      .from(journalLines)
      .leftJoin(accounts, eq(journalLines.accountId, accounts.id))
      .where(eq(journalLines.entryId, id));

    // Get tax lines for each journal line
    const linesWithTax = await Promise.all(lines.map(async (line) => {
      const taxLinesData = await db.select({
        id: taxLines.id,
        taxCodeId: taxLines.taxCodeId,
        taxCode: taxCodes.code,
        taxBase: taxLines.taxBase,
        taxAmount: taxLines.taxAmount,
        sourceType: taxLines.sourceType,
        reference: taxLines.reference,
        referenceId: taxLines.referenceId,
      })
        .from(taxLines)
        .leftJoin(taxCodes, eq(taxLines.taxCodeId, taxCodes.id))
        .where(eq(taxLines.journalLineId, line.id));

      return { ...line, taxLines: taxLinesData };
    }));

    return { ...entry, lines: linesWithTax };
  }

  async createJournalEntry(entry: DbInsertJournalEntry, lines: DbInsertJournalLine[]): Promise<JournalEntry> {
    const [newEntry] = await db.insert(journalEntries).values(entry).returning();

    for (const line of lines) {
      await db.insert(journalLines).values({ ...line, entryId: newEntry.id });
    }

    return newEntry;
  }

  async updateJournalEntryStatus(id: string, status: string, postedBy?: string): Promise<void> {
    const update: any = { status };
    if (status === "posted") {
      update.postedAt = new Date();
      if (postedBy) {
        update.postedBy = postedBy;
      }
    }
    await db.update(journalEntries).set(update).where(eq(journalEntries.id, id));
  }

  async reverseJournalEntry(id: string, entryDate: string, description: string, reversedBy: string): Promise<JournalEntry> {
    // Get original entry with lines
    const originalEntry = await this.getJournalEntry(id);
    if (!originalEntry || originalEntry.status !== "posted") {
      throw new Error("Journal entry not found or not posted");
    }

    // Check if already reversed
    if (originalEntry.status === "reversed" || originalEntry.reversedByEntryId) {
      throw new Error("Journal entry already reversed");
    }

    // Generate reversal entry number (concurrency-safe)
    const { getNextReversalNumber } = await import("./numbering");
    const reversalDate = new Date(entryDate);
    const reversalEntryNumber = await getNextReversalNumber(
      originalEntry.tenantId,
      null, // branchId
      reversalDate.getFullYear()
    );

    // Create reversal entry
    const [reversalEntry] = await db.insert(journalEntries).values({
      tenantId: originalEntry.tenantId,
      journalId: originalEntry.journalId,
      entryNumber: reversalEntryNumber,
      entryDate,
      description: description || `Reversal of ${originalEntry.entryNumber}`,
      status: "posted",
      reference: originalEntry.entryNumber || null,
      reversalEntryId: id, // Link to original
      postedBy: reversedBy,
      postedAt: new Date(),
    } as DbInsertJournalEntry).returning();

    // Get original lines
    const originalLines = originalEntry.lines || [];
    if (originalLines.length === 0) {
      throw new Error("Original entry has no lines");
    }

    // Create reversed lines (swap debit/credit)
    for (const line of originalLines) {
      const [reversedLine] = await db.insert(journalLines).values({
        entryId: reversalEntry.id,
        accountId: line.accountId,
        debit: line.credit, // Swap debit/credit
        credit: line.debit, // Swap debit/credit
        description: `Reversal: ${line.description || ""}`,
        partnerId: line.partnerId || null,
        amountCurrency: line.amountCurrency || null,
        currencyId: line.currencyId || null,
        currencyRate: line.currencyRate || "1.0000",
        reference: line.reference || null,
      } as DbInsertJournalLine).returning();

      // Reverse tax lines if they exist
      if (line.taxLines && line.taxLines.length > 0) {
        for (const taxLine of line.taxLines) {
          await db.insert(taxLines).values({
            journalLineId: reversedLine.id,
            taxCodeId: taxLine.taxCodeId,
            taxBase: taxLine.taxBase,
            taxAmount: taxLine.taxAmount, // Keep same amount, but will be offset by reversed journal line
            sourceType: "reversal",
            reference: taxLine.reference || null,
            referenceId: taxLine.referenceId || null,
          } as InsertTaxLine);
        }
      }
    }

    // Update original entry status
    await db.update(journalEntries).set({
      reversedByEntryId: reversalEntry.id,
      status: "reversed",
    }).where(eq(journalEntries.id, id));

    // If the journal entry was created from an invoice or payment, update those documents too
    if (originalEntry.reference) {
      // Check if it's an invoice reference (invoice.id)
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, originalEntry.reference)).limit(1);
      if (invoice && invoice.status === "posted") {
        // Don't automatically reverse invoice status, let user handle it manually
        // But we could add a flag or note
      }

      // Check if it's a payment reference
      const [payment] = await db.select().from(payments).where(eq(payments.id, originalEntry.reference)).limit(1);
      if (payment && payment.status === "posted") {
        // Same as invoice - don't auto-reverse payment
      }
    }

    return reversalEntry;
  }

  // --- Accounting: Posting Engine ---
  async previewPosting(modelType: string, modelId: string): Promise<any> {
    // Get tenant from document
    let tenantId: string;
    if (modelType === "invoice") {
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, modelId)).limit(1);
      if (!invoice) throw new Error("Invoice not found");
      tenantId = invoice.tenantId;
    } else if (modelType === "payment") {
      const [payment] = await db.select().from(payments).where(eq(payments.id, modelId)).limit(1);
      if (!payment) throw new Error("Payment not found");
      tenantId = payment.tenantId;
    } else {
      throw new Error(`Unsupported model type: ${modelType}`);
    }

    return await previewPosting(tenantId, modelType, modelId);
  }

  async postDocument(modelType: string, modelId: string, journalId?: string, entryDate?: string, postedBy?: string): Promise<JournalEntry> {
    // Get tenant from document
    let tenantId: string;
    if (modelType === "invoice") {
      const [invoice] = await db.select().from(invoices).where(eq(invoices.id, modelId)).limit(1);
      if (!invoice) throw new Error("Invoice not found");
      tenantId = invoice.tenantId;
    } else if (modelType === "payment") {
      const [payment] = await db.select().from(payments).where(eq(payments.id, modelId)).limit(1);
      if (!payment) throw new Error("Payment not found");
      tenantId = payment.tenantId;
    } else {
      throw new Error(`Unsupported model type: ${modelType}`);
    }

    return await postDocument(tenantId, modelType, modelId, journalId, entryDate, postedBy);
  }

  // --- Accounting: Tax Codes ---
  async getTaxCodes(tenantId: string): Promise<TaxCode[]> {
    return await db.select().from(taxCodes).where(eq(taxCodes.tenantId, tenantId));
  }

  async createTaxCode(taxCode: DbInsertTaxCode): Promise<TaxCode> {
    const [newTaxCode] = await db.insert(taxCodes).values(taxCode).returning();
    return newTaxCode;
  }

  // --- Accounting: Payments ---
  async getPayments(tenantId: string, type?: string): Promise<any[]> {
    const baseCondition = type
      ? and(eq(payments.tenantId, tenantId), eq(payments.type, type))
      : eq(payments.tenantId, tenantId);

    return await db.select({
      id: payments.id,
      paymentNumber: payments.paymentNumber,
      paymentDate: payments.paymentDate,
      type: payments.type,
      amount: payments.amount,
      status: payments.status,
      paymentMethod: payments.paymentMethod,
      reference: payments.reference,
      createdAt: payments.createdAt,
    })
      .from(payments)
      .where(baseCondition);
  }

  async getPayment(id: string): Promise<any | undefined> {
    const [payment] = await db.select().from(payments).where(eq(payments.id, id));
    if (!payment) return undefined;

    const allocations = await db.select({
      id: paymentAllocations.id,
      invoiceId: paymentAllocations.invoiceId,
      invoiceNumber: invoices.invoiceNumber,
      allocatedAmount: paymentAllocations.allocatedAmount,
      allocationDate: paymentAllocations.allocationDate,
    })
      .from(paymentAllocations)
      .leftJoin(invoices, eq(paymentAllocations.invoiceId, invoices.id))
      .where(eq(paymentAllocations.paymentId, id));

    return { ...payment, allocations };
  }

  async createPayment(payment: DbInsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    return newPayment;
  }

  async createPaymentAllocation(paymentId: string, invoiceId: string, amount: number, allocationDate: string): Promise<void> {
    await db.insert(paymentAllocations).values({
      paymentId,
      invoiceId,
      allocatedAmount: amount.toString(),
      allocationDate,
    } as any);
  }

  // --- Accounting: Reports ---
  async getTrialBalance(tenantId: string, startDate?: string, endDate?: string): Promise<any> {
    return await getTrialBalance(tenantId, startDate, endDate);
  }

  async getBalanceSheet(tenantId: string, asOfDate?: string): Promise<any> {
    return await getBalanceSheet(tenantId, asOfDate);
  }

  async getProfitAndLoss(tenantId: string, startDate?: string, endDate?: string): Promise<any> {
    return await getProfitAndLoss(tenantId, startDate, endDate);
  }

  async getVATReport(tenantId: string, startDate?: string, endDate?: string): Promise<any> {
    return await getVATReport(tenantId, startDate, endDate);
  }

  // --- Bank Accounts ---
  async getBankAccounts(tenantId: string): Promise<any[]> {
    return await db
      .select({
        id: bankAccounts.id,
        accountNumber: bankAccounts.accountNumber,
        bankName: bankAccounts.bankName,
        balance: bankAccounts.balance,
        isActive: bankAccounts.isActive,
      })
      .from(bankAccounts)
      .where(eq(bankAccounts.tenantId, tenantId))
      .orderBy(bankAccounts.bankName, bankAccounts.accountNumber);
  }

  async getBankAccount(id: string): Promise<any | undefined> {
    const [account] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, id)).limit(1);
    return account;
  }

  async createBankAccount(data: {
    tenantId: string;
    accountNumber: string;
    bankName: string;
    currencyId?: string;
    balance?: string;
    accountId?: string; // If provided, use existing GL account
  }): Promise<any> {
    let glAccountId = data.accountId || null;

    // If no existing GL account provided, auto-create one in Chart of Accounts
    if (!glAccountId) {
      // Find the next available account code in 10xx series (Bank/Cash accounts)
      const existingAccounts = await db
        .select({ code: accounts.code })
        .from(accounts)
        .where(
          and(
            eq(accounts.tenantId, data.tenantId),
            sql`${accounts.code} LIKE '10%'` // Match 10xx pattern - simplified
          )
        )
        .orderBy(desc(accounts.code))
        .limit(1);

      // Generate next code (start from 1001 if no existing, else increment)
      let nextCode = "1001";
      if (existingAccounts.length > 0 && existingAccounts[0].code) {
        const lastNum = parseInt(existingAccounts[0].code, 10);
        nextCode = (lastNum + 1).toString();
      }

      // Create GL account - Bank Asset type
      const accountName = `${data.bankName} - ${data.accountNumber}`;
      // @ts-ignore - inserting asset-type bank account
      const [glAccount] = await db.insert(accounts).values({
        tenantId: data.tenantId,
        code: nextCode,
        name: accountName,
        type: "asset", // Bank accounts are assets
        level: 2, // Sub-level under parent 1000 (Cash/Bank)
        isActive: true,
      }).returning();

      glAccountId = glAccount.id;
    }

    // Create bank account record linked to GL account
    const [created] = await db.insert(bankAccounts).values({
      tenantId: data.tenantId,
      accountNumber: data.accountNumber,
      bankName: data.bankName,
      currencyId: data.currencyId || null,
      balance: data.balance || "0",
      accountId: glAccountId,
      isActive: true,
    }).returning();

    return created;
  }


  async updateBankAccount(id: string, data: Partial<{
    accountNumber: string;
    bankName: string;
    balance: string;
    isActive: boolean;
  }>): Promise<any> {
    const [updated] = await db.update(bankAccounts)
      .set(data)
      .where(eq(bankAccounts.id, id))
      .returning();
    return updated;
  }

  // --- Bank Statements ---
  async getBankStatements(tenantId: string, bankAccountId?: string): Promise<any[]> {
    const conditions: any[] = [eq(bankStatements.tenantId, tenantId)];
    if (bankAccountId) {
      conditions.push(eq(bankStatements.bankAccountId, bankAccountId));
    }
    return await db
      .select({
        id: bankStatements.id,
        bankAccountId: bankStatements.bankAccountId,
        statementDate: bankStatements.statementDate,
        openingBalance: bankStatements.openingBalance,
        closingBalance: bankStatements.closingBalance,
        importedAt: bankStatements.importedAt,
      })
      .from(bankStatements)
      .where(and(...conditions))
      .orderBy(desc(bankStatements.statementDate));
  }

  async getBankStatement(id: string): Promise<any | undefined> {
    const [statement] = await db.select().from(bankStatements).where(eq(bankStatements.id, id)).limit(1);
    return statement;
  }

  async createBankStatement(statement: any, lines: any[]): Promise<any> {
    const [created] = await db.insert(bankStatements).values(statement).returning();

    if (lines && lines.length > 0) {
      await db.insert(bankStatementLines).values(
        lines.map((line) => ({
          statementId: created.id,
          date: line.date,
          description: line.description || null,
          debit: (line.debit || 0).toString(),
          credit: (line.credit || 0).toString(),
          balance: line.balance.toString(),
          reference: line.reference || null,
          reconciled: false,
        }))
      );
    }

    return created;
  }

  async getBankStatementLines(statementId: string): Promise<any[]> {
    return await db
      .select()
      .from(bankStatementLines)
      .where(eq(bankStatementLines.statementId, statementId))
      .orderBy(bankStatementLines.date);
  }

  // --- Bank Reconciliation ---
  async getUnreconciledBankLines(tenantId: string, bankAccountId?: string): Promise<any[]> {
    const baseQuery = db
      .select({
        id: bankStatementLines.id,
        statementId: bankStatementLines.statementId,
        date: bankStatementLines.date,
        description: bankStatementLines.description,
        debit: bankStatementLines.debit,
        credit: bankStatementLines.credit,
        balance: bankStatementLines.balance,
        reference: bankStatementLines.reference,
        reconciled: bankStatementLines.reconciled,
        bankAccountId: bankStatements.bankAccountId,
        bankName: bankAccounts.bankName,
        accountNumber: bankAccounts.accountNumber,
      })
      .from(bankStatementLines)
      .innerJoin(bankStatements, eq(bankStatementLines.statementId, bankStatements.id))
      .innerJoin(bankAccounts, eq(bankStatements.bankAccountId, bankAccounts.id))
      .where(
        and(
          eq(bankStatements.tenantId, tenantId),
          eq(bankStatementLines.reconciled, false),
          bankAccountId ? eq(bankStatements.bankAccountId, bankAccountId) : undefined
        )
      )
      .orderBy(desc(bankStatementLines.date));

    return await baseQuery;
  }

  async getUnpaidInvoices(tenantId: string, type?: string): Promise<any[]> {
    const conditions: any[] = [
      eq(invoices.tenantId, tenantId),
      or(
        eq(invoices.status, 'sent'),
        eq(invoices.status, 'draft'),
        and(
          eq(invoices.status, 'paid'),
          sql`CAST(${invoices.paidAmount} AS NUMERIC) < CAST(${invoices.totalAmount} AS NUMERIC)`
        )
      )
    ];

    if (type) {
      conditions.push(eq(invoices.type, type));
    }

    return await db
      .select({
        id: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceDate: invoices.invoiceDate,
        dueDate: invoices.dueDate,
        type: invoices.type,
        status: invoices.status,
        totalAmount: invoices.totalAmount,
        paidAmount: invoices.paidAmount,
        remainingAmount: sql<string>`CAST(${invoices.totalAmount} AS NUMERIC) - CAST(${invoices.paidAmount} AS NUMERIC)`,
        contactId: invoices.contactId,
        contactName: sql<string>`COALESCE(${contacts.companyName}, ${contacts.firstName} || ' ' || ${contacts.lastName})`,
      })
      .from(invoices)
      .leftJoin(contacts, eq(invoices.contactId, contacts.id))
      .where(and(...conditions))
      .orderBy(desc(invoices.dueDate));
  }

  async createReconciliation(data: {
    tenantId: string;
    statementLineId: string;
    status?: string;
    notes?: string;
  }): Promise<any> {
    const [created] = await db.insert(reconciliations).values({
      tenantId: data.tenantId,
      statementLineId: data.statementLineId,
      status: data.status || 'draft',
      totalMatchedAmount: '0',
      notes: data.notes || null,
    }).returning();
    return created;
  }

  async addReconciliationMatch(data: {
    reconciliationId: string;
    invoiceId?: string;
    paymentId?: string;
    journalLineId?: string;
    matchedAmount: number;
    matchDate: string;
    notes?: string;
  }): Promise<any> {
    const [match] = await db.insert(reconciliationMatches).values({
      reconciliationId: data.reconciliationId,
      invoiceId: data.invoiceId || null,
      paymentId: data.paymentId || null,
      journalLineId: data.journalLineId || null,
      matchedAmount: data.matchedAmount.toString(),
      matchDate: data.matchDate,
      notes: data.notes || null,
    }).returning();

    // Update total matched amount on reconciliation
    await db.execute(sql`
      UPDATE reconciliations 
      SET total_matched_amount = (
        SELECT COALESCE(SUM(CAST(matched_amount AS NUMERIC)), 0)
        FROM reconciliation_matches 
        WHERE reconciliation_id = ${data.reconciliationId}
      )
      WHERE id = ${data.reconciliationId}
    `);

    return match;
  }

  async confirmReconciliation(reconciliationId: string, userId: string): Promise<any> {
    // Get reconciliation with statement line
    const [rec] = await db.select().from(reconciliations).where(eq(reconciliations.id, reconciliationId)).limit(1);
    if (!rec) throw new Error('Reconciliation not found');

    // Mark bank statement line as reconciled
    await db.update(bankStatementLines)
      .set({ reconciled: true })
      .where(eq(bankStatementLines.id, rec.statementLineId));

    // Update reconciliation status
    const [updated] = await db.update(reconciliations)
      .set({
        status: 'reconciled',
        reconciledAt: new Date(),
        reconciledBy: userId,
      })
      .where(eq(reconciliations.id, reconciliationId))
      .returning();

    return updated;
  }

  async getReconciliations(tenantId: string, status?: string): Promise<any[]> {
    const conditions: any[] = [eq(reconciliations.tenantId, tenantId)];
    if (status) {
      conditions.push(eq(reconciliations.status, status));
    }

    return await db
      .select({
        id: reconciliations.id,
        statementLineId: reconciliations.statementLineId,
        status: reconciliations.status,
        totalMatchedAmount: reconciliations.totalMatchedAmount,
        reconciledAt: reconciliations.reconciledAt,
        createdAt: reconciliations.createdAt,
        lineDate: bankStatementLines.date,
        lineDescription: bankStatementLines.description,
        lineDebit: bankStatementLines.debit,
        lineCredit: bankStatementLines.credit,
      })
      .from(reconciliations)
      .leftJoin(bankStatementLines, eq(reconciliations.statementLineId, bankStatementLines.id))
      .where(and(...conditions))
      .orderBy(desc(reconciliations.createdAt));
  }

  async getReconciliationMatches(reconciliationId: string): Promise<any[]> {
    return await db
      .select({
        id: reconciliationMatches.id,
        matchedAmount: reconciliationMatches.matchedAmount,
        matchDate: reconciliationMatches.matchDate,
        invoiceId: reconciliationMatches.invoiceId,
        invoiceNumber: invoices.invoiceNumber,
        paymentId: reconciliationMatches.paymentId,
        notes: reconciliationMatches.notes,
      })
      .from(reconciliationMatches)
      .leftJoin(invoices, eq(reconciliationMatches.invoiceId, invoices.id))
      .where(eq(reconciliationMatches.reconciliationId, reconciliationId));
  }



  // QPay
  async getQPaySettings(tenantId: string): Promise<QPaySettings | undefined> {
    const [settings] = await db.select().from(qpaySettings).where(eq(qpaySettings.tenantId, tenantId)).limit(1);
    return settings;
  }

  async updateQPaySettings(tenantId: string, settings: Partial<QPaySettings>): Promise<QPaySettings> {
    const existing = await this.getQPaySettings(tenantId);

    if (existing) {
      const [updated] = await db
        .update(qpaySettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(qpaySettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(qpaySettings)
        .values({
          tenantId,
          ...settings,
        } as DbInsertQPaySettings)
        .returning();
      return created;
    }
  }

  async getQPayInvoiceByInvoiceId(invoiceId: string): Promise<QPayInvoice | undefined> {
    const [invoice] = await db
      .select()
      .from(qpayInvoices)
      .where(eq(qpayInvoices.invoiceId, invoiceId))
      .limit(1);
    return invoice;
  }

  async createQPayInvoice(qpayInvoice: DbInsertQPayInvoice): Promise<QPayInvoice> {
    const [created] = await db.insert(qpayInvoices).values(qpayInvoice).returning();
    return created;
  }

  async updateQPayInvoice(id: string, qpayInvoice: Partial<QPayInvoice>): Promise<QPayInvoice> {
    const [updated] = await db
      .update(qpayInvoices)
      .set({ ...qpayInvoice, updatedAt: new Date() })
      .where(eq(qpayInvoices.id, id))
      .returning();
    return updated;
  }

  async attachPaymentToQPayInvoice(qpayInvoiceId: string, paymentId: string): Promise<void> {
    await db
      .update(qpayInvoices)
      .set({ paymentId, status: "paid", updatedAt: new Date() })
      .where(eq(qpayInvoices.id, qpayInvoiceId));
  }

  // --- E-barimt Settings ---
  async getEBarimtSettings(tenantId: string): Promise<EBarimtSettings | undefined> {
    const [settings] = await db
      .select()
      .from(ebarimtSettings)
      .where(eq(ebarimtSettings.tenantId, tenantId))
      .limit(1);
    return settings;
  }

  async updateEBarimtSettings(
    tenantId: string,
    settings: Partial<EBarimtSettings>
  ): Promise<EBarimtSettings> {
    const existing = await this.getEBarimtSettings(tenantId);

    if (existing) {
      const [updated] = await db
        .update(ebarimtSettings)
        .set({ ...settings, updatedAt: new Date() })
        .where(eq(ebarimtSettings.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(ebarimtSettings)
        .values({
          ...settings,
          tenantId,
        } as DbInsertEBarimtSettings)
        .returning();
      return created;
    }
  }

  // --- Audit Log ---
  async createAuditLog(log: DbInsertAuditLog): Promise<AuditLog> {
    const [created] = await db.insert(auditLogs).values(log).returning();
    return created;
  }

  async getAuditLogs(
    tenantId: string,
    filters?: {
      entityType?: string;
      entityId?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): Promise<AuditLog[]> {
    const conditions = [eq(auditLogs.tenantId, tenantId)];

    if (filters?.entityType) {
      conditions.push(eq(auditLogs.entityType, filters.entityType));
    }
    if (filters?.entityId) {
      conditions.push(eq(auditLogs.entityId, filters.entityId));
    }
    if (filters?.action) {
      conditions.push(eq(auditLogs.action, filters.action));
    }
    if (filters?.startDate) {
      conditions.push(sql`${auditLogs.eventTime} >= ${filters.startDate}`);
    }
    if (filters?.endDate) {
      conditions.push(sql`${auditLogs.eventTime} <= ${filters.endDate}`);
    }

    let query = db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.eventTime))
      .limit(filters?.limit || 100);

    return await query;
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

    return await db
      .select({
        id: leaveRequests.id,
        employeeId: leaveRequests.employeeId,
        type: leaveRequests.type,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        approvedBy: leaveRequests.approvedBy,
        approvedAt: leaveRequests.approvedAt,
        rejectionReason: leaveRequests.rejectionReason,
        createdAt: leaveRequests.createdAt,
        employeeFirstName: employees.firstName,
        employeeLastName: employees.lastName,
      })
      .from(leaveRequests)
      .leftJoin(employees, eq(leaveRequests.employeeId, employees.id))
      .where(and(...conditions))
      .orderBy(desc(leaveRequests.createdAt));
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


}

export const storage = new DatabaseStorage();