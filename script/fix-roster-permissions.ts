
import "dotenv/config";
import { db } from "../server/db";
import { roles, permissions, rolePermissions } from "../shared/schema";
import { eq, and } from "drizzle-orm";

async function main() {
    console.log("🚀 Fixing Roster Permissions...");

    const PERMS = [
        { resource: "roster", action: "read", description: "View Roster" },
        { resource: "roster", action: "write", description: "Manage Roster" },
    ];

    // 1. Ensure Permissions Exist
    for (const p of PERMS) {
        const [existing] = await db.select().from(permissions).where(and(
            eq(permissions.resource, p.resource),
            eq(permissions.action, p.action)
        ));
        if (!existing) {
            console.log(`Creating permission: ${p.resource}.${p.action}`);
            await db.insert(permissions).values({
                resource: p.resource,
                action: p.action,
                description: p.description
            });
        }
    }

    // 2. Assign to Admin Role
    const [adminRole] = await db.select().from(roles).where(eq(roles.name, "Admin"));
    if (!adminRole) {
        console.error("❌ Admin role not found");
        process.exit(1);
    }

    for (const p of PERMS) {
        const [perm] = await db.select().from(permissions).where(and(
            eq(permissions.resource, p.resource),
            eq(permissions.action, p.action)
        ));
        if (!perm) continue;

        const [link] = await db.select().from(rolePermissions).where(and(
            eq(rolePermissions.roleId, adminRole.id),
            eq(rolePermissions.permissionId, perm.id)
        ));

        if (!link) {
            console.log(`Assigning ${p.resource}.${p.action} to Admin...`);
            await db.insert(rolePermissions).values({
                roleId: adminRole.id,
                permissionId: perm.id
            });
        } else {
            console.log(`Admin already has ${p.resource}.${p.action}`);
        }
    }

    console.log("✅ Roster permissions fixed.");
    process.exit(0);
}

main().catch(console.error);
