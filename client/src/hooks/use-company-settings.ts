import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { CompanySettings, InsertCompanySettings } from "@shared/schema";

export function useCompanySettings() {
    const queryClient = useQueryClient();
    const { toast } = useToast();

    const { data: settings, isLoading, error } = useQuery<CompanySettings>({
        queryKey: ["/api/company/settings"],
        queryFn: async () => {
            const res = await fetch("/api/company/settings");
            if (!res.ok) throw new Error("Failed to fetch settings");
            return res.json();
        },
    });

    const updateSettings = useMutation({
        mutationFn: async (newSettings: InsertCompanySettings) => {
            const res = await apiRequest("PUT", "/api/company/settings", newSettings);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/company/settings"] });
            toast({
                title: "Амжилттай",
                description: "Тохиргоо шинэчлэгдлээ",
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

    return {
        settings,
        isLoading,
        error,
        updateSettings,
    };
}
