
import * as React from "react";
import { Link, useLocation } from "wouter";
import { format, isToday, isYesterday, differenceInMinutes } from "date-fns";
import { mn } from "date-fns/locale";
import {
    Activity,
    CheckCircle2,
    Clock,
    CreditCard,
    FileText,
    Filter,
    MoreHorizontal,
    Pause,
    Play,
    Search,
    UserMinus,
    UserPlus,
    Users,
    XCircle,
    DollarSign,
    AlertTriangle,
    Info,
    ArrowRight,
    Download,
    ExternalLink,
    ChevronDown,
    ChevronUp,
    Eye
} from "lucide-react";
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface ActivityItem {
    id: number | string;
    message: string;
    icon: string;
    eventTime: string;
    actorUserId?: number | string;
    actorName?: string;
    entityType?: string;
    entityId?: number | string;
    entityLabel?: string;
    severity?: "info" | "warning" | "success" | "error";
    url?: string;
    rawAction?: string;
}

interface AggregatedActivity {
    key: string;
    items: ActivityItem[];
    count: number;
    message: string;
    icon: string;
    severity: "info" | "warning" | "success" | "error";
    latestTime: string;
    url?: string;
}

interface ActivityFeedWidgetProps {
    activities: ActivityItem[];
    className?: string;
    userRole?: string; // Admin, HR, Manager, Employee
}

const iconMap: Record<string, React.ElementType> = {
    "activity": Activity,
    "user-plus": UserPlus,
    "user-edit": Users,
    "user-minus": UserMinus,
    "credit-card": CreditCard,
    "check-circle": CheckCircle2,
    "x-circle": XCircle,
    "clock-in": Clock,
    "file-text": FileText,
    "dollar-sign": DollarSign,
};

const severityStyles = {
    info: "text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
    warning: "text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
    success: "text-green-500 bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
    error: "text-red-500 bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800",
};

// Sensitive entity types (HR/Payroll) - requires specific roles
const SENSITIVE_TYPES = ["payroll", "salary_advance", "employee"];

