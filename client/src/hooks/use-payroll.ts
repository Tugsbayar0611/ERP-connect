import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { InsertPayroll } from "@shared/schema";

export function usePayroll() {
  const queryClient = useQueryClient();

  const { data: payroll, isLoading } = useQuery({
    queryKey: [api.payroll.list.path],
    queryFn: async () => {
      const res = await fetch(api.payroll.list.path);
      if (!res.ok) throw new Error("Failed to fetch payroll records");
      return api.payroll.list.responses[200].parse(await res.json());
    },
  });

  const createPayroll = useMutation({
    mutationFn: async (data: InsertPayroll) => {
      const res = await fetch(api.payroll.create.path, {
        method: api.payroll.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to process payroll");
      return api.payroll.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.payroll.list.path] });
    },
  });

  return {
    payroll,
    isLoading,
    createPayroll,
  };
}
