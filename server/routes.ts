import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { api } from "@shared/routes";
import { z } from "zod";
import { insertUserSchema, insertCompanySchema, insertDepartmentSchema, insertEmployeeSchema, companies, departments, employees, attendance, payroll, documents, documentCategories } from "@shared/schema";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";
import { db } from "./db";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  setupAuth(app);

  // Employees
  app.get(api.employees.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const employees = await storage.getEmployees();
    res.json(employees);
  });

  app.get(api.employees.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const employee = await storage.getEmployee(Number(req.params.id));
    if (!employee) return res.status(404).json({ message: "Employee not found" });
    res.json(employee);
  });

  app.post(api.employees.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const input = api.employees.create.input.parse(req.body);
      const employee = await storage.createEmployee(input);
      res.status(201).json(employee);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: err.errors[0].message });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.put(api.employees.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    try {
      const input = api.employees.update.input.parse(req.body);
      const employee = await storage.updateEmployee(Number(req.params.id), input);
      res.json(employee);
    } catch (err) {
      res.status(500).json({ message: "Error updating employee" });
    }
  });

  // Departments
  app.get(api.departments.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const depts = await storage.getDepartments();
    res.json(depts);
  });

  app.post(api.departments.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const input = api.departments.create.input.parse(req.body);
    const dept = await storage.createDepartment(input);
    res.status(201).json(dept);
  });

  // Attendance
  app.get(api.attendance.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const att = await storage.getAttendance();
    res.json(att);
  });

  app.post(api.attendance.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const input = api.attendance.create.input.parse(req.body);
    const att = await storage.createAttendance(input);
    res.status(201).json(att);
  });

  // Payroll
  app.get(api.payroll.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const pay = await storage.getPayroll();
    res.json(pay);
  });

  app.post(api.payroll.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const input = api.payroll.create.input.parse(req.body);
    const pay = await storage.createPayroll(input);
    res.status(201).json(pay);
  });

  // Documents
  app.get(api.documents.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const docs = await storage.getDocuments();
    res.json(docs);
  });

  app.post(api.documents.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const input = api.documents.create.input.parse(req.body);
    const doc = await storage.createDocument(input);
    res.status(201).json(doc);
  });

  // Stats
  app.get(api.stats.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const stats = await storage.getStats();
    res.json(stats);
  });

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const existingUsers = await storage.getUserByUsername("admin");
  if (!existingUsers) {
    console.log("Seeding database...");
    
    // Create Admin User
    const hashedPassword = await hashPassword("admin123");
    const adminUser = await storage.createUser({
      email: "admin",
      password: hashedPassword,
      role: "Admin",
      isActive: true,
    });

    // Create Company
    const [company] = await db.insert(companies).values({
      name: "Tech Corp",
      code: "TC001",
      address: "123 Tech St",
      email: "info@techcorp.com",
      isActive: true
    }).returning();

    // Create Departments
    const [itDept] = await db.insert(departments).values({
      companyId: company.id,
      name: "IT Department",
      code: "IT",
      description: "Technology and Engineering",
      isActive: true
    }).returning();

    const [hrDept] = await db.insert(departments).values({
      companyId: company.id,
      name: "HR Department",
      code: "HR",
      description: "Human Resources",
      isActive: true
    }).returning();

    // Create Employees
    const [emp1] = await db.insert(employees).values({
      companyId: company.id,
      userId: adminUser.id,
      departmentId: itDept.id,
      employeeCode: "EMP001",
      firstName: "Admin",
      lastName: "User",
      position: "System Admin",
      baseSalary: 5000,
      personalEmail: "admin@techcorp.com",
      isActive: true
    }).returning();
    
    // Create another employee
    await db.insert(employees).values({
      companyId: company.id,
      departmentId: hrDept.id,
      employeeCode: "EMP002",
      firstName: "Jane",
      lastName: "Doe",
      position: "HR Manager",
      baseSalary: 4000,
      personalEmail: "jane@example.com",
      isActive: true
    });

    console.log("Database seeded!");
  }
}
