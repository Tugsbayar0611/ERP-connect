
import { db } from "../server/db";
import { permissions, rolePermissions, roles } from "@shared/schema";
import { eq, and } from "drizzle-orm";

async function main() {
    console.log("Seeding requests permissions...");

    const PERMISSIONS = [
        { resource: "requests", action: "view_my", description: "View own requests" },
        { resource: "requests", action: "create", description: "Create new requests" },
        { resource: "requests", action: "view_approvals", description: "View requests requiring approval" },
        { resource: "requests", action: "approve", description: "Approve/Reject requests" },
    ];

    // 1. Create Permissions if they don't exist
    for (const p of PERMISSIONS) {
        const existing = await db.query.permissions.findFirst({
            where: and(
                eq(permissions.resource, p.resource),
                eq(permissions.action, p.action)
            ),
        });

        if (!existing) {
            const [newPerm] = await db.insert(permissions).values(p).returning();
            console.log(`Created permission: ${p.resource}:${p.action}`);
        } else {
            console.log(`Permission exists: ${p.resource}:${p.action}`);
        }
    }

    // 2. Assign to Roles (Fetch roles for a known tenant or all system roles?)
    // Assuming we want to assign to "Employee", "Manager", "Admin" roles generally.
    // Since roles are tenant-scoped, we might need a more robust approach or just run for a specific dev tenant.
    // For now, let's just make sure the Permissions exist in the global table (if permissions table is global).
    // Schema check: permissions table does NOT have tenantId, so it is global. Roles DO have tenantId.

    // Assignment Strategy:
    // - Admin (System/Tenant): All
    // - Manager: view_my, create, view_approvals, approve
    // - Employee: view_my, create

    // We can't automatically assign to all tenants' roles safely without iterating all tenants.
    // BUT we can iterate all roles named "Admin", "Manager", "Employee" across all tenants if appropriate.

    const allRoles = await db.select().from(roles);

    const perms = await db.select().from(permissions).where(eq(permissions.resource, "requests"));
    const viewMy = perms.find(p => p.action === "view_my");
    const create = perms.find(p => p.action === "create");
    const viewApprovals = perms.find(p => p.action === "view_approvals");
    const approve = perms.find(p => p.action === "approve");

    if (!viewMy || !create || !viewApprovals || !approve) {
        console.error("Permissions missing after creation!");
        return;
    }

    let assignedCount = 0;

    for (const role of allRoles) {
        const roleName = role.name.toLowerCase();

        // Admin
        if (roleName === "admin" || (role.isSystem && roleName === "admin")) {
            await assign(role.id, [viewMy.id, create.id, viewApprovals.id, approve.id]);
        }
        // Manager
        else if (roleName === "manager" || roleName === "sales manager" || roleName.includes("manager")) {
            await assign(role.id, [viewMy.id, create.id, viewApprovals.id, approve.id]);
        }
        // Employee / HR
        else if (roleName === "employee" || roleName === "hr") {
            // HR usually can approve too
            if (roleName === "hr") {
                await assign(role.id, [viewMy.id, create.id, viewApprovals.id, approve.id]);
            } else {
                await assign(role.id, [viewMy.id, create.id]);
            }
        }
    }

    console.log(`Assigned permissions to roles.`);
    process.exit(0);
}

async function assign(roleId: number | string, permIds: (number | string)[]) {
    for (const pid of permIds) {
        // IDs in schema are string (uuid) usually, check schema.
        // Assuming string.
        await db.insert(rolePermissions).values({
            roleId: roleId as string,
            permissionId: pid as string
        }).onConflictDoNothing();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
