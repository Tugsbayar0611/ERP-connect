
import { db } from "../server/db";
import { safetyIncidents } from "../shared/schema";

async function audit() {
    try {
        const results = await db.select().from(safetyIncidents);
        console.log(`TOTAL SAFETY INCIDENTS IN DB: ${results.length}`);
        results.forEach(r => {
            console.log(`ID: ${r.id}, Tenant: ${r.tenantId}, ReportedBy: ${r.reportedBy}, Title: ${r.title}`);
        });
    } catch (e) {
        console.error("Audit failed", e);
    }
}

audit();
