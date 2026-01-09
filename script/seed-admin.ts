import { db } from "../server/db";
import { users, tenants } from "../shared/schema";
import { eq } from "drizzle-orm";
import { scrypt, randomBytes } from "crypto";
import { promisify } from "util";

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function seed() {
  console.log("Seeding admin user...");

  // 1. Tenant
  let tenant = await db.query.tenants.findFirst();

  if (!tenant) {
    console.log("Creating default tenant...");
    const [created] = await db
      .insert(tenants)
      .values({
        name: "My Organization",
        countryCode: "MN",
        timezone: "Asia/Ulaanbaatar",
        currencyCode: "MNT",
        status: "active",
      })
      .returning();
    tenant = created;
  }

  // 2. Admin user
  const existingUser = await db.query.users.findFirst({
    where: eq(users.email, "admin"),
  });

  if (!existingUser) {
    console.log("Creating admin user...");
    const passwordHash = await hashPassword("admin123");

    await db.insert(users).values({
      tenantId: tenant!.id,
      email: "admin",
      fullName: "System Admin",
      passwordHash,
      role: "Admin",
      isActive: true,
    });

    console.log("Admin user created: admin / admin123");
  } else {
    console.log("Admin user already exists.");
  }

  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
