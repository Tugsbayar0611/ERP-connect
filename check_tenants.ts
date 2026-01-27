import { db } from "./server/db";
import { users, roles, tenants } from "./shared/schema";
import { eq } from "drizzle-orm";
import fs from "fs";

async function main() {
    const lines = [];
    lines.push("Checking Tenants, Users, and Roles...");

    const allTenants = await db.select().from(tenants);
    lines.push(`\nTenants Count: ${allTenants.length}`);
    allTenants.forEach(t => lines.push(`Tenant: ${t.name} (${t.id})`));

    const allUsers = await db.select().from(users);
    lines.push(`\nUsers Count: ${allUsers.length}`);
    allUsers.forEach(u => {
        lines.push(`- User: ${u.email} (${u.id}) | Tenant: ${u.tenantId}`);
    });

    const allRoles = await db.select().from(roles);
    lines.push(`\nRoles Count: ${allRoles.length}`);
    allRoles.forEach(r => {
        lines.push(`- Role: ${r.name} (${r.id}) | Tenant: ${r.tenantId} | System: ${r.isSystem}`);
    });

    fs.writeFileSync("tenant_report.txt", lines.join("\n"));
    console.log("Report written to tenant_report.txt");
    process.exit(0);
}

main();
