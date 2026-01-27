
import { db } from "../server/db";
import { roles, rolePermissions } from "../shared/schema";
import { eq } from "drizzle-orm";

async function cleanup() {
    console.log("Cleaning up garbage roles...");

    // Select non-system roles to delete
    const garbageRoles = await db.select().from(roles).where(eq(roles.isSystem, false));

    if (garbageRoles.length === 0) {
        console.log("No garbage roles found.");
        process.exit(0);
    }

    console.log(`Found ${garbageRoles.length} garbage roles.`);
    const ids = garbageRoles.map(r => r.id);

    // Note: Drizzle doesn't support "DELETE ... WHERE id IN (...)" nicely without inArray import, 
    // but we can iterate. Safety first.

    for (const role of garbageRoles) {
        console.log(`Deleting role: ${role.name} (${role.id})`);
        // Delete permissions
        await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));
        // Delete role
        await db.delete(roles).where(eq(roles.id, role.id));
    }

    console.log("Cleanup complete.");
    process.exit(0);
}

cleanup().catch(console.error);
