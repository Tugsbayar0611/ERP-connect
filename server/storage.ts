import { 
  users, companies, departments, employees, attendance, payroll, leaveRequests, documentCategories, documents,
  type User, type InsertUser, type Company, type InsertCompany, type Department, type InsertDepartment,
  type Employee, type InsertEmployee, type Attendance, type InsertAttendance, type Payroll, type InsertPayroll,
  type Document, type InsertDocument
} from "@shared/schema";
import { db } from "./db";
import { eq } from "drizzle-orm";

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  getEmployees(): Promise<Employee[]>;
  getEmployee(id: number): Promise<Employee | undefined>;
  createEmployee(employee: InsertEmployee): Promise<Employee>;
  updateEmployee(id: number, employee: Partial<InsertEmployee>): Promise<Employee>;

  getDepartments(): Promise<Department[]>;
  createDepartment(dept: InsertDepartment): Promise<Department>;

  getAttendance(): Promise<Attendance[]>;
  createAttendance(att: InsertAttendance): Promise<Attendance>;

  getPayroll(): Promise<Payroll[]>;
  createPayroll(pay: InsertPayroll): Promise<Payroll>;

  getDocuments(): Promise<Document[]>;
  createDocument(doc: InsertDocument): Promise<Document>;

  getStats(): Promise<any>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async getEmployees(): Promise<Employee[]> {
    return await db.select().from(employees);
  }

  async getEmployee(id: number): Promise<Employee | undefined> {
    const [employee] = await db.select().from(employees).where(eq(employees.id, id));
    return employee;
  }

  async createEmployee(insertEmployee: InsertEmployee): Promise<Employee> {
    const [employee] = await db.insert(employees).values(insertEmployee).returning();
    return employee;
  }

  async updateEmployee(id: number, update: Partial<InsertEmployee>): Promise<Employee> {
    const [employee] = await db.update(employees).set(update).where(eq(employees.id, id)).returning();
    return employee;
  }

  async getDepartments(): Promise<Department[]> {
    return await db.select().from(departments);
  }

  async createDepartment(dept: InsertDepartment): Promise<Department> {
    const [d] = await db.insert(departments).values(dept).returning();
    return d;
  }

  async getAttendance(): Promise<Attendance[]> {
    return await db.select().from(attendance);
  }

  async createAttendance(att: InsertAttendance): Promise<Attendance> {
    const [a] = await db.insert(attendance).values(att).returning();
    return a;
  }

  async getPayroll(): Promise<Payroll[]> {
    return await db.select().from(payroll);
  }

  async createPayroll(pay: InsertPayroll): Promise<Payroll> {
    const [p] = await db.insert(payroll).values(pay).returning();
    return p;
  }

  async getDocuments(): Promise<Document[]> {
    return await db.select().from(documents);
  }

  async createDocument(doc: InsertDocument): Promise<Document> {
    const [d] = await db.insert(documents).values(doc).returning();
    return d;
  }

  async getStats(): Promise<any> {
    const [empCount] = await db.select({ count: employees.id }).from(employees);
    const [deptCount] = await db.select({ count: departments.id }).from(departments);
    // Simple mock stats for now
    return {
      totalEmployees: 10, // Mocked for seed
      activeEmployees: 9,
      totalDepartments: 4,
      monthlyPayroll: 50000
    };
  }
}

export const storage = new DatabaseStorage();
