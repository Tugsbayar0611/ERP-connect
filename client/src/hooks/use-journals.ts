import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useJournals() {
  const queryClient = useQueryClient();

  const { data: journals = [], isLoading } = useQuery<any[]>({
    queryKey: ["journals"],
    queryFn: async () => {
      const res = await fetch("/api/journals");
      if (!res.ok) throw new Error("Journals авахад алдаа гарлаа");
      return res.json();
    },
  });

  const createJournal = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/journals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Journal үүсгэхэд алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journals"] });
    },
  });

  return {
    journals,
    isLoading,
    createJournal,
  };
}
