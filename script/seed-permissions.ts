
import { db } from "../server/db";
import { permissions, roles, rolePermissions, tenants } from "../shared/schema";
import { eq, and } from "drizzle-orm";

const CAPABILITIES = {
    invoice: ["view", "create", "update", "delete", "post", "cancel"],
    sales_order: ["view", "create", "update", "delete", "confirm"],
    purchase_order: ["view", "create", "update", "delete", "confirm"],
    product: ["view", "create", "update", "delete"],
    inventory: ["view", "create", "update", "delete", "adjust"],
    contact: ["view", "create", "update", "delete"],
    report: ["view", "export"],
    settings: ["view", "update"],
    user: ["view", "create", "update", "delete"],
    role: ["view", "create", "update", "delete"],
    journal: ["view", "create"],
    journal_entry: ["view", "create", "post", "reverse"],
    payment: ["view", "create", "update", "post"],
    payroll: ["view", "create", "approve"],
    news: ["view", "create", "update", "delete"],
    account: ["view", "create", "update"],
    tax_code: ["create"],
    document: ["create", "view", "forward", "delete"],
    performance: ["view", "create", "update", "delete"],
    safety: ["view", "create", "update", "delete"],
    employee: ["view", "create", "update", "delete"],
    department: ["view", "create", "update", "delete"],
    attendance: ["view", "create", "update", "delete"],

    leave_request: ["view", "create", "approve", "cancel_own", "delete"],
} as const;

// Define role definitions
const SYSTEM_ROLES = [
    {
        name: "Admin",
        description: "Full access to all system features and settings.",
        isSystem: true,
    },
    {
        name: "HR",
        description: "Full access to employee management, payroll, and safety.",
        isSystem: true,
    },
    {
        name: "Manager",
        description: "Can manage day-to-day operations, sales, and inventory.",
        isSystem: true,
    },
    {
        name: "User",
        description: "Standard employee access (Safety, News, Own Profile).",
        isSystem: true,
    },
    {
        name: "Нягтлан",
        description: "Accounting and finance access.",
        isSystem: true,
    },
    {
        name: "Борлуулалт",
        description: "Sales and customer management access.",
        isSystem: true,
    },
];


async function seedPermissions() {
    console.log("🌱 Seeding permissions and roles...");

    try {
        // 0. Get All Tenants
        const tenantsList = await db.query.tenants.findMany();
        if (tenantsList.length === 0) {
            console.error("❌ No tenants found. Run 'npm run seed:admin' first.");
            process.exit(1);
        }
        console.log(`Found ${tenantsList.length} tenants. Updating roles for all...`);


        // 1. Upsert Permissions (Global)
        const allPermissionIds: string[] = [];
        const permissionMap = new Map<string, string>(); // resource:action -> id

        for (const [resource, actions] of Object.entries(CAPABILITIES)) {
            for (const action of actions) {
                // Check if exists
                let perm = await db.query.permissions.findFirst({
                    where: and(
                        eq(permissions.resource, resource),
                        eq(permissions.action, action)
                    ),
                });

                if (!perm) {
                    const [created] = await db
                        .insert(permissions)
                        .values({
                            resource,
                            action,
                            description: `Can ${action} ${resource.replace("_", " ")}`,
                        })
                        .returning();
                    perm = created;
                    console.log(`+ Created permission: ${resource}:${action}`);
                }

                allPermissionIds.push(perm.id);
                permissionMap.set(`${resource}:${action}`, perm.id);
            }
        }

        // 2. Upsert System Roles (Per Tenant)
        for (const tenant of tenantsList) {
            const tenantId = tenant.id;
            console.log(`\nProcessing tenant: ${tenant.name} (${tenantId})`);

            for (const roleDef of SYSTEM_ROLES) {
                let role = await db.query.roles.findFirst({
                    where: and(
                        eq(roles.name, roleDef.name),
                        eq(roles.tenantId, tenantId)
                    ),
                });

                if (!role) {
                    const [created] = await db
                        .insert(roles)
                        .values({
                            ...roleDef,
                            tenantId: tenantId
                        })
                        .returning();
                    role = created;
                    console.log(`+ Created role: ${roleDef.name}`);
                } else {
                    // Ensure isSystem flag and description are up to date
                    await db.update(roles)
                        .set({ isSystem: true, description: roleDef.description })
                        .where(eq(roles.id, role.id));
                }

                // 3. Assign Permissions to Roles
                // First, clear existing permissions for this role (to ensure clean slate for system roles)
                // NOTE: Only for system roles we reset permissions on seed to enforce defaults
                await db.delete(rolePermissions).where(eq(rolePermissions.roleId, role.id));

                let rolePerms: string[] = [];

                if (roleDef.name === "Admin" || roleDef.name === "HR") {
                    // Admin and HR get EVERYTHING
                    rolePerms = allPermissionIds;
                } else if (roleDef.name === "Manager") {
                    // Manager gets everything EXCEPT:
                    // - user (create/edit/delete) - maybe view is okay
                    // - role (all)
                    // - settings (edit)
                    for (const [key, id] of permissionMap.entries()) {
                        const [res, act] = key.split(":");
                        if (res === "role") continue;
                        if (res === "user" && act !== "view") continue;
                        if (res === "settings" && (act === "edit" || act === "update")) continue;
                        if (res === "document" && act === "delete") continue;
                        rolePerms.push(id);
                    }
                } else if (roleDef.name === "User") {
                    // User (Standard Employee) gets:
                    // - Safety (view/create)
                    // - News (view/create comments)
                    // - Performance (view/evidence)
                    // - Own documents, attendance, profile
                    for (const [key, id] of permissionMap.entries()) {
                        const [res, act] = key.split(":");
                        // Exclude administrative/sensitive modules
                        if (["settings", "user", "role", "report", "payroll", "journal", "journal_entry", "account", "tax_code"].includes(res)) continue;
                        if (act === "delete") continue;
                        rolePerms.push(id);
                    }
                    // Explicitly add Leave Request permissions for User (Employee)
                    // They get: view, create, cancel_own
                    // They do NOT get: approve, delete
                    for (const [key, id] of permissionMap.entries()) {
                        if (key === "leave_request:view" || key === "leave_request:create" || key === "leave_request:cancel_own") {
                            if (!rolePerms.includes(id)) rolePerms.push(id);
                        }
                    }
                } else if (roleDef.name === "Нягтлан") {
                    // Accountant gets Finance
                    for (const [key, id] of permissionMap.entries()) {
                        const [res] = key.split(":");
                        if (["invoice", "payment", "account", "journal", "journal_entry", "tax_code", "report", "currency"].includes(res)) {
                            rolePerms.push(id);
                        }
                    }
                } else if (roleDef.name === "Борлуулалт") {
                    // Sales gets CRM & Orders
                    for (const [key, id] of permissionMap.entries()) {
                        const [res] = key.split(":");
                        if (["contact", "product", "sales_order", "invoice", "inventory"].includes(res)) {
                            rolePerms.push(id);
                        }
                    }
                }

                // Bulk insert role permissions
                if (rolePerms.length > 0) {
                    await db.insert(rolePermissions).values(
                        rolePerms.map(pid => ({
                            roleId: role!.id,
                            permissionId: pid
                        }))
                    );
                    // console.log(`> Assigned ${rolePerms.length} permissions to ${role.name}`);
                }
            }
            console.log(`> Updated roles for ${tenant.name}`);
        }

        console.log("✅ Seeding complete!");
    } catch (err) {
        console.error("❌ Seeding failed:", err);
        process.exit(1);
    } finally {
        process.exit(0);
    }
}

seedPermissions();
