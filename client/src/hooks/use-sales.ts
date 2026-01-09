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

  return {
    orders,
    isLoading,
    createOrder,
    confirmOrder,
    sendOrder,
    createInvoice,
  };
}
