
import "dotenv/config";
import { db } from "../server/db";
import { tenants, vehicles, routes, trips } from "../shared/schema";
import { eq } from "drizzle-orm";

async function main() {
    console.log("🚀 Seeding Transport Data...");

    // 1. Get Tenant
    const [tenant] = await db.select().from(tenants).limit(1);
    if (!tenant) {
        console.error("❌ No tenant found. Run seed:demo or seed:admin first.");
        process.exit(1);
    }
    console.log(`📋 Using tenant: ${tenant.name} (${tenant.id})`);

    // 2. Create Vehicle
    let [bus] = await db.select().from(vehicles).where(eq(vehicles.plateNo, "BUS-01"));
    if (!bus) {
        [bus] = await db.insert(vehicles).values({
            tenantId: tenant.id,
            name: "Staff Bus 1",
            plateNo: "BUS-01",
            type: "bus",
            capacity: 45,
            layoutJson: [], // Optional
        }).returning();
        console.log("✅ Created Bus: Staff Bus 1");
    } else {
        console.log("⏭️  Bus already exists.");
    }

    // 3. Create Route
    let [route] = await db.select().from(routes).where(eq(routes.code, "R-001"));
    if (!route) {
        [route] = await db.insert(routes).values({
            tenantId: tenant.id,
            code: "R-001",
            name: "Office <-> Zaisan",
            fromLabel: "Office (Central)",
            toLabel: "Zaisan (South)",
        }).returning();
        console.log("✅ Created Route: Office <-> Zaisan");
    } else {
        console.log("⏭️  Route already exists.");
    }

    // 4. Create Trips (Today and Tomorrow)
    const now = new Date();

    // Morning trip (08:00) - Set to next occurrence or today
    const morningDate = new Date();
    morningDate.setHours(8, 0, 0, 0);
    if (morningDate < now) morningDate.setDate(morningDate.getDate() + 1);

    // Evening trip (18:00)
    const eveningDate = new Date();
    eveningDate.setHours(18, 0, 0, 0);
    if (eveningDate < now) eveningDate.setDate(eveningDate.getDate() + 1);

    try {
        await db.insert(trips).values({
            tenantId: tenant.id,
            vehicleId: bus.id,
            routeId: route.id,
            departureTime: morningDate,
            status: "scheduled",
            notes: "Morning Shift"
        }).onConflictDoNothing(); // Rely on unique index if exists

        await db.insert(trips).values({
            tenantId: tenant.id,
            vehicleId: bus.id,
            routeId: route.id,
            departureTime: eveningDate,
            status: "scheduled",
            notes: "Evening Shift"
        }).onConflictDoNothing();

        console.log(`✅ Created Trips at ${morningDate.toLocaleString()} and ${eveningDate.toLocaleString()}`);
    } catch (e) {
        console.log("⚠️  Trips might already exist", e);
    }

    console.log("🎉 Transport seeding complete!");
    process.exit(0);
}

main().catch(console.error);
