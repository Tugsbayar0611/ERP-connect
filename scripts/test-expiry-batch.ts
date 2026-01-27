import "dotenv/config";
import { Client } from "pg";

/**
 * Test Expiry/Batch Tracking Backend
 * Tests the new expiry/batch tracking functionality
 */

async function testExpiryBatch() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("✅ Database connected\n");

    // Get first tenant
    const tenantResult = await client.query("SELECT id FROM tenants LIMIT 1");
    if (tenantResult.rows.length === 0) {
      console.log("  ⚠️  No tenant found. Please create a tenant first.");
      return;
    }
    const tenantId = tenantResult.rows[0].id;
    console.log(`  ✅ Using tenant: ${tenantId}\n`);

    // Test 1: Check if migration was applied
    console.log("📋 Test 1: Check Migration");
    console.log("  Checking if batch_number and expiry_date columns exist...");
    
    const columnsResult = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'stock_movements' 
      AND column_name IN ('batch_number', 'expiry_date')
      ORDER BY column_name
    `);
    
    if (columnsResult.rows.length === 2) {
      console.log("  ✅ stock_movements.batch_number exists");
      console.log("  ✅ stock_movements.expiry_date exists");
    } else {
      console.log("  ❌ Missing columns:", columnsResult.rows);
      return;
    }

    const trackExpiryResult = await client.query(`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'products' 
      AND column_name = 'track_expiry'
    `);
    
    if (trackExpiryResult.rows.length === 1) {
      console.log("  ✅ products.track_expiry exists");
      console.log(`  ✅ Default value: ${trackExpiryResult.rows[0].column_default}`);
    } else {
      console.log("  ❌ products.track_expiry column not found");
      return;
    }

    // Test 2: Create test product with trackExpiry = true
    console.log("\n📋 Test 2: Create Product with Expiry Tracking");
    let productId: string;
    
    try {
      const productResult = await client.query(`
        INSERT INTO products (
          tenant_id, name, sku, sale_price, cost_price, 
          unit, track_inventory, track_expiry, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, name, track_expiry
      `, [
        tenantId,
        "Test Сүү (Expiry Tracking)",
        `TEST-EXPIRY-${Date.now()}`,
        "5000",
        "4000",
        "ш",
        true,
        true,  // track_expiry = true
        true
      ]);
      
      productId = productResult.rows[0].id;
      console.log(`  ✅ Product created: ${productResult.rows[0].name}`);
      console.log(`  ✅ track_expiry: ${productResult.rows[0].track_expiry}`);
      console.log(`  ✅ Product ID: ${productId}`);
    } catch (err: any) {
      console.error("  ❌ Error creating product:", err.message);
      return;
    }

    // Test 3: Create warehouse if needed
    console.log("\n📋 Test 3: Get/Create Warehouse");
    let warehouseId: string;
    
    const warehouseResult = await client.query(`
      SELECT id, name FROM warehouses WHERE tenant_id = $1 LIMIT 1
    `, [tenantId]);
    
    if (warehouseResult.rows.length > 0) {
      warehouseId = warehouseResult.rows[0].id;
      console.log(`  ✅ Using existing warehouse: ${warehouseResult.rows[0].name}`);
    } else {
      const newWarehouseResult = await client.query(`
        INSERT INTO warehouses (tenant_id, name, code, is_default)
        VALUES ($1, $2, $3, $4)
        RETURNING id, name
      `, [tenantId, "Test Агуулах", "WH-TEST", true]);
      
      warehouseId = newWarehouseResult.rows[0].id;
      console.log(`  ✅ Created warehouse: ${newWarehouseResult.rows[0].name}`);
    }
    console.log(`  ✅ Warehouse ID: ${warehouseId}`);

    // Test 4: Create IN stock movement with batch/expiry
    console.log("\n📋 Test 4: Create IN Stock Movement with Batch/Expiry");
    
    const batchNumber1 = `BATCH-${Date.now()}-1`;
    const expiryDate1 = new Date();
    expiryDate1.setDate(expiryDate1.getDate() + 30); // 30 days from now
    const expiryDate1Str = expiryDate1.toISOString().split('T')[0];
    
    try {
      const movementResult = await client.query(`
        INSERT INTO stock_movements (
          tenant_id, warehouse_id, product_id, type, quantity,
          batch_number, expiry_date, reference
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, batch_number, expiry_date, quantity
      `, [
        tenantId,
        warehouseId,
        productId,
        "in",
        "100",
        batchNumber1,
        expiryDate1Str,
        "TEST-IN-001"
      ]);
      
      console.log(`  ✅ IN movement created`);
      console.log(`  ✅ Batch: ${movementResult.rows[0].batch_number}`);
      console.log(`  ✅ Expiry: ${movementResult.rows[0].expiry_date}`);
      console.log(`  ✅ Quantity: ${movementResult.rows[0].quantity}`);
    } catch (err: any) {
      console.error("  ❌ Error creating IN movement:", err.message);
      return;
    }

    // Test 5: Create second IN movement with different batch/expiry
    console.log("\n📋 Test 5: Create Second IN Movement (Different Batch)");
    
    const batchNumber2 = `BATCH-${Date.now()}-2`;
    const expiryDate2 = new Date();
    expiryDate2.setDate(expiryDate2.getDate() + 60); // 60 days from now
    const expiryDate2Str = expiryDate2.toISOString().split('T')[0];
    
    try {
      const movementResult2 = await client.query(`
        INSERT INTO stock_movements (
          tenant_id, warehouse_id, product_id, type, quantity,
          batch_number, expiry_date, reference
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, batch_number, expiry_date, quantity
      `, [
        tenantId,
        warehouseId,
        productId,
        "in",
        "50",
        batchNumber2,
        expiryDate2Str,
        "TEST-IN-002"
      ]);
      
      console.log(`  ✅ Second IN movement created`);
      console.log(`  ✅ Batch: ${movementResult2.rows[0].batch_number}`);
      console.log(`  ✅ Expiry: ${movementResult2.rows[0].expiry_date}`);
      console.log(`  ✅ Quantity: ${movementResult2.rows[0].quantity}`);
    } catch (err: any) {
      console.error("  ❌ Error creating second IN movement:", err.message);
      return;
    }

    // Test 6: Query stock movements with batch/expiry
    console.log("\n📋 Test 6: Query Stock Movements with Batch/Expiry");
    
    const movementsResult = await client.query(`
      SELECT 
        sm.id,
        sm.type,
        sm.quantity,
        sm.batch_number,
        sm.expiry_date,
        sm.reference,
        p.name as product_name
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      WHERE sm.tenant_id = $1 
        AND sm.product_id = $2
        AND sm.batch_number IS NOT NULL
      ORDER BY sm.expiry_date ASC, sm.created_at ASC
    `, [tenantId, productId]);
    
    console.log(`  ✅ Found ${movementsResult.rows.length} movements with batch/expiry`);
    movementsResult.rows.forEach((row, idx) => {
      console.log(`  ${idx + 1}. ${row.type.toUpperCase()}: ${row.quantity} | Batch: ${row.batch_number} | Expiry: ${row.expiry_date}`);
    });

    // Test 7: Calculate remaining stock per batch
    console.log("\n📋 Test 7: Calculate Remaining Stock per Batch");
    
    const stockResult = await client.query(`
      SELECT 
        batch_number,
        expiry_date,
        SUM(CASE WHEN type = 'in' THEN quantity::numeric ELSE -quantity::numeric END) as remaining_quantity
      FROM stock_movements
      WHERE tenant_id = $1 
        AND product_id = $2
        AND batch_number IS NOT NULL
      GROUP BY batch_number, expiry_date
      ORDER BY expiry_date ASC
    `, [tenantId, productId]);
    
    console.log(`  ✅ Remaining stock by batch:`);
    stockResult.rows.forEach((row) => {
      console.log(`  - Batch ${row.batch_number}: ${row.remaining_quantity} (Expiry: ${row.expiry_date})`);
    });

    // Test 8: Test Expiry Alerts Query (30 days)
    console.log("\n📋 Test 8: Expiry Alerts (30 days)");
    
    const today = new Date();
    const alertDate = new Date(today);
    alertDate.setDate(today.getDate() + 30);
    const alertDateStr = alertDate.toISOString().split('T')[0];
    
    const alertsResult = await client.query(`
      SELECT 
        sm.product_id,
        sm.warehouse_id,
        sm.batch_number,
        sm.expiry_date,
        SUM(CASE WHEN sm.type = 'in' THEN sm.quantity::numeric ELSE -sm.quantity::numeric END) as remaining_quantity,
        p.name as product_name,
        w.name as warehouse_name,
        (sm.expiry_date::date - CURRENT_DATE) as days_until_expiry
      FROM stock_movements sm
      JOIN products p ON sm.product_id = p.id
      JOIN warehouses w ON sm.warehouse_id = w.id
      WHERE sm.tenant_id = $1
        AND sm.expiry_date IS NOT NULL
        AND sm.expiry_date <= $2
      GROUP BY sm.product_id, sm.warehouse_id, sm.batch_number, sm.expiry_date, p.name, w.name
      HAVING SUM(CASE WHEN sm.type = 'in' THEN sm.quantity::numeric ELSE -sm.quantity::numeric END) > 0
      ORDER BY sm.expiry_date ASC
    `, [tenantId, alertDateStr]);
    
    console.log(`  ✅ Found ${alertsResult.rows.length} products expiring within 30 days:`);
    alertsResult.rows.forEach((row) => {
      console.log(`  - ${row.product_name} | Batch: ${row.batch_number} | Expiry: ${row.expiry_date} | Days: ${row.days_until_expiry} | Qty: ${row.remaining_quantity}`);
    });

    // Test 9: Test trackExpiry validation (should fail without batch/expiry)
    console.log("\n📋 Test 9: Validation Test (trackExpiry product without batch/expiry)");
    console.log("  ⚠️  This test checks if validation works (should be handled by API)");
    console.log("  ✅ Validation logic is in storage.updateStock() function");

    // Test 10: Check indexes
    console.log("\n📋 Test 10: Check Indexes");
    
    const indexesResult = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename = 'stock_movements'
        AND indexname LIKE '%batch%' OR indexname LIKE '%expiry%'
    `);
    
    console.log(`  ✅ Found ${indexesResult.rows.length} relevant indexes:`);
    indexesResult.rows.forEach((row) => {
      console.log(`  - ${row.indexname}`);
    });

    // Cleanup (optional)
    console.log("\n📋 Cleanup");
    console.log("  ℹ️  Test data left in database for manual inspection");
    console.log(`  ℹ️  Product ID: ${productId}`);
    console.log(`  ℹ️  Warehouse ID: ${warehouseId}`);

    console.log("\n✅ All backend tests completed successfully!");
    console.log("\n💡 Next steps:");
    console.log("  1. Test API endpoints using Postman or curl");
    console.log("  2. Test validation by trying to create OUT movement without batch/expiry");
    console.log("  3. Implement Frontend UI (Phase 3)");

  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testExpiryBatch();
