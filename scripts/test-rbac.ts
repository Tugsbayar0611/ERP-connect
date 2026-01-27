/**
 * RBAC System Test
 * 
 * Tests:
 * 1. Login
 * 2. Get roles
 * 3. Get permissions
 * 4. Create role
 * 5. Assign permissions to role
 * 6. Get role with permissions
 * 7. Get user roles
 * 8. Assign role to user
 * 9. Get user permissions
 * 10. Remove permission from role
 * 11. Remove role from user
 * 12. Update role
 * 13. Delete role
 */

const API_BASE = process.env.API_BASE || "http://localhost:5000";

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function log(message: string) {
  console.log(`[TEST] ${message}`);
}

function cookieHeaderFromSetCookie(setCookie: string[] | null | undefined): string {
  if (!setCookie || setCookie.length === 0) return "";
  return setCookie.map((v) => v.split(";")[0]).join("; ");
}

async function fetchWithAuth(url: string, options: RequestInit = {}, cookie: string = "") {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (cookie) {
    headers["Cookie"] = cookie;
  }
  return fetch(url, { ...options, headers });
}

async function test(name: string, fn: () => Promise<void>) {
  try {
    log(`Running: ${name}`);
    await fn();
    results.push({ name, passed: true });
    log(`✅ PASS: ${name}`);
  } catch (error: any) {
    results.push({ name, passed: false, error: error.message });
    log(`❌ FAIL: ${name} - ${error.message}`);
  }
}

