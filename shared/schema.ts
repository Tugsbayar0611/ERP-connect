import { pgTable, text, serial, integer, boolean, timestamp, real, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  role: text("role").default("Employee").notNull(), // Admin, Manager, HR, Employee
  isActive: boolean("is_active").default(true),
  lastLogin: timestamp("last_login"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Companies
export const companies = pgTable("companies", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  code: text("code").notNull().unique(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Departments
export const departments = pgTable("departments", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id),
  name: text("name").notNull(),
  code: text("code"),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Employees
export const employees = pgTable("employees", {
  id: serial("id").primaryKey(),
  companyId: integer("company_id").references(() => companies.id),
  userId: integer("user_id").references(() => users.id),
  departmentId: integer("department_id").references(() => departments.id),
  employeeCode: text("employee_code").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  personalEmail: text("personal_email"),
  position: text("position"),
  hireDate: timestamp("hire_date"),
  birthDate: timestamp("birth_date"),
  gender: text("gender"),
  baseSalary: real("base_salary").default(0),
  hourlyRate: real("hourly_rate").default(0),
  bankName: text("bank_name"),
  bankAccount: text("bank_account"),
  address: text("address"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Attendance
export const attendance = pgTable("attendance", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  date: timestamp("date").notNull(),
  checkIn: timestamp("check_in"),
  checkOut: timestamp("check_out"),
  workHours: real("work_hours").default(0),
  overtimeHours: real("overtime_hours").default(0),
  status: text("status").default("Present"), // Present, Absent, Late
  location: text("location"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payroll
export const payroll = pgTable("payroll", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  baseSalary: real("base_salary").default(0),
  overtimePay: real("overtime_pay").default(0),
  bonus: real("bonus").default(0),
  allowances: real("allowances").default(0),
  tax: real("tax").default(0),
  socialInsurance: real("social_insurance").default(0),
  healthInsurance: real("health_insurance").default(0),
  grossSalary: real("gross_salary").default(0),
  netSalary: real("net_salary").default(0),
  paymentDate: timestamp("payment_date"),
  paymentMethod: text("payment_method"),
  status: text("status").default("Pending"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Leave Requests
export const leaveRequests = pgTable("leave_requests", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").references(() => employees.id).notNull(),
  leaveType: text("leave_type").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  days: integer("days").notNull(),
  reason: text("reason"),
  status: text("status").default("Pending"),
  approvedBy: integer("approved_by").references(() => users.id),
  approvedAt: timestamp("approved_at"),
  rejectionReason: text("rejection_reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Document Categories
export const documentCategories = pgTable("document_categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").unique(),
  description: text("description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Documents
export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => documentCategories.id),
  title: text("title").notNull(),
  filePath: text("file_path").notNull(),
  fileType: text("file_type"),
  fileSize: integer("file_size"),
  description: text("description"),
  uploadedBy: integer("uploaded_by").references(() => users.id),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const employeesRelations = relations(employees, ({ one, many }) => ({
  user: one(users, {
    fields: [employees.userId],
    references: [users.id],
  }),
  company: one(companies, {
    fields: [employees.companyId],
    references: [companies.id],
  }),
  department: one(departments, {
    fields: [employees.departmentId],
    references: [departments.id],
  }),
  attendance: many(attendance),
  payroll: many(payroll),
  leaveRequests: many(leaveRequests),
}));

export const usersRelations = relations(users, ({ one }) => ({
  employee: one(employees),
}));

export const departmentsRelations = relations(departments, ({ one, many }) => ({
  company: one(companies, {
    fields: [departments.companyId],
    references: [companies.id],
  }),
  employees: many(employees),
}));

// Schemas
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, lastLogin: true });
export const insertCompanySchema = createInsertSchema(companies).omit({ id: true, createdAt: true });
export const insertDepartmentSchema = createInsertSchema(departments).omit({ id: true, createdAt: true });
export const insertEmployeeSchema = createInsertSchema(employees).omit({ id: true, createdAt: true });
export const insertAttendanceSchema = createInsertSchema(attendance).omit({ id: true, createdAt: true });
export const insertPayrollSchema = createInsertSchema(payroll).omit({ id: true, createdAt: true });
export const insertLeaveRequestSchema = createInsertSchema(leaveRequests).omit({ id: true, createdAt: true, approvedAt: true });
export const insertDocumentCategorySchema = createInsertSchema(documentCategories).omit({ id: true, createdAt: true });
export const insertDocumentSchema = createInsertSchema(documents).omit({ id: true, createdAt: true });

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Company = typeof companies.$inferSelect;
export type InsertCompany = z.infer<typeof insertCompanySchema>;
export type Department = typeof departments.$inferSelect;
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Employee = typeof employees.$inferSelect;
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Attendance = typeof attendance.$inferSelect;
export type InsertAttendance = z.infer<typeof insertAttendanceSchema>;
export type Payroll = typeof payroll.$inferSelect;
export type InsertPayroll = z.infer<typeof insertPayrollSchema>;
export type LeaveRequest = typeof leaveRequests.$inferSelect;
export type InsertLeaveRequest = z.infer<typeof insertLeaveRequestSchema>;
export type DocumentCategory = typeof documentCategories.$inferSelect;
export type InsertDocumentCategory = z.infer<typeof insertDocumentCategorySchema>;
export type Document = typeof documents.$inferSelect;
export type InsertDocument = z.infer<typeof insertDocumentSchema>;
