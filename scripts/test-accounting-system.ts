import "dotenv/config";
import { storage } from "../server/storage";

async function testAccountingSystem() {
  console.log("🧪 Testing Complete Accounting System\n");

  const tenantId = "27f8e5ec-1819-4014-b637-fac2b561473d";

  try {
    // Test 1: Currencies
    console.log("📋 Test 1: Currencies");
    const currencies = await storage.getCurrencies(tenantId);
    console.log(`  ✅ Found ${currencies.length} currencies`);
    if (currencies.length === 0) {
      console.log("  ⚠️  No currencies found. Creating MNT...");
      await storage.createCurrency({
        tenantId,
        code: "MNT",
        name: "Mонгол төгрөг",
        symbol: "₮",
        rate: "1.0000",
        isBase: true,
        isActive: true,
      } as any);
      console.log("  ✅ MNT currency created");
    }

    // Test 2: Accounts
    console.log("\n📋 Test 2: Chart of Accounts");
    const accounts = await storage.getAccounts(tenantId);
    console.log(`  ✅ Found ${accounts.length} accounts`);
    
    // Verify required accounts exist
    const requiredAccounts = [
      { code: "1000", name: "Бэлэн мөнгө", type: "asset" },
      { code: "1100", name: "Авлага", type: "asset" },
      { code: "2100", name: "Өглөг", type: "liability" },
      { code: "4000", name: "Орлого", type: "income" },
      { code: "5000", name: "Зарлага", type: "expense" },
    ];

    for (const reqAcc of requiredAccounts) {
      const exists = accounts.find((a: any) => a.code === reqAcc.code);
      if (!exists) {
        console.log(`  ⚠️  Missing account: ${reqAcc.code} - ${reqAcc.name}`);
      } else {
        console.log(`  ✅ Account ${reqAcc.code} exists`);
      }
    }

    // Test 3: Journals
    console.log("\n📋 Test 3: Journals");
    const journals = await storage.getJournals(tenantId);
    console.log(`  ✅ Found ${journals.length} journals`);
    
    const requiredJournals = ["sales", "purchase", "bank", "general"];
    for (const journalType of requiredJournals) {
      const exists = journals.find((j: any) => j.type === journalType);
      if (!exists) {
        console.log(`  ⚠️  Missing journal type: ${journalType}`);
      } else {
        console.log(`  ✅ Journal type ${journalType} exists`);
      }
    }

    // Test 4: Journal Entries
    console.log("\n📋 Test 4: Journal Entries");
    const entries = await storage.getJournalEntries(tenantId);
    console.log(`  ✅ Found ${entries.length} journal entries`);
    
    const postedEntries = entries.filter((e: any) => e.status === "posted");
    console.log(`  📊 Posted entries: ${postedEntries.length}`);
    const draftEntries = entries.filter((e: any) => e.status === "draft");
    console.log(`  📝 Draft entries: ${draftEntries.length}`);

    // Test 5: Posting Engine - Preview
    console.log("\n📋 Test 5: Posting Engine");
    const invoices = await storage.getInvoices(tenantId, "sales");
    const draftInvoice = invoices.find((inv: any) => inv.status === "draft");
    
    if (draftInvoice) {
      console.log(`  ✅ Found draft invoice: ${draftInvoice.invoiceNumber}`);
      try {
        const preview = await storage.previewPosting("invoice", draftInvoice.id);
        console.log(`  ✅ Preview generated successfully`);
        console.log(`    - Lines: ${preview.journalEntry.lines.length}`);
        console.log(`    - Total Debit: ${preview.totalDebit}`);
        console.log(`    - Total Credit: ${preview.totalCredit}`);
        console.log(`    - Balanced: ${preview.isBalanced ? "✅ Yes" : "❌ No"}`);
      } catch (err: any) {
        console.log(`  ⚠️  Preview error: ${err.message}`);
      }
    } else {
      console.log("  ⚠️  No draft invoice found for posting test");
    }

    // Test 6: Reports
    console.log("\n📋 Test 6: Financial Reports");
    
    // Trial Balance
    try {
      const trialBalance = await storage.getTrialBalance(tenantId, undefined, new Date().toISOString().split("T")[0]);
      console.log(`  ✅ Trial Balance generated`);
      console.log(`    - Accounts: ${trialBalance.lines.length}`);
      console.log(`    - Total Debit: ${trialBalance.totalDebit}`);
      console.log(`    - Total Credit: ${trialBalance.totalCredit}`);
      console.log(`    - Balanced: ${trialBalance.isBalanced ? "✅ Yes" : "❌ No"}`);
    } catch (err: any) {
      console.log(`  ⚠️  Trial Balance error: ${err.message}`);
    }

    // Balance Sheet
    try {
      const balanceSheet = await storage.getBalanceSheet(tenantId, new Date().toISOString().split("T")[0]);
      console.log(`  ✅ Balance Sheet generated`);
      console.log(`    - Assets: ${balanceSheet.assets.length} accounts`);
      console.log(`    - Liabilities: ${balanceSheet.liabilities.length} accounts`);
      console.log(`    - Equity: ${balanceSheet.equity.length} accounts`);
      console.log(`    - Total Assets: ${balanceSheet.totalAssets}`);
      console.log(`    - Total Liabilities + Equity: ${balanceSheet.totalLiabilitiesAndEquity}`);
      console.log(`    - Balanced: ${balanceSheet.isBalanced ? "✅ Yes" : "❌ No"}`);
    } catch (err: any) {
      console.log(`  ⚠️  Balance Sheet error: ${err.message}`);
    }

    // Profit & Loss
    try {
      const startDate = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
      const endDate = new Date().toISOString().split("T")[0];
      const pl = await storage.getProfitAndLoss(tenantId, startDate, endDate);
      console.log(`  ✅ Profit & Loss generated`);
      console.log(`    - Income accounts: ${pl.income.length}`);
      console.log(`    - Expense accounts: ${pl.expenses.length}`);
      console.log(`    - Total Income: ${pl.totalIncome}`);
      console.log(`    - Total Expenses: ${pl.totalExpenses}`);
      console.log(`    - Net Profit: ${pl.netProfit} ${pl.netProfit >= 0 ? "✅" : "❌"}`);
    } catch (err: any) {
      console.log(`  ⚠️  P&L error: ${err.message}`);
    }

    // Test 7: Numbering Sequences
    console.log("\n📋 Test 7: Numbering Sequences");
    try {
      const { getNextInvoiceNumber, getNextJournalEntryNumber } = await import("../server/numbering");
      const invoiceNum = await getNextInvoiceNumber(tenantId, null, new Date().getFullYear());
      console.log(`  ✅ Next Invoice Number: ${invoiceNum}`);
      
      const entryNum = await getNextJournalEntryNumber(tenantId, null, new Date().getFullYear());
      console.log(`  ✅ Next Journal Entry Number: ${entryNum}`);
    } catch (err: any) {
      console.log(`  ⚠️  Numbering error: ${err.message}`);
    }

    console.log("\n✅ Accounting System Tests Completed!");
    console.log("\n📊 Summary:");
    console.log(`  - Currencies: ${currencies.length || 1}`);
    console.log(`  - Accounts: ${accounts.length}`);
    console.log(`  - Journals: ${journals.length}`);
    console.log(`  - Journal Entries: ${entries.length} (${postedEntries.length} posted)`);
    console.log(`  - Invoices: ${invoices.length}`);

  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testAccountingSystem();
