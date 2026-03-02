/**
 * Dashboard Demo Data Seed Script
 * 
 * Creates sample data for Dashboard visualization:
 * - Sales invoices (last 6 months) for revenue chart
 * - Attendance records for attendance chart
 * - Recent invoices for dashboard display
 */

import "dotenv/config";
import { db } from "../server/db";
import {
  tenants, invoices, invoiceLines,
  salesOrders, salesOrderLines,
  attendanceDays, employees, departments as departmentsTable, contacts, products,
  stockMovements, payrollRuns, payslips, leaveRequests
} from "../shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";
import { format, subMonths, subDays, startOfMonth, endOfMonth, addDays } from "date-fns";
import { storage } from "../server/storage";
import { calculateMongolianPayroll } from "../shared/payroll-calculator";

async function seedDashboardData() {
  console.log("🚀 Starting Dashboard Demo Data Seed...\n");

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
  } else {
    // Get first active tenant (default behavior), preferring the Demo one
    tenant = await db.query.tenants.findFirst({
      where: and(eq(tenants.status, "active"), eq(tenants.name, "Демо Байгууллага ХХК")),
    });

    if (!tenant) {
      // Fallback to any active tenant
      tenant = await db.query.tenants.findFirst({
        where: eq(tenants.status, "active"),
      });
    }

    if (!tenant) {
      console.error("❌ No active tenant found. Please run seed-demo.ts first.");
      console.error("💡 Or specify tenant ID: npm run seed:dashboard <tenant-id>");
      process.exit(1);
    }
  }

  console.log(`📋 Using tenant: ${tenant.name} (${tenant.id})\n`);

  const tenantId = tenant.id;

  // Get existing data
  const allEmployees = await storage.getEmployees(tenantId);
  const allContacts = await storage.getContacts(tenantId);
  const allProducts = await storage.getProducts(tenantId);

  if (allEmployees.length === 0 || allContacts.length === 0 || allProducts.length === 0) {
    console.error("❌ Missing required data. Please run seed-demo.ts first.");
    console.error(`   Employees: ${allEmployees.length}, Contacts: ${allContacts.length}, Products: ${allProducts.length}`);
    process.exit(1);
  }

  const customers = allContacts.filter((c: any) => c.type === "customer");
  const activeProducts = allProducts.filter((p: any) => p.isActive);

  if (customers.length === 0 || activeProducts.length === 0) {
    console.error("❌ No customers or products found. Please run seed-demo.ts first.");
    process.exit(1);
  }

  // 0.5. Ensure we have at least 5 active employees (add if needed)
  console.log("👤 Ensuring at least 5 active employees...");
  const activeEmployees = allEmployees.filter((e: any) => e.status === "active");
  const targetEmployeeCount = 5;

  if (activeEmployees.length < targetEmployeeCount) {
    const neededCount = targetEmployeeCount - activeEmployees.length;
    console.log(`  ➕ Need to add ${neededCount} more employees (current: ${activeEmployees.length}, target: ${targetEmployeeCount})`);

    // Get departments for employee assignment
    const departments = await storage.getDepartments(tenantId);
    const dept = departments.length > 0 ? departments[0] : null;

    // Generate employee numbers
    const maxEmpNo = activeEmployees.reduce((max: number, emp: any) => {
      const match = emp.employeeNo?.match(/EMP-(\d+)/);
      return match ? Math.max(max, parseInt(match[1])) : max;
    }, 0);

    // Sample employee names (Mongolian names)
    const sampleNames = [
      { firstName: "Сараа", lastName: "Болд" },
      { firstName: "Отгон", lastName: "Мөнх" },
      { firstName: "Энхтайван", lastName: "Нараа" },
      { firstName: "Цэцэг", lastName: "Нямбаяр" },
      { firstName: "Баттөмөр", lastName: "Цэдэн" },
    ];

    for (let i = 0; i < neededCount; i++) {
      const nameIndex = activeEmployees.length + i;
      const name = sampleNames[nameIndex % sampleNames.length];
      const empNo = `EMP-${String(maxEmpNo + i + 1).padStart(6, "0")}`;

      try {
        await storage.createEmployee({
          tenantId,
          firstName: name.firstName,
          lastName: name.lastName,
          employeeNo: empNo,
          email: `${name.firstName.toLowerCase()}${i + 1}@demo.erp.mn`,
          phone: `99${Math.floor(10000000 + Math.random() * 89999999)}`,
          baseSalary: String(2000000 + Math.floor(Math.random() * 500000)), // 2M - 2.5M
          hireDate: format(subDays(new Date(), Math.floor(Math.random() * 365)), "yyyy-MM-dd"), // Random date in last year
          departmentId: dept?.id || null,
          status: "active",
        } as any);

        console.log(`  ✅ Created employee: ${empNo} - ${name.firstName} ${name.lastName}`);
      } catch (error: any) {
        console.warn(`  ⚠️  Failed to create employee ${empNo}:`, error.message);
      }
    }

    // Refresh employee list after creation (will be reloaded in the attendance section)
    console.log(`  ✅ Created ${neededCount} new employees\n`);
  } else {
    console.log(`  ✅ Already have ${activeEmployees.length} active employees (target: ${targetEmployeeCount})\n`);
  }

  // 0.6. Ensure employees are linked to departments and have positions (Odoo-like structure)
  console.log("🔗 Ensuring employees are linked to departments with positions...");
  const departments = await storage.getDepartments(tenantId);

  if (departments.length > 0) {
    // Refresh employee list
    const allEmployeesList = await storage.getEmployees(tenantId);
    const activeEmployeesList = allEmployeesList.filter((e: any) => e.status === "active");

    // Common Mongolian job positions
    const positions = [
      "Дарга", // Manager
      "Дэд дарга", // Deputy Manager
      "Менежер", // Manager
      "Мэргэжилтэн", // Specialist
      "Ажилтан", // Employee
      "Инженер", // Engineer
      "Нягтлан бодогч", // Accountant
      "Борлуулагч", // Salesperson
      "Агуулахын ажилтан", // Warehouse worker
    ];

    // Update employees to ensure they have departmentId and position
    let updatedCount = 0;
    for (let i = 0; i < activeEmployeesList.length; i++) {
      const employee = activeEmployeesList[i];
      const dept = departments[i % departments.length]; // Distribute employees across departments
      const position = positions[Math.min(i % positions.length, positions.length - 1)];

      const needsUpdate = !employee.departmentId || !employee.position;

      if (needsUpdate) {
        try {
          await db
            .update(employees)
            .set({
              departmentId: dept.id,
              position: position,
            })
            .where(eq(employees.id, employee.id));

          updatedCount++;
          if (updatedCount <= 3) {
            console.log(`  ✅ Linked ${employee.employeeNo || employee.firstName} to ${dept.name} (${position})`);
          }
        } catch (error: any) {
          console.warn(`  ⚠️  Failed to update employee ${employee.employeeNo}:`, error.message);
        }
      }
    }

    if (updatedCount > 3) {
      console.log(`  ✅ Updated ${updatedCount} employees with departments and positions\n`);
    } else if (updatedCount > 0) {
      console.log(`  ✅ Updated ${updatedCount} employees with departments and positions\n`);
    } else {
      console.log(`  ✅ All employees already have departments and positions\n`);
    }

    // Assign department managers (first employee of each department becomes manager)
    console.log("👔 Assigning department managers...");
    let managerCount = 0;

    // Use departments we already have from storage
    for (const deptRow of departments) {
      // Try to assign manager for each department
      // We'll check if update succeeds or fails

      // Find first active employee in this department
      const deptEmployees = activeEmployeesList.filter((e: any) => e.departmentId === deptRow.id);

      if (deptEmployees.length > 0) {
        const managerEmployee = deptEmployees[0]; // First employee becomes manager

        try {
          // 1. Update department to set manager (using SQL to check if already exists)
          const updateResult = await db
            .update(departmentsTable)
            .set({
              managerId: managerEmployee.id,
            })
            .where(eq(departmentsTable.id, deptRow.id))
            .returning({ id: departmentsTable.id, managerId: departmentsTable.managerId });

          // Only update position if we actually set the manager (not already set)
          if (updateResult.length > 0) {
            // 2. Update employee's position to "Дарга" (Manager)
            await db
              .update(employees)
              .set({
                position: "Дарга",
              })
              .where(eq(employees.id, managerEmployee.id));

            managerCount++;
            console.log(`  ✅ Assigned ${managerEmployee.employeeNo || managerEmployee.firstName} as manager of ${deptRow.name} (position updated to "Дарга")`);
          }
        } catch (error: any) {
          // Ignore duplicate or constraint errors, or if manager already exists
          if (!error.message?.includes("duplicate") && !error.message?.includes("constraint")) {
            console.warn(`  ⚠️  Failed to assign manager for ${deptRow.name}:`, error.message);
          }
        }
      }
    }

    if (managerCount === 0) {
      console.log(`  ✅ All departments already have managers\n`);
    } else {
      console.log(`  ✅ Assigned ${managerCount} department managers\n`);
    }
  } else {
    console.log(`  ⏭️  No departments found, skipping employee-department linking\n`);
  }

  // 1. Create Sales Invoices for last 6 months (for revenue chart)
  console.log("📊 Creating sales invoices (last 6 months)...");
  const existingInvoices = await db.select().from(invoices).where(and(eq(invoices.tenantId, tenantId), eq(invoices.type, "sales")));

  // Always generate more invoices if we have less than 50
  if (existingInvoices.length < 50) {
    const now = new Date();
    let invoiceCount = 0;

    // Generate invoices for each month (6 months back)
    for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
      const targetMonth = subMonths(now, monthOffset);
      const monthStart = startOfMonth(targetMonth);
      const monthEnd = endOfMonth(targetMonth);
      const daysInMonth = monthEnd.getDate();

      // Generate 8-12 invoices per month (random)
      const invoicesThisMonth = 8 + Math.floor(Math.random() * 5);

      for (let i = 0; i < invoicesThisMonth; i++) {
        const invoiceDate = addDays(monthStart, Math.floor(Math.random() * daysInMonth));
        const customer = customers[Math.floor(Math.random() * customers.length)];
        const productCount = 1 + Math.floor(Math.random() * 3); // 1-3 products per invoice

        let subtotal = 0;
        let taxAmount = 0;
        const lines: any[] = [];

        // Generate invoice lines
        for (let j = 0; j < productCount; j++) {
          const product = activeProducts[Math.floor(Math.random() * activeProducts.length)];
          const quantity = 1 + Math.floor(Math.random() * 5);
          const unitPrice = Number(product.salePrice) || 100000;
          const lineSubtotal = quantity * unitPrice;
          const taxRate = 10; // 10% VAT
          const lineTax = lineSubtotal * (taxRate / 100);
          const lineTotal = lineSubtotal + lineTax;

          subtotal += lineSubtotal;
          taxAmount += lineTax;

          lines.push({
            productId: product.id,
            description: product.name,
            quantity: quantity.toString(),
            unitPrice: unitPrice.toString(),
            taxRate: taxRate.toString(),
            subtotal: lineSubtotal.toString(),
            taxAmount: lineTax.toString(),
            total: lineTotal.toString(),
          });
        }

        const totalAmount = subtotal + taxAmount;
        const invoiceNumber = `INV-${format(invoiceDate, "yyyyMMdd")}-${String(invoiceCount + 1).padStart(3, "0")}`;

        // Create invoice
        const [invoice] = await db
          .insert(invoices)
          .values({
            tenantId,
            invoiceNumber,
            invoiceDate: invoiceDate.toISOString().split("T")[0],
            dueDate: addDays(invoiceDate, 30).toISOString().split("T")[0],
            contactId: customer.id,
            type: "sales",
            status: "posted",
            subtotal: subtotal.toString(),
            taxAmount: taxAmount.toString(),
            totalAmount: totalAmount.toString(),
            paidAmount: Math.random() > 0.3 ? totalAmount.toString() : "0", // 70% paid
          })
          .returning();

        // Create invoice lines
        for (const line of lines) {
          await db.insert(invoiceLines).values({
            tenantId,
            invoiceId: invoice.id,
            productId: line.productId,
            description: line.description,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate,
            subtotal: line.subtotal,
            taxAmount: line.taxAmount,
            total: line.total,
          });
        }

        invoiceCount++;
      }
    }

    console.log(`  ✅ Created ${invoiceCount} sales invoices\n`);
  } else {
    console.log(`  ⏭️  ${existingInvoices.length} invoices already exist\n`);
  }

  // 2. Create Attendance Records (last 30 days)
  console.log("📅 Creating attendance records (last 30 days)...");
  const thirtyDaysAgo = subDays(new Date(), 30);
  const existingAttendance = await db
    .select()
    .from(attendanceDays)
    .where(
      and(
        eq(attendanceDays.tenantId, tenantId),
        gte(attendanceDays.workDate, thirtyDaysAgo.toISOString().split("T")[0])
      )
    );

  // Always generate more attendance records if we have less than 100
  if (existingAttendance.length < 100) {
    let attendanceCount = 0;
    const today = new Date();

    // Generate attendance for last 30 days
    for (let dayOffset = 29; dayOffset >= 0; dayOffset--) {
      const workDate = subDays(today, dayOffset);
      const dateStr = workDate.toISOString().split("T")[0];
      const dayOfWeek = workDate.getDay(); // 0 = Sunday, 6 = Saturday

      // Skip weekends (Saturday = 6, Sunday = 0)
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        continue;
      }

      // Generate attendance for each active employee
      for (const employee of allEmployees) {
        // Check if attendance record already exists for this employee and date
        const existing = await db
          .select()
          .from(attendanceDays)
          .where(
            and(
              eq(attendanceDays.tenantId, tenantId),
              eq(attendanceDays.employeeId, employee.id),
              eq(attendanceDays.workDate, dateStr)
            )
          )
          .limit(1);

        if (existing.length > 0) {
          continue; // Skip if already exists
        }

        // Random: 85% present, 10% late, 5% absent
        const rand = Math.random();
        let status = "present";
        if (rand < 0.05) {
          status = "absent";
        } else if (rand < 0.15) {
          status = "late";
        }

        if (status === "absent") {
          continue; // Don't create record for absent
        }

        const checkIn = new Date(workDate);
        if (status === "late") {
          checkIn.setHours(10 + Math.floor(Math.random() * 2), 0 + Math.floor(Math.random() * 60), 0); // 10:00-12:00
        } else {
          checkIn.setHours(8 + Math.floor(Math.random() * 2), 0 + Math.floor(Math.random() * 60), 0); // 8:00-10:00
        }

        const checkOut = new Date(checkIn);
        checkOut.setHours(17 + Math.floor(Math.random() * 2), 0 + Math.floor(Math.random() * 60), 0); // 17:00-19:00

        try {
          await db.insert(attendanceDays).values({
            tenantId,
            employeeId: employee.id,
            workDate: dateStr,
            status: status as any,
            checkIn: checkIn,
            checkOut: checkOut,
            minutesWorked: Math.round(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60))),
          });

          attendanceCount++;
        } catch (error: any) {
          // Skip if unique constraint violation (duplicate)
          if (!error.message?.includes("unique") && !error.message?.includes("duplicate")) {
            console.warn(`  ⚠️  Failed to create attendance for ${employee.employeeNo} on ${dateStr}:`, error.message);
          }
        }
      }
    }

    console.log(`  ✅ Created ${attendanceCount} attendance records\n`);
  } else {
    console.log(`  ⏭️  ${existingAttendance.length} attendance records already exist\n`);
  }

  // 2.5. Ensure exactly 5 employees have attendance for today (demo requirement)
  console.log("📅 Ensuring exactly 5 employees have attendance for today...");
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const workDate = new Date(todayStr);

  // Get active employees (refresh in case we just created new ones)
  const currentActiveEmployees = await storage.getEmployees(tenantId);
  const todayActiveEmployees = currentActiveEmployees.filter((e: any) => e.status === "active");

  // Check existing attendance for today
  const existingTodayAttendance = await db
    .select()
    .from(attendanceDays)
    .where(
      and(
        eq(attendanceDays.tenantId, tenantId),
        eq(attendanceDays.workDate, todayStr)
      )
    );

  const existingEmployeeIds = new Set(existingTodayAttendance.map((a: any) => a.employeeId));
  console.log(`  📊 Found ${existingTodayAttendance.length} existing attendance records for today\n`);

  // Find employees without attendance
  const employeesWithoutAttendance = todayActiveEmployees.filter((e: any) => !existingEmployeeIds.has(e.id));

  // Calculate how many more we need (up to 5 total)
  const targetCount = 5;
  const currentCount = existingTodayAttendance.length;
  const neededCount = Math.max(0, targetCount - currentCount);

  if (neededCount === 0) {
    console.log(`  ✅ Already have ${currentCount} attendance records for today (target: ${targetCount})\n`);
  } else if (employeesWithoutAttendance.length === 0) {
    console.warn(`  ⚠️  All ${todayActiveEmployees.length} active employees already have attendance for today\n`);
  } else {
    // Take only the number needed
    const employeesToAdd = employeesWithoutAttendance.slice(0, neededCount);
    console.log(`  ➕ Adding attendance for ${employeesToAdd.length} more employees (current: ${currentCount}, target: ${targetCount})\n`);

    let addedCount = 0;

    for (const employee of employeesToAdd) {
      // Create attendance record (present status)
      const checkIn = new Date(workDate);
      checkIn.setHours(8 + Math.floor(Math.random() * 2), 0 + Math.floor(Math.random() * 60), 0); // 8:00-10:00

      const checkOut = new Date(checkIn);
      checkOut.setHours(17 + Math.floor(Math.random() * 2), 0 + Math.floor(Math.random() * 60), 0); // 17:00-19:00

      try {
        await db.insert(attendanceDays).values({
          tenantId,
          employeeId: employee.id,
          workDate: todayStr,
          status: "present" as any,
          checkIn: checkIn,
          checkOut: checkOut,
          minutesWorked: Math.round(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60))),
        });

        addedCount++;
        console.log(`  ✅ Created attendance for ${employee.employeeNo || employee.firstName || employee.id}`);
      } catch (error: any) {
        console.warn(`  ⚠️  Failed to create today's attendance for ${employee.employeeNo || employee.id}:`, error.message);
      }
    }

    const finalCount = currentCount + addedCount;
    console.log(`\n  ✅ Added ${addedCount} attendance records. Total for today: ${finalCount} (target: ${targetCount})\n`);
  }

  // 2.6. Ensure January 18th attendance exists (for historical reference)
  console.log("📅 Ensuring January 18th attendance...");
  const jan18Date = new Date(today.getFullYear(), 0, 18); // January 18th of current year
  const jan18Str = format(jan18Date, "yyyy-MM-dd");
  const jan18WorkDate = new Date(jan18Str);
  const jan18DayOfWeek = jan18WorkDate.getDay();

  // Skip weekends
  if (jan18DayOfWeek === 0 || jan18DayOfWeek === 6) {
    console.log(`  ⏭️  Skipping January 18th (${jan18Str}) - weekend\n`);
  } else {
    const activeEmployees = allEmployees.filter((e: any) => e.status === "active");
    let jan18AttendanceCount = 0;

    for (const employee of activeEmployees) {
      // Check if already exists
      const existing = await db
        .select()
        .from(attendanceDays)
        .where(
          and(
            eq(attendanceDays.tenantId, tenantId),
            eq(attendanceDays.employeeId, employee.id),
            eq(attendanceDays.workDate, jan18Str)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        continue; // Skip if already exists
      }

      // Create attendance record (present status)
      const checkIn = new Date(jan18WorkDate);
      checkIn.setHours(8 + Math.floor(Math.random() * 2), 0 + Math.floor(Math.random() * 60), 0); // 8:00-10:00

      const checkOut = new Date(checkIn);
      checkOut.setHours(17 + Math.floor(Math.random() * 2), 0 + Math.floor(Math.random() * 60), 0); // 17:00-19:00

      try {
        await db.insert(attendanceDays).values({
          tenantId,
          employeeId: employee.id,
          workDate: jan18Str,
          status: "present" as any,
          checkIn: checkIn,
          checkOut: checkOut,
          minutesWorked: Math.round(((checkOut.getTime() - checkIn.getTime()) / (1000 * 60))),
        });

        jan18AttendanceCount++;
      } catch (error: any) {
        // Skip if unique constraint violation
        if (!error.message?.includes("unique") && !error.message?.includes("duplicate")) {
          console.warn(`  ⚠️  Failed to create Jan 18 attendance for ${employee.employeeNo}:`, error.message);
        }
      }
    }

    if (jan18AttendanceCount > 0) {
      console.log(`  ✅ Created ${jan18AttendanceCount} attendance records for January 18th\n`);
    } else {
      console.log(`  ⏭️  January 18th attendance already exists\n`);
    }
  }

  // 3. Create some stock movements for expiry tracking (if warehouse exists)
  console.log("📦 Creating stock movements for expiry tracking...");
  const warehouses = await storage.getWarehouses(tenantId);

  if (warehouses.length > 0 && activeProducts.length > 0) {
    const warehouse = warehouses[0];

    // Create some stock movements with expiry dates
    for (let i = 0; i < Math.min(5, activeProducts.length); i++) {
      const product = activeProducts[i];
      const expiryDate = addDays(new Date(), 5 + Math.floor(Math.random() * 25)); // 5-30 days from now

      // Check if stock movement already exists
      const existing = await db
        .select()
        .from(stockMovements)
        .where(
          and(
            eq(stockMovements.tenantId, tenantId),
            eq(stockMovements.productId, product.id),
            eq(stockMovements.warehouseId, warehouse.id),
            gte(stockMovements.expiryDate || "", expiryDate.toISOString().split("T")[0])
          )
        )
        .limit(1);

      if (existing.length === 0) {
        await db.insert(stockMovements).values({
          tenantId,
          productId: product.id,
          warehouseId: warehouse.id,
          type: "in", // Use 'type' field, not 'movementType'
          quantity: (10 + Math.floor(Math.random() * 20)).toString(), // 10-30 units
          expiryDate: expiryDate.toISOString().split("T")[0],
        });
      }
    }

    console.log(`  ✅ Created stock movements with expiry dates\n`);
  } else {
    console.log(`  ⏭️  Skipping stock movements (no warehouse or products)\n`);
  }

  // 4. Create payroll runs and payslips for last 6 months (for salary graph)
  console.log("💰 Creating payroll runs and payslips (last 6 months)...");
  const existingPayrollRuns = await db.select().from(payrollRuns).where(eq(payrollRuns.tenantId, tenantId));

  if (existingPayrollRuns.length < 6) {
    let payrollCount = 0;
    const now = new Date();

    // Create payroll runs for each of the last 6 months
    for (let monthOffset = 5; monthOffset >= 0; monthOffset--) {
      const targetMonth = subMonths(now, monthOffset);
      const monthStart = startOfMonth(targetMonth);
      const monthEnd = endOfMonth(targetMonth);
      const payDate = addDays(monthEnd, 2); // Pay 2 days after month end

      // Check if payroll run already exists for this period
      const existingRun = existingPayrollRuns.find((r: any) => {
        const runStart = new Date(r.periodStart);
        return runStart.getMonth() === monthStart.getMonth() &&
          runStart.getFullYear() === monthStart.getFullYear();
      });

      if (!existingRun) {
        // Create payroll run
        const [payrollRun] = await db.insert(payrollRuns).values({
          tenantId,
          periodStart: format(monthStart, "yyyy-MM-dd"),
          periodEnd: format(monthEnd, "yyyy-MM-dd"),
          payDate: format(payDate, "yyyy-MM-dd"),
          status: "approved", // Mark as approved so it shows in stats
          approvedAt: new Date(payDate), // Ensure it's a Date object
        } as any).returning();

        // Create payslips for each active employee
        for (const employee of allEmployees.filter((e: any) => e.status === "active")) {
          const baseSalary = Number(employee.baseSalary || 2500000);

          // Get attendance for this month
          const monthAttendance = await storage.getAttendanceByEmployeeAndDateRange(
            tenantId,
            employee.id,
            format(monthStart, "yyyy-MM-dd"),
            format(monthEnd, "yyyy-MM-dd")
          );

          const daysWorked = monthAttendance.filter((a: any) =>
            a.status === "present" || a.status === "late"
          ).length;

          // Calculate working days in month (exclude weekends)
          let workingDays = 0;
          const current = new Date(monthStart);
          while (current <= monthEnd) {
            const dayOfWeek = current.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) workingDays++;
            current.setDate(current.getDate() + 1);
          }

          // Calculate salary based on days worked
          const dailyRate = workingDays > 0 ? baseSalary / workingDays : 0;
          const calculatedBaseSalary = dailyRate * daysWorked;

          // Calculate using payroll calculator
          const calculation = calculateMongolianPayroll({
            baseSalary: calculatedBaseSalary,
            allowances: [],
            advances: [],
            minimumWage: 550000,
            employeeSHIRate: 11.5,
            employerSHIRate: 12.5,
          });

          // Create payslip
          await db.insert(payslips).values({
            tenantId,
            payrollRunId: payrollRun.id,
            employeeId: employee.id,
            grossPay: calculation.grossPay.toString(),
            totalDeductions: calculation.totalDeductions.toString(),
            netPay: calculation.netPay.toString(),
            status: "approved",
          });

          payrollCount++;
        }
      }
    }

    console.log(`  ✅ Created ${payrollCount} payslips across payroll runs\n`);
  } else {
    console.log(`  ⏭️  ${existingPayrollRuns.length} payroll runs already exist\n`);
  }


  // 5. Setup Birthday Data (1 employee with birthday TODAY)
  console.log("🎂 Setting up birthday data...");
  const todayDate = new Date();
  const todayMonth = todayDate.getMonth() + 1; // 1-12
  const todayDay = todayDate.getDate();

  // Pick a random employee
  if (activeEmployees.length > 0) {
    const birthdayEmployee = activeEmployees[Math.floor(Math.random() * activeEmployees.length)];
    const birthYear = 1990 + Math.floor(Math.random() * 10);
    // Create date string YYYY-MM-DD
    const birthDateStr = `${birthYear}-${String(todayMonth).padStart(2, '0')}-${String(todayDay).padStart(2, '0')}`;

    await db
      .update(employees)
      .set({ birthDate: birthDateStr })
      .where(eq(employees.id, birthdayEmployee.id));

    console.log(`  ✅ Set birthday for ${birthdayEmployee.firstName} to TODAY (${birthDateStr})\n`);
  }

  // 6. Setup Pending Requests (2 Leave Requests)
  console.log("🔔 Creating pending leave requests...");
  const requestEmployees = activeEmployees.slice(0, 2); // Take first 2 employees

  if (requestEmployees.length > 0) {
    let requestCount = 0;

    // Check if we already have pending requests
    const existingRequests = await db
      .select({ count: sql<number>`count(*)` })
      .from(leaveRequests)
      .where(and(eq(leaveRequests.tenantId, tenantId), eq(leaveRequests.status, "pending")));

    const currentPending = Number(existingRequests[0]?.count || 0);

    if (currentPending < 2) {
      // 1. Vacation request
      if (requestEmployees[0]) {
        const startDate = addDays(todayDate, 5);
        const endDate = addDays(todayDate, 10);

        await db.insert(leaveRequests).values({
          tenantId,
          employeeId: requestEmployees[0].id,
          type: "vacation",
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
          reason: "Гэр бүлээрээ аялалд явна",
          status: "pending",
        });
        requestCount++;
      }

      // 2. Personal leave request
      if (requestEmployees[1]) {
        const startDate = addDays(todayDate, 2);
        const endDate = addDays(todayDate, 2); // 1 day

        await db.insert(leaveRequests).values({
          tenantId,
          employeeId: requestEmployees[1].id,
          type: "personal",
          startDate: format(startDate, "yyyy-MM-dd"),
          endDate: format(endDate, "yyyy-MM-dd"),
          reason: "Хувийн ажилтай",
          status: "pending",
        });
        requestCount++;
      }
      console.log(`  ✅ Created ${requestCount} pending leave requests\n`);
    } else {
      console.log(`  ⏭️  Already have ${currentPending} pending requests\n`);
    }
  }

  console.log("✅ Dashboard demo data seed completed successfully!");
  console.log("\n📊 Dashboard should now show:");
  console.log("  - Sales revenue chart (last 6 months)");
  console.log("  - Attendance chart (last 30 days)");
  console.log("  - Salary/payroll chart (last 6 months)");
  console.log("  - Recent invoices list");
  console.log("  - Employee salary cards (if employees have attendance)");
  console.log("  - Expiry tracking widget (if stock movements created)\n");
}

seedDashboardData().catch((error) => {
  console.error("❌ Error seeding dashboard data:", error);
  process.exit(1);
});
