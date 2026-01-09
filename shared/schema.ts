import { pgTable, text, serial, integer, boolean, timestamp, uuid, date, numeric, uniqueIndex, jsonb, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ==========================================
// 1. TENANCY
// ==========================================

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  legalName: text("legal_name"),
  regNo: text("reg_no"),
  vatNo: text("vat_no"),
  countryCode: text("country_code").notNull().default("MN"),
  timezone: text("timezone").notNull().default("Asia/Ulaanbaatar"),
  currencyCode: text("currency_code").notNull().default("MNT"),
  status: text("status").notNull().default("active"), // active/suspended
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const branches = pgTable("branches", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  code: text("code"),
  address: text("address"),
  isHq: boolean("is_hq").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqBranch: uniqueIndex("branch_tenant_name_idx").on(t.tenantId, t.name),
}));

// ==========================================
// 2. USERS & AUTH
// ==========================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  email: text("email").notNull(),
  fullName: text("full_name"),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("User"), // Added for backward compatibility
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqUser: uniqueIndex("user_tenant_email_idx").on(t.tenantId, t.email),
}));

// Note: connect-pg-simple creates its own "session" table automatically
// Our custom sessions table for API token management (RBAC)
export const sessions = pgTable("sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  tokenHash: text("token_hash").notNull(),
  ip: text("ip"),
  userAgent: text("user_agent"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  revokedAt: timestamp("revoked_at"),
});

// ==========================================
// 3. RBAC (Roles & Permissions)
// ==========================================

export const roles = pgTable("roles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  description: text("description"),
  isSystem: boolean("is_system").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqRole: uniqueIndex("role_tenant_name_idx").on(t.tenantId, t.name),
}));

export const permissions = pgTable("permissions", {
  id: uuid("id").primaryKey().defaultRandom(),
  resource: text("resource").notNull(),
  action: text("action").notNull(),
  description: text("description"),
}, (t) => ({
  unqPermission: uniqueIndex("permission_resource_action_idx").on(t.resource, t.action),
}));

export const rolePermissions = pgTable("role_permissions", {
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
  permissionId: uuid("permission_id").references(() => permissions.id, { onDelete: "cascade" }).notNull(),
}, (t) => ({
  pk: uniqueIndex("role_permission_pk").on(t.roleId, t.permissionId),
}));

export const userRoles = pgTable("user_roles", {
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  roleId: uuid("role_id").references(() => roles.id, { onDelete: "cascade" }).notNull(),
}, (t) => ({
  pk: uniqueIndex("user_role_pk").on(t.userId, t.roleId),
}));

// ==========================================
// 4. AUDIT LOG
// ==========================================

export const auditLogs = pgTable("audit_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  actorUserId: uuid("actor_user_id").references(() => users.id, { onDelete: "set null" }),
  eventTime: timestamp("event_time").notNull().defaultNow(),
  entityType: text("entity_type").notNull(),
  entityId: uuid("entity_id"),
  action: text("action").notNull(),
  status: text("status").notNull().default("success"),
  message: text("message"),
  beforeData: jsonb("before_data"),
  afterData: jsonb("after_data"),
  requestId: text("request_id"),
  ip: text("ip"),
  userAgent: text("user_agent"),
});

// ==========================================
// 5. HR (Departments & Employees)
// ==========================================

export const departments = pgTable("departments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  name: text("name").notNull(),
  code: text("code"),
  parentDepartmentId: uuid("parent_department_id").references((): any => departments.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqDept: uniqueIndex("dept_tenant_name_idx").on(t.tenantId, t.name),
}));

export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),

  employeeNo: text("employee_no"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  gender: text("gender"),
  birthDate: date("birth_date"),
  phone: text("phone"),
  email: text("email"),

  hireDate: date("hire_date").notNull(),
  terminationDate: date("termination_date"),
  status: text("status").notNull().default("active"),

  baseSalary: numeric("base_salary", { precision: 14, scale: 2 }).notNull().default("0"),
  payFrequency: text("pay_frequency").notNull().default("monthly"),
  bankAccount: text("bank_account"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqEmp: uniqueIndex("emp_tenant_no_idx").on(t.tenantId, t.employeeNo),
}));

// ==========================================
// 6. ATTENDANCE
// ==========================================

export const attendanceDays = pgTable("attendance_days", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),

  workDate: date("work_date").notNull(),
  checkIn: timestamp("check_in"),
  checkOut: timestamp("check_out"),
  minutesWorked: integer("minutes_worked"),
  status: text("status").notNull().default("present"),
  note: text("note"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqAtt: uniqueIndex("emp_date_idx").on(t.tenantId, t.employeeId, t.workDate),
}));

// ==========================================
// 7. PAYROLL
// ==========================================

export const payrollRuns = pgTable("payroll_runs", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),

  periodStart: date("period_start").notNull(),
  periodEnd: date("period_end").notNull(),
  payDate: date("pay_date").notNull(),

  status: text("status").notNull().default("draft"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqRun: uniqueIndex("run_tenant_branch_period_idx").on(t.tenantId, t.branchId, t.periodStart, t.periodEnd),
}));

