
import { db } from "../server/db";
import { roles, userRoles } from "../shared/schema";
import { eq, notInArray } from "drizzle-orm";

async function cleanupUserRoles() {
    console.log("Cleaning up orphaned user roles...");

    const allRoles = await db.select().from(roles);
    const validRoleIds = new Set(allRoles.map(r => r.id));

    const allUserRoles = await db.select().from(userRoles);

    if (allUserRoles.length === 0) {
        console.log("No user roles found.");
        process.exit(0);
    }

    let count = 0;
    for (const ur of allUserRoles) {
        if (!validRoleIds.has(ur.roleId)) {
            console.log(`Deleting orphan user_role for roleId: ${ur.roleId} (User: ${ur.userId})`);
            await db.delete(userRoles).where(
                eq(userRoles.roleId, ur.roleId)
                // Note: PK is composite (userId, roleId) usually.
                // Assuming schema: roleId, userId. 
            );
            count++;
        }
    }

    console.log(`Deleted ${count} orphaned user role assignments.`);
    process.exit(0);
}

cleanupUserRoles().catch(console.error);
