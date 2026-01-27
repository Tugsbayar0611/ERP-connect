import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { InsertDepartment, Department } from "@shared/schema";

// Department with stats type
export type DepartmentWithStats = Department & {
  employeeCount: number;
  attendanceKPI: number; // Today's attendance percentage (0-100)
  manager: {
    id: string;
    firstName: string;
    lastName: string | null;
    employeeNo: string | null;
  } | null;
  topEmployees: Array<{
    id: string;
    firstName: string;
    lastName: string | null;
    employeeNo: string | null;
  }>;
};

export function useDepartments() {
  const queryClient = useQueryClient();

  // 1. Хэлтсийн жагсаалт авах (without stats)
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
    staleTime: 5 * 60 * 1000,
  });

  // 2. Хэлтсийн жагсаалт авах (with stats) - for card layout
  const {
    data: departmentsWithStats = [],
    isLoading: isLoadingStats,
    isError: isErrorStats,
    error: errorStats,
  } = useQuery<DepartmentWithStats[]>({
    queryKey: [api.departments.list.path, "stats"],
    queryFn: async () => {
      const res = await fetch(`${api.departments.list.path}?stats=true`);
      if (!res.ok) {
        throw new Error("Хэлтсүүдийг статистиктай ачааллахад алдаа гарлаа");
      }
      return await res.json();
    },
    staleTime: 5 * 60 * 1000,
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
      // Invalidate both regular and stats queries
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
      // Invalidate both regular and stats queries
      queryClient.invalidateQueries({ queryKey: [api.departments.list.path] });
    },
  });

  // 5. Batch assign employees to department
  const batchAssignEmployees = useMutation<void, Error, { departmentId: string; employeeIds: string[] }>({
    mutationFn: async ({ departmentId, employeeIds }) => {
      const res = await fetch(`/api/departments/${departmentId}/assign-employees`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeIds }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Ажилтнууд хуваарилахад алдаа гарлаа");
      }
    },
    onSuccess: () => {
      // Invalidate both queries and employee queries
      queryClient.invalidateQueries({ queryKey: [api.departments.list.path] });
      queryClient.invalidateQueries({ queryKey: [api.employees.list.path] });
    },
  });

  // 6. Assign manager to department
  const assignManager = useMutation<Department, Error, { departmentId: string; employeeId: string | null }>({
    mutationFn: async ({ departmentId, employeeId }) => {
      const res = await fetch(`/api/departments/${departmentId}/manager`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId }),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Удирдагч томилоход алдаа гарлаа");
      }

      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.departments.list.path] });
    },
  });

  // 7. Get department details
  const getDepartmentDetails = async (departmentId: string) => {
    const res = await fetch(`/api/departments/${departmentId}/details`);
    if (!res.ok) {
      throw new Error("Хэлтсийн дэлгэрэнгүй мэдээлэл авахад алдаа гарлаа");
    }
    return await res.json();
  };

  return {
    departments,
    isLoading,
    isError,
    error,
    // Stats query
    departmentsWithStats,
    isLoadingStats,
    isErrorStats,
    errorStats,
    // Mutations
    createDepartment,
    updateDepartment,
    deleteDepartment,
    batchAssignEmployees,
    assignManager,
    getDepartmentDetails,
  };
}