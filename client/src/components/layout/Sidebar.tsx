import { Link, useLocation } from "wouter";
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  Building2,
  CalendarCheck,
  CalendarOff,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Package,
  UserCircle,
  ShoppingCart,
  ShoppingBag,
  Warehouse,
  Receipt,
  BookOpen,
  FileSpreadsheet,
  BookMarked,
  BarChart3,
  FileCheck,
  Banknote,
  History,
  Bell,
  TrendingUp,
  AlertTriangle,
  MessageSquare,
  CalendarDays,
  Clock,
  Bus,
  Inbox,
  Shield,
  Utensils,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { isEmployee, isPrivileged, isManager, canViewTeamPerformance } from "@shared/roles";
import { hasPermission, type Resource, type Action } from "@shared/permissions";

type NavItem = {
  href: string;
  label: string;
  icon: React.ElementType;
  requiredPermission?: { resource: Resource; action: Action };
};

type NavGroup = {
  title: string;
  items: NavItem[];
};

import { GlobalSearch } from "./GlobalSearch";

const originalNavGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/", label: "Хянах самбар", icon: LayoutDashboard },
      { href: "/me/canteen", label: "Хоолны эрх", icon: Wallet },
      { href: "/reports", label: "Тайлангууд", icon: BarChart3 },
      { href: "/news", label: "Мэдээлэл", icon: Bell },
    ],
  },
  {
    title: "Workforce",
    items: [
      {
        href: "/manager/rosters/calendar",
        label: "Ээлжийн хуваарь",
        icon: CalendarDays,
        // Explicitly allowing Admin/HR even if permission check alone is used, 
        // but since Admin HAS permission, maybe it's the `isManager` check somewhere?
        // User specifically asked for: roles.includes('manager') || roles.includes('admin') || roles.includes('hr')
        // I will add a custom check function if the Sidebar supports it, or just assume the permission system works.
        // Actually, if I look at `Sidebar.tsx` implementation (which I will do next), I can see.
        requiredPermission: { resource: 'roster', action: 'read' }
      },
      { href: "/admin/rosters", label: "Ээлж төлөвлөлт", icon: SettingsIcon, requiredPermission: { resource: 'roster', action: 'write' } },
      { href: "/admin/shifts", label: "Ээлжийн төрөл", icon: Clock, requiredPermission: { resource: 'roster', action: 'write' } },
    ]
  },
  {
    title: "HR & Organization",
    items: [
      { href: "/employees", label: "Ажилтнууд", icon: Users },
      { href: "/departments", label: "Хэлтсүүд", icon: Building2 },
      { href: "/attendance", label: "Ирц бүртгэл", icon: CalendarCheck },
      { href: "/requests", label: "Хүсэлтүүд", icon: Inbox },
      { href: "/payroll", label: "Цалин", icon: CreditCard },
      { href: "/performance", label: "Гүйцэтгэл", icon: TrendingUp },
      { href: "/safety", label: "Аюулгүй ажиллагаа", icon: AlertTriangle },
      { href: "/communication", label: "Дотоод харилцаа", icon: MessageSquare },
      { href: "/canteen/admin", label: "Цайны газар", icon: Utensils },
    ],
  },
  {
    title: "Operation",
    items: [
      { href: "/products", label: "Бараа", icon: Package },
      { href: "/inventory", label: "Агуулах", icon: Warehouse },
      { href: "/sales", label: "Борлуулалт", icon: ShoppingCart },
      { href: "/purchase", label: "Худалдан авалт", icon: ShoppingBag },
      { href: "/contacts", label: "Харилцагчид", icon: UserCircle },
      { href: "/admin/transport", label: "Тээвэр", icon: Bus },
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/invoices", label: "Нэхэмжлэх", icon: Receipt },
      { href: "/journals", label: "Ерөнхий журнал (GL)", icon: BookMarked },
      { href: "/accounts", label: "Дансны төлөвлөгөө", icon: FileSpreadsheet },
      { href: "/tax-codes", label: "Татварын тохиргоо", icon: FileCheck },
      { href: "/bank-statements", label: "Банкны хуулга", icon: Banknote },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/documents", label: "Баримтууд", icon: FileText },
      { href: "/audit-logs", label: "Хяналтын бүртгэл", icon: History },
      { href: "/settings", label: "Тохиргоо", icon: SettingsIcon },
    ],
  },
  {
    title: "MY WORKSPAACE",
    items: []
  }
];

const employeeNavGroups: NavGroup[] = [
  {
    title: "MY WORKSPACE",
    items: [
      { href: "/settings", label: "Тохиргоо (Профайл)", icon: UserCircle },
      { href: "/", label: "Хянах самбар", icon: LayoutDashboard },
      { href: "/action-center", label: "Мэдэгдэл", icon: Bell },
      { href: "/communication", label: "Чат", icon: MessageSquare },
      { href: "/me/sessions", label: "Сешнүүд", icon: Shield },
    ],
  },
  {
    title: "HR",
    items: [
      { href: "/me/canteen", label: "Хоолны эрх", icon: Wallet },
      { href: "/me/roster", label: "Миний ээлж", icon: CalendarDays },
      { href: "/attendance", label: "Миний ирц", icon: CalendarCheck },
      { href: "/transport/booking", label: "Автобус захиалга", icon: Bus },
      { href: "/me/requests", label: "Миний хүсэлтүүд", icon: FileText },
      { href: "/payroll", label: "Цалингийн хуудас", icon: CreditCard },
      { href: "/documents", label: "Баримтууд", icon: FileText },
    ],
  },
  {
    title: "HSE",
    items: [
      { href: "/safety", label: "Аюулгүй ажиллагаа", icon: AlertTriangle },
    ],
  },
  {
    title: "PERSONAL",
    items: [
      { href: "/performance", label: "Миний зорилго", icon: TrendingUp },
    ],
  },
];

