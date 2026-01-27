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
    { id: "signature", label: "Гарын үсэг", icon: PenTool },
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
    const isAdmin = user?.role === "Admin";

    const filteredItems = settingsItems.filter(
        (item) => !item.adminOnly || isAdmin
    );

    return (
        <aside className="w-64 border-r bg-muted/30 h-full flex-shrink-0">
            <ScrollArea className="h-full">
                <div className="py-4">
                    <div className="px-4 mb-4">
                        <h2 className="text-lg font-semibold">Тохиргоо</h2>
                        <p className="text-sm text-muted-foreground">
                            Системийн тохиргоог удирдах
                        </p>
                    </div>
                    <Separator className="mb-2" />
                    <nav className="space-y-1 px-2">
                        {filteredItems.map((item) => {
                            const Icon = item.icon;
                            const isActive = activeTab === item.id;

                            return (
                                <button
                                    key={item.id}
                                    onClick={() => onTabChange(item.id)}
                                    className={cn(
                                        "w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                                        isActive
                                            ? "bg-primary text-primary-foreground"
                                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                    )}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="flex-1 text-left">{item.label}</span>
                                    {isActive && <ChevronRight className="w-4 h-4" />}
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </ScrollArea>
        </aside>
    );
}
