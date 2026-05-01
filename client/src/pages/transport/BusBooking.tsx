
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trip, Route, Vehicle, SeatReservation } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Loader2, Bus, MapPin, Calendar, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export default function BusBooking() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedTrip, setSelectedTrip] = useState<Trip | null>(null);
    const [selectedSeat, setSelectedSeat] = useState<string | null>(null);

    // Stable date to prevent infinite refetching
    const [queryParams] = useState({ from: new Date().toISOString() });

    // Fetch upcoming trips
    const { data: trips = [], isLoading: tripsLoading } = useQuery<Trip[]>({
        queryKey: ["/api/transport/trips", queryParams],
        queryFn: async ({ queryKey }) => {
            const [_path, params] = queryKey as [string, { from: string }];
            const searchParams = new URLSearchParams();
            if (params.from) searchParams.append("from", params.from);

            const res = await fetch(`${_path}?${searchParams.toString()}`);
            if (!res.ok) {
                if (res.status === 429) throw new Error("Too many requests");
                throw new Error("Failed to fetch trips");
            }
            return res.json();
        }
    });

    const { data: routes = [] } = useQuery<Route[]>({
        queryKey: ["/api/transport/routes"],
    });

    const { data: vehicles = [] } = useQuery<Vehicle[]>({
        queryKey: ["/api/transport/vehicles"],
    });

    // Fetch seat availability when a trip is selected
    const { data: seatData, isLoading: reservationsLoading } = useQuery<{reservations: SeatReservation[], currentEmployeeId: string | null}>({
        queryKey: ["/api/transport/trips", selectedTrip?.id, "seats"],
        enabled: !!selectedTrip,
    });
    
    const reservations = seatData?.reservations || [];
    const currentEmployeeId = seatData?.currentEmployeeId || null;

    const bookMutation = useMutation({
        mutationFn: async () => {
            if (!selectedTrip || !selectedSeat) return;
            const res = await fetch("/api/transport/reservations", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    tripId: selectedTrip.id,
                    seatNumber: selectedSeat,
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/transport/trips", selectedTrip?.id, "seats"] });
            setSelectedTrip(null);
            setSelectedSeat(null);
            toast({ title: "Амжилттай", description: "Суудал амжилттай захиалагдлаа." });
        },
        onError: (err) => {
            const msg = tryParseError(err.message);
            toast({ title: "Алдаа", description: msg, variant: "destructive" });
        },
    });

    const cancelMutation = useMutation({
        mutationFn: async (reservationId: string) => {
            const res = await fetch(`/api/transport/reservations/${reservationId}/cancel`, {
                method: "POST",
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/transport/trips", selectedTrip?.id, "seats"] });
            toast({ title: "Амжилттай", description: "Суудлын захиалга цуцлагдлаа." });
        },
        onError: (err) => {
            const msg = tryParseError(err.message);
            toast({ title: "Алдаа", description: msg, variant: "destructive" });
        },
    });

    const tryParseError = (text: string) => {
        try {
            return JSON.parse(text).message;
        } catch {
            return text;
        }
    }

    // Helpers
    const getRouteName = (id: string) => routes.find(r => r.id === id)?.name || id;
    const getVehicle = (id: string) => vehicles.find(v => v.id === id);

    const getSeatStatus = (seatNum: string) => {
        const res = reservations.find(r => r.seatNumber === seatNum);
        if (res) {
            if (res.passengerId === currentEmployeeId) return { status: "mine", reservation: res };
            return { status: "taken", reservation: res };
        }
        if (seatNum === selectedSeat) return { status: "selected", reservation: null };
        return { status: "available", reservation: null };
    };

    const renderSeatMap = (vehicle: Vehicle) => {
        const capacity = vehicle.capacity;
        // Standard layout logic: 45 seats = 10 cols of 4 + 5 back seats.
        // If not 45, default to simple grid or try to fit this logic.
        // We'll assume standard 4-row layout.

        const standardCols = Math.floor((capacity - 5) / 4);
        const hasBackBench = (capacity - 5) % 4 === 0 && capacity > 5;
        // If math doesn't work perfectly for 45, fallback to simple calculation
        const totalCols = hasBackBench ? standardCols + 1 : Math.ceil(capacity / 4);

        // Helper to generate seat number
        const getSeatNumber = (rowIdx: number, colIdx: number) => {
            // Row 0 (Bottom): 1, 5, 9...
            // Row 1: 2, 6, 10...
            // Row 2: 3, 7, 11...
            // Row 3 (Top): 4, 8, 12...

            if (hasBackBench && colIdx === standardCols) {
                // Back bench logic: 5 seats. 
                // Numbering usually follows sequence. 
                // Let's assume sequential after last standard col.
                // Last standard seat = standardCols * 4.
                // Back seats: +1, +2, +3, +4, +5 from bottom to top?
                // Image shows 43 in middle. 41, 42, 43, 44, 45.
                return standardCols * 4 + (rowIdx + 1);
            }

            return (colIdx * 4) + (rowIdx + 1);
        };

        const renderRow = (rowIdx: number) => {
            const seats = [];
            for (let c = 0; c < (hasBackBench ? standardCols + 1 : totalCols); c++) {
                // Skip if not back bench and out of bounds (for non-standard capacities)
                if (!hasBackBench && c * 4 + rowIdx >= capacity) continue;

                // Back bench handling
                const isBackBenchSeat = hasBackBench && c === standardCols;

                // For back bench, we might have 5 seats, so we need a special row logic?
                // Actually, simpler to just render the grid.

                // If it's the middle row (aisle) and NOT back bench, render empty space
                // We will render 5 physical rows for the visual: Row 1, Row 2, Gap, Row 3, Row 4.
                // But loop is based on logical seat rows 0-3.

                // Let's change approach: Render Columns.
            }
        };

        // Render Columns Approach
        const columns = [];
        for (let c = 0; c < (hasBackBench ? standardCols + 1 : totalCols); c++) {
            const isBackBench = hasBackBench && c === standardCols;
            const colSeats = [];

            // We'll create a vertical stack for each column
            // Visual order: Top (Row 3), Row 2, Aisle, Row 1, Bottom (Row 0)
            // Wait, standard bus is: Window, Aisle, Window? No 2+2 is Window, Window, Aisle, Window, Window.
            // Image: Top Wall -> Seat 4 -> Seat 3 -> Aisle -> Seat 2 -> Seat 1 -> Bottom Wall

            // Seat 4 (Top)
            const s4 = isBackBench ? (standardCols * 4) + 5 : (c * 4) + 4;
            const s3 = isBackBench ? (standardCols * 4) + 4 : (c * 4) + 3;
            const s2 = isBackBench ? (standardCols * 4) + 2 : (c * 4) + 2;
            const s1 = isBackBench ? (standardCols * 4) + 1 : (c * 4) + 1;
            const sMiddle = (standardCols * 4) + 3; // Center seat for back bench

            // Helper to render a single seat button
            const SeatBtn = ({ num }: { num: number }) => {
                const sNum = num.toString();
                const { status, reservation } = getSeatStatus(sNum);
                const isSelected = status === "selected";
                const isTaken = status === "taken";
                const isMine = status === "mine";

                const handleClick = () => {
                    if (isMine && reservation) {
                        if (confirm("Та энэ суудлын захиалгаа цуцлахдаа итгэлтэй байна уу?")) {
                            cancelMutation.mutate(reservation.id);
                        }
                    } else if (!isTaken) {
                        setSelectedSeat(isSelected ? null : sNum);
                    }
                };

                return (
                    <button
                        key={num}
                        disabled={isTaken || cancelMutation.isPending}
                        onClick={handleClick}
                        className={cn(
                            "w-8 h-8 flex items-center justify-center rounded border text-xs font-medium transition-all",
                            isMine ? "bg-green-100 border-green-500 text-green-700 hover:bg-red-100 hover:border-red-500 hover:text-red-700 hover:line-through" :
                            isTaken ? "bg-muted text-muted-foreground cursor-not-allowed" :
                            isSelected ? "bg-yellow-400 border-yellow-500 text-black font-bold shadow-sm scale-105" :
                            "bg-white hover:border-yellow-400 hover:text-yellow-600 border-slate-300"
                        )}
                        title={isMine ? "Цуцлах бол дарна уу" : isTaken ? "Хүнтэй" : "Сонгох"}
                    >
                        {isTaken ? "✕" : isMine ? "Та" : isSelected ? "✓" : num}
                    </button>
                );
            };

            // Order: Top (s4) -> s3 -> Aisle/sMiddle -> s2 -> Bottom (s1)
            // But styling needs gap.

            // Top pair
            colSeats.push(<SeatBtn key="s4" num={s4} />);
            colSeats.push(<SeatBtn key="s3" num={s3} />);

            // Aisle or Middle Seat
            if (isBackBench) {
                colSeats.push(<SeatBtn key="mid" num={sMiddle} />);
            } else {
                colSeats.push(<div key="aisle" className="h-8 w-8" />); // Spacer
            }

            // Bottom pair
            colSeats.push(<SeatBtn key="s2" num={s2} />);
            colSeats.push(<SeatBtn key="s1" num={s1} />);

            columns.push(
                <div key={c} className="flex flex-col gap-2">
                    {colSeats}
                </div>
            );
        }

        return (
            <div className="relative border-4 border-slate-400 rounded-[2rem] rounded-r-3xl p-4 bg-slate-50 inline-block">
                {/* Driver Section (Left side visually in code, but maybe front is left?) 
                    Image shows front on LEFT (door steps). 
                */}
                <div className="flex gap-4">
                    {/* Driver / Entrance Area */}
                    <div className="flex flex-col justify-between w-12 border-r-2 border-dashed border-slate-300 pr-2">
                        <div className="h-16 border-2 border-slate-300 rounded-lg flex items-center justify-center bg-slate-100 text-[10px] text-center text-muted-foreground p-1">
                            Жолооч
                        </div>
                        <div className="h-16 border-b-2 border-slate-300 w-full mb-2" /> {/* Entrance */}
                    </div>

                    {/* Seats Grid */}
                    <div className="flex gap-2">
                        {columns}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-6 animate-in-fade">
            <div>
                <h2 className="text-3xl font-bold tracking-tight">Автобус захиалга</h2>
                <p className="text-muted-foreground">Ажилчдын унааны хуваарь ба суудал захиалга</p>
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {tripsLoading ? (
                    <div className="col-span-full flex justify-center p-12">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : trips.length === 0 ? (
                    <div className="col-span-full text-center text-muted-foreground p-12 bg-muted/20 rounded-lg">
                        Одоогоор төлөвлөгдсөн аялал алга байна.
                    </div>
                ) : (
                    trips.map(trip => {
                        const vehicle = getVehicle(trip.vehicleId);
                        return (
                            <Card key={trip.id} className="cursor-pointer hover:shadow-md transition-shadow group">
                                <CardHeader>
                                    <div className="flex justify-between items-start">
                                        <Badge variant="outline" className="mb-2">
                                            {format(new Date(trip.departureTime), "HH:mm")}
                                        </Badge>
                                        {trip.status === "scheduled" ? (
                                            <Badge className="bg-green-500/10 text-green-700 hover:bg-green-500/20 shadow-none border-0">
                                                Хуваарьт
                                            </Badge>
                                        ) : (
                                            <Badge variant="secondary">{trip.status}</Badge>
                                        )}
                                    </div>
                                    <CardTitle className="text-lg group-hover:text-primary transition-colors">{getRouteName(trip.routeId)}</CardTitle>
                                    <CardDescription className="flex items-center mt-1">
                                        <Bus className="h-4 w-4 mr-1" /> {vehicle?.name} ({vehicle?.plateNo})
                                    </CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="flex items-center text-sm text-muted-foreground mb-4">
                                        <Calendar className="h-4 w-4 mr-2" />
                                        {format(new Date(trip.departureTime), "yyyy-MM-dd")}
                                    </div>
                                    <Button className="w-full" onClick={() => setSelectedTrip(trip)}>
                                        Суудал сонгох
                                    </Button>
                                </CardContent>
                            </Card>
                        );
                    })
                )}
            </div>

            <Dialog open={!!selectedTrip} onOpenChange={(open) => !open && setSelectedTrip(null)}>
                <DialogContent className="max-w-[1000px] w-full max-h-[90vh] overflow-y-auto p-0 gap-0">
                    <div className="grid grid-cols-1 lg:grid-cols-12 h-full">
                        {/* Headers are distinct in image, but we are inside Dialog. We'll make a custom header area. */}

                        {/* Left Side: Detail Info */}
                        <div className="lg:col-span-4 bg-muted/30 p-6 border-r flex flex-col gap-6">
                            <div>
                                <h3 className="flex items-center gap-2 font-bold text-lg mb-4">
                                    <span className="flex items-center justify-center w-6 h-6 rounded-full bg-black text-white text-xs">2</span>
                                    <span>Суудал сонгох</span>
                                </h3>
                                <div className="h-1 w-full bg-red-500 mb-6"></div>
                                {/* Red text underline style from image */}
                            </div>

                            <div className="space-y-4 text-sm">
                                <div className="grid grid-cols-[100px_1fr] gap-2">
                                    <span className="text-muted-foreground font-medium">Чиглэл:</span>
                                    <span className="font-bold text-foreground">{selectedTrip && getRouteName(selectedTrip.routeId)}</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2">
                                    <span className="text-muted-foreground font-medium">Хөдлөх огноо:</span>
                                    <span className="font-bold text-foreground">{selectedTrip && format(new Date(selectedTrip.departureTime), "yyyy-MM-dd HH:mm")}</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2">
                                    <span className="text-muted-foreground font-medium">ААН нэр:</span>
                                    <span className="font-bold text-foreground">Монгол Транс ХХК</span> {/* Mock */}
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2">
                                    <span className="text-muted-foreground font-medium">Марк загвар:</span>
                                    <span className="font-bold text-foreground">{selectedTrip && getVehicle(selectedTrip.vehicleId)?.name}</span>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2">
                                    <span className="text-muted-foreground font-medium">Улсын дугаар:</span>
                                    <span className="font-bold text-foreground uppercase">{selectedTrip && getVehicle(selectedTrip.vehicleId)?.plateNo}</span>
                                </div>
                            </div>

                            <div className="mt-auto pt-6">
                                <Button onClick={() => bookMutation.mutate()} disabled={!selectedSeat || bookMutation.isPending} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold h-12">
                                    {bookMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Захиалах бүртгэх
                                </Button>
                            </div>
                        </div>

                        {/* Right Side: Bus Layout */}
                        <div className="lg:col-span-8 p-6 bg-white min-h-[400px] overflow-auto flex flex-col items-center justify-center relative">
                            {/* Close button absolute */}
                            <DialogTrigger asChild onClick={() => setSelectedTrip(null)}>
                                <Button variant="ghost" size="icon" className="absolute right-4 top-4 rounded-full">
                                    <span className="sr-only">Close</span>
                                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-4 h-4"><path d="M11.7816 4.03157C12.0062 3.80702 12.0062 3.44295 11.7816 3.2184C11.5571 2.99385 11.193 2.99385 10.9685 3.2184L7.50005 6.68682L4.03164 3.2184C3.80708 2.99385 3.44301 2.99385 3.21846 3.2184C2.99391 3.44295 2.99391 3.80702 3.21846 4.03157L6.68688 7.49999L3.21846 10.9684C2.99391 11.1929 2.99391 11.557 3.21846 11.7816C3.44301 12.0061 3.80708 12.0061 4.03164 11.7816L7.50005 8.31316L10.9685 11.7816C11.193 12.006 11.5571 12.006 11.7816 11.7816C12.0062 11.557 12.0062 11.1929 11.7816 10.9684L8.31322 7.49999L11.7816 4.03157Z" fill="currentColor" fillRule="evenodd" clipRule="evenodd"></path></svg>
                                </Button>
                            </DialogTrigger>

                            <div className="w-full flex justify-center overflow-x-auto pb-4">
                                {reservationsLoading ? (
                                    <Loader2 className="h-12 w-12 animate-spin text-muted-foreground my-20" />
                                ) : selectedTrip && getVehicle(selectedTrip.vehicleId) ? (
                                    <>
                                        {renderSeatMap(getVehicle(selectedTrip.vehicleId)!)}
                                    </>
                                ) : (
                                    <div className="text-destructive">Унааны мэдээлэл олдсонгүй</div>
                                )}
                            </div>

                            {/* Legend */}
                            <div className="flex flex-wrap justify-center gap-6 text-sm mt-6">
                                <div className="flex items-center gap-2 text-xs text-muted-foreground uppercase opacity-70">
                                    <div className="w-5 h-5 rounded border border-slate-300 bg-white" /> Сул суудал
                                </div>
                                <div className="flex items-center gap-2 text-xs text-foreground font-medium">
                                    <div className="w-5 h-5 rounded border border-yellow-500 bg-yellow-400 shadow-sm" /> Сонгосон
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <div className="w-5 h-5 rounded border bg-muted flex items-center justify-center">✕</div> Захиалсан
                                </div>
                                <div className="flex items-center gap-2 text-xs text-green-700 font-medium">
                                    <div className="w-5 h-5 rounded border border-green-500 bg-green-100 flex items-center justify-center text-[10px]">Та</div> Таны суудал
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <div className="w-5 h-5 rounded border border-yellow-500 bg-white flex items-center justify-center"></div> Тусгай
                                </div>
                            </div>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
