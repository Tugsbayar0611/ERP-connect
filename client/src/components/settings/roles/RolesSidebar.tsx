import React, { useState } from "react";
import { cn } from "@/lib/utils";
import { useRoles, type Role } from "@/hooks/use-roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, Plus, Shield } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

interface RolesSidebarProps {
    selectedRoleId: string | null;
    onSelect: (roleId: string) => void;
    onCreate: () => void;
}

export function RolesSidebar({ selectedRoleId, onSelect, onCreate }: RolesSidebarProps) {
    const { roles, isLoading } = useRoles();
    const [search, setSearch] = useState("");

    const filteredRoles = roles.filter((role) =>
        role.name.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="w-64 border-r bg-muted/10 flex flex-col h-full">
            <div className="p-4 space-y-4">
                <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-sm">Roles</h3>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onCreate}>
                        <Plus className="h-4 w-4" />
                    </Button>
                </div>
                <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground" />
                    <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search roles..."
                        className="h-8 pl-8 text-xs"
                    />
                </div>
            </div>

            <ScrollArea className="flex-1">
                <div className="px-2 pb-4 space-y-1">
                    {isLoading ? (
                        Array.from({ length: 5 }).map((_, i) => (
                            <div key={i} className="px-2 py-2">
                                <Skeleton className="h-8 w-full" />
                            </div>
                        ))
                    ) : filteredRoles.length === 0 ? (
                        <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                            No roles found
                        </div>
                    ) : (
                        filteredRoles.map((role) => (
                            <button
                                key={role.id}
                                onClick={() => onSelect(role.id)}
                                className={cn(
                                    "w-full flex items-center justify-between px-3 py-2 rounded-md text-sm transition-colors text-left group",
                                    selectedRoleId === role.id
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                )}
                            >
                                <div className="flex items-center gap-2 truncate">
                                    <Shield className={cn("h-3 w-3 flex-shrink-0", role.isSystem ? "opacity-70" : "opacity-40")} />
                                    <span className="truncate">{role.name}</span>
                                </div>
                                {role.isSystem && (
                                    <Badge variant="secondary" className="text-[10px] px-1 h-4 min-w-0">
                                        System
                                    </Badge>
                                )}
                            </button>
                        ))
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
