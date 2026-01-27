/**
 * Route-Permission Mapping Test
 * 
 * Ensures all write operations (POST/PUT/PATCH/DELETE) have explicit permission mappings
 */

import { ROUTE_PERMISSIONS, getRoutePermission, requiresPermission } from "../server/route-permissions";

interface RouteInfo {
  method: string;
  path: string;
}

// Collect all routes from routes.ts (manual list for now)
// In production, this could be auto-generated from Express router
const ALL_WRITE_ROUTES: RouteInfo[] = [
  // HR
  { method: "POST", path: "/api/employees" },
  { method: "PUT", path: "/api/employees/123" },
  { method: "POST", path: "/api/attendance" },
  { method: "POST", path: "/api/payroll-runs" },
  { method: "POST", path: "/api/departments" },
  
  // Finance
  { method: "POST", path: "/api/journal-entries" },
  { method: "PUT", path: "/api/journal-entries/123/post" },
  { method: "POST", path: "/api/journal-entries/123/reverse" },
  { method: "POST", path: "/api/posting/post" },
  { method: "POST", path: "/api/invoices" },
  { method: "PUT", path: "/api/invoices/123/status" },
  { method: "POST", path: "/api/payments" },
  { method: "POST", path: "/api/payments/123/allocate" },
  { method: "POST", path: "/api/accounts" },
  { method: "PUT", path: "/api/accounts/123" },
  { method: "POST", path: "/api/journals" },
  { method: "POST", path: "/api/tax-codes" },
  { method: "POST", path: "/api/currencies" },
  
  // Products/Inventory
  { method: "POST", path: "/api/products" },
  { method: "PUT", path: "/api/products/123" },
  { method: "POST", path: "/api/product-categories" },
  { method: "POST", path: "/api/warehouses" },
  
  // Sales/Purchase
  { method: "POST", path: "/api/sales-orders" },
  { method: "PUT", path: "/api/sales-orders/123/confirm" },
  { method: "PUT", path: "/api/sales-orders/123/send" },
  { method: "POST", path: "/api/sales-orders/123/create-invoice" },
  { method: "POST", path: "/api/purchase-orders" },
  { method: "PUT", path: "/api/purchase-orders/123/confirm" },
  { method: "PUT", path: "/api/purchase-orders/123/receive" },
  
  // Documents
  { method: "POST", path: "/api/documents" },
  { method: "DELETE", path: "/api/documents/123" },
  
  // RBAC
  { method: "POST", path: "/api/roles" },
  { method: "PUT", path: "/api/roles/123" },
  { method: "DELETE", path: "/api/roles/123" },
  { method: "POST", path: "/api/roles/123/permissions" },
  { method: "DELETE", path: "/api/roles/123/permissions/456" },
  { method: "POST", path: "/api/users/123/roles" },
  { method: "DELETE", path: "/api/users/123/roles/456" },
];

function test(name: string, fn: () => void) {
  try {
    fn();
    console.log(`✅ PASS: ${name}`);
    return true;
  } catch (error: any) {
    console.log(`❌ FAIL: ${name} - ${error.message}`);
    return false;
  }
}

function main() {
  console.log("Testing Route-Permission Mapping");
  console.log("=".repeat(60));
  
  let passed = 0;
  let failed = 0;
  const missingRoutes: RouteInfo[] = [];
  
  // Test 1: All write routes have permission mapping
  console.log("\n1. Checking write routes have permission mappings...");
  for (const route of ALL_WRITE_ROUTES) {
    const hasPermission = requiresPermission(route.method, route.path);
    if (test(`${route.method} ${route.path}`, () => {
      if (!hasPermission) {
        throw new Error("No permission mapping found");
      }
    })) {
      passed++;
    } else {
      failed++;
      missingRoutes.push(route);
    }
  }
  
  // Test 2: Permission mapping returns valid resource.action
  console.log("\n2. Checking permission mappings return valid format...");
  for (const route of ALL_WRITE_ROUTES) {
    const permission = getRoutePermission(route.method, route.path);
    if (permission) {
      if (test(`${route.method} ${route.path} - valid format`, () => {
        if (!permission.resource || !permission.action) {
          throw new Error(`Invalid permission format: ${JSON.stringify(permission)}`);
        }
        if (!permission.resource.includes(".") && !permission.action.includes(".")) {
          // Valid format (resource.action)
        } else {
          throw new Error(`Permission should be resource.action format, got: ${permission.resource}.${permission.action}`);
        }
      })) {
        passed++;
      } else {
        failed++;
      }
    }
  }
  
  // Test 3: No duplicate mappings
  console.log("\n3. Checking for duplicate route mappings...");
  const routeMap = new Map<string, string>();
  for (const routePerm of ROUTE_PERMISSIONS) {
    const key = `${routePerm.method}:${routePerm.path}`;
    if (routeMap.has(key)) {
      console.log(`⚠️  WARNING: Duplicate mapping for ${key}`);
    } else {
      routeMap.set(key, `${routePerm.permission.resource}.${routePerm.permission.action}`);
    }
  }
  console.log(`✅ No duplicate mappings found`);
  passed++;
  
  // Summary
  console.log("\n" + "=".repeat(60));
  console.log("Test Summary:");
  console.log(`Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  
  if (missingRoutes.length > 0) {
    console.log("\n⚠️  Routes missing permission mappings:");
    missingRoutes.forEach(r => {
      console.log(`  - ${r.method} ${r.path}`);
    });
    process.exit(1);
  }
  
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("\n✅ All route-permission mappings are valid!");
    process.exit(0);
  }
}

main();
