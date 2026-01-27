import { Link, useLocation } from "wouter";
import {
  Users,
  Building2,
  CalendarCheck,
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

type NavGroup = {
  title: string;
  items: {
    href: string;
    label: string;
    icon: React.ElementType;
  }[];
};

const navGroups: NavGroup[] = [
  {
    title: "Overview",
    items: [
      { href: "/", label: "Хянах самбар", icon: LayoutDashboard },
      { href: "/reports", label: "Тайлангууд", icon: BarChart3 },
      { href: "/news", label: "Мэдээлэл", icon: Bell },
    ],
  },
  {
    title: "HR & Organization",
    items: [
      { href: "/employees", label: "Ажилтнууд", icon: Users },
      { href: "/departments", label: "Хэлтсүүд", icon: Building2 },
      { href: "/attendance", label: "Ирц бүртгэл", icon: CalendarCheck },
      { href: "/payroll", label: "Цалин", icon: CreditCard },
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
    ],
  },
  {
    title: "Finance",
    items: [
      { href: "/invoices", label: "Нэхэмжлэх", icon: Receipt },
      { href: "/journals", label: "Журналууд", icon: BookMarked },
      { href: "/journal-entries", label: "Журналын бичилт", icon: BookOpen },
      { href: "/accounts", label: "Дансны систем", icon: FileSpreadsheet },
      { href: "/tax-codes", label: "Татварын Кодууд", icon: FileCheck },
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
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-card border-r border-border/50 shadow-lg flex flex-col z-20 hidden md:flex">
      {/* Top: Brand */}
      <div className="p-6">
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
      </div>

      <Separator className="mb-2" />

      {/* Middle: Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-2 space-y-6 sidebar-scroll">
        {navGroups.map((group) => (
          <div key={group.title}>
            <h3 className="mb-2 px-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
              {group.title}
            </h3>
            <div className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;

                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-4 py-2 rounded-md text-sm font-medium transition-colors duration-200 cursor-pointer mb-0.5",
                        isActive
                          ? "bg-accent/20 text-foreground border-l-2 border-primary"
                          : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                      )}
                    >
                      <Icon className={cn("w-4 h-4", isActive ? "text-primary" : "")} />
                      {item.label}
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