export const payslips = pgTable("payslips", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  payrollRunId: uuid("payroll_run_id").references(() => payrollRuns.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),

  grossPay: numeric("gross_pay", { precision: 14, scale: 2 }).notNull().default("0"),
  totalDeductions: numeric("total_deductions", { precision: 14, scale: 2 }).notNull().default("0"),
  netPay: numeric("net_pay", { precision: 14, scale: 2 }).notNull().default("0"),

  status: text("status").notNull().default("draft"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqPayslip: uniqueIndex("payslip_tenant_run_emp_idx").on(t.tenantId, t.payrollRunId, t.employeeId),
}));

export const payslipEarnings = pgTable("payslip_earnings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  payslipId: uuid("payslip_id").references(() => payslips.id, { onDelete: "cascade" }).notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
});

export const payslipDeductions = pgTable("payslip_deductions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  payslipId: uuid("payslip_id").references(() => payslips.id, { onDelete: "cascade" }).notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),
});

// ==========================================
// 8. DOCUMENTS
// ==========================================

export const categories = pgTable("categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  type: text("type").notNull().default("general"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  unqCat: uniqueIndex("cat_tenant_name_idx").on(t.tenantId, t.name),
}));

export const documents = pgTable("documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  categoryId: uuid("category_id").references(() => categories.id, { onDelete: "set null" }),
  title: text("title").notNull(),
  description: text("description"),
  filePath: text("file_path").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ==========================================
// 9. PRODUCTS (Бараа)
// ==========================================

export const productCategories = pgTable("product_categories", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  parentId: uuid("parent_id").references((): any => productCategories.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  categoryId: uuid("category_id").references(() => productCategories.id, { onDelete: "set null" }),
  
  sku: text("sku"), // Барааны код
  name: text("name").notNull(),
  description: text("description"),
  barcode: text("barcode"),
  
  type: text("type").notNull().default("product"), // product/service
  salePrice: numeric("sale_price", { precision: 14, scale: 2 }).notNull().default("0"),
  costPrice: numeric("cost_price", { precision: 14, scale: 2 }).notNull().default("0"),
  
  unit: text("unit").notNull().default("ш"), // Нэгж (ш, кг, л)
  trackInventory: boolean("track_inventory").notNull().default(true),
  stockQuantity: numeric("stock_quantity", { precision: 14, scale: 2 }).notNull().default("0"),
  
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqProduct: uniqueIndex("product_tenant_sku_idx").on(t.tenantId, t.sku),
}));

// ==========================================
// 10. CONTACTS (CRM - Харилцагчид)
// ==========================================

export const contacts = pgTable("contacts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  
  type: text("type").notNull().default("customer"), // customer/supplier/both
  firstName: text("first_name"),
  lastName: text("last_name"),
  companyName: text("company_name"),
  
  email: text("email"),
  phone: text("phone"),
  mobile: text("mobile"),
  
  address: text("address"),
  city: text("city"),
  district: text("district"), // Дүүрэг
  postalCode: text("postal_code"),
  
  // Монголын онцлог
  regNo: text("reg_no"), // Байгууллагын РД
  vatNo: text("vat_no"), // ХХОАТ-ын дугаар
  bankName: text("bank_name"), // Банкны нэр
  bankAccount: text("bank_account"), // Банкны данс
  
  creditLimit: numeric("credit_limit", { precision: 14, scale: 2 }).default("0"),
  paymentTerms: text("payment_terms"), // Төлбөрийн нөхцөл
  
  isActive: boolean("is_active").notNull().default(true),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqContact: uniqueIndex("contact_tenant_email_idx").on(t.tenantId, t.email),
}));

// ==========================================
// 11. WAREHOUSES (Агуулах)
// ==========================================

export const warehouses = pgTable("warehouses", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  
  name: text("name").notNull(),
  code: text("code"),
  address: text("address"),
  isDefault: boolean("is_default").notNull().default(false),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqWarehouse: uniqueIndex("warehouse_tenant_name_idx").on(t.tenantId, t.name),
}));

export const stockLevels = pgTable("stock_levels", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  
  quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull().default("0"),
  reservedQuantity: numeric("reserved_quantity", { precision: 14, scale: 2 }).notNull().default("0"), // Захиалгдсан тоо
  
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqStock: uniqueIndex("stock_warehouse_product_idx").on(t.warehouseId, t.productId),
}));

export const stockMovements = pgTable("stock_movements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  
  type: text("type").notNull(), // in/out/adjustment/transfer
  quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull(),
  reference: text("reference"), // Захиалгын дугаар, нэхэмжлэхийн дугаар
  referenceId: uuid("reference_id"),
  
  note: text("note"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ==========================================
// 12. SALES (Борлуулалт)
// ==========================================

export const salesOrders = pgTable("sales_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  customerId: uuid("customer_id").references(() => contacts.id, { onDelete: "restrict" }).notNull(),
  
  orderNumber: text("order_number").notNull(), // SO-2024-001
  orderDate: date("order_date").notNull(),
  deliveryDate: date("delivery_date"),
  
  status: text("status").notNull().default("draft"), // draft/quotation/sent/confirmed/invoiced/cancelled
  paymentStatus: text("payment_status").notNull().default("unpaid"), // unpaid/partial/paid
  
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"), // ХХОАТ
  discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqSalesOrder: uniqueIndex("sales_order_tenant_number_idx").on(t.tenantId, t.orderNumber),
}));

export const salesOrderLines = pgTable("sales_order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  salesOrderId: uuid("sales_order_id").references(() => salesOrders.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }).notNull(),
  
  quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 5, scale: 2 }).default("0"), // Хувь
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("10.00"), // ХХОАТ 10%
  
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  
  description: text("description"),
});

