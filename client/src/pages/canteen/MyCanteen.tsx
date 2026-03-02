
import { useState } from "react";
import { useCanteenWalletMe, useCanteenTransactionsMe } from "@/hooks/use-canteen-wallet";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Wallet, RefreshCw, ArrowUpRight, ArrowDownLeft, Utensils } from "lucide-react";
import { format, subDays, isAfter } from "date-fns";
import { cn } from "@/lib/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { apiRequest } from "@/lib/queryClient";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";

export default function MyCanteen() {
    const { wallet, isLoading: isWalletLoading } = useCanteenWalletMe();
    const { transactions, isLoading: isTxLoading, refetchTx } = useCanteenTransactionsMe();
    const [filter, setFilter] = useState("30"); // 7, 30, all
    const [showOrderDialog, setShowOrderDialog] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // --- Orders Query ---
    const { data: myOrders, isLoading: isOrdersLoading } = useQuery({
        queryKey: ['canteen.orders.me'],
        queryFn: async () => {
            // Default fetch future orders + recent past? For now just fetch all or recent 30 days
            // Let's implement fetch standard list
            const res = await apiRequest("GET", "/api/canteen/me/orders");
            return res.json();
        }
    });

    // --- Create Order Mutation ---
    const createOrderMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await apiRequest("POST", "/api/canteen/me/orders", data);
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Захиалга үүслээ", description: "Таны хоол захиалга бүртгэгдлээ." });
            queryClient.invalidateQueries({ queryKey: ['canteen.orders.me'] });
            setShowOrderDialog(false);
        },
        onError: (err: any) => {
            toast({ title: "Алдаа", description: err.message, variant: "destructive" });
        }
    });

    // --- Cancel Order Mutation ---
    const cancelOrderMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await apiRequest("POST", `/api/canteen/me/orders/${id}/cancel`);
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Цуцлагдлаа", description: "Захиалга амжилттай цуцлагдлаа." });
            queryClient.invalidateQueries({ queryKey: ['canteen.orders.me'] });
        },
        onError: (err: any) => {
            toast({ title: "Алдаа", description: err.message, variant: "destructive" });
        }
    });

    // Filter active orders (pending)
    const activeOrders = myOrders?.filter((o: any) => o.status === 'pending') || [];

    const OrderDialog = () => {
        const form = useForm({
            defaultValues: {
                date: new Date().toISOString().split('T')[0], // Today
                mealType: 'lunch'
            }
        });

        const onSubmit = (data: any) => {
            createOrderMutation.mutate(data);
        };

        return (
            <Dialog open={showOrderDialog} onOpenChange={setShowOrderDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Хоол захиалах</DialogTitle>
                        <DialogDescription>
                            Та маргаашийн эсвэл өнөөдрийн хоолоо урьдчилж бүртгүүлээрэй.
                        </DialogDescription>
                        <p className="text-xs text-muted-foreground mt-2 bg-yellow-50 border border-yellow-200 rounded p-2">
                            💡 Захиалга нь зөвхөн тооцооллын зорилготой. Мөнгө зөвхөн хоол олгох үед суутгагдана.
                        </p>
                    </DialogHeader>
                    <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                            <Label>Огноо</Label>
                            <Input type="date" {...form.register('date')} />
                        </div>
                        <div className="grid gap-2">
                            <Label>Төрөл</Label>
                            <Select
                                defaultValue="lunch"
                                onValueChange={(v) => form.setValue('mealType', v)}
                            >
                                <SelectTrigger>
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="lunch">Өдрийн хоол</SelectItem>
                                    <SelectItem value="dinner">Оройн хоол</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button onClick={form.handleSubmit(onSubmit)} disabled={createOrderMutation.isPending}>
                            {createOrderMutation.isPending ? "Уншиж байна..." : "Захиалах"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        );
    }

    const filteredTransactions = transactions?.filter((tx: any) => {
        if (filter === "all") return true;
        const cutoff = subDays(new Date(), parseInt(filter));
        return isAfter(new Date(tx.createdAt), cutoff);
    }) || [];

    if (isWalletLoading) {
        return (
            <div className="flex h-[80vh] items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        )
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
                <div>
                    <h1 className="text-2xl font-bold tracking-tight">Хоолны эрх</h1>
                    <p className="text-muted-foreground">Таны дансны үлдэгдэл болон гүйлгээний түүх</p>
                </div>
                <Button onClick={() => setShowOrderDialog(true)} className="w-full md:w-auto">
                    <Utensils className="w-4 h-4 mr-2" />
                    Хоол захиалах
                </Button>
            </div>

            <OrderDialog />

            {/* Active Orders Alert/Section */}
            {activeOrders.length > 0 && (
                <Card className="border-l-4 border-l-blue-500 bg-blue-50/50">
                    <CardHeader className="py-4">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />
                            Хүлээгдэж буй захиалга ({activeOrders.length})
                        </CardTitle>
                        <p className="text-xs text-muted-foreground mt-1">
                            Хоолоо авахдаа касс дээр ID/QR үзүүлнэ үү.
                        </p>
                    </CardHeader>
                    <CardContent className="pb-4">
                        <div className="space-y-2">
                            {activeOrders.map((order: any) => (
                                <div key={order.id} className="flex items-center justify-between text-sm bg-white p-2 rounded border shadow-sm">
                                    <div className="flex gap-2">
                                        <span className="font-semibold">{order.date}</span>
                                        <Badge variant="outline" className="capitalize">{order.mealType === 'lunch' ? 'Өдөр' : 'Орой'}</Badge>
                                    </div>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600 hover:text-red-700 hover:bg-red-50 h-8 px-2"
                                        onClick={() => cancelOrderMutation.mutate(order.id)}
                                        disabled={cancelOrderMutation.isPending}
                                    >
                                        Цуцлах
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {/* Balance Card ... (unchanged) */}
                <Card className="md:col-span-1 bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-orange-900">
                            Дансны үлдэгдэл
                        </CardTitle>
                        <Wallet className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-orange-700">
                            {wallet?.balance?.toLocaleString()}₮
                        </div>
                        <p className="text-xs text-orange-600/80 mt-1">
                            {wallet?.creditLimit ? `Зээлийн эрх: ${wallet.creditLimit.toLocaleString()}₮` : "Урьдчилсан төлбөрт"}
                        </p>
                    </CardContent>
                </Card>

                {/* Quick Stats or Info? Maybe just spacer for now or empty */}
                <Card className="md:col-span-2">
                    <CardHeader>
                        <CardTitle>Миний мэдээлэл</CardTitle>
                        <CardDescription>Хоолны эрхийн дэлгэрэнгүй</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-gray-600 space-y-2">
                        <div className="flex justify-between border-b pb-2">
                            <span>Статус:</span>
                            <Badge variant={wallet?.status === 'active' ? 'default' : 'destructive'}>
                                {wallet?.status === 'active' ? 'Идэвхтэй' : 'Идэвхгүй'}
                            </Badge>
                        </div>
                        <div className="flex justify-between pt-2">
                            <span>Сүүлийн гүйлгээ:</span>
                            <span>{transactions?.[0] ? format(new Date(transactions[0].createdAt), "yyyy-MM-dd HH:mm") : "-"}</span>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Transactions Table */}
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle>Гүйлгээний түүх</CardTitle>
                        <CardDescription>Таны хийсэн хоол болон цэнэглэлтүүд</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                        <Select value={filter} onValueChange={setFilter}>
                            <SelectTrigger className="w-[140px]">
                                <SelectValue placeholder="Хугацаа" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="7">Сүүлийн 7 хоног</SelectItem>
                                <SelectItem value="30">Сүүлийн 30 хоног</SelectItem>
                                <SelectItem value="all">Бүх гүйлгээ</SelectItem>
                            </SelectContent>
                        </Select>
                        <Button variant="outline" size="icon" onClick={() => refetchTx()}>
                            <RefreshCw className={cn("h-4 w-4", isTxLoading && "animate-spin")} />
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Огноо</TableHead>
                                <TableHead>Төрөл</TableHead>
                                <TableHead>Тайлбар</TableHead>
                                <TableHead className="text-right">Дүн</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {isTxLoading ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center">
                                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                                    </TableCell>
                                </TableRow>
                            ) : filteredTransactions.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={4} className="h-24 text-center text-gray-500">
                                        Гүйлгээ олдсонгүй
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredTransactions.map((tx: any) => (
                                    <TableRow key={tx.id}>
                                        <TableCell className="font-mono text-xs text-gray-600">
                                            {format(new Date(tx.createdAt), "yyyy-MM-dd HH:mm")}
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="outline" className={cn(
                                                "capitalize",
                                                tx.type === 'credit' ? "bg-green-50 text-green-700 border-green-200" : "bg-orange-50 text-orange-700 border-orange-200"
                                            )}>
                                                {tx.referenceType === 'meal_serving' ? 'Хоол'
                                                    : tx.referenceType === 'manual_topup' ? 'Цэнэглэлт'
                                                        : tx.referenceType === 'adjustment' && tx.amount > 0 ? 'Засвар (Нэмэгдсэн)'
                                                            : tx.referenceType === 'adjustment' && tx.amount < 0 ? 'Засвар (Хасагдсан)'
                                                                : tx.referenceType === 'meal_void_refund' ? 'Буцаалт'
                                                                    : 'Бусад'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-gray-600 font-medium">
                                            {tx.description}
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <span className={cn(
                                                "font-bold flex items-center justify-end gap-1",
                                                tx.type === 'credit' ? "text-green-600" : "text-gray-700"
                                            )}>
                                                {tx.type === 'credit' ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3 text-orange-400" />}
                                                {tx.type === 'credit' ? '+' : '-'}{Math.abs(tx.amount).toLocaleString()}₮
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                </CardContent>
            </Card>
        </div>
    );
}
