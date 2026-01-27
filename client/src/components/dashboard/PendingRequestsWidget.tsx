import * as React from "react";
import { Clock, AlertCircle, Check, X, ExternalLink, FileText } from "lucide-react";
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from "@/components/ui/GlassCard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";

interface PendingRequestsWidgetProps {
    pendingCount?: number;
    isLoading?: boolean;
}

const leaveTypeLabels: Record<string, string> = {
    vacation: "Ээлжийн амралт",
    sick: "Өвчний чөлөө",
    personal: "Хувийн хэргээр",
    other: "Бусад",
};

export function PendingRequestsWidget({ pendingCount = 0, isLoading = false }: PendingRequestsWidgetProps) {
    const [, setLocation] = useLocation();

    // Fetch recent pending leave requests
    const { data: leaveRequests = [], isLoading: isLoadingRequests } = useQuery<any[]>({
        queryKey: ["/api/leave-requests", "pending"],
        queryFn: async () => {
            const res = await fetch("/api/leave-requests?status=pending");
            if (!res.ok) return [];
            return res.json();
        },
        staleTime: 30000, // Cache for 30 seconds
    });

    const loading = isLoading || isLoadingRequests;
    const recentRequests = leaveRequests.slice(0, 3);

    if (loading) {
        return (
            <GlassCard>
                <GlassCardHeader>
                    <GlassCardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-400" />
                        Шийдвэрлэх хүсэлтүүд
                    </GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent>
                    <div className="space-y-3">
                        {[1, 2].map((i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton className="w-8 h-8 rounded-lg" />
                                <div className="flex-1">
                                    <Skeleton className="h-4 w-32 mb-1" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassCardContent>
            </GlassCard>
        );
    }

    const hasPending = pendingCount > 0 || leaveRequests.length > 0;
    const totalPending = Math.max(pendingCount, leaveRequests.length);

    return (
        <GlassCard glow={hasPending}>
            <GlassCardHeader>
                <div className="flex items-center justify-between w-full">
                    <GlassCardTitle className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-orange-400" />
                        Шийдвэрлэх хүсэлтүүд
                        {hasPending && (
                            <Badge variant="secondary" className="ml-2 bg-orange-500/20 text-orange-300 border-orange-400/30">
                                {totalPending}
                            </Badge>
                        )}
                    </GlassCardTitle>
                    {hasPending && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-orange-400 hover:text-orange-300 hover:bg-orange-500/10"
                            onClick={() => setLocation("/hr/requests")}
                        >
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </GlassCardHeader>
            <GlassCardContent>
                {hasPending ? (
                    <div className="space-y-3">
                        {recentRequests.map((req: any) => (
                            <div
                                key={req.id}
                                className="flex items-center gap-3 p-2 rounded-lg bg-orange-500/10 border border-orange-400/20"
                            >
                                <div className="p-2 rounded-lg bg-orange-500/20">
                                    <FileText className="w-4 h-4 text-orange-400" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate text-slate-100">
                                        {req.employeeFirstName} {req.employeeLastName}
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs text-slate-400">
                                            {leaveTypeLabels[req.type] || req.type}
                                        </span>
                                        <span className="text-xs text-slate-500">•</span>
                                        <span className="text-xs text-slate-500">
                                            {new Date(req.startDate).toLocaleDateString("mn-MN", { month: "short", day: "numeric" })}
                                        </span>
                                    </div>
                                </div>
                                <Badge variant="outline" className="text-[10px] bg-yellow-500/20 text-yellow-300 border-yellow-400/30">
                                    Хүлээгдэж буй
                                </Badge>
                            </div>
                        ))}

                        {totalPending > 3 && (
                            <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-orange-400 border-orange-400/30 hover:bg-orange-500/10"
                                onClick={() => setLocation("/hr/requests")}
                            >
                                Бусад {totalPending - 3} хүсэлт харах
                            </Button>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-6">
                        <div className="text-4xl mb-2">✅</div>
                        <p className="text-sm text-slate-400">Шийдвэрлэх хүсэлт байхгүй</p>
                    </div>
                )}
            </GlassCardContent>
        </GlassCard>
    );
}
