import { useStats } from "@/hooks/use-stats";
import { useExpiryAlerts } from "@/hooks/use-stock-movements";
import { useEmployees } from "@/hooks/use-employees";
import { useAuth } from "@/hooks/use-auth";
import { isEmployee } from "@shared/roles";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Building2, CreditCard, Activity, TrendingUp, Clock, Package, Users2, FileText, ArrowRight, AlertTriangle, Cake, Calendar, CheckCircle2, XCircle, Bell, Gift, Clock3, UserPlus, UserMinus, UserPen, CheckCircle, Radio, Plus, Calculator, Trophy, Zap, Receipt, Sparkles, Eye, TrendingDown, Brain, Check, Cloud, Sun, ThermometerSun, CalendarDays, Heart, MessageCircle, Newspaper, CloudSnow, EyeOff, X as XIcon, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBoundary } from "@/components/error-boundary";
import { useLocation } from "wouter";
import { format, addDays } from "date-fns";
import { useState, useMemo, useEffect, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Employee } from "@shared/schema";

// New World-Class Dashboard Widgets
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from "@/components/ui/GlassCard";
import { EnhancedSalaryCardsSection } from "@/components/dashboard/EnhancedSalaryCards";
import { SalesRevenueChart, AttendanceChart, SalaryChart } from "@/components/dashboard/DashboardCharts";
import WorkwearWidget from "@/components/workwear/WorkwearWidget";
import {
  WIDGET_REGISTRY,
  WIDGET_SPANS,
  DASHBOARD_PRESETS,
  resolveWidgetForRole,
  type WidgetContext,
  type WidgetKey,
  type DashboardStats
} from "@/components/dashboard/WidgetRegistry";
import { SalaryRequestsDialogContent } from "@/components/dashboard/SalaryRequestsDialog";

// DashboardStats imported from WidgetRegistry

// Format number as Mongolian Tugrik (standardized with commas)
const formatMNT = (value: number) => {
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + '₮';
};

// Format percentage (standardized with 1 decimal)
const formatPercent = (value: number | null | undefined) => {
  if (value === null || value === undefined) return '—';
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value) + '%';
};







// Data will come from stats API

// Demo Data Types
const demoStats: DashboardStats = {
  totalEmployees: 156,
  activeEmployees: 142,
  todayAttendance: { rate: 98, present: 138, late: 4, absent: 8 },
  pendingRequests: 5,
  monthlyPayroll: 324500000,
  payrollBudgetUsage: 85,
  payrollByMonth: [
    { name: "8-р сар", value: 300000000, net: 240000000, gross: 300000000, deductions: 60000000 },
    { name: "9-р сар", value: 310000000, net: 248000000, gross: 310000000, deductions: 62000000 },
    { name: "10-р сар", value: 295000000, net: 236000000, gross: 295000000, deductions: 59000000 },
    { name: "11-р сар", value: 320000000, net: 256000000, gross: 320000000, deductions: 64000000 },
    { name: "12-р сар", value: 330000000, net: 264000000, gross: 330000000, deductions: 66000000 },
    { name: "1-р сар", value: 324500000, net: 259600000, gross: 324500000, deductions: 64900000 },
  ],
  salesByMonth: [
    { name: '8-р сар', value: 45000000 },
    { name: '9-р сар', value: 52000000 },
    { name: '10-р сар', value: 48000000 },
    { name: '11-р сар', value: 61000000 },
    { name: '12-р сар', value: 55000000 },
    { name: '1-р сар', value: 72000000 },
  ],
  attendanceByDay: [
    { name: 'Дав', present: 135, late: 5, absent: 10, total: 150, rate: 90 },
    { name: 'Мяг', present: 140, late: 2, absent: 8, total: 150, rate: 93 },
    { name: 'Лха', present: 138, late: 4, absent: 8, total: 150, rate: 92 },
    { name: 'Пүр', present: 142, late: 1, absent: 7, total: 150, rate: 95 },
    { name: 'Баа', present: 139, late: 6, absent: 5, total: 150, rate: 93 },
    { name: 'Бям', present: 20, late: 0, absent: 130, total: 150, rate: 13 },
    { name: 'Ням', present: 15, late: 0, absent: 135, total: 150, rate: 10 },
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
  ],
  invoicePaymentStatus: {
    todayPaid: 2500000,
    overdue: 1500000,
    next7Days: 4500000
  },
  trialPeriod: [
    { id: 1, firstName: 'Bat', lastName: 'Bold', hireDate: '2024-01-05' }
  ],
  contractExpiry: [
    { id: 2, firstName: 'Sarah', lastName: 'Tuya', contractEndDate: '2024-02-15' }
  ],
  topEmployees: [
    { id: 3, name: 'Gan', performance: 95 }
  ]
};

