import { useQuery } from "@tanstack/react-query";

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
