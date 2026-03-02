
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Trip, InsertTrip, Route, Vehicle } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Loader2, Plus, Calendar, Clock } from "lucide-react";

export default function Trips() {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Fetch needed data
    const { data: trips = [], isLoading: tripsLoading } = useQuery<Trip[]>({
        queryKey: ["/api/transport/trips"],
    });

    const { data: routes = [] } = useQuery<Route[]>({
        queryKey: ["/api/transport/routes"],
    });

    const { data: vehicles = [] } = useQuery<Vehicle[]>({
        queryKey: ["/api/transport/vehicles"],
    });

    const createMutation = useMutation({
        mutationFn: async (data: InsertTrip) => {
            const res = await fetch("/api/transport/trips", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/transport/trips"] });
            setIsAddOpen(false);
            toast({ title: "Амжилттай", description: "Аялал хуваарьт орлоо." });
        },
        onError: (err) => {
            toast({ title: "Алдаа", description: JSON.parse(err.message).message || err.message, variant: "destructive" });
        },
    });

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const dateStr = formData.get("date") as string;
        const timeStr = formData.get("time") as string;

        // Combine date and time
        const departureTime = new Date(`${dateStr}T${timeStr}`);

        const data: Partial<InsertTrip> = {
            routeId: formData.get("routeId") as string,
            vehicleId: formData.get("vehicleId") as string,
            departureTime: departureTime,
            status: "scheduled",
        };
        createMutation.mutate(data as InsertTrip);
    };

    // Helper to find names
    const getRouteName = (id: string) => routes.find(r => r.id === id)?.name || id;
    const getVehicleName = (id: string) => vehicles.find(v => v.id === id)?.name || id;

    const isLoading = tripsLoading;

    // Manifest Logic
    const [viewManifestTrip, setViewManifestTrip] = useState<Trip | null>(null);
    const { data: manifest = [], isLoading: manifestLoading } = useQuery<any[]>({
        queryKey: ["/api/transport/trips", viewManifestTrip?.id, "manifest"],
        enabled: !!viewManifestTrip
    });

    const exportManifest = () => {
        if (!manifest.length) return;
        const csvContent = "data:text/csv;charset=utf-8,"
            + "Seat,Name,Phone,Status\n"
            + manifest.map(row => `${row.seatNumber},"${row.passengerName}",${row.passengerPhone},${row.status}`).join("\n");
        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `manifest_${viewManifestTrip?.id}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Аялалын хуваарь</CardTitle>
                    <CardDescription>Удахгүй болох аялалууд</CardDescription>
                </div>
                <Button onClick={() => setIsAddOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Аялал товлох
                </Button>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Огноо/Цаг</TableHead>
                                <TableHead>Чиглэл</TableHead>
                                <TableHead>Унаа</TableHead>
                                <TableHead>Төлөв</TableHead>
                                <TableHead className="text-right">Үйлдэл</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {trips.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground p-8">
                                        Хуваарьт аялал алга
                                    </TableCell>
                                </TableRow>
                            ) : (
                                trips.map((t) => (
                                    <TableRow key={t.id}>
                                        <TableCell>
                                            <div className="flex flex-col">
                                                <span className="font-semibold">{format(new Date(t.departureTime), "yyyy-MM-dd")}</span>
                                                <span className="text-muted-foreground text-sm">{format(new Date(t.departureTime), "HH:mm")}</span>
                                            </div>
                                        </TableCell>
                                        <TableCell>{getRouteName(t.routeId)}</TableCell>
                                        <TableCell>{getVehicleName(t.vehicleId)}</TableCell>
                                        <TableCell>
                                            <span className="capitalize px-2 py-1 rounded bg-blue-100 text-blue-700 text-xs">
                                                {t.status}
                                            </span>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="outline" size="sm" onClick={() => setViewManifestTrip(t)}>
                                                Зорчигчид
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Аялал товлох</DialogTitle>
                        <DialogDescription>Чиглэл болон унаа, цагийг сонгоно уу.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={onSubmit} className="space-y-4">

                        <div className="space-y-2">
                            <Label htmlFor="routeId">Чиглэл</Label>
                            <Select name="routeId" required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Чиглэл сонгох" />
                                </SelectTrigger>
                                <SelectContent>
                                    {routes.map(r => (
                                        <SelectItem key={r.id} value={r.id}>{r.name} ({r.code})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="vehicleId">Унаа</Label>
                            <Select name="vehicleId" required>
                                <SelectTrigger>
                                    <SelectValue placeholder="Унаа сонгох" />
                                </SelectTrigger>
                                <SelectContent>
                                    {vehicles.map(v => (
                                        <SelectItem key={v.id} value={v.id}>{v.name} ({v.plateNo})</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="date">Огноо</Label>
                                <Input id="date" name="date" type="date" required
                                    defaultValue={format(new Date(), "yyyy-MM-dd")} />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="time">Цаг</Label>
                                <Input id="time" name="time" type="time" required
                                    defaultValue="08:00" />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Болих</Button>
                            <Button type="submit" disabled={createMutation.isPending}>
                                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Товлох
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <Dialog open={!!viewManifestTrip} onOpenChange={(open) => !open && setViewManifestTrip(null)}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Зорчигчдын жагсаалт</DialogTitle>
                        <DialogDescription>
                            {viewManifestTrip && `${getRouteName(viewManifestTrip.routeId)} - ${format(new Date(viewManifestTrip.departureTime), "yyyy-MM-dd HH:mm")}`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex justify-end mb-2 space-x-2">
                        {viewManifestTrip?.status === 'scheduled' && (
                            <Button variant="destructive" size="sm" onClick={() => {
                                if (confirm("Are you sure you want to close boarding?")) {
                                    // Quick patch directly
                                    fetch(`/api/transport/trips/${viewManifestTrip.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ status: 'closed' })
                                    }).then(() => {
                                        setViewManifestTrip(null);
                                        /* Allow query to invalidate naturally or force refresh */
                                    });
                                }
                            }}>
                                Close Boarding
                            </Button>
                        )}
                        <Button variant="secondary" size="sm" onClick={exportManifest} disabled={!manifest.length}>
                            Экспорт CSV
                        </Button>
                    </div>

                    {manifestLoading ? (
                        <div className="flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">№</TableHead>
                                    <TableHead>Нэр</TableHead>
                                    <TableHead>Утас</TableHead>
                                    <TableHead>Төлөв</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {manifest.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={4} className="text-center text-muted-foreground">Бүртгэл алга</TableCell>
                                    </TableRow>
                                ) : (
                                    manifest.map((m: any) => (
                                        <TableRow key={m.seatNumber}>
                                            <TableCell className="font-mono">{m.seatNumber}</TableCell>
                                            <TableCell>{m.passengerName}</TableCell>
                                            <TableCell>{m.passengerPhone}</TableCell>
                                            <TableCell>
                                                <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">
                                                    {m.status}
                                                </span>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </DialogContent>
            </Dialog>
        </Card>
    );
}
