import { pgTable, text, serial, integer, boolean, timestamp, uuid, date, numeric, uniqueIndex, index, jsonb, check, AnyPgColumn } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { validateMongolianNationalId, validateMongolianVATNo, validateMongolianPhone } from "./mongolian-validators";

// ==========================================
// 1. TENANCY
// ==========================================

export const tenants = pgTable("tenants", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(),
  code: text("code").unique(), // Company invite code (e.g., "MON-8899")
  legalName: text("legal_name"),
  regNo: text("reg_no"),
  vatNo: text("vat_no"),
  address: text("address"), // Хаяг (E-barimt-д хэрэгтэй)
  district: text("district"), // Дүүрэг (E-barimt-д хэрэгтэй)
  city: text("city").default("Улаанбаатар"), // Хот (E-barimt-д хэрэгтэй)
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
  latitude: numeric("latitude", { precision: 10, scale: 8 }),
  longitude: numeric("longitude", { precision: 11, scale: 8 }),
  geofenceRadius: integer("geofence_radius").default(100), // meters
  officeWifiSsid: text("office_wifi_ssid").array(), // Array of WiFi SSIDs
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  unqBranch: uniqueIndex("branch_tenant_name_idx").on(t.tenantId, t.name),
}));

export const companySettings = pgTable("company_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  workStartTime: text("work_start_time").notNull().default("09:00"),
  workEndTime: text("work_end_time").notNull().default("18:00"),
  lateThresholdMinutes: integer("late_threshold_minutes").notNull().default(0),
  documentAccessPolicy: text("document_access_policy").notNull().default("history"), // 'strict' | 'history'
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  unqTenantSettings: uniqueIndex("company_settings_tenant_idx").on(t.tenantId),
}));

// ==========================================
// 2. USERS & AUTH
// ==========================================

export const users = pgTable("users", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  username: text("username").notNull().default(""), // Added for distinct login identifier
  email: text("email").notNull(),
  fullName: text("full_name"),
  passwordHash: text("password_hash"),
  role: text("role").notNull().default("User"), // Added for backward compatibility
  status: text("status").notNull().default("active"), // 'pending' | 'active' | 'rejected' - Admin approval workflow
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  settings: jsonb("settings").default({}), // For storing UI preferences like favorites
  // 2FA (Two-Factor Authentication)
  twoFactorSecret: text("two_factor_secret"), // TOTP secret (encrypted in production)
  twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
  signatureUrl: text("signature_url"), // Digital signature image URL
  signatureTitle: text("signature_title"), // Customized title for signature (defaults to jobTitle if null)
  jobTitle: text("job_title"), // Албан тушаал (Ерөнхий захирал, г.м.)
  canSignDocuments: boolean("can_sign_documents").notNull().default(false), // Гарын үсэг зурах эрх
  mustChangePassword: boolean("must_change_password").notNull().default(false), // First login password change
  inviteTokenHash: text("invite_token_hash"), // Урилгын токен
  inviteExpiresAt: timestamp("invite_expires_at"), // Урилгын хугацаа
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqUserEmail: uniqueIndex("user_tenant_email_idx").on(t.tenantId, t.email),
  unqUserUsername: uniqueIndex("user_tenant_username_idx").on(t.tenantId, t.username),
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
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
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
  actorId: uuid("actor_user_id").notNull(), // Mapped to actor_user_id
  // actorRole removed as it doesn't exist in DB

  entity: text("entity_type").notNull(), // Mapped to entity_type
  entityId: uuid("entity_id").notNull(),

  action: text("action").notNull(),
  status: text("status"), // Added to match DB
  message: text("message"), // Added to match DB

  beforeData: jsonb("before_data"),
  afterData: jsonb("after_data"),

  ipAddress: text("ip"), // Mapped to ip
  userAgent: text("user_agent"),
  requestId: text("request_id"),
  // route removed as it doesn't exist in DB

  createdAt: timestamp("event_time").defaultNow().notNull(), // Mapped to event_time
}, (t) => ({
  idxTenantTime: index("audit_tenant_time_idx").on(t.tenantId, t.createdAt),
  idxEntity: index("audit_entity_idx").on(t.tenantId, t.entity, t.entityId),
  idxActor: index("audit_actor_idx").on(t.tenantId, t.actorId, t.createdAt),
}));

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
  managerId: uuid("manager_id"), // Will reference employees.id (circular reference handled via migration)
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqDept: uniqueIndex("dept_tenant_name_idx").on(t.tenantId, t.name),
}));

export const jobTitles = pgTable("job_titles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), // Монгол нэр (Захирал, Менежер, г.м)
  code: text("code"), // JOB-001
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }), // Optional department link
  isActive: boolean("is_active").notNull().default(true),

  settings: jsonb("settings"), // Flexible configuration for permissions/workflow mapping

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqJobTitle: uniqueIndex("job_title_tenant_name_idx").on(t.tenantId, t.name),
}));

export const employees = pgTable("employees", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  branchId: uuid("branch_id").references(() => branches.id, { onDelete: "set null" }),
  departmentId: uuid("department_id").references(() => departments.id, { onDelete: "set null" }),
  // New standardized job title
  jobTitleId: uuid("job_title_id").references(() => jobTitles.id, { onDelete: "set null" }),

  userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }), // Link to users for RBAC

  employeeNo: text("employee_no"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name"),
  nationalId: text("national_id"), // Монголын РД (Регистрийн дугаар)
  gender: text("gender"),
  birthDate: date("birth_date"),
  phone: text("phone"),
  email: text("email"),
  position: text("position"), // OLD free-text field (Keep for backward compatibility)

  hireDate: date("hire_date").notNull(),
  terminationDate: date("termination_date"),
  status: text("status").notNull().default("active"), // active, probation, on_leave, terminated

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
  checkInPhoto: text("check_in_photo"), // Base64 or URL
  checkOutPhoto: text("check_out_photo"), // Base64 or URL

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqAtt: uniqueIndex("emp_date_idx").on(t.tenantId, t.employeeId, t.workDate),
}));

// ==========================================
// 6.1 LEAVE REQUESTS (Чөлөөний хүсэлт)
// ==========================================

export const leaveRequests = pgTable("leave_requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),

  type: text("type").notNull().default("vacation"), // vacation, sick, personal, other
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  reason: text("reason"),

  status: text("status").notNull().default("pending"), // pending, approved, rejected
  approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

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

// Salary Advances (Цалингийн урьдчилгаа)
export const salaryAdvances = pgTable("salary_advances", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),

  requestDate: date("request_date").notNull().defaultNow(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  reason: text("reason"), // Шалтгаан

  status: text("status").notNull().default("pending"), // pending/approved/rejected/paid/deducted
  requestedBy: uuid("requested_by").references(() => users.id, { onDelete: "set null" }), // Ажилтан эсвэл удирдлага

  approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),

  // Суутгал мэдээлэл
  deductionType: text("deduction_type").default("monthly"), // monthly (сарын тогтмол) / one-time (нэг удаа)
  monthlyDeductionAmount: numeric("monthly_deduction_amount", { precision: 14, scale: 2 }), // Сар бүр хэдэн төгрөг хасах
  totalDeductionMonths: integer("total_deduction_months"), // Хэдэн сар хасах
  deductedAmount: numeric("deducted_amount", { precision: 14, scale: 2 }).notNull().default("0"), // Одоогоор хэдэн төгрөг хассан

  // Зээлийн мэдээлэл (урт хугацааны зээл)
  isLoan: boolean("is_loan").notNull().default(false), // Энэ нь зээл эсэх
  loanInterestRate: numeric("loan_interest_rate", { precision: 5, scale: 2 }), // Хүүгийн хувь (жиш: 1.5%)

  paidAt: timestamp("paid_at"), // Төлсөн огноо
  fullyDeductedAt: timestamp("fully_deducted_at"), // Бүрэн суутгагдсан огноо

  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// Employee Allowances (Нэмэгдэл)
export const employeeAllowances = pgTable("employee_allowances", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),

  code: text("code").notNull(), // ALLOW-001, TRANSPORT, MEAL, etc.
  name: text("name").notNull(), // Унааны мөнгө, Хоолны мөнгө, etc.
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull().default("0"),

  // Татварын мэдээлэл
  isTaxable: boolean("is_taxable").notNull().default(true), // ХХОАТ тооцох эсэх
  isSHI: boolean("is_shi").notNull().default(true), // НДШ тооцох эсэх (Нийгмийн даатгалын шимтгэл)
  isPIT: boolean("is_pit").notNull().default(true), // ХХОАТ тооцох эсэх (Хувь хүний орлогын албан татвар)

  // Тогтмол эсэх
  isRecurring: boolean("is_recurring").notNull().default(true), // Сар бүр автоматаар нэмэх эсэх
  effectiveFrom: date("effective_from").notNull().defaultNow(), // Хэзээс эхлэх
  effectiveTo: date("effective_to"), // Хэзээ хүртэл (null = хязгааргүй)

  note: text("note"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqEmpCode: uniqueIndex("emp_allow_emp_code_idx").on(t.tenantId, t.employeeId, t.code),
}));

