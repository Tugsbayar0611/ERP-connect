import {
  users, tenants, branches, departments, employees, attendanceDays, payrollRuns, payslips,
  type User, type InsertUser, type Tenant, type InsertTenant, type Branch, type InsertBranch,
  type Department, type InsertDepartment, type Employee, type InsertEmployee,
  type AttendanceDay, type InsertAttendanceDay, type PayrollRun, type InsertPayrollRun,
  type Payslip, type InsertPayslip, type Document, type InsertDocument, categories, documents,
  type DbInsertUser, type DbInsertTenant, type DbInsertBranch, type DbInsertRole, type DbInsertDepartment,
  type DbInsertEmployee, type DbInsertAttendanceDay, type DbInsertPayrollRun, type DbInsertPayslip,
  type DbInsertDocument,
  products, productCategories, contacts, warehouses, stockLevels, stockMovements,
  salesOrders, salesOrderLines, purchaseOrders, purchaseOrderLines, invoices, invoiceLines,
  currencies, accounts, journals, journalEntries, journalLines, taxCodes, taxLines,
  payments, paymentAllocations, bankAccounts, bankStatements, bankStatementLines,
  reconciliations, reconciliationMatches, fiscalYears, fiscalPeriods, periodLocks,
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
  type DbInsertJournalLine, type DbInsertTaxCode, type DbInsertPayment, type InsertTaxLine
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, or, like, sql } from "drizzle-orm";
import { previewPosting, postDocument } from "./posting-engine";
import { getTrialBalance, getBalanceSheet, getProfitAndLoss } from "./reports";

