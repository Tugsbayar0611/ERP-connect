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
  { method: "DELETE", path: /^\/api\/employees\/[^/]+$/, permission: { resource: "employee", action: "delete" } },
  // Job Titles
  { method: "POST", path: "/api/job-titles", permission: { resource: "employee", action: "create" } },
  { method: "DELETE", path: /^\/api\/job-titles\/[^/]+$/, permission: { resource: "employee", action: "delete" } },

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
  { method: "GET", path: "/api/documents", permission: { resource: "document", action: "view" } },
  { method: "GET", path: /^\/api\/documents\/[^/]+$/, permission: { resource: "document", action: "view" } },
  { method: "GET", path: /^\/api\/documents\/[^/]+\/logs$/, permission: { resource: "document", action: "view" } },
  { method: "POST", path: "/api/documents", permission: { resource: "document", action: "create" } },
  { method: "POST", path: "/api/documents/upload", permission: { resource: "document", action: "create" } },
  { method: "POST", path: "/api/documents-v2", permission: { resource: "document", action: "create" } },
  { method: "POST", path: /^\/api\/documents\/[^/]+\/forward$/, permission: { resource: "document", action: "forward" } },
  { method: "POST", path: /^\/api\/documents\/[^/]+\/sign$/, permission: { resource: "document", action: "forward" } },
  { method: "PATCH", path: /^\/api\/documents\/[^/]+\/status$/, permission: { resource: "document", action: "update" } },
  { method: "PATCH", path: /^\/api\/documents\/[^/]+\/archive$/, permission: { resource: "document", action: "update" } },
  { method: "PATCH", path: /^\/api\/documents\/[^/]+$/, permission: { resource: "document", action: "update" } },
  { method: "DELETE", path: /^\/api\/documents\/[^/]+$/, permission: { resource: "document", action: "delete" } },
  { method: "POST", path: "/api/documents/bulk-delete", permission: { resource: "document", action: "delete" } },

  // === News Feed ===
  { method: "POST", path: "/api/posts", permission: { resource: "news", action: "create" } },
  { method: "PUT", path: /^\/api\/posts\/[^/]+$/, permission: { resource: "news", action: "update" } },
  { method: "DELETE", path: /^\/api\/posts\/[^/]+$/, permission: { resource: "news", action: "delete" } },

  // === E-barimt ===
  { method: "PUT", path: "/api/ebarimt/settings", permission: { resource: "settings", action: "update" } },
  { method: "POST", path: /^\/api\/invoices\/[^/]+\/ebarimt$/, permission: { resource: "invoice", action: "update" } },

  // === Missing Settings Permissions ===
  { method: "PUT", path: "/api/company", permission: { resource: "settings", action: "update" } },
  { method: "GET", path: "/api/company/settings", permission: { resource: "settings", action: "view" } },
  { method: "PUT", path: "/api/company/settings", permission: { resource: "settings", action: "update" } },
  { method: "PATCH", path: "/api/users/me/signature", permission: { resource: "profile", action: "update" } },
  { method: "POST", path: "/api/branches", permission: { resource: "settings", action: "update" } },
  { method: "PUT", path: /^\/api\/branches\/[^/]+$/, permission: { resource: "settings", action: "update" } },

  // === Performance Module ===
  { method: "POST", path: "/api/performance/periods", permission: { resource: "performance", action: "create" } },
  { method: "PATCH", path: /^\/api\/performance\/periods\/[^/]+$/, permission: { resource: "performance", action: "update" } },
  { method: "DELETE", path: /^\/api\/performance\/periods\/[^/]+$/, permission: { resource: "performance", action: "delete" } },

  { method: "POST", path: "/api/performance/goals", permission: { resource: "performance", action: "create" } },
  { method: "PATCH", path: /^\/api\/performance\/goals\/[^/]+$/, permission: { resource: "performance", action: "update" } },
  { method: "DELETE", path: /^\/api\/performance\/goals\/[^/]+$/, permission: { resource: "performance", action: "delete" } },
  // Workflow Actions
  { method: "POST", path: /^\/api\/performance\/goals\/[^/]+\/submit$/, permission: { resource: "performance", action: "update" } },
  { method: "POST", path: /^\/api\/performance\/goals\/[^/]+\/approve$/, permission: { resource: "performance", action: "update" } },
  { method: "POST", path: /^\/api\/performance\/goals\/[^/]+\/evaluate$/, permission: { resource: "performance", action: "update" } },
  { method: "POST", path: /^\/api\/performance\/goals\/[^/]+\/evidence$/, permission: { resource: "performance", action: "update" } },

  // === Safety Module ===
  // Note check if path is /api/safety or /api/api/safety due to router mounting? 
  // Based on current behaviour, assuming /api/safety is the target hit by middleware.
  { method: "GET", path: "/api/safety", permission: { resource: "safety", action: "view" } },
  { method: "POST", path: "/api/safety", permission: { resource: "safety", action: "create" } },
  { method: "PATCH", path: /^\/api\/safety\/[^/]+$/, permission: { resource: "safety", action: "update" } },
  { method: "DELETE", path: /^\/api\/safety\/[^/]+$/, permission: { resource: "safety", action: "delete" } },

  // === Leave Requests ===
  { method: "GET", path: "/api/leave-requests", permission: { resource: "leave_request", action: "view" } },
  { method: "POST", path: "/api/leave-requests", permission: { resource: "leave_request", action: "create" } },
  // Status update (Approve/Reject) - strictly for managers/HR
  { method: "PATCH", path: /^\/api\/leave-requests\/[^/]+\/status$/, permission: { resource: "leave_request", action: "approve" } },
  // General deletion (admin only usually, or strictly controlled)
  { method: "DELETE", path: /^\/api\/leave-requests\/[^/]+$/, permission: { resource: "leave_request", action: "delete" } },

  // === CRM / Contacts ===
  { method: "POST", path: "/api/contacts", permission: { resource: "contact", action: "create" } },
  { method: "PUT", path: /^\/api\/contacts\/[^/]+$/, permission: { resource: "contact", action: "update" } },
  { method: "DELETE", path: /^\/api\/contacts\/[^/]+$/, permission: { resource: "contact", action: "delete" } },
  { method: "POST", path: /^\/api\/contacts\/[^/]+\/interactions$/, permission: { resource: "contact", action: "update" } },
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
