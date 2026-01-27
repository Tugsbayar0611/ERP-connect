/**
 * Route-Permission Mapping
 * 
 * Maps API routes to required permissions
 * Format: { method, path, permission: { resource, action } }
 */

export interface RoutePermission {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  path: string | RegExp;
  permission: { resource: string; action: string };
}

/**
 * Critical write routes that require permissions
 */
export const ROUTE_PERMISSIONS: RoutePermission[] = [
  // === HR Module ===
  { method: "POST", path: "/api/employees", permission: { resource: "employee", action: "create" } },
  { method: "PUT", path: /^\/api\/employees\/[^/]+$/, permission: { resource: "employee", action: "update" } },
  { method: "POST", path: "/api/attendance", permission: { resource: "attendance", action: "create" } },
  { method: "PUT", path: /^\/api\/attendance\/[^/]+$/, permission: { resource: "attendance", action: "update" } },
  { method: "DELETE", path: /^\/api\/attendance\/[^/]+$/, permission: { resource: "attendance", action: "delete" } },
  { method: "POST", path: "/api/payroll-runs", permission: { resource: "payroll", action: "create" } },
  { method: "POST", path: "/api/payroll", permission: { resource: "payroll", action: "create" } },
  // === Departments ===
  { method: "POST", path: "/api/departments", permission: { resource: "employee", action: "create" } }, // Department is part of HR
  { method: "PUT", path: /^\/api\/departments\/[^/]+$/, permission: { resource: "employee", action: "update" } },
  { method: "DELETE", path: /^\/api\/departments\/[^/]+$/, permission: { resource: "employee", action: "delete" } },
  { method: "PUT", path: /^\/api\/departments\/[^/]+\/manager$/, permission: { resource: "employee", action: "update" } },
  { method: "POST", path: /^\/api\/departments\/[^/]+\/assign-employees$/, permission: { resource: "employee", action: "update" } },

  // === Finance Module ===
  // Journal Entries
  { method: "POST", path: "/api/journal-entries", permission: { resource: "journal_entry", action: "create" } },
  { method: "PUT", path: /^\/api\/journal-entries\/[^/]+\/post$/, permission: { resource: "journal_entry", action: "post" } },
  { method: "POST", path: /^\/api\/journal-entries\/[^/]+\/reverse$/, permission: { resource: "journal_entry", action: "reverse" } },

  // Posting Engine
  { method: "POST", path: "/api/posting/post", permission: { resource: "journal_entry", action: "post" } },

  // Invoices
  { method: "POST", path: "/api/invoices", permission: { resource: "invoice", action: "create" } },
  { method: "PUT", path: /^\/api\/invoices\/[^/]+\/status$/, permission: { resource: "invoice", action: "update" } },
  { method: "POST", path: /^\/api\/invoices\/[^/]+\/ebarimt$/, permission: { resource: "invoice", action: "update" } },
  { method: "DELETE", path: /^\/api\/invoices\/[^/]+$/, permission: { resource: "invoice", action: "delete" } },

  // Payments
  { method: "POST", path: "/api/payments", permission: { resource: "payment", action: "create" } },
  { method: "POST", path: /^\/api\/payments\/[^/]+\/allocate$/, permission: { resource: "payment", action: "create" } },

  // Accounts
  { method: "POST", path: "/api/accounts", permission: { resource: "account", action: "create" } },
  { method: "PUT", path: /^\/api\/accounts\/[^/]+$/, permission: { resource: "account", action: "update" } },

  // Journals
  { method: "POST", path: "/api/journals", permission: { resource: "journal", action: "create" } },

  // Tax Codes
  { method: "POST", path: "/api/tax-codes", permission: { resource: "tax_code", action: "create" } },

  // Currencies
  { method: "POST", path: "/api/currencies", permission: { resource: "settings", action: "update" } },

  // === Settings / RBAC ===
  { method: "POST", path: "/api/users", permission: { resource: "user", action: "create" } },
  { method: "POST", path: "/api/roles", permission: { resource: "role", action: "create" } },
  { method: "PUT", path: /^\/api\/roles\/[^/]+$/, permission: { resource: "role", action: "update" } },
  { method: "DELETE", path: /^\/api\/roles\/[^/]+$/, permission: { resource: "role", action: "delete" } },
  { method: "POST", path: /^\/api\/roles\/[^/]+\/permissions$/, permission: { resource: "role", action: "update" } },
  { method: "DELETE", path: /^\/api\/roles\/[^/]+\/permissions\/[^/]+$/, permission: { resource: "role", action: "update" } },
  { method: "POST", path: /^\/api\/users\/[^/]+\/roles$/, permission: { resource: "user", action: "update" } },
  { method: "DELETE", path: /^\/api\/users\/[^/]+\/roles\/[^/]+$/, permission: { resource: "user", action: "update" } },

  // === Products / Inventory ===
  { method: "POST", path: "/api/products", permission: { resource: "product", action: "create" } },
  { method: "PUT", path: /^\/api\/products\/[^/]+$/, permission: { resource: "product", action: "update" } },
  { method: "POST", path: "/api/product-categories", permission: { resource: "product", action: "create" } },
  { method: "POST", path: "/api/warehouses", permission: { resource: "inventory", action: "adjust" } },

  // === Sales / Purchase ===
  { method: "POST", path: "/api/sales-orders", permission: { resource: "sales_order", action: "create" } },
  { method: "PUT", path: /^\/api\/sales-orders\/[^/]+\/confirm$/, permission: { resource: "sales_order", action: "confirm" } },
  { method: "PUT", path: /^\/api\/sales-orders\/[^/]+\/send$/, permission: { resource: "sales_order", action: "update" } },
  { method: "POST", path: /^\/api\/sales-orders\/[^/]+\/create-invoice$/, permission: { resource: "invoice", action: "create" } },

  { method: "POST", path: "/api/purchase-orders", permission: { resource: "purchase_order", action: "create" } },
  { method: "PUT", path: /^\/api\/purchase-orders\/[^/]+\/confirm$/, permission: { resource: "purchase_order", action: "confirm" } },
  { method: "PUT", path: /^\/api\/purchase-orders\/[^/]+\/receive$/, permission: { resource: "purchase_order", action: "confirm" } },

  // === Documents ===
  { method: "POST", path: "/api/documents", permission: { resource: "document", action: "create" } },
  { method: "DELETE", path: /^\/api\/documents\/[^/]+$/, permission: { resource: "document", action: "delete" } },

  // === News Feed ===
  { method: "POST", path: "/api/posts", permission: { resource: "news", action: "create" } },
  { method: "PUT", path: /^\/api\/posts\/[^/]+$/, permission: { resource: "news", action: "update" } },
  { method: "DELETE", path: /^\/api\/posts\/[^/]+$/, permission: { resource: "news", action: "delete" } },

  // === E-barimt ===
  { method: "PUT", path: "/api/ebarimt/settings", permission: { resource: "settings", action: "update" } },
  { method: "POST", path: /^\/api\/invoices\/[^/]+\/ebarimt$/, permission: { resource: "invoice", action: "update" } },

  // === Missing Settings Permissions ===
  { method: "PUT", path: "/api/company", permission: { resource: "settings", action: "update" } },
  { method: "PATCH", path: "/api/users/me/signature", permission: { resource: "profile", action: "update" } },
  { method: "POST", path: "/api/branches", permission: { resource: "settings", action: "update" } },
  { method: "PUT", path: /^\/api\/branches\/[^/]+$/, permission: { resource: "settings", action: "update" } },
];

/**
 * Get required permission for a route
 */
export function getRoutePermission(method: string, path: string): { resource: string; action: string } | null {
  for (const routePerm of ROUTE_PERMISSIONS) {
    if (routePerm.method !== method) continue;

    if (typeof routePerm.path === "string") {
      if (routePerm.path === path) {
        return routePerm.permission;
      }
    } else if (routePerm.path instanceof RegExp) {
      if (routePerm.path.test(path)) {
        return routePerm.permission;
      }
    }
  }

  return null;
}

/**
 * Check if route requires permission (write operations)
 */
export function requiresPermission(method: string, path: string): boolean {
  return getRoutePermission(method, path) !== null;
}
