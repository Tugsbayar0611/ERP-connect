
import "dotenv/config";
import { insertShiftSchema, insertRosterSchema } from "../shared/schema";

async function main() {
    const validUuid = "123e4567-e89b-12d3-a456-426614174000"; // Valid UUID format

    console.log("🔍 Testing Shift Schema...");
    const validShift = {
        name: "Test Shift",
        startMinutes: 480,
        endMinutes: 1020,
        tenantId: validUuid
    };

    const shiftParse = insertShiftSchema.safeParse(validShift);
    if (shiftParse.success) {
        console.log("✅ Shift Schema Valid");
        console.log("   Parsed Data:", shiftParse.data);
    } else {
        console.error("❌ Shift Schema Invalid:", JSON.stringify(shiftParse.error.format(), null, 2));
    }

    console.log("\n🔍 Testing Roster Schema...");
    const validRoster = {
        name: "Test Roster",
        cycleDays: 14,
        tenantId: validUuid
    };

    const rosterParse = insertRosterSchema.safeParse(validRoster);
    if (rosterParse.success) {
        console.log("✅ Roster Schema Valid");
        console.log("   Parsed Data:", rosterParse.data);
    } else {
        console.error("❌ Roster Schema Invalid:", JSON.stringify(rosterParse.error.format(), null, 2));
    }
}

main().catch(console.error);
