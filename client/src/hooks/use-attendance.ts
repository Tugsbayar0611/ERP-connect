import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { InsertAttendance } from "@shared/schema";

export function useAttendance() {
  const queryClient = useQueryClient();

  const { data: attendance, isLoading } = useQuery({
    queryKey: [api.attendance.list.path],
    queryFn: async () => {
      const res = await fetch(api.attendance.list.path);
      if (!res.ok) throw new Error("Failed to fetch attendance records");
      return api.attendance.list.responses[200].parse(await res.json());
    },
  });

  const logAttendance = useMutation({
    mutationFn: async (data: InsertAttendance) => {
      const res = await fetch(api.attendance.create.path, {
        method: api.attendance.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to log attendance");
      return api.attendance.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.attendance.list.path] });
    },
  });

  return {
    attendance,
    isLoading,
    logAttendance,
  };
}
