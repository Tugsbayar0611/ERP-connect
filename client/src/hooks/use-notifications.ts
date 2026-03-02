
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { isEmployee, isManager, isPrivileged } from "@shared/roles";
import { apiRequest } from "@/lib/queryClient";

export interface NotificationItem {
    id: string;
    title: string;
    description: string;
    type: "info" | "warning" | "success" | "error";
    date: string;
    read: boolean;
    link: string;
    metadata?: Record<string, any>;
}

export function useNotifications() {
    const { user } = useAuth();
    const queryClient = useQueryClient();

    // Determine audience based on role
    const audience = (user && isEmployee(user.role) && !isManager(user.role) && !isPrivileged(user.role))
        ? "employee"
        : "admin";

    const queryKey = ["notifications", user?.id, audience];
    const countQueryKey = ["notifications-count", user?.id, audience];

    const { data: notifications = [], isLoading } = useQuery<NotificationItem[]>({
        queryKey,
        enabled: !!user,
        queryFn: async () => {
            const res = await fetch(`/api/notifications?audience=${audience}`);
            if (!res.ok) throw new Error("Failed to fetch notifications");
            return res.json();
        },
        refetchInterval: 60 * 1000,
    });

    // Separate query for count if needed, or derive from list if list is complete?
    // Backend supports /unread-count, let's use it for the badge to be independent of list pagination if added later.
    // For now, since list is small (20-100), deriving from list is fine, BUT
    // User requested robust badge. Let's use the explicit count endpoint.
    const { data: unreadCountData } = useQuery({
        queryKey: countQueryKey,
        enabled: !!user,
        queryFn: async () => {
            const res = await fetch(`/api/notifications/unread-count?audience=${audience}`);
            if (!res.ok) throw new Error("Failed to fetch count");
            return res.json();
        },
        refetchInterval: 60 * 1000,
    });

    const unreadCount = unreadCountData?.count ?? notifications.filter(n => !n.read).length;

    const markAsReadMutation = useMutation({
        mutationFn: async (id: string) => {
            await apiRequest("POST", `/api/notifications/${id}/read`);
        },
        onMutate: async (id) => {
            await queryClient.cancelQueries({ queryKey });
            await queryClient.cancelQueries({ queryKey: countQueryKey });

            const previousNotifications = queryClient.getQueryData<NotificationItem[]>(queryKey);
            const previousCount = queryClient.getQueryData<{ count: number }>(countQueryKey);

            // Optimistic update list
            if (previousNotifications) {
                queryClient.setQueryData<NotificationItem[]>(queryKey, old =>
                    old?.map(n => n.id === id ? { ...n, read: true } : n)
                );
            }

            // Optimistic update count
            if (previousCount) {
                queryClient.setQueryData<{ count: number }>(countQueryKey, old => ({
                    count: Math.max(0, (old?.count || 0) - 1)
                }));
            }

            return { previousNotifications, previousCount };
        },
        onError: (_err, _id, context) => {
            if (context?.previousNotifications) {
                queryClient.setQueryData(queryKey, context.previousNotifications);
            }
            if (context?.previousCount) {
                queryClient.setQueryData(countQueryKey, context.previousCount);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            queryClient.invalidateQueries({ queryKey: countQueryKey });
        },
    });

    const markAllAsReadMutation = useMutation({
        mutationFn: async () => {
            await apiRequest("POST", "/api/notifications/read-all");
        },
        onMutate: async () => {
            await queryClient.cancelQueries({ queryKey });
            await queryClient.cancelQueries({ queryKey: countQueryKey });

            const previousNotifications = queryClient.getQueryData<NotificationItem[]>(queryKey);
            const previousCount = queryClient.getQueryData<{ count: number }>(countQueryKey);

            if (previousNotifications) {
                queryClient.setQueryData<NotificationItem[]>(queryKey, old =>
                    old?.map(n => ({ ...n, read: true }))
                );
            }

            queryClient.setQueryData<{ count: number }>(countQueryKey, { count: 0 });

            return { previousNotifications, previousCount };
        },
        onError: (_err, _vars, context) => {
            if (context?.previousNotifications) {
                queryClient.setQueryData(queryKey, context.previousNotifications);
            }
            if (context?.previousCount) {
                queryClient.setQueryData(countQueryKey, context.previousCount);
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey });
            queryClient.invalidateQueries({ queryKey: countQueryKey });
        },
    });

    return {
        notifications,
        isLoading,
        unreadCount,
        markAsRead: markAsReadMutation.mutate,
        markAllAsRead: markAllAsReadMutation.mutate
    };
}
