
import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Activity, Clock, CreditCard, AlertTriangle, ArrowRight, CheckCircle2, Newspaper, Brain, DollarSign, Cloud, CloudSnow, Sun, Bell, Heart, MessageCircle } from "lucide-react";
import { CountUp } from "@/components/ui/count-up";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { ActivityFeedWidget } from "@/components/dashboard/ActivityFeedWidget";
import { EmployeesWidget } from "@/components/dashboard/EmployeesWidget";
import { BirthdayWidget } from "@/components/dashboard/BirthdayWidget";
import { CashFlowWidget, InvoiceStatusWidget } from "@/components/dashboard/FinancialWidgets";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { format, addDays } from "date-fns";
import { ErrorBoundary } from "@/components/error-boundary";
import { WalletWidget } from "@/components/dashboard/WalletWidget";

// Define DashboardStats Interface
export interface DashboardStats {
    totalEmployees: number;
    activeEmployees: number;
    todayAttendance: {
        rate: number | null;
        present: number;
        late: number;
        absent: number;
    };
    pendingRequests: number;
    monthlyPayroll: number;
    payrollBudgetUsage: number;
    salesByMonth: { name: string; value: number }[];
    attendanceByDay: { name: string; present: number; late: number; absent: number; total: number; rate: number }[];
    recentInvoices: { id: number; invoiceNumber: string; customerName: string; amount: number; status: string; date: string }[];
    wallOfFame: { id: number; name: string; kudos: number; rank: number }[];
    ebarimtStatus: {
        todaySent: number;
        successful: number;
        failed: number;
        unsentCount: number;
        lastSyncTime: string;
        lotteryWinProbability: number;
    };
    cashFlowProjection: {
        next7DaysRevenue: number;
        next7DaysExpenses: number;
        netCashFlow: number;
        recommendation: string;
        confidenceLevel?: string;
        dataPointsUsed?: number;
    };
    recentPosts: { id: number; title: string; content: string; authorName: string; createdAt: string; likesCount: number; commentsCount: number }[];
    payrollByMonth: { name: string; value: number; net?: number; gross?: number; deductions?: number }[];
    overdueInvoices?: number;
    lowStockItems?: number;
    birthdays?: any[];
    activityFeed?: any[];
    trialPeriod?: any[];
    contractExpiry?: any[];
    invoicePaymentStatus?: any;
    topEmployees?: any[];
}

// Widget Keys Type Definition
export type WidgetKey =
    | "totalEmployees"
    | "attendanceRate"
    | "pendingRequests"
    | "payrollBudget"
    | "actionCenter"
    | "activityFeed" // "Company Heartbeat" - Managers only
    | "topEmployees"
    | "companyNews"  // "Company News" - Employees only
    | "birthday"
    | "weather"
    | "cashFlow"
    | "invoiceStatus"
    | "myStats" // Alternative for employees
    | "myWallet";

// Context for widget rendering
export interface WidgetContext {
    stats: DashboardStats | null | undefined;
    userRole: string;
    isEmployee: boolean;
    setLocation: (loc: string) => void;
    formatMNT: (val: number) => string;
    formatPercent: (val: number | null | undefined) => string;
    expiryAlerts: any[];
    weatherData: any;
}

// Widget Spans Configuration
export const WIDGET_SPANS: Record<WidgetKey, string> = {
    totalEmployees: "col-span-1 md:col-span-2 xl:col-span-1",
    attendanceRate: "col-span-1 md:col-span-2 xl:col-span-1",
    pendingRequests: "col-span-1 md:col-span-2 xl:col-span-1",
    payrollBudget: "col-span-1 md:col-span-2 xl:col-span-1",
    actionCenter: "col-span-1 md:col-span-2 lg:col-span-2 h-[400px]", // Widen to 2 columns
    activityFeed: "col-span-1 md:col-span-2 lg:col-span-1 h-[400px]",
    companyNews: "col-span-1 md:col-span-2 lg:col-span-1 h-[400px]",
    topEmployees: "col-span-1 md:col-span-2 lg:col-span-1 h-[400px]",
    birthday: "col-span-1 md:col-span-2 lg:col-span-1 h-[400px]",
    weather: "col-span-1 md:col-span-2 lg:col-span-1 h-[400px]",
    cashFlow: "col-span-1 md:col-span-2 lg:col-span-1 h-[400px]",
    invoiceStatus: "col-span-1 h-[400px]",
    myStats: "col-span-1 md:col-span-2 lg:col-span-1 h-[400px]",
    myWallet: "col-span-1 md:col-span-2 lg:col-span-1 h-[400px]",
};

