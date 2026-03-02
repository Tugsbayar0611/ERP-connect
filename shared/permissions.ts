
// shared/permissions.ts

export const ROLES = ['admin', 'manager', 'hr', 'finance', 'employee', 'registry'] as const;
export type Role = (typeof ROLES)[number];

export const RESOURCES = ['roster', 'leave', 'assets', 'finance', 'settings', 'requests', 'meal', 'transport', 'worklogs'] as const;
export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = ['read', 'write', 'delete', 'approve', 'export'] as const;
export type Action = (typeof ACTIONS)[number];

export type Permission = `${Resource}.${Action}`;

export const ROLE_PERMISSIONS: Record<Role, Partial<Record<Resource, Action[]>>> = {
    admin: {
        roster: ['read', 'write', 'delete', 'export'],
        leave: ['read', 'write', 'approve', 'delete', 'export'],
        assets: ['read', 'write', 'delete', 'export'],
        finance: ['read', 'write', 'delete', 'export'],
        settings: ['read', 'write'],
        requests: ['read', 'write', 'approve', 'delete', 'export'],
        meal: ['read', 'write', 'export'],
        transport: ['read', 'write', 'export'],
        worklogs: ['read', 'write', 'approve', 'export'],
    },
    hr: {
        roster: ['read', 'write', 'export'],
        leave: ['read', 'write', 'approve', 'export'],
        assets: ['read', 'write', 'export'],
        requests: ['read', 'write', 'approve', 'export'],
        meal: ['read', 'write', 'export'],
    },
    manager: {
        roster: ['read', 'write'],      // scope: team
        leave: ['read', 'approve'],     // scope: team
        worklogs: ['read', 'approve'],  // scope: team
        requests: ['read', 'approve'],  // scope: team
    },
    finance: {
        finance: ['read', 'write', 'export'],
        leave: ['read'], // payroll visibility
        meal: ['read', 'export'],
        assets: ['read', 'export'],
    },
    employee: {
        roster: ['read'],        // scope: my
        leave: ['read', 'write'],// scope: my
        requests: ['read', 'write'], // scope: my
        meal: ['read'],          // scope: my
        transport: ['read', 'write'], // scope: my
        worklogs: ['read', 'write'],  // scope: my
    },
    registry: {
        // e.g. canteen / gate / receptionist type users
        meal: ['write', 'read'],
        transport: ['read'],
    },
};

// Normalize role to lowercase to handle "Admin" vs "admin" mismatch
export function hasPermission(role: Role, resource: Resource, action: Action): boolean {
    const normalizedRole = role.toLowerCase() as Role;
    const allowed = ROLE_PERMISSIONS[normalizedRole]?.[resource] ?? [];
    return allowed.includes(action);
}

export function hasAnyPermission(roles: Role[], resource: Resource, action: Action): boolean {
    return roles.some(role => hasPermission(role, resource, action));
}
