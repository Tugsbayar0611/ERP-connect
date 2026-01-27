import React, { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
    usePendingUsers,
    useTenantUsers,
    useApproveUser,
    useRejectUser,
    useCompanyInfo,
    type TenantUser,
} from "@/hooks/use-users";
import {
    Users,
    Search,
    Check,
    X,
    Clock,
    UserCheck,
    UserX,
    RefreshCw,
    Copy,
    Loader2,
    Building2,
} from "lucide-react";

// Status badge component
function StatusBadge({ status }: { status: string }) {
    switch (status) {
        case "pending":
            return (
                <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/30">
                    <Clock className="w-3 h-3 mr-1" />
                    Хүлээгдэж буй
                </Badge>
            );
        case "active":
            return (
                <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30">
                    <UserCheck className="w-3 h-3 mr-1" />
                    Идэвхтэй
                </Badge>
            );
        case "rejected":
            return (
                <Badge variant="outline" className="bg-red-500/10 text-red-500 border-red-500/30">
                    <UserX className="w-3 h-3 mr-1" />
                    Татгалзсан
                </Badge>
            );
        default:
            return <Badge variant="secondary">{status}</Badge>;
    }
}

// Users Table Component
function UsersTable({
    users,
    isLoading,
    showActions = false,
    onApprove,
    onReject,
    isApproving,
    isRejecting,
}: {
    users: TenantUser[];
    isLoading: boolean;
    showActions?: boolean;
    onApprove?: (userId: string) => void;
    onReject?: (userId: string) => void;
    isApproving?: boolean;
    isRejecting?: boolean;
}) {
    const [searchTerm, setSearchTerm] = useState("");

    const filteredUsers = users.filter((user) => {
        const searchLower = searchTerm.toLowerCase();
        return (
            user.email?.toLowerCase().includes(searchLower) ||
            user.fullName?.toLowerCase().includes(searchLower) ||
            user.username?.toLowerCase().includes(searchLower)
        );
    });

    if (isLoading) {
        return (
            <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4 p-4 rounded-lg bg-white/5">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-3 w-48" />
                        </div>
                        <Skeleton className="h-6 w-20" />
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                    placeholder="Хэрэглэгч хайх..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 bg-background/50 border-white/10"
                />
            </div>

            {/* Table */}
            <div className="rounded-xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead>
                            <tr className="border-b border-white/10 bg-white/5">
                                <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Нэр</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Имэйл</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Эрх</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Огноо</th>
                                <th className="text-left px-4 py-3 text-sm font-medium text-slate-300">Төлөв</th>
                                {showActions && (
                                    <th className="text-right px-4 py-3 text-sm font-medium text-slate-300">Үйлдэл</th>
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={showActions ? 6 : 5} className="text-center py-8 text-muted-foreground">
                                        <Users className="w-10 h-10 mx-auto mb-2 opacity-50" />
                                        <p>Хэрэглэгч олдсонгүй</p>
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => (
                                    <tr
                                        key={user.id}
                                        className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                                    >
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
                                                    <span className="text-sm font-medium text-primary">
                                                        {(user.fullName || user.email || "U")[0].toUpperCase()}
                                                    </span>
                                                </div>
                                                <div>
                                                    <p className="font-medium text-slate-200">
                                                        {user.fullName || user.username || "-"}
                                                    </p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-300">{user.email}</td>
                                        <td className="px-4 py-3">
                                            <Badge variant="secondary" className="font-normal">
                                                {user.role}
                                            </Badge>
                                        </td>
                                        <td className="px-4 py-3 text-sm text-slate-400">
                                            {user.createdAt
                                                ? new Date(user.createdAt).toLocaleDateString("mn-MN")
                                                : "-"}
                                        </td>
                                        <td className="px-4 py-3">
                                            <StatusBadge status={user.status} />
                                        </td>
                                        {showActions && onApprove && onReject && (
                                            <td className="px-4 py-3">
                                                <div className="flex items-center justify-end gap-2">
                                                    <Button
                                                        size="sm"
                                                        variant="outline"
                                                        onClick={() => onApprove(user.id)}
                                                        disabled={isApproving || isRejecting}
                                                        className="bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20"
                                                    >
                                                        {isApproving ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <>
                                                                <Check className="w-4 h-4 mr-1" />
                                                                Зөвшөөрөх
                                                            </>
                                                        )}
                                                    </Button>

                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button
                                                                size="sm"
                                                                variant="outline"
                                                                disabled={isApproving || isRejecting}
                                                                className="bg-red-500/10 text-red-500 border-red-500/30 hover:bg-red-500/20"
                                                            >
                                                                <X className="w-4 h-4 mr-1" />
                                                                Татгалзах
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent>
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle>Хэрэглэгчийг татгалзах уу?</AlertDialogTitle>
                                                                <AlertDialogDescription>
                                                                    "{user.email}" хэрэглэгчийн бүртгэлийг татгалзах уу?
                                                                    Тэд системд нэвтрэх боломжгүй болно.
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel>Болих</AlertDialogCancel>
                                                                <AlertDialogAction
                                                                    onClick={() => onReject(user.id)}
                                                                    className="bg-red-500 hover:bg-red-600"
                                                                >
                                                                    Татгалзах
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

// Main component
export function UsersManagement() {
    const { toast } = useToast();
    const [activeTab, setActiveTab] = useState("pending");

    // Data hooks
    const { data: pendingUsers = [], isLoading: isPendingLoading, refetch: refetchPending } = usePendingUsers();
    const { data: tenantUsers = [], isLoading: isUsersLoading, refetch: refetchUsers } = useTenantUsers();
    const { data: companyInfo } = useCompanyInfo();

    // Mutation hooks
    const approveUser = useApproveUser();
    const rejectUser = useRejectUser();

    // Filter users by status
    const activeUsers = tenantUsers.filter((u) => u.status === "active");
    const rejectedUsers = tenantUsers.filter((u) => u.status === "rejected");

    // Handle approve
    const handleApprove = async (userId: string) => {
        try {
            await approveUser.mutateAsync(userId);
            toast({
                title: "✅ Амжилттай",
                description: "Хэрэглэгчийг идэвхжүүллээ",
            });
        } catch (error: any) {
            toast({
                title: "Алдаа",
                description: error.message || "Баталгаажуулахад алдаа гарлаа",
                variant: "destructive",
            });
        }
    };

    // Handle reject
    const handleReject = async (userId: string) => {
        try {
            await rejectUser.mutateAsync(userId);
            toast({
                title: "❌ Татгалзлаа",
                description: "Хэрэглэгчийн хүсэлтийг татгалзлаа",
            });
        } catch (error: any) {
            toast({
                title: "Алдаа",
                description: error.message || "Татгалзахад алдаа гарлаа",
                variant: "destructive",
            });
        }
    };

    // Copy company code
    const copyCompanyCode = () => {
        if (companyInfo?.code) {
            navigator.clipboard.writeText(companyInfo.code);
            toast({
                title: "Хуулагдлаа",
                description: `Компанийн код: ${companyInfo.code}`,
            });
        }
    };

    // Refresh data
    const handleRefresh = () => {
        refetchPending();
        refetchUsers();
        toast({
            title: "Шинэчиллээ",
            description: "Хэрэглэгчдийн жагсаалт шинэчлэгдлээ",
        });
    };

    return (
        <div className="space-y-6">
            {/* Company Code Card */}
            {companyInfo?.code && (
                <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
                    <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-primary/10">
                                    <Building2 className="w-5 h-5 text-primary" />
                                </div>
                                <div>
                                    <p className="text-sm text-muted-foreground">Компанийн код</p>
                                    <p className="text-lg font-mono font-bold tracking-wider">{companyInfo.code}</p>
                                </div>
                            </div>
                            <Button variant="outline" size="sm" onClick={copyCompanyCode}>
                                <Copy className="w-4 h-4 mr-2" />
                                Хуулах
                            </Button>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 ml-12">
                            Энэ кодыг шинэ хэрэглэгчид бүртгүүлэхдээ ашиглана
                        </p>
                    </CardContent>
                </Card>
            )}

            {/* Main Card */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="flex items-center gap-3">
                                <Users className="w-6 h-6 text-primary" />
                                Хэрэглэгч удирдах
                            </CardTitle>
                            <CardDescription>
                                Хүлээгдэж буй хэрэглэгчдийг батлах, татгалзах
                            </CardDescription>
                        </div>
                        <Button variant="outline" size="sm" onClick={handleRefresh}>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Шинэчлэх
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Tabs value={activeTab} onValueChange={setActiveTab}>
                        <TabsList className="grid w-full grid-cols-3 mb-6">
                            <TabsTrigger value="pending" className="gap-2">
                                <Clock className="w-4 h-4" />
                                Хүлээгдэж буй
                                {pendingUsers.length > 0 && (
                                    <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                                        {pendingUsers.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                            <TabsTrigger value="active" className="gap-2">
                                <UserCheck className="w-4 h-4" />
                                Идэвхтэй
                                <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                                    {activeUsers.length}
                                </Badge>
                            </TabsTrigger>
                            <TabsTrigger value="rejected" className="gap-2">
                                <UserX className="w-4 h-4" />
                                Татгалзсан
                                {rejectedUsers.length > 0 && (
                                    <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
                                        {rejectedUsers.length}
                                    </Badge>
                                )}
                            </TabsTrigger>
                        </TabsList>

                        {/* Pending Tab */}
                        <TabsContent value="pending">
                            {pendingUsers.length === 0 && !isPendingLoading ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-emerald-500/10 flex items-center justify-center">
                                        <Check className="w-8 h-8 text-emerald-500" />
                                    </div>
                                    <p className="text-lg font-medium">Одоогоор хүлээгдэж буй хэрэглэгч алга ✅</p>
                                    <p className="text-sm mt-1">Шинэ хэрэглэгч бүртгүүлбэл энд харагдана</p>
                                </div>
                            ) : (
                                <UsersTable
                                    users={pendingUsers}
                                    isLoading={isPendingLoading}
                                    showActions={true}
                                    onApprove={handleApprove}
                                    onReject={handleReject}
                                    isApproving={approveUser.isPending}
                                    isRejecting={rejectUser.isPending}
                                />
                            )}
                        </TabsContent>

                        {/* Active Tab */}
                        <TabsContent value="active">
                            <UsersTable users={activeUsers} isLoading={isUsersLoading} />
                        </TabsContent>

                        {/* Rejected Tab */}
                        <TabsContent value="rejected">
                            {rejectedUsers.length === 0 && !isUsersLoading ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-muted/50 flex items-center justify-center">
                                        <UserX className="w-8 h-8 opacity-50" />
                                    </div>
                                    <p className="text-lg font-medium">Татгалзсан хэрэглэгч байхгүй</p>
                                </div>
                            ) : (
                                <UsersTable users={rejectedUsers} isLoading={isUsersLoading} />
                            )}
                        </TabsContent>
                    </Tabs>
                </CardContent>
            </Card>
        </div>
    );
}
