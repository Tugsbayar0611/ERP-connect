import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export interface Role {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  isSystem: boolean;
  createdAt: string;
  updatedAt: string;
  permissions?: Permission[];
}

export interface Permission {
  id: string;
  resource: string;
  action: string;
  description?: string;
}

export function useRoles() {
  const queryClient = useQueryClient();

  const { data: roles = [], isLoading } = useQuery<Role[]>({
    queryKey: ["roles"],
    queryFn: async () => {
      const res = await fetch("/api/roles");
      if (!res.ok) throw new Error("Roles авахад алдаа гарлаа");
      return res.json();
    },
  });

  const createRole = useMutation({
    mutationFn: async (data: { name: string; description?: string; permissionIds?: string[] }) => {
      const res = await fetch("/api/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Role үүсгэхэд алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ id, ...data }: { id: string; name?: string; description?: string; permissionIds?: string[] }) => {
      const res = await fetch(`/api/roles/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Role засах алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });

  const deleteRole = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/roles/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Role устгахад алдаа гарлаа");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["roles"] });
    },
  });

  return {
    roles,
    isLoading,
    createRole,
    updateRole,
    deleteRole,
  };
}

export function useRole(id: string | null) {
  const queryClient = useQueryClient();

  const { data: role, isLoading } = useQuery<Role & { permissions: Permission[] }>({
    queryKey: ["role", id],
    queryFn: async () => {
      if (!id) return null;
      const res = await fetch(`/api/roles/${id}`);
      if (!res.ok) throw new Error("Role авахад алдаа гарлаа");
      return res.json();
    },
    enabled: !!id,
  });

  const assignPermission = useMutation({
    mutationFn: async (permissionId: string) => {
      if (!id) throw new Error("Role ID required");
      const res = await fetch(`/api/roles/${id}/permissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Permission оноох алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role", id] });
      queryClient.invalidateQueries({ queryKey: ["permissions"] });
    },
  });

  const removePermission = useMutation({
    mutationFn: async (permissionId: string) => {
      if (!id) throw new Error("Role ID required");
      const res = await fetch(`/api/roles/${id}/permissions/${permissionId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Permission хасах алдаа гарлаа");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["role", id] });
    },
  });

  return {
    role,
    isLoading,
    assignPermission,
    removePermission,
  };
}

export function usePermissions() {
  const { data: permissions = [], isLoading } = useQuery<Permission[]>({
    queryKey: ["permissions"],
    queryFn: async () => {
      const res = await fetch("/api/permissions");
      if (!res.ok) throw new Error("Permissions авахад алдаа гарлаа");
      return res.json();
    },
  });

  return {
    permissions,
    isLoading,
  };
}

export function useUserRoles(userId: string | null) {
  const queryClient = useQueryClient();

  const { data: userRoles = [], isLoading } = useQuery({
    queryKey: ["user-roles", userId],
    queryFn: async () => {
      if (!userId) return [];
      const res = await fetch(`/api/users/${userId}/roles`);
      if (!res.ok) throw new Error("User roles авахад алдаа гарлаа");
      return res.json();
    },
    enabled: !!userId,
  });

  return {
    userRoles,
    isLoading,
  };
}

export function useAssignRoleToUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const res = await fetch(`/api/users/${userId}/roles`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roleId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Role оноох алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-roles", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });
}

export function useRemoveRoleFromUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ userId, roleId }: { userId: string; roleId: string }) => {
      const res = await fetch(`/api/users/${userId}/roles/${roleId}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Role хасах алдаа гарлаа");
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["user-roles", variables.userId] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
  });
}
