import {
    users, tenants, branches, employees,
    roles, permissions, rolePermissions, userRoles,
    type User, type InsertUser, type Tenant, type InsertTenant, type Branch, type InsertBranch,
    type Role, type InsertRole, type Permission, type InsertPermission,
    type DbInsertUser, type DbInsertTenant, type DbInsertBranch,
} from "@shared/schema";
import { db } from "../db";
import { eq, and, desc, asc, or, like, sql, inArray, isNull } from "drizzle-orm";
import { type RoleWithPermissions } from "./interface";

export class UserStorage {
    // --- User & Auth ---
    async getUser(id: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.id, id));
        return user;
    }

    async getUserByUsername(username: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.username, username));
        return user;
    }

    async getUserByEmail(email: string): Promise<User | undefined> {
        const [user] = await db.select().from(users).where(eq(users.email, email));
        return user;
    }

    async getEmployeeByUserId(userId: string): Promise<any | undefined> {
        const [employee] = await db.select().from(employees).where(eq(employees.userId, userId));
        return employee;
    }

    async createUser(insertUser: DbInsertUser): Promise<User> {
        const [user] = await db.insert(users).values(insertUser).returning();
        return user;
    }

    async updateUser(userId: string, updates: Partial<DbInsertUser>): Promise<User> {
        const [updated] = await db
            .update(users)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(users.id, userId))
            .returning();
        if (!updated) throw new Error("User not found");
        return updated;
    }

    async updateUserLastLogin(userId: string): Promise<void> {
        await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, userId));
    }

    async getUsers(tenantId: string): Promise<User[]> {
        return await db.select().from(users).where(eq(users.tenantId, tenantId)).orderBy(users.email);
    }

    // --- RBAC ---
    async getPermissions(): Promise<Permission[]> {
        return await db.select().from(permissions).orderBy(permissions.resource, permissions.action);
    }

    async getRoles(tenantId: string): Promise<RoleWithPermissions[]> {
        const rows = await db.query.roles.findMany({
            where: eq(roles.tenantId, tenantId),
            with: {
                permissions: {
                    with: {
                        permission: true,
                    },
                },
                users: true,
            },
            orderBy: [asc(roles.name)],
        });

        return rows.map((r) => ({
            ...r,
            userCount: r.users.length,
        }));
    }

    async getRole(tenantId: string, roleId: string): Promise<RoleWithPermissions | undefined> {
        const role = await db.query.roles.findFirst({
            where: and(eq(roles.id, roleId), eq(roles.tenantId, tenantId)),
            with: {
                permissions: {
                    with: {
                        permission: true,
                    },
                },
                users: true,
            },
        });

        if (!role) return undefined;

        return {
            ...role,
            userCount: role.users.length,
        };
    }

    async createRole(tenantId: string, insertRole: InsertRole, permissionIds: string[]): Promise<Role> {
        // Transactional create
        return await db.transaction(async (tx) => {
            const [role] = await tx.insert(roles).values({ ...insertRole, tenantId }).returning();

            if (permissionIds.length > 0) {
                await tx.insert(rolePermissions).values(
                    permissionIds.map((pid) => ({
                        roleId: role.id,
                        permissionId: pid,
                    }))
                );
            }

            return role;
        });
    }

    async updateRole(roleId: string, updates: Partial<InsertRole>, permissionIds?: string[]): Promise<Role> {
        return await db.transaction(async (tx) => {
            // Update role details
            const [updatedRole] = await tx
                .update(roles)
                .set({ ...updates, updatedAt: new Date() })
                .where(eq(roles.id, roleId))
                .returning();

            if (!updatedRole) throw new Error("Role not found");

            // Update permissions if provided
            if (permissionIds !== undefined) {
                // Delete existing
                await tx.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));

                // Insert new
                if (permissionIds.length > 0) {
                    await tx.insert(rolePermissions).values(
                        permissionIds.map((pid) => ({
                            roleId: roleId,
                            permissionId: pid,
                        }))
                    );
                }
            }

            return updatedRole;
        });
    }

    async deleteRole(tenantId: string, roleId: string): Promise<void> {
        // First check if system role (frontend should block too, but safe backend check)
        const [role] = await db.select().from(roles).where(and(eq(roles.id, roleId), eq(roles.tenantId, tenantId)));
        if (role && role.isSystem) {
            throw new Error("Cannot delete system role");
        }

        // Cascade delete
        await db.delete(rolePermissions).where(eq(rolePermissions.roleId, roleId));
        await db.delete(userRoles).where(eq(userRoles.roleId, roleId));

        await db.delete(roles).where(and(eq(roles.id, roleId), eq(roles.tenantId, tenantId)));
    }

    async getUserRoles(userId: string): Promise<Role[]> {
        const rows = await db.query.userRoles.findMany({
            where: eq(userRoles.userId, userId),
            with: {
                role: true,
            },
        });
        return rows.map((r) => r.role).filter((r): r is Role => !!r);
    }

    async getUserPermissions(userId: string): Promise<Permission[]> {
        const userRoleRows = await db.query.userRoles.findMany({
            where: eq(userRoles.userId, userId),
        });

        const roleIds = userRoleRows.map((ur) => ur.roleId);

        if (roleIds.length === 0) return [];

        const rolePerms = await db.query.rolePermissions.findMany({
            where: inArray(rolePermissions.roleId, roleIds),
            with: {
                permission: true,
            },
        });

        // Deduplicate permissions
        const uniquePerms = new Map<string, Permission>();
        rolePerms.forEach((rp) => {
            uniquePerms.set(rp.permission.id, rp.permission);
        });

        return Array.from(uniquePerms.values());
    }

    async getPermission(id: string): Promise<Permission | undefined> {
        const [permission] = await db.select().from(permissions).where(eq(permissions.id, id));
        return permission;
    }

    async createPermission(insertPermission: InsertPermission): Promise<Permission> {
        const [permission] = await db.insert(permissions).values(insertPermission).returning();
        return permission;
    }

    async getRolePermissions(roleId: string): Promise<Permission[]> {
        const rows = await db
            .select({
                id: permissions.id,
                resource: permissions.resource,
                action: permissions.action,
                description: permissions.description,
            })
            .from(rolePermissions)
            .innerJoin(permissions, eq(rolePermissions.permissionId, permissions.id))
            .where(eq(rolePermissions.roleId, roleId));
        return rows;
    }

    async assignPermissionToRole(roleId: string, permissionId: string): Promise<void> {
        await db.insert(rolePermissions).values({ roleId, permissionId }).onConflictDoNothing();
    }

    async removePermissionFromRole(roleId: string, permissionId: string): Promise<void> {
        await db
            .delete(rolePermissions)
            .where(and(eq(rolePermissions.roleId, roleId), eq(rolePermissions.permissionId, permissionId)));
    }

    async assignRoleToUser(userId: string, roleId: string): Promise<void> {
        await db.insert(userRoles).values({ userId, roleId }).onConflictDoNothing();
    }

    async removeRoleFromUser(userId: string, roleId: string): Promise<void> {
        await db.delete(userRoles).where(and(eq(userRoles.userId, userId), eq(userRoles.roleId, roleId)));
    }

    // --- Tenants & Branches ---
    async getTenant(id: string): Promise<Tenant | undefined> {
        const [tenant] = await db.select().from(tenants).where(eq(tenants.id, id));
        return tenant;
    }

    async getTenantByCode(code: string): Promise<Tenant | undefined> {
        const [tenant] = await db.select().from(tenants).where(
            sql`UPPER(${tenants.code}) = UPPER(${code})`
        );
        return tenant;
    }

    async generateUniqueCompanyCode(): Promise<string> {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No O, 0, I, 1 to avoid confusion
        let code: string;
        let attempts = 0;

        do {
            // Generate format: ERP-XXXX
            let random = '';
            for (let i = 0; i < 4; i++) {
                random += chars.charAt(Math.floor(Math.random() * chars.length));
            }
            code = `ERP-${random}`;

            // Check if code exists
            const existing = await this.getTenantByCode(code);
            if (!existing) {
                return code;
            }
            attempts++;
        } while (attempts < 100);

        // Fallback: Use timestamp-based code
        return `ERP-${Date.now().toString(36).toUpperCase().slice(-4)}`;
    }

    async createTenant(insertTenant: DbInsertTenant): Promise<Tenant> {
        const [tenant] = await db.insert(tenants).values(insertTenant).returning();
        return tenant;
    }

    async updateTenant(id: string, updates: Partial<DbInsertTenant>): Promise<Tenant> {
        const [updated] = await db
            .update(tenants)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(tenants.id, id))
            .returning();
        if (!updated) {
            throw new Error("Tenant not found");
        }
        return updated;
    }

    async getUserByEmailInTenant(email: string, tenantId: string): Promise<User | undefined> {
        const normalizedEmail = email.trim().toLowerCase();
        const [user] = await db.select().from(users).where(
            and(
                sql`LOWER(${users.email}) = ${normalizedEmail}`,
                eq(users.tenantId, tenantId)
            )
        );
        return user;
    }

    async linkUserToEmployeeByEmail(userId: string, email: string, tenantId: string): Promise<void> {
        const normalizedEmail = email.trim().toLowerCase();

        // Find employee with matching email in the same tenant, not yet linked
        const matchingEmployees = await db.select().from(employees).where(
            and(
                sql`LOWER(${employees.email}) = ${normalizedEmail}`,
                eq(employees.tenantId, tenantId),
                sql`${employees.userId} IS NULL`
            )
        );

        if (matchingEmployees.length === 1) {
            // Link user to employee
            await db.update(employees)
                .set({ userId: userId, updatedAt: new Date() })
                .where(eq(employees.id, matchingEmployees[0].id));
            console.log(`Linked user ${userId} to employee ${matchingEmployees[0].id} by email match`);
        } else if (matchingEmployees.length > 1) {
            console.warn(`Multiple unlinked employees found for email ${email}, skipping auto-link`);
        }
    }

    async getBranches(tenantId: string): Promise<Branch[]> {
        return await db.select().from(branches).where(eq(branches.tenantId, tenantId));
    }

    async createBranch(insertBranch: DbInsertBranch): Promise<Branch> {
        const [branch] = await db.insert(branches).values(insertBranch).returning();
        return branch;
    }

    async updateBranch(id: string, updates: Partial<DbInsertBranch>): Promise<Branch> {
        const [updated] = await db
            .update(branches)
            .set({ ...updates, updatedAt: new Date() })
            .where(eq(branches.id, id))
            .returning();
        if (!updated) throw new Error("Branch not found");
        return updated;
    }

    async deleteBranch(id: string): Promise<void> {
        await db.delete(branches).where(eq(branches.id, id));
    }
}
