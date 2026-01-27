import * as React from "react";
import { Cake, Gift, ExternalLink } from "lucide-react";
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from "@/components/ui/GlassCard";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useLocation } from "wouter";

interface Birthday {
    id: string;
    firstName: string;
    lastName?: string;
    employeeNo?: string;
    birthDate: string;
    position?: string;
}

interface BirthdayWidgetProps {
    birthdays: Birthday[];
    isLoading?: boolean;
}

export function BirthdayWidget({ birthdays, isLoading = false }: BirthdayWidgetProps) {
    const [, setLocation] = useLocation();

    if (isLoading) {
        return (
            <GlassCard>
                <GlassCardHeader>
                    <GlassCardTitle className="flex items-center gap-2">
                        <Cake className="w-5 h-5 text-pink-400" />
                        Өнөөдрийн төрсөн өдөр
                    </GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent>
                    <div className="space-y-3">
                        {[1, 2].map((i) => (
                            <div key={i} className="flex items-center gap-3">
                                <Skeleton className="w-10 h-10 rounded-full" />
                                <div className="flex-1">
                                    <Skeleton className="h-4 w-24 mb-1" />
                                    <Skeleton className="h-3 w-16" />
                                </div>
                            </div>
                        ))}
                    </div>
                </GlassCardContent>
            </GlassCard>
        );
    }

    const hasBirthdays = birthdays && birthdays.length > 0;

    return (
        <GlassCard highlight={hasBirthdays}>
            <GlassCardHeader>
                <div className="flex items-center justify-between w-full">
                    <GlassCardTitle className="flex items-center gap-2">
                        <Cake className="w-5 h-5 text-pink-400" />
                        Өнөөдрийн төрсөн өдөр
                        {hasBirthdays && (
                            <Badge variant="secondary" className="ml-2 bg-pink-500/20 text-pink-300 border-pink-400/30">
                                {birthdays.length}
                            </Badge>
                        )}
                    </GlassCardTitle>
                    {hasBirthdays && (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-pink-400 hover:text-pink-300 hover:bg-pink-500/10"
                            onClick={() => setLocation("/employees")}
                        >
                            <ExternalLink className="w-4 h-4" />
                        </Button>
                    )}
                </div>
            </GlassCardHeader>
            <GlassCardContent>
                {hasBirthdays ? (
                    <div className="space-y-3">
                        {birthdays.map((emp) => (
                            <div
                                key={emp.id}
                                className="flex items-center gap-3 p-2 rounded-lg bg-gradient-to-r from-pink-500/10 to-purple-500/10 border border-pink-400/20"
                            >
                                <Avatar className="w-10 h-10 border-2 border-pink-400/40">
                                    <AvatarFallback className="bg-gradient-to-br from-pink-500 to-purple-500 text-white font-semibold">
                                        {emp.firstName?.[0]}{emp.lastName?.[0]}
                                    </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-sm truncate text-slate-100">
                                        {emp.firstName} {emp.lastName}
                                    </p>
                                    {emp.position && (
                                        <p className="text-xs text-slate-400 truncate">{emp.position}</p>
                                    )}
                                </div>
                                <Gift className="w-5 h-5 text-pink-400 animate-bounce" />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-6">
                        <div className="text-4xl mb-2">🎂</div>
                        <p className="text-sm text-slate-400">Өнөөдөр төрсөн өдөр байхгүй</p>
                    </div>
                )}
            </GlassCardContent>
        </GlassCard>
    );
}
