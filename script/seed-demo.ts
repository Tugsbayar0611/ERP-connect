/**
 * Demo Environment Seed Script
 * 
 * Creates a complete demo environment with:
 * - Demo tenant/company
 * - Demo users (admin, manager, accountant, sales, hr)
 * - Sample data (products, contacts, employees, invoices, etc.)
 */

import "dotenv/config";
import { db } from "../server/db";
import { 
  tenants, users, roles, userRoles, 
  contacts, products, productCategories,
  employees, departments,
  warehouses, stockLevels,
  accounts, currencies, journals,
  invoices, invoiceLines,
  salesOrders, salesOrderLines,
} from "../shared/schema";
import { eq } from "drizzle-orm";
import { hashPassword } from "../server/auth";
import { storage } from "../server/storage";

const DEMO_TENANT_NAME = "Демо Байгууллага ХХК";
const DEMO_EMAIL_DOMAIN = "demo.erp.mn";

// Demo users to create
const DEMO_USERS = [
  {
    email: `admin@${DEMO_EMAIL_DOMAIN}`,
    fullName: "Админ Хэрэглэгч",
    password: "Admin@123",
    roleName: "Admin",
  },
  {
    email: `manager@${DEMO_EMAIL_DOMAIN}`,
    fullName: "Менежер Хэрэглэгч",
    password: "Manager@123",
    roleName: "Admin", // Manager has admin role
  },
  {
    email: `accountant@${DEMO_EMAIL_DOMAIN}`,
    fullName: "Нягтлан бодогч",
    password: "Accountant@123",
    roleName: "Нягтлан",
  },
  {
    email: `sales@${DEMO_EMAIL_DOMAIN}`,
    fullName: "Борлуулагч",
    password: "Sales@123",
    roleName: "Борлуулалт",
  },
  {
    email: `hr@${DEMO_EMAIL_DOMAIN}`,
    fullName: "Хүний нөөцийн мэргэжилтэн",
    password: "HR@123",
    roleName: "HR",
  },
];

// Sample products
const SAMPLE_PRODUCTS = [
  { name: "Ноутбук", sku: "LAPTOP-001", category: "Компьютер", price: 2500000, unit: "ширхэг" },
  { name: "Хэвлэгч", sku: "PRINTER-001", category: "Компьютер", price: 850000, unit: "ширхэг" },
  { name: "Гар утас", sku: "PHONE-001", category: "Электроник", price: 1200000, unit: "ширхэг" },
  { name: "Ширээ", sku: "DESK-001", category: "Мебель", price: 450000, unit: "ширхэг" },
  { name: "Сандал", sku: "CHAIR-001", category: "Мебель", price: 280000, unit: "ширхэг" },
  { name: "Цаас", sku: "PAPER-001", category: "Хэрэглээний", price: 15000, unit: "пакет" },
  { name: "Бээлий", sku: "PEN-001", category: "Хэрэглээний", price: 5000, unit: "даавуу" },
  { name: "Агуулахын үйлчилгээ", sku: "SERVICE-001", category: "Үйлчилгээ", price: 50000, unit: "цаг" },
];

// Sample contacts
const SAMPLE_CUSTOMERS = [
  { name: "Төгс ХХК", type: "customer", email: "info@tugs.mn", phone: "9911-2233", address: "УБ, СБД" },
  { name: "Их Дэлгүүр ХХК", type: "customer", email: "sales@ihdelguur.mn", phone: "9922-3344", address: "УБ, Хан-Уул" },
  { name: "Цэцэг ХХК", type: "customer", email: "contact@tseeg.mn", phone: "9933-4455", address: "УБ, Баянзүрх" },
];

const SAMPLE_SUPPLIERS = [
  { name: "Нийтийн Худалдаа ХХК", type: "supplier", email: "info@niit.mn", phone: "9944-5566", address: "УБ, Сүхбаатар" },
  { name: "Технологи ХХК", type: "supplier", email: "sales@tech.mn", phone: "9955-6677", address: "УБ, Чингэлтэй" },
];

// Sample employees
const SAMPLE_EMPLOYEES = [
  { firstName: "Бат", lastName: "Эрдэнэ", employeeNo: "EMP-001", email: "bat@demo.erp.mn", phone: "9911-1111", baseSalary: "2500000", nationalId: "АА12345678", hireDate: "2023-01-15" },
  { firstName: "Оюун", lastName: "Цэцэг", employeeNo: "EMP-002", email: "oyun@demo.erp.mn", phone: "9922-2222", baseSalary: "2200000", nationalId: "ЭЭ23456789", hireDate: "2023-03-20" },
  { firstName: "Мөнх", lastName: "Төмөр", employeeNo: "EMP-003", email: "monkh@demo.erp.mn", phone: "9933-3333", baseSalary: "2000000", nationalId: "УУ34567890", hireDate: "2023-05-10" },
];

