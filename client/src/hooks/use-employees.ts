import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { InsertEmployee, JobTitle } from "@shared/schema";
import { handleApiError, extractErrorMessage } from "@/lib/api-error-handler";
import { useAuth } from "@/hooks/use-auth";
import type { Employee } from "@shared/schema";

export function useJobTitles(options?: { isActive?: boolean }) {
  const queryClient = useQueryClient();

  const query = useQuery<JobTitle[]>({
    queryKey: ["/api/job-titles", options?.isActive],
    queryFn: async () => {
      const url = new URL("/api/job-titles", window.location.origin);
      if (options?.isActive !== undefined) {
        url.searchParams.append("isActive", options.isActive.toString());
      }
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to fetch job titles");
      return res.json();
    }
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/job-titles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive }),
      });
      if (!res.ok) throw new Error("Status update failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/job-titles"] });
    }
  });

  return {
    ...query,
    toggleStatus
  };
}

export function useEmployees() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  // 1. Ажилчдын жагсаалт авах
  const { data: employees, isLoading } = useQuery<Employee[]>({
    queryKey: [api.employees.list.path, user?.id],
    enabled: !!user,
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
      const results = await Promise.all(
        ids.map(async (id) => {
          const res = await fetch(`/api/employees/${id}`, {
            method: "DELETE",
            credentials: "include",
          });
          if (!res.ok) {
            const errorMessage = await extractErrorMessage(res);
            throw new Error(errorMessage || `Ажилтан устгахад алдаа гарлаа: ${id}`);
          }
          return id;
        })
      );
      return results;
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