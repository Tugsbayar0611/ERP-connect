/**
 * Seed Default Roles and Permissions
 * 
 * Creates default system roles and permissions for RBAC
 */

import { db } from "../server/db";
import { roles, permissions, rolePermissions, tenants } from "../shared/schema";
import { eq, and } from "drizzle-orm";

// Default permissions (resource.action format)
const DEFAULT_PERMISSIONS = [
  // Dashboard
  { resource: "dashboard", action: "view", description: "View dashboard" },

  // HR Module
  { resource: "employee", action: "view", description: "View employees" },
  { resource: "employee", action: "create", description: "Create employee" },
  { resource: "employee", action: "update", description: "Update employee" },
  { resource: "employee", action: "delete", description: "Delete employee" },
  { resource: "attendance", action: "view", description: "View attendance" },
  { resource: "attendance", action: "create", description: "Create attendance" },
  { resource: "attendance", action: "update", description: "Update attendance" },
  { resource: "attendance", action: "delete", description: "Delete attendance" },
  { resource: "payroll", action: "view", description: "View payroll" },
  { resource: "payroll", action: "create", description: "Create payroll" },
  { resource: "payroll", action: "approve", description: "Approve payroll" },

  // Products & Inventory
  { resource: "product", action: "view", description: "View products" },
  { resource: "product", action: "create", description: "Create product" },
  { resource: "product", action: "update", description: "Update product" },
  { resource: "product", action: "delete", description: "Delete product" },
  { resource: "inventory", action: "view", description: "View inventory" },
  { resource: "inventory", action: "adjust", description: "Adjust inventory" },

  // Sales
  { resource: "sales_order", action: "view", description: "View sales orders" },
  { resource: "sales_order", action: "create", description: "Create sales order" },
  { resource: "sales_order", action: "update", description: "Update sales order" },
  { resource: "sales_order", action: "confirm", description: "Confirm sales order" },
  { resource: "sales_order", action: "cancel", description: "Cancel sales order" },

  // Purchase
  { resource: "purchase_order", action: "view", description: "View purchase orders" },
  { resource: "purchase_order", action: "create", description: "Create purchase order" },
  { resource: "purchase_order", action: "update", description: "Update purchase order" },
  { resource: "purchase_order", action: "confirm", description: "Confirm purchase order" },
  { resource: "purchase_order", action: "cancel", description: "Cancel purchase order" },

  // Invoices
  { resource: "invoice", action: "view", description: "View invoices" },
  { resource: "invoice", action: "create", description: "Create invoice" },
  { resource: "invoice", action: "update", description: "Update invoice" },
  { resource: "invoice", action: "post", description: "Post invoice" },
  { resource: "invoice", action: "cancel", description: "Cancel invoice" },

  // Payments
  { resource: "payment", action: "view", description: "View payments" },
  { resource: "payment", action: "create", description: "Create payment" },
  { resource: "payment", action: "update", description: "Update payment" },
  { resource: "payment", action: "post", description: "Post payment" },

  // Accounting
  { resource: "account", action: "view", description: "View accounts" },
  { resource: "account", action: "create", description: "Create account" },
  { resource: "account", action: "update", description: "Update account" },
  { resource: "journal", action: "view", description: "View journals" },
  { resource: "journal", action: "create", description: "Create journal" },
  { resource: "journal_entry", action: "view", description: "View journal entries" },
  { resource: "journal_entry", action: "create", description: "Create journal entry" },
  { resource: "journal_entry", action: "post", description: "Post journal entry" },
  { resource: "journal_entry", action: "reverse", description: "Reverse journal entry" },

  // Reports
  { resource: "report", action: "view", description: "View reports" },
  { resource: "report", action: "export", description: "Export reports" },

  // Settings
  { resource: "settings", action: "view", description: "View settings" },
  { resource: "settings", action: "update", description: "Update settings" },

  // RBAC
  { resource: "role", action: "view", description: "View roles" },
  { resource: "role", action: "create", description: "Create role" },
  { resource: "role", action: "update", description: "Update role" },
  { resource: "role", action: "delete", description: "Delete role" },
  { resource: "user", action: "view", description: "View users" },
  { resource: "user", action: "create", description: "Create user" },
  { resource: "user", action: "update", description: "Update user" },
  { resource: "user", action: "delete", description: "Delete user" },

  // News Feed
  { resource: "news", action: "view", description: "View news feed" },
  { resource: "news", action: "create", description: "Create news post" },
  { resource: "news", action: "update", description: "Update news post" },
  { resource: "news", action: "delete", description: "Delete news post" },
];

