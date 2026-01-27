/**
 * Bootstrap Admin Check
 * Ensures at least one admin user exists in the system
 */

import { db } from "../server/db";
import { users, userRoles, roles } from "../shared/schema";
import { eq, and } from "drizzle-orm";

async function checkAdmin() {
  console.log("🔍 Checking for admin users...\n");
  
  try {
    // Get all tenants
    const allTenants = await db.query.tenants.findMany();
    
    if (allTenants.length === 0) {
      console.log("⚠️  No tenants found. Run seed scripts first.");
      process.exit(0);
    }
    
    let hasAdmin = false;
    
    for (const tenant of allTenants) {
      // Find Admin role for this tenant
      const adminRole = await db.query.roles.findFirst({
        where: and(
          eq(roles.tenantId, tenant.id),
          eq(roles.name, "Admin")
        ),
      });
      
      if (!adminRole) {
        console.log(`⚠️  Tenant "${tenant.name}" has no Admin role. Run 'npm run seed:rbac'`);
        continue;
      }
      
      // Find users with Admin role
      const allUserRoles = await db
        .select()
        .from(userRoles)
        .where(eq(userRoles.roleId, adminRole.id));
      
      // Get user details
      const adminUsers = await Promise.all(
        allUserRoles.map(async (ur) => {
          const user = await db.query.users.findFirst({
            where: eq(users.id, ur.userId),
          });
          return { ...ur, user };
        })
      );
      
      if (adminUsers.length > 0) {
        hasAdmin = true;
        console.log(`✅ Tenant "${tenant.name}" has ${adminUsers.length} admin user(s):`);
        adminUsers.forEach((ur) => {
          if (ur.user) {
            console.log(`   - ${ur.user.email} (${ur.user.id})`);
          }
        });
      } else {
        console.log(`❌ Tenant "${tenant.name}" has NO admin users!`);
        console.log(`   Run: npm run assign-admin-role`);
        process.exit(1);
      }
    }
    
    if (hasAdmin) {
      console.log("\n✅ At least one admin user exists in all tenants");
      process.exit(0);
    } else {
      console.log("\n❌ No admin users found in any tenant");
      process.exit(1);
    }
  } catch (error: any) {
    console.error("❌ Error checking admin users:", error.message);
    process.exit(1);
  }
}

checkAdmin();
