/**
 * Link Employees to Users
 * Creates user accounts for employees and links them via userId
 * This enables RBAC testing for Dept Manager and Staff roles
 */

import "dotenv/config";
import { storage } from "../server/storage";
import { hashPassword } from "../server/auth";

async function linkEmployeesToUsers() {
  console.log("🔗 Linking Employees to Users\n");
  console.log("=" .repeat(60));

  const tenantId = "27f8e5ec-1819-4014-b637-fac2b561473d";

  try {
    // Get tenant
    const tenant = await storage.getTenant(tenantId);
    if (!tenant) {
      console.log("❌ Tenant not found");
      return;
    }
    console.log(`✅ Using tenant: ${tenant.name}\n`);

    // Get all employees
    const employees = await storage.getEmployees(tenantId);
    console.log(`📋 Found ${employees.length} employees\n`);

    if (employees.length === 0) {
      console.log("❌ No employees found. Please create employees first.");
      return;
    }

    // Get existing users
    const existingUsers = await storage.getUsers(tenantId);
    console.log(`👥 Found ${existingUsers.length} existing users\n`);

    // Get roles (to assign non-admin roles)
    const roles = await storage.getRoles(tenantId);
    const staffRole = roles.find((r: any) => r.name.toLowerCase() === "staff" || r.name.toLowerCase() === "user");
    const managerRole = roles.find((r: any) => r.name.toLowerCase() === "manager" || r.name.toLowerCase() === "dept manager");

    console.log("🔗 Linking employees to users...\n");

    let linkedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;

    for (let i = 0; i < employees.length; i++) {
      const employee = employees[i];
      
      // Skip if already linked
      if (employee.userId) {
        const existingUser = existingUsers.find((u: any) => u.id === employee.userId);
        if (existingUser) {
          console.log(`   ⏭️  ${i + 1}. ${employee.firstName} ${employee.lastName || ""} - Already linked to ${existingUser.email}`);
          skippedCount++;
          continue;
        }
      }

      // Check if user with same email exists
      let user = existingUsers.find((u: any) => u.email === employee.email);
      
      if (!user) {
        // Create new user for employee
        const password = await hashPassword("test123"); // Default password for testing
        user = await storage.createUser({
          tenantId,
          email: employee.email || `employee-${employee.employeeNo || employee.id}@test.com`,
          passwordHash: password,
          fullName: `${employee.firstName} ${employee.lastName || ""}`.trim(),
          isActive: true,
        });
        createdCount++;
        console.log(`   ✅ ${i + 1}. Created user for ${employee.firstName} ${employee.lastName || ""} (${user.email})`);
      } else {
        console.log(`   ℹ️  ${i + 1}. User already exists for ${employee.firstName} ${employee.lastName || ""} (${user.email})`);
      }

      // Link employee to user
      try {
        await storage.updateEmployee(employee.id, { userId: user.id } as any);
        linkedCount++;
        console.log(`      ✅ Linked employee to user`);
        
        // Assign role (non-admin)
        if (user.id) {
          // Remove admin role if exists
          const userRoles = await storage.getUserRoles(user.id);
          const adminRole = userRoles.find((r: any) => r.name.toLowerCase() === "admin" || r.isSystem);
          
          if (!adminRole) {
            // Assign staff or manager role
            if (staffRole) {
              try {
                await storage.assignRoleToUser(user.id, staffRole.id);
                console.log(`      ✅ Assigned ${staffRole.name} role`);
              } catch (err: any) {
                // Role might already be assigned
                console.log(`      ℹ️  Role assignment skipped: ${err.message}`);
              }
            }
          } else {
            console.log(`      ℹ️  User has admin role, skipping role assignment`);
          }
        }
      } catch (err: any) {
        console.log(`      ⚠️  Error linking: ${err.message}`);
      }
    }

    console.log("\n" + "=" .repeat(60));
    console.log("📊 Summary:\n");
    console.log(`   ✅ Created users: ${createdCount}`);
    console.log(`   ✅ Linked employees: ${linkedCount}`);
    console.log(`   ⏭️  Skipped (already linked): ${skippedCount}`);
    console.log(`   📋 Total employees: ${employees.length}`);

    // Verify links
    console.log("\n🔍 Verifying links...\n");
    const updatedEmployees = await storage.getEmployees(tenantId);
    const linkedEmployees = updatedEmployees.filter((e: any) => e.userId);
    console.log(`   ✅ ${linkedEmployees.length}/${updatedEmployees.length} employees now have userId`);

    if (linkedEmployees.length > 0) {
      console.log("\n   📋 Linked Employees:");
      linkedEmployees.slice(0, 5).forEach((emp: any) => {
        console.log(`      - ${emp.firstName} ${emp.lastName || ""} (${emp.employeeNo || emp.id.substring(0, 8)})`);
      });
      if (linkedEmployees.length > 5) {
        console.log(`      ... and ${linkedEmployees.length - 5} more`);
      }
    }

    console.log("\n" + "=" .repeat(60));
    console.log("✅ Employee-User Linking Complete!\n");
    console.log("📝 Next Steps:");
    console.log("   1. Run RBAC test: npx tsx scripts/test-departments-rbac-full.ts");
    console.log("   2. Assign a manager to a department for manager test");
    console.log("   3. Test with different user roles");

  } catch (error: any) {
    console.error("\n❌ Error:", error.message);
    console.error("Stack:", error.stack);
    process.exit(1);
  }
}

linkEmployeesToUsers();
