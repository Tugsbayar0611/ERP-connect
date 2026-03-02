import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { InsertPayslip, Payslip } from "@shared/schema";

// Alias for compatibility if needed, or update usages
type Payroll = Payslip & { periodStart: string; periodEnd: string }; // We are now listing Payslips with Period info
type InsertPayroll = any; // Input is custom schema

export function usePayroll() {
  const queryClient = useQueryClient();

  // 1. Цалингийн жагсаалт авах
  const { data: payroll, isLoading } = useQuery<Payroll[]>({
    queryKey: [api.payroll.list.path],
    queryFn: async () => {
      const res = await fetch(api.payroll.list.path);
      if (!res.ok) throw new Error("Failed to fetch payroll records");

      // АНХААР: .parse() -ийг авч хаясан. 
      // JSON-оос Date нь string болж ирдэг тул Zod алдаа өгч магадгүй.
      // Тиймээс шууд json() буцаах нь илүү найдвартай.
      return await res.json();
    },
  });

  // 2. Цалин нэмэх
  const createPayroll = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch(api.payroll.create.path, {
        method: api.payroll.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to process payroll");
      }

      return await res.json();
    },
    onSuccess: () => {
      // Амжилттай бол жагсаалтыг шинэчлэх
      queryClient.invalidateQueries({ queryKey: [api.payroll.list.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
    },
  });

  return {
    payroll,
    isLoading,
    createPayroll,
  };
}

// 3. Миний цалингийн хуудас авах (Ажилтанд зориулсан)
export function useMyPayslips(employeeId?: string) {
  return useQuery<Payroll[]>({
    queryKey: ["/api/payslips", employeeId],
    queryFn: async () => {
      // If employeeId is provided, query specific, otherwise default (server handles self for employees)
      const url = employeeId ? `/api/payslips?employeeId=${employeeId}` : `/api/payslips`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch payslips");
      return await res.json();
    },
  });
}