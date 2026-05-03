export function normalizeRole(role?: string | null): string {
    return (role || "").trim().toLowerCase();
}

export function isAdmin(role?: string | null): boolean {
    return normalizeRole(role) === "admin";
}

export function isHR(role?: string | null): boolean {
    const r = normalizeRole(role);
    return r === "hr" || r === "admin";
}

export function isEmployee(role?: string | null): boolean {
    const r = normalizeRole(role);
    return r === "employee" || r === "user";
}

export function isManager(role?: string | null): boolean {
    const r = normalizeRole(role);
    return r === "manager";
}

export function isPrivileged(role?: string | null): boolean {
    const r = normalizeRole(role);
    return r === "admin" || r === "hr";
}

export function isWarehouse(role?: string | null): boolean {
    return normalizeRole(role) === "warehouse";
}

// Check if user has warehouse access (via userRoles array or primary role)
export function hasWarehouseAccess(primaryRole?: string | null, userRoles?: { name: string }[]): boolean {
    if (isWarehouse(primaryRole) || isPrivileged(primaryRole)) return true;
    return userRoles?.some(r => normalizeRole(r.name) === "warehouse") ?? false;
}

// Team-level access: Manager + Admin/HR
export function canViewTeamPerformance(role?: string | null): boolean {
    return isManager(role) || isPrivileged(role);
}
