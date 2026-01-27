import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useInvoices(type?: string) {
  const queryClient = useQueryClient();

  const { data: invoices = [], isLoading } = useQuery<any[]>({
    queryKey: ["invoices", type],
    queryFn: async () => {
      const url = type ? `/api/invoices?type=${type}` : "/api/invoices";
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Нэхэмжлэх авахад алдаа гарлаа");
      return res.json();
    },
  });

  const createInvoice = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        const errorMessage = err.message || err.error || `HTTP ${res.status}: ${res.statusText}`;
        throw new Error(errorMessage);
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const updateInvoiceStatus = useMutation({
    mutationFn: async ({ id, status, paidAmount }: { id: string; status: string; paidAmount?: number }) => {
      const res = await fetch(`/api/invoices/${id}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status, paidAmount }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Нэхэмжлэх статус өөрчлөхөд алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const previewPosting = useMutation({
    mutationFn: async ({ modelType, modelId }: { modelType: string; modelId: string }) => {
      const res = await fetch("/api/posting/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelType, modelId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Posting preview авахад алдаа гарлаа");
      }
      return res.json();
    },
  });

  const postDocument = useMutation({
    mutationFn: async ({ modelType, modelId, journalId, entryDate }: {
      modelType: string;
      modelId: string;
      journalId?: string;
      entryDate?: string;
    }) => {
      const res = await fetch("/api/posting/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modelType, modelId, journalId, entryDate }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Posting хийхэд алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    },
  });

  return {
    invoices,
    isLoading,
    createInvoice,
    updateInvoiceStatus,
    previewPosting,
    postDocument,
    deleteInvoice: useMutation({
      mutationFn: async (id: string) => {
        const res = await fetch(`/api/invoices/${id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          throw new Error("Нэхэмжлэх устгахад алдаа гарлаа");
        }
      },
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["invoices"] });
      },
    }),
  };
}
