import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export interface StockMovement {
  id: string;
  warehouseId: string;
  productId: string;
  type: "in" | "out" | "adjustment" | "transfer";
  quantity: string;
  batchNumber?: string | null;
  expiryDate?: string | null;
  reference?: string | null;
  referenceId?: string | null;
  note?: string | null;
  createdAt: string;
  warehouseName?: string;
  productName?: string;
  productSku?: string;
}

export interface CreateStockMovementInput {
  warehouseId: string;
  productId: string;
  quantity: number;
  type: "in" | "out" | "adjustment" | "transfer";
  batchNumber?: string;
  expiryDate?: string;
  reference?: string;
  referenceId?: string;
  note?: string;
}

export function useStockMovements(warehouseId?: string, productId?: string) {
  const { user } = useAuth();
  const { data: movements = [], isLoading } = useQuery<StockMovement[]>({
    queryKey: ["stock-movements", warehouseId, productId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (warehouseId) params.append("warehouseId", warehouseId);
      if (productId) params.append("productId", productId);
      const url = `/api/stock/movements${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Stock movements авахад алдаа гарлаа");
      return res.json();
    },
  });

  return { movements, isLoading };
}

export function useCreateStockMovement() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: CreateStockMovementInput) => {
      const res = await fetch("/api/stock/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Stock movement үүсгэхэд алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-movements"] });
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
    },
  });
}

export function useExpiryAlerts(days: number = 30, warehouseId?: string) {
  const { user } = useAuth();
  const { data: alerts = [], isLoading } = useQuery<any[]>({
    queryKey: ["expiry-alerts", days, warehouseId, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("days", days.toString());
      if (warehouseId) params.append("warehouseId", warehouseId);
      const url = `/api/stock/expiry-alerts?${params.toString()}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Expiry alerts авахад алдаа гарлаа");
      return res.json();
    },
    refetchInterval: 5 * 60 * 1000, // Auto-refresh every 5 minutes
  });

  return { alerts, isLoading };
}