// ==========================================
// 13. PURCHASE (Худалдан авалт)
// ==========================================

export const purchaseOrders = pgTable("purchase_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  warehouseId: uuid("warehouse_id").references(() => warehouses.id, { onDelete: "set null" }),
  supplierId: uuid("supplier_id").references(() => contacts.id, { onDelete: "restrict" }).notNull(),
  
  orderNumber: text("order_number").notNull(), // PO-2024-001
  orderDate: date("order_date").notNull(),
  expectedDate: date("expected_date"),
  
  status: text("status").notNull().default("draft"), // draft/sent/confirmed/received/cancelled
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  discountAmount: numeric("discount_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqPurchaseOrder: uniqueIndex("purchase_order_tenant_number_idx").on(t.tenantId, t.orderNumber),
}));

export const purchaseOrderLines = pgTable("purchase_order_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  purchaseOrderId: uuid("purchase_order_id").references(() => purchaseOrders.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }).notNull(),
  
  quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 5, scale: 2 }).default("0"),
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("10.00"),
  
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  
  description: text("description"),
});

// ==========================================
// 14. INVOICES (Нэхэмжлэх)
// ==========================================

export const invoices = pgTable("invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  contactId: uuid("contact_id").references(() => contacts.id, { onDelete: "restrict" }).notNull(),
  salesOrderId: uuid("sales_order_id").references(() => salesOrders.id, { onDelete: "set null" }),
  
  invoiceNumber: text("invoice_number").notNull(), // INV-2024-001
  invoiceDate: date("invoice_date").notNull(),
  dueDate: date("due_date").notNull(),
  
  type: text("type").notNull().default("sales"), // sales/purchase
  status: text("status").notNull().default("draft"), // draft/sent/paid/cancelled
  
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull().default("0"),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  totalAmount: numeric("total_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  paidAmount: numeric("paid_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  
  // Монголын онцлог
  qrCode: text("qr_code"), // QR код төлбөр
  paymentMethod: text("payment_method"), // cash/bank_transfer/qr_code
  
  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqInvoice: uniqueIndex("invoice_tenant_number_idx").on(t.tenantId, t.invoiceNumber),
}));

export const invoiceLines = pgTable("invoice_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }),
  
  description: text("description").notNull(),
  quantity: numeric("quantity", { precision: 14, scale: 2 }).notNull(),
  unitPrice: numeric("unit_price", { precision: 14, scale: 2 }).notNull(),
  taxCodeId: uuid("tax_code_id").references((): any => taxCodes.id, { onDelete: "set null" }), // ✅ Tax source of truth
  taxBase: numeric("tax_base", { precision: 14, scale: 2 }).notNull().default("0"), // ✅ Tax source
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull().default("0"), // ✅ Tax source
  taxRate: numeric("tax_rate", { precision: 5, scale: 2 }).notNull().default("10.00"),
  
  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
});

// ==========================================
// 15. ACCOUNTING (Санхүүгийн модуль)
// ==========================================

// Currencies (✅ PATCH: FK currency_id ашиглана)
export const currencies = pgTable("currencies", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  rate: numeric("rate", { precision: 10, scale: 4 }).notNull().default("1.0000"),
  isBase: boolean("is_base").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqCurrency: uniqueIndex("currency_tenant_code_idx").on(t.tenantId, t.code),
}));

// Accounts (Chart of Accounts)
export const accounts = pgTable("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  type: text("type").notNull(), // asset, liability, equity, income, expense
  parentId: uuid("parent_id").references((): any => accounts.id, { onDelete: "set null" }),
  level: integer("level").notNull(),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => ({
  unqAccount: uniqueIndex("account_tenant_code_idx").on(t.tenantId, t.code),
}));

// Journals
export const journals = pgTable("journals", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  code: text("code").notNull(),
  type: text("type").notNull(), // sales, purchase, bank, cash, general
  defaultDebitAccountId: uuid("default_debit_account_id").references(() => accounts.id, { onDelete: "set null" }),
  defaultCreditAccountId: uuid("default_credit_account_id").references(() => accounts.id, { onDelete: "set null" }),
  isActive: boolean("is_active").notNull().default(true),
}, (t) => ({
  unqJournal: uniqueIndex("journal_tenant_code_idx").on(t.tenantId, t.code),
}));

// Fiscal Years
export const fiscalYears = pgTable("fiscal_years", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  year: integer("year").notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status").notNull().default("open"), // open, closed
  closedAt: timestamp("closed_at"),
  closedBy: uuid("closed_by").references(() => users.id, { onDelete: "set null" }),
}, (t) => ({
  unqFiscalYear: uniqueIndex("fiscal_year_tenant_year_idx").on(t.tenantId, t.year),
}));

// Fiscal Periods
export const fiscalPeriods = pgTable("fiscal_periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  fiscalYearId: uuid("fiscal_year_id").references(() => fiscalYears.id, { onDelete: "cascade" }).notNull(),
  periodNumber: integer("period_number").notNull(), // 1-12
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status").notNull().default("open"), // open, closed, locked
  lockedAt: timestamp("locked_at"),
  lockedBy: uuid("locked_by").references(() => users.id, { onDelete: "set null" }),
}, (t) => ({
  unqPeriod: uniqueIndex("period_year_number_idx").on(t.fiscalYearId, t.periodNumber),
}));

