
import { db } from "../server/db";
import { rosterAssignments, rosterDays, rosters, users, employees } from "../shared/schema";
import { eq, and } from "drizzle-orm";

async function main() {
    console.log("--- Checking Assignments ---");
    // Get all assignments
    const allAssignments = await db.select().from(rosterAssignments);
    console.log(`Total Assignments: ${allAssignments.length}`);

    for (const a of allAssignments) {
        const roster = await db.select().from(rosters).where(eq(rosters.id, a.rosterId)).limit(1);
        const emp = await db.select().from(employees).where(eq(employees.id, a.employeeId)).limit(1);
        const days = await db.select().from(rosterDays).where(eq(rosterDays.rosterId, a.rosterId));

        console.log(`\nAssignment ID: ${a.id}`);
        console.log(`  Roster: ${roster[0]?.name} (Cycle: ${roster[0]?.cycleDays} days)`);
        console.log(`  Employee: ${emp[0]?.firstName}`);
        console.log(`  Start Date: ${a.startDate}`);
        console.log(`  Pattern Length: ${days.length} days defined`);

        if (days.length === 0) {
            console.error("  [WARNING] NO PATTERN DEFINED! Roster will appear empty/pending.");
        } else {
            console.log("  Pattern sample:", days.slice(0, 3).map(d => `Day ${d.dayIndex}: ${d.isOff ? 'OFF' : 'Shift ' + d.shiftId}`));
        }
    }

    process.exit(0);
}

main().catch(console.error);
