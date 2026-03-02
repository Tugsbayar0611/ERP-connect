
import "dotenv/config";
import { db } from "../server/db";
import { users, roles, rolePermissions, permissions } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("🔍 Checking Admin Permissions...");

    // 1. Get Admin Role
    const [adminRole] = await db.select().from(roles).where(eq(roles.name, "Admin"));
    if (!adminRole) {
        console.log("❌ Admin role not found!");
        process.exit(1);
    }
    console.log(`Admin Role ID: ${adminRole.id}`);

    // 2. Get Permissions for Admin
    const perms = await db.select({
        resource: permissions.resource,
        action: permissions.action,
        description: permissions.description
    })
        .from(rolePermissions)
        .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
        .where(eq(rolePermissions.roleId, adminRole.id));

    console.log(`Found ${perms.length} permissions.`);

    const hasRosterWrite = perms.find(p => p.resource === "roster" && p.action === "write");
    const hasRosterRead = perms.find(p => p.resource === "roster" && p.action === "read");

    console.log("roster.write:", hasRosterWrite ? "✅ YES" : "❌ NO");
    console.log("roster.read:", hasRosterRead ? "✅ YES" : "❌ NO");

    process.exit(0);
}

main().catch(console.error);
