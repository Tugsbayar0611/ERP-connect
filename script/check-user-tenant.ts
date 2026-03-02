
import "dotenv/config";
import { db } from "../server/db";
import { users, tenants, trips, vehicles, routes } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    const email = "tugs5@gmail.com";
    console.log(`🔍 Checking for user: ${email}...`);

    const user = await db.query.users.findFirst({
        where: eq(users.email, email),
        with: {
            tenant: true
        }
    });

    if (!user) {
        console.log("❌ User not found in DB.");
        // Fallback: List all tenants to see if maybe email is different or just verify tenants
        const allTenants = await db.select().from(tenants);
        console.log("📋 All Tenants:", allTenants.map(t => `${t.name} (${t.id})`));
        process.exit(0);
    }

    console.log(`✅ User found: ${user.fullName} (${user.id})`);
    console.log(`   Tenant: ${user.tenant.name} (${user.tenantId})`);

    // Check Trips for this tenant
    const tenantTrips = await db.select().from(trips).where(eq(trips.tenantId, user.tenantId));
    console.log(`   Trips Count: ${tenantTrips.length}`);

    if (tenantTrips.length > 0) {
        console.log("   --- Existing Trips ---");
        tenantTrips.forEach(t => console.log(`   - ${t.departureTime} (Status: ${t.status})`));
    } else {
        console.log("   ⚠️  No trips found for this tenant.");
    }

    // Check Vehicles
    const tenantVehicles = await db.select().from(vehicles).where(eq(vehicles.tenantId, user.tenantId));
    console.log(`   Vehicles Count: ${tenantVehicles.length}`);
    tenantVehicles.forEach(v => console.log(`   - ${v.name} (${v.plateNo})`));

    process.exit(0);
}

main().catch(console.error);
