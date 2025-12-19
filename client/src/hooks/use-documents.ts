import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { InsertDocument } from "@shared/schema";

export function useDocuments() {
  const queryClient = useQueryClient();

  const { data: documents, isLoading } = useQuery({
    queryKey: [api.documents.list.path],
    queryFn: async () => {
      const res = await fetch(api.documents.list.path);
      if (!res.ok) throw new Error("Failed to fetch documents");
      return api.documents.list.responses[200].parse(await res.json());
    },
  });

  const uploadDocument = useMutation({
    mutationFn: async (data: InsertDocument) => {
      const res = await fetch(api.documents.create.path, {
        method: api.documents.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to upload document");
      return api.documents.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.documents.list.path] });
    },
  });

  return {
    documents,
    isLoading,
    uploadDocument,
  };
}