// Helper to determine the target route for different action items
const resolveActionLink = (item: any): string => {
    // 1. Inventory Expiry Alerts (Duck-typing: has daysUntilExpiry)
    if (item.daysUntilExpiry !== undefined) {
        return "/inventory?tab=alert"; // Correct tab name for alerts
    }

    // 2. Future: Approval Requests
    if (item.kind === "approval") {
        return `/hr/approvals/${item.id}`;
    }

    // 3. Future: HSE Reports
    if (item.kind === "hse_report") {
        return `/safety/${item.id}`;
    }

    // Default fallback
    return "/action-center";
};

// Widget Components Registry (Factory Pattern)
export const WIDGET_REGISTRY: Record<WidgetKey, (ctx: WidgetContext) => React.ReactNode> = {
    totalEmployees: (ctx) => (
        <Card
            onClick={() => ctx.setLocation("/employees")}
            className="bg-gradient-to-br from-blue-50 via-blue-50/50 to-indigo-50 dark:from-blue-950/50 dark:via-blue-900/30 dark:to-indigo-950/50 border-blue-200/50 dark:border-blue-800/50 shadow-sm hover:shadow-md transition-all duration-300 h-[200px] flex flex-col justify-between p-6 cursor-pointer hover:border-blue-300 dark:hover:border-blue-700 relative overflow-hidden group"
        >
            <Users className="absolute -right-8 -bottom-8 w-48 h-48 text-blue-100/50 dark:text-blue-900/20 group-hover:scale-110 transition-transform duration-500" />
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-base font-bold text-blue-600/80 dark:text-blue-400 uppercase tracking-wider">Нийт ажилтан</p>
                    <h3 className="text-5xl font-black text-foreground mt-3 tracking-tight">
                        <CountUp value={ctx.stats?.totalEmployees || 0} />
                    </h3>
                </div>
                <div className="p-3 bg-blue-100 dark:bg-blue-900/50 rounded-2xl text-blue-600 dark:text-blue-400">
                    <Users className="w-8 h-8" />
                </div>
            </div>
            <div className="relative z-10 flex items-center gap-2">
                <Badge variant="secondary" className="bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-sm px-3 h-7">
                    Active: {ctx.stats?.activeEmployees || 0}
                </Badge>
            </div>
        </Card>
    ),
    attendanceRate: (ctx) => (
        <Card
            onClick={() => ctx.setLocation("/attendance?tab=overview")}
            className="bg-gradient-to-br from-emerald-50 via-green-50/50 to-teal-50 dark:from-emerald-950/50 dark:via-green-900/30 dark:to-teal-950/50 border-green-200/50 dark:border-green-800/50 shadow-sm hover:shadow-md transition-all duration-300 h-[200px] flex flex-col justify-between p-6 cursor-pointer hover:border-green-300 dark:hover:border-green-700 relative overflow-hidden group"
        >
            <Activity className="absolute -right-8 -bottom-8 w-48 h-48 text-green-100/50 dark:text-green-900/20 group-hover:scale-110 transition-transform duration-500" />
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-base font-bold text-green-600/80 dark:text-green-400 uppercase tracking-wider">Ирцийн хувь</p>
                    <h3 className="text-5xl font-black text-foreground mt-3 tracking-tight">
                        {ctx.formatPercent(ctx.stats?.todayAttendance?.rate)}
                    </h3>
                </div>
                <div className="p-3 bg-green-100 dark:bg-green-900/50 rounded-2xl text-green-600 dark:text-green-400">
                    <Activity className="w-8 h-8" />
                </div>
            </div>
            <div className="relative z-10 flex items-center gap-2">
                <span className="flex items-center text-sm text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/50 px-3 py-1 rounded-md font-bold">
                    <CheckCircle2 className="w-4 h-4 mr-2" /> {ctx.stats?.todayAttendance?.present || 0}
                </span>
                <span className="flex items-center text-sm text-orange-700 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/50 px-3 py-1 rounded-md font-bold">
                    <Clock className="w-4 h-4 mr-2" /> {ctx.stats?.todayAttendance?.late || 0}
                </span>
            </div>
        </Card>
    ),
    pendingRequests: (ctx) => (
        <Card
            className="bg-gradient-to-br from-amber-50 via-orange-50/50 to-yellow-50 dark:from-amber-950/50 dark:via-orange-900/30 dark:to-yellow-950/50 border-orange-200/50 dark:border-orange-800/50 shadow-sm hover:shadow-md transition-all duration-300 h-[200px] flex flex-col justify-between p-6 cursor-pointer hover:border-orange-300 dark:hover:border-orange-700 relative overflow-hidden group"
            onClick={() => ctx.setLocation("/salary-advances?status=pending")}
        >
            <Clock className="absolute -right-8 -bottom-8 w-48 h-48 text-orange-100/50 dark:text-orange-900/20 group-hover:scale-110 transition-transform duration-500" />
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-base font-bold text-orange-600/80 dark:text-orange-400 uppercase tracking-wider">Хүлээгдэж буй</p>
                    <h3 className="text-5xl font-black text-foreground mt-3 tracking-tight">
                        <CountUp value={ctx.stats?.pendingRequests || 0} />
                    </h3>
                </div>
                <div className="p-3 bg-orange-100 dark:bg-orange-900/50 rounded-2xl text-orange-600 dark:text-orange-400">
                    <Clock className="w-8 h-8" />
                </div>
            </div>
            <div className="relative z-10">
                <Badge variant="outline" className="border-orange-200 text-orange-700 dark:text-orange-300 bg-orange-50 dark:bg-orange-900/30 text-sm h-7 px-3 font-medium">
                    Шийдвэрлэх
                </Badge>
            </div>
        </Card>
    ),
    payrollBudget: (ctx) => (
        <Card
            onClick={() => ctx.setLocation("/payroll-overview")}
            className="bg-gradient-to-br from-rose-50 via-pink-50/50 to-fuchsia-50 dark:from-rose-950/50 dark:via-pink-900/30 dark:to-fuchsia-950/50 border-pink-200/50 dark:border-pink-800/50 shadow-sm hover:shadow-md transition-all duration-300 h-[200px] flex flex-col justify-between p-6 cursor-pointer hover:border-pink-300 dark:hover:border-pink-700 relative overflow-hidden group"
        >
            <CreditCard className="absolute -right-8 -bottom-8 w-48 h-48 text-pink-100/50 dark:text-pink-900/20 group-hover:scale-110 transition-transform duration-500" />
            <div className="flex justify-between items-start relative z-10">
                <div>
                    <p className="text-base font-bold text-pink-600/80 dark:text-pink-400 uppercase tracking-wider">Цалингийн төсөв</p>
                    <h3 className="text-3xl font-black text-foreground mt-3 tracking-tight truncate max-w-[220px]" title={ctx.formatMNT(ctx.stats?.monthlyPayroll || 0)}>
                        {ctx.formatMNT(ctx.stats?.monthlyPayroll || 0)}
                    </h3>
                </div>
                <div className="p-3 bg-pink-100 dark:bg-pink-900/50 rounded-2xl text-pink-600 dark:text-pink-400">
                    <CreditCard className="w-8 h-8" />
                </div>
            </div>
            <div className="relative z-10 flex flex-col justify-end">
                <div className="flex justify-between text-xs mb-1.5">
                    <span className="text-pink-700 dark:text-pink-300 font-bold">Гүйцэтгэл</span>
                    <span className={`font-black ${((ctx.stats?.payrollBudgetUsage ?? 0) > 90) ? 'text-red-500' : 'text-green-600'}`}>
                        {ctx.formatPercent(Math.min(ctx.stats?.payrollBudgetUsage || 0, 100))}
                    </span>
                </div>
                <Progress
                    value={Math.min(ctx.stats?.payrollBudgetUsage || 0, 100)}
                    className="h-2 bg-pink-200 dark:bg-pink-950/50"
                />
            </div>
        </Card>
    ),
    actionCenter: (ctx) => (
        <Card className="glass-card animate-scale-in h-[400px] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                        <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                        <CardTitle className="text-base">Action Center</CardTitle>
                        <p className="text-xs text-muted-foreground">Анхаарал хандуулах шаардлагатай</p>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs"
                    onClick={() => ctx.setLocation("/action-center")}
                >
                    Бүгдийг харах <ArrowRight className="w-3 h-3 ml-1" />
                </Button>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto pr-1">
                {ctx.expiryAlerts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8 text-muted-foreground">
                        <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mb-3">
                            <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <p className="text-sm font-medium mb-1">Одоогоор арга хэмжээ авах зүйл алга</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {ctx.expiryAlerts.slice(0, 5).map((alert: any, idx: number) => {
                            const daysLeft = alert.daysUntilExpiry || 0;
                            const isExpired = daysLeft < 0;
                            const isUrgent = daysLeft >= 0 && daysLeft <= 7;
                            const isWarning = daysLeft > 7 && daysLeft <= 30;

                            const targetPath = resolveActionLink(alert);

                            return (
                                <div
                                    key={`${alert.productId}-${alert.warehouseId}-${idx}`}
                                    className={`flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer ${isExpired ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" :
                                        isUrgent ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" :
                                            isWarning ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800" :
                                                "bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800"
                                        }`}
                                    onClick={() => ctx.setLocation(targetPath)}
                                >
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate">{alert.productName}</div>
                                        <div className="text-xs text-muted-foreground">
                                            {alert.warehouseName} • {alert.batchNumber}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <Badge variant={isExpired || isUrgent ? "destructive" : isWarning ? "default" : "secondary"} className="text-[10px] h-5">
                                            {isExpired ? "Хэтэрсэн" : `${daysLeft} хоног`}
                                        </Badge>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    ),
    companyNews: (ctx) => (
        <Card className="glass-card animate-scale-in h-[400px] flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                        <Newspaper className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                        <CardTitle className="text-base">Компанийн мэдээ</CardTitle>
                        <p className="text-xs text-muted-foreground">Шинэ мэдээлэл, зарлал</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto pr-1">
                {!ctx.stats?.recentPosts || ctx.stats.recentPosts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center py-8 text-muted-foreground">
                        <div className="w-12 h-12 rounded-full bg-blue-50 dark:bg-blue-900/10 flex items-center justify-center mb-3">
                            <Newspaper className="w-6 h-6 text-blue-400 dark:text-blue-500" />
                        </div>
                        <p className="text-sm font-medium">Одоогоор шинэ мэдээ алга</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {ctx.stats.recentPosts.slice(0, 5).map((post: any) => (
                            <div key={post.id} className="flex flex-col gap-1 p-3 rounded-lg border bg-card/50 hover:bg-muted/50 transition-colors">
                                <div className="flex justify-between items-start">
                                    <h4 className="text-sm font-semibold text-primary">{post.title}</h4>
                                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">{post.createdAt}</span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-2">{post.content}</p>
                                <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                                    <span className="font-medium text-foreground/80">{post.authorName}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    ),

    activityFeed: (ctx) => (
        /* Renamed from ActivityFeed to Company Heartbeat (Ops Feed) */
        <div className="h-[400px] overflow-hidden rounded-xl border bg-card text-card-foreground shadow">
            <ActivityFeedWidget activities={ctx.stats?.activityFeed || []} userRole={ctx.userRole} />
        </div>
    ),
    topEmployees: (ctx) => (
        <div className="h-[400px]">
            <EmployeesWidget
                employees={(ctx.stats?.topEmployees || ctx.stats?.wallOfFame || []).map((emp: any, index: number) => ({
                    id: emp.id || `emp-${index}`,
                    firstName: emp.name?.split(' ')[0] || emp.firstName || 'Unknown',
                    lastName: emp.name?.split(' ').slice(1).join(' ') || emp.lastName || '',
                    position: emp.position || emp.department || '',
                    departmentName: emp.departmentName || '',
                    points: emp.kudos || emp.points || 0,
                }))}
                isLoading={!ctx.stats}
                title="Шилдэг ажилтнууд"
                showPoints={true}
                limit={3}
            />
        </div>
    ),
    birthday: (ctx) => (
        <div className="h-[400px]">
            <BirthdayWidget
                birthdays={ctx.stats?.birthdays || []}
                isLoading={!ctx.stats}
            />
        </div>
    ),
    cashFlow: (ctx) => (
        <div className="h-[400px]">
            <CashFlowWidget ctx={ctx} />
        </div>
    ),
    invoiceStatus: (ctx) => (
        <div className="h-[400px]">
            <InvoiceStatusWidget ctx={ctx} />
        </div>
    ),
    weather: (ctx) => (
        <Card className="bg-gradient-to-br from-sky-50 via-sky-50/50 to-blue-50 dark:from-sky-950/50 dark:via-sky-900/30 dark:to-blue-950/50 border-sky-200/50 dark:border-sky-800/50 shadow-sm hover:shadow-md transition-all duration-300 h-full flex flex-col justify-between p-4 relative overflow-hidden group">
            {ctx.weatherData ? (
                <>
                    <Cloud className="absolute -right-4 -bottom-4 w-24 h-24 text-sky-100/50 dark:text-sky-900/20 group-hover:scale-110 transition-transform duration-500" />
                    <div className="flex justify-between items-start relative z-10">
                        <div>
                            <p className="text-xs font-semibold text-sky-600/80 dark:text-sky-400 uppercase tracking-wider">
                                {ctx.weatherData.name || ctx.weatherData.city || "Ulaanbaatar"}
                            </p>
                            <div className="flex items-end gap-2 mt-1">
                                <h3 className="text-2xl font-bold text-foreground">
                                    {Math.round(ctx.weatherData.main?.temp || ctx.weatherData.temp || 0)}°C
                                </h3>
                                <span className="text-xs text-muted-foreground mb-1.5 capitalize truncate max-w-[80px]">
                                    {ctx.weatherData.weather?.[0]?.description || ctx.weatherData.description || ""}
                                </span>
                            </div>
                        </div>
                        <div className="p-2 bg-sky-100 dark:bg-sky-900/50 rounded-lg text-sky-600 dark:text-sky-400">
                            {((ctx.weatherData.main?.temp || ctx.weatherData.temp) < 0) ? <CloudSnow className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
                        </div>
                    </div>
                    <div className="relative z-10 text-[10px] text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-900/50 px-2 py-1 rounded inline-block self-start">
                        Мэдрэгдэх: {Math.round(ctx.weatherData.main?.feels_like || ctx.weatherData.feelsLike || 0)}°C
                    </div>
                </>
            ) : (
                <div className="flex items-center justify-center h-full">
                    <Skeleton className="h-8 w-24" />
                </div>
            )}
        </Card>
    ),
    myStats: (ctx) => <div>My Stats Widget Placeholder</div>, // If needed in future
    myWallet: (ctx) => <WalletWidget ctx={ctx} />,
};

// Simplified Role Presets
export const DASHBOARD_PRESETS: Record<string, WidgetKey[]> = {
    employee: ["myWallet", "attendanceRate", "pendingRequests", "actionCenter", "companyNews", "birthday", "weather"],
    manager: ["totalEmployees", "attendanceRate", "pendingRequests", "payrollBudget", "actionCenter", "activityFeed", "cashFlow", "invoiceStatus", "topEmployees", "birthday", "weather"],
};

// Role-based Widget Resolution
export const resolveWidgetForRole = (key: WidgetKey, role: string): WidgetKey => {
    if (role === "employee") {
        if (key === "topEmployees") return "myStats";
    }
    return key;
};
