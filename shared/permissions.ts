
// shared/permissions.ts

export const ROLES = ['admin', 'manager', 'hr', 'finance', 'employee', 'registry', 'warehouse'] as const;
export type Role = (typeof ROLES)[number];

export const RESOURCES = ['roster', 'leave', 'assets', 'finance', 'settings', 'requests', 'meal', 'transport', 'worklogs', 'workwear'] as const;
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
        workwear: ['read', 'write', 'delete', 'approve', 'export'], // Full access
    },
    hr: {
        roster: ['read', 'write', 'export'],
        leave: ['read', 'write', 'approve', 'export'],
        assets: ['read', 'write', 'export'],
        requests: ['read', 'write', 'approve', 'export'],
        meal: ['read', 'write', 'export'],
        workwear: ['read', 'write', 'approve', 'export'], // Grant entitlements, templates, reports
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
        workwear: ['read'],      // scope: my only
    },
    registry: {
        // e.g. canteen / gate / receptionist type users
        meal: ['write', 'read'],
        transport: ['read'],
    },
    warehouse: {
        workwear: ['write', 'read'], // Collect items, view granted list
        // write = can mark as collected; read = can view employee grants
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
