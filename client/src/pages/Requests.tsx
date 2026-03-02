
import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Plus, ListFilter, CheckCircle, XCircle, Wallet, Clock, User as UserIcon } from "lucide-react";
import { format, differenceInDays } from "date-fns";

import { useAuth } from "@/hooks/use-auth";
import { isPrivileged, isManager } from "@shared/roles";
import { RequestItem, RequestScope, RequestType, REQUEST_LABELS } from "@/types/requests";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { RequestsList } from "@/components/requests/RequestsList";
import { RequestTimeline } from "@/components/requests/RequestTimeline";
import { LeaveRequestForm } from "@/components/requests/forms/LeaveRequestForm";
import { TravelRequestForm } from "@/components/requests/forms/TravelRequestForm";
import { ReimbursementRequestForm } from "@/components/requests/forms/ReimbursementRequestForm";

// Form Registry
const REQUEST_FORMS: Record<string, React.FC<any>> = {
    leave: LeaveRequestForm,
    travel: TravelRequestForm,
    reimbursement: ReimbursementRequestForm,
};

export default function RequestsPage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const searchParams = new URLSearchParams(window.location.search);

    // URL State Sync
    const typeParam = (searchParams.get("type") as RequestType) || "leave";
    const scopeParam = (searchParams.get("scope") as RequestScope) || "my";
    const statusParam = searchParams.get("status") || "all";

    // Local state for UI
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const [isApprovalDrawerOpen, setIsApprovalDrawerOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<RequestItem | null>(null);
    const [denialReason, setDenialReason] = useState("");

    // Filters
    const [scopes, setScopes] = useState<RequestScope>(scopeParam);
    const [activeType, setActiveType] = useState<string>(typeParam);
    const [activeStatus, setActiveStatus] = useState<string>(statusParam);

    const canApprove = isPrivileged(user?.role) || isManager(user?.role) || (user as any)?.permissions?.includes("requests:view_approvals");

    // Sync URL on state change
    useEffect(() => {
        const params = new URLSearchParams();
        params.set("type", activeType);
        params.set("scope", scopes);
        if (activeStatus !== "all") params.set("status", activeStatus);

        const newPath = `/requests?${params.toString()}`;
        if (window.location.search !== `?${params.toString()}`) {
            window.history.pushState(null, "", newPath);
        }
    }, [scopes, activeType, activeStatus]);



    // Data Fetching
    const { data: requests = [], isLoading } = useQuery<RequestItem[]>({
        queryKey: ["requests", user?.id, scopes, activeType, activeStatus],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (activeType !== "all") params.set("type", activeType);
            if (activeStatus !== "all") params.set("status", activeStatus);
            // Must send type='all' explicitly if activeType is 'all' due to backend default?
            // Backend defaults to 'leave' if type is missing.
            // So if activeType is 'all', we MUST send type=all.
            if (activeType === "all") params.set("type", "all");

            // Scope handling logic
            if (scopes === "my") {
                params.set("scope", "my");
            } else {
                params.set("scope", "approvals");
            }

            const res = await fetch(`/api/requests?${params.toString()}`);
            if (!res.ok) return [];
            return res.json();
        },
        enabled: !!user,
    });

    // Auto-open drawer from URL
    useEffect(() => {
        const requestIdParam = searchParams.get("requestId");
        if (requestIdParam && requests.length > 0 && !selectedRequest) {
            const req = requests.find(r => r.id === requestIdParam);
            if (req) {
                handleRequestClick(req);
            }
        }
    }, [requests, searchParams]);

    // --- Mutations ---

    // 1. Cancel Request (Employee)
    const cancelMutation = useMutation({
        mutationFn: async (req: RequestItem) => {
            // Check type to call correct endpoint or use generic if available
            // Currently leave requests use /api/leave-requests
            // Generic uses /api/requests/:id ? Not fully implemented for generic cancellation yet.
            // Assumption: For now, we only have 'cancel' for 'leave' implemented in previous checks.
            // But we need to handle 'travel'.
            // TODO: Implement generic cancel endpoint.
            // For now, let's try to map it.

            let url = "";
            if (req.type === 'leave') {
                url = `/api/leave-requests/${req.id}/cancel`;
            } else {
                // Not implemented generic cancel yet
                throw new Error("Cancellation not implemented for this type yet.");
            }

            const res = await fetch(url, {
                method: "POST"
            });
            if (!res.ok) throw new Error("Failed to cancel");
            return res.json();
        },
        onSuccess: () => {
            // Safe predicate-based invalidation
            const safeInvalidate = (prefix: string) => queryClient.invalidateQueries({
                predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === prefix
            });
            safeInvalidate('requests');
            safeInvalidate('request');
            safeInvalidate('request-timeline');
            toast({ title: "Амжилттай", description: "Хүсэлт цуцлагдлаа" });
        },
        onError: (err) => {
            toast({ title: "Алдаа", description: err.message || "Хүсэлт цуцлахад алдаа гарлаа", variant: "destructive" });
        }
    });

    // 2. Approve Request (Manager)
    const approveMutation = useMutation({
        mutationFn: async () => {
            if (!selectedRequest) return;

            // Unified generic approval endpoint
            const url = `/api/requests/${selectedRequest.id}/decide`;
            const body = { decision: 'approved', comment: "Approved via Web" };

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Failed");
            }
            return res.json();
        },
        onSuccess: () => {
            // Safe predicate-based invalidation
            const safeInvalidate = (prefix: string) => queryClient.invalidateQueries({
                predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === prefix
            });
            safeInvalidate('requests');
            safeInvalidate('request');
            safeInvalidate('request-timeline');
            setSelectedRequest(null);
            setIsApprovalDrawerOpen(false);
            toast({ title: "Амжилттай", description: "Хүсэлт зөвшөөрөгдлөө" });
        },
        onError: () => {
            toast({ title: "Алдаа", description: "Зөвшөөрхөд алдаа гарлаа", variant: "destructive" });
        }
    });

    // 3. Reject Request (Manager)
    const rejectMutation = useMutation({
        mutationFn: async () => {
            if (!selectedRequest) return;
            if (!denialReason) throw new Error("Reason required");

            // Unified generic approval endpoint
            const url = `/api/requests/${selectedRequest.id}/decide`;
            const body = { decision: 'rejected', comment: denialReason };

            const res = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || "Failed");
            }
            return res.json();
        },
        onSuccess: () => {
            // Safe predicate-based invalidation
            const safeInvalidate = (prefix: string) => queryClient.invalidateQueries({
                predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === prefix
            });
            safeInvalidate('requests');
            safeInvalidate('request');
            safeInvalidate('request-timeline');
            setSelectedRequest(null);
            setIsApprovalDrawerOpen(false);
            setDenialReason("");
            toast({ title: "Амжилттай", description: "Хүсэлт татгалзагдлаа" });
        },
        onError: (err) => {
            toast({ title: "Алдаа", description: err.message || "Татгалзахад алдаа гарлаа", variant: "destructive" });
        }
    });

    const handleCreateClick = () => {
        setIsDrawerOpen(true);
    };

    const handleRequestClick = (req: RequestItem) => {
        setSelectedRequest(req);
        setDenialReason("");
        setIsApprovalDrawerOpen(true); // Re-using the same drawer for viewing details
    };

    const ActiveForm = REQUEST_FORMS[activeType] || (() => <div className="p-4">Form not found for {activeType}</div>);

    return (
        <div className="space-y-6 container mx-auto py-6 max-w-6xl">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Хүсэлтүүд</h1>
                    <p className="text-muted-foreground">Бүх төрлийн хүсэлт илгээх, хянах төв.</p>
                </div>
                <Button onClick={handleCreateClick} className="shadow-md">
                    <Plus className="w-4 h-4 mr-2" />
                    Шинэ хүсэлт
                </Button>
            </div>

            {/* Leave Balance Card (Mock for now, future: fetch from API) */}
            {activeType === 'leave' && scopes === 'my' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-scale-in">
                    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20 shadow-sm relative overflow-hidden">
                        <div className="absolute right-0 top-0 opacity-10">
                            <Wallet className="w-24 h-24 -mr-4 -mt-4 text-primary" />
                        </div>
                        <CardHeader className="pb-2">
                            <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                                Үлдсэн чөлөө
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-baseline gap-2">
                                <span className="text-3xl font-bold text-primary">15</span>
                                <span className="text-sm text-muted-foreground">хоног</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                                Жилийн ээлжийн амралт: 21 хоног
                            </p>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Tabs & Filters */}
            <Tabs value={scopes} onValueChange={(v) => setScopes(v as RequestScope)} className="space-y-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b pb-4">
                    <TabsList>
                        <TabsTrigger value="my">Миний хүсэлтүүд</TabsTrigger>
                        {canApprove && (
                            <TabsTrigger value="approvals" className="relative">
                                Зөвшөөрөл
                            </TabsTrigger>
                        )}
                    </TabsList>

                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mr-2">
                            <ListFilter className="w-4 h-4" />
                            Шүүлтүүр:
                        </div>
                        <Select value={activeType} onValueChange={setActiveType}>
                            <SelectTrigger className="w-[140px] h-9">
                                <SelectValue placeholder="Төрөл" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Бүх төрөл</SelectItem>
                                <SelectItem value="leave">Чөлөө</SelectItem>
                                <SelectItem value="travel">Томилолт</SelectItem>
                                <SelectItem value="reimbursement">Төлбөр</SelectItem>
                            </SelectContent>
                        </Select>

                        <Select value={activeStatus} onValueChange={setActiveStatus}>
                            <SelectTrigger className="w-[140px] h-9">
                                <SelectValue placeholder="Төлөв" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Бүх төлөв</SelectItem>
                                <SelectItem value="pending">Хүлээгдэж буй</SelectItem>
                                <SelectItem value="approved">Зөвшөөрсөн</SelectItem>
                                <SelectItem value="rejected">Татгалзсан</SelectItem>
                                <SelectItem value="cancelled">Цуцалсан</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>



                <TabsContent value="my" className="mt-0">
                    <RequestsList
                        requests={requests}
                        isLoading={isLoading}
                        showRequester={false}
                        activeTab="my"
                        onCancel={(req) => cancelMutation.mutate(req)}
                        onCreateNew={handleCreateClick}
                        onView={handleRequestClick}
                    />
                </TabsContent>

                <TabsContent value="approvals" className="mt-0">
                    <RequestsList
                        requests={requests}
                        isLoading={isLoading}
                        showRequester={true}
                        activeTab="approvals"
                        onView={handleRequestClick}
                    />
                </TabsContent>
            </Tabs>

            {/* Create Drawer */}
            <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <SheetContent className="sm:max-w-[600px] overflow-y-auto w-full">
                    <SheetHeader className="mb-6">
                        <SheetTitle>Шинэ хүсэлт үүсгэх</SheetTitle>
                        <SheetDescription>
                            Хүсэлтийн төрлөө сонгоод мэдээллээ бөглөнө үү.
                        </SheetDescription>
                    </SheetHeader>
                    {REQUEST_FORMS[activeType] ? (
                        <ActiveForm
                            onSuccess={() => setIsDrawerOpen(false)}
                            onCancel={() => setIsDrawerOpen(false)}
                        />
                    ) : (
                        <div className="py-8 text-center text-muted-foreground">
                            Энэ төрлийн хүсэлт одоогоор хөгжүүлэлтийн шатанд байна.
                        </div>
                    )}
                </SheetContent>
            </Sheet>

            {/* Approval Detail Drawer */}
            <Sheet open={isApprovalDrawerOpen} onOpenChange={setIsApprovalDrawerOpen}>
                <SheetContent className="sm:max-w-[600px] overflow-y-auto w-full">
                    <SheetHeader>
                        <SheetTitle>Хүсэлт шийдвэрлэх</SheetTitle>
                        <SheetDescription>
                            Ажилтны хүсэлттэй танилцаж шийдвэр гаргана уу.
                        </SheetDescription>
                    </SheetHeader>

                    {selectedRequest && (
                        <Tabs defaultValue="details" className="mt-6">
                            <TabsList className="grid w-full grid-cols-2">
                                <TabsTrigger value="details">Дэлгэрэнгүй</TabsTrigger>
                                <TabsTrigger value="history">Түүх</TabsTrigger>
                            </TabsList>

                            <TabsContent value="history" className="mt-4">
                                <RequestTimeline requestId={selectedRequest.id} type={selectedRequest.type} />
                            </TabsContent>

                            <TabsContent value="details" className="space-y-6 mt-4">

                                {/* Request Details */}
                                <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h4 className="font-semibold text-sm">Ажилтан</h4>
                                            <p className="text-sm">{selectedRequest.requestedBy?.fullName}</p>
                                            <p className="text-xs text-muted-foreground">{selectedRequest.requestedBy?.department}</p>
                                        </div>
                                        <Badge variant="outline">{REQUEST_LABELS[selectedRequest.type] || selectedRequest.type}</Badge>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm">
                                        <div>
                                            <span className="text-muted-foreground block text-xs">Эхлэх:</span>
                                            {selectedRequest.startDate && format(new Date(selectedRequest.startDate), "yyyy.MM.dd")}
                                        </div>
                                        <div>
                                            <span className="text-muted-foreground block text-xs">Дуусах:</span>
                                            {selectedRequest.endDate && format(new Date(selectedRequest.endDate), "yyyy.MM.dd")}
                                        </div>
                                        <div className="col-span-2">
                                            <span className="text-muted-foreground block text-xs">Хугацаа:</span>
                                            {selectedRequest.startDate && selectedRequest.endDate && (
                                                <span>{differenceInDays(new Date(selectedRequest.endDate), new Date(selectedRequest.startDate)) + 1} өдөр</span>
                                            )}
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-muted-foreground block text-xs mb-1">Шалтгаан:</span>
                                        <p className="text-sm border-l-2 pl-3 py-1 italic bg-background/50 rounded-r">
                                            {selectedRequest.details || "Тайлбаргүй"}
                                        </p>
                                    </div>
                                    {selectedRequest.meta && Object.keys(selectedRequest.meta as object).length > 0 && (
                                        <div className="pt-2 border-t mt-2">
                                            <h5 className="font-semibold text-xs mb-1">Нэмэлт мэдээлэл</h5>
                                            <pre className="text-xs bg-muted p-2 rounded overflow-auto whitespace-pre-wrap">
                                                {JSON.stringify(selectedRequest.meta, null, 2)}
                                            </pre>
                                        </div>
                                    )}
                                </div>

                                {/* Actions */}
                                {['pending', 'submitted'].includes(selectedRequest.status) ? (
                                    <div className="space-y-4 pt-4 border-t">
                                        <div className="space-y-2">
                                            <Label htmlFor="reason">Татгалзах шалтгаан (Татгалзах бол заавал)</Label>
                                            <Textarea
                                                id="reason"
                                                placeholder="Яагаад татгалзаж байгаа тухай..."
                                                value={denialReason}
                                                onChange={(e) => setDenialReason(e.target.value)}
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <Button
                                                variant="outline"
                                                className="w-full border-red-200 text-red-600 hover:bg-red-50"
                                                onClick={() => rejectMutation.mutate()}
                                                disabled={rejectMutation.isPending}
                                            >
                                                <XCircle className="w-4 h-4 mr-2" />
                                                Татгалзах
                                            </Button>
                                            <Button
                                                className="w-full bg-green-600 hover:bg-green-700"
                                                onClick={() => approveMutation.mutate()}
                                                disabled={approveMutation.isPending}
                                            >
                                                <CheckCircle className="w-4 h-4 mr-2" />
                                                Зөвшөөрөх
                                            </Button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center p-4 bg-muted rounded">
                                        Энэ хүсэлт шийдвэрлэгдсэн байна.
                                    </div>
                                )}
                            </TabsContent>
                        </Tabs>
                    )}
                </SheetContent>
            </Sheet>
        </div >
    );
}


