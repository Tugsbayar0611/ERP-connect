import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { InsertEmployee, Employee } from "@shared/schema";

export function useEmployees() {
  const queryClient = useQueryClient();

  // 1. Ажилчдын жагсаалт авах
  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: [api.employees.list.path],
    queryFn: async () => {
      const res = await fetch(api.employees.list.path);
      if (!res.ok) throw new Error("Failed to fetch employees");
      return await res.json();
    },
  });

  // 2. Ажилтан нэмэх
  const createEmployee = useMutation({
    mutationFn: async (data: Omit<InsertEmployee, "tenantId">) => {
      const res = await fetch(api.employees.create.path, {
        method: api.employees.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create employee");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.employees.list.path] });
    },
  });

  // 👇 3. Ажилтан засах (UPDATE) - ЭНИЙГ ЗААВАЛ НЭМЭХ ЁСТОЙ
  const updateEmployee = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertEmployee> }) => {
      // API руу PUT хүсэлт илгээх
      const res = await fetch(`/api/employees/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update employee");
      }
      return await res.json();
    },
    onSuccess: () => {
      // Амжилттай бол жагсаалтыг шинэчлэх
      queryClient.invalidateQueries({ queryKey: [api.employees.list.path] });
    },
  });

  return {
    employees,
    isLoading,
    createEmployee,
    updateEmployee, // 👈 Энийг буцааж байгаа эсэхээ шалгаарай
  };
}