export default function Dashboard() {
  const { data: stats, isLoading, error: statsError } = useStats();
  const { alerts: expiryAlerts = [] } = useExpiryAlerts(30);
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const isEmployeeUser = isEmployee(user?.role);
  const userRole = user?.role || "";

  // Determine effective role for presets
  const canManageAll = !isEmployeeUser;
  const presetRole = canManageAll ? "manager" : "employee";
  const visibleWidgets = DASHBOARD_PRESETS[presetRole].map(key => resolveWidgetForRole(key, presetRole));

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
  const activeStats = useMemo<DashboardStats | null | undefined>(() => {
    return (isDemoMode ? demoStats : stats) as (DashboardStats | null | undefined);
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

  const salesData = useMemo(() => {
    if (!allSalesData || allSalesData.length === 0) return [];

    if (salesDateRange === "6months") {
      return allSalesData;
    } else if (salesDateRange === "30days") {
      return allSalesData; // Backend returns 6 months anyway, usually fine to show all or slice
    } else if (salesDateRange === "7days") {
      return allSalesData.slice(-1); // Probably meant to be just latest month?
    }
    return allSalesData;
  }, [allSalesData, salesDateRange]);

  const attendanceData = useMemo(() => {
    if (!allAttendanceData || allAttendanceData.length === 0) return [];

    if (attendanceDateRange === "7days") {
      return allAttendanceData.slice(-7);
    }
    // "30days"
    return allAttendanceData;
  }, [allAttendanceData, attendanceDateRange]);

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
      <div className="animate-slide-up flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div className="flex-1 flex flex-col sm:flex-row sm:items-start lg:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {greeting}, {user?.fullName || user?.email} 👋
            </h2>
            <p className="text-sm md:text-base text-muted-foreground mt-1 md:mt-2">
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
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground whitespace-nowrap">Хугацаа:</span>
              <Select value={globalDateRange} onValueChange={(v: any) => setGlobalDateRange(v)}>
                <SelectTrigger className="w-[120px] h-9 text-xs">
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
        </div>

        <div className="flex gap-2 items-center overflow-x-auto pb-2 -mx-4 px-4 md:mx-0 md:px-0 md:pb-0 md:flex-wrap md:overflow-visible [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none'] shrink-0">
          {/* Quick Actions */}
          {!zenMode && (
            <>
              <div className="flex items-center space-x-2 bg-muted/50 p-1.5 rounded-lg border border-border/50 shrink-0">
                <Switch
                  id="demo-mode"
                  checked={isDemoMode}
                  onCheckedChange={setIsDemoMode}
                />
                <Label htmlFor="demo-mode" className="cursor-pointer text-sm font-medium whitespace-nowrap">Demo Mode</Label>
              </div>

              <Button
                onClick={() => setLocation("/invoices?action=create")}
                className="bg-primary hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all hover:-translate-y-0.5 shrink-0"
              >
                <Plus className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Нэхэмжлэх үүсгэх</span>
                <span className="md:hidden ml-2">Нэхэмжлэх</span>
              </Button>
              <Button
                onClick={() => setLocation("/employees?action=create")}
                variant="outline"
                className="hover:bg-muted/50 shrink-0"
              >
                <UserPlus className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Ажилтан нэмэх</span>
                <span className="md:hidden ml-2">Ажилтан</span>
              </Button>
              {/* Smart Leave Request Button */}
              {(userRole === "admin" || userRole === "manager" || userRole === "hr") ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="hover:bg-muted/50 shrink-0">
                      <Calendar className="w-4 h-4 mr-2" />
                      Чөлөө & Амралт
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Чөлөөний удирдлага</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setLocation("/leave")}>
                      <Plus className="w-4 h-4 mr-2" />
                      Чөлөө хүсэх
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLocation("/leave?tab=approvals")}>
                      <CheckCircle2 className="w-4 h-4 mr-2" />
                      Хүсэлтүүд шийдвэрлэх
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => setLocation("/attendance")}>
                      <Clock className="w-4 h-4 mr-2" />
                      Ирц хянах
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  onClick={() => setLocation("/leave")}
                  variant="outline"
                  className="hover:bg-muted/50 shrink-0"
                >
                  <Calendar className="w-4 h-4 mr-2" />
                  Чөлөө хүсэх
                </Button>
              )}
            </>
          )}

          {/* Zen Mode Toggle */}
          <Button
            onClick={() => setZenMode(!zenMode)}
            variant={zenMode ? "default" : "outline"}
            size="sm"
            className="shrink-0 h-10"
          >
            {zenMode ? (
              <>
                <EyeOff className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Zen Mode</span>
              </>
            ) : (
              <>
                <Eye className="w-4 h-4 md:mr-2" />
                <span className="hidden md:inline">Zen</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Quick Stats Cards - 2x2 on mobile, 4 columns on desktop */}
      {!zenMode && (
        <div className="grid grid-cols-2 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-6 mb-6 md:mb-8">
          {visibleWidgets.map(key => {
            const WidgetComponent = WIDGET_REGISTRY[key];
            if (!WidgetComponent) return null;

            const ctx: WidgetContext = {
              stats: activeStats,
              userRole,
              isEmployee: isEmployeeUser,
              setLocation,
              formatMNT,
              formatPercent,
              expiryAlerts,
              weatherData
            };

            return (
              <div key={key} className={WIDGET_SPANS[key] || "col-span-1"}>
                {WidgetComponent(ctx)}
              </div>
            );
          })}
        </div>
      )}



      {/* Zen Mode Status Card */}
      {zenMode && (
        <Card className="glass-card animate-scale-in border-2 border-primary/50">
          <CardContent className="p-8 text-center">
            {stats?.todayAttendance?.rate === 100 && stats?.pendingRequests === 0 && (stats?.ebarimtStatus ? stats.ebarimtStatus.unsentCount === 0 : true) ? (
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
        <>


          {/* Quick Info Row - Currency Exchange, E-barimt Status & More */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {/* Currency Exchange Widget - Collapsible/Compact */}


            {/* Invoice Payment Status - Standardized Format (Title, Amount, Count, Trend) */}
            {activeStats?.invoicePaymentStatus && (
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

                  {/* Dynamic Dates */}
                  {(() => {
                    const today = new Date();
                    const nextWeek = addDays(today, 6);
                    const dateRangeStr = `${format(today, "MMM d")} - ${format(nextWeek, "MMM d")}`;

                    return (
                      <div className="space-y-2">
                        {/* Revenue Section - Clickable */}
                        <TooltipProvider>
                          <div className="flex items-center justify-between p-2.5 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200/50 dark:border-green-800/50 group hover:border-green-400 transition-colors">
                            <div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-xs font-medium text-green-700 dark:text-green-300 cursor-help border-b border-dotted border-green-400 inline-block">
                                    Орлого <span className="text-[10px] opacity-70">({dateRangeStr} • таамаг)</span>
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Таамагийн хугацаа: өнөөдрөөс хойш 7 хоног</p>
                                </TooltipContent>
                              </Tooltip>
                              <p className="text-lg font-bold text-green-900 dark:text-green-100 mt-0.5">
                                {formatMNT(activeStats.cashFlowProjection.next7DaysRevenue)}
                              </p>
                            </div>

                            <div className="flex flex-col items-end gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge
                                    variant="outline"
                                    className="bg-green-100 dark:bg-green-900 text-xs cursor-pointer hover:bg-green-200 dark:hover:bg-green-800 transition-colors"
                                    onClick={() => setLocation("/invoices?range=next7days&source=cashflow")}
                                  >
                                    {activeStats.cashFlowProjection.dataPointsUsed || activeStats?.recentInvoices?.length || 0} invoice
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Тооцоонд ашигласан сүүлийн {activeStats.cashFlowProjection.dataPointsUsed || 5} нэхэмжлэх (posted/paid)</p>
                                  {activeStats.cashFlowProjection.confidenceLevel && (
                                    <p className="text-[10px] opacity-80 mt-1">
                                      Дүнгийн итгэлцэл: {
                                        activeStats.cashFlowProjection.confidenceLevel === 'high' ? 'Өндөр' :
                                          activeStats.cashFlowProjection.confidenceLevel === 'medium' ? 'Дунд' : 'Бага (өгөгдөл цөөн)'
                                      }
                                    </p>
                                  )}
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          </div>
                        </TooltipProvider>

                        {/* Expenses Section - Clickable */}
                        <TooltipProvider>
                          <div
                            className="flex items-center justify-between p-2.5 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200/50 dark:border-red-800/50 cursor-pointer hover:border-red-400 transition-colors group"
                            onClick={() => setLocation("/payroll?range=next7days&source=cashflow")}
                          >
                            <div>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <p className="text-xs font-medium text-red-700 dark:text-red-300 border-b border-dotted border-red-400 inline-block">
                                    Зарлага <span className="text-[10px] opacity-70">({dateRangeStr} • таамаг)</span>
                                  </p>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p>Одоогоор: цалин (payroll) дээр суурилсан</p>
                                </TooltipContent>
                              </Tooltip>
                              <p className="text-lg font-bold text-red-900 dark:text-red-100 mt-0.5">
                                {formatMNT(activeStats.cashFlowProjection.next7DaysExpenses)}
                              </p>
                            </div>
                            <ArrowRight className="w-4 h-4 text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                        </TooltipProvider>

                        {/* Net Flow */}
                        <div className={`flex items-center justify-between p-3 rounded-lg border-2 ${activeStats.cashFlowProjection.netCashFlow >= 0
                          ? "bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700"
                          : "bg-orange-50 dark:bg-orange-950/30 border-orange-300 dark:border-orange-700"
                          }`}>
                          <span className={`text-sm font-semibold ${activeStats.cashFlowProjection.netCashFlow >= 0
                            ? "text-green-700 dark:text-green-300"
                            : "text-orange-700 dark:text-orange-300"
                            }`}>
                            Цэвэр урсгал <span className="text-[10px] opacity-70 font-normal">({dateRangeStr} • таамаг)</span>
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
                    );
                  })()}

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
              ) : null}
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



          {/* Real-time Salary Section - Role-based visibility */}
          {
            !zenMode && (userRole === "Admin" || userRole === "HR" || userRole === "Manager") && (
              <div className="space-y-4 md:space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <h3 className="text-base md:text-lg font-semibold shrink-0">Энэ сарын орлого (Ажилтнууд)</h3>
                  {/* Quick Actions for HR */}
                  <div className="flex gap-2 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden shrink-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation("/employees?action=create")}
                      className="text-xs h-8 border-blue-300 dark:border-blue-700 hover:bg-blue-50 dark:hover:bg-blue-950/40 whitespace-nowrap shrink-0"
                    >
                      <UserPlus className="w-3 h-3 mr-1" />
                      Ажилтан нэмэх
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation("/attendance?action=create")}
                      className="text-xs h-8 border-green-300 dark:border-green-700 hover:bg-green-50 dark:hover:bg-green-950/40 whitespace-nowrap shrink-0"
                    >
                      <Calendar className="w-3 h-3 mr-1" />
                      Ирц бүртгэх
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLocation("/payroll?action=create")}
                      className="text-xs h-8 border-purple-300 dark:border-purple-700 hover:bg-purple-50 dark:hover:bg-purple-950/40 whitespace-nowrap shrink-0"
                    >
                      <Calculator className="w-3 h-3 mr-1" />
                      Цалин бодох
                    </Button>
                  </div>
                </div>
                <EnhancedSalaryCardsSection />
              </div>
            )
          }

          {/* Main Content Row - Charts + HR Reminders - full width on mobile, 2/3+1/3 on desktop */}
          <div className="grid gap-4 md:gap-6 grid-cols-1 lg:grid-cols-12">
            {/* Left Side - Charts (8 columns = 2/3 width) - Role-based visibility */}
            <div className="lg:col-span-8 space-y-6">
              {/* Sales Revenue Chart - Visible to Sales, Admin, Manager */}
              {(userRole === "Admin" || userRole === "Manager" || userRole === "Борлуулалт") && (
                <SalesRevenueChart
                  data={allSalesData}
                  onNavigate={setLocation}
                  formatMoney={formatMNT}
                />
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
                  <SalaryChart
                    data={salaryData}
                    onNavigate={setLocation}
                    formatMoney={formatMNT}
                  />
                )}

                {/* Attendance Chart */}
                {(userRole === "Admin" || userRole === "Manager" || userRole === "HR") && (
                  <AttendanceChart
                    data={allAttendanceData}
                    onNavigate={setLocation}
                  />
                )}

              </div>

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

              {/* Нормын хувцасны widget - зөвхөн ажилтнуудад харагдана */}
              {isEmployeeUser && (
                <WorkwearWidget />
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
        </>
      )}
    </div>
  );
}


