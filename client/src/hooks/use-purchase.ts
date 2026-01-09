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

  return {
    orders,
    isLoading,
    createOrder,
    confirmOrder,
    receiveOrder,
  };
}
