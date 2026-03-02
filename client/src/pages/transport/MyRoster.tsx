import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, differenceInCalendarDays, addDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { useRosterAssignments } from "@/hooks/use-roster";
// Helper to format minutes to HH:mm
const formatTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

interface Shift {
    id: string;
    name: string;
    startMinutes: number;
    endMinutes: number;
}

export default function MyRoster() {
    const { user } = useAuth();
    const [currentDate, setCurrentDate] = useState(new Date());

    // Date Range for the current month view
    const start = startOfMonth(currentDate);
    const end = endOfMonth(currentDate);

    // 1. Fetch My Assignments
    // We can use the specific endpoint /api/rosters/my or filter the general one. 
    // Let's use the generic one filtered by employeeId (available in user context usually, or we use /my)
    // The previous code tried to use generic with employeeId. Let's stick to that if we can get employeeId, 
    // OR use /api/rosters/my if available. usage-roster.ts has useMyRoster!

    // Let's assume useMyRoster exists or we use the generic one.
    // The previous file tried: const employeeId = (user as any)?.employeeId;
    // IF user object doesn't have employeeId (e.g. it's on the employee record), we might need to fetch /me first or use /my endpoint.
    // Let's check use-roster.ts again... it has useMyRoster!

    // Import useMyRoster (I need to update imports if I haven't).
    // Wait, the previous file imports didn't have useMyRoster. I'll add it.

    const { data: assignments = [], isLoading: loadingAssignments } = useQuery<any[]>({
        queryKey: ["/api/rosters/my", { from: start.toISOString(), to: end.toISOString() }],
        queryFn: async () => {
            const res = await fetch(`/api/rosters/my?from=${start.toISOString()}&to=${end.toISOString()}`);
            if (!res.ok) throw new Error("Failed to fetch my roster");
            return res.json();
        }
    });

    // 2. We need the Roster Pattern for the *active* assignment.
    // Assuming normally one active assignment per period.
    // We need to fetch the pattern for the rosterId found in assignments.
    const activeAssignment = assignments[0]; // Simplification: take the first one
    const rosterId = activeAssignment?.rosterId;

    const { data: rosterDays = [], isLoading: loadingPattern } = useQuery<any[]>({
        queryKey: ["rosterDays", rosterId],
        queryFn: async () => {
            if (!rosterId) return [];
            const res = await fetch(`/api/rosters/${rosterId}/days`);
            if (!res.ok) throw new Error("Failed to fetch roster pattern");
            return res.json();
        },
        enabled: !!rosterId
    });

    const { data: shifts = [] } = useQuery<Shift[]>({
        queryKey: ["shifts"],
        queryFn: async () => {
            const res = await fetch("/api/rosters/shifts");
            if (!res.ok) return [];
            return res.json();
        }
    });

    const shiftsMap = useMemo(() => {
        return new Map(shifts.map((s: Shift) => [s.id, s]));
    }, [shifts]);

    const days = eachDayOfInterval({ start, end });

    // Explicitly type the return
    type ShiftResult = { type: "OFF" } | { type: "SHIFT", shift: Shift } | null;

    const getShiftForDay = (date: Date): ShiftResult => {
        if (!activeAssignment || !rosterDays.length) return null;

        // Check if date is within assignment range
        const assignStart = new Date(activeAssignment.startDate);
        const assignEnd = activeAssignment.endDate ? new Date(activeAssignment.endDate) : null;

        if (date < assignStart || (assignEnd && date > assignEnd)) {
            return null;
        }

        // Calculate Pattern Index
        // diff = date - startDate
        // index = diff % cycleLength
        const diff = differenceInCalendarDays(date, assignStart);
        // We need cycle length. usually rosterDays.length OR max(dayIndex) + 1
        // Let's assume rosterDays contains the full cycle.
        // But rosterDays is array of { dayIndex, shiftId, isOff }
        // We need the max dayIndex to know cycle length? Or just count?
        // Usually cycleDays is property of Roster. usage: roster.cycleDays.
        // We don't have the Roster object here, only ID.
        // However, usually rosterDays array covers the cycle. 
        // Let's calculate cycleLength from max dayIndex.
        const maxIndex = rosterDays.reduce((max: number, d: any) => Math.max(max, d.dayIndex), 0);
        const cycleLength = maxIndex + 1; // 0-based index

        if (cycleLength === 0) return null;

        // Modulo logic handles the rotation
        // Assumption: Cycle repeats indefinitely from startDate
        const dayIndex = diff % cycleLength;
        // Handle negative diff if any (though we checked start date)
        const normalizedIndex = dayIndex < 0 ? dayIndex + cycleLength : dayIndex;

        const patternDay = rosterDays.find((d: any) => d.dayIndex === normalizedIndex);

        if (!patternDay) return null; // "Pending" or undefined in pattern

        if (patternDay.isOff) {
            return { type: "OFF" };
        }

        if (patternDay.shiftId) {
            const shift = shiftsMap.get(patternDay.shiftId);
            if (shift) return { type: "SHIFT", shift };
        }

        return null;
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Миний ээлж</h1>
                    <p className="text-muted-foreground">Таны энэ сарын ээлжийн хуваарь</p>
                </div>
                <div className="flex items-center gap-2 border rounded-md bg-background p-1">
                    <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() - 1, 1))}>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="min-w-[120px] text-center font-medium">
                        {format(currentDate, "MMMM yyyy")}
                    </span>
                    <Button variant="ghost" size="icon" onClick={() => setCurrentDate(d => new Date(d.getFullYear(), d.getMonth() + 1, 1))}>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                </div>
            </div>

            <Card>
                <CardContent className="p-0">
                    <div className="grid grid-cols-7 border-b bg-muted/40">
                        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d, i) => (
                            <div key={i} className="p-4 text-center font-medium text-sm text-muted-foreground border-r last:border-r-0">
                                {d}
                            </div>
                        ))}
                    </div>
                    <div className="grid grid-cols-7 auto-rows-[120px]">
                        {days.map((day, i) => {
                            const result = getShiftForDay(day);
                            const isToday = isSameDay(day, new Date());

                            // Adjust grid start for first day of month
                            // Note: getDay() returns 0 for Sunday.
                            // If our grid starts on Mon (1), mapping is:
                            // Sun(0) -> 7, Mon(1) -> 1 ...
                            const dayOfWeek = day.getDay();
                            const gridColumnStart = dayOfWeek === 0 ? 7 : dayOfWeek;
                            const style = i === 0 ? { gridColumnStart } : {};

                            return (
                                <div key={day.toISOString()} style={style} className={cn(
                                    "p-2 border-r border-b relative transition-colors",
                                    isToday ? "bg-accent/10" : "hover:bg-accent/5"
                                )}>
                                    <span className={cn(
                                        "text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full mb-2",
                                        isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                                    )}>
                                        {format(day, "d")}
                                    </span>

                                    {result?.type === "SHIFT" && result.shift ? (
                                        <div className={cn(
                                            "rounded p-2 text-xs font-medium border",
                                            // Mock colors based on name or startMinutes for now as we lack code
                                            result.shift.name.startsWith("Д") ? "bg-amber-100 text-amber-800 border-amber-200" : // Day
                                                result.shift.name.startsWith("Ш") ? "bg-indigo-100 text-indigo-800 border-indigo-200" : // Night
                                                    "bg-slate-100 text-slate-700 border-slate-200"
                                        )}>
                                            <div className="font-bold">{result.shift.name}</div>
                                            <div className="opacity-80">
                                                {formatTime(result.shift.startMinutes)} - {formatTime(result.shift.endMinutes)}
                                            </div>
                                        </div>
                                    ) : result?.type === "OFF" ? (
                                        <div className="h-full flex items-center justify-center">
                                            <span className="text-xs font-bold text-slate-400">AMARNA</span>
                                        </div>
                                    ) : (
                                        <div className="h-full flex items-center justify-center">
                                            {/* Empty or Pending */}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
