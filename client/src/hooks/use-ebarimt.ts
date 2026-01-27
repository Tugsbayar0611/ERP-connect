import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export interface EBarimtSettings {
  id?: string;
  enabled: boolean;
  mode: "sandbox" | "production";
  posEndpoint: string | null;
  apiKey: string | null;
  apiSecret: string | null;
  autoSend: boolean;
}

export function useEBarimtSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<EBarimtSettings>({
    queryKey: ["/api/ebarimt/settings"],
    queryFn: async () => {
      const res = await fetch("/api/ebarimt/settings");
      if (!res.ok) throw new Error("E-barimt тохиргоо ачаалахад алдаа гарлаа");
      return res.json();
    },
  });

  const update = useMutation({
    mutationFn: async (settings: Partial<EBarimtSettings>) => {
      const res = await fetch("/api/ebarimt/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "E-barimt тохиргоо хадгалахад алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ebarimt/settings"] });
      toast({ title: "Амжилттай", description: "E-barimt тохиргоо хадгалагдлаа." });
    },
    onError: (e: any) => {
      toast({
        title: "Алдаа",
        description: e?.message ?? "E-barimt тохиргоо хадгалахад алдаа гарлаа",
        variant: "destructive",
      });
    },
  });

  return { data, isLoading, update: update.mutate, isUpdating: update.isPending };
}

export interface EBarimtSendResponse {
  success: boolean;
  documentId?: string;
  qrCode?: string;
  receiptNumber?: string;
  message?: string;
  error?: string;
  errorCode?: string;
}

export function useSendEBarimt() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (invoiceId: string): Promise<EBarimtSendResponse> => {
      const res = await fetch(`/api/invoices/${invoiceId}/ebarimt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
      });
      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "И-баримт илгээхэд алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: (data, invoiceId) => {
      // Invalidate invoice queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      queryClient.invalidateQueries({ queryKey: ["/api/invoices", invoiceId] });
      toast({
        title: "Амжилттай",
        description: data.message || "И-баримт амжилттай илгээгдлээ",
      });
    },
    onError: (e: any) => {
      toast({
        title: "Алдаа",
        description: e?.message ?? "И-баримт илгээхэд алдаа гарлаа",
        variant: "destructive",
      });
    },
  });
}

