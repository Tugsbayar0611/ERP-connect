import { useStats } from "@/hooks/use-stats";
import { StatCard } from "@/components/dashboard/StatCard";
import { useExpiryAlerts } from "@/hooks/use-stock-movements";
import { useEmployees } from "@/hooks/use-employees";
import { useAuth } from "@/hooks/use-auth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Building2, CreditCard, Activity, TrendingUp, Clock, Package, Users2, FileText, DollarSign, ArrowRight, AlertTriangle, Cake, Calendar, CheckCircle2, XCircle, UserCircle, Bell, Gift, Clock3, UserPlus, UserMinus, UserPen, CheckCircle, X as XIcon, Radio, Plus, Calculator, Trophy, Zap, Receipt, Sparkles, Eye, EyeOff, TrendingDown, Brain, Check, X, Cloud, CloudSnow, Sun, CloudRain, ThermometerSun, CalendarDays, Heart, MessageCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as ChartTooltip, ResponsiveContainer, AreaChart, Area, LineChart, Line } from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { CountUp } from "@/components/ui/count-up";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useState, useEffect, useRef, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Employee } from "@shared/schema";

// New World-Class Dashboard Widgets
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from "@/components/ui/GlassCard";
import { NotificationsWidget } from "@/components/dashboard/NotificationsWidget";
import { QuickActionsWidget } from "@/components/dashboard/QuickActionsWidget";
import { EmployeesWidget } from "@/components/dashboard/EmployeesWidget";
import { BirthdayWidget } from "@/components/dashboard/BirthdayWidget";
import { PendingRequestsWidget } from "@/components/dashboard/PendingRequestsWidget";

// Format number as Mongolian Tugrik (standardized with commas)
const formatMNT = (value: number) => {
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + '₮';
};

// Format percentage (standardized with 1 decimal)
const formatPercent = (value: number) => {
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value) + '%';
};

// Format quantity (standardized with 2 decimals)
const formatQuantity = (value: number) => {
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
};

// Role-based dashboard presets
const getRoleBasedLayout = (role: string) => {
  const presets: Record<string, { showWidgets: string[]; priority: string[] }> = {
    HR: {
      showWidgets: ["attendance", "payroll", "birthdays", "requests", "employees"],
      priority: ["attendance", "payroll", "birthdays"],
    },
    Нягтлан: {
      showWidgets: ["ebarimt", "invoices", "cashflow", "reports"],
      priority: ["ebarimt", "invoices", "cashflow"],
    },
    Борлуулалт: {
      showWidgets: ["sales", "invoices", "customers"],
      priority: ["sales", "invoices"],
    },
    "Агуулахын ажилтан": {
      showWidgets: ["inventory", "expiry", "stock"],
      priority: ["expiry", "inventory"],
    },
  };
  return presets[role] || { showWidgets: [], priority: [] };
};

// Data will come from stats API

// Demo Data Types
const demoStats = {
  totalEmployees: 156,
  activeEmployees: 142,
  todayAttendance: { rate: 98, present: 138, late: 4, absent: 8 },
  pendingRequests: 5,
  monthlyPayroll: 324500000,
  payrollBudgetUsage: 85,
  salesByMonth: [
    { name: '8-р сар', value: 45000000 },
    { name: '9-р сар', value: 52000000 },
    { name: '10-р сар', value: 48000000 },
    { name: '11-р сар', value: 61000000 },
    { name: '12-р сар', value: 55000000 },
    { name: '1-р сар', value: 72000000 },
  ],
  attendanceByDay: [
    { date: 'Дав', present: 135, late: 5, absent: 10 },
    { date: 'Мяг', present: 140, late: 2, absent: 8 },
    { date: 'Лха', present: 138, late: 4, absent: 8 },
    { date: 'Пүр', present: 142, late: 1, absent: 7 },
    { date: 'Баа', present: 139, late: 6, absent: 5 },
    { date: 'Бям', present: 20, late: 0, absent: 130 },
    { date: 'Ням', present: 15, late: 0, absent: 135 },
  ],
  recentInvoices: [
    { id: 1, invoiceNumber: 'INV-2024-001', customerName: 'Таван Богд Групп', amount: 15000000, status: 'Paid', date: '2024-01-15' },
    { id: 2, invoiceNumber: 'INV-2024-002', customerName: 'М-Си-Эс Кока-Кола', amount: 8500000, status: 'Pending', date: '2024-01-16' },
    { id: 3, invoiceNumber: 'INV-2024-003', customerName: 'Говь ХК', amount: 2300000, status: 'Paid', date: '2024-01-14' },
    { id: 4, invoiceNumber: 'INV-2024-004', customerName: 'Unitel Group', amount: 4500000, status: 'Overdue', date: '2024-01-10' },
  ],
  wallOfFame: [
    { id: 1, name: 'Б. Бат-Эрдэнэ', kudos: 15, rank: 1 },
    { id: 2, name: 'Г. Сарангэрэл', kudos: 12, rank: 2 },
    { id: 3, name: 'Э. Болд', kudos: 10, rank: 3 },
  ],
  ebarimtStatus: {
    todaySent: 145,
    successful: 142,
    failed: 3,
    unsentCount: 0,
    lastSyncTime: '10:30',
    lotteryWinProbability: 15,
  },
  cashFlowProjection: {
    next7DaysRevenue: 25000000,
    next7DaysExpenses: 12000000,
    netCashFlow: 13000000,
    recommendation: 'Ирэх 7 хоногт мөнгөн урсгал эерэг байна. Бэлтгэн нийлүүлэгчдийн төлбөрийг хийхэд тохиромжтой.'
  },
  recentPosts: [
    { id: 1, title: 'Шинэ жилийн урамшуулал', content: 'Бүх ажилтнуудад шинэ жилийн урамшуулал олгохоор боллоо.', authorName: 'HR Department', createdAt: '2024-01-15', likesCount: 45, commentsCount: 12 },
    { id: 2, title: 'Системийн шинэчлэл', content: 'ERP системд шинэ функцүүд нэмэгдлээ.', authorName: 'IT Department', createdAt: '2024-01-10', likesCount: 20, commentsCount: 5 }
  ]
};

