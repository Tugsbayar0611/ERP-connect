import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { ProductCategory, InsertProductCategory } from "@shared/schema";
import { extractErrorMessage } from "@/lib/api-error-handler";

export function useProductCategories() {
  const queryClient = useQueryClient();

  // 1. Ангиллын жагсаалт авах
  const { data: categories = [], isLoading } = useQuery<ProductCategory[]>({
    queryKey: ["product-categories"],
    queryFn: async () => {
      const res = await fetch("/api/product-categories", { credentials: "include" });
      if (!res.ok) {
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Ангиллын жагсаалт авахад алдаа гарлаа");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // 2. Ангилал нэмэх
  const createCategory = useMutation({
    mutationFn: async (category: InsertProductCategory) => {
      const res = await fetch("/api/product-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(category),
      });
      if (!res.ok) {
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Ангилал нэмэхэд алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["product-categories"] });
    },
  });

  return {
    categories,
    isLoading,
    createCategory,
  };
}
