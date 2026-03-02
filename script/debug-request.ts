
import { db } from "../server/db";
import { requests } from "../shared/schema";
import { desc } from "drizzle-orm";

async function main() {
    const [latest] = await db.select().from(requests).orderBy(desc(requests.createdAt)).limit(1);

    if (!latest) {
        console.log("No requests found");
        return;
    }

    console.log("Latest Request ID:", latest.id);
    console.log("Type:", latest.type);
    console.log("Payload Raw:", JSON.stringify(latest.payload, null, 2));

    const payload = latest.payload as any;
    console.log("Extracted start:", payload?.startDate);
    console.log("Extracted end:", payload?.endDate);

    // Check if keys are different
    console.log("Payload Keys:", Object.keys(payload || {}));
}

main().catch(console.error).finally(() => process.exit(0));
