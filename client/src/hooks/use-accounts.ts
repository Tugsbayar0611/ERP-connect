import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useAccounts() {
  const queryClient = useQueryClient();

  const { data: accounts = [], isLoading } = useQuery<any[]>({
    queryKey: ["accounts"],
    queryFn: async () => {
      const res = await fetch("/api/accounts");
      if (!res.ok) throw new Error("Accounts авахад алдаа гарлаа");
      return res.json();
    },
  });

  const getAccount = async (id: string) => {
    const res = await fetch(`/api/accounts/${id}`);
    if (!res.ok) throw new Error("Account авахад алдаа гарлаа");
    return res.json();
  };

  const createAccount = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Account үүсгэхэд алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: any }) => {
      const res = await fetch(`/api/accounts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Account засахад алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/accounts/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Account устгахад алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
    },
  });

  return {
    accounts,
    isLoading,
    getAccount,
    createAccount,
    updateAccount,
    deleteAccount,
  };
}

