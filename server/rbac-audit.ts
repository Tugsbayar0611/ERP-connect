/**
 * RBAC Audit Logging
 * Logs all RBAC-related changes for audit purposes
 */

import { log } from "./index";

export interface RBACAuditEvent {
  type: "role.create" | "role.update" | "role.delete" | "permission.assign" | "permission.remove" | "user.role.assign" | "user.role.remove";
  userId: string;
  tenantId: string;
  details: {
    roleId?: string;
    roleName?: string;
    permissionId?: string;
    permissionResource?: string;
    permissionAction?: string;
    targetUserId?: string;
    targetUserEmail?: string;
  };
  timestamp: Date;
}

export function logRBACEvent(event: Omit<RBACAuditEvent, "timestamp">) {
  const auditEvent: RBACAuditEvent = {
    ...event,
    timestamp: new Date(),
  };

  // Log to console (in production, this would go to a logging service)
  log(`[RBAC AUDIT] ${event.type} | User: ${event.userId} | Tenant: ${event.tenantId} | Details: ${JSON.stringify(event.details)}`, "rbac-audit");

  // In production, you would also:
  // - Write to database audit_log table
  // - Send to external logging service (e.g., CloudWatch, Datadog)
  // - Trigger alerts for sensitive operations
}
