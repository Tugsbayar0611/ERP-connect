
import React, { useState, useMemo } from "react";
import { useRosters, useShifts, useRosterAssignments, useRosterTemplate } from "@/hooks/use-roster";
import { useDepartments } from "@/hooks/use-departments";
import { useQuery, useQueries } from "@tanstack/react-query";
import { format, startOfWeek, endOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, differenceInCalendarDays } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, User, Filter } from "lucide-react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { AssignRosterDialog } from "@/components/roster/AssignRosterDialog";

// Helper to compute schedule
// In Phase 1 MVP, we compute this on client side:
// 1. Get Employee's assignment (rosterId, startDate)
// 2. Get Roster Pattern
// 3. Calculate: (TargetDate - AssignmentStart) % Cycle = DayIndex
// 4. Look up DayIndex in Pattern -> Shift or Off
function computeShiftForDate(
    date: Date,
    assignment: any,
    roster: any,
    pattern: Record<number, any>,
    shiftsMap: Record<string, any>
) {
    if (!assignment || !roster) return null;

    const startDate = new Date(assignment.startDate);
    const diff = differenceInCalendarDays(date, startDate);

    // If date is before assignment start, no shift
    if (diff < 0) return null;

    // Check end date
    if (assignment.endDate) {
        const endDate = new Date(assignment.endDate);
        if (date > endDate) return null;
    }

    const dayIndex = diff % roster.cycleDays;
    const patternDay = pattern[dayIndex];

    if (!patternDay) return null; // Should not happen if pattern is complete

    if (patternDay.isOff) {
        return { type: "OFF" };
    }

    if (patternDay.shiftId && shiftsMap[patternDay.shiftId]) {
        return { type: "SHIFT", shift: shiftsMap[patternDay.shiftId] };
    }

    return null;
}

