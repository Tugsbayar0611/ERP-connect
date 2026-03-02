
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function checkColumns() {
    try {
        const result = await db.execute(sql`
      SELECT column_name
      FROM information_schema.columns 
      WHERE table_name = 'audit_logs';
    `);
        console.log("Columns:\n" + result.rows.map((r: any) => r.column_name).join("\n"));
    } catch (error) {
        console.error("Error checking columns:", error);
    }
    process.exit(0);
}

checkColumns();
