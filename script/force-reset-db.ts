
import { db, pool } from "../server/db";
import { sql } from "drizzle-orm";

async function main() {
    console.log("Forcing DB Reset...");
    try {
        await db.execute(sql`DROP SCHEMA public CASCADE;`);
        await db.execute(sql`CREATE SCHEMA public;`);
        await db.execute(sql`GRANT ALL ON SCHEMA public TO public;`);
        await db.execute(sql`COMMENT ON SCHEMA public IS 'standard public schema';`);
        console.log("DB Reset Complete: Public schema recreated.");
    } catch (err) {
        console.error("Reset Failed:", err);
    } finally {
        await pool.end();
    }
}

main();
