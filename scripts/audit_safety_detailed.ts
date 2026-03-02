
import { db } from "../server/db";
import { safetyIncidents, users } from "../shared/schema";
import { eq } from "drizzle-orm";

async function audit() {
    try {
        const raw = await db.select().from(safetyIncidents);
        console.log(`[AUDIT] Total rows: ${raw.length}`);
        for (const row of raw) {
            const user = row.reportedBy ? (await db.select().from(users).where(eq(users.id, row.reportedBy)))[0] : null;
            console.log(`INCIDENT: ${row.id}`);
            console.log(`  Title: ${row.title}`);
            console.log(`  TenantID in DB: ${row.tenantId}`);
            console.log(`  ReportedBy: ${row.reportedBy} (${user?.username || 'unknown'})`);
            console.log('---');
        }
    } catch (e) {
        console.error("Audit failed", e);
    }
}

audit();