// ==========================================
// 8. HR GAMIFICATION
// ==========================================

export const employeeAchievements = pgTable("employee_achievements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  achievementType: text("achievement_type").notNull(), // 'early_bird', 'perfect_month', 'perfect_week', etc.
  achievedAt: timestamp("achieved_at").notNull().defaultNow(),
  metadata: jsonb("metadata"), // Additional data (e.g., streak days, month/year)
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  unqAchievement: uniqueIndex("emp_achievement_idx").on(t.tenantId, t.employeeId, t.achievementType, sql`DATE(${t.achievedAt})`),
}));

export const employeePoints = pgTable("employee_points", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  points: integer("points").notNull().default(0),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqEmployee: uniqueIndex("emp_points_uniq_idx").on(t.tenantId, t.employeeId),
}));

export const pointsHistory = pgTable("points_history", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  points: integer("points").notNull(), // Can be positive or negative
  reason: text("reason").notNull(), // 'attendance', 'early_bird_badge', 'kudos_received', etc.
  sourceType: text("source_type"), // 'attendance', 'achievement', 'kudos', 'store_purchase'
  sourceId: uuid("source_id"), // Reference to source record
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ==========================================
// 9. NEWS FEED (Phase 3)
// ==========================================

export const companyPosts = pgTable("company_posts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  authorId: uuid("author_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  title: text("title").notNull(),
  content: text("content").notNull(),
  postType: text("post_type").notNull().default("announcement"), // 'announcement', 'birthday', 'achievement', 'event'
  severity: text("severity").notNull().default("info"), // 'info', 'warning', 'critical'
  images: text("images").array(), // Array of image URLs
  files: jsonb("files"), // Array of { name, url, size, type }
  actions: jsonb("actions"), // Array of { label, url, style }
  likesCount: integer("likes_count").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),
  isPinned: boolean("is_pinned").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const postLikes = pgTable("post_likes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  postId: uuid("post_id").references(() => companyPosts.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  reactionType: text("reaction_type").notNull().default("like"), // 'like', 'love', 'haha', 'wow', 'sad', 'angry'
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  unqLike: uniqueIndex("post_like_uniq_idx").on(t.tenantId, t.postId, t.employeeId),
}));

export const postComments = pgTable("post_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  postId: uuid("post_id").references(() => companyPosts.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});


// ==========================================
// 9.5 PAYROLL STAGING (Canteen & Deductions)
// ==========================================

export const payrollStagingLines = pgTable("payroll_staging_lines", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),

  period: text("period").notNull(), // YYYY-MM
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),

  sourceType: text("source_type").notNull(), // 'meal', 'advance', 'bonus', 'penalty'
  sourceId: text("source_id").notNull(), // Idempotency key (e.g., 'meal:2024-02:emp-uuid')

  amount: integer("amount").notNull().default(0), // Negative for deduction, positive for addition
  currency: text("currency").notNull().default("MNT"),

  status: text("status").notNull().default("pending"), // 'pending', 'approved', 'posted', 'voided'
  description: text("description"),

  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),

  approvedBy: uuid("approved_by").references(() => users.id, { onDelete: "set null" }),
  approvedAt: timestamp("approved_at"),

  postedAt: timestamp("posted_at"), // When it was posted to GL/Payroll
}, (t) => ({
  unqStaging: uniqueIndex("staging_line_uniq_idx").on(t.tenantId, t.period, t.employeeId, t.sourceType), // One line per source type per period per employee
  idxSource: index("staging_line_source_idx").on(t.sourceId),
}));

export const payrollStagingLinesRelations = relations(payrollStagingLines, ({ one }) => ({
  tenant: one(tenants, { fields: [payrollStagingLines.tenantId], references: [tenants.id] }),
  employee: one(employees, { fields: [payrollStagingLines.employeeId], references: [employees.id] }),
  creator: one(users, { fields: [payrollStagingLines.createdBy], references: [users.id] }),
  approver: one(users, { fields: [payrollStagingLines.approvedBy], references: [users.id] }),
}));

export const insertPayrollStagingLineSchema = createInsertSchema(payrollStagingLines).omit({
  id: true,
  createdAt: true,
  approvedAt: true,
  postedAt: true,
});

export type PayrollStagingLine = typeof payrollStagingLines.$inferSelect;
export type InsertPayrollStagingLine = z.infer<typeof insertPayrollStagingLineSchema>;

// ==========================================
// 10. WEATHER WIDGET
// ==========================================

export const weatherAlerts = pgTable("weather_alerts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  alertType: text("alert_type").notNull(), // 'extreme_cold', 'extreme_heat', 'air_pollution', 'traffic_jam'
  temperatureCelsius: numeric("temperature_celsius"),
  conditionText: text("condition_text"),
  message: text("message").notNull(),
  suggestedAction: text("suggested_action"), // 'work_from_home', 'dress_warmly', 'avoid_outdoor'
  isSent: boolean("is_sent").notNull().default(false),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const weatherSettings = pgTable("weather_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  cityName: text("city_name").notNull().default("Ulaanbaatar"),
  countryCode: text("country_code").notNull().default("MN"),
  latitude: numeric("latitude"),
  longitude: numeric("longitude"),
  apiKey: text("api_key"), // OpenWeatherMap API key
  alertEnabled: boolean("alert_enabled").notNull().default(true),
  coldThreshold: numeric("cold_threshold").notNull().default("-25"), // Alert if below this temperature
  heatThreshold: numeric("heat_threshold").notNull().default("35"), // Alert if above this temperature
  checkIntervalHours: integer("check_interval_hours").notNull().default(6), // Check weather every 6 hours
  lastCheckedAt: timestamp("last_checked_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqTenant: uniqueIndex("weather_settings_tenant_idx").on(t.tenantId),
}));

// ==========================================
// 11. DOCUMENTS
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

  name: text("name").notNull(),
  type: text("type").notNull(),
  mimeType: text("mime_type"),
  path: text("path").notNull(),
  size: integer("size"),
  parentId: uuid("parent_id").references((): AnyPgColumn => documents.id),

  relatedEntityType: text("related_entity_type"),
  relatedEntityId: text("related_entity_id"),

  isSigned: boolean("is_signed").default(false),
  signedBy: uuid("signed_by"),
  signedAt: timestamp("signed_at"),

  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),

  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),

  // DMS Fields
  docNumber: text("doc_number"),
  description: text("description"),
  priority: text("priority").default("normal"), // 'normal', 'urgent', 'critical'
  status: text("status").default("draft"), // 'draft', 'pending', 'processing', 'completed', 'expired', 'unsolved'
  currentHolderId: uuid("current_holder_id").references(() => users.id, { onDelete: "set null" }),

  isArchived: boolean("is_archived").notNull().default(false),

  // SLA Logic
  deadline: timestamp("deadline"),
  isOverdue: boolean("is_overdue").default(false),
  createdBy: uuid("created_by").references(() => users.id),
  internalNotes: text("internal_notes"), // New field for redaction
});

export const documentLogs = pgTable("document_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }).notNull(),

  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }),
  action: text("action").notNull(),

  fromUserId: uuid("from_user_id"),
  toUserId: uuid("to_user_id"),

  comment: text("comment"),
  timestamp: timestamp("timestamp").defaultNow(),
});