export function ActivityFeedWidget({ activities = [], className, userRole = "Employee" }: ActivityFeedWidgetProps) {
    const [, setLocation] = useLocation();
    const [filterType, setFilterType] = React.useState<string>("all");
    const [filterSeverity, setFilterSeverity] = React.useState<string>("all");
    const [searchQuery, setSearchQuery] = React.useState("");
    const [isPaused, setIsPaused] = React.useState(false);
    const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());
    const [seenIds, setSeenIds] = React.useState<Set<string>>(new Set());

    // Mark items as seen after 30 minutes
    React.useEffect(() => {
        const timer = setInterval(() => {
            const now = new Date();
            const newSeenIds = new Set(seenIds);
            activities.forEach(item => {
                const eventTime = new Date(item.eventTime);
                if (differenceInMinutes(now, eventTime) >= 30) {
                    newSeenIds.add(String(item.id));
                }
            });
            if (newSeenIds.size !== seenIds.size) {
                setSeenIds(newSeenIds);
            }
        }, 60000); // Check every minute
        return () => clearInterval(timer);
    }, [activities, seenIds]);

    // Role-based filtering (hide sensitive events for non-authorized roles)
    const roleFilteredActivities = React.useMemo(() => {
        const canSeeSensitive = ["Admin", "HR", "Manager"].includes(userRole);
        if (canSeeSensitive) return activities;
        return activities.filter(item => !SENSITIVE_TYPES.includes(item.entityType || ""));
    }, [activities, userRole]);

    // Filter Logic
    const filteredActivities = React.useMemo(() => {
        return roleFilteredActivities.filter(item => {
            const matchesType = filterType === "all" || item.entityType === filterType;
            const matchesSeverity = filterSeverity === "all" || (item.severity || "info") === filterSeverity;
            const matchesSearch = searchQuery === "" ||
                item.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (item.entityLabel && item.entityLabel.toLowerCase().includes(searchQuery.toLowerCase()));

            return matchesType && matchesSeverity && matchesSearch;
        });
    }, [roleFilteredActivities, filterType, filterSeverity, searchQuery]);

    // Unread count (items less than 30 mins old that haven't been marked seen)
    const unreadCount = React.useMemo(() => {
        const now = new Date();
        return filteredActivities.filter(item => {
            const eventTime = new Date(item.eventTime);
            const isNew = differenceInMinutes(now, eventTime) < 30;
            const isSeen = seenIds.has(String(item.id));
            return isNew && !isSeen;
        }).length;
    }, [filteredActivities, seenIds]);

    // Aggregation Logic (group similar events by action + type + day)
    const aggregatedActivities = React.useMemo(() => {
        const groups: Record<string, AggregatedActivity> = {};

        filteredActivities.forEach(item => {
            const date = new Date(item.eventTime);
            const dateKey = isToday(date) ? "today" : isYesterday(date) ? "yesterday" : format(date, "yyyy-MM-dd");
            const groupKey = `${dateKey}-${item.entityType || "unknown"}-${item.rawAction || "action"}`;

            if (!groups[groupKey]) {
                groups[groupKey] = {
                    key: groupKey,
                    items: [],
                    count: 0,
                    message: item.message,
                    icon: item.icon,
                    severity: item.severity || "info",
                    latestTime: item.eventTime,
                    url: item.url
                };
            }
            groups[groupKey].items.push(item);
            groups[groupKey].count++;
            // Update to latest time
            if (new Date(item.eventTime) > new Date(groups[groupKey].latestTime)) {
                groups[groupKey].latestTime = item.eventTime;
            }
        });

        // Create aggregated messages for groups with multiple items
        Object.values(groups).forEach(group => {
            if (group.count > 1) {
                const typeLabel = group.items[0].entityType === "invoice" ? "нэхэмжлэх" :
                    group.items[0].entityType === "employee" ? "ажилтан" :
                        group.items[0].entityType === "payroll" ? "цалин" :
                            group.items[0].entityType === "attendance" ? "ирц" :
                                group.items[0].entityType === "salary_advance" ? "урьдчилгаа" : "үйлдэл";
                group.message = `${group.count} ${typeLabel} ${group.items[0].rawAction === "create" ? "нэмэгдсэн" : group.items[0].rawAction === "update" ? "шинэчлэгдсэн" : "өөрчлөгдсөн"}`;
            }
        });

        return Object.values(groups).sort((a, b) => new Date(b.latestTime).getTime() - new Date(a.latestTime).getTime());
    }, [filteredActivities]);

    // Grouping by date for display
    const groupedAggregatedActivities = React.useMemo(() => {
        const groups: Record<string, AggregatedActivity[]> = {};

        aggregatedActivities.forEach(agg => {
            const date = new Date(agg.latestTime);
            let key = "Earlier";

            if (isToday(date)) key = "Өнөөдөр";
            else if (isYesterday(date)) key = "Өчигдөр";
            else key = format(date, "yyyy-MM-dd");

            if (!groups[key]) groups[key] = [];
            groups[key].push(agg);
        });

        return groups;
    }, [aggregatedActivities]);

    const handleAction = (url?: string) => {
        if (url) setLocation(url);
    };

    const toggleGroup = (key: string) => {
        setExpandedGroups(prev => {
            const newSet = new Set(prev);
            if (newSet.has(key)) newSet.delete(key);
            else newSet.add(key);
            return newSet;
        });
    };

    // Export to CSV
    const handleExport = () => {
        const headers = ["ID", "Event Time", "Entity Type", "Action", "Message", "Actor", "Severity"];
        const rows = filteredActivities.map(item => [
            item.id,
            item.eventTime,
            item.entityType || "",
            item.rawAction || "",
            item.message,
            item.actorName || "",
            item.severity || "info"
        ]);
        const csvContent = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
        const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `activity_feed_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    // Mark all as seen
    const markAllAsSeen = () => {
        const allIds = new Set(filteredActivities.map(item => String(item.id)));
        setSeenIds(prev => new Set([...prev, ...allIds]));
    };

    return (
        <GlassCard className={cn("h-full flex flex-col overflow-hidden", className)}>
            <GlassCardHeader className="pb-2 flex-shrink-0 space-y-2">
                <div className="flex items-center justify-between">
                    <GlassCardTitle className="flex items-center gap-2 text-lg">
                        <Activity className="h-5 w-5 text-indigo-500 animate-pulse" />
                        Компанийн зүрхний цохилт
                        {unreadCount > 0 && (
                            <Badge variant="destructive" className="ml-2 text-xs animate-pulse">
                                Шинэ: {unreadCount}
                            </Badge>
                        )}
                    </GlassCardTitle>
                    <div className="flex items-center gap-1">
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={markAllAsSeen}>
                                        <Eye className="h-4 w-4 text-slate-400" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Бүгдийг уншсан болгох</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsPaused(!isPaused)}>
                                        {isPaused ? <Play className="h-4 w-4 text-green-500" /> : <Pause className="h-4 w-4 text-slate-400" />}
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>{isPaused ? "Үргэлжлүүлэх" : "Түр зогсоох (Live)"}</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleExport}>
                                        <Download className="h-4 w-4 text-slate-400" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>CSV татах</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <TooltipProvider>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setLocation("/activity")}>
                                        <ExternalLink className="h-4 w-4 text-slate-400" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Бүгдийг харах</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                        <Badge variant="outline" className="ml-1 text-[10px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800">
                            Live
                        </Badge>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="flex gap-2 items-center">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
                        <Input
                            placeholder="Хайх..."
                            className="h-8 pl-8 text-xs bg-muted/50 border-none"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Select value={filterType} onValueChange={setFilterType}>
                        <SelectTrigger className="h-8 w-[110px] text-xs border-dashed">
                            <SelectValue placeholder="Төрөл" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Бүгд</SelectItem>
                            <SelectItem value="invoice">Нэхэмжлэх</SelectItem>
                            <SelectItem value="payroll">Цалин</SelectItem>
                            <SelectItem value="attendance">Ирц</SelectItem>
                            <SelectItem value="salary_advance">Урьдчилгаа</SelectItem>
                            <SelectItem value="employee">HR</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                        <SelectTrigger className="h-8 w-[30px] px-0 justify-center border-dashed">
                            <Filter className="h-3.5 w-3.5" />
                        </SelectTrigger>
                        <SelectContent align="end">
                            <SelectItem value="all">Бүх зэрэглэл</SelectItem>
                            <SelectItem value="info">Info</SelectItem>
                            <SelectItem value="warning">Warning</SelectItem>
                            <SelectItem value="success">Success</SelectItem>
                            <SelectItem value="error">Critical</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </GlassCardHeader>

            <GlassCardContent className="p-0 flex-1 overflow-hidden min-h-[300px]">
                <ScrollArea className="h-full px-4 pb-4">
                    <div className="space-y-4 pt-2">
                        {Object.entries(groupedAggregatedActivities).length > 0 ? (
                            Object.entries(groupedAggregatedActivities).map(([dateLabel, aggItems]) => (
                                <div key={dateLabel} className="space-y-2">
                                    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-sm py-1">
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                                            {dateLabel}
                                        </span>
                                    </div>
                                    <div className="space-y-2 pl-2 border-l border-border/50 ml-2">
                                        {aggItems.map((agg) => {
                                            const Icon = iconMap[agg.icon] || Activity;
                                            const severityClass = severityStyles[agg.severity];
                                            const isExpanded = expandedGroups.has(agg.key);
                                            const isMultiple = agg.count > 1;

                                            // Check if any item in this group is unread
                                            const now = new Date();
                                            const hasUnread = agg.items.some(item => {
                                                const eventTime = new Date(item.eventTime);
                                                return differenceInMinutes(now, eventTime) < 30 && !seenIds.has(String(item.id));
                                            });

                                            return (
                                                <div key={agg.key}>
                                                    <div
                                                        className={cn(
                                                            "group relative flex gap-3 p-2.5 rounded-lg hover:bg-muted/40 transition-all border border-transparent hover:border-border/40",
                                                            (agg.url || isMultiple) && "cursor-pointer",
                                                            hasUnread && "bg-primary/5 border-primary/20"
                                                        )}
                                                        onClick={() => isMultiple ? toggleGroup(agg.key) : handleAction(agg.url)}
                                                    >
                                                        <div className={cn(
                                                            "h-8 w-8 rounded-full flex items-center justify-center shrink-0 border",
                                                            severityClass
                                                        )}>
                                                            <Icon className="h-4 w-4" />
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <p className="text-sm font-medium leading-none mt-0.5 group-hover:text-primary transition-colors line-clamp-2">
                                                                    {agg.message}
                                                                    {isMultiple && (
                                                                        <Badge variant="secondary" className="ml-2 text-[10px] h-4">
                                                                            {agg.count}
                                                                        </Badge>
                                                                    )}
                                                                </p>
                                                                <div className="flex items-center gap-1 shrink-0">
                                                                    {hasUnread && (
                                                                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                                                                    )}
                                                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                                                                        {format(new Date(agg.latestTime), "HH:mm")}
                                                                    </span>
                                                                    {isMultiple && (
                                                                        isExpanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />
                                                                    )}
                                                                </div>
                                                            </div>

                                                            {/* Show first item's metadata if single, or expand hint if multiple */}
                                                            {!isMultiple && (
                                                                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                                                    {agg.items[0].actorName && (
                                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                                                                            <Users className="h-3 w-3" />
                                                                            {agg.items[0].actorName}
                                                                        </div>
                                                                    )}
                                                                    {agg.items[0].entityLabel && (
                                                                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                                                                            <FileText className="h-3 w-3" />
                                                                            {agg.items[0].entityLabel}
                                                                        </div>
                                                                    )}
                                                                    {agg.url && (
                                                                        <span className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity text-[10px] text-primary flex items-center gap-0.5 font-medium">
                                                                            Харах <ArrowRight className="h-3 w-3" />
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>

                                                    {/* Expanded items for aggregated groups */}
                                                    {isMultiple && isExpanded && (
                                                        <div className="ml-10 mt-1 space-y-1 border-l-2 border-dashed border-border/50 pl-3">
                                                            {agg.items.map(item => (
                                                                <div
                                                                    key={item.id}
                                                                    className="flex items-center gap-2 p-1.5 rounded hover:bg-muted/30 cursor-pointer text-xs"
                                                                    onClick={() => handleAction(item.url)}
                                                                >
                                                                    <span className="text-muted-foreground">
                                                                        {format(new Date(item.eventTime), "HH:mm")}
                                                                    </span>
                                                                    <span className="flex-1 truncate">{item.entityLabel || item.message}</span>
                                                                    {item.url && <ArrowRight className="h-3 w-3 text-primary opacity-50" />}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground">
                                <Activity className="h-10 w-10 mb-2 opacity-20" />
                                <span className="text-sm">Үйл ажиллагаа олдсонгүй</span>
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </GlassCardContent>
        </GlassCard>
    );
}
