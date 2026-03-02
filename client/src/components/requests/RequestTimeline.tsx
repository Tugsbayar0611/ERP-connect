import { format } from "date-fns";
import { formatLocalDate } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { User, Clock, CheckCircle, XCircle, FileText, Calendar, Edit2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TimelineEvent {
    id: string;
    requestId: string;
    actorName: string;
    actorId?: string;
    actorRole?: string; // Added role
    eventType: string; // 'created', 'updated', 'decision', 'commented', etc.
    toStatus?: string;
    comment?: string;
    createdAt: string;
    meta?: any;
}

interface RequestTimelineProps {
    requestId: string;
    type: "leave" | "travel" | "reimbursement" | string;
}

export function RequestTimeline({ requestId, type }: RequestTimelineProps) {
    // Determine endpoint based on type
    const endpoint = `/api/requests/${requestId}/events`;

    const { data: events = [], isLoading } = useQuery<TimelineEvent[]>({
        queryKey: ["request-timeline", type, requestId],
        queryFn: async () => {
            const res = await fetch(endpoint);
            if (!res.ok) return [];
            return res.json();
        }
    });

    if (isLoading) {
        return (
            <div className="space-y-6 pt-4 px-2">
                {[1, 2, 3].map(i => (
                    <div key={i} className="flex gap-4">
                        <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                        <div className="flex-1 space-y-2">
                            <div className="h-4 w-1/3 bg-muted animate-pulse rounded" />
                            <div className="h-3 w-1/4 bg-muted animate-pulse rounded" />
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (events.length === 0) {
        return (
            <div className="text-center py-8 text-muted-foreground">
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-20" />
                <p>Одоогоор үйлдэл хийгдээгүй.</p>
            </div>
        );
    }

    // Helper to get icon and color
    const getEventStyle = (event: TimelineEvent) => {
        switch (event.eventType) {
            case 'created':
                return { icon: FileText, color: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400" };
            case 'decision':
                if (event.toStatus === 'approved') return { icon: CheckCircle, color: "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400" };
                if (event.toStatus === 'rejected') return { icon: XCircle, color: "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400" };
                return { icon: User, color: "bg-gray-100 text-gray-600" };
            case 'update':
            case 'updated':
                return { icon: Edit2, color: "bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400" };
            case 'cancel':
            case 'cancelled':
                return { icon: XCircle, color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400" };
            default:
                return { icon: Calendar, color: "bg-gray-100 text-gray-600" };
        }
    };

    return (
        <div className="relative space-y-0 pb-4">
            {/* Vertical Line */}
            <div className="absolute left-[19px] top-2 bottom-4 w-0.5 bg-border -z-10" />

            {events.map((event, index) => {
                const style = getEventStyle(event);
                const Icon = style.icon;

                return (
                    <div key={event.id} className="group relative flex gap-4 pb-8 last:pb-0">
                        {/* Icon Node */}
                        <div className={cn(
                            "relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full border bg-background shadow-sm transition-all group-hover:scale-110",
                            style.color
                        )}>
                            <Icon className="h-5 w-5" />
                        </div>

                        {/* Content */}
                        <div className="flex-1 pt-1.5">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 mb-1">
                                <p className="text-sm font-semibold text-foreground">
                                    {getEventDescription(event)}
                                </p>
                                <time className="text-xs text-muted-foreground whitespace-nowrap">
                                    {formatLocalDate(event.createdAt, "MM/dd HH:mm")}
                                </time>
                            </div>

                            <div className="text-xs text-muted-foreground flex items-center gap-2">
                                <span className="flex items-center gap-1">
                                    <User className="w-3 h-3" />
                                    {event.actorName}
                                </span>
                                {event.actorRole && event.actorRole !== 'system' && (
                                    <span className={cn(
                                        "px-1.5 py-0.5 rounded text-[10px] uppercase font-bold",
                                        event.actorRole === 'admin' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
                                            event.actorRole === 'manager' ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" :
                                                event.actorRole === 'finance' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
                                                    "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                                    )}>
                                        {event.actorRole}
                                    </span>
                                )}
                            </div>

                            {event.comment && (
                                <div className="mt-2 rounded-md bg-muted/50 p-3 text-sm italic text-muted-foreground border border-border/50">
                                    "{event.comment}"
                                </div>
                            )}

                            {/* Meta changes visualization could go here if needed */}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

// Event code to Mongolian label mapping
const EVENT_LABELS: Record<string, string> = {
    'created': 'Хүсэлт үүсгэсэн',
    'submitted': 'Илгээсэн',
    'assigned_to_admin': 'Шийдвэрлэгчид хуваарилсан',
    'assigned_to_manager': 'Менежерт хуваарилсан',
    'assigned_to_hr': 'HR-т хуваарилсан',
    'approved': 'Зөвшөөрсөн',
    'rejected': 'Татгалзсан',
    'cancelled': 'Цуцалсан',
    'cancel': 'Цуцалсан',
    'updated': 'Мэдээлэл шинэчилсэн',
    'update': 'Мэдээлэл шинэчилсэн',
    'pdf_generated': 'PDF үүсгэсэн',
    'comment_added': 'Тайлбар нэмсэн',
    'decision': 'Шийдвэрлэсэн',
};

function getEventDescription(event: TimelineEvent): string {
    // Check for decision type with status
    if (event.eventType === 'decision') {
        if (event.toStatus === 'approved') return 'Зөвшөөрсөн';
        if (event.toStatus === 'rejected') return 'Татгалзсан';
        return 'Шийдвэрлэсэн';
    }

    // Use mapping or fallback to eventType
    return EVENT_LABELS[event.eventType] || event.eventType;
}
