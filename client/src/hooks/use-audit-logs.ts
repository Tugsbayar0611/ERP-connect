import { useQuery } from "@tanstack/react-query";
import type { AuditLog } from "@shared/schema";

export interface AuditLogFilters {
  entityType?: string;
  entityId?: string;
  action?: string;
  startDate?: string;
  endDate?: string;
  limit?: number;
}

export function useAuditLogs(filters?: AuditLogFilters) {
  const queryParams = new URLSearchParams();
  if (filters?.entityType) queryParams.append("entityType", filters.entityType);
  if (filters?.entityId) queryParams.append("entityId", filters.entityId);
  if (filters?.action) queryParams.append("action", filters.action);
  if (filters?.startDate) queryParams.append("startDate", filters.startDate);
  if (filters?.endDate) queryParams.append("endDate", filters.endDate);
  if (filters?.limit) queryParams.append("limit", filters.limit.toString());

  const queryString = queryParams.toString();
  const url = `/api/audit-logs${queryString ? `?${queryString}` : ""}`;

  return useQuery<AuditLog[]>({
    queryKey: ["/api/audit-logs", filters],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch audit logs");
      return res.json();
    },
  });
}
