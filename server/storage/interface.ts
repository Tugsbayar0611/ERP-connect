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
    type CompanySettings, type InsertCompanySettings, type DbInsertCompanySettings,
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
    performancePeriods, performanceGoals,
    type PerformancePeriod, type InsertPerformancePeriod,
    type PerformanceGoal, type InsertPerformanceGoal,
    documentLogs, type DocumentLog, type InsertDocumentLog,
    type DbInsertDocumentLog,
    safetyIncidents, type SafetyIncident, type InsertSafetyIncident, type DbInsertSafetyIncident,
    // Internal Communication
    announcements, announcementReads, announcementComments, announcementReactions,
    type Announcement, type InsertAnnouncement, type DbInsertAnnouncement,
    type AnnouncementComment, type AnnouncementReaction,
    chatChannels, chatChannelMembers, chatMessages, chatMessageReactions,
    type ChatChannel, type ChatChannelMember, type ChatMessage, type DbInsertChatMessage,
    type JobTitle, type InsertJobTitle, type DbInsertJobTitle,
    type Request, type InsertRequest, type DbInsertRequest, type RequestEvent, type InsertRequestEvent,
    requests, requestEvents,
    type MealServing, type PayrollStagingLine, type InsertPayrollStagingLine,
    type CanteenMenu, type InsertCanteenMenu, type MealOrder, type InsertMealOrder,
    type CanteenWallet, type InsertCanteenWallet, type WalletTransaction, type InsertWalletTransaction
} from "@shared/schema";

