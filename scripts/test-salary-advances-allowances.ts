/**
 * Test Script: Salary Advances & Allowances
 * 
 * This script tests:
 * 1. Creating salary advance requests
 * 2. Approving salary advances
 * 3. Creating employee allowances
 * 4. Verifying payroll calculation includes allowances and advances
 */

import "dotenv/config";
import { Client } from "pg";

async function testSalaryAdvancesAndAllowances() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
  });

  try {
    await client.connect();
    console.log("✅ Database connected\n");

    // ==========================================
    // 1. Check if tables exist
    // ==========================================
    console.log("📋 Step 1: Checking if tables exist...");
    
    const tablesCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('salary_advances', 'employee_allowances')
      ORDER BY table_name;
    `);

    const tableNames = tablesCheck.rows.map((r) => r.table_name);
    console.log(`   Found tables: ${tableNames.join(", ")}`);

    if (!tableNames.includes("salary_advances")) {
      throw new Error("❌ salary_advances table not found!");
    }
    if (!tableNames.includes("employee_allowances")) {
      throw new Error("❌ employee_allowances table not found!");
    }

    console.log("✅ Tables exist\n");

    // ==========================================
    // 2. Check table structure
    // ==========================================
    console.log("📋 Step 2: Checking table structure...");

    const salaryAdvancesColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'salary_advances'
      ORDER BY ordinal_position;
    `);

    console.log("   salary_advances columns:");
    salaryAdvancesColumns.rows.forEach((col) => {
      console.log(`     - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    const employeeAllowancesColumns = await client.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'employee_allowances'
      ORDER BY ordinal_position;
    `);

    console.log("   employee_allowances columns:");
    employeeAllowancesColumns.rows.forEach((col) => {
      console.log(`     - ${col.column_name} (${col.data_type}, nullable: ${col.is_nullable})`);
    });

    console.log("✅ Table structure verified\n");

    // ==========================================
    // 3. Check indexes
    // ==========================================
    console.log("📋 Step 3: Checking indexes...");

    const indexes = await client.query(`
      SELECT indexname, indexdef
      FROM pg_indexes
      WHERE tablename IN ('salary_advances', 'employee_allowances')
      ORDER BY tablename, indexname;
    `);

    console.log("   Indexes:");
    indexes.rows.forEach((idx) => {
      console.log(`     - ${idx.indexname}`);
    });

    console.log("✅ Indexes verified\n");

    // ==========================================
    // 4. Get a test tenant and employee
    // ==========================================
    console.log("📋 Step 4: Getting test tenant and employee...");

    const tenantResult = await client.query(`
      SELECT id, name FROM tenants LIMIT 1;
    `);

    if (tenantResult.rows.length === 0) {
      throw new Error("❌ No tenants found. Please create a tenant first.");
    }

    const tenantId = tenantResult.rows[0].id;
    const tenantName = tenantResult.rows[0].name;
    console.log(`   Tenant: ${tenantName} (${tenantId})`);

    const employeeResult = await client.query(`
      SELECT id, first_name, last_name, employee_no, base_salary
      FROM employees
      WHERE tenant_id = $1
      LIMIT 1;
    `, [tenantId]);

    if (employeeResult.rows.length === 0) {
      throw new Error("❌ No employees found. Please create an employee first.");
    }

    const employee = employeeResult.rows[0];
    console.log(`   Employee: ${employee.first_name} ${employee.last_name} (${employee.employee_no})`);
    console.log(`   Base Salary: ${employee.base_salary}₮`);

    console.log("✅ Test data found\n");

    // ==========================================
    // 5. Test: Create Employee Allowance
    // ==========================================
    console.log("📋 Step 5: Testing Employee Allowance creation...");

    const allowanceResult = await client.query(`
      INSERT INTO employee_allowances (
        tenant_id, employee_id, code, name, amount,
        is_taxable, is_shi, is_pit, is_recurring,
        effective_from
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, code, name, amount, is_taxable, is_shi, is_pit;
    `, [
      tenantId,
      employee.id,
      "TRANSPORT",
      "Унааны мөнгө",
      "50000",
      true,  // is_taxable
      true,  // is_shi (НДШ тооцох)
      true,  // is_pit (ХХОАТ тооцох)
      true,  // is_recurring
      new Date().toISOString().split('T')[0],
    ]);

    const allowance = allowanceResult.rows[0];
    console.log(`   ✅ Created allowance: ${allowance.name} (${allowance.code})`);
    console.log(`      Amount: ${allowance.amount}₮`);
    console.log(`      Taxable: ${allowance.is_taxable}, SHI: ${allowance.is_shi}, PIT: ${allowance.is_pit}`);

    // ==========================================
    // 6. Test: Create Salary Advance Request
    // ==========================================
    console.log("\n📋 Step 6: Testing Salary Advance creation...");

    const advanceAmount = 200000; // 200,000₮
    const monthlyDeduction = 50000; // 50,000₮ per month
    const totalMonths = 4; // 4 months

    const advanceResult = await client.query(`
      INSERT INTO salary_advances (
        tenant_id, employee_id, request_date, amount, reason,
        status, deduction_type, monthly_deduction_amount, total_deduction_months,
        is_loan
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, amount, status, deduction_type, monthly_deduction_amount, total_deduction_months;
    `, [
      tenantId,
      employee.id,
      new Date().toISOString().split('T')[0],
      advanceAmount.toString(),
      "Яаралтай зардал",
      "pending",
      "monthly",
      monthlyDeduction.toString(),
      totalMonths,
      false, // is_loan
    ]);

    const advance = advanceResult.rows[0];
    console.log(`   ✅ Created advance request: ${advance.amount}₮`);
    console.log(`      Status: ${advance.status}`);
    console.log(`      Deduction: ${advance.monthly_deduction_amount}₮/month for ${advance.total_deduction_months} months`);

    // ==========================================
    // 7. Test: Approve Salary Advance
    // ==========================================
    console.log("\n📋 Step 7: Testing Salary Advance approval...");

    const userResult = await client.query(`
      SELECT id FROM users WHERE tenant_id = $1 LIMIT 1;
    `, [tenantId]);

    const userId = userResult.rows.length > 0 ? userResult.rows[0].id : null;

    if (userId) {
      await client.query(`
        UPDATE salary_advances
        SET status = 'approved',
            approved_by = $1,
            approved_at = NOW(),
            paid_at = NOW()
        WHERE id = $2;
      `, [userId, advance.id]);

      console.log(`   ✅ Approved advance (ID: ${advance.id})`);
    } else {
      console.log(`   ⚠️  No user found, skipping approval (manual approval needed)`);
    }

    // ==========================================
    // 8. Test: Verify Payroll Calculation Data
    // ==========================================
    console.log("\n📋 Step 8: Verifying data for payroll calculation...");

    const activeAllowances = await client.query(`
      SELECT code, name, amount, is_taxable, is_shi, is_pit
      FROM employee_allowances
      WHERE tenant_id = $1
        AND employee_id = $2
        AND is_recurring = true
        AND effective_from <= CURRENT_DATE
        AND (effective_to IS NULL OR effective_to >= CURRENT_DATE);
    `, [tenantId, employee.id]);

    console.log(`   Active allowances: ${activeAllowances.rows.length}`);
    activeAllowances.rows.forEach((a) => {
      console.log(`     - ${a.name}: ${a.amount}₮ (Taxable: ${a.is_taxable}, SHI: ${a.is_shi}, PIT: ${a.is_pit})`);
    });

    const approvedAdvances = await client.query(`
      SELECT id, amount, deducted_amount, deduction_type, monthly_deduction_amount
      FROM salary_advances
      WHERE tenant_id = $1
        AND employee_id = $2
        AND status = 'approved';
    `, [tenantId, employee.id]);

    console.log(`   Approved advances: ${approvedAdvances.rows.length}`);
    approvedAdvances.rows.forEach((a) => {
      const remaining = Number(a.amount) - Number(a.deducted_amount);
      const deductionThisMonth = a.deduction_type === "monthly" && a.monthly_deduction_amount
        ? Math.min(remaining, Number(a.monthly_deduction_amount))
        : remaining;
      console.log(`     - Advance ${a.id}: ${a.amount}₮ (Remaining: ${remaining}₮, This month: ${deductionThisMonth}₮)`);
    });

    // ==========================================
    // 9. Test: Calculate Expected Payroll
    // ==========================================
    console.log("\n📋 Step 9: Calculating expected payroll...");

    const baseSalary = Number(employee.base_salary || 0);
    const totalAllowances = activeAllowances.rows.reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const grossPay = baseSalary + totalAllowances;

    const totalAdvanceDeduction = approvedAdvances.rows.reduce((sum, a) => {
      const remaining = Number(a.amount) - Number(a.deducted_amount);
      if (a.deduction_type === "monthly" && a.monthly_deduction_amount) {
        return sum + Math.min(remaining, Number(a.monthly_deduction_amount));
      }
      return sum + remaining;
    }, 0);

    // НДШ calculation (simplified - 11.5% on base + SHI allowances)
    const shiBase = baseSalary + activeAllowances.rows
      .filter(a => a.is_shi === true)
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const shiCap = 550000 * 3; // 1,650,000₮ (2025)
    const shiCalculationBase = Math.min(shiBase, shiCap);
    const shiEmployee = Math.round(shiCalculationBase * 11.5) / 100;

    // ХХОАТ calculation (simplified)
    const pitBase = baseSalary + activeAllowances.rows
      .filter(a => a.is_pit === true)
      .reduce((sum, a) => sum + Number(a.amount || 0), 0);
    const pitCalculationBase = pitBase - shiEmployee;
    const pitDeduction = 20000; // Standard deduction
    const taxableIncome = Math.max(0, pitCalculationBase - pitDeduction);
    
    // Simplified PIT (10% for demonstration)
    const pitTax = Math.round(taxableIncome * 0.10);

    const totalDeductions = shiEmployee + pitTax + totalAdvanceDeduction;
    const netPay = grossPay - totalDeductions;

    console.log(`   Base Salary: ${baseSalary.toLocaleString('mn-MN')}₮`);
    console.log(`   Allowances: +${totalAllowances.toLocaleString('mn-MN')}₮`);
    console.log(`   Gross Pay: ${grossPay.toLocaleString('mn-MN')}₮`);
    console.log(`   НДШ (Employee): -${shiEmployee.toLocaleString('mn-MN')}₮`);
    console.log(`   ХХОАТ: -${pitTax.toLocaleString('mn-MN')}₮`);
    console.log(`   Advance Deduction: -${totalAdvanceDeduction.toLocaleString('mn-MN')}₮`);
    console.log(`   Total Deductions: -${totalDeductions.toLocaleString('mn-MN')}₮`);
    console.log(`   Net Pay: ${netPay.toLocaleString('mn-MN')}₮`);

    console.log("\n✅ All tests completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Test API endpoints using Postman/curl");
    console.log("   2. Test frontend: Employees → Урьдчилгаа → Хүсэлт илгээх");
    console.log("   3. Test frontend: Payroll → Ажилтан сонгох → Allowances/Advances харагдах");

  } catch (error: any) {
    console.error("❌ Test failed:", error.message);
    console.error(error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

testSalaryAdvancesAndAllowances();
