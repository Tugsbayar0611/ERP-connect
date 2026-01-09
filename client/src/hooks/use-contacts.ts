import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Contact, InsertContact } from "@shared/schema";

export function useContacts(type?: string) {
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["contacts", type],
    queryFn: async () => {
      const url = type ? `/api/contacts?type=${type}` : "/api/contacts";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Харилцагчдын жагсаалт авахад алдаа гарлаа");
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });

  const createContact = useMutation({
    mutationFn: async (contact: InsertContact) => {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(contact),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Харилцагч нэмэхэд алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  const updateContact = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<InsertContact> }) => {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Харилцагч засахад алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  return {
    contacts,
    isLoading,
    createContact,
    updateContact,
  };
}