// Period Locks
export const periodLocks = pgTable("period_locks", {
  id: uuid("id").primaryKey().defaultRandom(),
  periodId: uuid("period_id").references(() => fiscalPeriods.id, { onDelete: "cascade" }).notNull(),
  lockType: text("lock_type").notNull(), // 'posting' | 'all'
  lockedBy: uuid("locked_by").references(() => users.id, { onDelete: "set null" }),
  lockedAt: timestamp("locked_at").notNull().defaultNow(),
  notes: text("notes"),
});

// Numbering Sequences (Concurrency-safe document numbering)
export const numberingSequences = pgTable("numbering_sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  documentType: text("document_type").notNull(), // 'invoice', 'sales_order', 'purchase_order', 'journal_entry', 'payment'
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }), // Optional: branch-specific
  prefix: text("prefix").notNull(), // 'INV', 'SO', 'PO', 'JE', 'REV', 'PAY'
  format: text("format").notNull().default("{prefix}-{year}-{number:4}"), // Template format
  nextNumber: integer("next_number").notNull().default(1),
  year: integer("year"), // NULL = current year
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqSequence: uniqueIndex("numbering_sequence_tenant_type_branch_year_idx").on(
    t.tenantId, 
    t.documentType, 
    t.branchId, 
    t.year
  ),
}));

// Journal Entries (✅ PATCH: currency_id, reversal, period)
export const journalEntries = pgTable("journal_entries", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  journalId: uuid("journal_id").references(() => journals.id, { onDelete: "set null" }),
  entryNumber: text("entry_number").notNull(),
  entryDate: date("entry_date").notNull(),
  description: text("description"),
  reference: text("reference"),
  status: text("status").notNull().default("draft"), // draft, posted, cancelled, reversed
  postedBy: uuid("posted_by").references(() => users.id, { onDelete: "set null" }),
  postedAt: timestamp("posted_at"),
  reversalEntryId: uuid("reversal_entry_id").references((): any => journalEntries.id, { onDelete: "set null" }),
  reversedByEntryId: uuid("reversed_by_entry_id"),
  currencyId: uuid("currency_id").references(() => currencies.id, { onDelete: "set null" }), // ✅ PATCH: currency_code → currency_id
  exchangeRate: numeric("exchange_rate", { precision: 10, scale: 4 }).notNull().default("1.0000"),
  fiscalPeriodId: uuid("fiscal_period_id").references(() => fiscalPeriods.id, { onDelete: "set null" }),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  unqJournalEntry: uniqueIndex("journal_entry_tenant_number_idx").on(t.tenantId, t.entryNumber),
}));

// Journal Lines (✅ PATCH: currency_id, constraints)
export const journalLines = pgTable("journal_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  entryId: uuid("entry_id").references(() => journalEntries.id, { onDelete: "cascade" }).notNull(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "restrict" }).notNull(),
  debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 14, scale: 2 }).notNull().default("0"),
  amountCurrency: numeric("amount_currency", { precision: 14, scale: 2 }),
  currencyId: uuid("currency_id").references(() => currencies.id, { onDelete: "set null" }), // ✅ PATCH: currency_code → currency_id
  currencyRate: numeric("currency_rate", { precision: 10, scale: 4 }).notNull().default("1.0000"),
  partnerId: uuid("partner_id").references(() => contacts.id, { onDelete: "set null" }),
  description: text("description"),
  reference: text("reference"),
}, (t) => ({
  // ✅ PATCH: Constraints (Drizzle ORM дээр check constraints нэмэх хэрэгтэй SQL-ээр)
}));

// Tax Codes (✅ PATCH: VAT accounts payable/receivable ялга)
export const taxCodes = pgTable("tax_codes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  code: text("code").notNull(),
  name: text("name").notNull(),
  rate: numeric("rate", { precision: 5, scale: 2 }).notNull(),
  type: text("type").notNull(), // vat, income_tax
  taxAccountPayableId: uuid("tax_account_payable_id").references(() => accounts.id, { onDelete: "set null" }), // ✅ ХХОАТ төлөх данс
  taxAccountReceivableId: uuid("tax_account_receivable_id").references(() => accounts.id, { onDelete: "set null" }), // ✅ ХХОАТ авах данс
  isActive: boolean("is_active").notNull().default(true),
}, (t) => ({
  unqTaxCode: uniqueIndex("tax_code_tenant_code_idx").on(t.tenantId, t.code),
}));

// Tax Lines
export const taxLines = pgTable("tax_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  journalLineId: uuid("journal_line_id").references(() => journalLines.id, { onDelete: "cascade" }).notNull(),
  taxCodeId: uuid("tax_code_id").references(() => taxCodes.id, { onDelete: "restrict" }).notNull(),
  taxBase: numeric("tax_base", { precision: 14, scale: 2 }).notNull(),
  taxAmount: numeric("tax_amount", { precision: 14, scale: 2 }).notNull(),
  sourceType: text("source_type").notNull(), // 'invoice_line' | 'manual'
  sourceId: uuid("source_id"),
  reference: text("reference"),
  referenceId: uuid("reference_id"),
});

