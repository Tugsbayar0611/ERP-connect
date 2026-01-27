import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Contact, InsertContact } from "@shared/schema";
import { extractErrorMessage } from "@/lib/api-error-handler";

export function useContacts(type?: string) {
  const queryClient = useQueryClient();

  const { data: contacts = [], isLoading } = useQuery<Contact[]>({
    queryKey: ["contacts", type],
    queryFn: async () => {
      const url = type ? `/api/contacts?type=${type}` : "/api/contacts";
      const res = await fetch(url);
      if (!res.ok) {
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Харилцагчдын жагсаалт авахад алдаа гарлаа");
      }
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
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Харилцагч нэмэхэд алдаа гарлаа");
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
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Харилцагч засахад алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  const deleteContact = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/contacts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Харилцагч устгахад алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
    },
  });

  const bulkDeleteContacts = useMutation({
    mutationFn: async (ids: string[]) => {
      const res = await fetch("/api/contacts/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Харилцагч устгахад алдаа гарлаа");
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
    deleteContact,
    bulkDeleteContacts,
  };
}
