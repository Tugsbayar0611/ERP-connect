
import { db } from "../server/db";
import { jobTitles, tenants } from "@shared/schema";
import { eq } from "drizzle-orm";

const TITLES = [
    { name: "Гүйцэтгэх захирал", code: "CEO" },
    { name: "Ерөнхий менежер", code: "GM" },
    { name: "Хүний нөөцийн менежер", code: "HRM" },
    { name: "Ахлах нягтлан", code: "ACC-SR" },
    { name: "Нягтлан бодогч", code: "ACC" },
    { name: "Маркетингийн менежер", code: "MM" },
    { name: "Борлуулалтын менежер", code: "SM" },
    { name: "Ахлах хөгжүүлэгч", code: "DEV-SR" },
    { name: "Хөгжүүлэгч", code: "DEV" },
    { name: "Жолооч", code: "DRV" },
    { name: "Үйлчлэгч", code: "CLN" },
    { name: "Харуул", code: "SEC" },
    { name: "Ресепшн", code: "RCP" }
];

async function seed() {
    console.log("Seeding job titles...");

    // 1. Get ALL tenants
    const allTenants = await db.select().from(tenants);
    if (allTenants.length === 0) {
        console.log("No tenants found. Skipping.");
        process.exit(0);
    }

    for (const tenant of allTenants) {
        const tenantId = tenant.id;
        console.log(`Seeding for tenant: ${tenant.name} (${tenantId})`);


        // 2. Insert titles
        let added = 0;
        for (const t of TITLES) {
            // Check if exists
            const existing = await db.select().from(jobTitles).where(eq(jobTitles.name, t.name));
            // Note: existing check might need to be tenant specific if unique constraint includes tenantId
            const existsForTenant = existing.some(e => e.tenantId === tenantId);

            if (!existsForTenant) {
                await db.insert(jobTitles).values({
                    tenantId,
                    name: t.name,
                    code: t.code,
                    isActive: true
                });
                console.log(`+ Added: ${t.name}`);
                added++;
            } else {
                console.log(`- Skipped: ${t.name} (already exists)`);
            }
        }

        console.log(`Done. Added ${added} titles.`);
        console.log(`Done adding titles for ${tenant.name}.`);
    }

    console.log("Seeding complete for all tenants.");
    process.exit(0);
}

seed().catch(err => {
    console.error(err);
    process.exit(1);
});
