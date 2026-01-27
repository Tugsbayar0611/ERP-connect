import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useStockLevels(warehouseId?: string) {
  const { data: levels = [], isLoading } = useQuery<any[]>({
    queryKey: ["stock-levels", warehouseId],
    queryFn: async () => {
      const url = warehouseId ? `/api/stock-levels?warehouseId=${warehouseId}` : "/api/stock-levels";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Нөөцийн мэдээлэл авахад алдаа гарлаа");
      return res.json();
    },
  });

  return { levels, isLoading };
}

export function useInventoryStats() {
  const { data: stats, isLoading } = useQuery<{ totalValue: number; lowStockCount: number; expiringCount: number }>({
    queryKey: ["inventory-stats"],
    queryFn: async () => {
      const res = await fetch("/api/inventory/stats");
      if (!res.ok) throw new Error("Inventory stats авахад алдаа гарлаа");
      return res.json();
    },
  });

  return { stats, isLoading };
}

export function useInventoryBulkAction() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ action, ids }: { action: "delete" | "reset"; ids: string[] }) => {
      let url = "/api/inventory/bulk-actions";
      if (action === "delete") {
        url = "/api/inventory/bulk-delete";
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ids }),
      });
      if (!res.ok) throw new Error("Bulk action failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["stock-levels"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-stats"] });
    },
  });
}
