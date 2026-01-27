import React, { useState, useEffect } from "react";
import { useRoles, useRole } from "@/hooks/use-roles";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Trash2, Save, X, RotateCcw } from "lucide-react";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

interface RoleHeaderProps {
    roleId: string | null;
    isCreating: boolean;
    onCancel: () => void;
    onCreated: (id: string) => void;
    permissionIds?: string[];
}

export function RoleHeader({ roleId, isCreating, onCancel, onCreated, permissionIds }: RoleHeaderProps) {
    const { role, isLoading: roleLoading } = useRole(roleId);
    const { updateRole, createRole, deleteRole } = useRoles();
    const { toast } = useToast();

    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [isDirty, setIsDirty] = useState(false);

    // Initial load sync
    useEffect(() => {
        if (role && !isCreating) {
            setName(role.name);
            setDescription(role.description || "");
            setIsDirty(false);
        } else if (isCreating) {
            setName("");
            setDescription("");
            setIsDirty(false);
        }
    }, [role, isCreating]);

    // Check if permissions changed
    const isPermissionsDirty = React.useMemo(() => {
        if (isCreating) return (permissionIds?.length || 0) > 0;
        if (!role || !permissionIds) return false;

        const currentIds = new Set(permissionIds);
        const originalIds = new Set(role.permissions?.map((p: any) => p.permissionId || p.id) || []);

        if (currentIds.size !== originalIds.size) return true;
        for (const id of Array.from(currentIds)) if (!originalIds.has(id)) return true;

        return false;
    }, [role, permissionIds, isCreating]);

    const showSave = isDirty || isPermissionsDirty;

    const handleSave = async () => {
        try {
            if (isCreating) {
                const newRole = await createRole.mutateAsync({
                    name,
                    description,
                    permissionIds // Pass if we ever support perms on creation
                });
                toast({ title: "Success", description: "Role created successfully" });
                onCreated(newRole.id);
            } else if (roleId) {
                await updateRole.mutateAsync({
                    id: roleId,
                    name,
                    description,
                    permissionIds
                });
                toast({ title: "Success", description: "Role updated successfully" });
                setIsDirty(false);
            }
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to save role",
                variant: "destructive"
            });
        }
    };

    const handleDelete = async () => {
        if (!roleId) return;
        try {
            await deleteRole.mutateAsync(roleId);
            toast({ title: "Success", description: "Role deleted successfully" });
            onCancel(); // Use onCancel to reset selection
        } catch (error: any) {
            toast({
                title: "Error",
                description: error.message || "Failed to delete role",
                variant: "destructive"
            });
        }
    };

    const handleReset = () => {
        if (role) {
            setName(role.name);
            setDescription(role.description || "");
            setIsDirty(false);
        }
    };

    if (roleLoading && !isCreating) {
        return <div className="p-6 border-b h-[88px] flex items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
    }

    const isSystem = role?.isSystem && !isCreating;

    return (
        <div className="p-6 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10">
            <div className="flex items-start justify-between gap-4">
                <div className="flex-1 space-y-4">
                    <div className="flex items-center gap-2">
                        {isSystem ? (
                            <h2 className="text-lg font-semibold tracking-tight">{name}</h2>
                        ) : (
                            <Input
                                value={name}
                                onChange={(e) => {
                                    setName(e.target.value);
                                    setIsDirty(true);
                                }}
                                placeholder="Role Name"
                                className="text-lg font-semibold h-9 px-2 -ml-2 border-transparent hover:border-input focus:border-input w-full max-w-sm"
                            />
                        )}
                        {isSystem && <Badge variant="secondary">System Role</Badge>}
                        {isDirty && <Badge variant="outline" className="text-yellow-600 border-yellow-200 bg-yellow-50">Unsaved</Badge>}
                    </div>

                    <div className="max-w-xl">
                        <Input
                            value={description}
                            onChange={(e) => {
                                setDescription(e.target.value);
                                setIsDirty(true);
                            }}
                            placeholder="Description"
                            className="text-sm text-muted-foreground h-8 px-2 -ml-2 border-transparent hover:border-input focus:border-input"
                        />
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {isCreating ? (
                        <>
                            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
                            <Button onClick={handleSave} disabled={!name}>Create Role</Button>
                        </>
                    ) : (
                        <>
                            {showSave && (
                                <>
                                    <Button variant="ghost" size="icon" onClick={handleReset} title="Reset changes">
                                        <RotateCcw className="h-4 w-4" />
                                    </Button>
                                    <Button size="sm" onClick={handleSave} disabled={updateRole.isPending} className="gap-2">
                                        {updateRole.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                        Save Changes
                                    </Button>
                                </>
                            )}

                            {!isSystem && (
                                <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="icon" className="text-destructive hover:bg-destructive/10">
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                        <AlertDialogHeader>
                                            <AlertDialogTitle>Delete Role?</AlertDialogTitle>
                                            <AlertDialogDescription>
                                                This action cannot be undone. This will permanently delete the role "{name}" and remove it from all assigned users.
                                            </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                                            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Delete</AlertDialogAction>
                                        </AlertDialogFooter>
                                    </AlertDialogContent>
                                </AlertDialog>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
