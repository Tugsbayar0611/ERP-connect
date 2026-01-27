import { db } from "../server/db";
import { users, tenants, roles, userRoles } from "../shared/schema";
import { eq, and } from "drizzle-orm";
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

  let adminUser = existingUser;

  if (!adminUser) {
    console.log("Creating admin user...");
    const passwordHash = await hashPassword("admin123");

    const [created] = await db.insert(users).values({
      tenantId: tenant!.id,
      email: "admin",
      fullName: "System Admin",
      passwordHash,
      role: "Admin",
      isActive: true,
    }).returning();

    adminUser = created;
    console.log("Admin user created: admin / admin123");
  } else {
    console.log("Admin user already exists.");
  }

  // 3. Assign Admin role to admin user (RBAC)
  const adminRole = await db.query.roles.findFirst({
    where: eq(roles.name, "Admin"),
  });

  if (adminRole) {
    const [existingUserRole] = await db
      .select()
      .from(userRoles)
      .where(
        and(
          eq(userRoles.userId, adminUser!.id),
          eq(userRoles.roleId, adminRole.id)
        )
      )
      .limit(1);


    if (!existingUserRole) {
      await db.insert(userRoles).values({
        userId: adminUser!.id,
        roleId: adminRole.id,
      });
      console.log("Admin role assigned to admin user.");
    } else {
      console.log("Admin role already assigned to admin user.");
    }
  } else {
    console.log("Warning: Admin role not found. Run 'npm run seed:rbac' first.");
  }

  console.log("Seeding complete.");
  process.exit(0);
}

seed().catch((err) => {
  console.error("Seeding failed:", err);
  process.exit(1);
});
