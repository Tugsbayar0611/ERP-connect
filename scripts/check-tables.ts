import "dotenv/config";
import { Client } from "pg";

async function checkTables() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("✅ Database connected\n");

    // Check accounting tables
    const tables = [
      "currencies",
      "accounts",
      "journals",
      "journal_entries",
      "journal_lines",
      "tax_codes",
      "tax_lines",
      "payments",
      "payment_allocations",
      "bank_accounts",
      "bank_statements",
      "bank_statement_lines",
      "reconciliations",
      "reconciliation_matches",
      "fiscal_years",
      "fiscal_periods",
      "period_locks",
    ];

    console.log("📋 Checking accounting tables...\n");
    
    for (const table of tables) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = $1
        )`,
        [table]
      );
      
      const exists = result.rows[0].exists;
      console.log(`${exists ? "✅" : "❌"} ${table}`);
    }

    console.log("\n📋 Checking triggers...\n");
    
    const triggers = [
      "check_double_entry_on_post_trigger",
      "prevent_posted_journal_line_write_trigger",
      "check_period_lock_trigger",
      "check_allocation_cap_trigger",
      "check_bank_statement_line_debit_credit_trigger",
      "check_reconciliation_match_one_fk_trigger",
      "check_journal_line_constraints_trigger",
    ];

    for (const trigger of triggers) {
      const result = await client.query(
        `SELECT EXISTS (
          SELECT FROM pg_trigger 
          WHERE tgname = $1
        )`,
        [trigger]
      );
      
      const exists = result.rows[0].exists;
      console.log(`${exists ? "✅" : "❌"} ${trigger}`);
    }

  } catch (error: any) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

checkTables();
