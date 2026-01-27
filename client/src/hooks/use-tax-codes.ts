import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";
import { useToast } from "@/hooks/use-toast";

export interface TaxCode {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  rate: string;
  type: string;
  taxAccountPayableId: string | null;
  taxAccountReceivableId: string | null;
  isDefault: boolean;
  isActive: boolean;
}

export function useTaxCodes() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: taxCodes = [], isLoading } = useQuery({
    queryKey: ["tax-codes"],
    queryFn: async () => {
      const res = await fetch("/api/tax-codes");
      if (!res.ok) throw new Error("Failed to fetch tax codes");
      return res.json() as Promise<TaxCode[]>;
    },
    enabled: !!user,
  });

  const createTaxCode = useMutation({
    mutationFn: async (taxCode: {
      code: string;
      name: string;
      rate: number;
      type: string;
      taxAccountPayableId?: string | null;
      taxAccountReceivableId?: string | null;
      isDefault?: boolean;
      isActive?: boolean;
    }) => {
      const res = await fetch("/api/tax-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(taxCode),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to create tax code");
      }
      return res.json() as Promise<TaxCode>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-codes"] });
      queryClient.invalidateQueries({ queryKey: ["accounts"] });
      toast({
        title: "Амжилттай",
        description: "Татварын код үүсгэгдлээ",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Алдаа",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const setDefaultTaxCode = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tax-codes/${id}/default`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isDefault: true }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to set default tax code");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-codes"] });
      toast({
        title: "Амжилттай",
        description: "Үндсэн татварын код шинэчлэгдлээ",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Алдаа",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateTaxCode = useMutation({
    mutationFn: async ({ id, ...data }: any) => {
      const res = await fetch(`/api/tax-codes/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update tax code");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-codes"] });
      toast({ title: "Амжилттай", description: "Татварын код шинэчлэгдлээ." });
    },
    onError: (error: Error) => {
      toast({
        title: "Алдаа",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteTaxCode = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/tax-codes/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to delete tax code");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tax-codes"] });
      toast({ title: "Амжилттай", description: "Татварын код устгагдлаа." });
    },
    onError: (error: Error) => {
      toast({
        title: "Алдаа",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return {
    taxCodes,
    isLoading,
    createTaxCode: createTaxCode.mutateAsync,
    isCreating: createTaxCode.isPending,
    updateTaxCode: updateTaxCode.mutateAsync,
    isUpdating: updateTaxCode.isPending,
    deleteTaxCode: deleteTaxCode.mutateAsync,
    isDeleting: deleteTaxCode.isPending,
    setDefaultTaxCode: setDefaultTaxCode.mutateAsync,
  };
}
