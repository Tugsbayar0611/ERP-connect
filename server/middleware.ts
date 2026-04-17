import { storage } from "./storage";
import { getRoutePermission } from "./route-permissions";
import { requirePermission } from "./permissions";
// export { requirePermission } from "./permissions"; // Removed to avoid circular dep

// Helper to ensure tenant context
export const requireTenant = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(403).send("No tenant associated with user");
    req.tenantId = tenantId;
    next();
};

// Helper: Get current user's employee record and role info
export const getCurrentUserContext = async (req: any) => {
    const userId = req.user?.id;
    const tenantId = req.tenantId;

    // Get user roles
    const userRoles = userId ? await storage.getUserRoles(userId) : [];
    const isAdmin = userRoles.some((r: any) => r.name.toLowerCase() === "admin" || r.isSystem);

    // Get current user's employee record
    let currentEmployee = null;
    if (userId && tenantId) {
        const employees = await storage.getEmployees(tenantId);
        currentEmployee = employees.find((e: any) =>
            e.email === req.user?.email ||
            e.userId === userId
        ) || null;
    }

    // Check if user is a department manager
    let managedDepartmentId = null;
    if (currentEmployee && tenantId) {
        const departments = await storage.getDepartments(tenantId);
        const managedDept = departments.find((d: any) => d.managerId === currentEmployee.id);
        managedDepartmentId = managedDept?.id || null;
    }

    return {
        userId,
        tenantId,
        isAdmin,
        currentEmployee,
        managedDepartmentId,
        userRoles,
    };
};

// Permission check wrapper
export const checkPermission = async (req: any, res: any, next: any) => {
    // DEFAULT-DENY: All write operations require explicit permission
    const isWriteOperation = ["POST", "PUT", "PATCH", "DELETE"].includes(req.method);

    if (isWriteOperation) {

        // Check if route has explicit permission mapping
        // Use originalUrl to get the full path including /api prefix, but strip query params
        const fullPath = req.originalUrl.split('?')[0];
        const permission = getRoutePermission(req.method, fullPath);
        console.log("fullPath", fullPath);
        console.log("permission", getRoutePermission(req.method, fullPath));
        if (!permission) {
            // No explicit permission mapping = DENY by default
            return res.status(403).json({
                message: "Permission denied: Write operations require explicit permission mapping (" + fullPath + ")",
                path: fullPath,
                method: req.method,
            });
        }

        // Special case: Allow users to create/update their own attendance without permission
        if (permission.resource === "attendance" && (permission.action === "create" || permission.action === "update")) {
            // If creating/updating attendance, check if it's for the current user's employee record
            if (req.method === "POST" && req.body?.employeeId) {
                const employees = await storage.getEmployees(req.tenantId);
                const currentEmployee = employees.find((e: any) =>
                    e.email === req.user?.email ||
                    e.userId === req.user?.id
                );

                // Allow if creating attendance for self
                if (currentEmployee && currentEmployee.id === req.body.employeeId) {
                    return next();
                }
            }

            if ((req.method === "PUT" || req.method === "PATCH") && req.params?.id) {
                const existing = await storage.getAttendanceRecord(req.params.id);
                if (existing) {
                    const employees = await storage.getEmployees(req.tenantId);
                    const currentEmployee = employees.find((e: any) =>
                        e.email === req.user?.email ||
                        e.userId === req.user?.id
                    );

                    // Allow if updating own attendance
                    if (currentEmployee && currentEmployee.id === existing.employeeId) {
                        return next();
                    }
                }
            }
        }

        // Special case: Allow users to update their own signature (profile)
        if (permission.resource === "profile" && permission.action === "update") {
            // If route contains "/users/me/signature", it's a self-update
            if (req.path.includes("/users/me/signature")) {
                return next();
            }
        }

        // Check permission using requirePermission middleware
        requirePermission(permission.resource, permission.action)(req, res, next);
    } else {
        // Read operations (GET) - allow by default if authenticated
        return next();
    }
};

// Enhanced requireTenant that also checks permissions
export const requireTenantAndPermission = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(403).send("No tenant associated with user");
    req.tenantId = tenantId;

    // Check permission after tenant is set
    checkPermission(req, res, next);
};
