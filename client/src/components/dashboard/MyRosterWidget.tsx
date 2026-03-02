
import React from "react";
import { useMyRoster, useRosters, useShifts } from "@/hooks/use-roster";
import { useQuery } from "@tanstack/react-query";
import { format, addDays, startOfToday, differenceInCalendarDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CalendarClock, Sun, Moon, Coffee } from "lucide-react";
import { cn } from "@/lib/utils";

export default function MyRosterWidget() {
    const today = startOfToday();
    const nextWeek = addDays(today, 6);

    // 1. Get My Assignments
    const { data: myAssignments, isLoading } = useMyRoster({
        from: format(today, "yyyy-MM-dd"),
        to: format(nextWeek, "yyyy-MM-dd")
    });

    const currentAssignment = myAssignments?.[0]; // Assume single active assignment for now

    // 2. Fetch dependencies if we have an assignment
    const { rostersQuery } = useRosters();
    const { shiftsQuery } = useShifts();

    // 3. Fetch Pattern if needed
    // Hook call must be unconditional, but we can pass null to skip
    const rosterId = currentAssignment?.rosterId;

    const { data: rosterDays } = useQuery({
        queryKey: ["rosterDays", rosterId],
        queryFn: async () => {
            const res = await fetch(`/api/rosters/${rosterId}/days`);
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        enabled: !!rosterId
    });

    const activeRoster = rostersQuery.data?.find(r => r.id === rosterId);

    if (isLoading) return <Skeleton className="h-[200px] w-full" />;

    if (!currentAssignment || !activeRoster || !rosterDays) {
        return (
            <Card className="h-full">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <CalendarClock className="h-5 w-5 text-muted-foreground" />
                        My Schedule
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col items-center justify-center h-[120px] text-muted-foreground/80">
                        <p>No active roster assigned.</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    // Compute Schedule for next 7 days
    const schedule = Array.from({ length: 7 }).map((_, i) => {
        const date = addDays(today, i);
        const diff = differenceInCalendarDays(date, new Date(currentAssignment.startDate));
        const dayIndex = diff % activeRoster.cycleDays;
        // Handle negative modulo if needed (but diff should be positive if assignment started in past)
        const normalizedIndex = dayIndex < 0 ? (dayIndex + activeRoster.cycleDays) : dayIndex;

        const pattern = rosterDays.find((d: any) => d.dayIndex === normalizedIndex);
        const shift = pattern?.shiftId ? shiftsQuery.data?.find(s => s.id === pattern.shiftId) : null;

        return {
            date,
            isOff: pattern?.isOff,
            shift
        };
    });

    const todayStatus = schedule[0];

    return (
        <Card className="h-full overflow-hidden">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <CalendarClock className="h-5 w-5 text-primary" />
                        My Schedule
                    </CardTitle>
                    <Badge variant="outline">{activeRoster.name}</Badge>
                </div>
            </CardHeader>
            <CardContent>
                {/* Today's Big Status */}
                <div className="mb-6 flex items-center justify-between bg-slate-50 p-4 rounded-lg border">
                    <div>
                        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider mb-1">Today</p>
                        <div className="flex items-center gap-3">
                            {todayStatus.isOff ? (
                                <>
                                    <Coffee className="h-8 w-8 text-slate-400" />
                                    <span className="text-2xl font-bold text-slate-600">Off Duty</span>
                                </>
                            ) : todayStatus.shift ? (
                                <>
                                    {todayStatus.shift.endMinutes < todayStatus.shift.startMinutes ? (
                                        <Moon className="h-8 w-8 text-indigo-500" />
                                    ) : (
                                        <Sun className="h-8 w-8 text-orange-500" />
                                    )}
                                    <div>
                                        <span className="text-2xl font-bold block leading-none">{todayStatus.shift.name}</span>
                                        <span className="text-sm text-muted-foreground">
                                            {formatTime(todayStatus.shift.startMinutes)} - {formatTime(todayStatus.shift.endMinutes)}
                                        </span>
                                    </div>
                                </>
                            ) : (
                                <span className="text-xl font-bold text-slate-400">Unknown</span>
                            )}
                        </div>
                    </div>
                    <div className="text-right">
                        <p className="text-3xl font-thin text-slate-900">{format(today, "d")}</p>
                        <p className="text-sm text-muted-foreground uppercase">{format(today, "MMM")}</p>
                    </div>
                </div>

                {/* Next Days Strip */}
                <div className="flex justify-between gap-1 overflow-x-auto pb-2">
                    {schedule.slice(1).map((day, idx) => (
                        <div key={idx} className="flex flex-col items-center gap-2 min-w-[3.5rem]">
                            <span className="text-xs font-medium text-muted-foreground">{format(day.date, "EEE")}</span>
                            <div className={cn(
                                "h-10 w-10 rounded-full flex items-center justify-center border-2",
                                day.isOff ? "border-slate-200 bg-slate-50 text-slate-400" :
                                    day.shift ? "border-primary/20 bg-primary/5 text-primary font-bold" : "border-transparent"
                            )}>
                                {day.isOff ? <Coffee className="h-4 w-4" /> : format(day.date, 'd')}
                            </div>
                            {day.shift && (
                                <span className="text-[10px] truncate max-w-full text-center">{day.shift.name}</span>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
            {/* Hotfix: View Full Link */}
            <div className="bg-slate-50 p-2 text-center text-xs border-t">
                <a href={isManager ? "/manager/rosters/calendar" : "/me/roster"} className="text-primary hover:underline font-medium">
                    View Full Roster &rarr;
                </a>
            </div>
        </Card>
    );
}

// Add simple helper for roles since we don't have hook in this file easily
const isManager = false; // Placeholder, real link routing handled by App.tsx or useAuth


function formatTime(minutes: number) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}
