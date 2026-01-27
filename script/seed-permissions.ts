
import { db } from "../server/db";
import { permissions, roles, rolePermissions, tenants } from "../shared/schema";
import { eq, and } from "drizzle-orm";

const CAPABILITIES = {
    invoice: ["view", "create", "edit", "delete", "post", "cancel"],
    sales_order: ["view", "create", "edit", "delete", "confirm"],
    purchase_order: ["view", "create", "edit", "delete", "confirm"],
    product: ["view", "create", "edit", "delete"],
    inventory: ["view", "create", "edit", "delete", "adjust"],
    contact: ["view", "create", "edit", "delete"],
    report: ["view", "export"],
    settings: ["view", "edit", "update"],
    user: ["view", "create", "edit", "delete"],
    role: ["view", "create", "edit", "delete"],
    journal: ["view", "create"],
    journal_entry: ["view", "create", "post", "reverse"],
    payment: ["view", "create", "update", "post"],
    payroll: ["view", "create", "approve"],
    news: ["view", "create", "update", "delete"],
    account: ["view", "create", "update"],
    tax_code: ["create"],
    document: ["create", "delete"],
} as const;

// Define role definitions
const SYSTEM_ROLES = [
    {
        name: "Admin",
        description: "Full access to all system features and settings.",
        isSystem: true,
    },
    {
        name: "Manager",
        description: "Can manage day-to-day operations, sales, and inventory.",
        isSystem: true,
    },
    {
        name: "User",
        description: "Standard access to view and process documents.",
        isSystem: true,
    },
];


async function seedPermissions() {
    console.log("🌱 Seeding permissions and roles...");

    try {
        // 0. Get Tenant
        const tenant = await db.query.tenants.findFirst();
        if (!tenant) {
            console.error("❌ No tenant found. Run 'npm run seed:admin' first.");
            console.log("Skipping role seeding...");
            process.exit(1);
        }
        const tenantId = tenant.id;
        console.log(`Using tenant: ${tenant.name} (${tenantId})`);

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

            if (roleDef.name === "Admin") {
                // Admin gets EVERYTHING
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
                    rolePerms.push(id);
                }
            } else if (roleDef.name === "User") {
                // User gets:
                // - view/create/edit for invoices, orders, products, contacts (operational)
                // - NO delete
                // - NO settings, user, role, report
                for (const [key, id] of permissionMap.entries()) {
                    const [res, act] = key.split(":");
                    if (["settings", "user", "role", "report", "payroll", "journal", "journal_entry", "account", "tax_code", "news"].includes(res)) continue;
                    if (act === "delete") continue;
                    rolePerms.push(id);
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
                console.log(`> Assigned ${rolePerms.length} permissions to ${role.name}`);
            }
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
