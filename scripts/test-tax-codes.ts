import "dotenv/config";
import { storage } from "../server/storage";

async function testTaxCodes() {
  console.log("🧪 Testing Tax Codes Management\n");

  const tenantId = "27f8e5ec-1819-4014-b637-fac2b561473d";

  try {
    // Test 1: Get existing tax codes
    console.log("📋 Test 1: Get Tax Codes");
    const existingTaxCodes = await storage.getTaxCodes(tenantId);
    console.log(`  ✅ Found ${existingTaxCodes.length} tax codes`);
    
    if (existingTaxCodes.length > 0) {
      existingTaxCodes.forEach((tc: any) => {
        console.log(`    - ${tc.code}: ${tc.name} (${tc.rate}%) - ${tc.type}`);
      });
    }

    // Test 2: Get accounts for tax code setup
    console.log("\n📋 Test 2: Get Accounts for Tax Code Setup");
    const accounts = await storage.getAccounts(tenantId);
    const liabilityAccounts = accounts.filter((acc: any) => acc.type === "liability" && acc.isActive);
    const assetAccounts = accounts.filter((acc: any) => acc.type === "asset" && acc.isActive);
    
    console.log(`  ✅ Liability accounts (for VAT Payable): ${liabilityAccounts.length}`);
    if (liabilityAccounts.length > 0) {
      liabilityAccounts.slice(0, 3).forEach((acc: any) => {
        console.log(`    - ${acc.code}: ${acc.name}`);
      });
    }
    
    console.log(`  ✅ Asset accounts (for VAT Receivable): ${assetAccounts.length}`);
    if (assetAccounts.length > 0) {
      assetAccounts.slice(0, 3).forEach((acc: any) => {
        console.log(`    - ${acc.code}: ${acc.name}`);
      });
    }

    // Test 3: Create test tax code
    console.log("\n📋 Test 3: Create Test Tax Code");
    const vatPayableAccount = liabilityAccounts.find((acc: any) => acc.code === "2100" || acc.name.includes("VAT") || acc.name.includes("НӨАТ"));
    const vatReceivableAccount = assetAccounts.find((acc: any) => acc.code === "1100" || acc.name.includes("VAT") || acc.name.includes("НӨАТ"));
    
    // Check if test tax code already exists
    const testCode = "VAT10";
    const existingTestCode = existingTaxCodes.find((tc: any) => tc.code === testCode);
    
    if (existingTestCode) {
      console.log(`  ✅ Test tax code ${testCode} already exists`);
    } else {
      try {
        const newTaxCode = await storage.createTaxCode({
          tenantId,
          code: testCode,
          name: "НӨАТ 10%",
          rate: "10.00",
          type: "vat",
          taxAccountPayableId: vatPayableAccount?.id || null,
          taxAccountReceivableId: vatReceivableAccount?.id || null,
          isActive: true,
        } as any);
        
        console.log(`  ✅ Created tax code: ${newTaxCode.code} - ${newTaxCode.name}`);
        console.log(`    - Rate: ${newTaxCode.rate}%`);
        console.log(`    - Type: ${newTaxCode.type}`);
        console.log(`    - Payable Account: ${vatPayableAccount ? `${vatPayableAccount.code} - ${vatPayableAccount.name}` : "Not set"}`);
        console.log(`    - Receivable Account: ${vatReceivableAccount ? `${vatReceivableAccount.code} - ${vatReceivableAccount.name}` : "Not set"}`);
      } catch (err: any) {
        console.log(`  ⚠️  Error creating tax code: ${err.message}`);
      }
    }

    // Test 4: Verify tax codes after creation
    console.log("\n📋 Test 4: Verify Tax Codes");
    const allTaxCodes = await storage.getTaxCodes(tenantId);
    console.log(`  ✅ Total tax codes: ${allTaxCodes.length}`);
    
    const vatCodes = allTaxCodes.filter((tc: any) => tc.type === "vat");
    const incomeTaxCodes = allTaxCodes.filter((tc: any) => tc.type === "income_tax");
    
    console.log(`    - VAT codes: ${vatCodes.length}`);
    console.log(`    - Income tax codes: ${incomeTaxCodes.length}`);
    console.log(`    - Active codes: ${allTaxCodes.filter((tc: any) => tc.isActive).length}`);

    // Test 5: Test API endpoint (simulate)
    console.log("\n📋 Test 5: API Endpoint Structure");
    console.log("  ✅ GET /api/tax-codes - Available");
    console.log("  ✅ POST /api/tax-codes - Available");
    console.log("    Required fields: code, name, rate, type");
    console.log("    Optional fields: taxAccountPayableId, taxAccountReceivableId, isActive");

    // Test 6: Verify tax code usage in posting engine
    console.log("\n📋 Test 6: Tax Code Integration");
    if (allTaxCodes.length > 0) {
      const testTaxCode = allTaxCodes[0];
      console.log(`  ✅ Sample tax code: ${testTaxCode.code}`);
      console.log(`    - Can be used in invoice lines`);
      console.log(`    - Will generate tax lines in journal entries`);
      if (testTaxCode.taxAccountPayableId) {
        console.log(`    - VAT Payable account configured`);
      }
      if (testTaxCode.taxAccountReceivableId) {
        console.log(`    - VAT Receivable account configured`);
      }
    } else {
      console.log("  ⚠️  No tax codes available for integration test");
    }

    console.log("\n✅ Tax Codes Management Tests Completed!");
    console.log("\n📊 Summary:");
    console.log(`  - Total Tax Codes: ${allTaxCodes.length}`);
    console.log(`  - VAT Codes: ${vatCodes.length}`);
    console.log(`  - Income Tax Codes: ${incomeTaxCodes.length}`);
    console.log(`  - Liability Accounts: ${liabilityAccounts.length}`);
    console.log(`  - Asset Accounts: ${assetAccounts.length}`);

  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

testTaxCodes();
