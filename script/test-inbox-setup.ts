
import "dotenv/config";
import { db } from "../server/db";
import { users, employees, departments, tenants, performanceGoals, auditLogs } from "../shared/schema";
import { eq } from "drizzle-orm";
import { storage } from "../server/storage";
import { HRStorage } from "../server/storage/hr";

async function main() {
    console.log("🚀 Starting Inbox Verification...");

    // 1. Get Tenant
    const tenant = await db.query.tenants.findFirst();
    if (!tenant) throw new Error("No tenant found");
    const tenantId = tenant.id;
    console.log("Tenant:", tenantId);

    // 2. Create Users
    console.log("Creating Users...");
    const ts = Date.now();
    const [managerUser] = await db.insert(users).values({
        tenantId,
        email: `manager_${ts}@test.com`,
        username: `manager_${ts}`,
        passwordHash: "hash",
        fullName: "Manager Test",
        role: "manager"
    }).returning();

    const [staffUser] = await db.insert(users).values({
        tenantId,
        email: `staff_${ts}@test.com`,
        username: `staff_${ts}`,
        passwordHash: "hash",
        fullName: "Staff Test",
        role: "employee"
    }).returning();

    // 3. Create Employees
    console.log("Creating Employees...");
    const [managerEmp] = await db.insert(employees).values({
        tenantId, userId: managerUser.id, firstName: "Manager", lastName: "Test", email: managerUser.email,
        hireDate: "2024-01-01", status: "active", position: "Manager"
    }).returning();

    const [staffEmp] = await db.insert(employees).values({
        tenantId, userId: staffUser.id, firstName: "Staff", lastName: "Test", email: staffUser.email,
        hireDate: "2024-01-01", status: "active", position: "Developer"
    }).returning();

    // 4. Create Department & Link
    console.log("Creating Department...");
    const [dept] = await db.insert(departments).values({
        tenantId, name: `Test Dept ${ts}`, managerId: managerEmp.id
    }).returning();

    // Link Staff to Dept
    await db.update(employees).set({ departmentId: dept.id }).where(eq(employees.id, staffEmp.id));

    // 5. Create Goal & Simulate Logs
    console.log("Creating Goal & Logs...");

    // Get Period
    const periods = await storage.getPerformancePeriods(tenantId);
    let period = periods[0];
    if (!period) {
        // Create period if missing
        // @ts-ignore
        [period] = await storage.createPerformancePeriod({
            tenantId, name: "Test Period", startDate: "2024-01-01", endDate: "2024-12-31", status: "active"
        } as any); // forceful cast if needed
    }

    const [goal] = await db.insert(performanceGoals).values({
        tenantId, periodId: period.id, employeeId: staffEmp.id, title: "Test Goal Inbox",
        weight: 20, status: "draft"
    }).returning();

    // Log: Create
    await storage.createAuditLog({
        tenantId, actorId: staffUser.id, entity: "performance_goal", entityId: goal.id,
        action: "create", createdAt: new Date(), ipAddress: "127.0.0.1", userAgent: "Script"
    });

    // Log: Update
    await storage.createAuditLog({
        tenantId, actorId: staffUser.id, entity: "performance_goal", entityId: goal.id,
        action: "update", createdAt: new Date(), ipAddress: "127.0.0.1", userAgent: "Script"
    });

    // 6. Verify Inbox
    console.log("Verifying Inbox...");

    // @ts-ignore
    const inbox = await storage.getPerformanceInbox(tenantId, managerUser.id, "manager");

    console.log(`Inbox Items: ${inbox.length}`);
    if (inbox.length > 0) {
        console.log("First Item:", JSON.stringify(inbox[0], null, 2));
        console.log("✅ Verification SUCCESS: Manager sees staff update.");
    } else {
        console.error("❌ Verification FAILED: Manager inbox is empty.");
        process.exit(1);
    }

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
