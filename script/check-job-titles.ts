
import { db } from "../server/db";
import { jobTitles, tenants, users } from "@shared/schema";
import { eq, count } from "drizzle-orm";

async function check() {
    console.log("Checking Tenants and Job Titles...");

    const allTenants = await db.select().from(tenants);

    for (const t of allTenants) {
        const titleCount = await db.select({ count: count() }).from(jobTitles).where(eq(jobTitles.tenantId, t.id));
        const userCount = await db.select({ count: count() }).from(users).where(eq(users.tenantId, t.id));

        console.log(`Tenant: ${t.name} (ID: ${t.id})`);
        console.log(` - Users: ${userCount[0].count}`);
        console.log(` - Job Titles: ${titleCount[0].count}`);
    }

    process.exit(0);
}

check().catch(console.error);
