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
      "003_qpay_integration.sql",
      "004_two_factor_auth.sql",
      "005_add_national_id.sql",
      "006_create_attendance_tables.sql",
      "007_password_reset_tokens.sql",
      "008_add_ebarimt_fields.sql",
      "009_create_ebarimt_settings.sql",
      "010_add_tenant_address_fields.sql",
      "011_add_ebarimt_lottery_number.sql",
      "012_padan_numbering.sql",
      "013_add_mongolian_hr_fields.sql",
      "014_add_expiry_batch_tracking.sql",
      "015_add_salary_advances_allowances.sql",
      "016_add_geofencing_branches.sql",
      "017_add_hr_gamification.sql",
      "018_add_attendance_photos.sql",
      "019_add_wifi_ssid_to_branches.sql",
      "020_add_news_feed.sql",
      "021_add_weather_widget.sql",
      "022_add_department_manager.sql",
      "023_add_user_id_to_employees.sql",
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
