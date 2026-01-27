/**
 * Audit Log Service
 * 
 * Helper functions to create audit logs for critical entity changes
 */

import { storage } from "./storage";
import type { DbInsertAuditLog } from "@shared/schema";

export interface AuditLogContext {
  tenantId: string | undefined;
  userId: string | undefined;
  ip?: string;
  userAgent?: string;
  requestId?: string;
}

/**
 * Create audit log entry
 */
export async function createAuditLog(
  context: AuditLogContext,
  entityType: string,
  entityId: string | null,
  action: "create" | "update" | "delete" | "post" | "reverse" | "cancel" | "approve" | "reject",
  beforeData?: any,
  afterData?: any,
  message?: string,
  status: "success" | "error" = "success"
): Promise<void> {
  try {
    // Validate required fields
    if (!context.tenantId) {
      console.error("Audit log: Missing tenantId", { context, entityType, entityId, action });
      return;
    }
    if (!context.userId) {
      console.error("Audit log: Missing userId", { context, entityType, entityId, action });
      return;
    }

    const log: DbInsertAuditLog = {
      tenantId: context.tenantId,
      actorUserId: context.userId,
      entityType,
      entityId: entityId || null,
      action,
      status,
      message: message || `${action} ${entityType}${entityId ? ` ${entityId}` : ""}`,
      beforeData: beforeData ? JSON.parse(JSON.stringify(beforeData)) : null,
      afterData: afterData ? JSON.parse(JSON.stringify(afterData)) : null,
      requestId: context.requestId || null,
      ip: context.ip || null,
      userAgent: context.userAgent || null,
    };

    await storage.createAuditLog(log);
  } catch (error) {
    // Don't throw - audit logging should not break the main flow
    console.error("Failed to create audit log:", error, { context, entityType, entityId, action });
  }
}

/**
 * Extract audit log context from Express request
 */
export function getAuditContext(req: any): AuditLogContext {
  const context = {
    tenantId: req.tenantId || req.user?.tenantId,
    userId: req.user?.id || req.user?.userId, // Try both id and userId
    ip: req.ip || req.headers["x-forwarded-for"] || req.connection?.remoteAddress,
    userAgent: req.headers["user-agent"],
    requestId: req.headers["x-request-id"] || req.id,
  };

  // Debug logging if context is missing
  if (!context.tenantId || !context.userId) {
    console.warn("Audit log context incomplete:", {
      hasTenantId: !!context.tenantId,
      hasUserId: !!context.userId,
      reqUser: req.user ? { id: req.user.id, tenantId: req.user.tenantId } : null,
      reqTenantId: req.tenantId,
    });
  }

  return context;
}