export const documentReads = pgTable("document_reads", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  documentId: uuid("document_id").references(() => documents.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  readAt: timestamp("read_at").notNull().defaultNow(),
}, (t) => ({
  unqRead: uniqueIndex("document_read_unq").on(t.tenantId, t.userId, t.documentId),
  idxReadAt: index("document_read_at_idx").on(t.tenantId, t.userId, t.readAt),
}));

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
  trackExpiry: boolean("track_expiry").notNull().default(false), // Expiry date tracking шаардлагатай эсэх
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

  // Expiry/Batch Tracking
  batchNumber: text("batch_number"), // Баглааны дугаар
  expiryDate: date("expiry_date"), // Хугацаа дуусах огноо

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
  ebarimtDocumentId: text("ebarimt_document_id"), // E-barimt системийн баримтын ID
  ebarimtQrCode: text("ebarimt_qr_code"), // E-barimt QR код
  ebarimtReceiptNumber: text("ebarimt_receipt_number"), // E-barimt receipt number
  ebarimtLotteryNumber: text("ebarimt_lottery_number"), // E-barimt сугалааны дугаар (8 орон)
  ebarimtSentAt: timestamp("ebarimt_sent_at"), // E-barimt руу илгээсэн огноо

  // Паданы дугаарлалт (idempotent)
  dispatchPadanNumber: text("dispatch_padan_number"), // Зарлагын паданы дугаар (ЗП-YYYYMM-000123)
  receiptPadanNumber: text("receipt_padan_number"), // Орлогын паданы дугаар (ОП-YYYYMM-000045)

  notes: text("notes"),
  createdBy: uuid("created_by").references(() => users.id, { onDelete: "set null" }),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqInvoice: uniqueIndex("invoice_tenant_number_idx").on(t.tenantId, t.invoiceNumber),
}));

export const padanNumberSequences = pgTable("padan_number_sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  type: text("type").notNull(), // DISPATCH or RECEIPT
  period: text("period").notNull(), // YYYYMM format
  lastNumber: integer("last_number").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqPadanSequence: uniqueIndex("padan_sequence_tenant_type_period_idx").on(t.tenantId, t.type, t.period),
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
  isDefault: boolean("is_default").notNull().default(false),
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
// QPay Integration
export const qpaySettings = pgTable("qpay_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
  mode: text("mode").notNull().default("sandbox"), // 'sandbox' | 'production'
  clientId: text("client_id"),
  clientSecret: text("client_secret"), // Encrypted in production
  invoiceCode: text("invoice_code"),
  callbackSecret: text("callback_secret"), // Webhook verification secret
  webhookUrl: text("webhook_url"), // Auto-generated webhook URL
  autoPosting: boolean("auto_posting").notNull().default(false), // Auto-post payment to journal
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqQPaySettings: uniqueIndex("qpay_settings_tenant_idx").on(t.tenantId),
}));

export const qpayInvoices = pgTable("qpay_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  invoiceId: uuid("invoice_id").references(() => invoices.id, { onDelete: "cascade" }).notNull(),
  qpayInvoiceId: text("qpay_invoice_id"), // QPay-аас буцаж ирсэн invoice ID
  qrImage: text("qr_image"), // Base64 QR code image
  qrText: text("qr_text"), // QR code text
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'paid' | 'expired' | 'cancelled'
  paymentId: uuid("payment_id").references(() => payments.id, { onDelete: "set null" }),
  callbackUrl: text("callback_url"), // Invoice-specific callback URL
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqQPayInvoice: uniqueIndex("qpay_invoices_invoice_idx").on(t.invoiceId),
}));

// E-barimt Integration (QPay-тэй ижил загвар)
export const ebarimtSettings = pgTable("ebarimt_settings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  enabled: boolean("enabled").notNull().default(false),
  mode: text("mode").notNull().default("sandbox"), // 'sandbox' | 'production'
  posEndpoint: text("pos_endpoint"), // POS API endpoint URL
  apiKey: text("api_key"), // API authentication key
  apiSecret: text("api_secret"), // API secret (encrypted in production)
  autoSend: boolean("auto_send").notNull().default(false), // Auto-send invoice when paid
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqEBarimtSettings: uniqueIndex("ebarimt_settings_tenant_idx").on(t.tenantId),
}));

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
  manager: one(employees, { fields: [departments.managerId], references: [employees.id] }),
  employees: many(employees),
}));

export const employeesRelations = relations(employees, ({ one, many }) => ({
  tenant: one(tenants, { fields: [employees.tenantId], references: [tenants.id] }),
  branch: one(branches, { fields: [employees.branchId], references: [branches.id] }),
  department: one(departments, { fields: [employees.departmentId], references: [departments.id] }),
  attendance: many(attendanceDays),
  payslips: many(payslips),
}));

export const leaveRequestsRelations = relations(leaveRequests, ({ one }) => ({
  tenant: one(tenants, { fields: [leaveRequests.tenantId], references: [tenants.id] }),
  employee: one(employees, { fields: [leaveRequests.employeeId], references: [employees.id] }),
  approvedByUser: one(users, { fields: [leaveRequests.approvedBy], references: [users.id] }),
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
export const insertAuditLogSchema = createInsertSchema(auditLogs).omit({ id: true, createdAt: true });


export const insertJobTitleSchema = createInsertSchema(jobTitles).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  tenantId: true
});
export type JobTitle = typeof jobTitles.$inferSelect;
export type InsertJobTitle = z.infer<typeof insertJobTitleSchema>;
export type DbInsertJobTitle = typeof jobTitles.$inferInsert;
export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertEmployeeSchema = createInsertSchema(employees)
  .omit({ id: true, createdAt: true, updatedAt: true, tenantId: true })
  .extend({
    firstName: z.string().min(1, "Нэр оруулах шаардлагатай"),
    lastName: z.string().optional(),
    employeeNo: z.string().optional(),
    email: z.string().email("Имэйл хаяг зөв биш").optional().or(z.literal("")),
    nationalId: z.string().optional().refine(
      (val) => {
        if (!val || val.trim() === "") return true;
        const result = validateMongolianNationalId(val);
        return result.valid;
      },
      (val) => {
        if (!val || val.trim() === "") return { message: "" };
        const result = validateMongolianNationalId(val);
        return { message: result.error || "РД зөв биш" };
      }
    ),
    phone: z.string().optional().refine(
      (val) => !val || val.trim() === "" || validateMongolianPhone(val),
      { message: "Утасны дугаар зөв биш. 8 эсвэл 10 оронтой байх ёстой (жишээ: 99112233, 9911223344)" }
    ),
    baseSalary: z.string().refine(
      (val) => {
        const num = Number(val);
        return !isNaN(num) && num >= 0;
      },
      { message: "Цалин зөв тоо байх ёстой" }
    ),
    hireDate: z.string().min(1, "Ажилд орсон огноо оруулах шаардлагатай"),
    status: z.enum(["active", "inactive", "terminated", "probation", "on_leave"], {
      errorMap: () => ({ message: "Төлөв зөв сонгоно уу" }),
    }),
  });
export const insertAttendanceDaySchema = createInsertSchema(attendanceDays).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true }).extend({
  checkIn: z.preprocess(
    (val) => (val === null || val === undefined || val === "" ? null : new Date(val as string)),
    z.date().nullable().optional()
  ),
  checkOut: z.preprocess(
    (val) => (val === null || val === undefined || val === "" ? null : new Date(val as string)),
    z.date().nullable().optional()
  ),
});
export const insertPayrollRunSchema = createInsertSchema(payrollRuns).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertPayslipSchema = createInsertSchema(payslips).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertPayslipEarningsSchema = createInsertSchema(payslipEarnings).omit({ id: true, tenantId: true });
export const insertPayslipDeductionsSchema = createInsertSchema(payslipDeductions).omit({ id: true, tenantId: true });
export const insertSalaryAdvanceSchema = createInsertSchema(salaryAdvances).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });



export const insertEmployeeAllowanceSchema = createInsertSchema(employeeAllowances).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });

export const payrollSubmissionSchema = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  paymentDate: z.string(),
  employeeId: z.string(),
  baseSalary: z.number().or(z.string()),
  netSalary: z.number().or(z.string()),
  tax: z.number().or(z.string()).optional(),
  socialInsurance: z.number().or(z.string()).optional(),
  status: z.string().optional(),
});
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true, createdAt: true, tenantId: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true, isOverdue: true });
export const insertDocumentLogSchema = createInsertSchema(documentLogs).omit({ id: true, timestamp: true });
export type DocumentLog = typeof documentLogs.$inferSelect;
export type InsertDocumentLog = z.infer<typeof insertDocumentLogSchema>;
export type DbInsertDocumentLog = typeof documentLogs.$inferInsert;

