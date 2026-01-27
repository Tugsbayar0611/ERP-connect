import React, { useState, useEffect } from "react";
import { RolesSidebar } from "./RolesSidebar";
import { RoleHeader } from "./RoleHeader";
import { PermissionMatrix } from "./PermissionMatrix";
import { useRoles, useRole, usePermissions } from "@/hooks/use-roles";
import { Role } from "@/hooks/use-roles";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export function RolesLayout() {
    const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
    const [isCreating, setIsCreating] = useState(false);
    const [selectedPerms, setSelectedPerms] = useState<Set<string>>(new Set());

    const { roles } = useRoles();
    const { permissions, isLoading: permsLoading } = usePermissions();
    const { role, isLoading: roleLoading } = useRole(selectedRoleId);

    // If no role selected and roles exist, select first one
    React.useEffect(() => {
        if (!selectedRoleId && roles.length > 0 && !isCreating) {
            setSelectedRoleId(roles[0].id);
        }
    }, [roles, selectedRoleId, isCreating]);

    // Sync state with fetching role
    useEffect(() => {
        if (role && !isCreating) {
            // Extract IDs from role.permissions. 
            // API returns joined objects: { permissionId: "..." }
            const ids = role.permissions?.map((p: any) => p.permissionId || p.id) || [];
            setSelectedPerms(new Set(ids));
        } else if (isCreating) {
            setSelectedPerms(new Set());
        }
    }, [role, isCreating]);

    const handleCreate = () => {
        setSelectedRoleId(null);
        setIsCreating(true);
        setSelectedPerms(new Set());
    };

    const handleSelect = (id: string) => {
        setSelectedRoleId(id);
        setIsCreating(false);
    };

    const handleToggle = (id: string, checked: boolean) => {
        const next = new Set(selectedPerms);
        if (checked) next.add(id);
        else next.delete(id);
        setSelectedPerms(next);
    };

    const handleSelectGroup = (resource: string) => {
        const groupIds = permissions.filter(p => p.resource === resource).map(p => p.id);
        const next = new Set(selectedPerms);
        groupIds.forEach(id => next.add(id));
        setSelectedPerms(next);
    };

    const handleDeselectGroup = (resource: string) => {
        const groupIds = permissions.filter(p => p.resource === resource).map(p => p.id);
        const next = new Set(selectedPerms);
        groupIds.forEach(id => next.delete(id));
        setSelectedPerms(next);
    };

    return (
        <div className="flex h-[calc(100vh-10rem)] border rounded-lg overflow-hidden bg-background">
            <RolesSidebar
                selectedRoleId={selectedRoleId}
                onSelect={handleSelect}
                onCreate={handleCreate}
            />

            <div className="flex-1 flex flex-col min-w-0">
                {(selectedRoleId || isCreating) ? (
                    <>
                        <RoleHeader
                            roleId={selectedRoleId}
                            isCreating={isCreating}
                            onCancel={() => {
                                setIsCreating(false);
                                if (roles.length > 0) setSelectedRoleId(roles[0].id);
                            }}
                            onCreated={(newId: string) => {
                                setIsCreating(false);
                                setSelectedRoleId(newId);
                            }}
                            permissionIds={Array.from(selectedPerms)}
                        />
                        {(selectedRoleId || isCreating) && (
                            <div className="flex-1 overflow-auto p-6">
                                <PermissionMatrix
                                    permissions={permissions}
                                    selectedIds={selectedPerms}
                                    onToggle={handleToggle}
                                    onSelectGroup={handleSelectGroup}
                                    onDeselectGroup={handleDeselectGroup}
                                    isLoading={permsLoading || (!!selectedRoleId && roleLoading)}
                                    roleName={role?.name}
                                />
                            </div>
                        )}
                    </>
                ) : (
                    <div className="flex-1 flex items-center justify-center text-muted-foreground">
                        Select a role to view details
                    </div>
                )}
            </div>
        </div>
    );
}
