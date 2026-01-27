import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Product, InsertProduct } from "@shared/schema";
import { extractErrorMessage } from "@/lib/api-error-handler";

export function useProducts() {
  const queryClient = useQueryClient();

  // 1. Барааны жагсаалт авах
  const { data: products = [], isLoading } = useQuery<Product[]>({
    queryKey: ["products"],
    queryFn: async () => {
      const res = await fetch("/api/products");
      if (!res.ok) {
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Барааны жагсаалт авахад алдаа гарлаа");
      }
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  // 2. Бараа нэмэх
  const createProduct = useMutation({
    mutationFn: async (product: InsertProduct) => {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(product),
      });
      if (!res.ok) {
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Бараа нэмэхэд алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  // 3. Бараа засах
  const updateProduct = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertProduct> }) => {
      const res = await fetch(`/api/products/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Бараа засахад алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  // 4. Бараа устгах
  const deleteProduct = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Бараа устгахад алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  // 5. Бөөнөөр устгах
  const bulkDeleteProducts = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/products/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Бараа устгахад алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["products"] });
    },
  });

  return {
    products,
    isLoading,
    createProduct,
    updateProduct,
    deleteProduct,
    bulkDeleteProducts,
  };
}