export const insertDocumentReadSchema = createInsertSchema(documentReads).omit({ id: true, readAt: true, tenantId: true });
export type DocumentRead = typeof documentReads.$inferSelect;
export type InsertDocumentRead = z.infer<typeof insertDocumentReadSchema>;
export type DbInsertDocumentRead = typeof documentReads.$inferInsert;
export const insertProductCategorySchema = createInsertSchema(productCategories).omit({ id: true, createdAt: true, tenantId: true });
export const insertProductSchema = createInsertSchema(products).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true })
  .extend({
    name: z.string().min(1, "Барааны нэр оруулах шаардлагатай"),
    sku: z.string().optional(),
    salePrice: z.string().refine(
      (val) => {
        const num = Number(val);
        return !isNaN(num) && num >= 0;
      },
      { message: "Борлуулалтын үнэ зөв тоо байх ёстой" }
    ),
    costPrice: z.string().refine(
      (val) => {
        const num = Number(val);
        return !isNaN(num) && num >= 0;
      },
      { message: "Зардлын үнэ зөв тоо байх ёстой" }
    ),
    stockQuantity: z.string().refine(
      (val) => {
        const num = Number(val);
        return !isNaN(num) && num >= 0;
      },
      { message: "Нөөцийн тоо хэмжээ зөв тоо байх ёстой" }
    ),
    type: z.enum(["product", "service"], {
      errorMap: () => ({ message: "Төрөл зөв сонгоно уу (Бараа эсвэл Үйлчилгээ)" }),
    }),
    unit: z.string().min(1, "Хэмжих нэгж оруулах шаардлагатай"),
  });
export const insertContactSchema = createInsertSchema(contacts)
  .omit({ id: true, createdAt: true, updatedAt: true, tenantId: true })
  .extend({
    regNo: z.string().optional().refine(
      (val) => {
        if (!val) return true; // Optional field
        const result = validateMongolianNationalId(val);
        return result.valid;
      },
      (val) => {
        if (!val) return { message: "" };
        const result = validateMongolianNationalId(val);
        return { message: result.error || "Байгууллагын РД зөв биш. 10 тэмдэгт байх ёстой (жишээ: ИБ99061111)." };
      }
    ),
    vatNo: z.string().optional().refine(
      (val) => !val || validateMongolianVATNo(val),
      { message: "ХХОАТ-ын дугаар зөв биш. 7 оронтой тоо байх ёстой." }
    ),
    phone: z.string().optional().refine(
      (val) => !val || val.trim() === "" || validateMongolianPhone(val),
      { message: "Утасны дугаар зөв биш. 8 эсвэл 10 оронтой байх ёстой (жишээ: 99112233, 9911223344)" }
    ),
    mobile: z.string().optional().refine(
      (val) => !val || val.trim() === "" || validateMongolianPhone(val),
      { message: "Утасны дугаар зөв биш. 8 эсвэл 10 оронтой байх ёстой (жишээ: 99112233, 9911223344)" }
    ),
    email: z.string().email("Имэйл хаяг зөв биш").optional().or(z.literal("")),
    creditLimit: z.string().optional().refine(
      (val) => !val || val.trim() === "" || (!isNaN(Number(val)) && Number(val) >= 0),
      { message: "Зээлийн хязгаар зөв тоо байх ёстой" }
    ),
    type: z.enum(["customer", "supplier"], {
      errorMap: () => ({ message: "Төрөл зөв сонгоно уу (Худалдан авагч эсвэл Нийлүүлэгч)" }),
    }),
  });
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
export const insertQPaySettingsSchema = createInsertSchema(qpaySettings).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });
export const insertQPayInvoiceSchema = createInsertSchema(qpayInvoices).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });

// ==========================================
// RELATIONS
// ==========================================



export const rolePermissionsRelations = relations(rolePermissions, ({ one }) => ({
  role: one(roles, { fields: [rolePermissions.roleId], references: [roles.id] }),
  permission: one(permissions, { fields: [rolePermissions.permissionId], references: [permissions.id] }),
}));

export const permissionsRelations = relations(permissions, ({ many }) => ({
  roles: many(rolePermissions),
}));

export const userRolesRelations = relations(userRoles, ({ one }) => ({
  user: one(users, { fields: [userRoles.userId], references: [users.id] }),
  role: one(roles, { fields: [userRoles.roleId], references: [roles.id] }),
}));



// E-barimt schemas
export const insertEBarimtSettingsSchema = createInsertSchema(ebarimtSettings).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });

// News Feed schemas
export const insertCompanyPostSchema = createInsertSchema(companyPosts).omit({ id: true, createdAt: true, likesCount: true, commentsCount: true, tenantId: true, authorId: true });
export const insertPostLikeSchema = createInsertSchema(postLikes).omit({ id: true, createdAt: true, tenantId: true });
export const insertPostCommentSchema = createInsertSchema(postComments).omit({ id: true, createdAt: true, tenantId: true });

// Weather Widget schemas
export const insertWeatherAlertSchema = createInsertSchema(weatherAlerts).omit({ id: true, createdAt: true, tenantId: true });
export const insertWeatherSettingsSchema = createInsertSchema(weatherSettings).omit({ id: true, createdAt: true, updatedAt: true, tenantId: true });

export type Tenant = typeof tenants.$inferSelect;
export type InsertTenant = z.infer<typeof insertTenantSchema>;
export type Branch = typeof branches.$inferSelect;
export type InsertBranch = z.infer<typeof insertBranchSchema>;
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Role = typeof roles.$inferSelect;
export type InsertRole = z.infer<typeof insertRoleSchema>;
export type Permission = typeof permissions.$inferSelect;
export type InsertPermission = z.infer<typeof insertPermissionSchema>;
export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>;
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
export type SalaryAdvance = typeof salaryAdvances.$inferSelect;
export type InsertSalaryAdvance = z.infer<typeof insertSalaryAdvanceSchema>;
export type EmployeeAllowance = typeof employeeAllowances.$inferSelect;
export type InsertEmployeeAllowance = z.infer<typeof insertEmployeeAllowanceSchema>;
export type EmployeeAchievement = typeof employeeAchievements.$inferSelect;
export type InsertEmployeeAchievement = typeof employeeAchievements.$inferInsert;
export type EmployeePoints = typeof employeePoints.$inferSelect;
export type InsertEmployeePoints = typeof employeePoints.$inferInsert;
export type PointsHistory = typeof pointsHistory.$inferSelect;
export type InsertPointsHistory = typeof pointsHistory.$inferInsert;
export type CompanyPost = typeof companyPosts.$inferSelect;
export type InsertCompanyPost = z.infer<typeof insertCompanyPostSchema>;
export type PostLike = typeof postLikes.$inferSelect;
export type InsertPostLike = typeof postLikes.$inferInsert;
export type PostComment = typeof postComments.$inferSelect;
export type InsertPostComment = z.infer<typeof insertPostCommentSchema>;
export type WeatherAlert = typeof weatherAlerts.$inferSelect;
export type InsertWeatherAlert = z.infer<typeof insertWeatherAlertSchema>;
export type WeatherSettings = typeof weatherSettings.$inferSelect;
export type InsertWeatherSettings = z.infer<typeof insertWeatherSettingsSchema>;
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
export type DbInsertSalaryAdvance = typeof salaryAdvances.$inferInsert;
export type DbInsertEmployeeAllowance = typeof employeeAllowances.$inferInsert;
export type DbInsertEmployeeAchievement = typeof employeeAchievements.$inferInsert;
export type DbInsertEmployeePoints = typeof employeePoints.$inferInsert;
export type DbInsertPointsHistory = typeof pointsHistory.$inferInsert;
export type DbInsertCompanyPost = typeof companyPosts.$inferInsert;
export type DbInsertPostLike = typeof postLikes.$inferInsert;
export type DbInsertPostComment = typeof postComments.$inferInsert;
export type DbInsertWeatherAlert = typeof weatherAlerts.$inferInsert;
export type DbInsertWeatherSettings = typeof weatherSettings.$inferInsert;
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
export type DbInsertBankStatementLine = typeof bankStatementLines.$inferInsert;
export type DbInsertTaxLine = typeof taxLines.$inferInsert;
export type DbInsertEBarimtSettings = typeof ebarimtSettings.$inferInsert;
export type DbInsertQPaySettings = typeof qpaySettings.$inferInsert;
export type DbInsertQPayInvoice = typeof qpayInvoices.$inferInsert;
export type QPaySettings = typeof qpaySettings.$inferSelect;
export type QPayInvoice = typeof qpayInvoices.$inferSelect;
export type EBarimtSettings = typeof ebarimtSettings.$inferSelect;
export type DbInsertAuditLog = typeof auditLogs.$inferInsert;

// ==========================================
// PERFORMANCE & KPI (Гүйцэтгэлийн Удирдлага)
// ==========================================

export const performancePeriods = pgTable("performance_periods", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), // Жишээ: "2024 - Эхний хагас жил"
  startDate: date("start_date").notNull(),
  endDate: date("end_date").notNull(),
  status: text("status").notNull().default("active"), // 'active' | 'closed' | 'archived'
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  unqPeriod: uniqueIndex("perf_period_tenant_name_idx").on(t.tenantId, t.name),
}));

