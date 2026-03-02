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

// Team-level access: Manager + Admin/HR
export function canViewTeamPerformance(role?: string | null): boolean {
    return isManager(role) || isPrivileged(role);
}
