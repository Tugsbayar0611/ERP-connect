/**
 * API Test Script: Salary Advances & Allowances Endpoints
 * 
 * Tests the actual API endpoints:
 * 1. GET /api/employee-allowances
 * 2. POST /api/employee-allowances
 * 3. GET /api/salary-advances
 * 4. POST /api/salary-advances
 * 5. POST /api/salary-advances/:id/approve
 * 
 * Note: This requires a running server and authentication
 */

import "dotenv/config";

const API_BASE = process.env.API_BASE_URL || "http://localhost:5000";

// You'll need to get these from your actual login
const TEST_CREDENTIALS = {
  email: "admin@example.com", // Update with your test user
  password: "password123", // Update with your test password
};

let authToken: string | null = null;
let tenantId: string | null = null;
let employeeId: string | null = null;

async function login() {
  console.log("🔐 Step 1: Logging in...");
  
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(TEST_CREDENTIALS),
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(`Login failed: ${error.message || res.statusText}`);
  }

  const data = await res.json();
  authToken = data.token;
  tenantId = data.tenantId;
  
  console.log(`   ✅ Logged in as ${TEST_CREDENTIALS.email}`);
  console.log(`   Tenant ID: ${tenantId}\n`);
}

async function getEmployee() {
  console.log("👤 Step 2: Getting test employee...");
  
  const res = await fetch(`${API_BASE}/api/employees`, {
    headers: {
      "Authorization": `Bearer ${authToken}`,
      "Cookie": `token=${authToken}`, // Some setups use cookies
    },
    credentials: "include",
  });

  if (!res.ok) {
    throw new Error(`Failed to get employees: ${res.statusText}`);
  }

  const employees = await res.json();
  if (employees.length === 0) {
    throw new Error("No employees found. Please create an employee first.");
  }

  employeeId = employees[0].id;
  console.log(`   ✅ Found employee: ${employees[0].firstName} ${employees[0].lastName} (${employeeId})\n`);
}

async function testEmployeeAllowances() {
  console.log("📋 Step 3: Testing Employee Allowances API...");

  // GET allowances
  console.log("   3.1: GET /api/employee-allowances");
  const getRes = await fetch(`${API_BASE}/api/employee-allowances?employeeId=${employeeId}`, {
    headers: { "Authorization": `Bearer ${authToken}` },
    credentials: "include",
  });

  if (!getRes.ok) {
    throw new Error(`GET allowances failed: ${getRes.statusText}`);
  }

  const existingAllowances = await getRes.json();
  console.log(`      ✅ Found ${existingAllowances.length} existing allowances`);

  // POST new allowance
  console.log("   3.2: POST /api/employee-allowances");
  const newAllowance = {
    employeeId,
    code: `MEAL-${Date.now()}`,
    name: "Хоолны мөнгө",
    amount: 30000,
    isTaxable: false, // Хоолны мөнгө татваргүй
    isSHI: false, // НДШ тооцохгүй
    isPIT: false, // ХХОАТ тооцохгүй
    isRecurring: true,
    effectiveFrom: new Date().toISOString().split('T')[0],
  };

  const postRes = await fetch(`${API_BASE}/api/employee-allowances`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
    },
    credentials: "include",
    body: JSON.stringify(newAllowance),
  });

  if (!postRes.ok) {
    const error = await postRes.json().catch(() => ({}));
    throw new Error(`POST allowance failed: ${error.message || postRes.statusText}`);
  }

  const createdAllowance = await postRes.json();
  console.log(`      ✅ Created allowance: ${createdAllowance.name} (${createdAllowance.amount}₮)`);
  console.log(`         Taxable: ${createdAllowance.isTaxable}, SHI: ${createdAllowance.isSHI}, PIT: ${createdAllowance.isPIT}\n`);

  return createdAllowance.id;
}

