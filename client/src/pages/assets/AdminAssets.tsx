
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Plus, Search, Undo2, User, Package, Filter } from "lucide-react";
import { format } from "date-fns";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export default function AdminAssets() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [searchTerm, setSearchTerm] = useState("");
    const [isIssueOpen, setIsIssueOpen] = useState(false);

    // Form State
    const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
    const [selectedProductId, setSelectedProductId] = useState("");
    const [serialNumber, setSerialNumber] = useState("");
    const [note, setNote] = useState("");

    // Fetch Search Employees
    const { data: employees = [] } = useQuery({
        queryKey: ["/api/canteen/employees/search", searchTerm], // Reuse existing search
        queryFn: async () => {
            if (!searchTerm || searchTerm.length < 2) return [];
            const res = await fetch(`/api/canteen/employees/search?q=${searchTerm}`);
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        enabled: searchTerm.length >= 2,
    });

    // Fetch Products (Inventory) - Need an endpoint? 
    // Usually /api/inventory/products exists. Let's assume /api/inventory/products?type=asset?
    // Or just all products.
    // Let's rely on standard product fetch.
    const { data: products = [] } = useQuery({
        queryKey: ["/api/inventory/products"],
        queryFn: async () => {
            const res = await fetch("/api/inventory/products");
            if (!res.ok) throw new Error("Failed");
            return res.json();
        }
    });

    // Fetch Asset List (For now, let's just fetch for one employee or all? 
    // We didn't make a 'list all assets' endpoint, only 'get employee assets'.
    // To list ALL issued assets, we need GET /api/assets/all or similar.
    // For MVP, user asked for "Issue/Return page (employee picker + product picker)".
    // Maybe we search employee -> see their assets -> return them.
    // Or Issue -> select employee.
    // Let's build "Employee Asset Manager": Search employee, see their list.
    const [viewEmployeeId, setViewEmployeeId] = useState<string | null>(null);

    const { data: employeeAssets = [], isLoading: isLoadingAssets } = useQuery({
        queryKey: ["/api/assets/employee", viewEmployeeId],
        queryFn: async () => {
            if (!viewEmployeeId) return [];
            const res = await fetch(`/api/assets/employee/${viewEmployeeId}`);
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        enabled: !!viewEmployeeId
    });

    // Mutations
    const issueMutation = useMutation({
        mutationFn: async () => {
            const res = await fetch("/api/assets/issue", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId: selectedEmployeeId,
                    productId: selectedProductId,
                    serialNumber: serialNumber || undefined,
                    note: note || undefined
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed");
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Амжилттай", description: "Хөрөнгө олгогдлоо" });
            setIsIssueOpen(false);
            setSerialNumber("");
            setNote("");
            // Refresh if viewing the same employee
            if (viewEmployeeId === selectedEmployeeId) {
                queryClient.invalidateQueries({ queryKey: ["/api/assets/employee", viewEmployeeId] });
            }
        },
        onError: (e: Error) => toast({ title: "Алдаа", description: e.message, variant: "destructive" })
    });

    const returnMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/assets/${id}/return`, {
                method: "POST"
            });
            if (!res.ok) throw new Error("Failed");
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Амжилттай", description: "Хөрөнгө буцаагдлаа" });
            queryClient.invalidateQueries({ queryKey: ["/api/assets/employee", viewEmployeeId] });
        },
        onError: (e: Error) => toast({ title: "Алдаа", description: e.message, variant: "destructive" })
    });

    return (
        <div className="space-y-6 container mx-auto p-4 md:p-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Хөрөнгө олголт (Asset Mgmt)</h1>
                <p className="text-muted-foreground">Ажилтанд дүрэмт хувцас, тоног төхөөрөмж олгох, буцаах</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left: Employee Search */}
                <Card className="md:col-span-1 h-fit">
                    <CardHeader>
                        <CardTitle>1. Ажилтан хайх</CardTitle>
                        <div className="relative mt-2">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Нэр, код, утас..."
                                className="pl-8"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        {searchTerm.length < 2 && <p className="text-sm text-muted-foreground text-center py-4">Хайх утга оруулна уу</p>}
                        {employees.map((emp: any) => (
                            <div
                                key={emp.id}
                                className={`p-3 rounded border cursor-pointer hover:bg-muted transition-colors flex items-center gap-3 ${viewEmployeeId === emp.id ? 'bg-muted border-primary' : ''}`}
                                onClick={() => {
                                    setViewEmployeeId(emp.id);
                                    setSelectedEmployeeId(emp.id);
                                }}
                            >
                                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                    {emp.firstName[0]}
                                </div>
                                <div>
                                    <div className="font-medium">{emp.lastName?.substring(0, 1)}. {emp.firstName}</div>
                                    <div className="text-xs text-muted-foreground">{emp.employeeNo}</div>
                                </div>
                            </div>
                        ))}
                    </CardContent>
                </Card>

                {/* Right: Asset List & Actions */}
                <Card className="md:col-span-2">
                    <CardHeader className="flex flex-row items-center justify-between">
                        <CardTitle>Олгогдсон хөрөнгө</CardTitle>
                        <Dialog open={isIssueOpen} onOpenChange={setIsIssueOpen}>
                            <DialogTrigger asChild>
                                <Button disabled={!viewEmployeeId}>
                                    <Plus className="h-4 w-4 mr-2" />
                                    Шинээр олгох
                                </Button>
                            </DialogTrigger>
                            <DialogContent className="sm:max-w-[425px]">
                                <DialogHeader>
                                    <DialogTitle>Хөрөнгө олгох</DialogTitle>
                                    <DialogDescription>
                                        Бүтээгдэхүүн болон (сонголтоор) сериал дугаар сонгоно уу.
                                    </DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                    <div className="space-y-2">
                                        <Label>Бүтээгдэхүүн</Label>
                                        <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Сонгох..." />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {products.map((p: any) => (
                                                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.sku})</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Сериал Дугаар (Optional)</Label>
                                        <Input value={serialNumber} onChange={e => setSerialNumber(e.target.value)} placeholder="S/N..." />
                                    </div>
                                    <div className="space-y-2">
                                        <Label>Тэмдэглэл</Label>
                                        <Input value={note} onChange={e => setNote(e.target.value)} placeholder="Note..." />
                                    </div>
                                </div>
                                <DialogFooter>
                                    <Button onClick={() => issueMutation.mutate()} disabled={issueMutation.isPending || !selectedProductId}>
                                        {issueMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Олгох
                                    </Button>
                                </DialogFooter>
                            </DialogContent>
                        </Dialog>
                    </CardHeader>
                    <CardContent>
                        {!viewEmployeeId ? (
                            <div className="text-center py-12 text-muted-foreground">
                                <User className="h-12 w-12 mx-auto mb-3 opacity-20" />
                                Ажилтан сонгож жагсаалт харна уу
                            </div>
                        ) : isLoadingAssets ? (
                            <div className="flex justify-center py-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                        ) : employeeAssets.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">Үр дүн олдсонгүй</div>
                        ) : (
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Огноо</TableHead>
                                        <TableHead>Нэр (Serial)</TableHead>
                                        <TableHead>Төлөв</TableHead>
                                        <TableHead className="text-right">Үйлдэл</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {employeeAssets.map((asset: any) => {
                                        // Product name usually comes from join or we fetch it. 
                                        // Since we don't have join in simple get, we might need product map.
                                        // Or backend sends name? Backend sends raw table row.
                                        // We have products list loaded.
                                        const product = products.find((p: any) => p.id === asset.productId);
                                        return (
                                            <TableRow key={asset.id}>
                                                <TableCell>{format(new Date(asset.issuedAt), "yyyy-MM-dd")}</TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{product?.name || "Unknown Product"}</div>
                                                    {asset.serialNumber && <div className="text-xs text-muted-foreground">S/N: {asset.serialNumber}</div>}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant={asset.status === 'issued' ? 'default' : 'secondary'}>
                                                        {asset.status === 'issued' ? 'Олгогдсон' : 'Буцаасан'}
                                                    </Badge>
                                                    {asset.returnedAt && <div className="text-[10px] text-muted-foreground mt-1">Returned: {format(new Date(asset.returnedAt), "MM/dd")}</div>}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {asset.status === 'issued' && (
                                                        <Button
                                                            size="sm"
                                                            variant="outline"
                                                            className="h-8"
                                                            onClick={() => returnMutation.mutate(asset.id)}
                                                            disabled={returnMutation.isPending}
                                                        >
                                                            <Undo2 className="h-4 w-4 mr-2" />
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
            </div>
        </div>
    );
}
