import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

export interface QPaySettings {
  id?: string;
  enabled: boolean;
  mode: "sandbox" | "production";
  clientId: string | null;
  clientSecret: string | null;
  invoiceCode: string | null;
  callbackSecret: string | null;
  webhookUrl: string | null;
  autoPosting: boolean;
}

export interface QPayQRResponse {
  qrImage: string | null;
  qrText: string;
  callbackUrl: string;
  status: string;
}

export function useQPaySettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery<QPaySettings>({
    queryKey: ["/api/qpay/settings"],
    queryFn: async () => {
      const res = await fetch("/api/qpay/settings");
      if (!res.ok) throw new Error("Failed to fetch QPay settings");
      return res.json();
    },
  });

  const update = useMutation({
    mutationFn: async (settings: Partial<QPaySettings>) => {
      const res = await fetch("/api/qpay/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to update QPay settings");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/qpay/settings"] });
      toast({ title: "Амжилттай", description: "QPay тохиргоо хадгалагдлаа." });
    },
    onError: (e: any) => {
      toast({ title: "Алдаа", description: e?.message ?? "QPay тохиргоо хадгалахад алдаа гарлаа", variant: "destructive" });
    },
  });

  return { data, isLoading, update: update.mutate, isUpdating: update.isPending };
}

export function useGenerateQPayQR() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (invoiceId: string): Promise<QPayQRResponse> => {
      const res = await fetch("/api/qpay/generate-qr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to generate QR");
      }
      return res.json();
    },
    onError: (e: any) => {
      toast({ title: "Алдаа", description: e?.message ?? "QR код үүсгэхэд алдаа гарлаа", variant: "destructive" });
    },
  });
}
