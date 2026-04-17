import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import { z } from "zod";
import { extractErrorMessage } from "@/lib/api-error-handler";

type LoginInput = z.infer<typeof api.auth.login.input>;

export function useAuth() {
  const queryClient = useQueryClient();

  const { data: user, isLoading } = useQuery({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, {
        credentials: 'include', // Include cookies for session
      });
      if (res.status === 401) return null;
      if (!res.ok) {
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Хэрэглэгчийн мэдээлэл авахад алдаа гарлаа");
      }
      return api.auth.me.responses[200].parse(await res.json());
    },
    retry: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (data: LoginInput) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Нэвтрэх нэр эсвэл нууц үг буруу байна");
        const errorMessage = await extractErrorMessage(res);
        throw new Error(errorMessage || "Нэвтрэхэд алдаа гарлаа");
      }
      const result = await res.json();
      // If 2FA is required, return the result with requires2FA flag (don't parse with schema)
      if (result.requires2FA) {
        return result;
      }
      // Normal login success - parse with schema
      const user = api.auth.login.responses[200].parse(result);
      queryClient.setQueryData([api.auth.me.path], user);
      return user;
    },
    onSuccess: (data) => {
      // Only set query data if it's a normal user object (not 2FA response)
      if (data && !data.requires2FA) {
        queryClient.setQueryData([api.auth.me.path], data);
        // Ensure permissions and other computed fields are fresh
        queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      }
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await fetch(api.auth.logout.path, { method: api.auth.logout.method });
    },
    onSuccess: () => {
      // Clear all queries to prevent stale data when switching users
      queryClient.clear();
      queryClient.setQueryData([api.auth.me.path], null);
      // Force a hard reload to ensure all application state is reset
      window.location.reload();
    },
  });

  return {
    user,
    isLoading,
    login: loginMutation.mutateAsync,
    logout: logoutMutation.mutateAsync,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
  };
}