// Payments (✅ Тусад нь хүснэгт, currency_id)
export const payments = pgTable("payments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  paymentNumber: text("payment_number").notNull(),
  paymentDate: date("payment_date").notNull(),
  type: text("type").notNull(), // 'payment' | 'receipt'
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  currencyId: uuid("currency_id").references(() => currencies.id, { onDelete: "set null" }), // ✅ PATCH: currency_code → currency_id
  bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, { onDelete: "set null" }),
  paymentMethod: text("payment_method"),
  status: text("status").notNull().default("draft"),
  reference: text("reference"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  postedAt: timestamp("posted_at"),
  journalEntryId: uuid("journal_entry_id").references(() => journalEntries.id, { onDelete: "set null" }),
}, (t) => ({
  unqPayment: uniqueIndex("payment_tenant_number_idx").on(t.tenantId, t.paymentNumber),
}));

// Payment Allocations (✅ PATCH: UPSERT + cap checks - SQL trigger)
export const paymentAllocations = pgTable("payment_allocations", {
  id: uuid("id").primaryKey().defaultRandom(),
  paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "cascade" }).notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  allocatedAmount: numeric("allocated_amount", { precision: 14, scale: 2 }).notNull(),
  allocationDate: date("allocation_date").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  unqAllocation: uniqueIndex("allocation_payment_invoice_idx").on(t.paymentId, t.invoiceId),
}));

// Bank Accounts (✅ currency_id)
export const bankAccounts = pgTable("bank_accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  accountNumber: text("account_number").notNull(),
  bankName: text("bank_name").notNull(),
  currencyId: uuid("currency_id").references(() => currencies.id, { onDelete: "set null" }), // ✅ PATCH: currency_code → currency_id
  balance: numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }), // GL account
  isActive: boolean("is_active").notNull().default(true),
});

// Bank Statements
export const bankStatements = pgTable("bank_statements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  bankAccountId: uuid("bank_account_id").references(() => bankAccounts.id, { onDelete: "cascade" }).notNull(),
  statementDate: date("statement_date").notNull(),
  openingBalance: numeric("opening_balance", { precision: 14, scale: 2 }).notNull(),
  closingBalance: numeric("closing_balance", { precision: 14, scale: 2 }).notNull(),
  importedAt: timestamp("imported_at").notNull().defaultNow(),
  importedBy: uuid("imported_by").references(() => users.id, { onDelete: "set null" }),
});

// Bank Statement Lines (✅ PATCH: debit/credit constraint)
export const bankStatementLines = pgTable("bank_statement_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  statementId: uuid("statement_id").references(() => bankStatements.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(),
  description: text("description"),
  debit: numeric("debit", { precision: 14, scale: 2 }).notNull().default("0"),
  credit: numeric("credit", { precision: 14, scale: 2 }).notNull().default("0"),
  balance: numeric("balance", { precision: 14, scale: 2 }).notNull(),
  reference: text("reference"),
  reconciled: boolean("reconciled").notNull().default(false),
  // ✅ PATCH: Constraints - SQL trigger эсвэл check constraint
});

// Reconciliations
export const reconciliations = pgTable("reconciliations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  statementLineId: uuid("statement_line_id").references(() => bankStatementLines.id, { onDelete: "cascade" }).notNull(),
  status: text("status").notNull().default("draft"), // draft, partial, reconciled
  totalMatchedAmount: numeric("total_matched_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  reconciledAt: timestamp("reconciled_at"),
  reconciledBy: uuid("reconciled_by").references(() => users.id, { onDelete: "set null" }),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Reconciliation Matches (✅ PATCH: 3 FK баганатай - polymorphic биш)
export const reconciliationMatches = pgTable("reconciliation_matches", {
  id: uuid("id").primaryKey().defaultRandom(),
  reconciliationId: uuid("reconciliation_id").references(() => reconciliations.id, { onDelete: "cascade" }).notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }), // ✅ FK 1
  paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "cascade" }), // ✅ FK 2
  journalLineId: uuid("journal_line_id").references(() => journalLines.id, { onDelete: "cascade" }), // ✅ FK 3
  matchedAmount: numeric("matched_amount", { precision: 14, scale: 2 }).notNull(),
  matchDate: date("match_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // ✅ PATCH: Check constraint - зөвхөн нэг FK байх ёстой (SQL trigger)
});

// ==========================================
// RELATIONS
// ==========================================

export const tenantsRelations = relations(tenants, ({ many }) => ({
  branches: many(branches),
  users: many(users),
}));

export const branchesRelations = relations(branches, ({ one, many }) => ({
  tenant: one(tenants, { fields: [branches.tenantId], references: [tenants.id] }),
  departments: many(departments),
  employees: many(employees),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  roles: many(userRoles),
}));

export const rolesRelations = relations(roles, ({ one, many }) => ({
  tenant: one(tenants, { fields: [roles.tenantId], references: [tenants.id] }),
  permissions: many(rolePermissions),
  users: many(userRoles),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  tenant: one(tenants, { fields: [departments.tenantId], references: [tenants.id] }),
  branch: one(branches, { fields: [departments.branchId], references: [branches.id] }),
  parent: one(departments, { fields: [departments.parentDepartmentId], references: [departments.id] }),
  subDepartments: many(departments, { relationName: "parent" }),
  employees: many(employees),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  tenant: one(tenants, { fields: [employees.tenantId], references: [tenants.id] }),
  branch: one(branches, { fields: [employees.branchId], references: [branches.id] }),
  department: one(departments, { fields: [employees.departmentId], references: [departments.id] }),
  attendance: many(attendanceDays),
  payslips: many(payslips),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  tenant: one(tenants, { fields: [products.tenantId], references: [tenants.id] }),
  category: one(productCategories, { fields: [products.categoryId], references: [productCategories.id] }),
  salesOrderLines: many(salesOrderLines),
  purchaseOrderLines: many(purchaseOrderLines),
  stockLevels: many(stockLevels),
  stockMovements: many(stockMovements),
}));

