import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Menu, X, Users, Building2, CalendarCheck, CreditCard, FileText, LayoutDashboard, LogOut } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/employees", label: "Employees", icon: Users },
  { href: "/departments", label: "Departments", icon: Building2 },
  { href: "/attendance", label: "Attendance", icon: CalendarCheck },
  { href: "/payroll", label: "Payroll", icon: CreditCard },
  { href: "/documents", label: "Documents", icon: FileText },
];

export function MobileNav() {
  const [location] = useLocation();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border sticky top-0 z-30">
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
          <span className="text-primary-foreground font-bold text-lg">N</span>
        </div>
        <h1 className="text-xl font-bold font-display tracking-tight">Nexus ERP</h1>
      </div>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon">
            <Menu className="w-6 h-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="p-0 flex flex-col w-72">
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">N</span>
              </div>
              <h1 className="text-xl font-bold font-display tracking-tight">Nexus ERP</h1>
            </div>
          </div>
          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = location === item.href;

              return (
                <Link key={item.href} href={item.href}>
                  <div
                    onClick={() => setOpen(false)}
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
          <div className="p-4 border-t border-border">
            <Button
              variant="destructive"
              className="w-full justify-start gap-3"
              onClick={() => {
                logout();
                setOpen(false);
              }}
            >
              <LogOut className="w-4 h-4" />
              Logout
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
