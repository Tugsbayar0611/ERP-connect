import { useState, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { Menu, LogOut, Settings, Moon, Sun, Star } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/components/theme-provider";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { GlobalSearch } from "./GlobalSearch";
import { useFavorites } from "@/hooks/use-favorites";
import { useNotifications } from "@/hooks/use-notifications";
import { isEmployee, isPrivileged, isManager } from "@shared/roles";
import { hasPermission } from "@shared/permissions";
import { originalNavGroups, employeeNavGroups } from "@/config/navigation";
import { Separator } from "@/components/ui/separator";

export function MobileNav() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  
  const { favorites, toggleFavorite, isFavorite } = useFavorites();
  const { unreadCount: notificationCount } = useNotifications();

  const isDark = theme === "dark" || (theme === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  const navGroups = useMemo(() => {
    if (!user) return [];

    const role = (user.role || "").toLowerCase() as any;
    const isRegularEmployee = isEmployee(role) && !isManager(role) && !isPrivileged(role);
    const groups = isRegularEmployee ? employeeNavGroups : originalNavGroups;

    return groups.map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (!item.requiredPermission) return true;
        return hasPermission(role, item.requiredPermission.resource, item.requiredPermission.action);
      })
    })).filter(group => group.items.length > 0);
  }, [user?.role]);

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
        <SheetContent side="left" className="p-0 flex flex-col w-[300px] glass-card">
          <SheetTitle className="sr-only">Mobile Navigation</SheetTitle>
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
            <div className="mt-4">
              <GlobalSearch onSelect={() => setOpen(false)} />
            </div>
          </div>

          {/* Navigation */}
          <div className="flex-1 overflow-y-auto px-4 py-2 space-y-4">
            
            {/* Favorites */}
            {favorites.length > 0 && (
              <div className="pt-2">
                <h3 className="mb-2 px-2 text-xs font-semibold uppercase tracking-wider text-orange-500/90 flex items-center gap-2">
                  <Star className="w-3 h-3 fill-orange-500" />
                  Дуртай ({favorites.length})
                </h3>
                <div className="space-y-1">
                  {favorites.map((item) => (
                    <Link key={`fav-${item.href}`} href={item.href}>
                      <div
                        onClick={() => setOpen(false)}
                        className={cn(
                          "flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-200 cursor-pointer mb-0.5",
                          location === item.href
                            ? "bg-orange-50 dark:bg-orange-950/30 text-orange-700 dark:text-orange-300 border-l-2 border-orange-500"
                            : "text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <Star className="w-4 h-4 text-orange-500 fill-orange-500" />
                          {item.label}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
                <Separator className="mt-4" />
              </div>
            )}

            {/* Accordion Groups */}
            <Accordion type="multiple" defaultValue={navGroups.map(g => g.title)} className="w-full">
              {navGroups.map((group) => (
                <AccordionItem key={group.title} value={group.title} className="border-b-0">
                  <AccordionTrigger className="hover:no-underline py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                    {group.title}
                  </AccordionTrigger>
                  <AccordionContent className="pb-4 space-y-1">
                    {group.items.map((item) => {
                      const Icon = item.icon;
                      const isActive = location === item.href;
                      const isFav = isFavorite(item.href);

                      return (
                        <Link key={item.href} href={item.href}>
                          <div
                            onClick={() => setOpen(false)}
                            className={cn(
                              "flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 cursor-pointer mb-0.5",
                              isActive
                                ? "bg-accent/20 text-foreground border-l-2 border-primary"
                                : "text-muted-foreground hover:bg-muted hover:text-foreground"
                            )}
                          >
                            <div className="flex items-center gap-3">
                              <Icon className={cn("w-4 h-4", isActive ? "text-primary" : "")} />
                              {item.label}
                              {item.href === "/action-center" && (notificationCount || 0) > 0 && (
                                <span className="ml-2 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center shadow-sm">
                                  {(notificationCount || 0) > 99 ? "99+" : notificationCount}
                                </span>
                              )}
                            </div>
                            {isFav && <Star className="w-3 h-3 text-orange-500 fill-orange-500" />}
                          </div>
                        </Link>
                      );
                    })}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-border space-y-1.5 shrink-0 bg-card">
            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-10"
              onClick={toggleTheme}
            >
              {isDark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              {isDark ? "Гэрэлтэй горим" : "Харанхуй горим"}
            </Button>

            <Link href="/settings">
              <div
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 px-4 py-2 rounded-lg h-10 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-all cursor-pointer"
              >
                <Settings className="w-4 h-4" />
                Тохиргоо
              </div>
            </Link>

            <Button
              variant="ghost"
              className="w-full justify-start gap-3 h-10 text-destructive hover:bg-destructive/10 hover:text-destructive"
              onClick={() => {
                logout();
                setOpen(false);
              }}
            >
              <LogOut className="w-4 h-4" />
              Гарах
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