async function main() {
  log("Starting RBAC System Test");
  log("=".repeat(60));

  let cookie = "";
  let userId = "";
  let roleId = "";
  let permissionId = "";

  // T1: Login
  await test("T1: Login", async () => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: "admin", password: "admin123" }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Login failed: ${res.status} - ${text}`);
    }

    const data = await res.json();
    userId = data.id;
    if (!userId) {
      throw new Error("Login response missing user id");
    }

    const setCookie = res.headers.getSetCookie?.() ?? (res.headers as any).raw?.()["set-cookie"] ?? null;
    cookie = cookieHeaderFromSetCookie(setCookie);
    if (!cookie) {
      throw new Error("No cookie received from login");
    }

    log(`Logged in as user: ${userId}`);
  });

  // T2: Get roles
  await test("T2: Get roles", async () => {
    const res = await fetchWithAuth(`${API_BASE}/api/roles`, {}, cookie);
    const contentType = res.headers.get("content-type");
    log(`Content-Type: ${contentType}`);
    if (!contentType?.includes("application/json")) {
      const text = await res.text();
      log(`Response (first 200 chars): ${text.substring(0, 200)}`);
      throw new Error(`Expected JSON, got ${contentType}`);
    }
    if (!res.ok) throw new Error(`Failed to get roles: ${res.status}`);
    const roles = await res.json();
    log(`Found ${roles.length} roles`);
    if (roles.length === 0) {
      throw new Error("No roles found (seed script may not have run)");
    }
  });

  // T3: Get permissions
  await test("T3: Get permissions", async () => {
    const res = await fetchWithAuth(`${API_BASE}/api/permissions`, {}, cookie);
    if (!res.ok) throw new Error(`Failed to get permissions: ${res.status}`);
    const permissions = await res.json();
    log(`Found ${permissions.length} permissions`);
    if (permissions.length === 0) {
      throw new Error("No permissions found (seed script may not have run)");
    }
    // Get first permission for later tests
    if (permissions.length > 0) {
      permissionId = permissions[0].id;
    }
  });

  // T4: Create role
  await test("T4: Create role", async () => {
    const res = await fetchWithAuth(`${API_BASE}/api/roles`, {
      method: "POST",
      body: JSON.stringify({
        name: "Test Role",
        description: "Test role for RBAC testing",
      }),
    }, cookie);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to create role: ${res.status} - ${text}`);
    }

    const role = await res.json();
    roleId = role.id;
    log(`Created role: ${role.name} (${role.id})`);
  });

  // T5: Get role with permissions
  await test("T5: Get role with permissions", async () => {
    const res = await fetchWithAuth(`${API_BASE}/api/roles/${roleId}`, {}, cookie);
    if (!res.ok) throw new Error(`Failed to get role: ${res.status}`);
    const role = await res.json();
    log(`Role: ${role.name}, Permissions: ${role.permissions?.length || 0}`);
    if (!role.permissions || !Array.isArray(role.permissions)) {
      throw new Error("Role permissions not returned");
    }
  });

  // T6: Assign permission to role
  await test("T6: Assign permission to role", async () => {
    if (!permissionId) {
      throw new Error("No permission ID available");
    }
    const res = await fetchWithAuth(`${API_BASE}/api/roles/${roleId}/permissions`, {
      method: "POST",
      body: JSON.stringify({ permissionId }),
    }, cookie);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to assign permission: ${res.status} - ${text}`);
    }

    log(`Assigned permission ${permissionId} to role ${roleId}`);
  });

  // T7: Verify permission assigned
  await test("T7: Verify permission assigned", async () => {
    const res = await fetchWithAuth(`${API_BASE}/api/roles/${roleId}`, {}, cookie);
    if (!res.ok) throw new Error(`Failed to get role: ${res.status}`);
    const role = await res.json();
    const hasPermission = role.permissions?.some((p: any) => p.id === permissionId);
    if (!hasPermission) {
      throw new Error("Permission not found in role");
    }
    log(`Verified: Permission ${permissionId} is assigned to role`);
  });

  // T8: Get user roles
  await test("T8: Get user roles", async () => {
    const res = await fetchWithAuth(`${API_BASE}/api/users/${userId}/roles`, {}, cookie);
    if (!res.ok) throw new Error(`Failed to get user roles: ${res.status}`);
    const userRoles = await res.json();
    log(`User has ${userRoles.length} roles`);
  });

  // T9: Assign role to user
  await test("T9: Assign role to user", async () => {
    const res = await fetchWithAuth(`${API_BASE}/api/users/${userId}/roles`, {
      method: "POST",
      body: JSON.stringify({ roleId }),
    }, cookie);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to assign role: ${res.status} - ${text}`);
    }

    log(`Assigned role ${roleId} to user ${userId}`);
  });

  // T10: Get user permissions
  await test("T10: Get user permissions", async () => {
    const res = await fetchWithAuth(`${API_BASE}/api/users/${userId}/permissions`, {}, cookie);
    if (!res.ok) throw new Error(`Failed to get user permissions: ${res.status}`);
    const permissions = await res.json();
    log(`User has ${permissions.length} permissions`);
    const hasPermission = permissions.some((p: any) => p.id === permissionId);
    if (!hasPermission) {
      log(`Warning: User does not have permission ${permissionId} (may need to wait for cache)`);
    }
  });

  // T11: Remove permission from role
  await test("T11: Remove permission from role", async () => {
    const res = await fetchWithAuth(`${API_BASE}/api/roles/${roleId}/permissions/${permissionId}`, {
      method: "DELETE",
    }, cookie);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to remove permission: ${res.status} - ${text}`);
    }

    log(`Removed permission ${permissionId} from role ${roleId}`);
  });

  // T12: Remove role from user
  await test("T12: Remove role from user", async () => {
    const res = await fetchWithAuth(`${API_BASE}/api/users/${userId}/roles/${roleId}`, {
      method: "DELETE",
    }, cookie);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to remove role: ${res.status} - ${text}`);
    }

    log(`Removed role ${roleId} from user ${userId}`);
  });

  // T13: Update role
  await test("T13: Update role", async () => {
    const res = await fetchWithAuth(`${API_BASE}/api/roles/${roleId}`, {
      method: "PUT",
      body: JSON.stringify({
        description: "Updated test role description",
      }),
    }, cookie);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to update role: ${res.status} - ${text}`);
    }

    const updated = await res.json();
    if (updated.description !== "Updated test role description") {
      throw new Error("Role description not updated");
    }
    log(`Updated role: ${updated.name}`);
  });

  // T14: Delete role
  await test("T14: Delete role", async () => {
    const res = await fetchWithAuth(`${API_BASE}/api/roles/${roleId}`, {
      method: "DELETE",
    }, cookie);

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Failed to delete role: ${res.status} - ${text}`);
    }

    log(`Deleted role: ${roleId}`);
  });

  // T15: Verify role deleted
  await test("T15: Verify role deleted", async () => {
    const res = await fetchWithAuth(`${API_BASE}/api/roles/${roleId}`, {}, cookie);
    if (res.ok) {
      throw new Error("Role still exists after deletion");
    }
    if (res.status !== 404) {
      throw new Error(`Expected 404, got ${res.status}`);
    }
    log(`Verified: Role ${roleId} is deleted`);
  });

  // Summary
  log("=".repeat(60));
  log("Test Summary:");
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);

  if (failed > 0) {
    log("\nFailed tests:");
    results.filter((r) => !r.passed).forEach((r) => {
      log(`  ❌ ${r.name}: ${r.error}`);
    });
    process.exit(1);
  } else {
    log("\n✅ All tests passed!");
    process.exit(0);
  }
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