export const performanceGoals = pgTable("performance_goals", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  periodId: uuid("period_id").references(() => performancePeriods.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),

  title: text("title").notNull(),
  description: text("description"),

  // Scoring & Metrics
  metricType: text("metric_type").notNull().default("percent"), // 'percent' | 'number' | 'currency' | 'boolean'
  targetValue: numeric("target_value", { precision: 14, scale: 2 }).notNull().default("100"),
  currentValue: numeric("current_value", { precision: 14, scale: 2 }).notNull().default("0"),

  weight: integer("weight").notNull().default(0), // 0-100
  progress: integer("progress").notNull().default(0), // 0-100 (Calculated from current/target or manual)

  // Workflow
  status: text("status").notNull().default("draft"), // 'draft' | 'submitted' | 'approved' | 'evaluated' | 'locked'
  dueDate: date("due_date"),

  // Evaluation
  managerId: uuid("manager_id").references(() => users.id, { onDelete: "set null" }), // Assigned evaluator
  managerComment: text("manager_comment"),
  qualityRating: integer("quality_rating"), // 1-5

  evaluatorNotes: text("evaluator_notes"), // Keep for backward compatibility or merge with managerComment
  evaluatedBy: uuid("evaluated_by").references(() => users.id, { onDelete: "set null" }),
  evaluatedAt: timestamp("evaluated_at"),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const kpiEvidence = pgTable("kpi_evidence", {
  id: uuid("id").primaryKey().defaultRandom(),
  goalId: uuid("goal_id").references(() => performanceGoals.id, { onDelete: "cascade" }).notNull(),

  type: text("type").notNull().default("file"), // 'file' | 'link'
  title: text("title").notNull(),
  url: text("url").notNull(),

  uploadedBy: uuid("uploaded_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Performance Relations
export const performancePeriodRelations = relations(performancePeriods, ({ many }) => ({
  goals: many(performanceGoals),
}));

export const performanceGoalRelations = relations(performanceGoals, ({ one, many }) => ({
  period: one(performancePeriods, {
    fields: [performanceGoals.periodId],
    references: [performancePeriods.id],
  }),
  employee: one(employees, {
    fields: [performanceGoals.employeeId],
    references: [employees.id],
  }),
  evaluator: one(users, {
    fields: [performanceGoals.evaluatedBy],
    references: [users.id],
  }),
  manager: one(users, {
    fields: [performanceGoals.managerId],
    references: [users.id],
  }),
  evidence: many(kpiEvidence),
}));

export const kpiEvidenceRelations = relations(kpiEvidence, ({ one }) => ({
  goal: one(performanceGoals, {
    fields: [kpiEvidence.goalId],
    references: [performanceGoals.id],
  }),
  uploader: one(users, {
    fields: [kpiEvidence.uploadedBy],
    references: [users.id],
  }),
}));

// Performance Zod Schemas
export const insertPerformancePeriodSchema = createInsertSchema(performancePeriods).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertPerformanceGoalSchema = createInsertSchema(performanceGoals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertKpiEvidenceSchema = createInsertSchema(kpiEvidence).omit({
  id: true,
  createdAt: true,
});

// Performance Types
export type PerformancePeriod = typeof performancePeriods.$inferSelect;
export type InsertPerformancePeriod = z.infer<typeof insertPerformancePeriodSchema>;
export type PerformanceGoal = typeof performanceGoals.$inferSelect;
export type InsertPerformanceGoal = z.infer<typeof insertPerformanceGoalSchema>;
export type KpiEvidence = typeof kpiEvidence.$inferSelect;
export type InsertKpiEvidence = z.infer<typeof insertKpiEvidenceSchema>;



// ==========================================
// 15. DOCUMENT MANAGEMENT SYSTEM (DMS)
// ==========================================

// 'documents' table is defined in the main section (line ~490)



// Relations
export const documentRelations = relations(documents, ({ one, many }) => ({
  tenant: one(tenants, { fields: [documents.tenantId], references: [tenants.id] }),
  uploadedByUser: one(users, { fields: [documents.uploadedBy], references: [users.id] }),
  currentHolder: one(users, { fields: [documents.currentHolderId], references: [users.id] }),
  createdByUser: one(users, { fields: [documents.createdBy], references: [users.id] }),
  logs: many(documentLogs),
}));

export const documentLogRelations = relations(documentLogs, ({ one }) => ({
  document: one(documents, { fields: [documentLogs.documentId], references: [documents.id] }),
  actor: one(users, { fields: [documentLogs.actorId], references: [users.id] }),
  fromUser: one(users, { fields: [documentLogs.fromUserId], references: [users.id] }),
  toUser: one(users, { fields: [documentLogs.toUserId], references: [users.id] }),
}));

// Zod Schemas
// insertDocumentSchema & insertDocumentLogSchema are defined in the Zod section (line ~1358)

// Types
// DocumentLog types are defined in the Zod section
// ... existing exports ...

// ==========================================
// Safety & HSE (Аюулгүй ажиллагаа)
// ==========================================

export const safetyIncidents = pgTable("safety_incidents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),

  title: text("title").notNull(), // Incident type or brief title
  incidentType: text("incident_type").notNull().default("incident"), // incident, near_miss, hazard, property_damage
  description: text("description"), // Detailed description

  reportedBy: uuid("reported_by").references(() => users.id, { onDelete: "set null" }), // User who reported
  isAnonymous: boolean("is_anonymous").notNull().default(false),

  date: timestamp("date").notNull().defaultNow(), // When it happened
  location: text("location"), // Where it happened

  severity: text("severity").notNull().default("low"), // low, medium, high, urgent
  status: text("status").notNull().default("reported"), // reported, investigating, resolved, closed

  assignedTo: uuid("assigned_to").references(() => users.id, { onDelete: "set null" }), // Supervisor/Manager
  correctiveAction: text("corrective_action"), // Steps taken to fix/prevent
  targetDate: timestamp("target_date"), // Expected resolution date
  resolutionDate: timestamp("resolution_date"), // When it was actually resolved

  imageUrl: text("image_url"), // Optional photo

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const safetyIncidentsRelations = relations(safetyIncidents, ({ one }) => ({
  tenant: one(tenants, { fields: [safetyIncidents.tenantId], references: [tenants.id] }),
  reporter: one(users, { fields: [safetyIncidents.reportedBy], references: [users.id] }),
  assignedUser: one(users, { fields: [safetyIncidents.assignedTo], references: [users.id] }),
}));

export const insertSafetyIncidentSchema = createInsertSchema(safetyIncidents, {
  date: z.coerce.date(),
  targetDate: z.coerce.date().optional(),
  resolutionDate: z.coerce.date().optional(),
  isAnonymous: z.boolean().default(false),
}).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  tenantId: true
});

export type SafetyIncident = typeof safetyIncidents.$inferSelect;
export type InsertSafetyIncident = z.infer<typeof insertSafetyIncidentSchema>;
export type DbInsertSafetyIncident = typeof safetyIncidents.$inferInsert;

// ==========================================
// Internal Communication System (Дотоод харилцаа)
// ==========================================

// --- Announcements (Зарлал) ---
export const announcements = pgTable("announcements", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),

  title: text("title").notNull(),
  content: text("content").notNull(),
  type: text("type").notNull().default("general"), // general, urgent, event, celebration, policy, safety
  priority: text("priority").notNull().default("normal"), // normal, high

  // Visibility targeting
  visibilityType: text("visibility_type").notNull().default("all"), // all, department, role, users
  targetDepartments: jsonb("target_departments"), // Array of department IDs
  targetRoles: jsonb("target_roles"), // Array of role IDs
  targetUsers: jsonb("target_users"), // Array of user IDs

  isPinned: boolean("is_pinned").notNull().default(false),
  expiresAt: timestamp("expires_at"),

  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const announcementsRelations = relations(announcements, ({ one, many }) => ({
  tenant: one(tenants, { fields: [announcements.tenantId], references: [tenants.id] }),
  createdBy: one(users, { fields: [announcements.createdById], references: [users.id] }),
  reads: many(announcementReads),
  comments: many(announcementComments),
  reactions: many(announcementReactions),
}));

export const announcementReads = pgTable("announcement_reads", {
  id: uuid("id").primaryKey().defaultRandom(),
  announcementId: uuid("announcement_id").references(() => announcements.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  unqRead: uniqueIndex("announcement_read_user_idx").on(t.announcementId, t.userId),
}));

export const announcementReadsRelations = relations(announcementReads, ({ one }) => ({
  announcement: one(announcements, { fields: [announcementReads.announcementId], references: [announcements.id] }),
  user: one(users, { fields: [announcementReads.userId], references: [users.id] }),
}));

export const announcementComments = pgTable("announcement_comments", {
  id: uuid("id").primaryKey().defaultRandom(),
  announcementId: uuid("announcement_id").references(() => announcements.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const announcementCommentsRelations = relations(announcementComments, ({ one }) => ({
  announcement: one(announcements, { fields: [announcementComments.announcementId], references: [announcements.id] }),
  user: one(users, { fields: [announcementComments.userId], references: [users.id] }),
}));

export const announcementReactions = pgTable("announcement_reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  announcementId: uuid("announcement_id").references(() => announcements.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  unqReaction: uniqueIndex("announcement_reaction_user_emoji_idx").on(t.announcementId, t.userId, t.emoji),
}));

export const announcementReactionsRelations = relations(announcementReactions, ({ one }) => ({
  announcement: one(announcements, { fields: [announcementReactions.announcementId], references: [announcements.id] }),
  user: one(users, { fields: [announcementReactions.userId], references: [users.id] }),
}));

// Zod Schemas for Announcements
export const insertAnnouncementSchema = createInsertSchema(announcements).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  tenantId: true,
});

export type Announcement = typeof announcements.$inferSelect;
export type InsertAnnouncement = z.infer<typeof insertAnnouncementSchema>;
export type DbInsertAnnouncement = typeof announcements.$inferInsert;

export type AnnouncementRead = typeof announcementReads.$inferSelect;
export type AnnouncementComment = typeof announcementComments.$inferSelect;
export type AnnouncementReaction = typeof announcementReactions.$inferSelect;

// --- Chat System (Чат систем) ---
export const chatChannels = pgTable("chat_channels", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),

  type: text("type").notNull(), // direct, group
  name: text("name"), // Group chat name (null for direct)

  // Unique key for direct chats: "minUserId_maxUserId" to prevent duplicates
  uniqueKey: text("unique_key"),

  lastMessageAt: timestamp("last_message_at"),
  lastMessagePreview: text("last_message_preview"),

  createdById: uuid("created_by_id").references(() => users.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  unqDirectKey: uniqueIndex("chat_channel_unique_key_idx").on(t.tenantId, t.uniqueKey),
}));

export const chatChannelsRelations = relations(chatChannels, ({ one, many }) => ({
  tenant: one(tenants, { fields: [chatChannels.tenantId], references: [tenants.id] }),
  createdBy: one(users, { fields: [chatChannels.createdById], references: [users.id] }),
  members: many(chatChannelMembers),
  messages: many(chatMessages),
}));

export const chatChannelMembers = pgTable("chat_channel_members", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id").references(() => chatChannels.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  isAdmin: boolean("is_admin").notNull().default(false),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),

  // For unread count calculation
  lastReadAt: timestamp("last_read_at"),
}, (t) => ({
  unqMember: uniqueIndex("chat_channel_member_user_idx").on(t.channelId, t.userId),
}));

