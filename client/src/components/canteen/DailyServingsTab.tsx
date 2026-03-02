
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Loader2, Plus, Calendar as CalendarIcon, CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";
import { AddServingDialog } from "@/components/canteen/AddServingDialog";

interface MealServing {
    id: string;
    employeeId: string;
    date: string;
    mealType: string;
    price: string;
    status: string;
    voidedAt?: string;
    voidedReason?: string;
}

export function DailyServingsTab() {
    const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [showAddDialog, setShowAddDialog] = useState(false);

    const { data: servings, isLoading } = useQuery<MealServing[]>({
        queryKey: ["canteen.admin.servings", date],
        queryFn: async () => {
            // Fetch for specific day
            const res = await apiRequest("GET", `/api/canteen/admin/servings?from=${date}&to=${date}`);
            return res.json();
        }
    });

    // Pending Orders Stats for Kitchen Prep
    const { data: pendingStats } = useQuery<{ lunch: number, dinner: number }>({
        queryKey: ["canteen.admin.pending-stats", date],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/canteen/admin/pending-stats?date=${date}`);
            return res.json();
        }
    });

    const voidMutation = useMutation({
        mutationFn: async ({ id, reason }: { id: string, reason: string }) => {
            const res = await apiRequest("POST", "/api/canteen/admin/void-serving", {
                servingId: id,
                reason
            });
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Амжилттай", description: "Хоолны бүртгэл цуцлагдлаа." });
            queryClient.invalidateQueries({ queryKey: ["canteen.admin.servings"] });
            queryClient.invalidateQueries({ queryKey: ["canteen.admin.pending-stats"] }); // Refresh stats too
            queryClient.invalidateQueries({ queryKey: ["canteen.stats"] });
            // Notify user to regenerate
            window.dispatchEvent(new CustomEvent('canteen-voided'));
        },
        onError: (err: any) => {
            toast({
                title: "Алдаа",
                description: err.message || "Үйлдэл амжилтгүй боллоо.",
                variant: "destructive"
            });
        }
    });

    // Simple Void Dialog Component
    const VoidDialog = ({ serving }: { serving: MealServing }) => {
        const [reason, setReason] = useState("");
        const [open, setOpen] = useState(false);

        const handleVoid = () => {
            if (!reason) return;
            voidMutation.mutate({ id: serving.id, reason });
            setOpen(false);
        };

        return (
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                    <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-700 hover:bg-red-50">
                        Цуцлах
                    </Button>
                </DialogTrigger>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Хоол цуцлах</DialogTitle>
                        <DialogDescription>
                            Та энэ гүйлгээг цуцлахдаа итгэлтэй байна уу? Хэрэв түрийвчнээс төлсөн бол буцаалт хийгдэнэ.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4">
                        <Input
                            placeholder="Цуцлах шалтгаан (Заавал)"
                            value={reason}
                            onChange={e => setReason(e.target.value)}
                        />
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOpen(false)}>Болих</Button>
                        <Button variant="destructive" onClick={handleVoid} disabled={!reason || voidMutation.isPending}>
                            {voidMutation.isPending ? "Уншиж байна..." : "Цуцлах"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    return (
        <>
            <div className="flex items-center gap-4 mb-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Огноо:</span>
                    <Input
                        type="date"
                        value={date}
                        onChange={(e) => setDate(e.target.value)}
                        className="w-[180px]"
                    />
                </div>
                <Button onClick={() => setShowAddDialog(true)} size="sm" className="ml-auto">
                    <Plus className="w-4 h-4 mr-2" />
                    Хоол нэмэх
                </Button>

                <AddServingDialog
                    isOpen={showAddDialog}
                    onClose={() => setShowAddDialog(false)}
                    defaultDate={date}
                />
            </div>

            {/* Kitchen Prep Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                <Card className="bg-blue-50 border-blue-200">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-700">Өдөр (Захиалга)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold text-blue-900">{pendingStats?.lunch || 0}</div>
                        <p className="text-xs text-blue-600">Бэлтгэх тоо</p>
                    </CardContent>
                </Card>
                <Card className="bg-indigo-50 border-indigo-200">
                    <CardHeader className="p-4 pb-2">
                        <CardTitle className="text-sm font-medium text-indigo-700">Орой (Захиалга)</CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0">
                        <div className="text-2xl font-bold text-indigo-900">{pendingStats?.dinner || 0}</div>
                        <p className="text-xs text-indigo-600">Бэлтгэх тоо</p>
                    </CardContent>
                </Card>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Өдрийн хоолны бүртгэл</CardTitle>
                            <CardDescription>Тухайн өдөр хоол идсэн ажилтнуудын жагсаалт</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Огноо</TableHead>
                                    <TableHead>Ажилтан ID</TableHead>
                                    <TableHead>Төрөл</TableHead>
                                    <TableHead>Үнэ</TableHead>
                                    <TableHead>Төлөв</TableHead>
                                    <TableHead className="text-right">Үйлдэл</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {servings?.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-gray-500">
                                            Бүртгэл олдсонгүй
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    servings?.map((s) => (
                                        <TableRow key={s.id} className={s.status === "voided" ? "bg-red-50 opacity-70" : ""}>
                                            <TableCell>{s.date}</TableCell>
                                            <TableCell>{s.employeeId.substring(0, 8)}...</TableCell>
                                            <TableCell>
                                                <div className="flex flex-col gap-1">
                                                    <Badge variant="outline" className="capitalize w-fit">
                                                        {s.mealType === 'lunch' ? 'Өдөр' : s.mealType === 'dinner' ? 'Орой' : s.mealType}
                                                    </Badge>
                                                    {/* @ts-ignore - note field comes from join */}
                                                    {(s as any).note?.startsWith("[MANUAL]") && (
                                                        <Badge variant="secondary" className="text-[10px] h-4 px-1 w-fit bg-blue-100 text-blue-700 hover:bg-blue-100">
                                                            MANUAL
                                                        </Badge>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{Number(s.price).toLocaleString()}₮</TableCell>
                                            <TableCell>
                                                {s.status === "voided" ? (
                                                    <div className="flex items-center text-red-600 gap-1">
                                                        <XCircle className="w-4 h-4" />
                                                        <span className="text-xs">Цуцлагдсан</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center text-green-600 gap-1">
                                                        <CheckCircle className="w-4 h-4" />
                                                        <span className="text-xs">Идэвхтэй</span>
                                                    </div>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                {s.status !== "voided" && (
                                                    <VoidDialog serving={s} />
                                                )}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </>
    );
}
