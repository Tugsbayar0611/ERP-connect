
import "dotenv/config";
import { db } from "../server/db";
import { shifts, users, tenants } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("🚀 Debugging Shift DB Insert...");

    // 1. Get a valid tenant
    const [tenant] = await db.select().from(tenants).limit(1);
    if (!tenant) {
        console.error("No tenant found");
        process.exit(1);
    }
    console.log(`Using Tenant: ${tenant.id} (${tenant.name})`);

    // 2. Prepare payload (mimic Zod parsed output)
    const payload = {
        tenantId: tenant.id,
        name: "Debug Shift " + Date.now(),
        startMinutes: 480,
        endMinutes: 1020,
        // createdAt is MISSING (should default)
    };

    try {
        console.log("Attempting insert...");
        const result = await db.insert(shifts).values(payload).returning();
        console.log("✅ Insert Success:", result[0]);
    } catch (e: any) {
        console.error("❌ Insert Failed:", e);
        // Detail the error
        if (e.message) console.error("Message:", e.message);
        if (e.routine) console.error("Postgres Routine:", e.routine);
    }

    process.exit(0);
}

main().catch(console.error);
