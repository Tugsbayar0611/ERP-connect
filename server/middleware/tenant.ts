
import type { Request, Response, NextFunction } from "express";

export function requireTenant(req: Request, res: Response, next: NextFunction) {
    const tenantId = (req as any).user?.tenantId;
    if (!tenantId) {
        // In strict production, this is a 401/403.
        // Ensure this middleware is placed AFTER authentication middleware (passport/session)
        return res.status(401).json({ error: "TENANT_REQUIRED" });
    }

    (req as any).tenantId = tenantId;
    next();
}
