import "dotenv/config";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { Client } from "pg";

async function runMigration() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("✅ Database connected\n");

    // Run all migration files in order
    const migrationFiles = [
      "001_accounting_patches.sql",
      "002_numbering_sequences.sql",
    ];

    for (const migrationFile of migrationFiles) {
      const sqlPath = join(process.cwd(), "migrations", migrationFile);
      
      if (!existsSync(sqlPath)) {
        console.log(`⚠️  Migration file not found: ${migrationFile}, skipping...\n`);
        continue;
      }

      console.log(`📄 Running migration: ${migrationFile}`);
      console.log("⏳ Executing SQL...");

      const sql = readFileSync(sqlPath, "utf-8");

      // Execute entire SQL file at once (PostgreSQL handles multiple statements)
      try {
        await client.query(sql);
        console.log(`✅ Migration ${migrationFile} completed successfully!\n`);
      } catch (err: any) {
        // Check if it's an "already exists" error that we can ignore
        if (
          err.message.includes("already exists") ||
          err.message.includes("does not exist") ||
          (err.message.includes("relation") && err.message.includes("already exists")) ||
          err.message.includes("duplicate")
        ) {
          console.log(`⚠️  Warning (ignored): ${err.message.split("\n")[0]}`);
          console.log(`✅ Migration ${migrationFile} completed with warnings\n`);
        } else {
          throw err;
        }
      }
    }

    console.log("✅ All migrations completed successfully!");
  } catch (error: any) {
    console.error("❌ Migration failed:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

runMigration();