export const productCategoriesRelations = relations(productCategories, ({ one, many }) => ({
  tenant: one(tenants, { fields: [productCategories.tenantId], references: [tenants.id] }),
  parent: one(productCategories, { fields: [productCategories.parentId], references: [productCategories.id] }),
  subCategories: many(productCategories, { relationName: "parent" }),
  products: many(products),
}));

export const contactsRelations = relations(contacts, ({ one, many }) => ({
  tenant: one(tenants, { fields: [contacts.tenantId], references: [tenants.id] }),
  salesOrders: many(salesOrders),
  purchaseOrders: many(purchaseOrders),
  invoices: many(invoices),
}));

export const warehousesRelations = relations(warehouses, ({ one, many }) => ({
  tenant: one(tenants, { fields: [warehouses.tenantId], references: [tenants.id] }),
  branch: one(branches, { fields: [warehouses.branchId], references: [branches.id] }),
  stockLevels: many(stockLevels),
  stockMovements: many(stockMovements),
  salesOrders: many(salesOrders),
  purchaseOrders: many(purchaseOrders),
}));

export const stockLevelsRelations = relations(stockLevels, ({ one }) => ({
  tenant: one(tenants, { fields: [stockLevels.tenantId], references: [tenants.id] }),
  warehouse: one(warehouses, { fields: [stockLevels.warehouseId], references: [warehouses.id] }),
  product: one(products, { fields: [stockLevels.productId], references: [products.id] }),
}));

export const stockMovementsRelations = relations(stockMovements, ({ one }) => ({
  tenant: one(tenants, { fields: [stockMovements.tenantId], references: [tenants.id] }),
  warehouse: one(warehouses, { fields: [stockMovements.warehouseId], references: [warehouses.id] }),
  product: one(products, { fields: [stockMovements.productId], references: [products.id] }),
  createdByUser: one(users, { fields: [stockMovements.createdBy], references: [users.id] }),
}));

export const salesOrdersRelations = relations(salesOrders, ({ one, many }) => ({
  tenant: one(tenants, { fields: [salesOrders.tenantId], references: [tenants.id] }),
  branch: one(branches, { fields: [salesOrders.branchId], references: [branches.id] }),
  warehouse: one(warehouses, { fields: [salesOrders.warehouseId], references: [warehouses.id] }),
  customer: one(contacts, { fields: [salesOrders.customerId], references: [contacts.id] }),
  createdByUser: one(users, { fields: [salesOrders.createdBy], references: [users.id] }),
  lines: many(salesOrderLines),
  invoices: many(invoices),
}));

export const salesOrderLinesRelations = relations(salesOrderLines, ({ one }) => ({
  tenant: one(tenants, { fields: [salesOrderLines.tenantId], references: [tenants.id] }),
  salesOrder: one(salesOrders, { fields: [salesOrderLines.salesOrderId], references: [salesOrders.id] }),
  product: one(products, { fields: [salesOrderLines.productId], references: [products.id] }),
}));

export const purchaseOrdersRelations = relations(purchaseOrders, ({ one, many }) => ({
  tenant: one(tenants, { fields: [purchaseOrders.tenantId], references: [tenants.id] }),
  branch: one(branches, { fields: [purchaseOrders.branchId], references: [branches.id] }),
  warehouse: one(warehouses, { fields: [purchaseOrders.warehouseId], references: [warehouses.id] }),
  supplier: one(contacts, { fields: [purchaseOrders.supplierId], references: [contacts.id] }),
  createdByUser: one(users, { fields: [purchaseOrders.createdBy], references: [users.id] }),
  lines: many(purchaseOrderLines),
}));

export const purchaseOrderLinesRelations = relations(purchaseOrderLines, ({ one }) => ({
  tenant: one(tenants, { fields: [purchaseOrderLines.tenantId], references: [tenants.id] }),
  purchaseOrder: one(purchaseOrders, { fields: [purchaseOrderLines.purchaseOrderId], references: [purchaseOrders.id] }),
  product: one(products, { fields: [purchaseOrderLines.productId], references: [products.id] }),
}));

export const invoicesRelations = relations(invoices, ({ one, many }) => ({
  tenant: one(tenants, { fields: [invoices.tenantId], references: [tenants.id] }),
  branch: one(branches, { fields: [invoices.branchId], references: [branches.id] }),
  contact: one(contacts, { fields: [invoices.contactId], references: [contacts.id] }),
  salesOrder: one(salesOrders, { fields: [invoices.salesOrderId], references: [salesOrders.id] }),
  createdByUser: one(users, { fields: [invoices.createdBy], references: [users.id] }),
  lines: many(invoiceLines),
}));

export const invoiceLinesRelations = relations(invoiceLines, ({ one }) => ({
  tenant: one(tenants, { fields: [invoiceLines.tenantId], references: [tenants.id] }),
  invoice: one(invoices, { fields: [invoiceLines.invoiceId], references: [invoices.id] }),
  product: one(products, { fields: [invoiceLines.productId], references: [products.id] }),
}));

// ==========================================
// ZOD SCHEMAS
// ==========================================

