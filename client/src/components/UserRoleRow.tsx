import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { X, Shield, ChevronDown, ChevronUp, PenTool } from "lucide-react";
import { useUserRoles } from "@/hooks/use-roles";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";

export function UserRoleRow({
  user,
  currentUserId,
  roles,
  onAssignRole,
  onRemoveRole,
}: {
  user: any;
  currentUserId?: string;
  roles: any[];
  onAssignRole: (roleId: string) => void;
  onRemoveRole: (roleId: string) => void;
}) {
  const [showRoleDialog, setShowRoleDialog] = useState(false);
  const [showPermissions, setShowPermissions] = useState(false);
  const { userRoles = [] } = useUserRoles(user.id);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Local state for optimistic update
  const [canSign, setCanSign] = useState(user.canSignDocuments ?? false);

  // Update canSignDocuments mutation
  const updatePermissionsMutation = useMutation({
    mutationFn: async (canSignDocuments: boolean) => {
      const res = await fetch(`/api/admin/users/${user.id}/permissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ canSignDocuments }),
      });
      if (!res.ok) throw new Error("Failed to update permissions");
      return res.json();
    },
    onMutate: (newValue) => {
      // Optimistic update
      setCanSign(newValue);
    },
    onSuccess: () => {
      toast({ title: "Амжилттай", description: "Гарын үсгийн эрх шинэчлэгдлээ" });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (err, newValue) => {
      // Rollback on error
      setCanSign(!newValue);
      toast({ title: "Алдаа", description: "Эрх шинэчлэхэд алдаа гарлаа", variant: "destructive" });
    },
  });

  // Fetch user permissions
  const { data: userPermissions = [] } = useQuery({
    queryKey: ["user-permissions", user.id],
    queryFn: async () => {
      const res = await fetch(`/api/users/${user.id}/permissions`);
      if (!res.ok) return [];
      return res.json();
    },
    enabled: showPermissions && !!user.id,
  });

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 border rounded-lg">
        <div className="flex-1">
          <p className="font-medium">{user.email}</p>
          {user.fullName && user.fullName !== user.email && (
            <p className="text-sm text-muted-foreground">{user.fullName}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-2">
            {userRoles.length > 0 ? (
              userRoles.map((ur: any) => (
                <Badge
                  key={ur.roleId}
                  variant={ur.role?.name === "Admin" ? "default" : "secondary"}
                  className="flex items-center gap-1"
                >
                  {ur.role?.name || "Unknown"}
                  {!(user.id === currentUserId && ur.role?.name === "Admin") && (
                    <button
                      onClick={() => onRemoveRole(ur.roleId)}
                      className="ml-1 hover:bg-destructive/20 rounded-full p-0.5"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </Badge>
              ))
            ) : (
              <span className="text-sm text-muted-foreground">Эрхгүй</span>
            )}
          </div>
        </div>

        {/* Signer Toggle */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            {canSign && (
              <Badge variant="outline" className="gap-1 text-emerald-600 border-emerald-300">
                <PenTool className="w-3 h-3" />
                Signer
              </Badge>
            )}
            <Switch
              checked={canSign}
              onCheckedChange={(checked) => updatePermissionsMutation.mutate(checked)}
              disabled={updatePermissionsMutation.isPending}
              aria-label="Гарын үсэг зурах эрх"
            />
          </div>
          <Button variant="ghost" size="sm" onClick={() => setShowRoleDialog(true)} className="w-full sm:w-auto">
            Эрх өгөх
          </Button>
        </div>
      </div>

      {/* Assign Roles Dialog */}
      <Dialog open={showRoleDialog} onOpenChange={setShowRoleDialog}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Эрх оноох: {user.email}</DialogTitle>
            <DialogDescription>
              Хэрэглэгчид role оноож, эрх өгөх. Role-ууд нь permissions-уудыг агуулна.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Roles Selection */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm">Roles:</h4>
              {roles.map((role) => {
                const isAssigned = userRoles.some((ur: any) => ur.roleId === role.id);
                const isSelfAdminLockout = user.id === currentUserId && role.name === "Admin" && isAssigned;

                return (
                  <div key={role.id} className="flex items-center space-x-2 p-2 rounded-lg hover:bg-muted/50">
                    <Checkbox
                      id={`role-${role.id}`}
                      checked={isAssigned}
                      disabled={isSelfAdminLockout}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          onAssignRole(role.id);
                        } else {
                          onRemoveRole(role.id);
                        }
                      }}
                    />
                    <label
                      htmlFor={`role-${role.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 flex-1 cursor-pointer"
                    >
                      {role.name}
                      {role.description && (
                        <span className="text-xs text-muted-foreground ml-2">({role.description})</span>
                      )}
                      {isSelfAdminLockout && (
                        <span className="text-xs text-muted-foreground ml-2">(Өөрийн эрх)</span>
                      )}
                    </label>
                  </div>
                );
              })}
            </div>

            {/* Effective Permissions Preview */}
            <Collapsible open={showPermissions} onOpenChange={setShowPermissions}>
              <CollapsibleTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  <span className="flex items-center gap-2">
                    <Shield className="w-4 h-4" />
                    Эрхийн урьдчилсан харагдац
                  </span>
                  {showPermissions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="border rounded-lg p-4 bg-muted/30 space-y-2 max-h-64 overflow-y-auto">
                  {userPermissions.length > 0 ? (
                    <div className="space-y-1">
                      {userPermissions.map((perm: any) => (
                        <div key={perm.id} className="flex items-center gap-2 text-sm">
                          <Badge variant="outline" className="font-mono text-xs">
                            {perm.resource}.{perm.action}
                          </Badge>
                          {perm.description && (
                            <span className="text-muted-foreground text-xs">{perm.description}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Эрхгүй байна</p>
                  )}
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
