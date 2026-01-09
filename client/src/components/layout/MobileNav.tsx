import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, Users, Building2, CalendarCheck, CreditCard, FileText, LayoutDashboard, LogOut, Settings, Moon, Sun, Package, UserCircle, ShoppingCart, ShoppingBag, Warehouse, Receipt } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { href: "/", label: "Хянах самбар", icon: LayoutDashboard },
  { href: "/products", label: "Бараа", icon: Package },
  { href: "/contacts", label: "Харилцагчид", icon: UserCircle },
  { href: "/sales", label: "Борлуулалт", icon: ShoppingCart },
  { href: "/purchase", label: "Худалдан авалт", icon: ShoppingBag },
  { href: "/inventory", label: "Агуулах", icon: Warehouse },
  { href: "/invoices", label: "Нэхэмжлэх", icon: Receipt },
  { href: "/employees", label: "Ажилтнууд", icon: Users },
  { href: "/departments", label: "Хэлтсүүд", icon: Building2 },
  { href: "/attendance", label: "Ирц бүртгэл", icon: CalendarCheck },
  { href: "/payroll", label: "Цалин", icon: CreditCard },
  { href: "/documents", label: "Баримтууд", icon: FileText },
];

export function MobileNav() {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains("dark"));

  const toggleTheme = () => {
    document.documentElement.classList.toggle("dark");
    setIsDark(!isDark);
  };

  return (
    <div className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border sticky top-0 z-30">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 sidebar-gradient rounded-xl flex items-center justify-center shadow-md">
          <span className="text-white font-bold text-lg">M</span>
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
          <div className="sidebar-gradient p-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <span className="text-white font-bold text-xl">M</span>
              </div>
              <div>
                <h1 className="text-xl font-bold font-display tracking-tight text-white">MonERP</h1>
                <p className="text-xs text-white/70">Бизнесийн удирдлага</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;

              return (
                <Link key={item.href} href={item.href}>
                  <div
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer",
                      isActive
                        ? "bg-gradient-to-r from-primary/15 to-accent/10 text-primary shadow-sm border border-primary/20"
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

          {/* Footer */}
          <div className="p-4 border-t border-border space-y-1.5">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-11"
              onClick={toggleTheme}
            >
              {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              {isDark ? "Гэрэлтэй горим" : "Харанхуй горим"}
            </Button>

            <Link href="/settings">
              <div
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
              >
                <Settings className="w-5 h-5" />
                Тохиргоо
              </div>
            </Link>

            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-11 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                logout();
                setOpen(false);
              }}
            >
              <LogOut className="w-5 h-5" />
              Гарах
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

