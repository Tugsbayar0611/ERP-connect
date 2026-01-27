
import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrate() {
    console.log("Starting migration: Copying email (username) to username column...");
    try {
        // Copy content from email to username where username is empty
        // This assumes specific existing data state where 'email' held the username
        await db.execute(sql`UPDATE users SET username = email WHERE username = '' OR username IS NULL`);
        console.log("Migration completed successfully.");
    } catch (error) {
        console.error("Migration failed:", error);
    }
    process.exit(0);
}

migrate();
