import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { InsertDepartment, Department } from "@shared/schema"; // Department type нэмэхээ мартуузай

export function useDepartments() {
  const queryClient = useQueryClient();

  // 1. Хэлтсийн жагсаалт авах
  const {
    data: departments = [],
    isLoading,
    isError,
    error,
  } = useQuery<Department[]>({
    queryKey: [api.departments.list.path],
    queryFn: async () => {
      const res = await fetch(api.departments.list.path);
      if (!res.ok) {
        throw new Error("Хэлтсүүдийг ачааллахад алдаа гарлаа");
      }
      return api.departments.list.responses[200].parse(await res.json());
    },
    staleTime: 5 * 60 * 1000, // 5 минут кэш хадгалах (заавал биш, гэхдээ сайн практик)
  });

  // 2. Хэлтэс нэмэх
  const createDepartment = useMutation<Department, Error, Omit<InsertDepartment, "tenantId">>({
    mutationFn: async (data) => {
      const res = await fetch(api.departments.create.path, {
        method: api.departments.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Хэлтэс нэмэхэд алдаа гарлаа");
      }

      return api.departments.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.departments.list.path] });
    },
  });

  // 3. Хэлтэс засах (UPDATE) – Ирээдүйд хэрэг болно
  const updateDepartment = useMutation<
    Department,
    Error,
    { id: string; data: Partial<InsertDepartment> }
  >({
    mutationFn: async ({ id, data }) => {
      const res = await fetch(`/api/departments/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Хэлтэс засахад алдаа гарлаа");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.departments.list.path] });
    },
  });

  // 4. Хэлтэс устгах (DELETE) – Админ л ашиглана
  const deleteDepartment = useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const res = await fetch(`/api/departments/${id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Хэлтэс устгахад алдаа гарлаа");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.departments.list.path] });
    },
  });

  return {
    departments,
    isLoading,
    isError,
    error,
    createDepartment,
    updateDepartment, // 👈 Шинээр нэмэгдсэн
    deleteDepartment, // 👈 Шинээр нэмэгдсэн
  };
}