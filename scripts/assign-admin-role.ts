/**
 * Assign the tenant-scoped Admin role to admin-like users.
 *
 * Run after seed:rbac so every tenant has its own Admin role.
 */

import { db } from "../server/db";
import { users, roles, userRoles, tenants } from "../shared/schema";
import { eq, and } from "drizzle-orm";

type UserRow = typeof users.$inferSelect;

function isAdminCandidate(user: UserRow) {
  const values = [user.email, user.username, user.role]
    .filter(Boolean)
    .map((value) => value!.toLowerCase());

  return values.some((value) => value.includes("admin"));
}

async function main() {
  console.log("Assigning Admin role to admin users...");

  const allTenants = await db.select().from(tenants);
  let missingTenantAdmins = 0;

  for (const tenant of allTenants) {
    const adminRole = await db.query.roles.findFirst({
      where: and(eq(roles.tenantId, tenant.id), eq(roles.name, "Admin")),
    });

    if (!adminRole) {
      console.error(`Tenant "${tenant.name}" has no Admin role. Run 'npm run seed:rbac' first.`);
      missingTenantAdmins++;
      continue;
    }

    const tenantUsers = await db.select().from(users).where(eq(users.tenantId, tenant.id));
    const adminUsers = tenantUsers.filter(isAdminCandidate);

    if (adminUsers.length === 0) {
      console.error(`Tenant "${tenant.name}" has no admin-like user to assign.`);
      missingTenantAdmins++;
      continue;
    }

    for (const adminUser of adminUsers) {
      const existing = await db.query.userRoles.findFirst({
        where: and(
          eq(userRoles.userId, adminUser.id),
          eq(userRoles.roleId, adminRole.id)
        ),
      });

      const label = adminUser.email || adminUser.username || adminUser.id;

      if (!existing) {
        await db.insert(userRoles).values({
          userId: adminUser.id,
          roleId: adminRole.id,
        });
        console.log(`Admin role assigned to ${label} in ${tenant.name}.`);
      } else {
        console.log(`${label} already has Admin role in ${tenant.name}.`);
      }

      if (adminUser.role !== "Admin") {
        await db.update(users).set({ role: "Admin" }).where(eq(users.id, adminUser.id));
      }
    }
  }

  if (missingTenantAdmins > 0) {
    process.exit(1);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