export default function RosterCalendar() {
    const [viewMode, setViewMode] = useState<"week" | "month">("week");
    const [currentDate, setCurrentDate] = useState(new Date());
    const [isAssignOpen, setIsAssignOpen] = useState(false);
    const [selectedDepartmentId, setSelectedDepartmentId] = useState<string>("all");

    // Fetch Departments for Filter
    const { departments } = useDepartments();

    // Date Range
    const { start, end } = useMemo(() => {
        if (viewMode === "week") {
            return { start: startOfWeek(currentDate, { weekStartsOn: 1 }), end: endOfWeek(currentDate, { weekStartsOn: 1 }) };
        } else {
            return { start: startOfMonth(currentDate), end: endOfMonth(currentDate) };
        }
    }, [viewMode, currentDate]);

    const days = eachDayOfInterval({ start, end });

    // 1. Fetch Basic Data
    const { rostersQuery } = useRosters();
    const { shiftsQuery } = useShifts();

    // 2. Fetch Assignments for range
    const { data: assignments, isLoading: loadingAssignments } = useRosterAssignments({
        from: format(start, "yyyy-MM-dd"),
        to: format(end, "yyyy-MM-dd"),
        scope: "team", // Placeholder scope
        departmentId: selectedDepartmentId === "all" ? undefined : selectedDepartmentId
    });

    // 3. Fetch Patterns for relevant rosters (Optimization: Fetch all patterns for active rosters?)
    // For MVP, let's fetch pattern for the visible rosters. 
    // In a real app we might want a bulk pattern endpoint or embed it.
    // For now, let's just trigger fetches for all rosters found in assignments? 
    // Or just rely on the fact that we might need `useQueries`.
    // Let's implement a naive fetcher inside useMemo or a separate component?
    // Simpler: Fetch all roster patterns. 
    // Since we don't have a bulk fetch for patterns, we will just fetch the one we need when clicking details 
    // OR we can make a "compute" helper that expects patterns to be loaded.

    // Actually, to render the calendar ACCURATELY, we need the patterns loaded.
    // We can add `GET /api/rosters/:id/days` calls.
    // Limitation: We can't easily call hooks in loops.
    // Workaround for MVP:
    // We will only render "On Shift" counts if we have the data.
    // Let's create a custom hook that fetches patterns for a list of roster IDs?

    // Alternative Strategy for MVP Phase 1:
    // Just show WHO is assigned to WHICH roster. 
    // Calculating exact shift (Day/Night) requires the pattern.
    // Let's try to fetch patterns for all rosters (assuming low count of rosters < 10).
    // 3. Prepare Maps for fast lookup
    const shiftsMap = useMemo(() => {
        return (shiftsQuery.data || []).reduce((acc: any, s: any) => {
            acc[s.id] = s;
            return acc;
        }, {});
    }, [shiftsQuery.data]);

    const rostersMap = useMemo(() => {
        return (rostersQuery.data || []).reduce((acc: any, r: any) => {
            acc[r.id] = r;
            return acc;
        }, {});
    }, [rostersQuery.data]);

    // 4. Load Patterns (Naive fetch for MVP - improvement over individual fetch)
    // We assume we have a hook or we just fetch details for displayed assignments.
    // Ideally we need `useRosterPatterns(rosterIds)`.
    // For Hotfix MVP, let's assume we fetch days for ALL relevant rosters. 
    // Since we can't easily do `useQueries` conditionally in this generated block without growing file size significantly,
    // let's assume valid patterns are fetched via a new side-effect or we use a simplified approach:
    // We will use `useQuery` to fetch ALL roster days (if we have an endpoint) OR just single roster if selected.
    // WAIT: The user script implies we have `rosterDaysByRosterId`. 
    // Let's implement a `useRosterDaysMultiple(rosterIds)` fast-fetcher or just fetch all for now.
    // Since we don't have that endpoint, let's assume we rely on what we have.
    // Hack: We'll skip the pattern fetch improvement for a second and assume we have a `patterns` object 
    // populated by a separate effect or just fetch ALL patterns if count is small.
    // Actually, `useRosterTemplate(id)` fetches single.
    // Let's rely on standard `useQuery` with mapped fetches.

    // NEW: Fetch all patterns for active assignments
    const activeRosterIds = useMemo(() => {
        if (!assignments) return [];
        return Array.from(new Set(assignments.map((a: any) => a.rosterId)));
    }, [assignments]);

    // This is a bit "heavy" for React hooks rules (looping hooks), but for < 10 rosters it's okay-ish if stable.
    // Better: <RosterPatternFetcher ids={activeRosterIds} onLoaded={...} />
    // Or just one `useQuery` that fetches ALL patterns: `GET /api/rosters/patterns` (doesn't exist).

    // Let's use the USER PROVIDED logic which implies we have the data.
    // I will add a `useQueries` block to fetch patterns for all activeRosterIds.
    // Note: I need to import `useQueries` from top.

    const rosterPatternsQueries = useQueries({
        queries: activeRosterIds.map(id => ({
            queryKey: ["rosterDays", id],
            queryFn: async () => {
                const res = await fetch(`/api/rosters/${id}/days`);
                if (!res.ok) throw new Error("Failed");
                return res.json();
            },
            staleTime: 1000 * 60 * 5 // 5 min cache
        }))
    });

    const rosterPatternsMap = useMemo(() => {
        const map: Record<string, Record<number, any>> = {};
        rosterPatternsQueries.forEach((q: any, idx: number) => {
            if (q.data) {
                const rId = activeRosterIds[idx];
                map[rId as string] = q.data.reduce((dAcc: any, d: any) => {
                    dAcc[d.dayIndex] = d;
                    return dAcc;
                }, {});
            }
        });
        return map;
    }, [rosterPatternsQueries, activeRosterIds]);


    // 5. Compute Coverage per Day
    const coverageByDay = useMemo(() => {
        // We now store detailed lists instead of just counts
        // Structure: { day: Employee[], night: Employee[], off: Employee[], pending: Employee[] }
        const map = new Map<string, {
            day: any[],
            night: any[],
            off: any[],
            pending: any[] // was 'unknown'
        }>();

        if (!assignments) return map;

        days.forEach(day => {
            const dateKey = format(day, "yyyy-MM-dd");
            let stats = { day: [] as any[], night: [] as any[], off: [] as any[], pending: [] as any[] };

            // Find valid assignments for this day
            const activeForDay = assignments.filter((a: any) => {
                const start = new Date(a.startDate);
                const end = a.endDate ? new Date(a.endDate) : new Date("2100-01-01"); // Infinity
                const date = new Date(dateKey); // Normalize to midnight
                return date >= start && date <= end;
            });

            activeForDay.forEach((assignment: any) => {
                // Formatting Name: L.FirstName
                const name = `${(assignment.lastName || "").charAt(0)}.${assignment.firstName || "User"}`;
                const employeeInfo = { ...assignment, displayName: name };

                const roster = rostersMap[assignment.rosterId];
                if (!roster) {
                    stats.pending.push(employeeInfo);
                    return;
                }

                const pattern = rosterPatternsMap[assignment.rosterId];
                if (!pattern) {
                    stats.pending.push(employeeInfo); // Pattern not loaded yet
                    return;
                }

                const startDate = new Date(assignment.startDate);
                const diff = differenceInCalendarDays(new Date(dateKey), startDate);
                const dayIndex = diff % roster.cycleDays;
                // Handle negative modulo correctly
                const normalizedIndex = dayIndex < 0 ? (dayIndex + roster.cycleDays) : dayIndex;

                const dayData = pattern[normalizedIndex];

                if (!dayData) {
                    stats.pending.push(employeeInfo); // Pattern incomplete
                } else if (dayData.isOff) {
                    stats.off.push(employeeInfo);
                } else {
                    const shift = shiftsMap[dayData.shiftId];
                    if (shift) {
                        if (shift.endMinutes < shift.startMinutes) {
                            stats.night.push(employeeInfo);
                        } else {
                            stats.day.push(employeeInfo);
                        }
                    } else {
                        stats.pending.push(employeeInfo);
                    }
                }
            });

            map.set(dateKey, stats);
        });

        return map;
    }, [days, assignments, rostersMap, rosterPatternsMap, shiftsMap]);

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <h2 className="text-3xl font-bold tracking-tight">Ээлжийн хуанли</h2>
                    <div className="flex items-center border rounded-md bg-background">
                        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'week' ? -7 : -30))}>
                            <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="px-4 font-medium min-w-[140px] text-center">
                            {format(currentDate, viewMode === 'week' ? "MMM yyyy ('7 хоног' w)" : "MMMM yyyy")}
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setCurrentDate(addDays(currentDate, viewMode === 'week' ? 7 : 30))}>
                            <ChevronRight className="h-4 w-4" />
                        </Button>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Select value={viewMode} onValueChange={(v: any) => setViewMode(v)}>
                        <SelectTrigger className="w-[120px]">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="week">7 хоног</SelectItem>
                            <SelectItem value="month">Сар</SelectItem>
                        </SelectContent>
                    </Select>
                    <Select value={selectedDepartmentId} onValueChange={setSelectedDepartmentId}>
                        <SelectTrigger className="w-[180px]">
                            <Filter className="mr-2 h-4 w-4" />
                            <SelectValue placeholder="Баг шүүх" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Бүгд</SelectItem>
                            {departments.map((dept) => (
                                <SelectItem key={dept.id} value={dept.id}>
                                    {dept.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={() => setIsAssignOpen(true)}>
                        <User className="mr-2 h-4 w-4" />
                        Ээлж оноох
                    </Button>
                </div>
            </div>

            <Card className="flex-1 min-h-0 bg-background/50 border-border">
                <CardContent className="p-0 h-full flex flex-col">
                    {/* Header Row */}
                    <div className="grid grid-cols-7 border-b bg-muted/40 text-muted-foreground">
                        {days.slice(0, 7).map((day, i) => (
                            <div key={i} className="p-4 text-center border-r last:border-r-0">
                                <span className="text-sm font-medium text-muted-foreground">{format(day, "EEE")}</span>
                            </div>
                        ))}
                    </div>

                    {/* Calendar Grid */}
                    <div className={cn("grid grid-cols-7 flex-1 auto-rows-fr", viewMode === "month" ? "" : "h-full")}>
                        {days.map((day, idx) => {
                            const isToday = isSameDay(day, new Date());

                            // Count assignments active on this day
                            const dateKey = format(day, "yyyy-MM-dd");
                            const stats = coverageByDay.get(dateKey) || { day: [] as any[], night: [] as any[], off: [] as any[], pending: [] as any[] };

                            return (
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <div
                                            className={cn(
                                                "border-b border-r bg-background p-2 min-h-[100px] transition-colors hover:bg-muted/50 relative cursor-pointer group",
                                                isToday && "bg-accent/10"
                                            )}
                                        >
                                            <div className="flex justify-between items-start mb-1">
                                                <span className={cn(
                                                    "text-xs font-semibold h-6 w-6 flex items-center justify-center rounded-full",
                                                    isToday ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                                                )}>
                                                    {format(day, "d")}
                                                </span>
                                            </div>

                                            <div className="space-y-1.5">
                                                {/* Day Shift */}
                                                {stats.day.length > 0 && (
                                                    <div className="rounded bg-amber-50 border border-amber-100 p-1">
                                                        <div className="text-[10px] font-bold text-amber-700 flex justify-between mb-0.5">
                                                            <span>Day</span> <span>{stats.day.length}</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {stats.day.slice(0, 2).map((emp: any, i: number) => (
                                                                <div key={i} className="text-[9px] bg-white/80 px-1 rounded text-amber-900 truncate max-w-[60px]">
                                                                    {emp.displayName}
                                                                </div>
                                                            ))}
                                                            {stats.day.length > 2 && (
                                                                <div className="text-[9px] text-amber-600 px-0.5">+{stats.day.length - 2}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Night Shift */}
                                                {stats.night.length > 0 && (
                                                    <div className="rounded bg-indigo-50 border border-indigo-100 p-1">
                                                        <div className="text-[10px] font-bold text-indigo-700 flex justify-between mb-0.5">
                                                            <span>Night</span> <span>{stats.night.length}</span>
                                                        </div>
                                                        <div className="flex flex-wrap gap-1">
                                                            {stats.night.slice(0, 2).map((emp: any, i: number) => (
                                                                <div key={i} className="text-[9px] bg-white/80 px-1 rounded text-indigo-900 truncate max-w-[60px]">
                                                                    {emp.displayName}
                                                                </div>
                                                            ))}
                                                            {stats.night.length > 2 && (
                                                                <div className="text-[9px] text-indigo-600 px-0.5">+{stats.night.length - 2}</div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Pending */}
                                                {stats.pending.length > 0 && (
                                                    <div className="rounded bg-slate-100 border border-slate-200 p-1 border-dashed">
                                                        <div className="text-[10px] font-bold text-slate-500 flex justify-between mb-0.5">
                                                            <span>Pending</span> <span>{stats.pending.length}</span>
                                                        </div>
                                                        {stats.pending.slice(0, 2).map((emp: any, i: number) => (
                                                            <div key={i} className="text-[9px] text-slate-500 truncate">
                                                                • {emp.displayName}
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-80 p-0" align="start">
                                        <div className="p-3 border-b bg-muted/40 font-semibold">
                                            {format(day, "MMMM d, yyyy")}
                                        </div>
                                        <div className="p-2 space-y-4 max-h-[300px] overflow-y-auto">
                                            {stats.day.length > 0 && (
                                                <div>
                                                    <h4 className="text-xs font-bold text-amber-700 uppercase mb-2">Day Shift ({stats.day.length})</h4>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {stats.day.map((emp: any) => (
                                                            <div key={emp.employeeId} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted">
                                                                <Avatar className="h-6 w-6">
                                                                    <AvatarFallback className="text-[9px] bg-amber-100 text-amber-700">
                                                                        {emp.firstName?.[0]}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <span className="text-sm truncate">{emp.displayName}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {stats.night.length > 0 && (
                                                <div>
                                                    <h4 className="text-xs font-bold text-indigo-700 uppercase mb-2">Night Shift ({stats.night.length})</h4>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        {stats.night.map((emp: any) => (
                                                            <div key={emp.employeeId} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-muted">
                                                                <Avatar className="h-6 w-6">
                                                                    <AvatarFallback className="text-[9px] bg-indigo-100 text-indigo-700">
                                                                        {emp.firstName?.[0]}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <span className="text-sm truncate">{emp.displayName}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {stats.pending.length > 0 && (
                                                <div>
                                                    <h4 className="text-xs font-bold text-slate-500 uppercase mb-2">Pending / No Pattern ({stats.pending.length})</h4>
                                                    <div className="grid grid-cols-1 gap-1">
                                                        {stats.pending.map((emp: any) => (
                                                            <div key={emp.employeeId} className="flex items-center gap-2 p-1.5 rounded-md hover:bg-red-50 text-red-600">
                                                                <Filter className="h-3 w-3" />
                                                                <span className="text-sm">{emp.displayName}</span>
                                                                <span className="text-[10px] ml-auto opacity-70">Check Roster Pattern</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}

                                            {stats.off.length > 0 && (
                                                <div className="pt-2 border-t mt-2">
                                                    <div className="text-xs text-muted-foreground">
                                                        Off: {stats.off.map((e: any) => e.displayName).join(", ")}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </PopoverContent>
                                </Popover>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            <AssignRosterDialog open={isAssignOpen} onOpenChange={setIsAssignOpen} />
        </div>
    );
}
