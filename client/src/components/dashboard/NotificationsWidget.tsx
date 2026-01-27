import * as React from "react";
import { Link } from "wouter";
import {
    FileWarning,
    Package,
    Users,
    Clock,
    AlertTriangle,
    ChevronRight
} from "lucide-react";
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from "@/components/ui/GlassCard";
import { cn } from "@/lib/utils";

interface NotificationItem {
    type: "error" | "warning" | "info";
    icon: React.ElementType;
    label: string;
    count: number;
    href: string;
}

interface NotificationsWidgetProps {
    overdueInvoices?: number;
    lowStockItems?: number;
    pendingRequests?: number;
    upcomingExpiry?: number;
}

const typeStyles = {
    error: "bg-red-500/20 text-red-400 border-red-500/30",
    warning: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

function NotificationRow({ item }: { item: NotificationItem }) {
    const Icon = item.icon;

    return (
        <Link href={item.href}>
            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
                <div className="flex items-center gap-3">
                    <div className={cn(
                        "w-9 h-9 rounded-lg flex items-center justify-center border",
                        typeStyles[item.type]
                    )}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <span className="text-sm text-slate-300 group-hover:text-slate-100 transition-colors">
                        {item.label}
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <span className={cn(
                        "text-sm font-semibold px-2 py-0.5 rounded-full",
                        item.type === "error" && "bg-red-500/20 text-red-400",
                        item.type === "warning" && "bg-amber-500/20 text-amber-400",
                        item.type === "info" && "bg-blue-500/20 text-blue-400"
                    )}>
                        {item.count}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                </div>
            </div>
        </Link>
    );
}

export function NotificationsWidget({
    overdueInvoices = 0,
    lowStockItems = 0,
    pendingRequests = 0,
    upcomingExpiry = 0,
}: NotificationsWidgetProps) {
    const notifications: NotificationItem[] = [
        {
            type: "error" as const,
            icon: FileWarning,
            label: "Хугацаа хэтэрсэн нэхэмжлэх",
            count: overdueInvoices,
            href: "/invoices?status=overdue"
        },
        {
            type: "warning" as const,
            icon: Package,
            label: "Бага үлдэгдэлтэй бараа",
            count: lowStockItems,
            href: "/inventory?filter=low-stock"
        },
        {
            type: "warning" as const,
            icon: Clock,
            label: "Хугацаа дуусах бараа",
            count: upcomingExpiry,
            href: "/inventory?tab=expiry"
        },
        {
            type: "info" as const,
            icon: Users,
            label: "Хүлээгдэж буй хүсэлтүүд",
            count: pendingRequests,
            href: "/requests"
        },
    ].filter(n => n.count > 0);

    const totalCount = notifications.reduce((sum, n) => sum + n.count, 0);

    return (
        <GlassCard padding="none" className="overflow-hidden">
            <GlassCardHeader className="px-6 pt-6 pb-0">
                <GlassCardTitle className="flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4 text-amber-400" />
                    Анхааруулга
                </GlassCardTitle>
                {totalCount > 0 && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">
                        {totalCount}
                    </span>
                )}
            </GlassCardHeader>

            <GlassCardContent className="p-3">
                {notifications.length > 0 ? (
                    <div className="space-y-1">
                        {notifications.map((item) => (
                            <NotificationRow key={item.label} item={item} />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                        <AlertTriangle className="h-8 w-8 mb-2 opacity-50" />
                        <span className="text-sm">Анхааруулга байхгүй</span>
                    </div>
                )}
            </GlassCardContent>
        </GlassCard>
    );
}
