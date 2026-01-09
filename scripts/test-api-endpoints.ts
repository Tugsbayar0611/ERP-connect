import "dotenv/config";
import { storage } from "../server/storage";

// Test API endpoints through storage layer
async function testAPIEndpoints() {
  console.log("🧪 Testing Accounting API Endpoints\n");

  try {
    // Get tenant
    const tenantResult = await storage.getTenant("27f8e5ec-1819-4014-b637-fac2b561473d");
    if (!tenantResult) {
      console.log("❌ Tenant not found");
      return;
    }
    const tenantId = tenantResult.id;
    console.log(`✅ Using tenant: ${tenantId}\n`);

    // Test 1: Get Currencies
    console.log("📋 Test 1: GET /api/currencies");
    const currencies = await storage.getCurrencies(tenantId);
    console.log(`  ✅ Found ${currencies.length} currencies`);
    if (currencies.length > 0) {
      console.log(`  💰 Example: ${currencies[0].code} - ${currencies[0].name}`);
    }

    // Test 2: Get Accounts
    console.log("\n📋 Test 2: GET /api/accounts");
    const accounts = await storage.getAccounts(tenantId);
    console.log(`  ✅ Found ${accounts.length} accounts`);
    if (accounts.length > 0) {
      accounts.slice(0, 3).forEach((acc: any) => {
        console.log(`  📊 ${acc.code} - ${acc.name} (${acc.type})`);
      });
    }

    // Test 3: Get Journals
    console.log("\n📋 Test 3: GET /api/journals");
    const journals = await storage.getJournals(tenantId);
    console.log(`  ✅ Found ${journals.length} journals`);
    if (journals.length > 0) {
      console.log(`  📖 Example: ${journals[0].code} - ${journals[0].name}`);
    }

    // Test 4: Get Journal Entries
    console.log("\n📋 Test 4: GET /api/journal-entries");
    const entries = await storage.getJournalEntries(tenantId);
    console.log(`  ✅ Found ${entries.length} journal entries`);
    if (entries.length > 0) {
      const entry = entries[0];
      console.log(`  📝 Example: ${entry.entryNumber} - ${entry.status} - ${entry.entryDate}`);
      
      // Get entry with lines
      const fullEntry = await storage.getJournalEntry(entry.id);
      if (fullEntry && fullEntry.lines) {
        console.log(`  📋 Lines: ${fullEntry.lines.length}`);
        fullEntry.lines.forEach((line: any) => {
          const dr = parseFloat(line.debit || 0);
          const cr = parseFloat(line.credit || 0);
          console.log(`    ${line.accountCode} - Dr: ${dr} / Cr: ${cr}`);
        });
      }
    }

    // Test 5: Create new journal entry
    console.log("\n📋 Test 5: POST /api/journal-entries");
    if (accounts.length >= 2) {
      const cashAccount = accounts.find((a: any) => a.code === "1000");
      const revenueAccount = accounts.find((a: any) => a.code === "4000");
      const journal = journals.find((j: any) => j.code === "SALES");

      if (cashAccount && revenueAccount && journal) {
        try {
          const testEntry = await storage.createJournalEntry(
            {
              tenantId,
              journalId: journal.id,
              entryNumber: `JE-${new Date().getFullYear()}-TEST-${Date.now()}`,
              entryDate: new Date().toISOString().split("T")[0],
              description: "API Test Entry",
              status: "draft",
            } as any,
            [
              {
                accountId: cashAccount.id,
                debit: "50000",
                credit: "0",
                description: "Cash received",
              },
              {
                accountId: revenueAccount.id,
                debit: "0",
                credit: "50000",
                description: "Revenue",
              },
            ] as any
          );

          console.log(`  ✅ Journal entry created: ${testEntry.entryNumber}`);
          console.log(`  📝 Entry ID: ${testEntry.id}`);

          // Test 6: Post journal entry
          console.log("\n📋 Test 6: PUT /api/journal-entries/:id/post");
          // Get a real user ID for posting
          const users = await (storage as any).getEmployees?.(tenantId) || [];
          const userId = users.length > 0 ? users[0].id : null;
          
          if (userId) {
            await storage.updateJournalEntryStatus(testEntry.id, "posted", userId);
            console.log(`  ✅ Journal entry posted`);
          } else {
            // Try without userId (should be optional)
            await storage.updateJournalEntryStatus(testEntry.id, "posted");
            console.log(`  ✅ Journal entry posted (without user)`);
          }

          // Verify it's posted
          const postedEntry = await storage.getJournalEntry(testEntry.id);
          if (postedEntry && postedEntry.status === "posted") {
            console.log(`  ✅ Status verified: ${postedEntry.status}`);
          }

        } catch (err: any) {
          if (err.message.includes("duplicate") || err.message.includes("already exists")) {
            console.log(`  ✅ Entry already exists (expected)`);
          } else {
            console.log(`  ⚠️  Error: ${err.message}`);
          }
        }
      }
    }

    // Test 7: Get Tax Codes
    console.log("\n📋 Test 7: GET /api/tax-codes");
    const taxCodes = await storage.getTaxCodes(tenantId);
    console.log(`  ✅ Found ${taxCodes.length} tax codes`);

    // Test 8: Get Payments
    console.log("\n📋 Test 8: GET /api/payments");
    const payments = await storage.getPayments(tenantId);
    console.log(`  ✅ Found ${payments.length} payments`);

    console.log("\n✅ All API endpoint tests completed!");

  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAPIEndpoints();
