import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useSalesOrders() {
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["sales-orders"],
    queryFn: async () => {
      const res = await fetch("/api/sales-orders");
      if (!res.ok) throw new Error("Борлуулалтын захиалга авахад алдаа гарлаа");
      return res.json();
    },
  });

  const createOrder = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/sales-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Захиалга үүсгэхэд алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    },
  });

  const confirmOrder = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sales-orders/${id}/confirm`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Захиалга баталгаажуулахад алдаа гарлаа");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
    },
  });

  const sendOrder = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sales-orders/${id}/send`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Захиалга илгээхэд алдаа гарлаа");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    },
  });

  const createInvoice = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sales-orders/${id}/create-invoice`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Нэхэмжлэх үүсгэхэд алдаа гарлаа");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const bulkCancel = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/sales-orders/bulk-cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Цуцлахад алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/sales-orders/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Устгахад алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sales-orders"] });
    },
  });

  return {
    orders,
    isLoading,
    createOrder,
    confirmOrder,
    sendOrder,
    createInvoice,
    bulkCancel,
    bulkDelete,
  };
}

// Hook for sales stats (KPI cards)
export function useSalesStats(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const queryString = params.toString();

  return useQuery<{
    thisMonthSales: number;
    arOutstanding: number;
    totalOrders: number;
  }>({
    queryKey: ["sales-stats", startDate, endDate],
    queryFn: async () => {
      const url = queryString ? `/api/sales/stats?${queryString}` : "/api/sales/stats";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch sales stats");
      return res.json();
    },
    staleTime: 60 * 1000, // 1 minute cache
  });
}

// Hook for sales order details (drawer view  
export function useSalesOrderDetails(orderId: string | null) {
  return useQuery<any>({
    queryKey: ["sales-order", orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const res = await fetch(`/api/sales-orders/${orderId}`);
      if (!res.ok) throw new Error("Захиалга авахад алдаа гарлаа");
      return res.json();
    },
    enabled: !!orderId, // Only fetch when orderId is provided
    staleTime: 30 * 1000, // 30 seconds cache
  });
}
