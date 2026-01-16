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
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useState, useEffect } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

type NavItem = {
  href: string;
  label: string;
  icon: any;
};

type NavGroup = {
  title: string;
  icon: any;
  items: NavItem[];
  defaultOpen?: boolean;
};

// Grouped navigation
const navGroups: NavGroup[] = [
  {
    title: "Үндсэн",
    icon: LayoutDashboard,
    defaultOpen: true,
    items: [
      { href: "/", label: "Хянах самбар", icon: LayoutDashboard },
    ],
  },
  {
    title: "Худалдаа & Бараа",
    icon: Package,
    defaultOpen: true,
    items: [
      { href: "/products", label: "Бараа материал", icon: Package },
      { href: "/contacts", label: "Харилцагчид", icon: UserCircle },
      { href: "/sales", label: "Борлуулалт", icon: ShoppingCart },
      { href: "/purchase", label: "Худалдан авалт", icon: ShoppingBag },
      { href: "/inventory", label: "Агуулах", icon: Warehouse },
      { href: "/invoices", label: "Нэхэмжлэх", icon: Receipt },
    ],
  },
  {
    title: "Санхүү & Татвар",
    icon: FileSpreadsheet,
    defaultOpen: false,
    items: [
      { href: "/journal-entries", label: "Журналын бичилт", icon: BookOpen },
      { href: "/accounts", label: "Дансны систем", icon: FileSpreadsheet },
      { href: "/journals", label: "Журналууд", icon: BookMarked },
      { href: "/tax-codes", label: "Татварын кодууд", icon: FileCheck },
      { href: "/reports", label: "Тайлангууд", icon: BarChart3 },
    ],
  },
  {
    title: "Хүний нөөц",
    icon: Users,
    defaultOpen: true,
    items: [
      { href: "/employees", label: "Ажилтнууд", icon: Users },
      { href: "/departments", label: "Хэлтэсүүд", icon: Building2 },
      { href: "/attendance", label: "Ирц бүртгэл", icon: CalendarCheck },
      { href: "/payroll", label: "Цалин", icon: CreditCard },
    ],
  },
  {
    title: "Баримт бичиг",
    icon: FileText,
    defaultOpen: false,
    items: [
      { href: "/documents", label: "Баримтууд", icon: FileText },
    ],
  },
];

export function Sidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [isDark, setIsDark] = useState(false);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  useEffect(() => {
    const isDarkMode = document.documentElement.classList.contains("dark");
    setIsDark(isDarkMode);

    // Initialize open groups based on current location
    const initialOpenGroups: Record<string, boolean> = {};
    navGroups.forEach((group) => {
      const isActive = group.items.some((item) => item.href === location);
      initialOpenGroups[group.title] = isActive || group.defaultOpen || false;
    });
    setOpenGroups(initialOpenGroups);
  }, []);

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    setIsDark(!isDark);
  };

  const toggleGroup = (title: string) => {
    setOpenGroups((prev) => ({
      ...prev,
      [title]: !prev[title],
    }));
  };

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-card border-r border-border shadow-lg flex flex-col z-20 hidden md:flex">
      {/* Premium Gradient Header */}
      <div className="sidebar-gradient p-5">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
            <span className="text-white font-bold text-2xl">М</span>
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
        {navGroups.map((group, groupIndex) => {
          const isOpen = openGroups[group.title] ?? group.defaultOpen;
          const hasActiveItem = group.items.some((item) => item.href === location);
          const GroupIcon = group.icon;

          return (
            <Collapsible
              key={group.title}
              open={isOpen}
              onOpenChange={() => toggleGroup(group.title)}
              className="animate-slide-up"
              style={{ animationDelay: `${groupIndex * 0.05}s`, animationFillMode: 'forwards' }}
            >
              <CollapsibleTrigger className="w-full">
                <div
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer group",
                    hasActiveItem
                      ? "bg-primary/5 text-primary"
                      : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                  )}
                >
                  <GroupIcon className={cn(
                    "w-4 h-4 transition-colors",
                    hasActiveItem ? "text-primary" : "text-muted-foreground group-hover:text-foreground"
                  )} />
                  <span className="flex-1 text-left">{group.title}</span>
                  {isOpen ? (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>

              <CollapsibleContent className="pl-4 space-y-0.5 mt-1">
                {group.items.map((item, itemIndex) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;

                  return (
                    <Link key={item.href} href={item.href}>
                      <div
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer",
                          isActive
                            ? "bg-gradient-to-r from-primary/15 to-accent/10 text-primary font-medium shadow-sm border border-primary/20"
                            : "text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:translate-x-1"
                        )}
                      >
                        <Icon className={cn(
                          "w-4 h-4 transition-colors",
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
              </CollapsibleContent>
            </Collapsible>
          );
        })}
      </nav>

      <div className="p-3 border-t border-border space-y-1">
        {/* Theme Toggle */}
        <button
          onClick={toggleTheme}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all cursor-pointer"
        >
          {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {isDark ? "Гэрэлтэй горим" : "Харанхуй горим"}
        </button>

        {/* Settings link */}
        <Link href="/settings">
          <div className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all cursor-pointer">
            <SettingsIcon className="w-4 h-4" />
            Тохиргоо
          </div>
        </Link>

        {/* Logout */}
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <LogOut className="w-4 h-4" />
          Гарах
        </button>
      </div>
    </aside>
  );
}