async function createDemoTenant() {
  console.log("📋 Creating demo tenant...");
  
  let tenant = await db.query.tenants.findFirst({
    where: eq(tenants.name, DEMO_TENANT_NAME),
  });

  if (!tenant) {
    const [created] = await db
      .insert(tenants)
      .values({
        name: DEMO_TENANT_NAME,
        countryCode: "MN",
        timezone: "Asia/Ulaanbaatar",
        currencyCode: "MNT",
        status: "active",
      })
      .returning();
    tenant = created;
    console.log(`  ✅ Created tenant: ${tenant.name}`);
  } else {
    console.log(`  ⏭️  Tenant already exists: ${tenant.name}`);
  }

  return tenant;
}

async function createDemoUsers(tenantId: string) {
  console.log("\n📋 Creating demo users...");

  // Get roles
  const allRoles = await db
    .select()
    .from(roles)
    .where(eq(roles.tenantId, tenantId));
  
  const roleMap = new Map(allRoles.map((r) => [r.name, r.id]));

  const createdUsers: Array<{ id: string; email: string; roleId: string }> = [];

  for (const userDef of DEMO_USERS) {
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, userDef.email),
    });

    if (existingUser) {
      console.log(`  ⏭️  User already exists: ${userDef.email}`);
      continue;
    }

    const passwordHash = await hashPassword(userDef.password);
    const roleId = roleMap.get(userDef.roleName);

    const [user] = await db
      .insert(users)
      .values({
        tenantId,
        email: userDef.email,
        fullName: userDef.fullName,
        passwordHash,
        role: userDef.roleName,
        isActive: true,
      })
      .returning();

    if (user && roleId) {
      await db
        .insert(userRoles)
        .values({
          userId: user.id,
          roleId,
        })
        .onConflictDoNothing();

      createdUsers.push({ id: user.id, email: user.email, roleId });
      console.log(`  ✅ Created user: ${userDef.email} / ${userDef.password} (${userDef.roleName})`);
    } else {
      console.log(`  ⚠️  Failed to create user: ${userDef.email}`);
    }
  }

  return createdUsers;
}

