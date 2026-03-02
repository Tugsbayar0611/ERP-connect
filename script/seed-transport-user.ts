
import "dotenv/config";
import { db } from "../server/db";
import { tenants, vehicles, routes, trips, users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    const email = "tugs5@gmail.com";
    console.log(`🚀 Seeding Transport for ${email}...`);

    // 1. Get Tenant via User
    const user = await db.query.users.findFirst({
        where: eq(users.email, email),
        with: { tenant: true }
    });

    if (!user) {
        console.error("❌ User not found.");
        process.exit(1);
    }
    const tenant = user.tenant;
    console.log(`📋 Using tenant: ${tenant.name} (${tenant.id})`);

    // 2. Find Existing Vehicle or Create
    let [bus] = await db.select().from(vehicles).where(eq(vehicles.tenantId, tenant.id)).limit(1);
    if (!bus) {
        console.log("Creating new bus...");
        [bus] = await db.insert(vehicles).values({
            tenantId: tenant.id,
            name: "Staff Bus 1",
            plateNo: "BUS-01",
            type: "bus",
            capacity: 45,
        }).returning();
    } else {
        console.log(`✅ Using existing bus: ${bus.name} (${bus.plateNo})`);
    }

    // 3. Create Route (If none)
    let [route] = await db.select().from(routes).where(eq(routes.tenantId, tenant.id)).limit(1);
    if (!route) {
        console.log("Creating route...");
        [route] = await db.insert(routes).values({
            tenantId: tenant.id,
            code: "R-001",
            name: "Office -> Home",
            fromLabel: "Office",
            toLabel: "City Center",
        }).returning();
    } else {
        console.log(`✅ Using existing route: ${route.name}`);
    }

    // 4. Create Trips (Today and Tomorrow)
    const now = new Date();

    // Morning trip (08:00) - Set to next occurrence or today
    const morningDate = new Date();
    morningDate.setHours(8, 0, 0, 0);
    // If 8am passed, push to tomorrow? 
    // Maybe just create it anyway so it shows in history or if date is unfiltered.
    // Better: Create one for *today* 18:00 and *tomorrow* 08:00.

    const eveningDate = new Date();
    eveningDate.setHours(18, 0, 0, 0);
    if (eveningDate < now) eveningDate.setDate(eveningDate.getDate() + 1); // If 18:00 passed, set tomorrow

    // Ensure we have at least one FUTURE trip
    const tomorrowMorning = new Date();
    tomorrowMorning.setDate(tomorrowMorning.getDate() + 1);
    tomorrowMorning.setHours(8, 0, 0, 0);

    const tripsToCreate = [eveningDate, tomorrowMorning];

    for (const date of tripsToCreate) {
        try {
            await db.insert(trips).values({
                tenantId: tenant.id,
                vehicleId: bus.id,
                routeId: route.id,
                departureTime: date,
                status: "scheduled",
                notes: "Regular Commute"
            }).onConflictDoNothing();
            console.log(`✅ Scheduled Trip: ${date.toLocaleString()}`);
        } catch (e) {
            console.log("⚠️  Trip exists", e);
        }
    }

    console.log("🎉 Transport seeding complete!");
    process.exit(0);
}

main().catch(console.error);
