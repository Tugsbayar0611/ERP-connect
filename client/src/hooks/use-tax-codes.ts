import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "./use-auth";

export interface TaxCode {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  rate: string;
  type: string;
  taxAccountPayableId: string | null;
  taxAccountReceivableId: string | null;
  isActive: boolean;
}

export function useTaxCodes() {
  const { user } = useAuth();
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
      queryClient.invalidateQueries({ queryKey: ["accounts"] }); // Invalidate accounts for dropdown
    },
  });

  return {
    taxCodes,
    isLoading,
    createTaxCode: createTaxCode.mutateAsync,
    isCreating: createTaxCode.isPending,
  };
}
