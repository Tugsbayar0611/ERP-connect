import React from "react";
import { cn } from "@/lib/utils";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
    Building2,
    MapPin,
    PenTool,
    Users,
    Plug,
    Shield,
    User,
    ChevronRight,
    Lock,
    Clock,
    Briefcase,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface SettingsSidebarItem {
    id: string;
    label: string;
    icon: React.ElementType;
    adminOnly?: boolean;
}

const settingsItems: SettingsSidebarItem[] = [
    { id: "profile", label: "Профайл", icon: User },
    { id: "organization", label: "Байгууллага", icon: Building2 },
    { id: "office", label: "Оффис", icon: MapPin },
    { id: "work-hours", label: "Ажлын цаг", icon: Clock },
    { id: "signature", label: "Гарын үсэг", icon: PenTool },
    { id: "job-titles", label: "Албан тушаал", icon: Briefcase },
    { id: "users", label: "Хэрэглэгчид", icon: Users, adminOnly: true },
    { id: "integrations", label: "Интеграц", icon: Plug, adminOnly: true },
    { id: "roles", label: "Эрх & Permissions", icon: Shield, adminOnly: true },
    { id: "security", label: "Аюулгүй байдал", icon: Lock },
];

interface SettingsSidebarProps {
    activeTab: string;
    onTabChange: (tab: string) => void;
}

export function SettingsSidebar({ activeTab, onTabChange }: SettingsSidebarProps) {
    const { user } = useAuth();
    const role = user?.role;
    const isAdmin = role === "Admin";
    const isManager = role === "Manager";
    // Check if simple employee
    const isEmployee = !isAdmin && !isManager;

    const filteredItems = settingsItems.filter((item) => {
        // Admin sees everything
        if (isAdmin) return true;

        // Manager sees most things except admin-only (unless we want to hide some from manager too)
        if (isManager) return !item.adminOnly;

        // Employee sees ONLY Profile and Security (and maybe Signature if needed)
        // User explicitly asked for: Profile, Password (Security), 2FA (Security)
        if (isEmployee) {
            return ["profile", "security", "signature"].includes(item.id);
        }

        return !item.adminOnly;
    });

    return (
        <aside className="w-full lg:w-64 border-b lg:border-b-0 lg:border-r bg-muted/30 flex-shrink-0">
            <ScrollArea className="lg:h-full">
                <div className="py-3 lg:py-4">
                    <div className="px-4 mb-3 lg:mb-4">
                        <h2 className="text-lg font-semibold">Тохиргоо</h2>
                        <p className="hidden sm:block text-sm text-muted-foreground">
                            Системийн тохиргоог удирдах
                        </p>
                    </div>
                    <Separator className="mb-2" />
                    <nav className="flex gap-2 overflow-x-auto px-3 pb-1 lg:block lg:space-y-1 lg:px-2 lg:pb-0">
                        {filteredItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onTabChange(item.id)}
                                    className={cn(
                                        "flex min-h-10 shrink-0 items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors lg:w-full lg:gap-3",
                                        isActive
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <Icon className="w-4 h-4 shrink-0" />
                                    <span className="whitespace-nowrap lg:flex-1 lg:text-left">{item.label}</span>
                                    {isActive && <ChevronRight className="hidden w-4 h-4 lg:block" />}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </ScrollArea>
        </aside>
    );
}
