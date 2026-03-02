import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format, isToday, isYesterday, differenceInMinutes } from "date-fns";
import {
    Activity,
    CheckCircle2,
    Clock,
    CreditCard,
    FileText,
    Filter,
    Search,
    UserMinus,
    UserPlus,
    Users,
    XCircle,
    DollarSign,
    ArrowRight,
    Download,
    RefreshCw,
    ArrowLeft
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
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

export default function ActivityPage() {
    const [, setLocation] = useLocation();
    const [filterType, setFilterType] = useState<string>("all");
    const [filterSeverity, setFilterSeverity] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    // Fetch activity feed from stats (using existing endpoint)
    const { data: stats, isLoading, refetch } = useQuery<{ activityFeed: ActivityItem[] }>({
        queryKey: ["/api/stats"],
    });

    const activities = stats?.activityFeed || [];

    // Filter logic
    const filteredActivities = activities.filter(item => {
        const matchesType = filterType === "all" || item.entityType === filterType;
        const matchesSeverity = filterSeverity === "all" || (item.severity || "info") === filterSeverity;
        const matchesSearch = searchQuery === "" ||
            item.message.toLowerCase().includes(searchQuery.toLowerCase()) ||
            (item.entityLabel && item.entityLabel.toLowerCase().includes(searchQuery.toLowerCase()));

        return matchesType && matchesSeverity && matchesSearch;
    });

    // Group by date
    const groupedActivities: Record<string, ActivityItem[]> = {};
    filteredActivities.forEach(item => {
        const date = new Date(item.eventTime);
        let key = format(date, "yyyy-MM-dd");
        if (isToday(date)) key = "Өнөөдөр";
        else if (isYesterday(date)) key = "Өчигдөр";

        if (!groupedActivities[key]) groupedActivities[key] = [];
        groupedActivities[key].push(item);
    });

    const handleAction = (url?: string) => {
        if (url) setLocation(url);
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
        link.download = `activity_log_${format(new Date(), "yyyyMMdd_HHmmss")}.csv`;
        link.click();
        URL.revokeObjectURL(url);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
            <div className="container mx-auto p-6 space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                        <div>
                            <h1 className="text-2xl font-bold flex items-center gap-2">
                                <Activity className="h-6 w-6 text-indigo-500" />
                                Үйл ажиллагааны бүртгэл
                            </h1>
                            <p className="text-sm text-muted-foreground">
                                Системийн бүх үйл ажиллагааны түүх
                            </p>
                        </div>
                    </div>
                    <div className="flex gap-2">
                        <Button variant="outline" size="sm" onClick={() => refetch()}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Шинэчлэх
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleExport}>
                            <Download className="h-4 w-4 mr-2" />
                            CSV татах
                        </Button>
                    </div>
                </div>

                {/* Filters */}
                <Card>
                    <CardContent className="p-4">
                        <div className="flex gap-4 items-center flex-wrap">
                            <div className="relative flex-1 min-w-[200px]">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Хайх..."
                                    className="pl-9"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Select value={filterType} onValueChange={setFilterType}>
                                <SelectTrigger className="w-[150px]">
                                    <SelectValue placeholder="Төрөл" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Бүх төрөл</SelectItem>
                                    <SelectItem value="invoice">Нэхэмжлэх</SelectItem>
                                    <SelectItem value="payroll">Цалин</SelectItem>
                                    <SelectItem value="attendance">Ирц</SelectItem>
                                    <SelectItem value="salary_advance">Урьдчилгаа</SelectItem>
                                    <SelectItem value="employee">HR</SelectItem>
                                </SelectContent>
                            </Select>
                            <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                                <SelectTrigger className="w-[150px]">
                                    <Filter className="h-4 w-4 mr-2" />
                                    <SelectValue placeholder="Зэрэглэл" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Бүх зэрэглэл</SelectItem>
                                    <SelectItem value="info">Info</SelectItem>
                                    <SelectItem value="warning">Warning</SelectItem>
                                    <SelectItem value="success">Success</SelectItem>
                                    <SelectItem value="error">Critical</SelectItem>
                                </SelectContent>
                            </Select>
                            <Badge variant="secondary" className="text-sm">
                                {filteredActivities.length} үйлдэл
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                {/* Activity List */}
                <Card>
                    <CardContent className="p-4">
                        {isLoading ? (
                            <div className="space-y-4">
                                {[1, 2, 3, 4, 5].map(i => (
                                    <div key={i} className="flex gap-4 items-center">
                                        <Skeleton className="h-10 w-10 rounded-full" />
                                        <div className="flex-1 space-y-2">
                                            <Skeleton className="h-4 w-3/4" />
                                            <Skeleton className="h-3 w-1/2" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : Object.entries(groupedActivities).length > 0 ? (
                            <div className="space-y-6">
                                {Object.entries(groupedActivities).map(([dateLabel, items]) => (
                                    <div key={dateLabel} className="space-y-3">
                                        <div className="sticky top-0 z-10 bg-background py-2 border-b border-border/50">
                                            <span className="text-sm font-semibold text-muted-foreground">
                                                {dateLabel}
                                            </span>
                                            <Badge variant="outline" className="ml-2">{items.length}</Badge>
                                        </div>
                                        <div className="space-y-2">
                                            {items.map((item) => {
                                                const Icon = iconMap[item.icon] || Activity;
                                                const severityClass = severityStyles[item.severity || "info"];

                                                return (
                                                    <div
                                                        key={item.id}
                                                        className={cn(
                                                            "flex gap-4 p-3 rounded-lg hover:bg-muted/50 transition-all border border-transparent hover:border-border/50",
                                                            item.url && "cursor-pointer"
                                                        )}
                                                        onClick={() => handleAction(item.url)}
                                                    >
                                                        <div className={cn(
                                                            "h-10 w-10 rounded-full flex items-center justify-center shrink-0 border",
                                                            severityClass
                                                        )}>
                                                            <Icon className="h-5 w-5" />
                                                        </div>

                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex justify-between items-start gap-2">
                                                                <p className="text-sm font-medium">
                                                                    {item.message}
                                                                </p>
                                                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                                    {format(new Date(item.eventTime), "HH:mm:ss")}
                                                                </span>
                                                            </div>

                                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                                {item.actorName && (
                                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                                                                        <Users className="h-3 w-3" />
                                                                        {item.actorName}
                                                                    </div>
                                                                )}
                                                                {item.entityLabel && (
                                                                    <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                                                                        <FileText className="h-3 w-3" />
                                                                        {item.entityLabel}
                                                                    </div>
                                                                )}
                                                                {item.entityType && (
                                                                    <Badge variant="outline" className="text-[10px] h-5">
                                                                        {item.entityType}
                                                                    </Badge>
                                                                )}
                                                                {item.url && (
                                                                    <span className="ml-auto text-xs text-primary flex items-center gap-0.5">
                                                                        Харах <ArrowRight className="h-3 w-3" />
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                                <Activity className="h-12 w-12 mb-3 opacity-20" />
                                <span className="text-lg font-medium">Үйл ажиллагаа олдсонгүй</span>
                                <p className="text-sm mt-1">Шүүлтийг өөрчилж үзнэ үү</p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
