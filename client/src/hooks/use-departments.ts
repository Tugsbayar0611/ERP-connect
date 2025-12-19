import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { InsertDepartment } from "@shared/schema";

export function useDepartments() {
  const queryClient = useQueryClient();

  const { data: departments, isLoading } = useQuery({
    queryKey: [api.departments.list.path],
    queryFn: async () => {
      const res = await fetch(api.departments.list.path);
      if (!res.ok) throw new Error("Failed to fetch departments");
      return api.departments.list.responses[200].parse(await res.json());
    },
  });

  const createDepartment = useMutation({
    mutationFn: async (data: InsertDepartment) => {
      const res = await fetch(api.departments.create.path, {
        method: api.departments.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create department");
      return api.departments.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.departments.list.path] });
    },
  });

  return {
    departments,
    isLoading,
    createDepartment,
  };
}
