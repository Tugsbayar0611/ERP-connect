import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import {
  Clock, Calendar, CreditCard, Wallet, Bell, ChevronRight,
  CheckCircle2, AlertTriangle, TrendingUp, FileText, Newspaper,
  Heart, MessageCircle, User, MapPin, Coffee, Zap,
  ArrowRight, Plus, Activity, Star, Gift, LogIn, LogOut,
  Briefcase, CalendarDays
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { CountUp } from "@/components/ui/count-up";
import { WalletWidget } from "@/components/dashboard/WalletWidget";
import WorkwearWidget from "@/components/workwear/WorkwearWidget";

// ────────────────────────────────────────────────────────────────────────────
// Helper
// ────────────────────────────────────────────────────────────────────────────
const formatMNT = (v: number) =>
  new Intl.NumberFormat("mn-MN").format(v) + "₮";

// ────────────────────────────────────────────────────────────────────────────
// Sub-widgets
// ────────────────────────────────────────────────────────────────────────────

/** My Attendance today */
function MyAttendanceCard({ setLocation }: { setLocation: (s: string) => void }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/attendance/my/today"],
    queryFn: async () => {
      const r = await fetch("/api/attendance/my/today");
      if (!r.ok) return null;
      return r.json();
    },
    retry: false,
  });

  const now = new Date();
  const timeStr = format(now, "HH:mm");
  const dateStr = format(now, "yyyy-MM-dd (EEEE)");

  const isPresent = data?.status === "present";
  const isLate = data?.status === "late";
  const isAbsent = !data || data?.status === "absent";

  return (
    <Card
      onClick={() => setLocation("/attendance")}
      className="relative overflow-hidden cursor-pointer group h-full
        bg-gradient-to-br from-emerald-50 via-teal-50/60 to-cyan-50
        dark:from-emerald-950/60 dark:via-teal-900/30 dark:to-cyan-950/60
        border-emerald-200/60 dark:border-emerald-800/50
        hover:shadow-lg hover:shadow-emerald-100 dark:hover:shadow-emerald-900/20
        transition-all duration-300 hover:-translate-y-0.5"
    >
      <Activity className="absolute -right-6 -bottom-6 w-36 h-36 text-emerald-100/60 dark:text-emerald-900/20 group-hover:scale-110 transition-transform duration-500 pointer-events-none" />
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-bold text-emerald-600/80 dark:text-emerald-400 uppercase tracking-wider">Өнөөдрийн ирц</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{dateStr}</p>
          </div>
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/50 rounded-xl">
            <Activity className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-28" />
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              {isPresent && <CheckCircle2 className="w-6 h-6 text-emerald-500" />}
              {isLate && <Clock className="w-6 h-6 text-amber-500" />}
              {isAbsent && <AlertTriangle className="w-6 h-6 text-red-400" />}
              <span className={`text-xl font-black tracking-tight ${isPresent ? "text-emerald-600 dark:text-emerald-400" : isLate ? "text-amber-600 dark:text-amber-400" : "text-red-500 dark:text-red-400"}`}>
                {isPresent ? "Ирсэн" : isLate ? "Хоцорсон" : "Ирээгүй"}
              </span>
            </div>
            {data?.checkInTime && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <LogIn className="w-3 h-3 text-emerald-500" />
                <span>Ирсэн: <span className="font-semibold text-foreground">{data.checkInTime}</span></span>
                {data?.checkOutTime && (
                  <>
                    <LogOut className="w-3 h-3 text-rose-400 ml-2" />
                    <span>Гарсан: <span className="font-semibold text-foreground">{data.checkOutTime}</span></span>
                  </>
                )}
              </div>
            )}
            {isAbsent && (
              <p className="text-xs text-muted-foreground">Бүртгэл байхгүй байна</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** My Leave Balance */
function MyLeaveCard({ setLocation }: { setLocation: (s: string) => void }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/leave/my/balance"],
    queryFn: async () => {
      const r = await fetch("/api/leave/my/balance");
      if (!r.ok) return null;
      return r.json();
    },
    retry: false,
  });

  const total = data?.totalDays ?? 15;
  const used = data?.usedDays ?? 0;
  const remaining = total - used;
  const pct = Math.min((used / total) * 100, 100);

  return (
    <Card
      onClick={() => setLocation("/leave")}
      className="relative overflow-hidden cursor-pointer group h-full
        bg-gradient-to-br from-violet-50 via-purple-50/60 to-fuchsia-50
        dark:from-violet-950/60 dark:via-purple-900/30 dark:to-fuchsia-950/60
        border-violet-200/60 dark:border-violet-800/50
        hover:shadow-lg hover:shadow-violet-100 dark:hover:shadow-violet-900/20
        transition-all duration-300 hover:-translate-y-0.5"
    >
      <CalendarDays className="absolute -right-6 -bottom-6 w-36 h-36 text-violet-100/60 dark:text-violet-900/20 group-hover:scale-110 transition-transform duration-500 pointer-events-none" />
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-bold text-violet-600/80 dark:text-violet-400 uppercase tracking-wider">Чөлөөний үлдэгдэл</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Энэ жилийн эрх</p>
          </div>
          <div className="p-2.5 bg-violet-100 dark:bg-violet-900/50 rounded-xl">
            <CalendarDays className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-28" />
        ) : (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-end gap-2">
              <span className="text-4xl font-black text-violet-700 dark:text-violet-300 tracking-tight">
                {remaining}
              </span>
              <span className="text-sm text-muted-foreground mb-1.5">/ {total} өдөр</span>
            </div>
            <div>
              <div className="flex justify-between text-[11px] text-muted-foreground mb-1">
                <span>Ашигласан: <b className="text-foreground">{used}</b> өдөр</span>
                <span className="font-semibold text-violet-600 dark:text-violet-400">{Math.round(pct)}%</span>
              </div>
              <Progress value={pct} className="h-1.5 bg-violet-100 dark:bg-violet-900/50" />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** My latest payslip */
function MySalaryCard({ setLocation }: { setLocation: (s: string) => void }) {
  const { data, isLoading } = useQuery<any>({
    queryKey: ["/api/payroll/my/latest"],
    queryFn: async () => {
      const r = await fetch("/api/payroll/my/latest");
      if (!r.ok) return null;
      return r.json();
    },
    retry: false,
  });

  return (
    <Card
      onClick={() => setLocation("/my-profile?tab=payslips")}
      className="relative overflow-hidden cursor-pointer group h-full
        bg-gradient-to-br from-blue-50 via-indigo-50/60 to-sky-50
        dark:from-blue-950/60 dark:via-indigo-900/30 dark:to-sky-950/60
        border-blue-200/60 dark:border-blue-800/50
        hover:shadow-lg hover:shadow-blue-100 dark:hover:shadow-blue-900/20
        transition-all duration-300 hover:-translate-y-0.5"
    >
      <CreditCard className="absolute -right-6 -bottom-6 w-36 h-36 text-blue-100/60 dark:text-blue-900/20 group-hover:scale-110 transition-transform duration-500 pointer-events-none" />
      <CardHeader className="pb-2">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs font-bold text-blue-600/80 dark:text-blue-400 uppercase tracking-wider">Сүүлийн цалин</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{data?.periodLabel ?? "—"}</p>
          </div>
          <div className="p-2.5 bg-blue-100 dark:bg-blue-900/50 rounded-xl">
            <CreditCard className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-10 w-36" />
        ) : data ? (
          <div className="flex flex-col gap-2">
            <span className="text-2xl font-black text-blue-700 dark:text-blue-300 tracking-tight truncate">
              {formatMNT(data.netAmount ?? data.netSalary ?? 0)}
            </span>
            <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
              <span>Нийт: <b className="text-foreground">{formatMNT(data.grossAmount ?? data.grossSalary ?? 0)}</b></span>
              <span className="text-rose-400">-{formatMNT(data.totalDeductions ?? 0)} суутгал</span>
            </div>
            <Badge variant="outline" className="w-fit text-[10px] h-5 px-2 bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300">
              {data.status === "paid" ? "✓ Олгогдсон" : data.status === "processed" ? "Боловсруулагдсан" : "Бэлтгэгдэж байна"}
            </Badge>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Цалингийн мэдээлэл байхгүй</p>
        )}
      </CardContent>
    </Card>
  );
}

