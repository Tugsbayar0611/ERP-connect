
import { db } from "../server/db";
import { roles, rolePermissions, permissions, tenants, users, userRoles } from "../shared/schema";
import { eq, sql, and, inArray } from "drizzle-orm";

async function check() {
    try {
        console.log("Checking DB state (Queries)...");

        // 1. Tenants
        const allTenants = await db.select().from(tenants);
        console.log(`Found ${allTenants.length} tenants.`);

        for (const t of allTenants) {
            console.log(`\nTenant: ${t.name} (${t.id})`);
            const [adminRole] = await db.select().from(roles).where(and(eq(roles.tenantId, t.id), eq(roles.name, "Admin"))).limit(1);

            if (adminRole) {
                console.log(`  Admin Role ID: ${adminRole.id}`);

                // Count permissions directly
                const rps = await db.select().from(rolePermissions).where(eq(rolePermissions.roleId, adminRole.id));
                console.log(`  Total Assigned Permissions: ${rps.length}`);

                if (rps.length > 0) {
                    const permIds = rps.map(rp => rp.permissionId);
                    // Check specific ones
                    const perfPerms = await db.select().from(permissions).where(
                        and(
                            inArray(permissions.id, permIds),
                            eq(permissions.resource, 'performance')
                        )
                    );
                    const safetyPerms = await db.select().from(permissions).where(
                        and(
                            inArray(permissions.id, permIds),
                            eq(permissions.resource, 'safety')
                        )
                    );

                    console.log(`  > Has Performance? ${perfPerms.length > 0} (Count: ${perfPerms.length})`);
                    console.log(`  > Has Safety? ${safetyPerms.length > 0} (Count: ${safetyPerms.length})`);
                } else {
                    console.log("  > ⚠️ WARNING: 0 permissions assigned!");
                }
            } else {
                console.log(`  ❌ No Admin role found!`);
            }

            // Check Users and their Roles
            const tenantUsers = await db.select().from(users).where(eq(users.tenantId, t.id));
            console.log(`  Users in Tenant: ${tenantUsers.length}`);
            for (const u of tenantUsers) {
                const urs = await db.select().from(userRoles).where(eq(userRoles.userId, u.id));
                const userRoleIds = urs.map(ur => ur.roleId);
                const assignedRoles = await db.select().from(roles).where(inArray(roles.id, userRoleIds));
                const roleNames = assignedRoles.map(r => r.name).join(", ");
                console.log(`    - User: ${u.username} (${u.email}) - Roles: [${roleNames}]`);
            }
        }
    } catch (e) {
        console.error("Error:", e);
    }
    process.exit(0);
}

check();
