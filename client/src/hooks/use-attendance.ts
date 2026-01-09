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

  // 2. Ирц бүртгэх (Check-in)
  const createAttendance = useMutation({
    mutationFn: async (data: Omit<InsertAttendanceDay, "tenantId">) => {
      const res = await fetch(api.attendance.create.path, {
        method: api.attendance.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to record attendance");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.attendance.list.path] });
    },
  });

  return {
    attendance,
    isLoading,
    createAttendance,
  };
}