export const chatChannelMembersRelations = relations(chatChannelMembers, ({ one }) => ({
  channel: one(chatChannels, { fields: [chatChannelMembers.channelId], references: [chatChannels.id] }),
  user: one(users, { fields: [chatChannelMembers.userId], references: [users.id] }),
}));

export const chatMessages = pgTable("chat_messages", {
  id: uuid("id").primaryKey().defaultRandom(),
  channelId: uuid("channel_id").references(() => chatChannels.id, { onDelete: "cascade" }).notNull(),
  senderId: uuid("sender_id").references(() => users.id, { onDelete: "set null" }),

  content: text("content").notNull(),
  type: text("type").notNull().default("text"), // text, file, system

  fileUrl: text("file_url"), // Optional file attachment
  replyToId: uuid("reply_to_id"), // Reply to another message

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  isEdited: boolean("is_edited").notNull().default(false),
  isDeleted: boolean("is_deleted").notNull().default(false),
});

export const chatMessagesRelations = relations(chatMessages, ({ one, many }) => ({
  channel: one(chatChannels, { fields: [chatMessages.channelId], references: [chatChannels.id] }),
  sender: one(users, { fields: [chatMessages.senderId], references: [users.id] }),
  replyTo: one(chatMessages, { fields: [chatMessages.replyToId], references: [chatMessages.id] }),
  reactions: many(chatMessageReactions),
}));

export const chatMessageReactions = pgTable("chat_message_reactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  messageId: uuid("message_id").references(() => chatMessages.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  unqMessageReaction: uniqueIndex("chat_message_reaction_user_emoji_idx").on(t.messageId, t.userId, t.emoji),
}));

export const chatMessageReactionsRelations = relations(chatMessageReactions, ({ one }) => ({
  message: one(chatMessages, { fields: [chatMessageReactions.messageId], references: [chatMessages.id] }),
  user: one(users, { fields: [chatMessageReactions.userId], references: [users.id] }),
}));

// Zod Schemas for Chat
export const insertChatChannelSchema = createInsertSchema(chatChannels).omit({
  id: true,
  createdAt: true,
  tenantId: true,
  lastMessageAt: true,
  lastMessagePreview: true,
});

export const insertChatMessageSchema = createInsertSchema(chatMessages).omit({
  id: true,
  createdAt: true,
  isEdited: true,
  isDeleted: true,
});

export type ChatChannel = typeof chatChannels.$inferSelect;
export type InsertChatChannel = z.infer<typeof insertChatChannelSchema>;
export type DbInsertChatChannel = typeof chatChannels.$inferInsert;

export type ChatChannelMember = typeof chatChannelMembers.$inferSelect;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = z.infer<typeof insertChatMessageSchema>;
export type DbInsertChatMessage = typeof chatMessages.$inferInsert;

export type ChatMessageReaction = typeof chatMessageReactions.$inferSelect;


export const insertCompanySettingsSchema = createInsertSchema(companySettings);
export type CompanySettings = typeof companySettings.$inferSelect;
export type InsertCompanySettings = z.infer<typeof insertCompanySettingsSchema>;
export type DbInsertCompanySettings = typeof companySettings.$inferInsert;

// JobTitle definitions moved to line 1388

// ==========================================
// 14. ROSTER MANAGEMENT (Phase 1)
// ==========================================

export const shifts = pgTable("shifts", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  startMinutes: integer("start_minutes").notNull(), // 0-1439
  endMinutes: integer("end_minutes").notNull(), // 0-1439
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  unqName: uniqueIndex("shift_tenant_name_idx").on(t.tenantId, t.name),
  chkStart: check("shift_start_chk", sql`${t.startMinutes} >= 0 AND ${t.startMinutes} < 1440`),
  chkEnd: check("shift_end_chk", sql`${t.endMinutes} >= 0 AND ${t.endMinutes} < 1440`),
}));

export const rosters = pgTable("rosters", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  cycleDays: integer("cycle_days").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  unqName: uniqueIndex("roster_tenant_name_idx").on(t.tenantId, t.name),
  chkCycle: check("roster_cycle_chk", sql`${t.cycleDays} > 0 AND ${t.cycleDays} <= 366`),
}));

export const rosterDays = pgTable("roster_days", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  rosterId: uuid("roster_id").references(() => rosters.id, { onDelete: "cascade" }).notNull(),
  dayIndex: integer("day_index").notNull(), // 0-indexed
  shiftId: uuid("shift_id").references(() => shifts.id, { onDelete: "cascade" }),
  isOff: boolean("is_off").default(false).notNull(),
}, (t) => ({
  unqDay: uniqueIndex("roster_day_idx").on(t.tenantId, t.rosterId, t.dayIndex),
  chkOffShift: check("roster_days_chk", sql`(${t.isOff} = true AND ${t.shiftId} IS NULL) OR (${t.isOff} = false AND ${t.shiftId} IS NOT NULL)`),
}));

export const rosterAssignments = pgTable("roster_assignments", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  rosterId: uuid("roster_id").references(() => rosters.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  status: text("status").default("active").notNull(), // active/ended
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxEmp: index("roster_assign_emp_idx").on(t.tenantId, t.employeeId),
  idxRoster: index("roster_assign_roster_idx").on(t.tenantId, t.rosterId),
}));

export const insertShiftSchema = createInsertSchema(shifts);
export type Shift = typeof shifts.$inferSelect;
export type InsertShift = z.infer<typeof insertShiftSchema>;

