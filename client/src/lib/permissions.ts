import { hasPermission as hasLegacyPermission, type Action, type Resource, type Role } from "@shared/permissions";

type PermissionLikeUser = {
  role?: string | null;
  permissions?: string[] | null;
  userRoles?: Array<{ name?: string | null } | string> | null;
};

export function userHasPermission(user: PermissionLikeUser | null | undefined, resource: Resource, action: Action): boolean {
  if (!user) return false;

  const permissionKey = `${resource}.${action}`;
  if (user.permissions?.includes(permissionKey)) return true;

  const primaryRole = (user.role || "").toLowerCase() as Role;
  if (primaryRole && hasLegacyPermission(primaryRole, resource, action)) return true;

  return (user.userRoles || []).some((role) => {
    const roleName = (typeof role === "string" ? role : role.name || "").toLowerCase() as Role;
    return !!roleName && hasLegacyPermission(roleName, resource, action);
  });
}