export const insertTenantSchema = createInsertSchema(tenants).omit({ id: true, createdAt: true, updatedAt: true }); // Tenant ID is self-managed or created by system admin
export const insertBranchSchema = createInsertSchema(branches).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, updatedAt: true, lastLoginAt: true, tenantId: true });
export const insertSessionSchema = createInsertSchema(sessions);
export const insertRoleSchema = createInsertSchema(roles).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertPermissionSchema = createInsertSchema(permissions).omit({ id: true });
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, eventTime: true });
export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertAttendanceDaySchema = createInsertSchema(attendanceDays).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertPayrollRunSchema = createInsertSchema(payrollRuns).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertPayslipSchema = createInsertSchema(payslips).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertPayslipEarningsSchema = createInsertSchema(payslipEarnings).omit({ id: true, tenantId: true });
export const insertPayslipDeductionsSchema = createInsertSchema(payslipDeductions).omit({ id: true, tenantId: true });
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true, tenantId: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertProductCategorySchema = createInsertSchema(productCategories).omit({ id: true, createdAt: true, tenantId: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertContactSchema = createInsertSchema(contacts).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertWarehouseSchema = createInsertSchema(warehouses).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertStockLevelSchema = createInsertSchema(stockLevels).omit({ id: true, updatedAt: true, tenantId: true });
export const insertStockMovementSchema = createInsertSchema(stockMovements).omit({ id: true, createdAt: true, tenantId: true });
export const insertSalesOrderSchema = createInsertSchema(salesOrders).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true, orderNumber: true });
export const insertSalesOrderLineSchema = createInsertSchema(salesOrderLines).omit({ id: true, tenantId: true });
export const insertPurchaseOrderSchema = createInsertSchema(purchaseOrders).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true, orderNumber: true });
export const insertPurchaseOrderLineSchema = createInsertSchema(purchaseOrderLines).omit({ id: true, tenantId: true });
export const insertInvoiceSchema = createInsertSchema(invoices).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true, invoiceNumber: true });
export const insertInvoiceLineSchema = createInsertSchema(invoiceLines).omit({ id: true, tenantId: true });

