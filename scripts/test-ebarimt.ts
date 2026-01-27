/**
 * Test E-barimt Integration
 * 
 * Tests E-barimt sending, verification, and auto-send functionality
 */

import "dotenv/config";
import { storage } from "../server/storage";
import { createEBarimtService } from "../server/ebarimt-service";

async function testEBarimt() {
  console.log("🧪 Testing E-barimt Integration\n");

  try {
    const tenantId = "27f8e5ec-1819-4014-b637-fac2b561473d";

    // Test 1: Check E-barimt settings
    console.log("📋 Test 1: Check E-barimt settings...");
    const settings = await storage.getEBarimtSettings(tenantId);
    
    if (!settings) {
      console.log("  ⚠️  E-barimt settings not found. Please configure in Settings.");
      console.log("  💡 Go to Settings → E-barimt tab and enable it.");
      return;
    }

    console.log(`  ✅ Settings found:`);
    console.log(`     - Enabled: ${settings.enabled}`);
    console.log(`     - Mode: ${settings.mode}`);
    console.log(`     - Auto-send: ${settings.autoSend}`);
    console.log(`     - POS Endpoint: ${settings.posEndpoint || "Not set"}`);

    if (!settings.enabled) {
      console.log("  ⚠️  E-barimt is not enabled. Please enable it in Settings.");
      return;
    }

    // Test 2: Create E-barimt service
    console.log("\n📋 Test 2: Create E-barimt service...");
    const ebarimtService = await createEBarimtService(tenantId, storage);
    
    if (!ebarimtService) {
      console.log("  ❌ Failed to create E-barimt service");
      return;
    }

    if (!ebarimtService.isConfigured()) {
      console.log("  ⚠️  E-barimt service is not configured properly");
      console.log("  💡 Check pos_endpoint and api_key in Settings");
      return;
    }

    console.log("  ✅ E-barimt service created and configured");

    // Test 3: Get test invoice
    console.log("\n📋 Test 3: Get test invoice...");
    const invoices = await storage.getInvoices(tenantId, "sales");
    
    if (invoices.length === 0) {
      console.log("  ⚠️  No invoices found. Please create an invoice first.");
      return;
    }

    // Find invoice without E-barimt
    const testInvoice = invoices.find((inv: any) => !inv.ebarimtDocumentId);
    
    if (!testInvoice) {
      console.log("  ⚠️  All invoices already have E-barimt. Using first invoice for verification test...");
      const invoiceWithEbarimt = invoices[0];
      
      if (invoiceWithEbarimt.ebarimtDocumentId) {
        console.log(`  ✅ Found invoice with E-barimt: ${invoiceWithEbarimt.invoiceNumber}`);
        console.log(`     - Document ID: ${invoiceWithEbarimt.ebarimtDocumentId}`);
        console.log(`     - Receipt Number: ${invoiceWithEbarimt.ebarimtReceiptNumber || "N/A"}`);
        
        // Test 4: Verify invoice
        console.log("\n📋 Test 4: Verify E-barimt invoice...");
        try {
          const verifyResult = await ebarimtService.verifyInvoice(invoiceWithEbarimt.ebarimtDocumentId);
          if (verifyResult.success) {
            console.log("  ✅ Verification successful");
            console.log(`     - Document ID: ${verifyResult.documentId}`);
          } else {
            console.log(`  ⚠️  Verification failed: ${verifyResult.error}`);
          }
        } catch (err: any) {
          console.log(`  ⚠️  Verification error: ${err.message}`);
        }
      }
      return;
    }

    console.log(`  ✅ Found test invoice: ${testInvoice.invoiceNumber}`);
    console.log(`     - Status: ${testInvoice.status}`);
    console.log(`     - Total: ${testInvoice.totalAmount}₮`);

    // Test 4: Prepare invoice data
    console.log("\n📋 Test 4: Prepare invoice data for E-barimt...");
    try {
      const invoiceData = await ebarimtService.prepareInvoiceData(testInvoice.id, tenantId);
      
      console.log("  ✅ Invoice data prepared:");
      console.log(`     - Document Type: ${invoiceData.documentType}`);
      console.log(`     - Document Number: ${invoiceData.documentNumber}`);
      console.log(`     - Seller: ${invoiceData.seller.name} (TIN: ${invoiceData.seller.tin})`);
      console.log(`     - Buyer: ${invoiceData.buyer.name}`);
      console.log(`     - Items: ${invoiceData.items.length}`);
      console.log(`     - Total Amount: ${invoiceData.totals.totalAmount}₮`);

      // Test 5: Send invoice to E-barimt
      console.log("\n📋 Test 5: Send invoice to E-barimt...");
      const sendResult = await ebarimtService.sendInvoice(invoiceData);

      if (sendResult.success) {
        console.log("  ✅ Invoice sent successfully!");
        console.log(`     - Document ID: ${sendResult.documentId}`);
        console.log(`     - Receipt Number: ${sendResult.receiptNumber || "N/A"}`);
        console.log(`     - QR Code: ${sendResult.qrCode ? "Generated" : "Not provided"}`);

        // Update invoice in database
        await storage.updateInvoiceEBarimt(
          testInvoice.id,
          sendResult.documentId || "",
          sendResult.qrCode,
          sendResult.receiptNumber
        );
        console.log("  ✅ Invoice updated in database");

        // Test 6: Verify invoice
        if (sendResult.documentId) {
          console.log("\n📋 Test 6: Verify E-barimt invoice...");
          try {
            const verifyResult = await ebarimtService.verifyInvoice(sendResult.documentId);
            if (verifyResult.success) {
              console.log("  ✅ Verification successful");
            } else {
              console.log(`  ⚠️  Verification failed: ${verifyResult.error}`);
            }
          } catch (err: any) {
            console.log(`  ⚠️  Verification error: ${err.message}`);
          }
        }
      } else {
        console.log(`  ❌ Failed to send invoice: ${sendResult.error}`);
        if (sendResult.errorCode) {
          console.log(`     - Error Code: ${sendResult.errorCode}`);
        }
      }
    } catch (err: any) {
      console.log(`  ❌ Error: ${err.message}`);
      console.error(err);
    }

    // Test 7: Test auto-send (if enabled)
    if (settings.autoSend) {
      console.log("\n📋 Test 7: Auto-send functionality...");
      console.log("  ℹ️  Auto-send is enabled. When invoice status changes to 'paid',");
      console.log("      it will automatically send to E-barimt.");
      console.log("  💡 To test: Update an invoice status to 'paid' via API or UI");
    } else {
      console.log("\n📋 Test 7: Auto-send functionality...");
      console.log("  ℹ️  Auto-send is disabled. Enable it in Settings to test.");
    }

    console.log("\n✅ E-barimt integration test completed!");

  } catch (error: any) {
    console.error("❌ Test failed:", error);
    process.exit(1);
  }
}

testEBarimt();