// Default roles with their permissions
const DEFAULT_ROLES = [
  {
    name: "Admin",
    description: "System administrator with full access",
    isSystem: true,
    permissions: ["*"], // All permissions
  },
  {
    name: "Нягтлан",
    description: "Санхүүгийн бүх эрх",
    isSystem: true,
    permissions: [
      "dashboard.view",
      "invoice.*",
      "payment.*",
      "account.*",
      "journal.*",
      "journal_entry.*",
      "report.*",
      "settings.view",
    ],
  },
  {
    name: "HR",
    description: "Хүний нөөцийн бүх эрх",
    isSystem: true,
    permissions: [
      "dashboard.view",
      "employee.*",
      "attendance.*",
      "payroll.*",
    ],
  },
  {
    name: "Борлуулалт",
    description: "Борлуулалтын эрх",
    isSystem: true,
    permissions: [
      "dashboard.view",
      "sales_order.*",
      "invoice.view",
      "invoice.create",
      "payment.view",
      "payment.create",
      "product.view",
      "inventory.view",
      "contact.view",
    ],
  },
  {
    name: "Агуулахын ажилтан",
    description: "Агуулахын эрх",
    isSystem: true,
    permissions: [
      "dashboard.view",
      "product.view",
      "inventory.*",
      "sales_order.view",
      "purchase_order.view",
    ],
  },
  {
    name: "Viewer",
    description: "Зөвхөн харах эрх",
    isSystem: true,
    permissions: [
      "dashboard.view",
      "employee.view",
      "product.view",
      "inventory.view",
      "sales_order.view",
      "purchase_order.view",
      "invoice.view",
      "payment.view",
      "account.view",
      "journal.view",
      "journal_entry.view",
      "report.view",
    ],
  },
];

function expandPermissions(permissionPattern: string): string[] {
  if (permissionPattern === "*") {
    return DEFAULT_PERMISSIONS.map((p) => `${p.resource}.${p.action}`);
  }

  const parts = permissionPattern.split(".");
  if (parts.length === 2 && parts[1] === "*") {
    // e.g., "invoice.*" -> all invoice permissions
    return DEFAULT_PERMISSIONS
      .filter((p) => p.resource === parts[0])
      .map((p) => `${p.resource}.${p.action}`);
  }

  return [permissionPattern];
}

async function seedPermissions() {
  console.log("📋 Seeding permissions...");

  for (const perm of DEFAULT_PERMISSIONS) {
    await db
      .insert(permissions)
      .values(perm)
      .onConflictDoNothing();
  }

  const allPermissions = await db.select().from(permissions);
  console.log(`✅ Created ${allPermissions.length} permissions`);
  return allPermissions;
}

async function seedRoles(tenantId: string, permissionMap: Map<string, string>) {
  console.log(`📋 Seeding roles for tenant ${tenantId}...`);

  const createdRoles: Array<{ id: string; name: string }> = [];

  for (const roleDef of DEFAULT_ROLES) {
    // Try to insert, if conflict then get existing
    await db
      .insert(roles)
      .values({
        tenantId,
        name: roleDef.name,
        description: roleDef.description,
        isSystem: roleDef.isSystem,
      })
      .onConflictDoNothing();

    // Get the role (either newly created or existing)
    const [role] = await db
      .select()
      .from(roles)
      .where(and(
        eq(roles.tenantId, tenantId),
        eq(roles.name, roleDef.name)
      ))
      .limit(1);

    if (role) {
      createdRoles.push({ id: role.id, name: role.name });

      // Assign permissions
      const allPermissionKeys: string[] = [];
      for (const permPattern of roleDef.permissions) {
        allPermissionKeys.push(...expandPermissions(permPattern));
      }

      for (const permKey of allPermissionKeys) {
        const [resource, action] = permKey.split(".");
        const permissionId = permissionMap.get(permKey);
        if (permissionId) {
          await db
            .insert(rolePermissions)
            .values({
              roleId: role.id,
              permissionId,
            })
            .onConflictDoNothing();
        }
      }

      console.log(`  ✅ Created role: ${role.name} (${allPermissionKeys.length} permissions)`);
    } else {
      // Role already exists, get it
      const [existing] = await db
        .select()
        .from(roles)
        .where(and(
          eq(roles.tenantId, tenantId),
          eq(roles.name, roleDef.name)
        ))
        .limit(1);
      if (existing) {
        createdRoles.push({ id: existing.id, name: existing.name });
        console.log(`  ⏭️  Role already exists: ${roleDef.name}`);
      }
    }
  }

  return createdRoles;
}

async function main() {
  try {
    console.log("🚀 Starting RBAC seed...\n");

    // 1. Seed permissions (global, not tenant-specific)
    const allPermissions = await seedPermissions();
    const permissionMap = new Map<string, string>();
    for (const perm of allPermissions) {
      permissionMap.set(`${perm.resource}.${perm.action}`, perm.id);
    }

    // 2. Seed roles for each tenant
    const allTenants = await db.select().from(tenants);
    console.log(`\n📋 Found ${allTenants.length} tenants\n`);

    for (const tenant of allTenants) {
      console.log(`\n🏢 Processing tenant: ${tenant.name} (${tenant.id})`);
      await seedRoles(tenant.id, permissionMap);
    }

    console.log("\n✅ RBAC seed completed successfully!");
  } catch (error) {
    console.error("❌ Error seeding RBAC:", error);
    process.exit(1);
  }
}

main();