export const insertRosterSchema = createInsertSchema(rosters);
export type Roster = typeof rosters.$inferSelect;
export type InsertRoster = z.infer<typeof insertRosterSchema>;

export const insertRosterDaySchema = createInsertSchema(rosterDays);
export type RosterDay = typeof rosterDays.$inferSelect;
export type InsertRosterDay = z.infer<typeof insertRosterDaySchema>;

export const insertRosterAssignmentSchema = createInsertSchema(rosterAssignments);
export type RosterAssignment = typeof rosterAssignments.$inferSelect;
export type InsertRosterAssignment = z.infer<typeof insertRosterAssignmentSchema>;

// ==========================================
// TRANSPORTATION
// ==========================================

export const vehicles = pgTable("vehicles", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),              // e.g., "Bus-1"
  plateNo: text("plate_no").notNull(),       // e.g., "1234УБА"
  type: text("type").default("bus").notNull(), // bus/van/etc
  capacity: integer("capacity").notNull(),   // seat count
  layoutJson: jsonb("layout_json"),          // seat map config (rows/cols/seat numbers)
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (t) => ({
  unqPlate: uniqueIndex("vehicle_tenant_plate_idx").on(t.tenantId, t.plateNo),
  idxTenant: index("vehicle_tenant_idx").on(t.tenantId),
  chkCap: check("vehicle_capacity_chk", sql`${t.capacity} > 0 AND ${t.capacity} <= 200`),
}));

export const routes = pgTable("routes", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  code: text("code").notNull(),              // e.g., "UB-CAMP"
  name: text("name").notNull(),              // e.g., "Ulaanbaatar → Camp"
  fromLabel: text("from_label").notNull(),   // "Ulaanbaatar"
  toLabel: text("to_label").notNull(),       // "Camp"
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (t) => ({
  unqCode: uniqueIndex("route_tenant_code_idx").on(t.tenantId, t.code),
  idxTenant: index("route_tenant_idx").on(t.tenantId),
}));

export const trips = pgTable("trips", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  routeId: uuid("route_id").references(() => routes.id, { onDelete: "cascade" }).notNull(),
  vehicleId: uuid("vehicle_id").references(() => vehicles.id, { onDelete: "cascade" }).notNull(),
  departureTime: timestamp("departure_time").notNull(), // timezone strategy: store UTC or local, be consistent
  status: text("status").default("scheduled").notNull(), // scheduled/cancelled/closed/completed
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
  deletedAt: timestamp("deleted_at"),
}, (t) => ({
  unqTrip: uniqueIndex("trip_unique_idx").on(t.tenantId, t.routeId, t.vehicleId, t.departureTime),
  idxTime: index("trip_time_idx").on(t.tenantId, t.departureTime),
  idxRoute: index("trip_route_idx").on(t.tenantId, t.routeId),
  idxVehicle: index("trip_vehicle_idx").on(t.tenantId, t.vehicleId),
}));

export const seatReservations = pgTable("seat_reservations", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  tripId: uuid("trip_id").references(() => trips.id, { onDelete: "cascade" }).notNull(),
  seatNumber: text("seat_number").notNull(),     // "1A", "2B" гэх мэт (layout-аас)
  passengerId: uuid("passenger_id").references(() => employees.id, { onDelete: "cascade" }).notNull(), // employeeId
  status: text("status").default("confirmed").notNull(), // confirmed/cancelled
  createdAt: timestamp("created_at").defaultNow().notNull(),
  cancelledAt: timestamp("cancelled_at"),
}, (t) => ({
  unqSeat: uniqueIndex("seat_trip_seat_idx").on(t.tripId, t.seatNumber).where(sql`status = 'confirmed'`),
  unqPassenger: uniqueIndex("seat_trip_passenger_idx").on(t.tripId, t.passengerId).where(sql`status = 'confirmed'`),
  idxTrip: index("seat_trip_idx").on(t.tenantId, t.tripId),
}));

export const insertVehicleSchema = createInsertSchema(vehicles);
export type Vehicle = typeof vehicles.$inferSelect;
export type InsertVehicle = z.infer<typeof insertVehicleSchema>;

export const insertRouteSchema = createInsertSchema(routes);
export type Route = typeof routes.$inferSelect;
export type InsertRoute = z.infer<typeof insertRouteSchema>;

export const insertTripSchema = createInsertSchema(trips);
export type Trip = typeof trips.$inferSelect;
export type InsertTrip = z.infer<typeof insertTripSchema>;

export const insertSeatReservationSchema = createInsertSchema(seatReservations);
export type SeatReservation = typeof seatReservations.$inferSelect;
export type InsertSeatReservation = z.infer<typeof insertSeatReservationSchema>;

// --- CANTEEN MODULE ---

export const canteenWallets = pgTable("canteen_wallets", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  balance: integer("balance").default(0).notNull(), // Stored in MNT (integers)
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  unqWallet: uniqueIndex("wallet_employee_idx").on(t.tenantId, t.employeeId),
}));

export const walletTransactions = pgTable("wallet_transactions", {
  id: uuid("id").primaryKey().defaultRandom(),
  walletId: uuid("wallet_id").references(() => canteenWallets.id, { onDelete: "cascade" }).notNull(),
  amount: integer("amount").notNull(), // Positive for credit, negative for debit
  type: text("type").notNull(), // 'credit', 'debit', 'correction'
  referenceType: text("reference_type").notNull(), // 'manual_topup', 'meal_serving', 'refund'
  referenceId: text("reference_id"), // ID of related entity (serving ID etc)
  description: text("description"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  createdBy: uuid("created_by").notNull(), // User who performed the action
});

export const canteenMenu = pgTable("canteen_menu", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(),
  mealType: text("meal_type").notNull(), // 'lunch', 'dinner', 'breakfast'
  items: jsonb("items").notNull(), // Array of strings or objects { name: "Soup", type: "main" }
  price: integer("price").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  unqMenu: uniqueIndex("menu_date_type_idx").on(t.tenantId, t.date, t.mealType),
}));

export const mealServings = pgTable("meal_servings", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(), // Serving date
  mealType: text("meal_type").notNull(), // 'lunch', 'dinner'
  price: integer("price").notNull(), // Actual price charged
  status: text("status").default("served").notNull(), // 'served', 'voided'
  servedAt: timestamp("served_at").defaultNow().notNull(),
  // Void fields
  voidedAt: timestamp("voided_at"),
  voidedReason: text("voided_reason"),
  voidedBy: uuid("voided_by").references(() => users.id, { onDelete: "set null" }),
}, (t) => ({
  unqServing: uniqueIndex("serving_employee_date_type_idx").on(t.tenantId, t.employeeId, t.date, t.mealType), // One meal per type per day
}));

export const insertCanteenWalletSchema = createInsertSchema(canteenWallets);
export type CanteenWallet = typeof canteenWallets.$inferSelect;
export type InsertCanteenWallet = z.infer<typeof insertCanteenWalletSchema>;

export const insertWalletTransactionSchema = createInsertSchema(walletTransactions);
export type WalletTransaction = typeof walletTransactions.$inferSelect;
export type InsertWalletTransaction = z.infer<typeof insertWalletTransactionSchema>;

export const insertCanteenMenuSchema = createInsertSchema(canteenMenu);
export type CanteenMenu = typeof canteenMenu.$inferSelect;
export type InsertCanteenMenu = z.infer<typeof insertCanteenMenuSchema>;



export const insertMealServingSchema = createInsertSchema(mealServings);
export type MealServing = typeof mealServings.$inferSelect;
export type InsertMealServing = z.infer<typeof insertMealServingSchema>;

export const mealOrders = pgTable("meal_orders", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  date: date("date").notNull(), // text YYYY-MM-DD
  mealType: text("meal_type").notNull(), // 'lunch', 'dinner'

  status: text("status").default("pending").notNull(), // 'pending', 'fulfilled', 'cancelled'

  createdAt: timestamp("created_at").defaultNow().notNull(),
  cancelledAt: timestamp("cancelled_at"),
  fulfilledAt: timestamp("fulfilled_at"),

  fulfilledBy: uuid("fulfilled_by").references(() => users.id, { onDelete: "set null" }),
  servingId: uuid("serving_id").references(() => mealServings.id, { onDelete: "set null" }),
}, (t) => ({
  unqOrder: uniqueIndex("order_employee_date_type_idx").on(t.tenantId, t.employeeId, t.date, t.mealType), // One active intent per type per day (actually just one record per day/type regardless of status to keep history clean? Or unique on pending? Spec says unique on (tenant, emp, date, type) implies one attempt per meal. Re-ordering after cancel would require updating this row.)
  idxLookup: index("order_lookup_idx").on(t.tenantId, t.date, t.mealType, t.status),
  idxMyOrders: index("order_my_idx").on(t.tenantId, t.employeeId, t.date),
}));

