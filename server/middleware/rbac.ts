
import type { Request, Response, NextFunction } from "express";
import { hasPermission, type Role, type Resource, type Action } from "../../shared/permissions";

/**
 * Middleware to enforce Role-Based Access Control.
 * Assumes req.user is populated and has a 'roles' array or 'role' string.
 */
export function requirePermission(resource: Resource, action: Action) {
    return (req: Request, res: Response, next: NextFunction) => {
        // Normalize user roles to an array
        const userRole = (req as any).user?.role;
        let roles: Role[] = (req as any).user?.roles ?? [];

        if (userRole && !roles.includes(userRole)) {
            roles.push(userRole);
        }

        // Add default role if none
        if (!roles.length) {
            // Fallback: check if we should default to 'employee' or reject?
            // For now, strict reject if no role found
            return res.status(403).json({ error: "FORBIDDEN_NO_ROLE" });
        }

        const ok = roles.some((r) => hasPermission(r, resource, action));

        if (!ok) {
            return res.status(403).json({ error: "FORBIDDEN_INSUFFICIENT_PERMISSIONS" });
        }

        next();
    };
}

/**
 * Middleware to flag the required scope for the controller to enforce.
 * (ABAC Implementation helper)
 */
export function requireScope(scope: "my" | "team" | "department" | "company") {
    return (req: Request, _res: Response, next: NextFunction) => {
        (req as any).requiredScope = scope;
        next();
    };
}