async function createSampleData(tenantId: string) {
  console.log("\n📋 Creating sample data...");

  // 1. Currencies
  console.log("  💰 Creating currencies...");
  const existingCurrency = await db.query.currencies.findFirst({
    where: (currencies, { eq, and }) => and(
      eq(currencies.tenantId, tenantId),
      eq(currencies.code, "MNT")
    ),
  });

  if (!existingCurrency) {
    await storage.createCurrency({
      tenantId,
      code: "MNT",
      name: "Монгол төгрөг",
      symbol: "₮",
      rate: "1.0000",
      isBase: true,
      isActive: true,
    } as any);
    console.log("    ✅ Created MNT currency");
  }

  // 2. Accounts
  console.log("  📊 Creating chart of accounts...");
  const accounts = await storage.getAccounts(tenantId);
  if (accounts.length === 0) {
    const defaultAccounts = [
      { code: "1000", name: "Бэлэн мөнгө", type: "asset", level: 1 },
      { code: "1100", name: "Авлага", type: "asset", level: 1 },
      { code: "2000", name: "Хувьцаа", type: "equity", level: 1 },
      { code: "2100", name: "Өглөг", type: "liability", level: 1 },
      { code: "2200", name: "ХХОАТ төлөх", type: "liability", level: 1 },
      { code: "4000", name: "Борлуулалтын орлого", type: "income", level: 1 },
      { code: "5000", name: "Борлуулалтын зарлага", type: "expense", level: 1 },
    ];

    for (const acc of defaultAccounts) {
      await storage.createAccount({
        tenantId,
        code: acc.code,
        name: acc.name,
        type: acc.type as any,
        level: acc.level,
        isActive: true,
      } as any);
    }
    console.log(`    ✅ Created ${defaultAccounts.length} accounts`);
  }

  // 3. Product Categories
  console.log("  📦 Creating product categories...");
  const categories = await storage.getProductCategories(tenantId);
  const categoryMap = new Map<string, string>();

  const uniqueCategories = [...new Set(SAMPLE_PRODUCTS.map((p) => p.category))];
  for (const catName of uniqueCategories) {
    const existing = categories.find((c: any) => c.name === catName);
    if (existing) {
      categoryMap.set(catName, existing.id);
    } else {
      const category = await storage.createProductCategory({
        tenantId,
        name: catName,
      } as any);
      categoryMap.set(catName, category.id);
      console.log(`    ✅ Created category: ${catName}`);
    }
  }

  // 4. Products
  console.log("  🛍️  Creating products...");
  const existingProducts = await storage.getProducts(tenantId);
  if (existingProducts.length === 0) {
    for (const prod of SAMPLE_PRODUCTS) {
      const categoryId = categoryMap.get(prod.category);
      await storage.createProduct({
        tenantId,
        name: prod.name,
        sku: prod.sku,
        categoryId: categoryId || null,
        unit: prod.unit,
        price: prod.price.toString(),
        isActive: true,
      } as any);
    }
    console.log(`    ✅ Created ${SAMPLE_PRODUCTS.length} products`);
  }

  // 5. Contacts
  console.log("  👥 Creating contacts...");
  const existingContacts = await storage.getContacts(tenantId);
  if (existingContacts.length === 0) {
    for (const contact of [...SAMPLE_CUSTOMERS, ...SAMPLE_SUPPLIERS]) {
      await storage.createContact({
        tenantId,
        name: contact.name,
        type: contact.type as any,
        email: contact.email,
        phone: contact.phone,
        address: contact.address,
        isActive: true,
      } as any);
    }
    console.log(`    ✅ Created ${SAMPLE_CUSTOMERS.length + SAMPLE_SUPPLIERS.length} contacts`);
  }

  // 6. Departments
  console.log("  🏢 Creating departments...");
  const existingDepts = await storage.getDepartments(tenantId);
  if (existingDepts.length === 0) {
    const departments = ["Удирдлага", "Борлуулалт", "Санхүү", "Хүний нөөцийн газар"];
    for (const deptName of departments) {
      await storage.createDepartment({
        tenantId,
        name: deptName,
      } as any);
    }
    console.log(`    ✅ Created ${departments.length} departments`);
  }

  // 7. Employees
  console.log("  👤 Creating employees...");
  const existingEmployees = await storage.getEmployees(tenantId);
  if (existingEmployees.length === 0) {
    const depts = await storage.getDepartments(tenantId);
    for (let i = 0; i < SAMPLE_EMPLOYEES.length; i++) {
      const emp = SAMPLE_EMPLOYEES[i];
      const dept = depts[i % depts.length];
      await storage.createEmployee({
        tenantId,
        firstName: emp.firstName,
        lastName: emp.lastName,
        employeeNo: emp.employeeNo,
        email: emp.email,
        phone: emp.phone,
        baseSalary: emp.baseSalary,
        nationalId: emp.nationalId,
        hireDate: emp.hireDate,
        departmentId: dept?.id || null,
        status: "active",
      } as any);
    }
    console.log(`    ✅ Created ${SAMPLE_EMPLOYEES.length} employees`);
  }

  // 8. Warehouses
  console.log("  📦 Creating warehouses...");
  const existingWarehouses = await storage.getWarehouses(tenantId);
  if (existingWarehouses.length === 0) {
    await storage.createWarehouse({
      tenantId,
      name: "Гол агуулах",
      code: "WH-001",
      address: "УБ, СБД",
      isActive: true,
    } as any);
    console.log("    ✅ Created warehouse");
  }
}

async function main() {
  try {
    console.log("🚀 Starting Demo Environment Seed...\n");

    // 1. Ensure RBAC is seeded first
    console.log("⚠️  Note: Make sure to run 'npm run seed:rbac' first if roles don't exist\n");

    // 2. Get or create tenant
    // Allow specifying tenant ID via command line argument
    const tenantIdArg = process.argv[2];
    let tenant;
    
    if (tenantIdArg) {
      // Use specified tenant ID
      tenant = await db.query.tenants.findFirst({
        where: eq(tenants.id, tenantIdArg),
      });
      if (!tenant) {
        console.error(`❌ Tenant with ID ${tenantIdArg} not found.`);
        process.exit(1);
      }
      console.log(`📋 Using existing tenant: ${tenant.name} (${tenant.id})\n`);
    } else {
      // Create demo tenant (default behavior)
      tenant = await createDemoTenant();
    }

    // 3. Create demo users (only if not using existing tenant)
    if (!tenantIdArg) {
      await createDemoUsers(tenant.id);
    }

    // 4. Create sample data
    await createSampleData(tenant.id);

    console.log("\n✅ Demo environment seed completed successfully!");
    console.log("\n📋 Demo Login Credentials:");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    for (const user of DEMO_USERS) {
      console.log(`  ${user.email} / ${user.password} (${user.roleName})`);
    }
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
    console.log(`\n🌐 Demo Tenant: ${tenant.name} (${tenant.id})\n`);
  } catch (error) {
    console.error("❌ Error seeding demo environment:", error);
    process.exit(1);
  }
}

main();
