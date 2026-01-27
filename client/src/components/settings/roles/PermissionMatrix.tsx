import React from "react";
import { type Permission } from "@/hooks/use-roles";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PermissionMatrixProps {
    permissions: Permission[];
    selectedIds: Set<string>;
    onToggle: (id: string, checked: boolean) => void;
    onSelectGroup: (resource: string) => void;
    onDeselectGroup: (resource: string) => void;
    isLoading?: boolean;
    roleName?: string;
}

export function PermissionMatrix({
    permissions,
    selectedIds,
    onToggle,
    onSelectGroup,
    onDeselectGroup,
    isLoading,
    roleName
}: PermissionMatrixProps) {

    if (isLoading) {
        return <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
        </div>;
    }

    // Group permissions by resource
    const groupedPerms = permissions.reduce((acc, perm) => {
        if (!acc[perm.resource]) acc[perm.resource] = [];
        acc[perm.resource].push(perm);
        return acc;
    }, {} as Record<string, Permission[]>);

    const isAdmin = roleName === "Admin";

    return (
        <div className="space-y-8">
            {Object.entries(groupedPerms).map(([resource, resourcePerms]) => (
                <div key={resource} className="space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                        <div className="flex items-center gap-2">
                            <h3 className="font-medium capitalize text-sm">{resource}</h3>
                            <Badge variant="outline" className="text-[10px] font-normal">{resourcePerms.length}</Badge>
                        </div>
                        <div className="flex gap-2">
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={() => onDeselectGroup(resource)}
                                disabled={isAdmin}
                            >
                                None
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 text-[10px] px-2"
                                onClick={() => onSelectGroup(resource)}
                                disabled={isAdmin}
                            >
                                All
                            </Button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {resourcePerms.map((perm) => {
                            const isAssigned = selectedIds.has(perm.id);

                            return (
                                <div
                                    key={perm.id}
                                    className={cn(
                                        "flex flex-col gap-1 p-3 rounded-lg border transition-all text-sm",
                                        isAssigned ? "bg-primary/5 border-primary/20" : "bg-card hover:bg-accent/50",
                                        isAdmin && "opacity-80 pointer-events-none bg-muted"
                                    )}
                                >
                                    <div className="flex items-start gap-3">
                                        <Checkbox
                                            id={perm.id}
                                            checked={isAssigned}
                                            onCheckedChange={(checked) => onToggle(perm.id, checked as boolean)}
                                            disabled={isAdmin}
                                            className="mt-0.5"
                                        />
                                        <div className="grid gap-0.5 leading-none">
                                            <label
                                                htmlFor={perm.id}
                                                className="font-medium cursor-pointer"
                                            >
                                                {perm.action}
                                            </label>
                                            {perm.description && (
                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                    {perm.description}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
