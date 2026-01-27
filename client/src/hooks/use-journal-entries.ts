import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useJournalEntries(
  filters?: {
    journalId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }
) {
  const queryClient = useQueryClient();

  const { data: entries = [], isLoading } = useQuery<any[]>({
    queryKey: ["journal-entries", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters?.journalId) params.append("journalId", filters.journalId);
      if (filters?.status) params.append("status", filters.status);
      if (filters?.startDate) params.append("startDate", filters.startDate);
      if (filters?.endDate) params.append("endDate", filters.endDate);

      const url = `/api/journal-entries${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error("Journal entries авахад алдаа гарлаа");
      return res.json();
    },
  });

  const postEntry = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const res = await fetch(`/api/journal-entries/${id}/post`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Journal entry post хийхэд алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    },
  });

  const reverseEntry = useMutation({
    mutationFn: async ({ id, entryDate, description }: { id: string; entryDate?: string; description?: string }) => {
      const res = await fetch(`/api/journal-entries/${id}/reverse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entryDate, description }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Journal entry буцаахад алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  return {
    entries,
    isLoading,
    postEntry,
    reverseEntry,
  };
}
