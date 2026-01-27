import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function usePurchaseOrders() {
  const queryClient = useQueryClient();

  const { data: orders = [], isLoading } = useQuery<any[]>({
    queryKey: ["purchase-orders"],
    queryFn: async () => {
      const res = await fetch("/api/purchase-orders");
      if (!res.ok) throw new Error("Худалдан авах захиалга авахад алдаа гарлаа");
      return res.json();
    },
  });

  const createOrder = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/purchase-orders", {
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
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });

  const confirmOrder = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/purchase-orders/${id}/confirm`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Захиалга баталгаажуулахад алдаа гарлаа");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });

  const receiveOrder = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/purchase-orders/${id}/receive`, {
        method: "PUT",
      });
      if (!res.ok) throw new Error("Захиалга хүлээн авахад алдаа гарлаа");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
    },
  });

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/purchase-orders/bulk-delete", {
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
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
    },
  });

  return {
    orders,
    isLoading,
    createOrder,
    confirmOrder,
    receiveOrder,
    bulkDelete,
  };
}

// Hook for purchase stats (KPI cards)
export function usePurchaseStats(startDate?: string, endDate?: string) {
  const params = new URLSearchParams();
  if (startDate) params.append("startDate", startDate);
  if (endDate) params.append("endDate", endDate);
  const queryString = params.toString();

  return useQuery<{
    thisMonthSpend: number;
    pendingDelivery: number;
    overdueBills: number;
  }>({
    queryKey: ["purchase-stats", startDate, endDate],
    queryFn: async () => {
      const url = queryString ? `/api/purchase/stats?${queryString}` : "/api/purchase/stats";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to fetch purchase stats");
      return res.json();
    },
    staleTime: 60 * 1000, // 1 minute cache
  });
}
