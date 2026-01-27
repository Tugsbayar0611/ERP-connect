
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Adding is_default column to tax_codes table...");
    try {
        await db.execute(sql`
      ALTER TABLE tax_codes 
      ADD COLUMN IF NOT EXISTS is_default BOOLEAN NOT NULL DEFAULT false;
    `);
        console.log("Successfully added is_default column.");
    } catch (error) {
        console.error("Error adding column:", error);
    }
    process.exit(0);
}

main();