// Accounting schemas
export const insertCurrencySchema = createInsertSchema(currencies).omit({ id: true, updatedAt: true, tenantId: true });
export const insertAccountSchema = createInsertSchema(accounts).omit({ id: true, tenantId: true });
export const insertJournalSchema = createInsertSchema(journals).omit({ id: true, tenantId: true });
export const insertFiscalYearSchema = createInsertSchema(fiscalYears).omit({ id: true, tenantId: true });
export const insertFiscalPeriodSchema = createInsertSchema(fiscalPeriods).omit({ id: true });
export const insertJournalEntrySchema = createInsertSchema(journalEntries).omit({ id: true, createdAt: true, tenantId: true, entryNumber: true });
export const insertJournalLineSchema = createInsertSchema(journalLines).omit({ id: true });
export const insertTaxCodeSchema = createInsertSchema(taxCodes).omit({ id: true, tenantId: true });
export const insertTaxLineSchema = createInsertSchema(taxLines).omit({ id: true });
export const insertNumberingSequenceSchema = createInsertSchema(numberingSequences).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true, tenantId: true, paymentNumber: true });
export const insertPaymentAllocationSchema = createInsertSchema(paymentAllocations).omit({ id: true, createdAt: true });
export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({ id: true, tenantId: true });
export const insertBankStatementSchema = createInsertSchema(bankStatements).omit({ id: true, importedAt: true, tenantId: true });
export const insertBankStatementLineSchema = createInsertSchema(bankStatementLines).omit({ id: true });
export const insertReconciliationSchema = createInsertSchema(reconciliations).omit({ id: true, createdAt: true, tenantId: true });
export const insertReconciliationMatchSchema = createInsertSchema(reconciliationMatches).omit({ id: true, createdAt: true });

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Branch = typeof branches.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Role = typeof roles.$inferSelect;
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type AttendanceDay = typeof attendanceDays.$inferSelect;
export type InsertAttendanceDay = z.infer<typeof insertAttendanceDaySchema>;
export type PayrollRun = typeof payrollRuns.$inferSelect;
export type InsertPayrollRun = z.infer<typeof insertPayrollRunSchema>;
export type Payslip = typeof payslips.$inferSelect;
export type InsertPayslip = z.infer<typeof insertPayslipSchema>;
export type Category = typeof categories.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type ProductCategory = typeof productCategories.$inferSelect;
export type InsertProductCategory = z.infer<typeof insertProductCategorySchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Contact = typeof contacts.$inferSelect;
export type InsertContact = z.infer<typeof insertContactSchema>;
export type Warehouse = typeof warehouses.$inferSelect;
export type InsertWarehouse = z.infer<typeof insertWarehouseSchema>;
export type StockLevel = typeof stockLevels.$inferSelect;
export type InsertStockLevel = z.infer<typeof insertStockLevelSchema>;
export type StockMovement = typeof stockMovements.$inferSelect;
export type InsertStockMovement = z.infer<typeof insertStockMovementSchema>;
export type SalesOrder = typeof salesOrders.$inferSelect;
export type InsertSalesOrder = z.infer<typeof insertSalesOrderSchema>;
export type SalesOrderLine = typeof salesOrderLines.$inferSelect;
export type InsertSalesOrderLine = z.infer<typeof insertSalesOrderLineSchema>;
export type PurchaseOrder = typeof purchaseOrders.$inferSelect;
export type InsertPurchaseOrder = z.infer<typeof insertPurchaseOrderSchema>;
export type PurchaseOrderLine = typeof purchaseOrderLines.$inferSelect;
export type InsertPurchaseOrderLine = z.infer<typeof insertPurchaseOrderLineSchema>;
export type Invoice = typeof invoices.$inferSelect;
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type InvoiceLine = typeof invoiceLines.$inferSelect;
export type InsertInvoiceLine = z.infer<typeof insertInvoiceLineSchema>;
// Full DB Insert types (including tenantId) for backend use
export type DbInsertUser = typeof users.$inferInsert;
export type DbInsertTenant = typeof tenants.$inferInsert;
export type DbInsertBranch = typeof branches.$inferInsert;
export type DbInsertRole = typeof roles.$inferInsert;
export type DbInsertDepartment = typeof departments.$inferInsert;
export type DbInsertEmployee = typeof employees.$inferInsert;
export type DbInsertAttendanceDay = typeof attendanceDays.$inferInsert;
export type DbInsertPayrollRun = typeof payrollRuns.$inferInsert;
export type DbInsertPayslip = typeof payslips.$inferInsert;
export type DbInsertCategory = typeof categories.$inferInsert;
export type DbInsertDocument = typeof documents.$inferInsert;
export type DbInsertProductCategory = typeof productCategories.$inferInsert;
export type DbInsertProduct = typeof products.$inferInsert;
export type DbInsertContact = typeof contacts.$inferInsert;
export type DbInsertWarehouse = typeof warehouses.$inferInsert;
export type DbInsertStockLevel = typeof stockLevels.$inferInsert;
export type DbInsertStockMovement = typeof stockMovements.$inferInsert;
export type DbInsertSalesOrder = typeof salesOrders.$inferInsert;
export type DbInsertSalesOrderLine = typeof salesOrderLines.$inferInsert;
export type DbInsertPurchaseOrder = typeof purchaseOrders.$inferInsert;
export type DbInsertPurchaseOrderLine = typeof purchaseOrderLines.$inferInsert;
export type DbInsertInvoice = typeof invoices.$inferInsert;
export type DbInsertInvoiceLine = typeof invoiceLines.$inferInsert;
export type Currency = typeof currencies.$inferSelect;
export type InsertCurrency = z.infer<typeof insertCurrencySchema>;
export type Account = typeof accounts.$inferSelect;
export type InsertAccount = z.infer<typeof insertAccountSchema>;
export type Journal = typeof journals.$inferSelect;
export type InsertJournal = z.infer<typeof insertJournalSchema>;
export type FiscalYear = typeof fiscalYears.$inferSelect;
export type InsertFiscalYear = z.infer<typeof insertFiscalYearSchema>;
export type FiscalPeriod = typeof fiscalPeriods.$inferSelect;
export type InsertFiscalPeriod = z.infer<typeof insertFiscalPeriodSchema>;
export type JournalEntry = typeof journalEntries.$inferSelect;
export type InsertJournalEntry = z.infer<typeof insertJournalEntrySchema>;
export type JournalLine = typeof journalLines.$inferSelect;
export type InsertJournalLine = z.infer<typeof insertJournalLineSchema>;
export type TaxCode = typeof taxCodes.$inferSelect;
export type InsertTaxCode = z.infer<typeof insertTaxCodeSchema>;
export type TaxLine = typeof taxLines.$inferSelect;
export type InsertTaxLine = z.infer<typeof insertTaxLineSchema>;
export type NumberingSequence = typeof numberingSequences.$inferSelect;
export type InsertNumberingSequence = z.infer<typeof insertNumberingSequenceSchema>;
export type DbInsertNumberingSequence = Omit<InsertNumberingSequence, "createdAt" | "updatedAt">;
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type PaymentAllocation = typeof paymentAllocations.$inferSelect;
export type InsertPaymentAllocation = z.infer<typeof insertPaymentAllocationSchema>;
export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;
export type BankStatement = typeof bankStatements.$inferSelect;
export type InsertBankStatement = z.infer<typeof insertBankStatementSchema>;
export type BankStatementLine = typeof bankStatementLines.$inferSelect;
export type InsertBankStatementLine = z.infer<typeof insertBankStatementLineSchema>;
export type Reconciliation = typeof reconciliations.$inferSelect;
export type InsertReconciliation = z.infer<typeof insertReconciliationSchema>;
export type ReconciliationMatch = typeof reconciliationMatches.$inferSelect;
export type InsertReconciliationMatch = z.infer<typeof insertReconciliationMatchSchema>;
export type DbInsertCurrency = typeof currencies.$inferInsert;
export type DbInsertAccount = typeof accounts.$inferInsert;
export type DbInsertJournal = typeof journals.$inferInsert;
export type DbInsertJournalEntry = typeof journalEntries.$inferInsert;
export type DbInsertJournalLine = typeof journalLines.$inferInsert;
export type DbInsertTaxCode = typeof taxCodes.$inferInsert;
export type DbInsertPayment = typeof payments.$inferInsert;
export type DbInsertPaymentAllocation = typeof paymentAllocations.$inferInsert;
export type DbInsertBankAccount = typeof bankAccounts.$inferInsert;
export type DbInsertBankStatement = typeof bankStatements.$inferInsert;