export type RolePermission = typeof rolePermissions.$inferSelect;
export type RoleWithPermissions = Role & {
    permissions: (RolePermission & { permission: Permission })[];
    userCount: number;
};

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

    // Internal Communication
    // Chat
    getChatChannels(tenantId: string, userId: string): Promise<(ChatChannel & { unreadCount?: number })[]>;
    getChatChannel(channelId: string): Promise<ChatChannel | undefined>;
    getOrCreateDirectChannel(tenantId: string, userIdA: string, userIdB: string, createdById: string): Promise<ChatChannel>;
    createGroupChannel(tenantId: string, name: string, createdById: string, memberIds: string[]): Promise<ChatChannel>;
    isChannelMember(channelId: string, userId: string): Promise<boolean>;
    deleteChannel(channelId: string, userId: string): Promise<{ success: boolean; error?: string }>;

    getChatMessages(channelId: string, limit?: number, cursor?: string): Promise<any[]>;
    getChatMessageById(messageId: string): Promise<ChatMessage | null>;
    createChatMessage(message: DbInsertChatMessage): Promise<ChatMessage>;
    updateMessage(messageId: string, senderId: string, newContent: string): Promise<{ success: boolean; error?: string }>;
    deleteMessage(messageId: string): Promise<void>;

    toggleMessageReaction(messageId: string, userId: string, emoji: string): Promise<{ added: boolean } | null>;
    getChannelMembers(channelId: string): Promise<ChatChannelMember[]>;
    updateLastReadAt(channelId: string, userId: string): Promise<void>;

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
    updateBranch(id: string, updates: Partial<DbInsertBranch>): Promise<Branch>;
    deleteBranch(id: string): Promise<void>;

    // Employees
    getEmployees(tenantId: string): Promise<Employee[]>;
    getEmployee(id: string): Promise<Employee | undefined>;
    getEmployeeByUserId(userId: string): Promise<Employee | undefined>;
    createEmployee(employee: DbInsertEmployee): Promise<Employee>;
    updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee>;
    deleteEmployee(id: string): Promise<void>;

    // Job Titles
    getJobTitles(tenantId: string): Promise<JobTitle[]>;
    getJobTitle(tenantId: string, id: string): Promise<JobTitle | undefined>;
    createJobTitle(jobTitle: DbInsertJobTitle): Promise<JobTitle>;
    updateJobTitle(id: string, update: Partial<DbInsertJobTitle>): Promise<JobTitle>;
    deleteJobTitle(id: string): Promise<void>;

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
    getPayslipsByEmployee(tenantId: string, employeeId: string): Promise<any[]>;
    createPayslip(slip: DbInsertPayslip): Promise<Payslip>;
    getPayslipByEmployeeAndRun(tenantId: string, payrollRunId: string, employeeId: string): Promise<Payslip | undefined>;
    updatePayslip(id: string, update: Partial<DbInsertPayslip>): Promise<Payslip>;
    deletePayslip(id: string): Promise<void>;

    // Generic Requests
    createRequest(request: DbInsertRequest): Promise<Request>;
    getRequests(tenantId: string, filters?: { type?: string, status?: string, userId?: string, scope?: string }): Promise<Request[]>;
    getRequest(id: string): Promise<Request | undefined>;
    updateRequest(id: string, updates: Partial<InsertRequest>): Promise<Request>;

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
    getCompanyPosts(tenantId: string, filters?: { limit?: number; search?: string; type?: string; severity?: string }): Promise<any[]>;
    getCompanyPost(id: string): Promise<any | undefined>;
    createCompanyPost(post: DbInsertCompanyPost): Promise<CompanyPost>;
    updateCompanyPost(id: string, updates: Partial<DbInsertCompanyPost>): Promise<CompanyPost>;
    deleteCompanyPost(id: string): Promise<void>;
    togglePostLike(tenantId: string, postId: string, employeeId: string, reactionType?: string): Promise<void>;
    getPostLikes(tenantId: string, postId: string): Promise<PostLike[]>;
    createPostComment(comment: DbInsertPostComment): Promise<PostComment>;
    getPostComments(tenantId: string, postId: string): Promise<any[]>;
    deletePostComment(id: string): Promise<void>;

    // Weather Widget
    getWeatherSettings(tenantId: string): Promise<WeatherSettings | undefined>;
    upsertWeatherSettings(tenantId: string, settings: InsertWeatherSettings): Promise<WeatherSettings>;
    getWeatherAlerts(tenantId: string, limit?: number): Promise<WeatherAlert[]>;
    createWeatherAlert(alert: DbInsertWeatherAlert): Promise<WeatherAlert>;
    markWeatherAlertAsSent(id: string): Promise<void>;

    // Company Settings
    getCompanySettings(tenantId: string): Promise<CompanySettings | undefined>;
    upsertCompanySettings(tenantId: string, settings: InsertCompanySettings): Promise<CompanySettings>;

    // Documents
    getDocuments(tenantId: string, parentId?: string | null, archived?: boolean, scopingUserId?: string, readStatusUserId?: string): Promise<any[]>;
    getDocument(id: string): Promise<Document | undefined>;
    createDocument(doc: DbInsertDocument): Promise<Document>;
    deleteDocument(id: string): Promise<void>;
    signDocument(id: string, userId: string): Promise<Document>;
    seedDocuments(tenantId: string, userId: string): Promise<void>;
    ensureInvoiceFolder(tenantId: string, userId: string): Promise<string>;
    getUnreadDocumentsCount(tenantId: string, userId: string): Promise<number>;
    markDocumentAsRead(tenantId: string, userId: string, documentId: string): Promise<void>;

    // New Features
    updateUserSignature(userId: string, updates: { signatureUrl?: string | null, signatureTitle?: string | null }): Promise<User>;
    updateUserPermissions(userId: string, permissions: { canSignDocuments?: boolean; jobTitle?: string | null }): Promise<User>;
    bulkDeleteDocuments(ids: string[]): Promise<void>;
    updateDocument(id: string, updates: Partial<InsertDocument>): Promise<Document>;

    // Document Logs
    createDocumentLog(log: DbInsertDocumentLog): Promise<void>;
    getDocumentLogs(documentId: string): Promise<DocumentLog[]>;

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

    // --- Job Titles ---
    getJobTitles(tenantId: string, options?: { isActive?: boolean }): Promise<JobTitle[]>;
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

    // Request Events
    createRequestEvent(event: InsertRequestEvent): Promise<RequestEvent>;
    getRequestEvents(requestId: string): Promise<RequestEvent[]>;

    // Performance & KPI (Гүйцэтгэлийн Удирдлага)
    getPerformancePeriods(tenantId: string): Promise<PerformancePeriod[]>;
    getPerformancePeriod(id: string): Promise<PerformancePeriod | undefined>;
    createPerformancePeriod(period: InsertPerformancePeriod & { tenantId: string }): Promise<PerformancePeriod>;
    updatePerformancePeriod(id: string, updates: Partial<InsertPerformancePeriod>): Promise<PerformancePeriod>;
    deletePerformancePeriod(id: string): Promise<void>;

    getPerformanceGoals(tenantId: string, periodId?: string, employeeId?: string): Promise<PerformanceGoal[]>;
    getPerformanceGoal(id: string): Promise<PerformanceGoal | undefined>;
    createPerformanceGoal(goal: InsertPerformanceGoal & { tenantId: string }): Promise<PerformanceGoal>;
    updatePerformanceGoal(id: string, updates: Partial<InsertPerformanceGoal>): Promise<PerformanceGoal>;
    deletePerformanceGoal(id: string): Promise<void>;

    getPerformanceSummary(tenantId: string, periodId: string, employeeId?: string): Promise<{
        goalsCount: number;
        completedCount: number;
    }>;
    getPerformanceInbox(tenantId: string, observerUserId: string, role: string): Promise<any[]>;

    // Canteen Admin
    getAdminMealServings(tenantId: string, filters: { fromDate?: string, toDate?: string, employeeId?: string, voided?: boolean }): Promise<MealServing[]>;
    voidMealServing(servingId: string, reason: string, actorId: string): Promise<MealServing>;
    upsertPayrollStagingLines(lines: InsertPayrollStagingLine[]): Promise<PayrollStagingLine[]>;
    getPayrollStagingLines(tenantId: string, period: string): Promise<PayrollStagingLine[]>;
    approvePayrollStagingLines(tenantId: string, period: string, actorId: string): Promise<number>;
    getAdminWallets(tenantId: string, query?: string): Promise<any[]>;
    adjustWallet(walletId: string, amount: number, note: string, actorId: string): Promise<any>;

    // Core Canteen Methods
    getCanteenWallet(tenantId: string, employeeId: string): Promise<CanteenWallet>;
    getCanteenWallets(tenantId: string): Promise<CanteenWallet[]>; // Added if used?
    topUpWallet(data: {
        tenantId: string,
        walletId: string,
        amount: number,
        type: string,
        referenceType: string,
        referenceId?: string,
        description?: string,
        actorId: string
    }): Promise<WalletTransaction>;
    getWalletTransactions(walletId: string, limit?: number): Promise<WalletTransaction[]>;
    serveMeal(data: {
        tenantId: string,
        employeeId: string,
        date: string,
        mealType: string,
        price: number,
        actorId: string,
        description?: string
    }): Promise<MealServing>;
    getMealServings(tenantId: string, date: string): Promise<MealServing[]>;

    bulkAdjustWallets(data: { tenantId: string, walletIds: string[], amount: number, note?: string, actorId: string }): Promise<number>;

    // Pre-order (MVP)
    createMealOrder(data: InsertMealOrder): Promise<MealOrder>;
    getMealOrders(tenantId: string, employeeId: string, dateFrom?: string, dateTo?: string): Promise<MealOrder[]>;
    cancelMealOrder(tenantId: string, orderId: string, employeeId: string): Promise<MealOrder>;
    getPendingMealOrder(tenantId: string, employeeId: string, date: string, mealType: string): Promise<MealOrder | undefined>;
    getPendingOrderStats(tenantId: string, date: string): Promise<{ lunch: number, dinner: number }>;

    // --- Canteen Admin ---
    getCanteenMenu(tenantId: string, date: string, mealType: string): Promise<CanteenMenu | undefined>;
    upsertCanteenMenu(data: InsertCanteenMenu): Promise<CanteenMenu>;
}
