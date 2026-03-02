
import * as React from "react";
import { Link, useLocation } from "wouter";
import {
    FileWarning,
    Package,
    Users,
    Clock,
    AlertTriangle,
    ChevronRight,
    CheckCircle2,
    ArrowRight,
    Bell,
    CreditCard
} from "lucide-react";
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ActionItem {
    id: string;
    type: "critical" | "warning" | "info" | "success";
    icon: React.ElementType;
    title: string;
    description: string;
    actionLabel: string;
    href: string;
    count?: number;
}

interface ActionCenterWidgetProps {
    overdueInvoices?: number;
    lowStockItems?: number;
    pendingRequests?: number;
    upcomingExpiry?: number;
    userName?: string;
}

export function ActionCenterWidget({
    overdueInvoices = 0,
    lowStockItems = 0,
    pendingRequests = 0,
    upcomingExpiry = 0,
    userName = "User",
}: ActionCenterWidgetProps) {
    const [, setLocation] = useLocation();

    // Construct the To-Do list dynamically based on stats
    const actions: ActionItem[] = [
        ...(overdueInvoices > 0 ? [{
            id: 'overdue-inv',
            type: "critical" as const,
            icon: FileWarning,
            title: "Хугацаа хэтэрсэн нэхэмжлэх",
            description: `${overdueInvoices} нэхэмжлэхийн хугацаа хэтэрсэн байна.`,
            actionLabel: "Шийдвэрлэх",
            href: "/invoices?status=overdue",
            count: overdueInvoices
        }] : []),
        ...(pendingRequests > 0 ? [{
            id: 'pending-req',
            type: "warning" as const,
            icon: Users,
            title: "Батлах хүсэлтүүд",
            description: `${pendingRequests} ажилтны хүсэлт хүлээгдэж байна.`,
            actionLabel: "Батлах",
            href: "/requests", // Assuming requests page exists or filtered view
            count: pendingRequests
        }] : []),
        ...(lowStockItems > 0 ? [{
            id: 'low-stock',
            type: "warning" as const,
            icon: Package,
            title: "Барааны үлдэгдэл бага",
            description: `${lowStockItems} барааны үлдэгдэл доод хэмжээнд хүрсэн.`,
            actionLabel: "Захиалах",
            href: "/inventory?filter=low-stock",
            count: lowStockItems
        }] : []),
        ...(upcomingExpiry > 0 ? [{
            id: 'expiry',
            type: "info" as const,
            icon: Clock,
            title: "Хугацаа дуусах бараа",
            description: `${upcomingExpiry} барааны хугацаа 30 хоногийн дотор дуусна.`,
            actionLabel: "Харах",
            href: "/inventory?tab=expiry",
            count: upcomingExpiry
        }] : []),
    ];

    const totalActions = actions.length;

    return (
        <GlassCard className="h-full border-l-4 border-l-primary/50">
            <GlassCardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <GlassCardTitle className="flex items-center gap-2 text-lg">
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                        Action Center
                    </GlassCardTitle>
                    {totalActions > 0 ? (
                        <Badge variant="destructive" className="animate-pulse">
                            {totalActions} ажил хүлээгдэж байна
                        </Badge>
                    ) : (
                        <Badge variant="outline" className="text-green-600 border-green-200 bg-green-50">
                            Бүх зүйл хэвийн
                        </Badge>
                    )}
                </div>
            </GlassCardHeader>
            <GlassCardContent>
                {totalActions > 0 ? (
                    <div className="space-y-3 mt-2">
                        {actions.map((action) => (
                            <div
                                key={action.id}
                                className="group flex items-start justify-between p-3 rounded-xl bg-muted/30 hover:bg-muted/60 transition-all border border-transparent hover:border-border/50"
                            >
                                <div className="flex gap-3">
                                    <div className={cn(
                                        "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                        action.type === "critical" && "bg-red-100 text-red-600 dark:bg-red-900/30",
                                        action.type === "warning" && "bg-amber-100 text-amber-600 dark:bg-amber-900/30",
                                        action.type === "info" && "bg-blue-100 text-blue-600 dark:bg-blue-900/30",
                                    )}>
                                        <action.icon className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h4 className="text-sm font-semibold flex items-center gap-2">
                                            {action.title}
                                            {action.count && action.count > 1 && (
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
                                                    {action.count}
                                                </Badge>
                                            )}
                                        </h4>
                                        <p className="text-xs text-muted-foreground mt-0.5 max-w-[200px] sm:max-w-xs">{action.description}</p>
                                    </div>
                                </div>
                                <Button
                                    size="sm"
                                    variant={action.type === "critical" ? "default" : "outline"}
                                    className="self-center h-8 text-xs shrink-0 ml-2"
                                    onClick={() => setLocation(action.href)}
                                >
                                    {action.actionLabel}
                                    <ArrowRight className="ml-1 h-3 w-3" />
                                </Button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-3">
                            <Sparkles className="h-8 w-8 text-green-600 dark:text-green-400" />
                        </div>
                        <h3 className="font-medium text-foreground">Танд хийх ажил алга!</h3>
                        <p className="text-xs text-muted-foreground mt-1 max-w-[250px]">
                            Бүх анхаарал татсан асуудлууд шийдэгдсэн байна.
                        </p>
                    </div>
                )}
            </GlassCardContent>
        </GlassCard>
    );
}

function Sparkles(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            {...props}
            xmlns="http://www.w3.org/2000/svg"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
            <path d="M5 3v4" />
            <path d="M9 3v4" />
            <path d="M7 3v4" />
            <path d="M3 7h4" />
            <path d="M3 5h4" />
            <path d="M3 9h4" />
        </svg>
    )
}
