import { db } from "../server/db";
import { users, employees, tenants } from "../shared/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
    const salt = randomBytes(16).toString("hex");
    const buf = (await scryptAsync(password, salt, 64)) as Buffer;
    return `${buf.toString("hex")}.${salt}`;
}

async function main() {
    console.log("Starting user creation...");
    try {
        const tenant = await db.query.tenants.findFirst();
        if (!tenant) {
            console.error("No tenant found");
            process.exit(1);
        }
        console.log("Tenant found:", tenant.id);

        const username = "test_employee_v2";
        const password = "password123";
        const hashedPassword = await hashPassword(password);

        let user = await db.query.users.findFirst({
            where: eq(users.username, username),
        });

        if (!user) {
            console.log("Creating user (v2)...");
            const [newUser] = await db.insert(users).values({
                username,
                password: hashedPassword,
                role: "employee",
                tenantId: tenant.id,
                displayName: "Test Employee V2",
                email: "test_employee_v2@example.com",
            }).returning();
            user = newUser;
            console.log("Created user:", user.id);
        } else {
            console.log("User already exists:", user.id);
        }

        const existingEmployee = await db.query.employees.findFirst({
            where: eq(employees.userId, user.id),
        });

        if (!existingEmployee) {
            console.log("Creating employee record...");
            const hireDate = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
            await db.insert(employees).values({
                firstName: "Test",
                lastName: "EmployeeV2",
                email: "test_employee_v2@example.com",
                tenantId: tenant.id,
                userId: user.id,
                status: "active",
                hireDate: hireDate,
                position: "Tester",
                baseSalary: "0",
            });
            console.log("Linked employee record created.");
        } else {
            console.log("Employee record already linked.");
        }

        console.log(`Credentials: ${username} / ${password}`);
        process.exit(0);

    } catch (err) {
        console.error("Error in script:", err);
        process.exit(1);
    }
}

main().catch(console.error);
