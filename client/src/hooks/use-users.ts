import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface TenantUser {
    id: string;
    email: string;
    username?: string;
    fullName?: string;
    role: string;
    status: "pending" | "active" | "rejected";
    createdAt: string;
    tenantId: string;
    employeeId?: string;
    signatureUrl?: string | null;
    signatureTitle?: string | null;
    jobTitle?: string | null;
}

export interface ForwardRecipient {
    id: string;
    fullName: string;
    email?: string;
    jobTitle?: string;
    category: string; // 'Manager', 'HR', 'Registry', 'Employee', 'Other'
}

// Fetch pending users for approval
export function usePendingUsers() {
    return useQuery<TenantUser[]>({
        queryKey: ["/api/pending-users"],
        queryFn: async () => {
            const res = await fetch("/api/pending-users");
            if (!res.ok) {
                throw new Error("Хүлээгдэж буй хэрэглэгчдийг авахад алдаа гарлаа");
            }
            return res.json();
        },
    });
}

// Fetch all tenant users
export function useTenantUsers() {
    return useQuery<TenantUser[]>({
        queryKey: ["/api/tenant-users"],
        queryFn: async () => {
            const res = await fetch("/api/tenant-users");
            if (!res.ok) {
                throw new Error("Хэрэглэгчдийг авахад алдаа гарлаа");
            }
            return res.json();
        },
    });
}

// Approve user mutation
export function useApproveUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (userId: string) => {
            const res = await fetch(`/api/users/${userId}/approve`, {
                method: "POST",
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Баталгаажуулахад алдаа гарлаа");
            }
            return res.json();
        },
        onSuccess: () => {
            // Invalidate both queries to refresh data
            queryClient.invalidateQueries({ queryKey: ["/api/pending-users"] });
            queryClient.invalidateQueries({ queryKey: ["/api/tenant-users"] });
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        },
    });
}

// Reject user mutation
export function useRejectUser() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (userId: string) => {
            const res = await fetch(`/api/users/${userId}/reject`, {
                method: "POST",
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Татгалзахад алдаа гарлаа");
            }
            return res.json();
        },
        onSuccess: () => {
            // Invalidate both queries to refresh data
            queryClient.invalidateQueries({ queryKey: ["/api/pending-users"] });
            queryClient.invalidateQueries({ queryKey: ["/api/tenant-users"] });
            queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        },
    });
}

// Fetch company info (for showing company code)
export function useCompanyInfo() {
    return useQuery<{ name: string; code: string }>({
        queryKey: ["/api/company-info"],
        queryFn: async () => {
            const res = await fetch("/api/company-info");
            if (!res.ok) {
                throw new Error("Компанийн мэдээллийг авахад алдаа гарлаа");
            }
            return res.json();
        },
    });
}

// Fetch document forward recipients (filtered by RBAC)
export function useForwardRecipients() {
    return useQuery<ForwardRecipient[]>({
        queryKey: ["/api/documents/forward-recipients"],
        queryFn: async () => {
            const res = await fetch("/api/documents/forward-recipients");
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to fetch recipients");
            }
            return res.json();
        },
    });
}