export const insertMealOrderSchema = createInsertSchema(mealOrders);
export type MealOrder = typeof mealOrders.$inferSelect;
export type InsertMealOrder = z.infer<typeof insertMealOrderSchema>;



// ==========================================
// 19. ASSET MANAGEMENT (Uniforms & Equipment)
// ==========================================

export const assetIssuances = pgTable("asset_issuances", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  productId: uuid("product_id").references(() => products.id, { onDelete: "restrict" }).notNull(), // Link to inventory product

  quantity: integer("quantity").notNull().default(1),
  serialNumber: text("serial_number"), // Optional, specific serial

  status: text("status").notNull().default("issued"), // issued, returned, lost, damaged

  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  issuedBy: uuid("issued_by").references(() => users.id, { onDelete: "set null" }),

  returnedAt: timestamp("returned_at"),
  returnedBy: uuid("returned_by").references(() => users.id, { onDelete: "set null" }),

  note: text("note"),
}, (t) => ({
  // Ensure unique serial number per tenant if present (and status is 'issued'?)
  // Actually usually serials are unique to the ITEM globally or tenant-wide regardless of status if it's the same item.
  // But if the same serial item is returned and re-issued? 
  // We should track CURRENTLY ISSUED serials?
  // Or just say serial number identifies the asset instance strictly.
  // Let's make (tenantId, serialNumber) unique index WHERE status = 'issued' to prevent double issuing?
  // For simplicity MVP: just index it.
  idxAssetSerial: index("asset_serial_idx").on(t.tenantId, t.serialNumber),
}));


export const insertAssetIssuanceSchema = createInsertSchema(assetIssuances);
export type AssetIssuance = typeof assetIssuances.$inferSelect;
export type InsertAssetIssuance = z.infer<typeof insertAssetIssuanceSchema>;


// ==========================================
// 20. REQUESTS & WORKFLOWS (Phase 5)
// ==========================================

// Core Requests Table
export const requests = pgTable("requests", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),

  // type: 'leave' | 'official_letter' | 'asset_request' | ...
  type: text("type").notNull(),

  // status: 'draft' | 'submitted' | 'approved' | 'rejected' | 'cancelled'
  status: text("status").notNull().default('draft'),

  createdBy: uuid("created_by").references(() => users.id, { onDelete: "cascade" }).notNull(), // User ID
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(), // Owner Employee ID

  title: text("title"), // Optional summary
  payload: jsonb("payload_json").notNull(), // Dynamic fields based on type

  clientRequestId: text("client_request_id"), // Idempotency key
  currentStep: integer("current_step").default(0), // Approval step pointer

  // Phase 5.2 columns
  officialLetterNo: text("official_letter_no"),
  officialLetterTemplateVersion: integer("official_letter_template_version"),
  finalizedAt: timestamp("finalized_at"), // When approved/letter number assigne

  submittedAt: timestamp("submitted_at"),
  decidedAt: timestamp("decided_at"),
  deletedAt: timestamp("deleted_at"), // Soft delete

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxRequestTenantStatus: index("request_tenant_status_idx").on(t.tenantId, t.type, t.status),
  idxRequestOwner: index("request_owner_idx").on(t.tenantId, t.employeeId, t.createdAt),
  unqClientReq: uniqueIndex("request_client_id_idx").on(t.tenantId, t.createdBy, t.clientRequestId),
}));

// Request Approvals State
export const requestApprovals = pgTable("request_approvals", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  requestId: uuid("request_id").references(() => requests.id, { onDelete: "cascade" }).notNull(),

  step: integer("step").notNull(), // 1, 2, 3...
  approverId: uuid("approver_id").references(() => users.id, { onDelete: "cascade" }).notNull(), // User ID of assignee

  // decision: 'approved' | 'rejected' | null (pending)
  decision: text("decision"),
  comment: text("comment"),

  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  unqRequestStep: uniqueIndex("request_step_idx").on(t.requestId, t.step),
  idxApproverPending: index("approver_pending_idx").on(t.tenantId, t.approverId, t.decision), // For inbox
}));

// Request Audit Timeline
export const requestEvents = pgTable("request_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  requestId: uuid("request_id").references(() => requests.id, { onDelete: "cascade" }).notNull(),

  actorId: uuid("actor_id").references(() => users.id, { onDelete: "set null" }).notNull(),

  // event: 'created' | 'submitted' | 'approved' | 'rejected' | 'cancelled' | 'comment_added' | 'pdf_generated'
  event: text("event").notNull(),

  meta: jsonb("meta_json"), // Snapshot of changes or comments

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  idxRequestTimeline: index("request_timeline_idx").on(t.tenantId, t.requestId, t.createdAt),
}));

export const insertRequestSchema = createInsertSchema(requests);
export type Request = typeof requests.$inferSelect;
export type InsertRequest = z.infer<typeof insertRequestSchema>;
export type DbInsertRequest = typeof requests.$inferInsert;

export const insertRequestEventSchema = createInsertSchema(requestEvents);
export type RequestEvent = typeof requestEvents.$inferSelect;
export type InsertRequestEvent = z.infer<typeof insertRequestEventSchema>;


// ==========================================
// 21. OFFICIAL DOCS & SEQUENCES (Phase 5.2)
// ==========================================

export const sequences = pgTable("sequences", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  key: text("key").notNull(), // 'official_letter_2026'
  currentVal: integer("current_val").notNull().default(0),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (t) => ({
  unqSequence: uniqueIndex("sequence_key_idx").on(t.tenantId, t.key),
}));

export const documentTemplates = pgTable("document_templates", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  key: text("key").notNull(), // 'official_letter'
  version: integer("version").notNull(),
  htmlTemplate: text("html_template").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  unqTemplateVersion: uniqueIndex("template_version_idx").on(t.tenantId, t.key, t.version),
  // Ideally we enforce only one active via logic
}));

export const requestDocuments = pgTable("request_documents", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  requestId: uuid("request_id").references(() => requests.id, { onDelete: "cascade" }).notNull(),

  docType: text("doc_type").notNull(), // 'official_letter_pdf'
  templateVersion: integer("template_version"),

  filePath: text("file_path"), // Key in storage

  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  unqRequestDoc: uniqueIndex("request_doc_idx").on(t.tenantId, t.requestId, t.docType),
}));

// Note: We need to alter 'requests' table to add columns.
// Since Drizzle just defines schema here, I will add columns to 'requests' definition above.
// But 'requests' is already defined on line 2503 approx.
// I must go UP and edit it.

// ==========================================
// PHASE 6: SECURITY & DIGITAL ID
// ==========================================

// User Sessions - Track active login sessions per user
export const userSessions = pgTable("user_sessions", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),

  sessionTokenHash: text("session_token_hash").notNull(), // SHA256 of session ID
  deviceName: text("device_name"), // "Chrome Windows", "iPhone" etc
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),

  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }).defaultNow().notNull(),

  revokedAt: timestamp("revoked_at"),
  revokedBy: uuid("revoked_by").references(() => users.id, { onDelete: "set null" }),
  revokeReason: text("revoke_reason"),
}, (t) => ({
  unqToken: uniqueIndex("user_session_token_hash_idx").on(t.sessionTokenHash),
  idxUser: index("user_session_user_idx").on(t.tenantId, t.userId, t.revokedAt),
  idxSeen: index("user_session_seen_idx").on(t.tenantId, t.lastSeenAt),
}));

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({ id: true, createdAt: true, lastSeenAt: true });
export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;

// ==========================================
// NOTIFICATIONS (Read State)
// ==========================================

export const notificationReads = pgTable("notification_reads", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  notificationId: text("notification_id").notNull(),
  readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => ({
  unqRead: uniqueIndex("notification_read_user_notif_idx").on(t.userId, t.notificationId),
}));

export const notificationSettings = pgTable("notification_settings", {
  userId: uuid("user_id").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  lastReadAllAt: timestamp("last_read_all_at", { withTimezone: true }).notNull().default(sql`'1970-01-01'::timestamp`),
});

export const insertNotificationReadSchema = createInsertSchema(notificationReads).omit({ id: true });
export type NotificationRead = typeof notificationReads.$inferSelect;

export const insertNotificationSettingSchema = createInsertSchema(notificationSettings);
export type NotificationSetting = typeof notificationSettings.$inferSelect;
