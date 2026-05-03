import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, parseISO } from "date-fns";
import {
    Shirt, Plus, AlertTriangle, CheckCircle, Clock, Loader2, RotateCcw, ChevronDown, Package
} from "lucide-react";

type UniformIssuance = {
    id: string;
    employeeId: string;
    employeeFirstName: string;
    employeeLastName: string;
    policyName: string | null;
    items: { name: string; qty: number; size?: string }[];
    issuedAt: string;
    nextIssueDue: string | null;
    status: string;
    note: string | null;
    returnedAt: string | null;
};

type DueAlert = {
    overdue: UniformIssuance[];
    upcoming: UniformIssuance[];
    total: number;
};

type Employee = { id: string; firstName: string; lastName: string };

const statusColors: Record<string, string> = {
    issued: "bg-blue-100 text-blue-800",
    returned: "bg-gray-100 text-gray-700",
    lost: "bg-orange-100 text-orange-800",
    expired: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
    issued: "Олгогдсон",
    returned: "Буцаасан",
    lost: "Гээгдсэн",
    expired: "Хугацаа дууссан",
};

export default function UniformAdmin() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showIssue, setShowIssue] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState("");
    const [filterStatus, setFilterStatus] = useState("issued");

    // Issue form state
    const [items, setItems] = useState([{ name: "", qty: 1, size: "" }]);
    const [issuedAt, setIssuedAt] = useState(new Date().toISOString().split("T")[0]);
    const [noteInput, setNoteInput] = useState("");
    const [intervalMonths, setIntervalMonths] = useState("12");

    const { data: issuances = [], isLoading } = useQuery<UniformIssuance[]>({
        queryKey: ["/api/uniforms/issuances", filterStatus],
        queryFn: async () => {
            const res = await fetch(`/api/uniforms/issuances?status=${filterStatus}`);
            return res.json();
        },
    });

    const { data: dueAlerts } = useQuery<DueAlert>({
        queryKey: ["/api/uniforms/due"],
        queryFn: async () => {
            const res = await fetch("/api/uniforms/due?days=45");
            return res.json();
        },
    });

    const { data: employees = [] } = useQuery<Employee[]>({
        queryKey: ["/api/employees"],
    });

    const issueMutation = useMutation({
        mutationFn: async () => {
            const validItems = items.filter(i => i.name.trim());
            if (!validItems.length) throw new Error("Хамгийн нэг зүйл оруулна уу");
            if (!selectedEmployee) throw new Error("Ажилтан сонгоно уу");

            const res = await fetch("/api/uniforms/issuances", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId: selectedEmployee,
                    items: validItems,
                    issuedAt,
                    note: noteInput || undefined,
                    // Бодлогоос авахын оронд шууд тооцоолно
                    policyId: undefined,
                }),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/uniforms/issuances"] });
            queryClient.invalidateQueries({ queryKey: ["/api/uniforms/due"] });
            setShowIssue(false);
            setItems([{ name: "", qty: 1, size: "" }]);
            setSelectedEmployee("");
            setNoteInput("");
            toast({ title: "Амжилттай", description: "Нормын хувцас олгогдлоо." });
        },
        onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
    });

    const returnMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/uniforms/issuances/${id}/return`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ note: "Буцааж авлаа" }),
            });
            if (!res.ok) throw new Error("Return failed");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/uniforms/issuances"] });
            toast({ title: "Амжилттай", description: "Хувцас буцааж авагдлаа." });
        },
    });

    const addItem = () => setItems(p => [...p, { name: "", qty: 1, size: "" }]);
    const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
    const updateItem = (i: number, field: string, value: any) => {
        setItems(p => p.map((item, idx) => idx === i ? { ...item, [field]: value } : item));
    };

    const getDaysUntilDue = (dateStr: string | null) => {
        if (!dateStr) return null;
        return differenceInDays(parseISO(dateStr), new Date());
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Shirt className="h-8 w-8 text-primary" />
                        Нормын хувцас
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        Жилд нэг удаагийн хувцасны олголт, хугацааны хяналт
                    </p>
                </div>
                <Button onClick={() => setShowIssue(true)}>
                    <Plus className="w-4 h-4 mr-2" />
                    Хувцас олгох
                </Button>
            </div>

            {/* DUE ALERTS SUMMARY */}
            {dueAlerts && (dueAlerts.overdue.length > 0 || dueAlerts.upcoming.length > 0) && (
                <div className="grid gap-4 md:grid-cols-2">
                    {dueAlerts.overdue.length > 0 && (
                        <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2 text-red-700">
                                    <AlertTriangle className="w-4 h-4" />
                                    Хугацаа хэтэрсэн ({dueAlerts.overdue.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-1">
                                    {dueAlerts.overdue.slice(0, 5).map(d => (
                                        <li key={d.id} className="text-xs text-red-800 flex justify-between">
                                            <span>{d.employeeLastName} {d.employeeFirstName}</span>
                                            <span className="font-medium">{d.nextIssueDue}</span>
                                        </li>
                                    ))}
                                    {dueAlerts.overdue.length > 5 && (
                                        <li className="text-xs text-red-600">...болон {dueAlerts.overdue.length - 5} бусад</li>
                                    )}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                    {dueAlerts.upcoming.length > 0 && (
                        <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
                            <CardHeader className="pb-2">
                                <CardTitle className="text-sm flex items-center gap-2 text-yellow-700">
                                    <Clock className="w-4 h-4" />
                                    45 хоногийн дотор ({dueAlerts.upcoming.length})
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <ul className="space-y-1">
                                    {dueAlerts.upcoming.slice(0, 5).map(d => {
                                        const days = getDaysUntilDue(d.nextIssueDue);
                                        return (
                                            <li key={d.id} className="text-xs text-yellow-800 flex justify-between">
                                                <span>{d.employeeLastName} {d.employeeFirstName}</span>
                                                <span className="font-medium">{days !== null ? `${days} хоногийн дараа` : d.nextIssueDue}</span>
                                            </li>
                                        );
                                    })}
                                </ul>
                            </CardContent>
                        </Card>
                    )}
                </div>
            )}

            {/* ISSUANCES TABLE */}
            <Card>
                <CardHeader className="pb-0">
                    <div className="flex items-center gap-4">
                        <CardTitle className="text-base">Олголтын бүртгэл</CardTitle>
                        <Select value={filterStatus} onValueChange={setFilterStatus}>
                            <SelectTrigger className="w-40 h-8">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="issued">Одоогоор олгогдсон</SelectItem>
                                <SelectItem value="returned">Буцаасан</SelectItem>
                                <SelectItem value="lost">Гээгдсэн</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent className="p-0 mt-4">
                    {isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Ажилтан</TableHead>
                                    <TableHead>Зүйлс</TableHead>
                                    <TableHead>Олгосон</TableHead>
                                    <TableHead>Дараагийн олголт</TableHead>
                                    <TableHead>Төлөв</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {issuances.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                            Олголтын бүртгэл байхгүй байна
                                        </TableCell>
                                    </TableRow>
                                ) : issuances.map(iss => {
                                    const days = getDaysUntilDue(iss.nextIssueDue);
                                    const isOverdue = days !== null && days < 0;
                                    const isUpcoming = days !== null && days >= 0 && days <= 45;

                                    return (
                                        <TableRow key={iss.id}>
                                            <TableCell className="font-medium">
                                                {iss.employeeLastName} {iss.employeeFirstName}
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-0.5">
                                                    {iss.items.slice(0, 2).map((item, i) => (
                                                        <span key={i} className="text-xs">
                                                            {item.name} x{item.qty}
                                                            {item.size && ` (${item.size})`}
                                                        </span>
                                                    ))}
                                                    {iss.items.length > 2 && (
                                                        <span className="text-xs text-muted-foreground">
                                                            +{iss.items.length - 2} бусад
                                                        </span>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-sm">
                                                {format(new Date(iss.issuedAt), "yyyy/MM/dd")}
                                            </TableCell>
                                            <TableCell>
                                                {iss.nextIssueDue ? (
                                                    <div className={`text-sm flex items-center gap-1 ${isOverdue ? "text-red-600 font-semibold" : isUpcoming ? "text-yellow-600 font-medium" : "text-muted-foreground"}`}>
                                                        {isOverdue && <AlertTriangle className="w-3 h-3" />}
                                                        {isUpcoming && !isOverdue && <Clock className="w-3 h-3" />}
                                                        {isOverdue ? `${Math.abs(days!)} хоног хэтэрсэн` :
                                                            days !== null ? `${days} хоног` : iss.nextIssueDue}
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground">—</span>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                <Badge className={`text-xs ${statusColors[iss.status] ?? ""}`} variant="outline">
                                                    {statusLabels[iss.status] ?? iss.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                {iss.status === "issued" && (
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="text-xs"
                                                        onClick={() => {
                                                            if (confirm("Хувцас буцааж авах уу?")) returnMutation.mutate(iss.id);
                                                        }}
                                                    >
                                                        <RotateCcw className="w-3 h-3 mr-1" />
                                                        Буцаах
                                                    </Button>
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            {/* ISSUE DIALOG */}
            <Dialog open={showIssue} onOpenChange={setShowIssue}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Package className="w-5 h-5" />
                            Нормын хувцас олгох
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
                        {/* Employee Select */}
                        <div className="space-y-2">
                            <Label>Ажилтан *</Label>
                            <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                                <SelectTrigger>
                                    <SelectValue placeholder="Ажилтан сонгох..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {employees.map(e => (
                                        <SelectItem key={e.id} value={e.id}>
                                            {e.lastName} {e.firstName}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label>Олгосон огноо</Label>
                            <Input type="date" value={issuedAt} onChange={e => setIssuedAt(e.target.value)} />
                        </div>

                        {/* Items */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between">
                                <Label>Олгосон зүйлс *</Label>
                                <Button variant="outline" size="sm" onClick={addItem}>
                                    <Plus className="w-3 h-3 mr-1" />
                                    Нэмэх
                                </Button>
                            </div>
                            <div className="space-y-2">
                                {items.map((item, i) => (
                                    <div key={i} className="grid grid-cols-[1fr_80px_80px_auto] gap-2 items-center">
                                        <Input
                                            placeholder="Барааны нэр (жишээ: Гэдэс)"
                                            value={item.name}
                                            onChange={e => updateItem(i, "name", e.target.value)}
                                        />
                                        <Input
                                            type="number"
                                            min={1}
                                            placeholder="Тоо"
                                            value={item.qty}
                                            onChange={e => updateItem(i, "qty", parseInt(e.target.value) || 1)}
                                        />
                                        <Input
                                            placeholder="Хэмжээ"
                                            value={item.size}
                                            onChange={e => updateItem(i, "size", e.target.value)}
                                        />
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-9 w-9 text-destructive"
                                            onClick={() => removeItem(i)}
                                            disabled={items.length === 1}
                                        >
                                            ✕
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label>Тэмдэглэл</Label>
                            <Input
                                placeholder="Нэмэлт тэмдэглэл..."
                                value={noteInput}
                                onChange={e => setNoteInput(e.target.value)}
                            />
                        </div>

                        <div className="rounded-md bg-blue-50 dark:bg-blue-950/30 p-3 text-sm">
                            <p className="text-blue-700 dark:text-blue-300">
                                💡 Дараагийн олголтын сануулга 12 сарын дараа автоматаар идэвхжинэ. Хугацааг өөрчлөхийн тулд "Норм бодлого" тохиргооноос засна уу.
                            </p>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setShowIssue(false)}>Болих</Button>
                        <Button
                            onClick={() => issueMutation.mutate()}
                            disabled={!selectedEmployee || items.every(i => !i.name) || issueMutation.isPending}
                        >
                            {issueMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Олгох
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
