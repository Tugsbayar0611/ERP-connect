import { useState } from "react";
import { Link, useLocation } from "wouter";
import { 
  Menu, 
  Users, 
  Building2, 
  CalendarCheck, 
  CreditCard, 
  FileText, 
  LayoutDashboard, 
  LogOut, 
  Settings, 
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
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

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

// Grouped navigation (same as Sidebar)
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

export function MobileNav() {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    navGroups.forEach((group) => {
      const isActive = group.items.some((item) => item.href === location);
      initial[group.title] = isActive || group.defaultOpen || false;
    });
    return initial;
  });

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
    <div className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 sidebar-gradient rounded-xl flex items-center justify-center shadow-md">
          <span className="text-white font-bold text-lg">М</span>
        </div>
        <h1 className="text-xl font-bold font-display tracking-tight bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">MonERP</h1>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="hover:bg-muted">
            <Menu className="w-6 h-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 flex flex-col w-72 glass-card">
          {/* Header */}
          <div className="sidebar-gradient p-5">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
                <span className="text-white font-bold text-2xl">М</span>
              </div>
              <div>
                <h1 className="text-xl font-bold font-display tracking-tight text-white">MonERP</h1>
                <p className="text-xs text-white/70">Бизнесийн удирдлага</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {navGroups.map((group) => {
              const isOpen = openGroups[group.title] ?? group.defaultOpen;
              const hasActiveItem = group.items.some((item) => item.href === location);
              const GroupIcon = group.icon;

              return (
                <Collapsible
                  key={group.title}
                  open={isOpen}
                  onOpenChange={() => toggleGroup(group.title)}
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
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = location === item.href;

                      return (
                        <Link key={item.href} href={item.href}>
                          <div
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-200 cursor-pointer",
                              isActive
                                ? "bg-gradient-to-r from-primary/15 to-accent/10 text-primary font-medium shadow-sm border border-primary/20"
                                : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
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

          {/* Footer */}
          <div className="p-3 border-t border-border space-y-1">
            <button
              onClick={toggleTheme}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all cursor-pointer"
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {isDark ? "Гэрэлтэй горим" : "Харанхуй горим"}
            </button>

            <Link href="/settings">
              <div
                onClick={() => setOpen(false)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted/50 hover:text-foreground transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                Тохиргоо
              </div>
            </Link>

            <button
              onClick={() => {
                logout();
                setOpen(false);
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-all"
            >
              <LogOut className="w-4 h-4" />
              Гарах
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
