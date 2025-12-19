import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();

  // If loading or on login page, render children directly (Login page handles layout itself)
  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  if (!user || location === "/login") {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 md:pl-64">
        <MobileNav />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-in-fade">
          <div className="max-w-7xl mx-auto w-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
