import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { InsertAttendanceDay, AttendanceDay } from "@shared/schema";

export function useAttendance() {
  const queryClient = useQueryClient();

  // 1. Ирцийн жагсаалт авах
  const { data: attendance, isLoading } = useQuery<AttendanceDay[]>({
    queryKey: [api.attendance.list.path],
    queryFn: async () => {
      const res = await fetch(api.attendance.list.path);
      if (!res.ok) throw new Error("Failed to fetch attendance records");
      return await res.json();
    },
  });

  // Helper to serialize dates
  const serializePayload = (data: Partial<InsertAttendanceDay>) => ({
    ...data,
    checkIn: data.checkIn ? (data.checkIn instanceof Date ? data.checkIn.toISOString() : data.checkIn) : null,
    checkOut: data.checkOut ? (data.checkOut instanceof Date ? data.checkOut.toISOString() : data.checkOut) : null,
  });

  // 2. Ирц бүртгэх (Create)
  const createAttendance = useMutation({
    mutationFn: async (data: Omit<InsertAttendanceDay, "tenantId">) => {
      const res = await fetch(api.attendance.create.path, {
        method: api.attendance.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializePayload(data)),
      });

      if (!res.ok) {
        const errorData = await res.json();
        const errorMessage = errorData.details 
          ? `${errorData.message}: ${errorData.details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(', ')}`
          : (errorData.message || "Failed to record attendance");
        throw new Error(errorMessage);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.attendance.list.path] });
    },
  });

  // 3. Ирц засах (Update)
  const updateAttendance = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<Omit<InsertAttendanceDay, "tenantId">> }) => {
      const res = await fetch(`/api/attendance/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(serializePayload(data)),
      });

      if (!res.ok) {
        const errorData = await res.json();
        const errorMessage = errorData.details 
          ? `${errorData.message}: ${errorData.details.map((d: any) => `${d.path.join('.')}: ${d.message}`).join(', ')}`
          : (errorData.message || "Failed to update attendance");
        throw new Error(errorMessage);
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.attendance.list.path] });
    },
  });

  // 4. Ирц устгах (Delete)
  const deleteAttendance = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/attendance/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to delete attendance");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.attendance.list.path] });
    },
  });

  return {
    attendance,
    isLoading,
    createAttendance,
    updateAttendance,
    deleteAttendance,
  };
}