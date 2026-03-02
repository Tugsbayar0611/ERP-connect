
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation, useRoute } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Send, CheckCircle2, XCircle, AlertTriangle, Download } from "lucide-react";
import { format } from "date-fns";
import { formatLocalDate } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

const safeFormat = (dateStr: any, fmt: string = "PPP") => {
    if (!dateStr) return "";
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        return format(d, fmt);
    } catch {
        return "";
    }
};

export default function RequestDetails() {
    const [match, params] = useRoute("/me/requests/:id");

    const [location, setLocation] = useLocation();

    // Extract ID hackily since I might be on multiple routes
    const id = location.split('/').pop();

    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const [comment, setComment] = useState("");
    const [isRejectOpen, setIsRejectOpen] = useState(false);

    const { data: request, isLoading } = useQuery({
        queryKey: [`/api/requests/${id}`],
        queryFn: async () => {
            const res = await fetch(`/api/requests/${id}`);
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        enabled: !!id
    });

    // Mutations
    const submitMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch(`/api/requests/${id}/submit`, { method: "POST" });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Илгээгдлээ", description: "Хүсэлтийг зөвшөөрөл хүлээхээр илгээлээ" });
            queryClient.invalidateQueries({ queryKey: [`/api/requests/${id}`] });
        }
    });

    const decideMutation = useMutation({
        mutationFn: async ({ decision, comment }: { decision: string, comment?: string }) => {
            const res = await fetch(`/api/requests/${id}/decide`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ decision, comment })
            }); // Make sure API uses POST /decide or similar
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Амжилттай", description: "Шийдвэр бүртгэгдлээ" });
            // Safe predicate-based invalidation for all request queries
            const safeInvalidate = (prefix: string) => queryClient.invalidateQueries({
                predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === prefix
            });
            safeInvalidate('requests');         // All list views
            safeInvalidate('request');          // Detail views  
            safeInvalidate('request-timeline'); // Timeline
            queryClient.invalidateQueries({ queryKey: [`/api/requests/${id}`] }); // Legacy
            queryClient.invalidateQueries({ queryKey: ["/api/requests/inbox"] }); // Legacy inbox
            setIsRejectOpen(false);
        }
    });

    if (isLoading) return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    if (!request) return <div className="p-8 text-center">Олдсонгүй</div>;

    const isOwner = request.createdBy === user?.id;
    const showDecideActions = request.status === 'submitted' && !isOwner;
    const showSubmitAction = request.status === 'draft' && isOwner;

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-6 max-w-3xl">
            <Button variant="ghost" onClick={() => setLocation(isOwner ? "/me/requests" : "/requests?scope=approvals")} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Буцах
            </Button>

            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{request.title || request.type}</h1>
                    <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="capitalize">{(request.type || "").replace("_", " ")}</Badge>
                        <Badge
                            className={
                                request.status === 'approved' ? 'bg-green-100 text-green-700' :
                                    request.status === 'rejected' ? 'bg-red-100 text-red-700' :
                                        request.status === 'submitted' ? 'bg-blue-100 text-blue-700' : ''
                            }
                        >
                            {({
                                draft: 'Ноорог',
                                submitted: 'Илгээсэн',
                                approved: 'Зөвшөөрсөн',
                                rejected: 'Татгалзсан',
                                cancelled: 'Цуцалсан'
                            } as Record<string, string>)[request.status] || request.status?.toUpperCase()}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                            ID: {request.clientRequestId || (request.id || "").substring(0, 8)}
                        </span>
                    </div>
                </div>
                <div className="text-right text-sm text-muted-foreground">
                    <div>Үүсгэсэн: {formatLocalDate(request.createdAt)}</div>
                    {request.submittedAt && <div>Илгээсэн: {formatLocalDate(request.submittedAt)}</div>}
                </div>
            </div>

            {/* Official Letter Download */}
            {request.type === 'official_letter' && request.status === 'approved' && request.officialLetterNo && (
                <div className="p-4 border rounded-lg bg-green-50 flex items-center justify-between">
                    <div>
                        <h3 className="font-medium text-green-900">Тодорхойлолт бэлэн</h3>
                        <p className="text-sm text-green-700">Ref: {request.officialLetterNo}</p>
                    </div>
                    <Button asChild variant="outline" className="bg-white hover:bg-green-50 border-green-200 text-green-700">
                        <a href={`/api/requests/${request.id}/official-letter.pdf`} target="_blank" rel="noopener noreferrer">
                            <Download className="w-4 h-4 mr-2" />
                            PDF татах
                        </a>
                    </Button>
                </div>
            )}

            {/* Rejection Reason Alert */}
            {request.status === 'rejected' && (
                <div className="p-4 border border-red-200 rounded-lg bg-red-50 flex items-start gap-3">
                    <XCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-red-900">Татгалзсан шалтгаан</h3>
                        <p className="text-red-700 mt-1">
                            {request.approvals?.find((a: any) => a.decision === 'rejected')?.comment || "Шалтгаан тайлбарлаагүй байна."}
                        </p>
                    </div>
                </div>
            )}

            <Card>
                <CardHeader>
                    <CardTitle>Дэлгэрэнгүй</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Common Fields */}
                    {/* Common Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(request.startDate || request.payload?.startDate) ? (
                            <div className="space-y-1">
                                <div className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Эхлэх огноо</div>
                                <div className="text-sm font-medium border p-2 rounded bg-muted/20">
                                    {safeFormat(request.payload?.startDate) || request.startDate}
                                </div>
                            </div>
                        ) : null}
                        {(request.endDate || request.payload?.endDate) ? (
                            <div className="space-y-1">
                                <div className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Дуусах огноо</div>
                                <div className="text-sm font-medium border p-2 rounded bg-muted/20">
                                    {safeFormat(request.payload?.endDate) || request.endDate}
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {/* Reason/Description from Payload */}
                    {request.payload?.reason && (
                        <div className="space-y-1">
                            <div className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">Шалтгаан</div>
                            <div className="text-sm text-muted-foreground border p-3 rounded bg-muted/10 italic">
                                "{request.payload.reason}"
                            </div>
                        </div>
                    )}

                    {/* Other Payload Keys (Dynamic) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                        {Object.entries(request.payload || {}).map(([key, value]) => {
                            if (['startDate', 'endDate', 'reason'].includes(key)) return null;
                            return (
                                <div key={key} className="space-y-1">
                                    <div className="text-xs uppercase text-muted-foreground font-semibold tracking-wider">
                                        {key.replace(/([A-Z])/g, ' $1').trim()}
                                    </div>
                                    <div className="text-sm font-medium border p-2 rounded bg-muted/20">
                                        {String(value)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </CardContent>

                {/* Actions Footer */}
                {(showSubmitAction || showDecideActions) && (
                    <CardFooter className="bg-muted/10 flex justify-end gap-3 pt-6">
                        {showSubmitAction && (
                            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
                                {submitMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                <Send className="mr-2 h-4 w-4" />
                                Илгээх
                            </Button>
                        )}

                        {showDecideActions && (
                            <>
                                <Dialog open={isRejectOpen} onOpenChange={setIsRejectOpen}>
                                    <DialogTrigger asChild>
                                        <Button variant="destructive" disabled={decideMutation.isPending}>
                                            <XCircle className="mr-2 h-4 w-4" /> Татгалзах
                                        </Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Татгалзах</DialogTitle>
                                            <DialogDescription>Татгалзсан шалтгаанаа бичнэ үү.</DialogDescription>
                                        </DialogHeader>
                                        <Textarea
                                            value={comment}
                                            onChange={e => setComment(e.target.value)}
                                            placeholder="Шалтгаан..."
                                        />
                                        <DialogFooter>
                                            <Button variant="destructive" onClick={() => decideMutation.mutate({ decision: 'rejected', comment })}>
                                                Татгалзахыг баталгаажуулах
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>

                                <Button
                                    className="bg-green-600 hover:bg-green-700"
                                    onClick={() => decideMutation.mutate({ decision: 'approved', comment: "Approved via UI" })}
                                    disabled={decideMutation.isPending}
                                >
                                    <CheckCircle2 className="mr-2 h-4 w-4" />
                                    Зөвшөөрөх
                                </Button>
                            </>
                        )}
                    </CardFooter>
                )}
            </Card>
        </div>
    );
}
