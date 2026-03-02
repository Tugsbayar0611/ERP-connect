
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Filter, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";

// Predefined reason templates
const REASON_TEMPLATES = [
    { value: "topup", label: "Цэнэглэлт" },
    { value: "correction", label: "Засвар" },
    { value: "refund", label: "Буцаалт" },
    { value: "bonus", label: "Урамшуулал" },
    { value: "other", label: "Бусад..." }
] as const;

export function WalletsTab() {
    const [search, setSearch] = useState("");
    const [deptFilter, setDeptFilter] = useState("all");
    const [selectedIds, setSelectedIds] = useState<string[]>([]);
    const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);

    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: wallets, isLoading } = useQuery<any[]>({
        queryKey: ["canteen.admin.wallets"],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/canteen/admin/wallets`); // Search handled client side for better UX with selection
            return res.json();
        }
    });

    // Client-side filtering
    const filteredWallets = useMemo(() => {
        if (!wallets) return [];
        return wallets.filter(w => {
            const matchesSearch = (w.firstName + " " + w.lastName).toLowerCase().includes(search.toLowerCase()) ||
                w.employeeId.includes(search);
            const matchesDept = deptFilter === "all" || w.departmentId === deptFilter;
            return matchesSearch && matchesDept;
        });
    }, [wallets, search, deptFilter]);

    // Unique Departments
    const departments = useMemo(() => {
        if (!wallets) return [];
        const map = new Map<string, string>();
        wallets.forEach(w => {
            if (w.departmentId) {
                map.set(w.departmentId, w.departmentName || w.departmentId);
            }
        });
        return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
    }, [wallets]);

    // Selection Logic
    const handleSelectAll = (checked: boolean) => {
        if (checked) {
            setSelectedIds(filteredWallets.map(w => w.id));
        } else {
            setSelectedIds([]);
        }
    };

    const handleSelectOne = (id: string, checked: boolean) => {
        if (checked) {
            setSelectedIds(prev => [...prev, id]);
        } else {
            setSelectedIds(prev => prev.filter(x => x !== id));
        }
    };

    const isAllSelected = filteredWallets.length > 0 && filteredWallets.every(w => selectedIds.includes(w.id));
    const isSomeSelected = filteredWallets.some(w => selectedIds.includes(w.id)) && !isAllSelected;

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center gap-4 flex-wrap">
                    <CardTitle>Ажилтны данс</CardTitle>

                    <div className="flex gap-2 flex-1 justify-end items-center">
                        {selectedIds.length > 0 && (
                            <Button variant="default" size="sm" onClick={() => setIsBulkDialogOpen(true)}>
                                Олноор цэнэглэх ({selectedIds.length})
                            </Button>
                        )}

                        <div className="relative w-48">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Хайх..."
                                className="pl-8"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                            />
                        </div>

                        <Select value={deptFilter} onValueChange={setDeptFilter}>
                            <SelectTrigger className="w-[180px]">
                                <SelectValue placeholder="Хэлтэс" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Бүх хэлтэс</SelectItem>
                                {departments.map(d => (
                                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                ) : (
                    <>
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead className="w-[50px]">
                                            <Checkbox
                                                checked={isAllSelected}
                                                onCheckedChange={handleSelectAll}
                                            />
                                        </TableHead>
                                        <TableHead>Нэр</TableHead>
                                        <TableHead>Хэлтэс</TableHead>
                                        <TableHead>Үлдэгдэл</TableHead>
                                        <TableHead className="text-right">Үйлдэл</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredWallets.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                                                Өгөгдөл олдсонгүй
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        filteredWallets.map(w => (
                                            <TableRow key={w.id} data-state={selectedIds.includes(w.id) ? "selected" : undefined}>
                                                <TableCell>
                                                    <Checkbox
                                                        checked={selectedIds.includes(w.id)}
                                                        onCheckedChange={(checked) => handleSelectOne(w.id, !!checked)}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <div className="font-medium">{w.firstName} {w.lastName}</div>
                                                    <div className="text-xs text-muted-foreground text-opacity-70">ID: {w.employeeId.substring(0, 8)}</div>
                                                </TableCell>
                                                <TableCell>{w.departmentName || w.departmentId || '-'}</TableCell>
                                                <TableCell className={w.balance < 0 ? "text-red-500 font-bold" : "font-bold"}>
                                                    {w.balance.toLocaleString()}₮
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <AdjustDialog wallet={w} />
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                        <div className="text-xs text-muted-foreground mt-2">
                            Нийт: {filteredWallets.length} ажилтан
                        </div>
                    </>
                )}
            </CardContent>

            <BulkAdjustDialog
                open={isBulkDialogOpen}
                onOpenChange={setIsBulkDialogOpen}
                selectedIds={selectedIds}
                onSuccess={() => setSelectedIds([])}
            />
        </Card>
    );
}

function AdjustDialog({ wallet }: { wallet: any }) {
    const [amount, setAmount] = useState("");
    const [reasonType, setReasonType] = useState("");
    const [customNote, setCustomNote] = useState("");
    const [open, setOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const note = reasonType === "other" ? customNote : REASON_TEMPLATES.find(r => r.value === reasonType)?.label || "";

    const adjustMutation = useMutation({
        mutationFn: async ({ walletId, amount, note }: { walletId: string, amount: number, note: string }) => {
            const res = await apiRequest("POST", "/api/canteen/admin/wallet/adjust", {
                walletId,
                amount,
                note
            });
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Амжилттай", description: "Дансны үлдэгдэл шинэчлэгдлээ" });
            queryClient.invalidateQueries({ queryKey: ["canteen.admin.wallets"] });
            setOpen(false);
            setAmount("");
            setReasonType("");
            setCustomNote("");
        },
        onError: (err: any) => {
            toast({ title: "Алдаа", description: err.message, variant: "destructive" });
        }
    });

    const handleAdjust = () => {
        const val = Number(amount);
        if (val === 0 || !note) return;
        adjustMutation.mutate({ walletId: wallet.id, amount: val, note });
    };

    const isValid = amount && reasonType && (reasonType !== "other" || customNote);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm">Засварлах</Button>
            </DialogTrigger>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Данс засварлах ({wallet.firstName})</DialogTitle>
                    <DialogDescription>
                        Үлдэгдлийг нэмэх бол эерэг, хасах бол сөрөг тоо оруулна уу.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                        <Label>Дүн (+/-)</Label>
                        <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Жишээ: 5000 эсвэл -5000" />
                    </div>
                    <div className="grid gap-2">
                        <Label>Шалтгаан</Label>
                        <Select value={reasonType} onValueChange={setReasonType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Шалтгаан сонгох..." />
                            </SelectTrigger>
                            <SelectContent>
                                {REASON_TEMPLATES.map(r => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {reasonType === "other" && (
                        <div className="grid gap-2">
                            <Label>Тайлбар</Label>
                            <Input value={customNote} onChange={e => setCustomNote(e.target.value)} placeholder="Бусад шалтгаан..." />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={handleAdjust} disabled={!isValid || adjustMutation.isPending}>
                        {adjustMutation.isPending ? "Уншиж байна..." : "Хадгалах"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function BulkAdjustDialog({ open, onOpenChange, selectedIds, onSuccess }: { open: boolean, onOpenChange: (open: boolean) => void, selectedIds: string[], onSuccess: () => void }) {
    const [amount, setAmount] = useState("");
    const [reasonType, setReasonType] = useState("");
    const [customNote, setCustomNote] = useState("");
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const note = reasonType === "other" ? customNote : REASON_TEMPLATES.find(r => r.value === reasonType)?.label || "";

    const bulkAdjustMutation = useMutation({
        mutationFn: async ({ walletIds, amount, note }: { walletIds: string[], amount: number, note: string }) => {
            const res = await apiRequest("POST", "/api/canteen/admin/wallet/adjust-bulk", {
                walletIds,
                amount,
                note
            });
            return res.json();
        },
        onSuccess: (data) => {
            toast({ title: "Амжилттай", description: data.message });
            queryClient.invalidateQueries({ queryKey: ["canteen.admin.wallets"] });
            onOpenChange(false);
            setAmount("");
            setReasonType("");
            setCustomNote("");
            onSuccess();
        },
        onError: (err: any) => {
            toast({ title: "Алдаа", description: err.message, variant: "destructive" });
        }
    });

    const handleAdjust = () => {
        const val = Number(amount);
        if (val === 0 || !note) return;
        bulkAdjustMutation.mutate({ walletIds: selectedIds, amount: val, note });
    };

    const isValid = amount && reasonType && (reasonType !== "other" || customNote);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Олноор данс цэнэглэх</DialogTitle>
                    <DialogDescription>
                        {selectedIds.length} ажилтны дансанд өөрчлөлт оруулах.
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                    <div className="p-2 bg-yellow-50 text-yellow-800 text-sm rounded border border-yellow-200">
                        Та {selectedIds.length} ажилтныг сонгосон байна. Бүгдэд нь ижил дүн орно.
                    </div>
                    <div className="grid gap-2">
                        <Label>Дүн (+/-)</Label>
                        <Input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Жишээ: 5000" />
                    </div>
                    <div className="grid gap-2">
                        <Label>Шалтгаан</Label>
                        <Select value={reasonType} onValueChange={setReasonType}>
                            <SelectTrigger>
                                <SelectValue placeholder="Шалтгаан сонгох..." />
                            </SelectTrigger>
                            <SelectContent>
                                {REASON_TEMPLATES.map(r => (
                                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    {reasonType === "other" && (
                        <div className="grid gap-2">
                            <Label>Тайлбар</Label>
                            <Input value={customNote} onChange={e => setCustomNote(e.target.value)} placeholder="Бусад шалтгаан..." />
                        </div>
                    )}
                </div>
                <DialogFooter>
                    <Button onClick={handleAdjust} disabled={!isValid || bulkAdjustMutation.isPending}>
                        {bulkAdjustMutation.isPending ? "Уншиж байна..." : "Батлах"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
