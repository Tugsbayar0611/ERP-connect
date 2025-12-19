import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertEmployee } from "@shared/schema";

export function useEmployees() {
  const queryClient = useQueryClient();

  const { data: employees, isLoading, error } = useQuery({
    queryKey: [api.employees.list.path],
    queryFn: async () => {
      const res = await fetch(api.employees.list.path);
      if (!res.ok) throw new Error("Failed to fetch employees");
      return api.employees.list.responses[200].parse(await res.json());
    },
  });

  const createEmployee = useMutation({
    mutationFn: async (data: InsertEmployee) => {
      const res = await fetch(api.employees.create.path, {
        method: api.employees.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create employee");
      return api.employees.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.employees.list.path] });
    },
  });

  const updateEmployee = useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & Partial<InsertEmployee>) => {
      const url = buildUrl(api.employees.update.path, { id });
      const res = await fetch(url, {
        method: api.employees.update.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update employee");
      return api.employees.update.responses[200].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.employees.list.path] });
    },
  });

  return {
    employees,
    isLoading,
    error,
    createEmployee,
    updateEmployee,
  };
}
