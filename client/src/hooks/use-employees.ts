import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { InsertEmployee, Employee } from "@shared/schema";
import { handleApiError, extractErrorMessage } from "@/lib/api-error-handler";

export function useEmployees() {
  const queryClient = useQueryClient();

  // 1. Ажилчдын жагсаалт авах
  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: [api.employees.list.path],
    queryFn: async () => {
      const res = await fetch(api.employees.list.path);
      if (!res.ok) {
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Ажилчдын жагсаалт авахад алдаа гарлаа");
      }
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
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Ажилтан нэмэхэд алдаа гарлаа");
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
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Ажилтан засахад алдаа гарлаа");
      }
      return await res.json();
    },
    onSuccess: () => {
      // Амжилттай бол жагсаалтыг шинэчлэх
      queryClient.invalidateQueries({ queryKey: [api.employees.list.path] });
    },
  });

  // 4. Ажилтан устгах (DELETE)
  const deleteEmployee = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employees/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Ажилтан устгахад алдаа гарлаа");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.employees.list.path] });
    },
  });

  // 5. Олон ажилтан устгах (BULK DELETE)
  const deleteEmployees = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map(id => 
          fetch(`/api/employees/${id}`, {
            method: "DELETE",
            credentials: "include",
          })
        )
      );
      const failed = results.filter(r => r.status === "rejected");
      if (failed.length > 0) {
        throw new Error(`${failed.length} ажилтан устгахад алдаа гарлаа`);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.employees.list.path] });
    },
  });

  return {
    employees,
    isLoading,
    createEmployee,
    updateEmployee,
    deleteEmployee,
    deleteEmployees,
  };
}