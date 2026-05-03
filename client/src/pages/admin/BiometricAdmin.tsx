import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
    Fingerprint, MonitorCheck, Plus, RefreshCw, Trash2, Copy, Eye, EyeOff,
    Wifi, WifiOff, Bus, DoorOpen, Building2, Loader2
} from "lucide-react";

type Device = {
    id: string;
    name: string;
    location: string;
    deviceType: "gate" | "bus" | "camp";
    vehicleId?: string | null;
    apiToken: string;
    isActive: boolean;
    lastSeenAt?: string | null;
    createdAt: string;
};

type BiometricEvent = {
    id: string;
    deviceId: string;
    employeeId: string | null;
    externalId: string | null;
    eventType: string;
    scannedAt: string;
    processResult: string | null;
    processError: string | null;
};

const DEVICE_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
    gate: { label: "Гарц", icon: <DoorOpen className="w-4 h-4" /> },
    bus: { label: "Автобус", icon: <Bus className="w-4 h-4" /> },
    camp: { label: "Кэмп", icon: <Building2 className="w-4 h-4" /> },
};

const EVENT_TYPE_LABELS: Record<string, string> = {
    check_in: "Ирц",
    check_out: "Явалт",
    bus_board: "Автобусанд суусан",
    camp_arrive: "Кэмпэд ирсэн",
    bus_depart: "Кэмпээс гарсан",
    returned_city: "Хотод буцсан",
};

