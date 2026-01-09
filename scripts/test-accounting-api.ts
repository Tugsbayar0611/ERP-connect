import "dotenv/config";
import { Client } from "pg";

// Test database queries directly
async function testAccountingAPI() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("✅ Database connected\n");

    // Test 1: Check if tables exist
    console.log("📋 Test 1: Check accounting tables...");
    const tables = [
      "currencies",
      "accounts",
      "journals",
      "journal_entries",
      "journal_lines",
      "tax_codes",
      "payments",
    ];

    for (const table of tables) {
      const result = await client.query(
        `SELECT COUNT(*) as count FROM ${table} LIMIT 1`
      );
      console.log(`  ✅ ${table}: ${result.rows[0].count} rows`);
    }

    // Test 2: Insert test data
    console.log("\n📋 Test 2: Insert test data...");

    // Get first tenant
    const tenantResult = await client.query("SELECT id FROM tenants LIMIT 1");
    if (tenantResult.rows.length === 0) {
      console.log("  ⚠️  No tenant found. Please create a tenant first.");
      return;
    }
    const tenantId = tenantResult.rows[0].id;
    console.log(`  ✅ Using tenant: ${tenantId}`);

    // Create test currency (MNT)
    console.log("\n  💰 Creating test currency (MNT)...");
    try {
      const currencyResult = await client.query(
        `INSERT INTO currencies (tenant_id, code, name, symbol, rate, is_base, is_active)
         VALUES ($1, 'MNT', 'Mонгол Төгрөг', '₮', 1.0000, true, true)
         ON CONFLICT (tenant_id, code) DO NOTHING
         RETURNING id, code, name`,
        [tenantId]
      );
      if (currencyResult.rows.length > 0) {
        console.log(`  ✅ Currency created: ${currencyResult.rows[0].code} - ${currencyResult.rows[0].name}`);
      } else {
        console.log(`  ✅ Currency already exists: MNT`);
      }
    } catch (err: any) {
      console.log(`  ⚠️  Currency error: ${err.message}`);
    }

    // Create test accounts
    console.log("\n  📊 Creating test accounts...");
    const accountCodes = [
      { code: "1000", name: "Бэлэн мөнгө", type: "asset", level: 1 },
      { code: "1100", name: "Авлага", type: "asset", level: 1 },
      { code: "4000", name: "Борлуулалтын орлого", type: "income", level: 1 },
      { code: "2100", name: "ХХОАТ төлөх", type: "liability", level: 1 },
    ];

    for (const acc of accountCodes) {
      try {
        const accResult = await client.query(
          `INSERT INTO accounts (tenant_id, code, name, type, level, is_active)
           VALUES ($1, $2, $3, $4, $5, true)
           ON CONFLICT (tenant_id, code) DO UPDATE SET name = EXCLUDED.name
           RETURNING id, code, name`,
          [tenantId, acc.code, acc.name, acc.type, acc.level]
        );
        console.log(`  ✅ Account: ${acc.code} - ${acc.name}`);
      } catch (err: any) {
        console.log(`  ⚠️  Account ${acc.code} error: ${err.message}`);
      }
    }

    // Create test journal
    console.log("\n  📖 Creating test journal...");
    try {
      const journalResult = await client.query(
        `INSERT INTO journals (tenant_id, name, code, type, is_active)
         VALUES ($1, 'Sales Journal', 'SALES', 'sales', true)
         ON CONFLICT (tenant_id, code) DO NOTHING
         RETURNING id, code, name`,
        [tenantId]
      );
      if (journalResult.rows.length > 0) {
        console.log(`  ✅ Journal created: ${journalResult.rows[0].code} - ${journalResult.rows[0].name}`);
      } else {
        console.log(`  ✅ Journal already exists: SALES`);
      }
    } catch (err: any) {
      console.log(`  ⚠️  Journal error: ${err.message}`);
    }

    // Test 3: Create test journal entry
    console.log("\n📋 Test 3: Create test journal entry...");
    
    // Get accounts
    const accountsResult = await client.query(
      `SELECT id, code, name, type FROM accounts WHERE tenant_id = $1 ORDER BY code`,
      [tenantId]
    );
    
    if (accountsResult.rows.length < 2) {
      console.log("  ⚠️  Not enough accounts. Please create accounts first.");
      return;
    }

    const cashAccount = accountsResult.rows.find((a: any) => a.code === "1000");
    const revenueAccount = accountsResult.rows.find((a: any) => a.code === "4000");

    if (!cashAccount || !revenueAccount) {
      console.log("  ⚠️  Required accounts not found (1000, 4000)");
      return;
    }

    // Get journal
    const journalResult = await client.query(
      `SELECT id FROM journals WHERE tenant_id = $1 AND code = 'SALES' LIMIT 1`,
      [tenantId]
    );

    if (journalResult.rows.length === 0) {
      console.log("  ⚠️  Journal not found");
      return;
    }

    const journalId = journalResult.rows[0].id;
    const entryNumber = `JE-${new Date().getFullYear()}-TEST-001`;
    const entryDate = new Date().toISOString().split("T")[0];

    // Create journal entry
    try {
      const entryResult = await client.query(
        `INSERT INTO journal_entries (tenant_id, journal_id, entry_number, entry_date, description, status)
         VALUES ($1, $2, $3, $4, 'Test entry', 'draft')
         RETURNING id, entry_number, status`,
        [tenantId, journalId, entryNumber, entryDate]
      );

      if (entryResult.rows.length > 0) {
        const entryId = entryResult.rows[0].id;
        console.log(`  ✅ Journal entry created: ${entryResult.rows[0].entry_number}`);

        // Create journal lines (double-entry)
        const amount = "100000";
        
        await client.query(
          `INSERT INTO journal_lines (entry_id, account_id, debit, credit, description)
           VALUES ($1, $2, $3, 0, 'Cash received')`,
          [entryId, cashAccount.id, amount]
        );

        await client.query(
          `INSERT INTO journal_lines (entry_id, account_id, debit, credit, description)
           VALUES ($1, $2, 0, $3, 'Revenue')`,
          [entryId, revenueAccount.id, amount]
        );

        console.log(`  ✅ Journal lines created (double-entry)`);

        // Test posting
        console.log("\n📋 Test 4: Post journal entry...");
        try {
          await client.query(
            `UPDATE journal_entries SET status = 'posted', posted_at = NOW(), posted_by = (
              SELECT id FROM users WHERE tenant_id = $1 LIMIT 1
            ) WHERE id = $2`,
            [tenantId, entryId]
          );
          console.log(`  ✅ Journal entry posted successfully`);

          // Verify double-entry balance
          const balanceResult = await client.query(
            `SELECT 
              COALESCE(SUM(debit), 0) as total_debit,
              COALESCE(SUM(credit), 0) as total_credit
             FROM journal_lines
             WHERE entry_id = $1`,
            [entryId]
          );

          const totalDebit = parseFloat(balanceResult.rows[0].total_debit);
          const totalCredit = parseFloat(balanceResult.rows[0].total_credit);

          if (Math.abs(totalDebit - totalCredit) < 0.01) {
            console.log(`  ✅ Double-entry balanced: ${totalDebit} = ${totalCredit}`);
          } else {
            console.log(`  ❌ Double-entry NOT balanced: ${totalDebit} != ${totalCredit}`);
          }

        } catch (err: any) {
          console.log(`  ❌ Posting error: ${err.message}`);
        }

      }
    } catch (err: any) {
      if (err.message.includes("duplicate") || err.message.includes("already exists")) {
        console.log(`  ✅ Journal entry already exists: ${entryNumber}`);
      } else {
        console.log(`  ❌ Journal entry error: ${err.message}`);
      }
    }

    // Test 5: Verify triggers
    console.log("\n📋 Test 5: Verify triggers...");
    const triggerResult = await client.query(
      `SELECT tgname FROM pg_trigger 
       WHERE tgname IN (
         'check_double_entry_on_post_trigger',
         'prevent_posted_journal_line_write_trigger',
         'check_period_lock_trigger'
       )`
    );
    console.log(`  ✅ Found ${triggerResult.rows.length} triggers`);

    console.log("\n✅ All tests completed!");

  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testAccountingAPI();
