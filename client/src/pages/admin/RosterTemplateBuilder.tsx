
import React, { useState, useEffect } from "react";
import { useRoute } from "wouter";
import { useRosterTemplate, useShifts, useRosters, type RosterDayInput } from "@/hooks/use-roster";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Save, Undo2, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export default function RosterTemplateBuilder() {
    const [match, params] = useRoute("/admin/rosters/:id/template");
    const rosterId = params?.id;
    const { toast } = useToast();

    const { shiftsQuery } = useShifts();
    const { rostersQuery } = useRosters();
    const { updateTemplateMutation } = useRosterTemplate(rosterId!);

    // Fetch Existing Days
    const rosterDaysQuery = useQuery({
        queryKey: ["rosterDays", rosterId],
        queryFn: async () => {
            const res = await fetch(`/api/rosters/${rosterId}/days`);
            if (!res.ok) throw new Error("Failed to fetch roster pattern");
            return res.json();
        },
        enabled: !!rosterId
    });

    const roster = rostersQuery.data?.find(r => r.id === rosterId);

    // Local State for Drafting
    const [draftDays, setDraftDays] = useState<Record<number, RosterDayInput>>({});
    const [selectedShiftId, setSelectedShiftId] = useState<string | "OFF" | null>(null);

    // Initialize draft from DB data
    useEffect(() => {
        if (rosterDaysQuery.data) {
            const initialDraft: Record<number, RosterDayInput> = {};
            // Fill draft from DB
            rosterDaysQuery.data.forEach((d: any) => {
                initialDraft[d.dayIndex] = {
                    dayIndex: d.dayIndex,
                    shiftId: d.shiftId,
                    isOff: d.isOff
                };
            });
            setDraftDays(initialDraft);
        }
    }, [rosterDaysQuery.data]);

    // Handle Cell Click
    const handleDayClick = (dayIndex: number) => {
        if (!selectedShiftId) {
            toast({ description: "Select a shift from the palette first", variant: "default" });
            return;
        }

        setDraftDays(prev => ({
            ...prev,
            [dayIndex]: {
                dayIndex,
                shiftId: selectedShiftId === "OFF" ? null : selectedShiftId,
                isOff: selectedShiftId === "OFF"
            }
        }));
    };

    const handleSave = () => {
        if (!roster) return;

        // Validate we have data for all days? Or just send updates?
        // Spec said bulk update. We send the full array based on cycle count.
        const payload: RosterDayInput[] = [];

        for (let i = 0; i < roster.cycleDays; i++) {
            const day = draftDays[i];
            if (day) {
                payload.push(day);
            } else {
                // Default to OFF if missing? Or error?
                // Let's default to OFF to be safe
                payload.push({ dayIndex: i, isOff: true, shiftId: null });
            }
        }

        updateTemplateMutation.mutate(payload);
    };

    if (!roster || shiftsQuery.isLoading || rosterDaysQuery.isLoading) {
        return <div className="flex justify-center p-12"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/admin/rosters">
                        <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
                    </Link>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">{roster.name} Template</h2>
                        <p className="text-muted-foreground">{roster.cycleDays} Day Cycle</p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => rosterDaysQuery.refetch()} disabled={updateTemplateMutation.isPending}>
                        <Undo2 className="mr-2 h-4 w-4" /> Reset
                    </Button>
                    <Button onClick={handleSave} disabled={updateTemplateMutation.isPending}>
                        {updateTemplateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        <Save className="mr-2 h-4 w-4" /> Save Template
                    </Button>
                </div>
            </div>

            <div className="grid grid-cols-12 gap-6 flex-1 min-h-0">
                {/* SIDE PALETTE */}
                <Card className="col-span-3 h-full overflow-auto">
                    <CardHeader>
                        <CardTitle className="text-sm uppercase text-muted-foreground">Palette</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <button
                            onClick={() => setSelectedShiftId("OFF")}
                            className={cn(
                                "w-full p-3 rounded-lg text-left text-sm font-medium border-2 transition-all",
                                selectedShiftId === "OFF" ? "border-slate-900 bg-slate-100" : "border-transparent bg-slate-50 hover:bg-slate-100"
                            )}
                        >
                            <div className="flex items-center justify-between">
                                <span>OFF (Rest Day)</span>
                                <div className="w-3 h-3 rounded-full bg-slate-400"></div>
                            </div>
                        </button>

                        {shiftsQuery.data?.map(shift => (
                            <button
                                key={shift.id}
                                onClick={() => setSelectedShiftId(shift.id)}
                                className={cn(
                                    "w-full p-3 rounded-lg text-left text-sm font-medium border-2 transition-all",
                                    selectedShiftId === shift.id ? "border-primary bg-primary/5" : "border-transparent bg-white hover:bg-slate-50 shadow-sm"
                                )}
                            >
                                <div className="flex items-center justify-between">
                                    <span>{shift.name}</span>
                                    <span className="text-xs text-muted-foreground">
                                        {Math.floor(shift.startMinutes / 60)}:{(shift.startMinutes % 60).toString().padStart(2, '0')}
                                        -
                                        {Math.floor(shift.endMinutes / 60)}:{(shift.endMinutes % 60).toString().padStart(2, '0')}
                                    </span>
                                </div>
                            </button>
                        ))}
                    </CardContent>
                </Card>

                {/* MAIN GRID */}
                <Card className="col-span-9 h-full overflow-auto bg-slate-50/50">
                    <CardContent className="p-6">
                        <div className="grid grid-cols-7 gap-3">
                            {Array.from({ length: roster.cycleDays }).map((_, idx) => {
                                const dayData = draftDays[idx];
                                const shift = dayData?.shiftId ? shiftsQuery.data?.find(s => s.id === dayData.shiftId) : null;
                                const isOff = dayData?.isOff;

                                return (
                                    <div
                                        key={idx}
                                        onClick={() => handleDayClick(idx)}
                                        className={cn(
                                            "aspect-square rounded-xl border p-3 flex flex-col justify-between cursor-pointer transition-all hover:ring-2 hover:ring-ring hover:ring-offset-2 bg-white",
                                            isOff ? "bg-slate-100 border-slate-200" :
                                                shift ? "bg-white border-primary/20 shadow-sm" : "border-dashed border-slate-300"
                                        )}
                                    >
                                        <span className="text-xs font-bold text-muted-foreground">Day {idx + 1}</span>

                                        <div className="text-center">
                                            {isOff ? (
                                                <span className="text-slate-500 font-bold text-lg">OFF</span>
                                            ) : shift ? (
                                                <div className="flex flex-col h-full justify-center">
                                                    <span className="font-semibold text-primary px-1 text-xs truncate mb-1">{shift.name}</span>
                                                    <span className="text-[10px] text-muted-foreground leading-tight whitespace-normal">
                                                        {Math.floor(shift.startMinutes / 60).toString().padStart(2, '0')}:{(shift.startMinutes % 60).toString().padStart(2, '0')}
                                                        {" - "}
                                                        {Math.floor(shift.endMinutes / 60).toString().padStart(2, '0')}:{(shift.endMinutes % 60).toString().padStart(2, '0')}
                                                        {shift.endMinutes < shift.startMinutes && <span className="text-red-500 font-bold ml-0.5" title="Finishes next day">+1</span>}
                                                    </span>
                                                </div>
                                            ) : (
                                                <span className="text-slate-300 text-xs italic">Empty</span>
                                            )}
                                        </div>

                                        <div className="h-1 w-full rounded-full bg-transparent">
                                            {/* Activity indicator or decorative bar */}
                                            {shift && <div className="h-1 w-full rounded-full bg-primary/20"></div>}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
