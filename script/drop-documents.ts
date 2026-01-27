
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Dropping documents table...");
    await db.execute(sql`DROP TABLE IF EXISTS documents CASCADE`);
    console.log("Dropped documents table successfully.");
    process.exit(0);
}

main().catch((err) => {
    console.error("Error dropping table:", err);
    process.exit(1);
});
