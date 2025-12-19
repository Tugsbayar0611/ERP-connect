import { Link, useLocation } from "wouter";
import {
  Users,
  Building2,
  CalendarCheck,
  CreditCard,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { href: "/", label: "Үзүүлэлтийн хүснэгт", icon: LayoutDashboard },
  { href: "/employees", label: "Ажилтнууд", icon: Users },
  { href: "/departments", label: "Хэлтсүүд", icon: Building2 },
  { href: "/attendance", label: "Ирц", icon: CalendarCheck },
  { href: "/payroll", label: "Цалин", icon: CreditCard },
  { href: "/documents", label: "Баримтууд", icon: FileText },
];

export function Sidebar() {
  const [location] = useLocation();
  const { logout } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-card border-r border-border shadow-sm flex flex-col z-20 hidden md:flex">
      <div className="p-6 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">N</span>
          </div>
          <h1 className="text-xl font-bold font-display tracking-tight text-foreground">Nexus ERP</h1>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location === item.href;

          return (
            <Link key={item.href} href={item.href}>
              <div
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer",
                  isActive
                    ? "bg-primary/10 text-primary shadow-sm"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("w-5 h-5", isActive ? "text-primary" : "text-muted-foreground")} />
                {item.label}
              </div>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-border space-y-1">
        <button
          onClick={() => {}} // Navigate to settings if implemented
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all"
        >
          <Settings className="w-5 h-5" />
          Тохиргоо
        </button>
        <button
          onClick={() => logout()}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive/80 hover:bg-destructive/10 hover:text-destructive transition-all"
        >
          <LogOut className="w-5 h-5" />
          Гарах
        </button>
      </div>
    </aside>
  );
}
