
import { db } from "../server/db";
import { users, roles, userRoles } from "../shared/schema";
import { eq, like, and, or } from "drizzle-orm";

async function fix() {
    console.log("🔧 Fixing User Roles...");

    const allTenants = await db.query.tenants.findMany();

    for (const t of allTenants) {
        console.log(`\nTenant: ${t.name}`);

        // 1. Get Admin Role
        const adminRole = await db.query.roles.findFirst({
            where: and(eq(roles.tenantId, t.id), eq(roles.name, "Admin"))
        });

        if (!adminRole) {
            console.log("  Skipping: No Admin role found.");
            continue;
        }

        // 2. Find Users who SHOULD be admins
        // Match 'admin', 'tugst', 'tugs.tb'
        const targetUsers = await db.select().from(users).where(
            and(
                eq(users.tenantId, t.id),
                or(
                    like(users.username, "%admin%"),
                    like(users.email, "%admin%"),
                    like(users.email, "%tugst%"),
                    like(users.email, "%tugs.tb%"),
                    like(users.username, "%huhu%") // Added for MTC tenant
                )
            )
        );

        for (const u of targetUsers) {
            // Check if already has role
            const existing = await db.query.userRoles.findFirst({
                where: and(eq(userRoles.userId, u.id), eq(userRoles.roleId, adminRole.id))
            });

            if (!existing) {
                await db.insert(userRoles).values({
                    userId: u.id,
                    roleId: adminRole.id
                });
                console.log(`  ✅ Assigned Admin role to: ${u.username} (${u.email})`);
            } else {
                console.log(`  (User ${u.username} already has Admin role)`);
            }
        }
    }
    console.log("\nDone.");
    process.exit(0);
}

fix().catch(console.error);
