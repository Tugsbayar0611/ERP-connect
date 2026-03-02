/**
 * Permission Check Middleware
 * 
 * Usage:
 * app.get("/api/invoices", requirePermission("invoice", "view"), ...)
 * app.post("/api/invoices", requirePermission("invoice", "create"), ...)
 */

import { Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { isEmployee } from "../shared/roles";

/**
 * Check if user has permission for a resource and action
 */
export async function checkPermission(
  userId: string,
  resource: string,
  action: string
): Promise<boolean> {
  try {
    const userPermissions = await storage.getUserPermissions(userId);
    return userPermissions.some(
      (p) => p.resource === resource && p.action === action
    );
  } catch (error) {
    console.error("Error checking permission:", error);
    return false;
  }
}

/**
 * Middleware factory: requirePermission(resource, action)
 * 
 * Example:
 * app.get("/api/invoices", requirePermission("invoice", "view"), handler)
 */
export function requirePermission(resource: string, action: string) {
  return async (req: any, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "Authentication required",
        code: 401,
      });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({
        error: "UNAUTHORIZED",
        message: "User not found",
        code: 401,
      });
    }

    // Admin users bypass permission checks (for now)
    // TODO: Check if user has "admin" role or system admin flag
    const userRoles = await storage.getUserRoles(userId);
    const isAdmin = userRoles.some((r) => r.name.toLowerCase() === "admin" || r.isSystem) || req.user?.role === 'admin';

    if (isAdmin) {
      return next();
    }

    const hasPermission = await checkPermission(userId, resource, action);
    if (!hasPermission) {
      // Fallback: Check if user has legacy "employee" role and allow specific resources
      // This bridges the gap for users who haven't been assigned RBAC roles yet
      if (isEmployee(req.user.role)) {
        const ALLOWED_RESOURCES = ['performance', 'attendance', 'leave_request', 'news', 'document', 'safety'];
        if (ALLOWED_RESOURCES.includes(resource)) {
          // Protect sensitive performance actions
          const SENSITIVE_ACTIONS = ['approve', 'evaluate', 'lock', 'delete'];
          if (resource === 'performance' && SENSITIVE_ACTIONS.includes(action)) {
            // Deny - only managers/admins should do these
          } else {
            return next();
          }
        }
      }

      // Standard error format for permission denied
      return res.status(403).json({
        error: "PERMISSION_DENIED",
        message: `Permission denied: ${resource}.${action}`,
        required: { resource, action },
        code: 403,
      });
    }

    next();
  };
}

/**
 * Check multiple permissions (OR logic - any one is enough)
 */
export function requireAnyPermission(...permissions: Array<{ resource: string; action: string }>) {
  return async (req: any, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not found" });
    }

    const userRoles = await storage.getUserRoles(userId);
    const isAdmin = userRoles.some((r) => r.name.toLowerCase() === "admin" || r.isSystem);

    if (isAdmin) {
      return next();
    }

    for (const perm of permissions) {
      const hasPermission = await checkPermission(userId, perm.resource, perm.action);
      if (hasPermission) {
        return next();
      }
    }

    return res.status(403).json({
      message: "Permission denied",
      required: permissions,
    });
  };
}

/**
 * Check multiple permissions (AND logic - all required)
 */
export function requireAllPermissions(...permissions: Array<{ resource: string; action: string }>) {
  return async (req: any, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "User not found" });
    }

    const userRoles = await storage.getUserRoles(userId);
    const isAdmin = userRoles.some((r) => r.name.toLowerCase() === "admin" || r.isSystem);

    if (isAdmin) {
      return next();
    }

    for (const perm of permissions) {
      const hasPermission = await checkPermission(userId, perm.resource, perm.action);
      if (!hasPermission) {
        return res.status(403).json({
          message: `Permission denied: ${perm.resource}.${perm.action}`,
          required: permissions,
        });
      }
    }

    next();
  };
}
