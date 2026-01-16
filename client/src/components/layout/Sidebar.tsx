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
  Briefcase,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";

// Navigation groups
const navGroups = [
  {
    label: "",
    items: [
      { href: "/", label: "Хянах самбар", icon: LayoutDashboard },
    ],
  },
  {
    label: "Бизнес",
    items: [
      { href: "/products", label: "Бараа", icon: Package },
      { href: "/contacts", label: "Харилцагчид", icon: UserCircle },
      { href: "/sales", label: "Борлуулалт", icon: ShoppingCart },
      { href: "/purchase", label: "Худалдан авалт", icon: ShoppingBag },
      { href: "/inventory", label: "Агуулах", icon: Warehouse },
      { href: "/invoices", label: "Нэхэмжлэх", icon: Receipt },
    ],
  },
  {
    label: "Санхүү",
    items: [
      { href: "/journal-entries", label: "Журналын бичилт", icon: BookOpen },
      { href: "/accounts", label: "Дансны систем", icon: FileSpreadsheet },
      { href: "/journals", label: "Журналууд", icon: BookMarked },
      { href: "/tax-codes", label: "Татварын Кодууд", icon: FileCheck },
      { href: "/reports", label: "Тайлангууд", icon: BarChart3 },
    ],
  },
  {
    label: "Хүний нөөц",
    items: [
      { href: "/employees", label: "Ажилтнууд", icon: Users },
      { href: "/departments", label: "Хэлтсүүд", icon: Building2 },
      { href: "/attendance", label: "Ирц бүртгэл", icon: CalendarCheck },
      { href: "/payroll", label: "Цалин", icon: CreditCard },
    ],
  },
  {
    label: "Бусад",
    items: [
      { href: "/documents", label: "Баримтууд", icon: FileText },
    ],
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    setIsDark(!isDark);
  };

  let itemIndex = 0;

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-card border-r border-border shadow-lg flex flex-col z-20 hidden md:flex">
      {/* Premium Gradient Header */}
      <div className="sidebar-gradient p-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-xl">M</span>
          </div>
          <div>
            <h1 className="text-xl font-bold font-display tracking-tight text-white">
              MonERP
            </h1>
            <p className="text-xs text-white/70">Бизнесийн удирдлага</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navGroups.map((group, groupIndex) => (
          <div key={groupIndex} className={groupIndex > 0 ? "mt-4" : ""}>
            {group.label && (
              <div className="px-3 py-2">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  {group.label}
                </h3>
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const isActive = location === item.href;
                const currentIndex = itemIndex++;

                return (
                  <Link key={item.href} href={item.href}>
                    <div
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer",
                        "animate-slide-up opacity-0",
                        isActive
                          ? "bg-gradient-to-r from-primary/15 to-accent/10 text-primary shadow-sm border border-primary/20"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground hover:translate-x-1"
                      )}
                      style={{ animationDelay: `${currentIndex * 0.03}s`, animationFillMode: 'forwards' }}
                    >
                      <Icon className={cn(
                        "w-4.5 h-4.5 transition-colors duration-200",
                        isActive ? "text-primary" : "text-muted-foreground"
                      )} />
                      <span className="flex-1">{item.label}</span>
                      {isActive && (
                        <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-border space-y-0.5">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
        >
          {isDark ? <Sun className="w-4.5 h-4.5" /> : <Moon className="w-4.5 h-4.5" />}
          {isDark ? "Гэрэлтэй горим" : "Харанхуй горим"}
        </button>

        {/* Settings link */}
        <Link href="/settings">
          <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer">
            <SettingsIcon className="w-4.5 h-4.5" />
            Тохиргоо
          </div>
        </Link>

        {/* Logout */}
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <LogOut className="w-4.5 h-4.5" />
          Гарах
        </button>
      </div>
    </aside>
  );
}