export default function Dashboard() {
  const { data: stats, isLoading, error: statsError } = useStats();
  const { alerts: expiryAlerts = [] } = useExpiryAlerts(30);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const userRole = user?.role || "";

  // Get role-based layout preferences
  const roleLayout = getRoleBasedLayout(userRole);

  // Fetch weather data
  const { data: weatherData, isLoading: isLoadingWeather, error: weatherError } = useQuery({
    queryKey: ["/api/weather"],
    queryFn: async () => {
      const res = await fetch("/api/weather");
      if (!res.ok) {
        // If API fails, return mock data for development
        return {
          temp: -30,
          feelsLike: -35,
          condition: "extreme_cold",
          description: "Хүйтэн",
          city: "Ulaanbaatar",
          alert: {
            alertType: "extreme_cold",
            temperatureCelsius: -35,
            conditionText: "Хүйтэн",
            message: "Маргааш -35°C хүйтэн байна. Ажилтнууддаа гэрээсээ ажиллах санал тавих уу?",
            suggestedAction: "work_from_home",
          },
        };
      }
      return res.json();
    },
    refetchInterval: 30 * 60 * 1000, // Refetch every 30 minutes
    retry: false, // Don't retry on error, use mock data instead
  });
  const [zenMode, setZenMode] = useState(false);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Memoize activeStats to avoid recalculation on every render
  const activeStats = useMemo(() => {
    return (isDemoMode ? demoStats : stats) as any;
  }, [isDemoMode, stats]);

  // Memoize wallOfFame and recentPosts to avoid recalculation
  const wallOfFame = useMemo(() => {
    return activeStats?.wallOfFame || [];
  }, [activeStats]);

  const recentPosts = useMemo(() => {
    return activeStats?.recentPosts || [];
  }, [activeStats]);

  // Memoize greeting to avoid recalculation on every render
  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return "Өглөөний мэнд";
    if (hour < 18) return "Өдрийн мэнд";
    return "Оройн мэнд";
  }, []); // Empty deps - only calculate once per component mount
  const [showUtilityWidgets, setShowUtilityWidgets] = useState(true); // Toggle for weather/currency
  const [activityFilter, setActivityFilter] = useState<"all" | "sales" | "purchase" | "hr" | "inventory">("all");
  const [currencyRates, setCurrencyRates] = useState<{ [key: string]: number }>({
    USD: 3400,
    CNY: 480,
    RUB: 38,
    KRW: 2.6,
  });
  const [exchangeAmount, setExchangeAmount] = useState("1000");
  const [exchangeFrom, setExchangeFrom] = useState("USD");
  const [isRequestsOpen, setIsRequestsOpen] = useState(false);
  const [currentY, setCurrentY] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track scroll position for dynamic spacing
  useEffect(() => {
    const handleScroll = () => {
      if (containerRef.current) {
        setCurrentY(containerRef.current.scrollTop || window.scrollY);
      } else {
        setCurrentY(window.scrollY);
      }
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Fetch currency rates (placeholder - in production, fetch from Mongol Bank API)
  useEffect(() => {
    // TODO: Fetch from Mongol Bank API: https://www.mongolbank.mn/dblistofficialdailyrate.aspx
    // For now, using static rates
    const fetchRates = async () => {
      try {
        // This would be a backend API call to Mongol Bank API
        // For now, using default rates
        setCurrencyRates({
          USD: 3400,
          CNY: 480,
          RUB: 38,
          KRW: 2.6,
        });
      } catch (err) {
        console.error("Failed to fetch currency rates:", err);
      }
    };
    fetchRates();
  }, []);

  // Calculate exchange result
  const exchangeResult = currencyRates[exchangeFrom]
    ? (parseFloat(exchangeAmount) * currencyRates[exchangeFrom]).toLocaleString('mn-MN')
    : "0";

  // Use real data from API, fallback to empty arrays if not available
  // Memoize chart data to avoid recalculation on every render
  const salaryData = useMemo(() => {
    return activeStats?.payrollByMonth || [];
  }, [activeStats]);

  const allSalesData = useMemo(() => {
    return activeStats?.salesByMonth || [];
  }, [activeStats]);

  const allAttendanceData = useMemo(() => {
    return activeStats?.attendanceByDay || [];
  }, [activeStats]);

  const recentInvoices = useMemo(() => {
    return activeStats?.recentInvoices || [];
  }, [activeStats]);

  // Date range selector state (individual chart ranges)
  const [salesDateRange, setSalesDateRange] = useState<"6months" | "30days" | "7days">("6months");
  const [attendanceDateRange, setAttendanceDateRange] = useState<"7days" | "30days">("7days");

  // Global date range selector (affects all KPIs and charts)
  const [globalDateRange, setGlobalDateRange] = useState<"today" | "7days" | "30days" | "6months">("6months");

  // Filter sales data by date range
  const getFilteredSalesData = () => {
    if (!allSalesData || allSalesData.length === 0) return [];

    if (salesDateRange === "6months") {
      return allSalesData; // All 6 months
    } else if (salesDateRange === "30days") {
      // Last 30 days (approximately last month)
      return allSalesData.slice(-1);
    } else if (salesDateRange === "7days") {
      // Last 7 days - need to calculate from daily data if available
      // For now, return last month's data
      return allSalesData.slice(-1);
    }
    return allSalesData;
  };

  // Filter attendance data by date range
  const getFilteredAttendanceData = () => {
    if (!allAttendanceData || allAttendanceData.length === 0) return [];

    if (attendanceDateRange === "7days") {
      // Last 7 days of week (last 7 entries)
      return allAttendanceData.slice(-7);
    } else if (attendanceDateRange === "30days") {
      return allAttendanceData; // All 30 days
    }
    return allAttendanceData;
  };

  const salesData = getFilteredSalesData();
  const attendanceData = getFilteredAttendanceData();

  // Debug: Log data to console (only when stats is loaded successfully, prevent spam)
  useEffect(() => {
    // Only log when stats is actually loaded (not null/undefined and not loading)
    if (stats && !isLoading) {
      console.log("📊 Dashboard Stats Loaded:", {
        salesByMonthLength: stats.salesByMonth?.length || 0,
        payrollByMonthLength: stats.payrollByMonth?.length || 0,
        attendanceByDayLength: stats.attendanceByDay?.length || 0,
        filteredSalesDataLength: salesData?.length || 0,
        filteredAttendanceDataLength: attendanceData?.length || 0,
      });

      // Log sample data points only if they exist
      if (stats.salesByMonth && stats.salesByMonth.length > 0) {
        console.log("📈 Sample Sales Data:", stats.salesByMonth[0]);
      }
      if (stats.attendanceByDay && stats.attendanceByDay.length > 0) {
        console.log("📅 Sample Attendance Data:", stats.attendanceByDay[0]);
      }
    }
    // Don't log anything when stats is null - UI component handles the error display
  }, [!!stats, isLoading]); // Only re-run when stats changes from null to loaded (or vice versa)

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
        <span className="ml-4 text-muted-foreground">Хяналтын самбар ачааллаж байна...</span>
      </div>
    );
  }

  // Only show login required if user is NOT authenticated
  // If user IS authenticated but stats is null/undefined, that's a different issue (API error or no data)
  // ProtectedRoute should handle this, but double-check here for safety
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <AlertTriangle className="w-12 h-12 text-warning" />
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">Нэвтрэх шаардлагатай</h3>
          <p className="text-muted-foreground mb-4">Хяналтын самбар харахын тулд нэвтэрнэ үү</p>
          <Button onClick={() => setLocation("/login")}>
            Нэвтрэх
          </Button>
        </div>
      </div>
    );
  }

  // If authenticated but no stats (API error or empty data), show error message but still render dashboard
  // This allows the dashboard to show with empty states instead of blocking completely
  if (statsError) {
    console.error("❌ Stats API Error:", statsError);
  }

  // Dynamic spacing based on scroll position
  const dynamicSpacing = Math.max(8, 8 + Math.floor(currentY / 100) * 2);

  return (
    <div
      ref={containerRef}
      className="min-h-screen -m-4 md:-m-8 p-4 md:p-8"
    >
      {/* Show error message if stats failed to load but user is authenticated */}
      {statsError && (
        <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            <div>
              <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                Өгөгдөл ачаалж чадсангүй
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                {statsError instanceof Error ? statsError.message : "Түр хүлээгээд дахин оролдоно уу"}
              </p>
            </div>
          </div>
        </div>
      )}
      {/* Header with Quick Actions & Zen Mode & Global Date Range */}
      <div className="animate-slide-up flex items-center justify-between flex-wrap gap-4 mb-6">
        <div className="flex-1">
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {greeting}, {user?.fullName || user?.email} 👋
          </h2>
          <p className="text-muted-foreground mt-2">
            {zenMode ? (
              activeStats?.todayAttendance?.rate === 100 && activeStats?.pendingRequests === 0 && activeStats?.ebarimtStatus?.unsentCount === 0 ? (
                <span className="text-green-600 dark:text-green-400">🟢 Бүх зүйл ХЭВИЙН</span>
              ) : (
                <span className="text-orange-600 dark:text-orange-400">🔴 АНХААРАХ ЗҮЙЛ БАЙНА</span>
              )
            ) : (
              "Харахад таатай байна. Өнөөдрийн ажлын явцыг доорх хэсгээс харна уу."
            )}
          </p>
        </div>

        {/* Global Date Range Selector */}
        {!zenMode && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Хугацаа:</span>
            <Select value={globalDateRange} onValueChange={(v: any) => setGlobalDateRange(v)}>
              <SelectTrigger className="w-32 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="today">Өнөөдөр</SelectItem>
                <SelectItem value="7days">7 хоног</SelectItem>
                <SelectItem value="30days">30 хоног</SelectItem>
                <SelectItem value="6months">6 сар</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2 flex-wrap items-center">
          {/* Quick Actions */}
          {!zenMode && (
            <>
              <div className="flex items-center space-x-2 mr-4 bg-muted/50 p-1.5 rounded-lg border border-border/50">
                <Switch
                  id="demo-mode"
                  checked={isDemoMode}
                  onCheckedChange={setIsDemoMode}
                />
                <Label htmlFor="demo-mode" className="cursor-pointer text-sm font-medium">Demo Mode</Label>
              </div>

              <Button
                onClick={() => setLocation("/invoices?action=create")}
                className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5"
              >
                <Plus className="w-4 h-4 mr-2" />
                Нэхэмжлэх үүсгэх
              </Button>
              <Button
                onClick={() => setLocation("/employees?action=create")}
                variant="outline"
                className="hover:bg-muted/50"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Ажилтан нэмэх
              </Button>
              <Button
                onClick={() => setLocation("/attendance?action=create")}
                variant="outline"
                className="hover:bg-muted/50"
              >
                <Calendar className="w-4 h-4 mr-2" />
                Чөлөө авах
              </Button>
            </>
          )}

          {/* Zen Mode Toggle */}
          <Button
            onClick={() => setZenMode(!zenMode)}
            variant={zenMode ? "default" : "outline"}
            size="sm"
            className="ml-2"
          >
            {zenMode ? (
              <>
                <EyeOff className="w-4 h-4 mr-2" />
                Zen Mode
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 mr-2" />
                Zen
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Quick Stats Cards - 4 Main Cards with Soft Gradients (hidden in Zen Mode) - Standardized & Sticky */}
      {!zenMode && (
        <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-4 mb-8 -mx-4 md:-mx-8 px-4 md:px-8 pt-4 border-b">
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
            {isLoading ? (
              // Loading Skeletons for Stats Cards
              <>
                <Card className="h-[140px] flex flex-col">
                  <CardContent className="p-5 flex-1 flex flex-col justify-between">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32 mb-2" />
                    <Skeleton className="h-3 w-20" />
                  </CardContent>
                </Card>
                <Card className="h-[140px] flex flex-col">
                  <CardContent className="p-5 flex-1 flex flex-col justify-between">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32 mb-2" />
                    <Skeleton className="h-3 w-20" />
                  </CardContent>
                </Card>
                <Card className="h-[140px] flex flex-col">
                  <CardContent className="p-5 flex-1 flex flex-col justify-between">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32 mb-2" />
                    <Skeleton className="h-3 w-20" />
                  </CardContent>
                </Card>
                <Card className="h-[140px] flex flex-col">
                  <CardContent className="p-5 flex-1 flex flex-col justify-between">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32 mb-2" />
                    <Skeleton className="h-3 w-20" />
                  </CardContent>
                </Card>
              </>
            ) : (
              <>
                {/* Нийт ажилтан - Soft Blue Gradient - Standardized */}
                <Card className="bg-gradient-to-br from-blue-50 via-blue-50/50 to-indigo-50 dark:from-blue-950/50 dark:via-blue-900/30 dark:to-indigo-950/50 border-blue-200/50 dark:border-blue-800/50 shadow-sm hover:shadow-md transition-all duration-300 h-[140px] flex flex-col">
                  <CardContent className="p-5 flex-1 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-blue-700 dark:text-blue-300 mb-1">Нийт ажилтан</p>
                        <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                          <CountUp value={activeStats?.totalEmployees || 0} /> <span className="text-sm font-normal text-blue-600 dark:text-blue-400">ширхэг</span>
                        </p>
                      </div>
                      <div className="p-2.5 bg-blue-200 dark:bg-blue-800 rounded-lg">
                        <Users className="w-5 h-5 text-blue-700 dark:text-blue-300" />
                      </div>
                    </div>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-auto">
                      Идэвхтэй: <CountUp value={activeStats?.activeEmployees || 0} />
                    </p>
                  </CardContent>
                </Card>

                {/* Ирцийн хувь - Soft Green Gradient - Standardized */}
                <Card className="bg-gradient-to-br from-emerald-50 via-green-50/50 to-teal-50 dark:from-emerald-950/50 dark:via-green-900/30 dark:to-teal-950/50 border-green-200/50 dark:border-green-800/50 shadow-sm hover:shadow-md transition-all duration-300 h-[140px] flex flex-col">
                  <CardContent className="p-5 flex-1 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="text-xs font-medium text-green-700 dark:text-green-300">Өнөөдрийн ирц</p>
                          {(activeStats?.todayAttendance?.rate || 0) === 0 && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <AlertTriangle className="w-3 h-3 text-orange-500" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Ирц бүртгэгдээгүй байна</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                        </div>
                        <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                          {formatPercent(activeStats?.todayAttendance?.rate || 0)}
                        </p>
                      </div>
                      <div className="p-2.5 bg-green-200 dark:bg-green-800 rounded-lg">
                        <Activity className="w-5 h-5 text-green-700 dark:text-green-300" />
                      </div>
                    </div>
                    <div className="flex gap-1.5 mt-auto">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-green-100 dark:bg-green-900">
                        <CheckCircle2 className="w-2.5 h-2.5 mr-0.5" /> {activeStats?.todayAttendance?.present || 0}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-yellow-100 dark:bg-yellow-900">
                        <Clock3 className="w-2.5 h-2.5 mr-0.5" /> {activeStats?.todayAttendance?.late || 0}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 bg-red-100 dark:bg-red-900">
                        <XCircle className="w-2.5 h-2.5 mr-0.5" /> {activeStats?.todayAttendance?.absent || 0}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Шийдвэрлэх хүсэлтүүд - Soft Orange/Amber Gradient - Standardized */}
                <Card
                  className="bg-gradient-to-br from-amber-50 via-orange-50/50 to-yellow-50 dark:from-amber-950/50 dark:via-orange-900/30 dark:to-yellow-950/50 border-orange-200/50 dark:border-orange-800/50 shadow-sm hover:shadow-lg transition-all duration-300 h-[140px] flex flex-col cursor-pointer transform hover:-translate-y-0.5"
                  onClick={() => setIsRequestsOpen(true)}
                >
                  <CardContent className="p-5 flex-1 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">Батлах хүсэлтүүд</p>
                        <p className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                          <CountUp value={activeStats?.pendingRequests || 0} /> <span className="text-sm font-normal text-orange-600 dark:text-orange-400">ширхэг</span>
                        </p>
                      </div>
                      <div className="p-2.5 bg-orange-200 dark:bg-orange-800 rounded-lg">
                        <Bell className="w-5 h-5 text-orange-700 dark:text-orange-300" />
                      </div>
                    </div>
                    <p className="text-xs text-orange-600 dark:text-orange-400 mt-auto">Урьдчилгаа хүсэлт</p>
                  </CardContent>
                </Card>

                {/* Төсвийн зарцуулалт - Soft Pink/Rose Gradient - Standardized */}
                <Card className="bg-gradient-to-br from-rose-50 via-pink-50/50 to-fuchsia-50 dark:from-rose-950/50 dark:via-pink-900/30 dark:to-fuchsia-950/50 border-pink-200/50 dark:border-pink-800/50 shadow-sm hover:shadow-md transition-all duration-300 h-[140px] flex flex-col">
                  <CardContent className="p-5 flex-1 flex flex-col justify-between">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-pink-700 dark:text-pink-300 mb-1">Цалингийн төсөв</p>
                        <p className="text-2xl font-bold text-pink-900 dark:text-pink-100 truncate">
                          <CountUp value={activeStats?.monthlyPayroll || 0} formatter={formatMNT} />
                        </p>
                      </div>
                      <div className="p-2.5 bg-pink-200 dark:bg-pink-800 rounded-lg ml-2 flex-shrink-0">
                        <CreditCard className="w-5 h-5 text-pink-700 dark:text-pink-300" />
                      </div>
                    </div>
                    <div className="mt-auto">
                      <Progress
                        value={Math.min(activeStats?.payrollBudgetUsage || 0, 100)}
                        className="h-1.5 mb-1"
                      />
                      <p className="text-xs text-pink-600 dark:text-pink-400">
                        Зарцуулалт: {formatPercent(Math.min(activeStats?.payrollBudgetUsage || 0, 100))}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </>
            )}
          </div>
        </div>
      )}

      {/* Weather Widget */}
      {(weatherData || isLoadingWeather) && (
        <Card className="glass-card animate-scale-in border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <Cloud className="w-5 h-5 text-blue-500" />
              Цаг агаар ☀️
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoadingWeather ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full" />
              </div>
            ) : weatherData ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  {weatherData.temp <= -20 ? (
                    <CloudSnow className="w-12 h-12 text-blue-400" />
                  ) : weatherData.temp >= 25 ? (
                    <Sun className="w-12 h-12 text-yellow-400" />
                  ) : (
                    <Cloud className="w-12 h-12 text-gray-400" />
                  )}
                  <div>
                    <p className="text-3xl font-bold">{weatherData.temp}°C</p>
                    <p className="text-sm text-muted-foreground">{weatherData.city || "Ulaanbaatar"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Мэдрэмж: {weatherData.feelsLike}°C
                    </p>
                  </div>
                </div>
                {weatherData.alert && (
                  <div className="flex-1 ml-4 p-3 bg-orange-50 dark:bg-orange-950/30 rounded-lg border border-orange-200 dark:border-orange-800">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm font-semibold text-orange-900 dark:text-orange-100">
                          {weatherData.alert.message}
                        </p>
                        {weatherData.alert.suggestedAction === "work_from_home" && (
                          <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">
                            💡 Гэрээсээ ажиллах санал тавих
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Zen Mode Status Card */}
      {zenMode && (
        <Card className="glass-card animate-scale-in border-2 border-primary/50">
          <CardContent className="p-8 text-center">
            {stats?.todayAttendance?.rate === 100 && stats?.pendingRequests === 0 && stats?.ebarimtStatus?.unsentCount === 0 ? (
              <div className="space-y-4">
                <div className="text-6xl">🟢</div>
                <h3 className="text-2xl font-bold text-green-600 dark:text-green-400">ХЭВИЙН</h3>
                <p className="text-muted-foreground">Өнөөдөр бүх зүйл хэвийн байна</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="text-6xl">🔴</div>
                <h3 className="text-2xl font-bold text-orange-600 dark:text-orange-400">АНХААР</h3>
                <div className="space-y-2">
                  {stats?.todayAttendance?.rate !== 100 && (
                    <p className="text-sm">• Ирц: {stats?.todayAttendance?.rate || 0}%</p>
                  )}
                  {(stats?.pendingRequests ?? 0) > 0 && (
                    <p className="text-sm">• {stats?.pendingRequests} батлах хүсэлт</p>
                  )}
                  {(stats?.ebarimtStatus?.unsentCount ?? 0) > 0 && (
                    <p className="text-sm">• {stats?.ebarimtStatus?.unsentCount} баримт илгээгдээгүй</p>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ============================================
       * NEW WORLD-CLASS DASHBOARD WIDGETS (Phase 3-4)
       * ============================================ */}
      {!zenMode && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 mb-6">
          {/* Notifications Widget - Actionable alerts */}
          <NotificationsWidget
            overdueInvoices={activeStats?.overdueInvoices || 0}
            lowStockItems={activeStats?.lowStockItems || expiryAlerts.length}
            pendingRequests={activeStats?.pendingRequests || 0}
            upcomingExpiry={expiryAlerts.length}
          />

          {/* Quick Actions Widget */}
          <QuickActionsWidget />

          {/* Top Employees Widget */}
          <EmployeesWidget
            employees={(activeStats?.topEmployees || wallOfFame || []).map((emp: any, index: number) => ({
              id: emp.id || `emp-${index}`,
              firstName: emp.name?.split(' ')[0] || emp.firstName || 'Unknown',
              lastName: emp.name?.split(' ').slice(1).join(' ') || emp.lastName || '',
              position: emp.position || emp.department || '',
              departmentName: emp.departmentName || '',
              points: emp.kudos || emp.points || 0,
            }))}
            isLoading={isLoading}
            title="Шилдэг ажилтнууд"
            showPoints={true}
            limit={5}
          />

          {/* Birthday Widget - Today's birthdays */}
          <BirthdayWidget
            birthdays={activeStats?.birthdays || []}
            isLoading={isLoading}
          />

          {/* Pending Requests Widget - Leave requests / Salary advances */}
          <PendingRequestsWidget
            pendingCount={activeStats?.pendingRequests || 0}
            isLoading={isLoading}
          />
        </div>
      )}

      {/* Quick Info Row - Currency Exchange, E-barimt Status & More */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {/* Currency Exchange Widget - Collapsible/Compact */}
        {!zenMode && showUtilityWidgets && (
          <Card className="glass-card animate-scale-in border-blue-200 dark:border-blue-800">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <Calculator className="w-4 h-4 text-blue-500" />
                  <span>Валютын ханш</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0"
                  onClick={() => setShowUtilityWidgets(false)}
                >
                  <X className="w-3 h-3" />
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 py-2">
              {/* Compact Exchange Rates Display */}
              <div className="grid grid-cols-4 gap-1 text-[10px]">
                <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/30 text-center">
                  <div className="font-semibold text-[9px]">USD</div>
                  <div className="text-muted-foreground">{formatMNT(currencyRates.USD || 0).replace('₮', '')}</div>
                </div>
                <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/30 text-center">
                  <div className="font-semibold text-[9px]">CNY</div>
                  <div className="text-muted-foreground">{formatMNT(currencyRates.CNY || 0).replace('₮', '')}</div>
                </div>
                <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/30 text-center">
                  <div className="font-semibold text-[9px]">RUB</div>
                  <div className="text-muted-foreground">{formatMNT(currencyRates.RUB || 0).replace('₮', '')}</div>
                </div>
                <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/30 text-center">
                  <div className="font-semibold text-[9px]">KRW</div>
                  <div className="text-muted-foreground">{formatQuantity(currencyRates.KRW || 0)}</div>
                </div>
              </div>

              {/* Compact Calculator */}
              <div className="flex gap-1 pt-1 border-t">
                <Input
                  type="number"
                  value={exchangeAmount}
                  onChange={(e) => setExchangeAmount(e.target.value)}
                  placeholder="1000"
                  className="flex-1 h-7 text-xs"
                />
                <Select value={exchangeFrom} onValueChange={setExchangeFrom}>
                  <SelectTrigger className="w-16 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="CNY">CNY</SelectItem>
                    <SelectItem value="RUB">RUB</SelectItem>
                    <SelectItem value="KRW">KRW</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="text-center p-1.5 rounded bg-primary/10">
                <p className="text-sm font-bold text-primary">{exchangeResult}₮</p>
              </div>
            </CardContent>
          </Card>
        )}



        {/* Toggle to show utility widgets if hidden */}
        {!zenMode && !showUtilityWidgets && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowUtilityWidgets(true)}
            className="h-full"
          >
            <Eye className="w-4 h-4 mr-2" />
            Utility харах
          </Button>
        )}

        {/* E-barimt Status Card - Монголд хамгийн хэрэгтэй widget */}
        {(userRole === "Admin" || userRole === "Нягтлан" || userRole === "Manager") && (
          <Card className="glass-card animate-scale-in border-amber-200/70 dark:border-amber-800/70 bg-gradient-to-br from-amber-50/50 via-yellow-50/30 to-orange-50/50 dark:from-amber-950/30 dark:via-yellow-950/20 dark:to-orange-950/30 shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Receipt className="w-5 h-5 text-amber-500" />
                И-баримт статус 📄
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {activeStats?.ebarimtStatus ? (
                <>
                  {/* 1. Өнөөдөр илгээсэн - Required metric */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-950/40 dark:to-yellow-950/40 border border-amber-200/50 dark:border-amber-800/50">
                    <span className="text-xs font-medium text-amber-700 dark:text-amber-300">Өнөөдөр илгээсэн:</span>
                    <span className="text-base font-bold text-amber-900 dark:text-amber-100">
                      <CountUp value={activeStats.ebarimtStatus.todaySent || 0} />
                    </span>
                  </div>

                  {/* 2. Амжилттай / Failed - Required metric */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200/50 dark:border-green-800/50">
                      <p className="text-[10px] text-muted-foreground mb-1">Амжилттай</p>
                      <p className="text-base font-bold text-green-700 dark:text-green-300">
                        <CountUp value={activeStats.ebarimtStatus.successful || 0} />
                      </p>
                    </div>
                    <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/50">
                      <p className="text-[10px] text-muted-foreground mb-1">Failed</p>
                      <p className="text-base font-bold text-red-700 dark:text-red-300">
                        <CountUp value={activeStats.ebarimtStatus.failed || 0} />
                      </p>
                    </div>
                  </div>

                  {/* Show success/failed ratio */}
                  {(activeStats.ebarimtStatus.successful || 0) + (activeStats.ebarimtStatus.failed || 0) > 0 && (
                    <div className="text-center text-[10px] text-muted-foreground">
                      {activeStats.ebarimtStatus.successful || 0} / {(activeStats.ebarimtStatus.successful || 0) + (activeStats.ebarimtStatus.failed || 0)}
                    </div>
                  )}

                  {/* 3. Сүүлд sync хийсэн - Required metric */}
                  <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50">
                    <span className="text-[10px] text-muted-foreground">Сүүлд sync:</span>
                    <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                      {activeStats.ebarimtStatus.lastSyncTime || "Хийгдээгүй"}
                    </span>
                  </div>

                  {/* 4. Top error - Required metric */}
                  {activeStats.ebarimtStatus.unsentCount > 0 && (
                    <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-red-700 dark:text-red-300 mb-0.5">
                            {activeStats.ebarimtStatus.unsentCount} баримт илгээгдээгүй
                          </p>
                          <p className="text-[10px] text-red-600 dark:text-red-400 truncate">
                            {activeStats.ebarimtStatus.lastError || "Token expired эсвэл Server timeout"}
                          </p>
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="mt-2 w-full h-7 text-xs border-red-300 dark:border-red-700 hover:bg-red-100 dark:hover:bg-red-950/50"
                        onClick={() => setLocation("/invoices?filter=unsent")}
                      >
                        Шалгах
                        <ArrowRight className="w-3 h-3 ml-1" />
                      </Button>
                    </div>
                  )}

                  {/* Сугалааны магадлал */}
                  {activeStats.ebarimtStatus.lotteryWinProbability > 0 && (
                    <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 border border-purple-200/50 dark:border-purple-800/50">
                      <p className="text-xs font-medium text-purple-700 dark:text-purple-300">
                        🎫 Сугалааны магадлал: {activeStats.ebarimtStatus.lotteryWinProbability}%
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-4 text-muted-foreground">
                  <Receipt className="w-8 h-8 mb-2 opacity-50" />
                  <p className="text-sm">И-баримт мэдээлэл байхгүй</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Invoice Payment Status - Standardized Format (Title, Amount, Count, Trend) */}
        {!zenMode && activeStats?.invoicePaymentStatus && (
          <Card className="glass-card animate-scale-in border-emerald-200 dark:border-emerald-800">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <DollarSign className="w-4 h-4 text-emerald-500" />
                Нэхэмжлэхийн төлөв
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200/50 dark:border-green-800/50">
                  <p className="text-[10px] font-medium text-green-700 dark:text-green-300 mb-1">Өнөөдөр төлөгдсөн</p>
                  <p className="text-base font-bold text-green-900 dark:text-green-100">
                    {formatMNT(activeStats.invoicePaymentStatus.todayPaid || 0)}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/50">
                  <p className="text-[10px] font-medium text-red-700 dark:text-red-300 mb-1">Төлөгдөөгүй (Overdue)</p>
                  <p className="text-base font-bold text-red-900 dark:text-red-100">
                    {formatMNT(activeStats.invoicePaymentStatus.overdue || 0)}
                  </p>
                </div>
                <div className="p-2.5 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50">
                  <p className="text-[10px] font-medium text-blue-700 dark:text-blue-300 mb-1">7 хоногт авах</p>
                  <p className="text-base font-bold text-blue-900 dark:text-blue-100">
                    {formatMNT(activeStats.invoicePaymentStatus.next7Days || 0)}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* AI Cash Flow Projection - Standardized Format */}
        {!zenMode && activeStats?.cashFlowProjection && (
          <Card className="glass-card animate-scale-in border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base">
                <Brain className="w-4 h-4 text-purple-500" />
                Мөнгөний урсгал
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200/50 dark:border-green-800/50">
                  <div>
                    <p className="text-xs font-medium text-green-700 dark:text-green-300">Орлого (7 хоног)</p>
                    <p className="text-lg font-bold text-green-900 dark:text-green-100 mt-0.5">
                      {formatMNT(activeStats.cashFlowProjection.next7DaysRevenue)}
                    </p>
                  </div>
                  <Badge variant="outline" className="bg-green-100 dark:bg-green-900 text-xs">
                    {activeStats?.recentInvoices?.length || 0} invoice
                  </Badge>
                </div>
                <div className="flex items-center justify-between p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/50">
                  <div>
                    <p className="text-xs font-medium text-red-700 dark:text-red-300">Зарлага (7 хоног)</p>
                    <p className="text-lg font-bold text-red-900 dark:text-red-100 mt-0.5">
                      {formatMNT(activeStats.cashFlowProjection.next7DaysExpenses)}
                    </p>
                  </div>
                </div>
                <div className={`flex items-center justify-between p-3 rounded-lg border-2 ${activeStats.cashFlowProjection.netCashFlow >= 0
                  ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700"
                  : "bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700"
                  }`}>
                  <span className={`text-sm font-semibold ${activeStats.cashFlowProjection.netCashFlow >= 0
                    ? "text-green-700 dark:text-green-300"
                    : "text-orange-700 dark:text-orange-300"
                    }`}>
                    Цэвэр урсгал
                  </span>
                  <span className={`text-xl font-bold ${activeStats.cashFlowProjection.netCashFlow >= 0
                    ? "text-green-900 dark:text-green-100"
                    : "text-orange-900 dark:text-orange-100"
                    }`}>
                    {activeStats.cashFlowProjection.netCashFlow >= 0 ? "+" : ""}
                    {formatMNT(activeStats.cashFlowProjection.netCashFlow)}
                  </span>
                </div>
              </div>

              {activeStats.cashFlowProjection.recommendation && (
                <div className={`p-3 rounded-lg border ${activeStats.cashFlowProjection.netCashFlow >= 0
                  ? "bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800"
                  : "bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800"
                  }`}>
                  <p className={`text-xs font-medium ${activeStats.cashFlowProjection.netCashFlow >= 0
                    ? "text-green-700 dark:text-green-300"
                    : "text-orange-700 dark:text-orange-300"
                    }`}>
                    💡 Зөвлөгөө: {activeStats.cashFlowProjection.recommendation}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Wall of Fame - Top Kudos (from real gamification data) */}
        <ErrorBoundary
          fallback={
            <Card className="glass-card animate-scale-in border-yellow-200 dark:border-yellow-800">
              <CardContent className="p-6 text-center text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Алдартнуудын мэдээлэл ачааллахад алдаа гарлаа</p>
              </CardContent>
            </Card>
          }
        >
          {isLoading ? (
            <Card className="glass-card animate-scale-in border-yellow-200 dark:border-yellow-800">
              <CardHeader className="pb-3">
                <Skeleton className="h-6 w-32" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-3 p-2 rounded-lg">
                      <Skeleton className="w-10 h-10 rounded-full" />
                      <div className="flex-1">
                        <Skeleton className="h-4 w-32 mb-1" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-6 w-8" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : wallOfFame.length > 0 && (
            <Card className="glass-card animate-scale-in border-yellow-200 dark:border-yellow-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Trophy className="w-5 h-5 text-yellow-500" />
                  Алдартан 🏆
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {wallOfFame.slice(0, 3).map((hero: any) => (
                    <div key={hero.id} className="flex items-center gap-3 p-2 rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
                      <div className="w-10 h-10 rounded-full bg-yellow-200 dark:bg-yellow-900 flex items-center justify-center">
                        <UserCircle className="w-6 h-6 text-yellow-700 dark:text-yellow-300" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold truncate">{hero.name}</p>
                        <p className="text-xs text-muted-foreground">{hero.kudos} Kudos</p>
                      </div>
                      <Badge variant="outline" className="bg-yellow-100 dark:bg-yellow-900">
                        <Trophy className="w-3 h-3 mr-1" />
                        {hero.rank}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </ErrorBoundary>

        {/* Recent News Posts (from real News module) */}
        <ErrorBoundary
          fallback={
            <Card className="glass-card animate-scale-in border-blue-200 dark:border-blue-800">
              <CardContent className="p-6 text-center text-muted-foreground">
                <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">Мэдээллийн мэдээлэл ачааллахад алдаа гарлаа</p>
              </CardContent>
            </Card>
          }
        >
          {isLoading ? (
            <Card className="glass-card animate-scale-in border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-3">
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-3 rounded-lg space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-3 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : recentPosts.length > 0 && (
            <Card className="glass-card animate-scale-in border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-lg">
                    <Bell className="w-5 h-5 text-blue-500" />
                    Сүүлийн мэдээлэл 📢
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setLocation("/news")}
                    className="h-7"
                  >
                    Бүгдийг харах
                    <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {recentPosts.slice(0, 3).map((post: any) => (
                    <div
                      key={post.id}
                      className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 hover:bg-blue-100 dark:hover:bg-blue-950/50 transition-colors cursor-pointer"
                      onClick={() => setLocation("/news")}
                    >
                      <div className="flex items-start gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">{post.title}</p>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {post.content}
                          </p>
                          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                            <span>{post.authorName}</span>
                            <span>•</span>
                            <span>{format(new Date(post.createdAt), "MMM dd")}</span>
                            <div className="flex items-center gap-3 ml-auto">
                              {post.likesCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <Heart className="w-3 h-3" />
                                  {post.likesCount}
                                </span>
                              )}
                              {post.commentsCount > 0 && (
                                <span className="flex items-center gap-1">
                                  <MessageCircle className="w-3 h-3" />
                                  {post.commentsCount}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </ErrorBoundary>
      </div>

      {/* Company Pulse - Live Activity Feed (Enhanced with Filter) */}
      {activeStats?.activityFeed && activeStats.activityFeed.length > 0 && (
        <Card className="glass-card animate-scale-in border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Radio className="w-5 h-5 text-primary animate-pulse" />
                  <div className="absolute -top-1 -right-1 w-2 h-2 bg-green-500 rounded-full animate-ping" />
                </div>
                Компанийн зүрхний цохилт 💓
              </div>
              <div className="flex items-center gap-2">
                <Select value={activityFilter} onValueChange={(v: any) => setActivityFilter(v)}>
                  <SelectTrigger className="w-28 h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Бүгд</SelectItem>
                    <SelectItem value="sales">Борлуулалт</SelectItem>
                    <SelectItem value="purchase">Худалдан авалт</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                    <SelectItem value="inventory">Агуулах</SelectItem>
                  </SelectContent>
                </Select>
                <Badge variant="outline" className="bg-primary/10 text-primary">
                  Live
                </Badge>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
              {activeStats.activityFeed
                .filter((activity: any) => {
                  if (activityFilter === "all") return true;
                  const message = (activity.message || "").toLowerCase();
                  if (activityFilter === "sales") return message.includes("борлуулалт") || message.includes("нэхэмжлэх") || message.includes("invoice");
                  if (activityFilter === "purchase") return message.includes("худалдан") || message.includes("purchase");
                  if (activityFilter === "hr") return message.includes("ажилтан") || message.includes("ирц") || message.includes("цалин") || message.includes("employee");
                  if (activityFilter === "inventory") return message.includes("агуулах") || message.includes("бараа") || message.includes("stock");
                  return true;
                })
                .slice(0, 15)
                .map((activity: any, idx: number) => {
                  const IconComponent =
                    activity.icon === "user-plus" ? UserPlus :
                      activity.icon === "user-minus" ? UserMinus :
                        activity.icon === "user-edit" ? UserPen :
                          activity.icon === "check-circle" ? CheckCircle :
                            activity.icon === "x-circle" ? XIcon :
                              activity.icon === "credit-card" ? CreditCard :
                                activity.icon === "clock-in" ? Clock :
                                  activity.icon === "dollar-sign" ? DollarSign :
                                    Activity;

                  // Calculate relative time (just now, 5 min ago, etc.)
                  const eventTime = activity.eventTime ? new Date(activity.eventTime) : new Date();
                  const now = new Date();
                  const diffMinutes = Math.floor((now.getTime() - eventTime.getTime()) / (1000 * 60));
                  let relativeTime = "";
                  if (diffMinutes < 1) {
                    relativeTime = "Яг одоо";
                  } else if (diffMinutes < 60) {
                    relativeTime = `${diffMinutes} мин`;
                  } else if (diffMinutes < 1440) {
                    relativeTime = `${Math.floor(diffMinutes / 60)} цаг`;
                  } else {
                    relativeTime = format(eventTime, "MMM dd, HH:mm");
                  }

                  return (
                    <div
                      key={activity.id}
                      className={`flex items-start gap-3 p-3 rounded-lg hover:bg-muted/70 transition-all cursor-pointer border-l-2 ${idx === 0 ? "border-l-green-500 bg-green-50/30 dark:bg-green-950/20" : "border-l-transparent"
                        }`}
                      style={{ animationDelay: `${idx * 0.05}s` }}
                    >
                      <div className={`p-2 rounded-full ${idx === 0 ? "bg-green-100 dark:bg-green-900" : "bg-primary/10"
                        }`}>
                        <IconComponent className={`w-4 h-4 ${idx === 0 ? "text-green-700 dark:text-green-300" : "text-primary"
                          }`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{activity.message}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <p className="text-xs text-muted-foreground">
                            {relativeTime}
                          </p>
                          {idx === 0 && (
                            <Badge variant="outline" className="text-xs bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300">
                              Шинэ
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Real-time Salary Section - Role-based visibility */}
      {!zenMode && (userRole === "Admin" || userRole === "HR" || userRole === "Manager") && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">Энэ сарын орлого (Ажилтнууд)</h3>
            {/* Quick Actions for HR */}
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/employees?action=create")}
                className="text-xs h-8 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40"
              >
                <UserPlus className="w-3 h-3 mr-1" />
                Ажилтан нэмэх
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/attendance?action=create")}
                className="text-xs h-8 border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-950/40"
              >
                <Calendar className="w-3 h-3 mr-1" />
                Ирц бүртгэх
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setLocation("/payroll?action=create")}
                className="text-xs h-8 border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40"
              >
                <Calculator className="w-3 h-3 mr-1" />
                Цалин бодох
              </Button>
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <RealTimeSalaryCards />
          </div>
        </div>
      )}

      {/* Main Content Row - Charts + HR Reminders - Standardized Grid (2/3 + 1/3) */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Side - Charts (8 columns = 2/3 width) - Role-based visibility */}
        <div className="lg:col-span-8 space-y-6">
          {/* Sales Revenue Chart - Visible to Sales, Admin, Manager */}
          {(userRole === "Admin" || userRole === "Manager" || userRole === "Борлуулалт") && (

            <Card className="glass-card animate-scale-in">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="w-5 h-5 text-primary" />
                  Борлуулалтын орлого
                </CardTitle>
                <Select value={salesDateRange} onValueChange={(v: any) => setSalesDateRange(v)}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7days">7 хоног</SelectItem>
                    <SelectItem value="30days">30 хоног</SelectItem>
                    <SelectItem value="6months">6 сар</SelectItem>
                  </SelectContent>
                </Select>
              </CardHeader>
              <CardContent className="pl-2">
                {salesData && salesData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={320}>
                    <AreaChart data={salesData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs text-muted-foreground" />
                      <YAxis
                        className="text-xs text-muted-foreground"
                        tickFormatter={(value) => `${(value / 1000000).toFixed(0)}сая`}
                      />
                      <ChartTooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          borderRadius: '12px',
                          border: '1px solid hsl(var(--border))',
                          boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                        }}
                        formatter={(value: number) => [formatMNT(value), 'Орлого']}
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
                    <p className="text-sm text-muted-foreground/70 mb-4 text-center px-4">Эхний борлуулалтаа бүртгээд график автоматаар үүснэ</p>
                    <Button
                      onClick={() => setLocation("/sales?action=create")}
                      className="bg-gradient-to-r from-blue-500 to-indigo-500 hover:from-blue-600 hover:to-indigo-600 text-white shadow-md"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Борлуулалт үүсгэх
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Recent Invoices - Visible to Sales, Admin, Manager, Нягтлан */}
          {(userRole === "Admin" || userRole === "Manager" || userRole === "Борлуулалт" || userRole === "Нягтлан") && (
            <Card className="glass-card animate-scale-in">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-accent" />
                  Сүүлийн нэхэмжлэх
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/invoices")}
                  className="h-8"
                >
                  Бүгдийг харах
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentInvoices.length > 0 ? (
                    recentInvoices.map((inv: any, i: number) => (
                      <div
                        key={inv.id}
                        className="flex items-start justify-between gap-4 p-3 rounded-lg border bg-card/50 hover:bg-card/80 transition-colors cursor-pointer"
                        onClick={() => setLocation(`/invoices`)}
                      >
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium">{inv.invoiceNumber}</p>
                          <p className="text-xs text-muted-foreground">{inv.contactName}</p>
                          <p className="text-xs text-muted-foreground">
                            {inv.invoiceDate ? format(new Date(inv.invoiceDate), "yyyy-MM-dd") : "-"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold">{formatMNT(inv.totalAmount)}</p>
                          <span className={`text-xs px-2 py-0.5 rounded ${inv.status === "posted" ? "bg-green-500/20 text-green-600" :
                            inv.status === "draft" ? "bg-yellow-500/20 text-yellow-600" :
                              "bg-gray-500/20 text-gray-600"
                            }`}>
                            {inv.status === "posted" ? "Батлагдсан" : inv.status === "draft" ? "Ноорог" : inv.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center h-32 text-muted-foreground py-8">
                      <div className="w-16 h-16 rounded-full bg-gradient-to-br from-accent/10 to-primary/10 flex items-center justify-center mb-3">
                        <FileText className="w-8 h-8 text-accent/40" />
                      </div>
                      <p className="text-sm font-medium mb-1">Нэхэмжлэх байхгүй</p>
                      <p className="text-xs text-muted-foreground/70 mb-3">Анхны нэхэмжлэх үүсгэх үү?</p>
                      <Button
                        onClick={() => setLocation("/invoices?action=create")}
                        size="sm"
                        variant="outline"
                        className="border-accent text-accent hover:bg-accent/10"
                      >
                        <Plus className="w-3 h-3 mr-1" />
                        Нэхэмжлэх үүсгэх
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Second Charts Row */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* Salary Chart - Visible to HR, Admin, Manager */}
            {(userRole === "Admin" || userRole === "Manager" || userRole === "HR") && (
              <Card className="glass-card animate-scale-in">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-primary" />
                    Цалингийн график (6 сар)
                  </CardTitle>
                </CardHeader>
                <CardContent className="pl-2">
                  {/* Debug: Show data count and sample */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="mb-2 p-2 bg-muted/50 rounded text-xs">
                      <div>Debug: {Array.isArray(salaryData) ? salaryData.length : 0} data points</div>
                      {salaryData && Array.isArray(salaryData) && salaryData.length > 0 && (
                        <div className="mt-1">Sample: {JSON.stringify(salaryData[0])}</div>
                      )}
                    </div>
                  )}
                  {salaryData && Array.isArray(salaryData) && salaryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <AreaChart data={salaryData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <defs>
                          <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs text-muted-foreground" />
                        <YAxis
                          className="text-xs text-muted-foreground"
                          tickFormatter={(value) => `${(value / 1000000).toFixed(0)}сая`}
                        />
                        <ChartTooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            borderRadius: '12px',
                            border: '1px solid hsl(var(--border))',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                          }}
                          formatter={(value: number) => [formatMNT(value), 'Цалин']}
                        />
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="hsl(var(--primary))"
                          strokeWidth={3}
                          fillOpacity={1}
                          fill="url(#colorValue)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 flex items-center justify-center mb-4 animate-pulse">
                        <CreditCard className="w-12 h-12 text-purple-400 dark:text-purple-500" />
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-purple-200 dark:bg-purple-800 rounded-full flex items-center justify-center">
                          <Calculator className="w-3 h-3 text-purple-600 dark:text-purple-400" />
                        </div>
                      </div>
                      <p className="text-base font-semibold mb-1 text-foreground">Цалингийн өгөгдөл байхгүй</p>
                      <p className="text-sm text-muted-foreground/70 mb-4 text-center px-4">Цалин бодоод график автоматаар үүснэ</p>
                      <Button
                        onClick={() => setLocation("/payroll?action=create")}
                        className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-md"
                      >
                        <Calculator className="w-4 h-4 mr-2" />
                        Цалин бодох
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Attendance Chart */}
            {(userRole === "Admin" || userRole === "Manager" || userRole === "HR") && (
              <Card className="glass-card animate-scale-in">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Activity className="w-5 h-5 text-green-500" />
                    Ирцийн мэдээлэл
                  </CardTitle>
                  <Select value={attendanceDateRange} onValueChange={(v: any) => setAttendanceDateRange(v)}>
                    <SelectTrigger className="w-24 h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7days">7 хоног</SelectItem>
                      <SelectItem value="30days">30 хоног</SelectItem>
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  {/* Debug: Show data count and sample */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="mb-2 p-2 bg-muted/50 rounded text-xs">
                      <div>Debug: {attendanceData?.length || 0} data points</div>
                      {attendanceData && attendanceData.length > 0 && (
                        <div className="mt-1">Sample: {JSON.stringify(attendanceData[0])}</div>
                      )}
                    </div>
                  )}
                  {attendanceData && attendanceData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={attendanceData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="name" className="text-xs text-muted-foreground" />
                        <YAxis className="text-xs text-muted-foreground" />
                        <ChartTooltip
                          contentStyle={{
                            backgroundColor: 'hsl(var(--card))',
                            borderRadius: '12px',
                            border: '1px solid hsl(var(--border))'
                          }}
                        />
                        <Bar dataKey="present" fill="hsl(var(--success))" name="Ирсэн %" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="late" fill="hsl(var(--warning))" name="Хоцорсон %" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[300px] text-muted-foreground">
                      <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 flex items-center justify-center mb-4 animate-pulse">
                        <Activity className="w-12 h-12 text-green-400 dark:text-green-500" />
                        <div className="absolute -top-1 -right-1 w-6 h-6 bg-green-200 dark:bg-green-800 rounded-full flex items-center justify-center">
                          <Calendar className="w-3 h-3 text-green-600 dark:text-green-400" />
                        </div>
                      </div>
                      <p className="text-base font-semibold mb-1 text-foreground">Ирцийн өгөгдөл байхгүй</p>
                      <p className="text-sm text-muted-foreground/70 mb-4 text-center px-4">Ирц бүртгээд график автоматаар үүснэ</p>
                      <Button
                        onClick={() => setLocation("/attendance?action=create")}
                        className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-md"
                      >
                        <Calendar className="w-4 h-4 mr-2" />
                        Ирц бүртгэх
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

          </div>

          {/* Expiry Alerts Card - Visible to Warehouse, Admin, Manager */}
          {(userRole === "Admin" || userRole === "Manager" || userRole === "Агуулахын ажилтан") && (
            <Card className="glass-card animate-scale-in">
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-orange-500" />
                  Хугацаа дуусаж буй бараа (30 хоног)
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLocation("/inventory?tab=alerts")}
                >
                  Бүгдийг харах
                  <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
              </CardHeader>
              <CardContent>
                {expiryAlerts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-8 text-muted-foreground">
                    <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 flex items-center justify-center mb-3">
                      <Package className="w-8 h-8 text-orange-400 dark:text-orange-500" />
                    </div>
                    <p className="text-sm font-medium mb-1">Хугацаа дуусах бараа байхгүй</p>
                    <p className="text-xs text-muted-foreground/70 mb-3">Бүх бараа хугацаандаа байна</p>
                    <Button
                      onClick={() => setLocation("/inventory")}
                      size="sm"
                      variant="outline"
                      className="border-orange-300 dark:border-orange-700 text-orange-700 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/30"
                    >
                      <Package className="w-3 h-3 mr-1" />
                      Бараа нэмэх
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {expiryAlerts.slice(0, 5).map((alert: any, idx: number) => {
                      const daysLeft = alert.daysUntilExpiry || 0;
                      // Color coding: 0-7 days (red), 8-30 days (yellow), 30+ days (gray)
                      const isExpired = daysLeft < 0;
                      const isUrgent = daysLeft >= 0 && daysLeft <= 7;
                      const isWarning = daysLeft > 7 && daysLeft <= 30;
                      const isNormal = daysLeft > 30;

                      return (
                        <div
                          key={`${alert.productId}-${alert.warehouseId}-${alert.batchNumber}-${idx}`}
                          className={`flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer ${isExpired ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" :
                            isUrgent ? "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800" :
                              isWarning ? "bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800" :
                                "bg-gray-50 dark:bg-gray-950/30 border-gray-200 dark:border-gray-800"
                            }`}
                          onClick={() => setLocation("/inventory?tab=alerts")}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm truncate">{alert.productName}</div>
                            <div className="text-xs text-muted-foreground">
                              {alert.warehouseName} • {alert.batchNumber || "Баглаагүй"}
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              Хугацаа: {alert.expiryDate}
                            </div>
                            {/* FEFO зөвлөмж */}
                            {isUrgent && (
                              <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                💡 Дуусах ойр batch-ийг түрүүнд гарга
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <div className="text-right">
                              <div className="text-sm font-semibold">{formatQuantity(Number(alert.quantity))}</div>
                              <Badge
                                variant={isExpired || isUrgent ? "destructive" : isWarning ? "default" : "secondary"}
                                className={`text-xs mt-1 ${isUrgent ? "bg-red-500 text-white" :
                                  isWarning ? "bg-yellow-500 text-white" :
                                    "bg-gray-400 text-white"
                                  }`}
                              >
                                {isExpired ? "Хэтэрсэн" : isUrgent ? `${daysLeft} хоног` : isWarning ? `${daysLeft} хоног` : `${daysLeft} хоног`}
                              </Badge>
                            </div>
                            {/* Шууд үйлдэл - Single button */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs"
                              onClick={(e) => {
                                e.stopPropagation();
                                setLocation(`/inventory?action=transfer&productId=${alert.productId}&warehouseId=${alert.warehouseId}`);
                              }}
                            >
                              Шилжүүлэх
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                    {expiryAlerts.length > 5 && (
                      <Button
                        variant="outline"
                        className="w-full mt-2"
                        onClick={() => setLocation("/inventory?tab=alerts")}
                      >
                        {expiryAlerts.length - 5} нэмэлт харах
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Side - HR Reminders (4 columns = 1/3 width) - Role-based visibility */}
        <div className="lg:col-span-4 space-y-6">


          {/* Pending Requests Widget */}
          <Card className="glass-card animate-scale-in border-2 border-orange-200/70 dark:border-orange-800/70 bg-gradient-to-br from-orange-50/50 via-amber-50/30 to-yellow-50/50 dark:from-orange-950/30 dark:via-amber-950/20 dark:to-yellow-950/30 shadow-md cursor-pointer hover:shadow-lg transition-all transform hover:-translate-y-0.5"
            onClick={() => setIsRequestsOpen(true)}
          >
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-lg">
                  <Bell className="w-5 h-5 text-orange-500" />
                  Шийдвэрлэх хүсэлтүүд 🔔
                </div>
                {stats?.pendingRequests && stats.pendingRequests > 0 && (
                  <Badge className="bg-orange-500 text-white">{stats.pendingRequests}</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {stats?.pendingRequests && stats.pendingRequests > 0 ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-lg bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-950/40 dark:to-amber-950/40 border border-orange-200/50 dark:border-orange-800/50">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 dark:from-orange-700 dark:to-amber-800 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold">{stats.pendingRequests} урьдчилгаа хүсэлт</p>
                        <p className="text-xs text-muted-foreground">Батлах хүлээгдэж байна</p>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-orange-500" />
                  </div>
                  <Button variant="outline" size="sm" className="w-full border-orange-300 dark:border-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/40">
                    Бүгдийг харах
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center py-6">
                  <div className="w-16 h-16 rounded-full bg-gradient-to-br from-orange-100 to-amber-100 dark:from-orange-900/30 dark:to-amber-900/30 flex items-center justify-center mb-3">
                    <Bell className="w-8 h-8 text-orange-400 dark:text-orange-500" />
                  </div>
                  <p className="text-sm font-medium mb-1">Шийдвэрлэх хүсэлт байхгүй</p>
                  <p className="text-xs text-muted-foreground/70">Бүх хүсэлтүүд шийдвэрлэгдсэн байна</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Contract Expiry Reminders */}
          {stats?.contractExpiry && stats.contractExpiry.length > 0 && (
            <Card className="glass-card animate-scale-in border-amber-200 dark:border-amber-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Calendar className="w-5 h-5 text-amber-500" />
                  Гэрээ дуусах (30 хоног)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.contractExpiry.slice(0, 3).map((emp: any) => (
                    <div key={emp.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-muted-foreground">
                          {emp.contractEndDate ? format(new Date(emp.contractEndDate), "yyyy-MM-dd") : "-"}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 px-2">
                        Шийдвэр
                      </Button>
                    </div>
                  ))}
                  {stats.contractExpiry.length > 3 && (
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setLocation("/employees")}>
                      {stats.contractExpiry.length - 3} нэмэлт харах
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Trial Period Reminders - HR, Admin, Manager */}
          {(userRole === "Admin" || userRole === "Manager" || userRole === "HR") && stats?.trialPeriod && stats.trialPeriod.length > 0 && (
            <Card className="glass-card animate-scale-in border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Clock className="w-5 h-5 text-blue-500" />
                  Туршилтын хугацаа (3 сар)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {stats.trialPeriod.slice(0, 3).map((emp: any) => (
                    <div key={emp.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-muted/50 transition-colors">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{emp.firstName} {emp.lastName}</p>
                        <p className="text-xs text-muted-foreground">
                          {emp.hireDate ? format(new Date(emp.hireDate), "yyyy-MM-dd") : "-"}
                        </p>
                      </div>
                      <Button size="sm" variant="ghost" className="h-7 px-2">
                        Шийдвэр
                      </Button>
                    </div>
                  ))}
                  {stats.trialPeriod.length > 3 && (
                    <Button variant="outline" size="sm" className="w-full mt-2" onClick={() => setLocation("/employees")}>
                      {stats.trialPeriod.length - 3} нэмэлт харах
                      <ArrowRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Монголын хугацаа/дедлайн сануулагч - Нягтлан, Admin, Manager */}
          {(userRole === "Admin" || userRole === "Manager" || userRole === "Нягтлан") && (
            <Card className="glass-card animate-scale-in border-purple-200/70 dark:border-purple-800/70 bg-gradient-to-br from-purple-50/50 via-violet-50/30 to-indigo-50/50 dark:from-purple-950/30 dark:via-violet-950/20 dark:to-indigo-950/30 shadow-md">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <CalendarDays className="w-5 h-5 text-purple-500" />
                  Хугацаа/Дедлайн сануулагч 📅
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* НӨАТ/татварын тайлангийн хугацаа */}
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400" />
                      <p className="text-sm font-semibold text-red-700 dark:text-red-300">НӨАТ-ын тайлан</p>
                    </div>
                    <Badge variant="destructive" className="text-xs">5 хоног үлдлээ</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Татварын хугацаа: Сүүлчийн сарын 15-д</p>
                </div>

                {/* НД-7/НД-8 бэлдэх */}
                <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200/50 dark:border-orange-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                      <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">НД-7 / НД-8</p>
                    </div>
                    <Badge variant="outline" className="text-xs bg-orange-100 dark:bg-orange-900 border-orange-300 dark:border-orange-700">
                      Бэлдэх
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Татварын тайлангийн хавсралт</p>
                </div>

                {/* Цалин бодох өдөр */}
                <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">Цалин бодох</p>
                    </div>
                    <Badge variant="outline" className="text-xs bg-blue-100 dark:bg-blue-900 border-blue-300 dark:border-blue-700">
                      Сарын 25
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">Дараах сарын цалинг бэлтгэх</p>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40"
                  onClick={() => setLocation("/settings?tab=calendar")}
                >
                  Бүгдийг харах
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <Dialog open={isRequestsOpen} onOpenChange={setIsRequestsOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Батлах хүлээгдэж буй хүсэлтүүд</DialogTitle>
          </DialogHeader>
          <SalaryRequestsDialogContent onClose={() => setIsRequestsOpen(false)} />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Real-time Salary Cards Component
function RealTimeSalaryCards() {
  const { employees = [], isLoading } = useEmployees();
  const currentMonth = format(new Date(), "yyyy-MM");

  if (isLoading) {
    return (
      <>
        {[1, 2, 3].map((i) => (
          <Card key={i} className="p-4">
            <div className="animate-pulse space-y-3">
              <div className="h-4 bg-muted rounded w-3/4" />
              <div className="h-8 bg-muted rounded w-1/2" />
              <div className="h-2 bg-muted rounded" />
            </div>
          </Card>
        ))}
      </>
    );
  }

  if (employees.length === 0) {
    return (
      <div className="col-span-full text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
        <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p className="text-sm">Ажилтан бүртгэгдээгүй байна.</p>
        <p className="text-xs mt-1">Орлого тооцохын тулд ажилтан нэмнэ үү.</p>
      </div>
    );
  }

  return (
    <>
      {employees.slice(0, 6).map((employee: Employee) => (
        <RealTimeSalaryCard key={employee.id} employeeId={employee.id} employeeName={`${employee.firstName} ${employee.lastName}`} />
      ))}
    </>
  );
}

// Real-time Salary Card Component
function RealTimeSalaryCard({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const currentMonth = format(new Date(), "yyyy-MM");
  const [, setLocation] = useLocation();

  const { data: salaryData, isLoading } = useQuery({
    queryKey: ["/api/employees", employeeId, "realtime-salary", currentMonth],
    queryFn: async () => {
      const res = await fetch(
        `/api/employees/${employeeId}/realtime-salary?month=${currentMonth}`,
        { credentials: "include" }
      );
      if (!res.ok) return null;
      return res.json();
    },
    refetchInterval: 2 * 60 * 1000, // Refresh every 2 minutes (was 30s, increased to reduce API load)
  });

  if (isLoading) {
    return (
      <Card className="p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-8 bg-muted rounded w-1/2" />
          <div className="h-2 bg-muted rounded" />
        </div>
      </Card>
    );
  }

  // If no salary data available (no base salary or no attendance)
  if (!salaryData) {
    return (
      <Card className="p-4 border-dashed">
        <div className="text-center py-4">
          <p className="text-sm font-medium text-muted-foreground truncate mb-1">{employeeName}</p>
          <p className="text-xs text-muted-foreground">Энэ сарын орлого олдсонгүй</p>
          <p className="text-xs text-muted-foreground mt-1">Үндсэн цалин эсвэл ирц бүртгэгдээгүй байна</p>
        </div>
      </Card>
    );
  }

  // If no days worked yet this month
  if (salaryData.daysWorked === 0 && salaryData.totalWorkingDays > 0) {
    return (
      <Card className="p-4 border-dashed border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-950/20">
        <div className="text-center py-4">
          <p className="text-sm font-medium text-muted-foreground truncate mb-1">{employeeName}</p>
          <p className="text-lg font-bold text-muted-foreground">0₮</p>
          <Badge variant="outline" className="mt-2 bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300 border-orange-300 dark:border-orange-700">
            Энэ сард ажиллаагүй
          </Badge>
          <div className="mt-3 h-2 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-muted" style={{ width: "0%" }} />
          </div>
        </div>
      </Card>
    );
  }

  const isLate = salaryData.lateDays > 0;
  const progressPercent = salaryData.totalWorkingDays > 0
    ? (salaryData.daysWorked / salaryData.totalWorkingDays) * 100
    : 0;

  // Get salary values from API response structure - handle NaN
  const currentGrossPay = Number(salaryData.current?.grossPay) || 0;
  const currentNetPay = Number(salaryData.current?.netPay) || 0;
  const projectedGrossPay = Number(salaryData.projected?.grossPay) || 0;
  const projectedNetPay = Number(salaryData.projected?.netPay) || 0;

  // Get breakdown (Tax + Social Insurance) - handle NaN
  const shi = Number(salaryData.breakdown?.shi) || 0;
  const pit = Number(salaryData.breakdown?.pit) || 0;
  const totalDeductionsValue = Number(salaryData.current?.totalDeductions) || 0;
  const totalDeductions = totalDeductionsValue || (shi + pit);

  return (
    <Card className="p-4 hover:shadow-md transition-shadow bg-gradient-to-br from-card to-muted/20">
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-medium text-muted-foreground truncate">{employeeName}</span>
        <Badge variant={isLate ? "destructive" : "default"} className="text-xs">
          {salaryData.daysWorked}/{salaryData.totalWorkingDays} өдөр
        </Badge>
      </div>
      {/* Net Salary (Main Display) */}
      <div className="text-2xl font-bold mb-2">
        {formatMNT(currentNetPay || 0)}
      </div>

      {/* Gross / Net Breakdown */}
      <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
        <div className="p-2 rounded bg-green-50 dark:bg-green-950/30 border border-green-200/50 dark:border-green-800/50">
          <p className="text-muted-foreground mb-0.5">Gross</p>
          <p className="font-semibold text-green-700 dark:text-green-300">
            {formatMNT(currentGrossPay || 0)}
          </p>
        </div>
        <div className="p-2 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50">
          <p className="text-muted-foreground mb-0.5">Net</p>
          <p className="font-semibold text-blue-700 dark:text-blue-300">
            {formatMNT(currentNetPay || 0)}
          </p>
        </div>
      </div>

      {/* Татвар+НДШ */}
      {totalDeductions > 0 && (
        <div className="mb-2 p-2 rounded bg-orange-50 dark:bg-orange-950/30 border border-orange-200/50 dark:border-orange-800/50">
          <p className="text-xs text-muted-foreground mb-1">Татвар+НДШ</p>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-orange-700 dark:text-orange-300">
              НДШ: {formatMNT(shi || 0)}
            </span>
            <span className="text-orange-700 dark:text-orange-300">
              Татвар: {formatMNT(pit || 0)}
            </span>
          </div>
          <p className="text-sm font-semibold text-orange-700 dark:text-orange-300">
            Нийт: -{formatMNT(totalDeductions || 0)}
          </p>
        </div>
      )}

      {/* Progress Bar */}
      <div className="mt-2 h-2 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full transition-all ${isLate ? "bg-orange-500" : "bg-primary"}`}
          style={{ width: `${progressPercent}%` }}
        />
      </div>

      {/* Төлөвлөсөн орлого */}
      {projectedNetPay > (currentNetPay || 0) && (
        <div className="mt-2 text-xs text-muted-foreground">
          Төлөвлөсөн: {formatMNT(projectedNetPay)}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 mt-3">
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs h-7"
          onClick={() => setLocation(`/payroll?employeeId=${employeeId}`)}
        >
          <FileText className="w-3 h-3 mr-1" />
          Payslip
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="flex-1 text-xs h-7"
          onClick={() => setLocation(`/payroll?action=create&employeeId=${employeeId}`)}
        >
          <Plus className="w-3 h-3 mr-1" />
          Batch-д нэмэх
        </Button>
      </div>

      {/* Урьдчилгаа */}
      {salaryData.advances?.deductedThisMonth > 0 && (
        <div className="mt-2 text-xs text-orange-600 dark:text-orange-400">
          Урьдчилгаа: -{formatMNT(salaryData.advances.deductedThisMonth)}
        </div>
      )}
    </Card>
  );
}

function SalaryRequestsDialogContent({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { employees = [] } = useEmployees();

  // Fetch only pending requests
  const { data: requests = [], isLoading } = useQuery({
    queryKey: ["/api/salary-advances", "pending"],
    queryFn: async () => {
      const res = await fetch("/api/salary-advances?status=pending", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch requests");
      return res.json();
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/salary-advances/${id}/approve`, {
        method: "POST",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary-advances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] }); // Update dashboard count
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/salary-advances/${id}/reject`, {
        method: "POST",
        credentials: "include",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary-advances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
  });

  if (isLoading) {
    return <div className="text-center py-8">Ачааллаж байна...</div>;
  }

  if (requests.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
        <Bell className="w-12 h-12 mx-auto mb-3 opacity-20" />
        <p>Шийдвэрлэх хүсэлт байхгүй байна.</p>
        <Button variant="ghost" onClick={onClose}>Хаах</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {requests.map((request: any) => {
        const employee = employees.find((e: any) => e.id === request.employeeId);
        return (
          <div key={request.id} className="p-4 border rounded-lg bg-card hover:bg-muted/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="font-semibold">{employee ? `${employee.firstName} ${employee.lastName}` : "Ажилтан олдсонгүй"}</p>
                <p className="text-xs text-muted-foreground">{employee?.employeeNo}</p>
              </div>
              <Badge variant={request.isLoan ? "secondary" : "default"}>
                {request.isLoan ? "Зээл" : "Урьдчилгаа"}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm mb-4">
              <div>
                <p className="text-muted-foreground">Хүссэн дүн:</p>
                <p className="font-medium text-lg">{Number(request.amount).toLocaleString()}₮</p>
              </div>
              {request.deductionType === 'monthly' && (
                <div>
                  <p className="text-muted-foreground">Суутгал:</p>
                  <p>{Number(request.monthlyDeductionAmount).toLocaleString()}₮ / сар</p>
                  <p className="text-xs text-muted-foreground">({request.totalDeductionMonths} сар)</p>
                </div>
              )}
            </div>

            {request.reason && (
              <div className="bg-muted p-2 rounded text-sm italic mb-4">
                "{request.reason}"
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/10"
                onClick={() => rejectMutation.mutate(request.id)}
                disabled={rejectMutation.isPending || approveMutation.isPending}
              >
                <X className="w-4 h-4 mr-1" />
                Татгалзах
              </Button>
              <Button
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-white"
                onClick={() => approveMutation.mutate(request.id)}
                disabled={rejectMutation.isPending || approveMutation.isPending}
              >
                <Check className="w-4 h-4 mr-1" />
                Зөвшөөрөх
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