export interface IStorage {
  // User & Auth
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: DbInsertUser): Promise<User>;

  // Tenants & Branches
  getTenant(id: string): Promise<Tenant | undefined>;
  createTenant(tenant: DbInsertTenant): Promise<Tenant>;
  getBranches(tenantId: string): Promise<Branch[]>;
  createBranch(branch: DbInsertBranch): Promise<Branch>;

  // Employees
  getEmployees(tenantId: string): Promise<Employee[]>;
  getEmployee(id: string): Promise<Employee | undefined>;
  createEmployee(employee: DbInsertEmployee): Promise<Employee>;
  updateEmployee(id: string, employee: Partial<InsertEmployee>): Promise<Employee>;

  // Departments
  getDepartments(tenantId: string): Promise<Department[]>;
  createDepartment(dept: DbInsertDepartment): Promise<Department>;

  // Attendance
  getAttendance(tenantId: string): Promise<AttendanceDay[]>;
  createAttendance(att: DbInsertAttendanceDay): Promise<AttendanceDay>;

  // Payroll
  getPayrollRuns(tenantId: string): Promise<PayrollRun[]>;
  getPayrollRunByPeriod(tenantId: string, start: string, end: string): Promise<PayrollRun | undefined>;
  createPayrollRun(run: DbInsertPayrollRun): Promise<PayrollRun>;
  getPayslips(runId: string): Promise<Payslip[]>;
  getAllPayslips(tenantId: string): Promise<any[]>;
  createPayslip(slip: DbInsertPayslip): Promise<Payslip>;

  // Documents
  getDocuments(tenantId: string): Promise<any[]>;
  createDocument(doc: DbInsertDocument): Promise<Document>;
  deleteDocument(id: string): Promise<void>;

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
  updateStock(tenantId: string, warehouseId: string, productId: string, quantity: number, type: string, reference?: string, referenceId?: string): Promise<void>;

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

  // Invoices
  getInvoices(tenantId: string, type?: string): Promise<any[]>;
  getInvoice(id: string): Promise<any | undefined>;
  createInvoice(invoice: DbInsertInvoice, lines: DbInsertInvoiceLine[]): Promise<Invoice>;
  updateInvoiceStatus(id: string, status: string, paidAmount?: number): Promise<void>;
  createInvoiceFromSalesOrder(salesOrderId: string): Promise<Invoice>;

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

  // Accounting - Reports
  getTrialBalance(tenantId: string, startDate?: string, endDate?: string): Promise<any>;
  getBalanceSheet(tenantId: string, asOfDate?: string): Promise<any>;
  getProfitAndLoss(tenantId: string, startDate?: string, endDate?: string): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  // --- User & Auth ---
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user;
  }

  async createUser(insertUser: DbInsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  // --- Tenants & Branches ---
  async getTenant(id: string): Promise<Tenant | undefined> {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
    return tenant;
  }

  async createTenant(insertTenant: DbInsertTenant): Promise<Tenant> {
    const [tenant] = await db.insert(tenants).values(insertTenant).returning();
    return tenant;
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

  // --- Departments ---
  async getDepartments(tenantId: string): Promise<Department[]> {
    return await db.select().from(departments).where(eq(departments.tenantId, tenantId));
  }

  async createDepartment(dept: DbInsertDepartment): Promise<Department> {
    const [d] = await db.insert(departments).values(dept).returning();
    return d;
  }

  // --- Attendance ---
  async getAttendance(tenantId: string): Promise<AttendanceDay[]> {
    return await db.select().from(attendanceDays).where(eq(attendanceDays.tenantId, tenantId));
  }

  async createAttendance(att: DbInsertAttendanceDay): Promise<AttendanceDay> {
    const [a] = await db.insert(attendanceDays).values(att).returning();
    return a;
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

  // --- Documents ---
  async getDocuments(tenantId: string): Promise<any[]> {
    return await db.select({
      id: documents.id,
      title: documents.title,
      description: documents.description,
      filePath: documents.filePath,
      fileType: documents.fileType,
      fileSize: documents.fileSize,
      createdAt: documents.createdAt,
      categoryName: categories.name
    })
      .from(documents)
      .leftJoin(categories, eq(documents.categoryId, categories.id))
      .where(eq(documents.tenantId, tenantId))
      .orderBy(desc(documents.createdAt));
  }

  async createDocument(doc: DbInsertDocument): Promise<Document> {
    const [d] = await db.insert(documents).values(doc).returning();
    return d;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(documents).where(eq(documents.id, id));
  }

  // --- Stats ---
  async getStats(tenantId: string): Promise<any> {
    const [empCount] = await db.select({ count: sql<number>`count(*)` }).from(employees).where(eq(employees.tenantId, tenantId));
    const [deptCount] = await db.select({ count: sql<number>`count(*)` }).from(departments).where(eq(departments.tenantId, tenantId));
    const [activeEmpCount] = await db.select({ count: sql<number>`count(*)` }).from(employees).where(and(eq(employees.tenantId, tenantId), eq(employees.status, "active")));

    return {
      totalEmployees: Number(empCount?.count || 0),
      activeEmployees: Number(activeEmpCount?.count || 0),
      totalDepartments: Number(deptCount?.count || 0),
      monthlyPayroll: 50000
    };
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
    let query = db.select({
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
      .where(
        warehouseId 
          ? and(eq(stockLevels.tenantId, tenantId), eq(stockLevels.warehouseId, warehouseId))
          : eq(stockLevels.tenantId, tenantId)
      );

    return await query;
  }

  async updateStock(tenantId: string, warehouseId: string, productId: string, quantity: number, type: string, reference?: string, referenceId?: string): Promise<void> {
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

    // Log stock movement
    await db.insert(stockMovements).values({
      tenantId,
      warehouseId,
      productId,
      type,
      quantity: quantity.toString(),
      reference,
      referenceId
    });
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
      customerName: sql<string>`COALESCE(${contacts.companyName}, ${contacts.firstName} || ' ' || ${contacts.lastName})`
    })
      .from(salesOrders)
      .leftJoin(contacts, eq(salesOrders.customerId, contacts.id))
      .where(eq(salesOrders.tenantId, tenantId))
      .orderBy(desc(salesOrders.createdAt));
  }

  async getSalesOrder(id: string): Promise<any | undefined> {
    const [order] = await db.select().from(salesOrders).where(eq(salesOrders.id, id));
    if (!order) return undefined;

    const lines = await db.select().from(salesOrderLines).where(eq(salesOrderLines.salesOrderId, id));
    return { ...order, lines };
  }

  async createSalesOrder(order: DbInsertSalesOrder, lines: DbInsertSalesOrderLine[]): Promise<SalesOrder> {
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

  async createPurchaseOrder(order: DbInsertPurchaseOrder, lines: DbInsertPurchaseOrderLine[]): Promise<PurchaseOrder> {
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

  // --- Invoices ---
  async getInvoices(tenantId: string, type?: string): Promise<any[]> {
    let query = db.select({
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
      .where(
        type 
          ? and(eq(invoices.tenantId, tenantId), eq(invoices.type, type))
          : eq(invoices.tenantId, tenantId)
      )
      .orderBy(desc(invoices.createdAt));

    return await query;
  }

  async getInvoice(id: string): Promise<any | undefined> {
    const [invoice] = await db.select().from(invoices).where(eq(invoices.id, id));
    if (!invoice) return undefined;

    const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id));
    return { ...invoice, lines };
  }

  async createInvoice(invoice: DbInsertInvoice, lines: DbInsertInvoiceLine[]): Promise<Invoice> {
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
    let query = db.select({
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
      .where(
        type 
          ? and(eq(payments.tenantId, tenantId), eq(payments.type, type))
          : eq(payments.tenantId, tenantId)
      );

    return await query;
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
}

export const storage = new DatabaseStorage();