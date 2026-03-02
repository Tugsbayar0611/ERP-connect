
import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingUp, Plus, Activity, ArrowRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { formatMNT } from "@/lib/utils"; // Assuming usage of global utility or pass as prop

// Helper to format values if not available globally, or use passed formatter
const defaultFormatMNT = (val: number) => {
    return new Intl.NumberFormat('mn-MN', { style: 'currency', currency: 'MNT' }).format(val);
};

interface SalesChartProps {
    data: any[];
    onNavigate?: (path: string) => void;
    formatMoney?: (val: number) => string;
}

export function SalesRevenueChart({ data: allSalesData, onNavigate, formatMoney = defaultFormatMNT }: SalesChartProps) {
    const [dateRange, setDateRange] = useState<"6months" | "30days" | "7days">("6months");

    const filteredData = useMemo(() => {
        if (!allSalesData || allSalesData.length === 0) return [];
        if (dateRange === "6months") return allSalesData;
        if (dateRange === "30days" || dateRange === "7days") return allSalesData.slice(-1); // Simplified logic from original
        return allSalesData;
    }, [allSalesData, dateRange]);

    const totalRevenue = filteredData.reduce((acc, curr) => acc + (curr.value || 0), 0);

    return (
        <Card className="glass-card animate-scale-in">
            <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <TrendingUp className="w-5 h-5 text-primary" />
                            Борлуулалтын орлого
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                            (Батлагдсан/Posted нэхэмжлэхээр)
                        </p>
                        {filteredData.length > 0 && (
                            <div className="mt-3 animate-scale-in origin-left">
                                <span className="text-2xl font-bold tracking-tight block">
                                    {formatMoney(totalRevenue)}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                    Нийт ({dateRange === "6months" ? "6 сар" : dateRange === "30days" ? "30 хоног" : "7 хоног"})
                                </span>
                            </div>
                        )}
                    </div>
                    <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                        <SelectTrigger className="w-32 h-8 text-xs">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="7days">7 хоног</SelectItem>
                            <SelectItem value="30days">30 хоног</SelectItem>
                            <SelectItem value="6months">6 сар</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardHeader>
            <CardContent className="pl-2">
                {filteredData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                        <AreaChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                            <XAxis
                                dataKey="name"
                                className="text-xs text-muted-foreground"
                                minTickGap={30}
                                tick={{ fontSize: 10 }}
                            />
                            <YAxis
                                className="text-xs text-muted-foreground"
                                tickFormatter={(value) => `${(value / 1000000).toFixed(0)}сая`}
                            />
                            <ChartTooltip
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-xl p-3 text-xs min-w-[150px]">
                                                <p className="font-bold mb-2 text-foreground">{label}ын орлого</p>
                                                <div className="flex items-center justify-between gap-4">
                                                    <span className="text-muted-foreground">Дүн:</span>
                                                    <span className="font-bold text-primary text-sm">
                                                        {formatMoney(payload[0].value as number)}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Area
                                type="monotone"
                                dataKey="value"
                                stroke="hsl(var(--primary))"
                                strokeWidth={3}
                                fillOpacity={1}
                                fill="url(#colorSales)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[350px] text-muted-foreground">
                        <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/30 dark:to-indigo-950/30 flex items-center justify-center mb-4 animate-pulse">
                            <TrendingUp className="w-12 h-12 text-blue-400 dark:text-blue-500" />
                            <div className="absolute -top-1 -right-1 w-6 h-6 bg-blue-200 dark:bg-blue-800 rounded-full flex items-center justify-center">
                                <Plus className="w-3 h-3 text-blue-600 dark:text-blue-400" />
                            </div>
                        </div>
                        <p className="text-base font-semibold mb-1 text-foreground">Борлуулалтын өгөгдөл байхгүй</p>
                        <Button
                            onClick={() => onNavigate?.("/sales?action=create")}
                            className="mt-4"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Борлуулалт үүсгэх
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

interface AttendanceChartProps {
    data: any[];
    onNavigate?: (path: string) => void;
}

export function AttendanceChart({ data: allAttendanceData, onNavigate }: AttendanceChartProps) {
    const [dateRange, setDateRange] = useState<"7days" | "30days">("7days");

    const filteredData = useMemo(() => {
        if (!allAttendanceData || allAttendanceData.length === 0) return [];
        if (dateRange === "7days") return allAttendanceData.slice(-7);
        return allAttendanceData;
    }, [allAttendanceData, dateRange]);

    const averageRate = filteredData.length > 0
        ? Math.round(filteredData.reduce((acc, curr) => acc + (curr.rate || 0), 0) / filteredData.length)
        : 0;

    return (
        <Card className="glass-card animate-scale-in">
            <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            <Activity className="w-5 h-5 text-green-500" />
                            Ирцийн мэдээлэл
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                            (Сүүлийн {dateRange === "7days" ? "7 хоног" : "30 хоног"})
                        </p>
                        {filteredData.length > 0 && (
                            <div className="mt-3 animate-scale-in origin-left">
                                <div className="flex items-baseline gap-2">
                                    <span className="text-3xl font-bold tracking-tight text-foreground">
                                        {averageRate}%
                                    </span>
                                    <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                                        Дундаж Ирц
                                    </span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={dateRange} onValueChange={(v: any) => setDateRange(v)}>
                            <SelectTrigger className="w-24 h-8 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="7days">7 хоног</SelectItem>
                                <SelectItem value="30days">30 хоног</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onNavigate?.("/attendance")}>
                            <ArrowRight className="w-4 h-4" />
                        </Button>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pl-2">
                {filteredData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={filteredData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                            <XAxis
                                dataKey="name"
                                className="text-xs text-muted-foreground"
                                tick={{ fontSize: 10 }}
                            />
                            <YAxis className="text-xs text-muted-foreground" allowDecimals={false} />
                            <ChartTooltip
                                cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        const total = (payload[0]?.payload?.total || 0);
                                        return (
                                            <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-xl p-3 text-xs min-w-[150px]">
                                                <p className="font-bold mb-2 text-foreground">{label}</p>
                                                <div className="space-y-1.5">
                                                    {/* Simplified tooltip content for brevity */}
                                                    <div className="flex justify-between"><span className="text-green-600">Ирсэн:</span> <b>{payload[0]?.value}</b></div>
                                                    <div className="flex justify-between"><span className="text-yellow-600">Хоцорсон:</span> <b>{payload[1]?.value}</b></div>
                                                    <div className="flex justify-between"><span className="text-red-600">Тасалсан:</span> <b>{payload[2]?.value}</b></div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar dataKey="present" stackId="a" fill="#22c55e" name="Ирсэн" radius={[0, 0, 4, 4]} barSize={32} />
                            <Bar dataKey="late" stackId="a" fill="#eab308" name="Хоцорсон" radius={[0, 0, 0, 0]} barSize={32} />
                            <Bar dataKey="absent" stackId="a" fill="#ef4444" name="Тасалсан" radius={[4, 4, 0, 0]} barSize={32} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                        <p>Өгөгдөл байхгүй</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}

interface SalaryChartProps {
    data: any[];
    onNavigate?: (path: string) => void;
    formatMoney?: (val: number) => string;
}

export function SalaryChart({ data: salaryData, onNavigate, formatMoney }: SalaryChartProps) {
    // Basic null check and formatting helper
    const format = formatMoney || ((val: number) => val.toString());

    return (
        <Card className="glass-card animate-scale-in">
            <CardHeader className="pb-2">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-base">
                            {/* We use CreditCard icon from standard imports if possible, assuming it is available or reused */}
                            <span className="text-primary font-bold">💳</span>
                            Цалингийн зардал
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1 font-medium">
                            (Зардал = Гарт олгох + Суутгал)
                        </p>
                        {salaryData && salaryData.length > 0 && (
                            <div className="mt-3 animate-scale-in origin-left flex gap-6">
                                <div>
                                    <span className="text-xl font-bold tracking-tight block text-green-600 dark:text-green-400">
                                        {format(salaryData.reduce((acc, curr) => acc + (curr.net || 0), 0))}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Net (Гарт)</span>
                                </div>
                                <div className="w-[1px] h-8 bg-border" />
                                <div>
                                    <span className="text-xl font-bold tracking-tight block text-red-500 dark:text-red-400">
                                        {format(salaryData.reduce((acc, curr) => acc + (curr.deductions || 0), 0))}
                                    </span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Суутгал</span>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </CardHeader>
            <CardContent className="pl-2">
                {salaryData && Array.isArray(salaryData) && salaryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                        <BarChart data={salaryData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                            <XAxis
                                dataKey="name"
                                className="text-xs text-muted-foreground"
                                tick={{ fontSize: 10 }}
                            />
                            <YAxis
                                className="text-xs text-muted-foreground"
                                tickFormatter={(value) => `${(value / 1000000).toFixed(0)}сая`}
                            />
                            <ChartTooltip
                                cursor={{ fill: 'hsl(var(--muted)/0.3)' }}
                                content={({ active, payload, label }) => {
                                    if (active && payload && payload.length) {
                                        return (
                                            <div className="bg-background/95 backdrop-blur-sm border rounded-lg shadow-xl p-3 text-xs min-w-[150px]">
                                                <p className="font-bold mb-2 text-foreground">{label}ын цалин</p>
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="text-muted-foreground">Гарт олгох:</span>
                                                        <span className="font-bold text-green-600 dark:text-green-400">
                                                            {format(payload[0]?.value as number)}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between gap-4">
                                                        <span className="text-muted-foreground">Суутгал:</span>
                                                        <span className="font-bold text-red-500 dark:text-red-400">
                                                            {format(payload[1]?.value as number)}
                                                        </span>
                                                    </div>
                                                    <div className="pt-1.5 mt-1.5 border-t flex items-center justify-between gap-4">
                                                        <span className="font-medium text-foreground">Нийт (Gross):</span>
                                                        <span className="font-bold text-foreground">
                                                            {format((payload[0]?.value as number || 0) + (payload[1]?.value as number || 0))}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    }
                                    return null;
                                }}
                            />
                            <Bar
                                dataKey="net"
                                stackId="a"
                                fill="#22c55e"
                                radius={[0, 0, 4, 4]}
                                name="Гарт олгох"
                                barSize={32}
                            />
                            <Bar
                                dataKey="deductions"
                                stackId="a"
                                fill="#ef4444"
                                radius={[4, 4, 0, 0]}
                                name="Суутгал"
                                barSize={32}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                        <p className="text-base font-semibold mb-1 text-foreground">Цалингийн өгөгдөл байхгүй</p>
                        <Button
                            onClick={() => onNavigate?.("/payroll?action=create")}
                            className="mt-4"
                        >
                            Цалин бодох
                        </Button>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
