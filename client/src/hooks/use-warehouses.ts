import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Warehouse, InsertWarehouse } from "@shared/schema";

export function useWarehouses() {
  const queryClient = useQueryClient();

  const { data: warehouses = [], isLoading } = useQuery<Warehouse[]>({
    queryKey: ["warehouses"],
    queryFn: async () => {
      const res = await fetch("/api/warehouses");
      if (!res.ok) throw new Error("Агуулахын жагсаалт авахад алдаа гарлаа");
      return res.json();
    },
  });

  const createWarehouse = useMutation({
    mutationFn: async (warehouse: InsertWarehouse) => {
      const res = await fetch("/api/warehouses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(warehouse),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Агуулах нэмэхэд алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["warehouses"] });
    },
  });

  return {
    warehouses,
    isLoading,
    createWarehouse,
  };
}