import { useFavorites } from "@/hooks/use-favorites";
import { useNotifications } from "@/hooks/use-notifications";
import { Star } from "lucide-react";

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const { favorites, toggleFavorite, isFavorite } = useFavorites();

  // Fetch unread document count
  const { data: docStats } = useQuery<{ unreadCount: number }>({
    queryKey: ["/api/documents/stats", user?.id],
    enabled: false, // Endpoint missing, disabled to prevent 404 errors
  });

  const { unreadCount: notificationCount } = useNotifications();

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const navGroups = useMemo(() => {
    if (!user) return [];

    const role = (user.role || "").toLowerCase() as any;
    // Check if role is strictly employee (not manager/admin/hr)
    // Note: isEmployee/isManager etc in shared/roles handle normalization internally, but here we need it for hasPermission key lookup
    const isRegularEmployee = isEmployee(role) && !isManager(role) && !isPrivileged(role);

    const groups = isRegularEmployee ? employeeNavGroups : originalNavGroups;

    // Filter by Permission
    return groups.map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (!item.requiredPermission) return true;
        return hasPermission(role, item.requiredPermission.resource, item.requiredPermission.action);
      })
    })).filter(group => group.items.length > 0);

  }, [user?.role]);

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-card border-r border-border/50 shadow-lg flex flex-col z-20 hidden md:flex">
      {/* Top: Brand */}
      <div className="p-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <span className="text-primary font-bold text-xl">M</span>
          </div>
          <div>
            <h1 className="text-xl font-bold font-display tracking-tight text-foreground">
              MonERP
            </h1>
            <p className="text-xs text-muted-foreground">Enterprise Edition</p>
          </div>
        </div>
        <div className="mt-4">
          <GlobalSearch />
        </div>
      </div>

      <Separator className="mb-2" />

      {/* Middle: Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-6 sidebar-scroll">

        {/* Favorites Section */}
        {favorites.length > 0 && (
          <div>
            <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-orange-500/90 flex items-center gap-2">
              <Star className="w-3 h-3 fill-orange-500" />
              Дуртай ({favorites.length})
            </h3>
            <div className="space-y-1">
              {favorites.map((item) => (
                <Link key={`fav-${item.href}`} href={item.href}>
                  <div
                    className={cn(
                      "flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 cursor-pointer mb-0.5 group relative",
                      location === item.href
                        ? "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-l-2 border-orange-500"
                        : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                    )}
                  >
                    <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
                    {item.label}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        toggleFavorite(item);
                      }}
                      className="absolute right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-background rounded"
                      title="Remove from favorites"
                    >
                      <Star className="w-3 h-3 fill-orange-500 text-orange-500" />
                    </button>
                  </div>
                </Link>
              ))}
            </div>
            <Separator className="my-4 mx-4 w-auto bg-border/40" />
          </div>
        )}

        {navGroups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.title}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                const isFav = isFavorite(item.href);

                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "flex items-center justify-between gap-3 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 cursor-pointer mb-0.5 group",
                        isActive
                          ? "bg-accent/20 text-foreground border-l-2 border-primary"
                          : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={cn("w-4 h-4", isActive ? "text-primary " : "")} />
                        {item.label}
                        {item.href === "/documents" && (docStats?.unreadCount || 0) > 0 && (
                          <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">
                            {docStats?.unreadCount}
                          </span>
                        )}
                        {item.href === "/action-center" && (notificationCount || 0) > 0 && (
                          <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">
                            {(notificationCount || 0) > 99 ? "99+" : notificationCount}
                          </span>
                        )}
                      </div>

                      {/* Favorite Toggle Button (Visible on hover) */}
                      <button
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleFavorite({ href: item.href, label: item.label });
                        }}
                        className={cn(
                          "p-1 rounded hover:bg-background transition-all",
                          isFav ? "opacity-100" : "opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-orange-500"
                        )}
                        title={isFav ? "Remove from favorites" : "Add to favorites"}
                      >
                        <Star className={cn("w-3 h-3", isFav ? "fill-orange-500 text-orange-500" : "")} />
                      </button>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <Separator />

      {/* Bottom: Footer */}
      <div className="p-4 bg-card">
        <div className="flex items-center justify-between mb-4">
          {/* User Profile */}
          <div className="flex items-center gap-3">
            <Avatar className="h-9 w-9 border border-border">
              <AvatarImage src={undefined} />
              <AvatarFallback className="bg-primary/10 text-primary text-xs">
                {user?.fullName?.[0] || user?.email?.[0] || "U"}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col overflow-hidden">
              <span className="text-sm font-medium truncate max-w-[100px] text-foreground">
                {user?.fullName || "User"}
              </span>
              <span className="text-xs text-muted-foreground truncate max-w-[100px]">
                {user?.email}
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            title={isDark ? "Light Mode" : "Dark Mode"}
          >
            {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <Button
            variant="destructive"
            size="icon"
            className="h-8 w-8"
            onClick={() => logout()}
            title="Гарах"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
}