/** My Pending Leave Requests */
function MyPendingRequestsCard({ setLocation }: { setLocation: (s: string) => void }) {
  const { data, isLoading } = useQuery<any[]>({
    queryKey: ["/api/leave/my/requests"],
    queryFn: async () => {
      const r = await fetch("/api/leave/my/requests?status=pending&limit=3");
      if (!r.ok) return [];
      return r.json();
    },
    retry: false,
  });

  const pending = data?.filter((d: any) => d.status === "pending") ?? [];

  return (
    <Card className="glass-card animate-scale-in h-full flex flex-col">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
            <Bell className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <CardTitle className="text-sm">Хүсэлтийн статус</CardTitle>
            <p className="text-[11px] text-muted-foreground">Миний чөлөөний хүсэлтүүд</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setLocation("/leave")}>
          Бүгд <ChevronRight className="w-3 h-3 ml-0.5" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1">
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-6 text-center text-muted-foreground">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mb-2" />
            <p className="text-sm font-medium">Хүлээгдэж буй хүсэлт байхгүй</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.slice(0, 3).map((req: any) => (
              <div key={req.id} className="flex items-center justify-between p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/50 dark:border-amber-800/50">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold truncate">{req.leaveTypeName ?? req.type ?? "Чөлөө"}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {req.startDate} → {req.endDate} · {req.days ?? "?"} өдөр
                  </p>
                </div>
                <Badge className="ml-2 shrink-0 text-[10px] h-5 px-1.5 bg-amber-500/20 text-amber-700 dark:text-amber-300 border-0">
                  Хүлээгдэж буй
                </Badge>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Company News */
function EmployeeNewsCard({ setLocation }: { setLocation: (s: string) => void }) {
  const { data: posts, isLoading } = useQuery<any[]>({
    queryKey: ["/api/news/published"],
    queryFn: async () => {
      const r = await fetch("/api/news/published?limit=5");
      if (!r.ok) return [];
      return r.json();
    },
    retry: false,
  });

  return (
    <Card className="glass-card animate-scale-in h-full flex flex-col">
      <CardHeader className="pb-2 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
            <Newspaper className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <CardTitle className="text-sm">Компанийн мэдээ</CardTitle>
            <p className="text-[11px] text-muted-foreground">Шинэ мэдэгдэл, зарлал</p>
          </div>
        </div>
        <Button variant="ghost" size="sm" className="h-7 text-[11px]" onClick={() => setLocation("/news")}>
          Бүгд <ChevronRight className="w-3 h-3 ml-0.5" />
        </Button>
      </CardHeader>
      <CardContent className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : !posts || posts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-6 text-center text-muted-foreground">
            <Newspaper className="w-10 h-10 text-blue-300 mb-2" />
            <p className="text-sm font-medium">Одоогоор мэдээ байхгүй</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {posts.slice(0, 5).map((post: any) => (
              <div
                key={post.id}
                className="p-3 rounded-lg bg-blue-50/70 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50 hover:bg-blue-100 dark:hover:bg-blue-950/50 cursor-pointer transition-colors"
                onClick={() => setLocation("/news")}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 line-clamp-1 flex-1">{post.title}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0">{post.publishedAt ? format(new Date(post.publishedAt), "MM/dd") : ""}</span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{post.content}</p>
                <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                  <span>{post.authorName}</span>
                  {post.likesCount > 0 && <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{post.likesCount}</span>}
                  {post.commentsCount > 0 && <span className="flex items-center gap-0.5"><MessageCircle className="w-2.5 h-2.5" />{post.commentsCount}</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Quick Actions row */
function QuickActionsRow({ setLocation }: { setLocation: (s: string) => void }) {
  const actions = [
    { icon: Calendar, label: "Чөлөө хүсэх", path: "/leave?action=create", color: "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 hover:bg-violet-200 dark:hover:bg-violet-900/50" },
    { icon: FileText, label: "Урьдчилгаа", path: "/salary-advances?action=create", color: "bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50" },
    { icon: User, label: "Профайл", path: "/my-profile", color: "bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-900/50" },
    { icon: Activity, label: "Ирцийн түүх", path: "/attendance", color: "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-200 dark:hover:bg-emerald-900/50" },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
      {actions.map(({ icon: Icon, label, path, color }) => (
        <button
          key={path}
          onClick={() => setLocation(path)}
          className={`flex flex-col items-center gap-2 p-3 rounded-xl border border-transparent transition-all duration-200 hover:scale-[1.03] active:scale-95 ${color} group`}
        >
          <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/70 dark:bg-black/20 shadow-sm group-hover:shadow-md transition-shadow">
            <Icon className="w-5 h-5" />
          </div>
          <span className="text-xs font-semibold text-center leading-tight">{label}</span>
        </button>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Main Employee Dashboard
// ────────────────────────────────────────────────────────────────────────────
export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const greeting = useMemo(() => {
    const h = new Date().getHours();
    if (h < 12) return "Өглөөний мэнд";
    if (h < 18) return "Өдрийн мэнд";
    return "Оройн мэнд";
  }, []);

  const todayStr = format(new Date(), "yyyy-MM-dd, EEEE");

  return (
    <div className="min-h-screen -m-4 md:-m-8 p-4 md:p-8 space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="animate-slide-up flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl md:text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {greeting}, {user?.fullName?.split(" ")[0] || user?.username} 👋
          </h2>
          <p className="text-sm text-muted-foreground mt-1">{todayStr}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            onClick={() => setLocation("/leave?action=create")}
            size="sm"
            className="bg-violet-600 hover:bg-violet-700 text-white shadow-md shadow-violet-200 dark:shadow-violet-900/20 transition-all hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Чөлөө хүсэх
          </Button>
          <Button
            onClick={() => setLocation("/my-profile")}
            variant="outline"
            size="sm"
            className="hover:bg-muted/50"
          >
            <User className="w-4 h-4 mr-1.5" />
            Профайл
          </Button>
        </div>
      </div>

      {/* ── Quick Actions ───────────────────────────────────────────────────── */}
      <QuickActionsRow setLocation={setLocation} />

      {/* ── Top KPI Cards ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <MyAttendanceCard setLocation={setLocation} />
        <MyLeaveCard setLocation={setLocation} />
        <MySalaryCard setLocation={setLocation} />
      </div>

      {/* ── Middle Row: Wallet + Pending Requests ────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Canteen Wallet */}
        <div className="h-[320px]">
          <WalletWidget />
        </div>
        {/* Leave Requests Status */}
        <div className="h-[320px]">
          <MyPendingRequestsCard setLocation={setLocation} />
        </div>
      </div>

      {/* ── Bottom Row: News + Workwear ─────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="h-[380px]">
          <EmployeeNewsCard setLocation={setLocation} />
        </div>
        <div className="h-[380px]">
          <WorkwearWidget />
        </div>
      </div>
    </div>
  );
}
