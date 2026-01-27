/**
 * Assign Admin role to admin user
 */

import { db } from "../server/db";
import { users, roles, userRoles } from "../shared/schema";
import { eq, and } from "drizzle-orm";

async function main() {
  console.log("Assigning Admin role to admin user...");

  // Find admin user
  const adminUser = await db.query.users.findFirst({
    where: eq(users.email, "admin"),
  });

  if (!adminUser) {
    console.error("Admin user not found!");
    process.exit(1);
  }

  console.log(`Found admin user: ${adminUser.id}`);

  // Find Admin role
  const adminRole = await db.query.roles.findFirst({
    where: eq(roles.name, "Admin"),
  });

  if (!adminRole) {
    console.error("Admin role not found! Run 'npm run seed:rbac' first.");
    process.exit(1);
  }

  console.log(`Found Admin role: ${adminRole.id}`);

  // Check if already assigned
  const existing = await db.query.userRoles.findFirst({
    where: and(
      eq(userRoles.userId, adminUser.id),
      eq(userRoles.roleId, adminRole.id)
    ),
  });

  if (existing) {
    console.log("Admin role already assigned to admin user.");
  } else {
    await db.insert(userRoles).values({
      userId: adminUser.id,
      roleId: adminRole.id,
    });
    console.log("✅ Admin role assigned to admin user!");
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
