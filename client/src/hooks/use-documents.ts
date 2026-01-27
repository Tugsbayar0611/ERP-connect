import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { InsertDocument, Document } from "@shared/schema";

export function useDocuments() {
  const queryClient = useQueryClient();

  // 1. Баримтын жагсаалт авах
  const { data: documents, isLoading } = useQuery<Document[]>({
    queryKey: [api.documents.list.path],
    queryFn: async () => {
      const res = await fetch(api.documents.list.path);
      if (!res.ok) throw new Error("Failed to fetch documents");
      // .parse() ашиглахгүйгээр шууд JSON буцаана
      return await res.json();
    },
  });

  // 2. Баримт нэмэх
  const createDocument = useMutation({
    mutationFn: async (data: InsertDocument) => {
      const res = await fetch(api.documents.create.path, {
        method: api.documents.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.message || "Failed to upload document");
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.documents.list.path] });
    },
  });
  // 👇 ЭНИЙГ НЭМСЭН: Устгах үйлдэл
  const deleteDocument = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/documents/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to delete document");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.documents.list.path] });
    },
  });
  return {
    documents,
    isLoading,
    createDocument,
    deleteDocument,
  };
}