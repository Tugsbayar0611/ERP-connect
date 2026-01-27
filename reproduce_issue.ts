import { db } from "./server/db";
import { DatabaseStorage } from "./server/storage";
import { users } from "./shared/schema";
import { eq } from "drizzle-orm";
import fs from "fs";

async function main() {
    const log = (msg: string) => fs.appendFileSync("repro_log.txt", msg + "\n");
    fs.writeFileSync("repro_log.txt", "Starting Test...\n");

    const storage = new DatabaseStorage(db);

    try {
        const adminUser = await db.query.users.findFirst({
            where: eq(users.email, "admin")
        });

        if (!adminUser) {
            log("Admin user not found!");
            process.exit(1);
        }
        log(`Admin Found: ${adminUser.id}`);

        // Test getUserRoles
        log("Testing getUserRoles...");
        const userRoles = await storage.getUserRoles(adminUser.id);
        log(`User Roles Count: ${userRoles.length}`);
        userRoles.forEach(r => log(`- Role: ${r.name} (${r.isSystem ? 'System' : 'Custom'})`));

        // Test getUserPermissions
        log("Testing getUserPermissions...");
        const perms = await storage.getUserPermissions(adminUser.id);
        log(`User Permissions Count: ${perms.length}`);
        perms.forEach(p => log(`- Perm: ${p.resource}.${p.action}`));

        // Test createRole (which crashed 500 earlier due to middleware, but here passing means storage is fine)
        log("Testing createRole...");
        const newRole = await storage.createRole({
            name: "Unit_Test_Role_" + Date.now(),
            description: "Unit test",
            tenantId: adminUser.tenantId,
            isSystem: false
        }, []);
        log(`Role Created: ${newRole.id} - ${newRole.name}`);

    } catch (err: any) {
        log(`ERROR: ${err.message}\n${err.stack}`);
    }

    process.exit(0);
}

main();