async function testSalaryAdvances() {
  console.log("📋 Step 4: Testing Salary Advances API...");

  // GET advances
  console.log("   4.1: GET /api/salary-advances");
  const getRes = await fetch(`${API_BASE}/api/salary-advances?employeeId=${employeeId}`, {
    headers: { "Authorization": `Bearer ${authToken}` },
    credentials: "include",
  });

  if (!getRes.ok) {
    throw new Error(`GET advances failed: ${getRes.statusText}`);
  }

  const existingAdvances = await getRes.json();
  console.log(`      ✅ Found ${existingAdvances.length} existing advances`);

  // POST new advance request
  console.log("   4.2: POST /api/salary-advances");
  const newAdvance = {
    employeeId,
    amount: 150000,
    reason: "API Test - Яаралтай зардал",
    deductionType: "monthly",
    monthlyDeductionAmount: 50000,
    totalDeductionMonths: 3,
    isLoan: false,
  };

  const postRes = await fetch(`${API_BASE}/api/salary-advances`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
    },
    credentials: "include",
    body: JSON.stringify(newAdvance),
  });

  if (!postRes.ok) {
    const error = await postRes.json().catch(() => ({}));
    throw new Error(`POST advance failed: ${error.message || postRes.statusText}`);
  }

  const createdAdvance = await postRes.json();
  console.log(`      ✅ Created advance request: ${createdAdvance.amount}₮`);
  console.log(`         Status: ${createdAdvance.status}`);
  console.log(`         Deduction: ${createdAdvance.monthlyDeductionAmount}₮/month for ${createdAdvance.totalDeductionMonths} months\n`);

  // Approve advance
  console.log("   4.3: POST /api/salary-advances/:id/approve");
  const approveRes = await fetch(`${API_BASE}/api/salary-advances/${createdAdvance.id}/approve`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${authToken}`,
    },
    credentials: "include",
  });

  if (!approveRes.ok) {
    const error = await approveRes.json().catch(() => ({}));
    throw new Error(`Approve failed: ${error.message || approveRes.statusText}`);
  }

  const approvedAdvance = await approveRes.json();
  console.log(`      ✅ Approved advance (Status: ${approvedAdvance.status})`);
  console.log(`         Approved by: ${approvedAdvance.approvedBy}`);
  console.log(`         Paid at: ${approvedAdvance.paidAt}\n`);

  return createdAdvance.id;
}

async function testPayrollCalculation() {
  console.log("📋 Step 5: Testing Payroll Calculation Integration...");

  // Get allowances for the employee
  const allowancesRes = await fetch(`${API_BASE}/api/employee-allowances?employeeId=${employeeId}`, {
    headers: { "Authorization": `Bearer ${authToken}` },
    credentials: "include",
  });
  const allowances = await allowancesRes.json();
  const activeAllowances = allowances.filter((a: any) => a.isRecurring);

  // Get approved advances
  const advancesRes = await fetch(`${API_BASE}/api/salary-advances?employeeId=${employeeId}&status=approved`, {
    headers: { "Authorization": `Bearer ${authToken}` },
    credentials: "include",
  });
  const advances = await advancesRes.json();

  console.log(`   Active Allowances: ${activeAllowances.length}`);
  activeAllowances.forEach((a: any) => {
    console.log(`     - ${a.name}: ${a.amount}₮ (Taxable: ${a.isTaxable}, SHI: ${a.isSHI}, PIT: ${a.isPIT})`);
  });

  console.log(`   Approved Advances: ${advances.length}`);
  advances.forEach((a: any) => {
    const remaining = Number(a.amount) - Number(a.deductedAmount || 0);
    const deductionThisMonth = a.deductionType === "monthly" && a.monthlyDeductionAmount
      ? Math.min(remaining, Number(a.monthlyDeductionAmount))
      : remaining;
    console.log(`     - Advance ${a.id.substring(0, 8)}...: ${a.amount}₮ (This month: ${deductionThisMonth}₮)`);
  });

  console.log("\n   ✅ Payroll calculation will include:");
  console.log(`      - Allowances: ${activeAllowances.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0)}₮`);
  console.log(`      - Advance deductions: ${advances.reduce((sum: number, a: any) => {
    const remaining = Number(a.amount) - Number(a.deductedAmount || 0);
    return sum + (a.deductionType === "monthly" && a.monthlyDeductionAmount
      ? Math.min(remaining, Number(a.monthlyDeductionAmount))
      : remaining);
  }, 0)}₮\n`);
}

async function runTests() {
  try {
    console.log("🧪 Starting API Tests for Salary Advances & Allowances\n");
    console.log(`   API Base: ${API_BASE}\n`);

    // Note: If your API doesn't use Bearer tokens, you may need to adjust
    // For cookie-based auth, the credentials: "include" should work
    
    await login();
    await getEmployee();
    await testEmployeeAllowances();
    await testSalaryAdvances();
    await testPayrollCalculation();

    console.log("✅ All API tests completed successfully!");
    console.log("\n📝 Next steps:");
    console.log("   1. Test in frontend: Employees → Урьдчилгаа");
    console.log("   2. Test in frontend: Payroll → Ажилтан сонгох → Allowances/Advances харагдах");
    console.log("   3. Verify payroll calculation includes allowances and advances");

  } catch (error: any) {
    console.error("\n❌ Test failed:", error.message);
    console.error("\n💡 Note: This test requires:");
    console.error("   - Server running on", API_BASE);
    console.error("   - Valid test credentials in TEST_CREDENTIALS");
    console.error("   - At least one employee in the database");
    console.error("\n   If using cookie-based auth, make sure credentials: 'include' is working.");
    process.exit(1);
  }
}

// Only run if called directly
if (require.main === module) {
  runTests();
}

export { runTests };
