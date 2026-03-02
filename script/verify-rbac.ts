/**
 * RBAC Verification Script
 * Tests backend endpoint security for Employee vs Admin roles.
 * Run with: npx tsx script/verify-rbac.ts
 */

const BASE_URL = "http://localhost:5000";

// Colors for console output
const colors = {
    reset: "\x1b[0m",
    green: "\x1b[32m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    blue: "\x1b[34m",
    cyan: "\x1b[36m",
};

interface TestResult {
    endpoint: string;
    expected: number;
    actual: number;
    pass: boolean;
}

const results: TestResult[] = [];

async function login(username: string, password: string): Promise<string> {
    const res = await fetch(`${BASE_URL}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
        throw new Error(`Login failed for ${username}: ${res.status} ${res.statusText}`);
    }

    const cookies = res.headers.get("set-cookie");
    return cookies || "";
}

async function testEndpoint(
    role: string,
    cookie: string,
    method: string,
    path: string,
    expectedStatus: number,
    description: string
): Promise<boolean> {
    const label = `[${role}] ${method} ${path}`;
    process.stdout.write(`  ${label.padEnd(50)} `);

    try {
        const res = await fetch(`${BASE_URL}${path}`, {
            method,
            headers: {
                Cookie: cookie,
                "Content-Type": "application/json",
            },
        });

        const pass = res.status === expectedStatus;
        results.push({ endpoint: label, expected: expectedStatus, actual: res.status, pass });

        if (pass) {
            console.log(`${colors.green}✓ PASS (${res.status})${colors.reset}`);
        } else {
            console.log(`${colors.red}✗ FAIL (Expected ${expectedStatus}, got ${res.status})${colors.reset}`);
        }
        return pass;
    } catch (error: any) {
        console.log(`${colors.red}✗ ERROR: ${error.message}${colors.reset}`);
        results.push({ endpoint: label, expected: expectedStatus, actual: -1, pass: false });
        return false;
    }
}

async function runVerification() {
    console.log(`\n${colors.blue}════════════════════════════════════════════════════════════${colors.reset}`);
    console.log(`${colors.blue}       RBAC Security Verification Script${colors.reset}`);
    console.log(`${colors.blue}════════════════════════════════════════════════════════════${colors.reset}\n`);
    console.log(`Target: ${BASE_URL}\n`);

    try {
        // ═══════════════════════════════════════════════════════════════
        // 1. ADMIN LOGIN
        // ═══════════════════════════════════════════════════════════════
        console.log(`${colors.cyan}[1/3] Admin Login & Tests${colors.reset}`);
        let adminCookie: string;
        try {
            adminCookie = await login("admin", "admin123");
            console.log(`  ${colors.green}✓ Admin logged in${colors.reset}\n`);
        } catch (e) {
            console.error(`  ${colors.red}✗ Failed to login as admin. Is server running? (admin/admin123)${colors.reset}`);
            process.exit(1);
        }

        // Admin should have access to everything
        console.log(`${colors.cyan}  Admin Access Tests:${colors.reset}`);
        await testEndpoint("Admin", adminCookie, "GET", "/api/employees", 200, "List all employees");
        await testEndpoint("Admin", adminCookie, "GET", "/api/payroll-runs", 200, "View payroll runs");
        await testEndpoint("Admin", adminCookie, "GET", "/api/payroll", 200, "View payroll list");
        await testEndpoint("Admin", adminCookie, "GET", "/api/attendance", 200, "View all attendance");
        await testEndpoint("Admin", adminCookie, "GET", "/api/payslips", 200, "View all payslips");
        await testEndpoint("Admin", adminCookie, "GET", "/api/me", 200, "View own profile");

        // ═══════════════════════════════════════════════════════════════
        // 2. EMPLOYEE LOGIN
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n${colors.cyan}[2/3] Employee Login & Tests${colors.reset}`);
        console.log(`  ${colors.yellow}Note: Create employee with email 'test.employee@example.com' and password 'password123'${colors.reset}`);

        let empCookie: string;
        let employeeId: string | null = null;

        try {
            empCookie = await login("test.employee@example.com", "password123");
            console.log(`  ${colors.green}✓ Employee logged in${colors.reset}\n`);

            // Get employee's own ID
            const meRes = await fetch(`${BASE_URL}/api/me`, {
                headers: { Cookie: empCookie },
            });
            if (meRes.ok) {
                const meData = await meRes.json();
                employeeId = meData.employee?.id;
                console.log(`  ${colors.cyan}Employee ID: ${employeeId || "Not linked"}${colors.reset}\n`);
            }

            // Employee should be DENIED admin-only endpoints
            console.log(`${colors.cyan}  Employee Restriction Tests (should be 403):${colors.reset}`);
            await testEndpoint("Employee", empCookie, "GET", "/api/payroll-runs", 403, "DENIED: payroll runs");
            await testEndpoint("Employee", empCookie, "GET", "/api/payroll", 403, "DENIED: payroll list");

            // Employee should be ALLOWED self-only endpoints
            console.log(`\n${colors.cyan}  Employee Self-Access Tests (should be 200):${colors.reset}`);
            await testEndpoint("Employee", empCookie, "GET", "/api/me", 200, "View own profile");
            await testEndpoint("Employee", empCookie, "GET", "/api/employees", 200, "View directory (filtered)");
            await testEndpoint("Employee", empCookie, "GET", "/api/payslips", 200, "View own payslips");
            await testEndpoint("Employee", empCookie, "GET", "/api/attendance", 200, "View own attendance");

            // Employee should be DENIED access to other employee's data
            console.log(`\n${colors.cyan}  Employee Cross-Access Tests (should be 403):${colors.reset}`);
            // Use a fake UUID that's definitely not the employee's
            const otherEmployeeId = "00000000-0000-0000-0000-000000000000";
            await testEndpoint("Employee", empCookie, "GET", `/api/employees/${otherEmployeeId}`, 403, "DENIED: other employee detail");

            // Employee accessing own detail should work
            if (employeeId) {
                console.log(`\n${colors.cyan}  Employee Own Detail Test:${colors.reset}`);
                await testEndpoint("Employee", empCookie, "GET", `/api/employees/${employeeId}`, 200, "View own employee detail");
            }

        } catch (e: any) {
            console.log(`  ${colors.yellow}⚠ Skipping Employee tests: ${e.message}${colors.reset}`);
            console.log(`  ${colors.yellow}  To test, create an employee with:${colors.reset}`);
            console.log(`  ${colors.yellow}  - Email: test.employee@example.com${colors.reset}`);
            console.log(`  ${colors.yellow}  - Password: password123${colors.reset}`);
            console.log(`  ${colors.yellow}  - Check "Create Login" when adding employee${colors.reset}`);
        }

        // ═══════════════════════════════════════════════════════════════
        // 3. SUMMARY
        // ═══════════════════════════════════════════════════════════════
        console.log(`\n${colors.blue}════════════════════════════════════════════════════════════${colors.reset}`);
        console.log(`${colors.blue}       Test Summary${colors.reset}`);
        console.log(`${colors.blue}════════════════════════════════════════════════════════════${colors.reset}\n`);

        const passed = results.filter((r) => r.pass).length;
        const failed = results.filter((r) => !r.pass).length;
        const total = results.length;

        console.log(`  Total Tests: ${total}`);
        console.log(`  ${colors.green}Passed: ${passed}${colors.reset}`);
        console.log(`  ${colors.red}Failed: ${failed}${colors.reset}`);

        if (failed > 0) {
            console.log(`\n${colors.red}  Failed Tests:${colors.reset}`);
            results
                .filter((r) => !r.pass)
                .forEach((r) => {
                    console.log(`    - ${r.endpoint}: Expected ${r.expected}, got ${r.actual}`);
                });
        }

        console.log(`\n${colors.blue}════════════════════════════════════════════════════════════${colors.reset}\n`);

        process.exit(failed > 0 ? 1 : 0);
    } catch (error) {
        console.error("Verification script error:", error);
        process.exit(1);
    }
}

runVerification();
