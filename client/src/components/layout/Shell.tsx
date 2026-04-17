import { Sidebar } from "./Sidebar";
import { MobileNav } from "./MobileNav";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { useState, useEffect } from "react";
import { KeyboardShortcutsDialog } from "@/components/keyboard-shortcuts-dialog";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { PasswordChangeModal } from "@/components/PasswordChangeModal";

export function Shell({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const [location] = useLocation();
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showPasswordChange, setShowPasswordChange] = useState(false);

  // Check if user needs to change password
  useEffect(() => {
    if (user && (user as any).mustChangePassword) {
      setShowPasswordChange(true);
    }
  }, [user]);

  // Global keyboard shortcuts
  useKeyboardShortcuts([
    {
      key: "/",
      ctrlKey: true,
      action: () => setShowShortcuts(true),
      description: "Гарны товчлуурууд харуулах",
      enabled: !!user,
    },
  ]);

  // If loading or on login page, render children directly (Login page handles layout itself)
  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;

  if (!user || location === "/login") {
    return <>{children}</>;
  }

  // Global shortcuts list for help dialog
  const globalShortcuts = [
    {
      keys: ["Ctrl + /"],
      description: "Гарны товчлуурууд харуулах",
      category: "Ерөнхий",
    },
    {
      keys: ["Ctrl + B"],
      description: "Хажуу цэсийг нээх/хаах",
      category: "Ерөнхий",
    },
    {
      keys: ["Ctrl + K"],
      description: "Хайх (хуудасны дагуу)",
      category: "Ерөнхий",
    },
    {
      keys: ["Ctrl + N"],
      description: "Шинэ бичлэг нэмэх (хуудасны дагуу)",
      category: "Ерөнхий",
    },
    {
      keys: ["Esc"],
      description: "Dialog/Modal хаах",
      category: "Ерөнхий",
    },
  ];

  return (
    <>
      <div className="min-h-screen bg-background flex flex-col md:flex-row">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 md:pl-64">
          <MobileNav />
          <main className="flex-1 p-4 md:p-8 overflow-y-auto animate-in-fade">
            <div className="w-full space-y-8">
              {children}
            </div>
          </main>
        </div>
      </div>
      <KeyboardShortcutsDialog
        open={showShortcuts}
        onOpenChange={setShowShortcuts}
        shortcuts={globalShortcuts}
      />
      <PasswordChangeModal
        open={showPasswordChange}
        isRequired={(user as any)?.mustChangePassword === true}
        onClose={() => setShowPasswordChange(false)}
      />
    </>
  );
}