export default function BiometricAdmin() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showAddDevice, setShowAddDevice] = useState(false);
    const [visibleTokens, setVisibleTokens] = useState<Set<string>>(new Set());
    const [newDevice, setNewDevice] = useState({ name: "", location: "", deviceType: "gate", vehicleId: "" });

    const { data: devices = [], isLoading } = useQuery<Device[]>({
        queryKey: ["/api/biometric/devices"],
    });

    const { data: events = [], isLoading: eventsLoading } = useQuery<BiometricEvent[]>({
        queryKey: ["/api/biometric/events"],
        refetchInterval: 10000, // 10 секунд тутам refresh
    });

    const { data: vehicles = [] } = useQuery<{ id: string; name: string; plateNo: string }[]>({
        queryKey: ["/api/transport/vehicles"],
    });

    const addMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/biometric/devices", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...newDevice,
                    vehicleId: newDevice.vehicleId || null,
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/biometric/devices"] });
            setShowAddDevice(false);
            setNewDevice({ name: "", location: "", deviceType: "gate", vehicleId: "" });
            toast({ title: "Амжилттай", description: "Шинэ төхөөрөмж нэмэгдлээ." });
        },
        onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/biometric/devices/${id}`, { method: "DELETE" });
            if (!res.ok && res.status !== 204) throw new Error("Delete failed");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/biometric/devices"] });
            toast({ title: "Амжилттай", description: "Төхөөрөмж устгагдлаа." });
        },
    });

    const rotateTokenMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/biometric/devices/${id}/rotate-token`, { method: "POST" });
            if (!res.ok) throw new Error("Failed to rotate token");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/biometric/devices"] });
            toast({ title: "Токен шинэчлэгдлээ", description: "Шинэ токеныг төхөөрөмждөө оруулна уу." });
        },
    });

    const copyToken = (token: string) => {
        navigator.clipboard.writeText(token);
        toast({ title: "Хуулагдлаа", description: "Токен clipboard-д хуулагдлаа." });
    };

    const toggleTokenVisibility = (id: string) => {
        setVisibleTokens(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const isOnline = (lastSeen?: string | null) => {
        if (!lastSeen) return false;
        return (Date.now() - new Date(lastSeen).getTime()) < 5 * 60 * 1000; // 5 минутын дотор
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Fingerprint className="h-8 w-8 text-primary" />
                        Биометрийн удирдлага
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Царай унших төхөөрөмжийн тохиргоо ба событийн бүртгэл
                    </p>
                </div>
                <Button onClick={() => setShowAddDevice(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Төхөөрөмж нэмэх
                </Button>
            </div>

            <Tabs defaultValue="devices">
                <TabsList>
                    <TabsTrigger value="devices">Төхөөрөмжүүд ({devices.length})</TabsTrigger>
                    <TabsTrigger value="events">
                        Событийн лог
                        <span className="ml-2 w-2 h-2 bg-green-500 rounded-full animate-pulse inline-block" />
                    </TabsTrigger>
                </TabsList>

                {/* DEVICES TAB */}
                <TabsContent value="devices" className="space-y-4">
                    {isLoading ? (
                        <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
                    ) : devices.length === 0 ? (
                        <Card>
                            <CardContent className="text-center py-12 text-muted-foreground">
                                <Fingerprint className="w-12 h-12 mx-auto mb-4 opacity-30" />
                                <p>Бүртгэлтэй төхөөрөмж байхгүй.</p>
                                <p className="text-sm mt-1">Эхлээд нэг төхөөрөмж нэмнэ үү.</p>
                            </CardContent>
                        </Card>
                    ) : (
                        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                            {devices.map(device => {
                                const online = isOnline(device.lastSeenAt);
                                const typeInfo = DEVICE_TYPE_LABELS[device.deviceType];
                                const tokenVisible = visibleTokens.has(device.id);

                                return (
                                    <Card key={device.id} className={`border-2 ${online ? "border-green-500/30" : "border-transparent"}`}>
                                        <CardHeader className="pb-2">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    {typeInfo?.icon}
                                                    <CardTitle className="text-base">{device.name}</CardTitle>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <Badge variant={online ? "default" : "secondary"} className={`text-[10px] px-1.5 py-0.5 ${online ? "bg-green-500" : ""}`}>
                                                        {online ? <><Wifi className="w-2.5 h-2.5 mr-1" />Online</> : <><WifiOff className="w-2.5 h-2.5 mr-1" />Offline</>}
                                                    </Badge>
                                                </div>
                                            </div>
                                            <CardDescription className="flex items-center gap-1 text-xs">
                                                <MonitorCheck className="w-3 h-3" />
                                                {device.location} · {typeInfo?.label}
                                            </CardDescription>
                                        </CardHeader>
                                        <CardContent className="space-y-3">
                                            {device.lastSeenAt && (
                                                <p className="text-xs text-muted-foreground">
                                                    Сүүлд: {format(new Date(device.lastSeenAt), "MM/dd HH:mm:ss")}
                                                </p>
                                            )}

                                            {/* API Token */}
                                            <div className="bg-muted rounded-md p-2 space-y-1">
                                                <p className="text-[10px] font-medium text-muted-foreground uppercase">API Token</p>
                                                <div className="flex items-center gap-1">
                                                    <code className="text-xs flex-1 truncate font-mono">
                                                        {tokenVisible ? device.apiToken : "•".repeat(16)}
                                                    </code>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => toggleTokenVisibility(device.id)}>
                                                        {tokenVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                                                    </Button>
                                                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => copyToken(device.apiToken)}>
                                                        <Copy className="w-3 h-3" />
                                                    </Button>
                                                </div>
                                            </div>

                                            <div className="flex gap-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="flex-1 text-xs"
                                                    onClick={() => rotateTokenMutation.mutate(device.id)}
                                                    disabled={rotateTokenMutation.isPending}
                                                >
                                                    <RefreshCw className="w-3 h-3 mr-1" />
                                                    Токен шинэчлэх
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => {
                                                        if (confirm(`"${device.name}" устгах уу?`)) deleteMutation.mutate(device.id);
                                                    }}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                );
                            })}
                        </div>
                    )}
                </TabsContent>

                {/* EVENTS TAB */}
                <TabsContent value="events">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="text-base">Сүүлийн 50 событи</CardTitle>
                                <Button variant="outline" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/biometric/events"] })}>
                                    <RefreshCw className="w-4 h-4 mr-1" />
                                    Шинэчлэх
                                </Button>
                            </div>
                        </CardHeader>
                        <CardContent className="p-0">
                            {eventsLoading ? (
                                <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Цаг</TableHead>
                                            <TableHead>Событи</TableHead>
                                            <TableHead>Ажилтан</TableHead>
                                            <TableHead>Дүн</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {events.length === 0 ? (
                                            <TableRow>
                                                <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                                    Одоогоор событи байхгүй байна
                                                </TableCell>
                                            </TableRow>
                                        ) : events.map(ev => (
                                            <TableRow key={ev.id}>
                                                <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {format(new Date(ev.scannedAt), "MM/dd HH:mm:ss")}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className="text-xs">
                                                        {EVENT_TYPE_LABELS[ev.eventType] ?? ev.eventType}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-xs">
                                                    {ev.employeeId ? (
                                                        <span className="text-green-600 font-medium">Таних боломжтой</span>
                                                    ) : (
                                                        <span className="text-orange-500">ID: {ev.externalId ?? "Тодорхойгүй"}</span>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge
                                                        variant={ev.processResult === "success" ? "default" : ev.processResult === "pending" ? "secondary" : "destructive"}
                                                        className={`text-[10px] ${ev.processResult === "success" ? "bg-green-500" : ""}`}
                                                    >
                                                        {ev.processResult ?? "pending"}
                                                    </Badge>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>

            {/* ADD DEVICE DIALOG */}
            <Dialog open={showAddDevice} onOpenChange={setShowAddDevice}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Шинэ царай уншигч нэмэх</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Нэр *</Label>
                            <Input
                                placeholder="жишээ: Gate-1 FaceID"
                                value={newDevice.name}
                                onChange={e => setNewDevice(p => ({ ...p, name: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Байршил *</Label>
                            <Input
                                placeholder="жишээ: ҮГД гарц, Автобус-А, Кэмп гарц"
                                value={newDevice.location}
                                onChange={e => setNewDevice(p => ({ ...p, location: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label>Төрөл *</Label>
                            <Select value={newDevice.deviceType} onValueChange={v => setNewDevice(p => ({ ...p, deviceType: v }))}>
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="gate">🚪 Гарц (Байрны орц/гарц)</SelectItem>
                                    <SelectItem value="bus">🚌 Автобус (Автобусанд суулган)</SelectItem>
                                    <SelectItem value="camp">⛺ Кэмп (Кэмп дээр буулган)</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {newDevice.deviceType === "bus" && (
                            <div className="space-y-2">
                                <Label>Автобус (Тээврийн хэрэгсэл)</Label>
                                <Select value={newDevice.vehicleId} onValueChange={v => setNewDevice(p => ({ ...p, vehicleId: v }))}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Автобус сонгох..." />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {vehicles.map(v => (
                                            <SelectItem key={v.id} value={v.id}>{v.name} ({v.plateNo})</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        )}
                        <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">📋 Тайлбар</p>
                            <p>Нэмсний дараа автоматаар API токен үүснэ. Тэр токеныг царай уншигч төхөөрөмжийн тохиргоонд оруулж ERP-тэй холбоно.</p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowAddDevice(false)}>Болих</Button>
                        <Button onClick={() => addMutation.mutate()} disabled={!newDevice.name || !newDevice.location || addMutation.isPending}>
                            {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Нэмэх
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
