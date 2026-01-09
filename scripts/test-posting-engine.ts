import "dotenv/config";
import { storage } from "../server/storage";

async function testPostingEngine() {
  console.log("🧪 Testing Posting Engine\n");

  try {
    const tenantId = "27f8e5ec-1819-4014-b637-fac2b561473d";

    // Test 1: Get test invoice
    console.log("📋 Test 1: Get test invoice...");
    const invoices = await storage.getInvoices(tenantId, "sales");
    
    if (invoices.length === 0) {
      console.log("  ⚠️  No invoices found. Creating test invoice...");
      
      // Get accounts and contacts for test invoice
      const accounts = await storage.getAccounts(tenantId);
      const contacts = await storage.getContacts(tenantId, "customer");
      
      if (accounts.length === 0 || contacts.length === 0) {
        console.log("  ❌ Need accounts and contacts to create test invoice");
        return;
      }

      // Create test invoice (this requires invoice creation API)
      console.log("  ℹ️  Please create an invoice first via API");
      return;
    }

    const testInvoice = invoices.find((inv: any) => inv.status === "draft");
    if (!testInvoice) {
      console.log("  ⚠️  No draft invoice found. Using first invoice...");
      console.log("  ✅ Found invoice:", testInvoice?.invoiceNumber || invoices[0]?.invoiceNumber);
    } else {
      console.log(`  ✅ Found draft invoice: ${testInvoice.invoiceNumber}`);
    }

    const invoiceToTest = testInvoice || invoices[0];
    if (!invoiceToTest) {
      console.log("  ❌ No invoice to test");
      return;
    }

    // Test 2: Preview posting
    console.log("\n📋 Test 2: Preview posting...");
    try {
      const preview = await storage.previewPosting("invoice", invoiceToTest.id);
      
      console.log(`  ✅ Preview generated`);
      console.log(`  📝 Description: ${preview.journalEntry.description}`);
      console.log(`  📅 Entry Date: ${preview.journalEntry.entryDate}`);
      console.log(`  📊 Lines: ${preview.journalEntry.lines.length}`);
      
      preview.journalEntry.lines.forEach((line: any) => {
        console.log(`    ${line.accountCode} - ${line.accountName}`);
        console.log(`      Dr: ${line.debit}, Cr: ${line.credit}`);
      });
      
      console.log(`  💰 Total Debit: ${preview.totalDebit}`);
      console.log(`  💰 Total Credit: ${preview.totalCredit}`);
      console.log(`  ⚖️  Balanced: ${preview.isBalanced ? "✅ Yes" : "❌ No"}`);
      
      if (preview.journalEntry.taxLines && preview.journalEntry.taxLines.length > 0) {
        console.log(`  📋 Tax Lines: ${preview.journalEntry.taxLines.length}`);
        preview.journalEntry.taxLines.forEach((tl: any) => {
          console.log(`    ${tl.taxCode}: Base ${tl.taxBase}, Tax ${tl.taxAmount}`);
        });
      }

      // Test 3: Post invoice
      if (preview.isBalanced && invoiceToTest.status !== "posted") {
        console.log("\n📋 Test 3: Post invoice...");
        try {
          const journalEntry = await storage.postDocument(
            "invoice",
            invoiceToTest.id,
            undefined,
            undefined,
            "test-user-id"
          );

          console.log(`  ✅ Invoice posted successfully!`);
          console.log(`  📝 Journal Entry: ${journalEntry.entryNumber}`);
          console.log(`  📅 Entry Date: ${journalEntry.entryDate}`);
          console.log(`  📊 Status: ${journalEntry.status}`);

          // Verify invoice status
          const postedInvoice = await storage.getInvoice(invoiceToTest.id);
          console.log(`  ✅ Invoice status: ${postedInvoice?.status}`);

        } catch (err: any) {
          console.log(`  ❌ Posting error: ${err.message}`);
        }
      } else {
        console.log("\n  ⚠️  Skipping post - invoice already posted or not balanced");
      }

    } catch (err: any) {
      console.log(`  ❌ Preview error: ${err.message}`);
      console.error(err);
    }

    // Test 4: Test payment posting
    console.log("\n📋 Test 4: Test payment posting...");
    const payments = await storage.getPayments(tenantId);
    
    if (payments.length === 0) {
      console.log("  ⚠️  No payments found. Skip payment posting test.");
    } else {
      const testPayment = payments.find((p: any) => p.status === "draft");
      if (testPayment) {
        try {
          const preview = await storage.previewPosting("payment", testPayment.id);
          console.log(`  ✅ Payment preview generated`);
          console.log(`  📊 Lines: ${preview.journalEntry.lines.length}`);
          console.log(`  ⚖️  Balanced: ${preview.isBalanced ? "✅ Yes" : "❌ No"}`);
        } catch (err: any) {
          console.log(`  ❌ Payment preview error: ${err.message}`);
        }
      }
    }

    console.log("\n✅ Posting engine tests completed!");

  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testPostingEngine();
