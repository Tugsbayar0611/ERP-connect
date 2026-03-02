import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { useAuth } from "@/hooks/use-auth";

export function useStats() {
  const { user } = useAuth();
  return useQuery({
    queryKey: [api.stats.get.path, user?.id],
    enabled: !!user,
    queryFn: async () => {
      const res = await fetch(api.stats.get.path, {
        credentials: 'include', // Include cookies for session
      });
      if (!res.ok) {
        if (res.status === 401) {
          // Return null instead of throwing for 401 - let UI handle it gracefully
          return null;
        }
        throw new Error(`Failed to fetch stats: ${res.status} ${res.statusText}`);
      }
      return api.stats.get.responses[200].parse(await res.json());
    },
    retry: false, // Don't retry on 401
  });
}
