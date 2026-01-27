import { useState } from "react";
import { usePurchaseOrders, usePurchaseStats } from "@/hooks/use-purchase";
import { useProducts } from "@/hooks/use-products";
import { useContacts } from "@/hooks/use-contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Search, CheckCircle, Package, Trash2, TrendingDown, Clock, AlertCircle, ShoppingCart } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { format } from "date-fns";

const formatMNT = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(num) + '₮';
};

const purchaseOrderSchema = z.object({
  supplierId: z.string().min(1, "Нийлүүлэгч сонгоно уу"),
  orderDate: z.string().min(1),
  expectedDate: z.string().optional().or(z.literal("")),
  notes: z.string().optional(),
  lines: z.array(z.object({
    productId: z.string().min(1, "Бараа сонгоно уу"),
    quantity: z.number().min(0.01, "Тоо хэмжээ оруулна уу"),
    unitPrice: z.number().min(0, "Үнэ оруулна уу"),
    discount: z.number().min(0).max(100).optional(),
    taxRate: z.number().min(0).max(100).default(10),
  })).min(1, "Хамгийн багадаа 1 мөр нэмнэ үү"),
});

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;

const getStatusBadge = (status: string) => {
  switch (status) {
    case "draft": return <Badge variant="outline">Ноорог</Badge>;
    case "sent": return <Badge className="bg-yellow-100 text-yellow-800">Илгээсэн</Badge>;
    case "confirmed": return <Badge className="bg-blue-100 text-blue-800">Захиалсан</Badge>; // Ordered
    case "received": return <Badge className="bg-green-100 text-green-800">Хүлээн авсан</Badge>;
    case "cancelled": return <Badge variant="secondary" className="text-muted-foreground">Цуцлагдсан</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

export default function Purchase() {
  const { orders = [], isLoading, createOrder, confirmOrder, receiveOrder, bulkDelete } = usePurchaseOrders();
  const { products = [] } = useProducts();
  const { contacts: suppliers = [] } = useContacts("supplier");
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Stats
  const { data: stats, isLoading: statsLoading } = usePurchaseStats();

  const form = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: {
      supplierId: "",
      orderDate: format(new Date(), "yyyy-MM-dd"),
      expectedDate: "",
      notes: "",
      lines: [{ productId: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 10 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const onSubmit = async (data: PurchaseOrderFormValues) => {
    try {
      await createOrder.mutateAsync(data);
      toast({ title: "Амжилттай", description: "Худалдан авах захиалга үүсгэгдлээ." });
      setIsOpen(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Захиалга үүсгэхэд алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const handleConfirm = async (id: string) => {
    try {
      await confirmOrder.mutateAsync(id);
      toast({ title: "Амжилттай", description: "Захиалга баталгаажлаа." });
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Баталгаажуулахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const handleReceive = async (id: string) => {
    try {
      await receiveOrder.mutateAsync(id);
      toast({ title: "Амжилттай", description: "Захиалга хүлээн авлаа. Нөөц нэмэгдлээ." });
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Хүлээн авахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const filteredOrders = orders.filter((o) => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      if (!o.orderNumber?.toLowerCase().includes(searchLower) &&
        !o.supplierName?.toLowerCase().includes(searchLower)) {
        return false;
      }
    }
    // Status filter
    if (statusFilter !== "all" && o.status !== statusFilter) {
      return false;
    }
    return true;
  });

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredOrders.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredOrders.map(o => o.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const handleBulkDelete = async () => {
    if (!window.confirm("Зөвхөн НООРОГ (Draft) төлөвтэй захиалгууд устгагдах болно. Үргэлжлүүлэх үү?")) {
      return;
    }
    try {
      if (!bulkDelete) return; // Guard in case it's undefined
      const result = await bulkDelete.mutateAsync(Array.from(selectedIds));
      toast({
        title: "Амжилттай",
        description: result.message || `${result.deleted} захиалга устгагдлаа`
      });
      setSelectedIds(new Set());
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const calculateLineTotal = (line: any) => {
    const qty = Number(line.quantity || 0);
    const price = Number(line.unitPrice || 0);
    const discount = Number(line.discount || 0);
    const taxRate = Number(line.taxRate || 10);
    const subtotal = qty * price * (1 - discount / 100);
    const tax = subtotal * (taxRate / 100);
    return { subtotal, tax, total: subtotal + tax };
  };

  const calculateTotal = () => {
    const lines = form.watch("lines");
    let subtotal = 0;
    let tax = 0;
    lines.forEach((line) => {
      const calc = calculateLineTotal(line);
      subtotal += calc.subtotal;
      tax += calc.tax;
    });
    return { subtotal, tax, total: subtotal + tax };
  };

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Худалдан авалт
          </h2>
          <p className="text-muted-foreground mt-2">
            Худалдан авах захиалга, ханган нийлүүлэлт
          </p>
        </div>
        <Button onClick={() => setIsOpen(true)} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Захиалга үүсгэх
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Энэ сарын зарлага</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-blue-600">
                {formatMNT(stats?.thisMonthSpend || 0)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Хүлээгдэж буй</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-orange-600">
                {stats?.pendingDelivery || 0}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Төлөгдөөгүй нэхэмжлэх</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-red-600">
                {formatMNT(stats?.overdueBills || 0)}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 w-full md:w-auto">
          <div className="relative flex-1 md:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Нийлүүлэгч, дугаараар хайх..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Төлөв" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүгд</SelectItem>
              <SelectItem value="draft">Ноорог (Draft)</SelectItem>
              <SelectItem value="sent">Илгээсэн</SelectItem>
              <SelectItem value="confirmed">Захиалсан</SelectItem>
              <SelectItem value="received">Хүлээн авсан</SelectItem>
              <SelectItem value="cancelled">Цуцлагдсан</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4">
            <span className="text-sm text-muted-foreground">
              {selectedIds.size} сонгогдсон
            </span>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={bulkDelete?.isPending}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Устгах
            </Button>
          </div>
        )}
      </div>

      {/* Glass Table Container */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-white/5">
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="w-12 text-center">
                <Checkbox
                  checked={filteredOrders.length > 0 && selectedIds.size === filteredOrders.length}
                  onCheckedChange={toggleSelectAll}
                  className="border-white/20 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                />
              </TableHead>
              <TableHead className="text-slate-300">Захиалгын дугаар</TableHead>
              <TableHead className="text-slate-300">Нийлүүлэгч</TableHead>
              <TableHead className="text-slate-300">Огноо</TableHead>
              <TableHead className="text-slate-300">Хүлээн авах</TableHead>
              <TableHead className="text-slate-300">Төлөв</TableHead>
              <TableHead className="text-right text-slate-300">Нийт дүн</TableHead>
              <TableHead className="text-center text-slate-300">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="hover:bg-transparent border-white/5">
                <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                  Захиалга ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow className="hover:bg-transparent border-white/5">
                <TableCell colSpan={8} className="h-[400px] text-center">
                  <div className="flex flex-col items-center justify-center h-full text-slate-400">
                    <div className="h-16 w-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                      <ShoppingCart className="h-8 w-8 text-slate-500" />
                    </div>
                    <h3 className="text-lg font-medium text-slate-200 mb-1">
                      {search || statusFilter !== 'all' ? "Хайлтад тохирох зүйл олдсонгүй" : "Захиалга байхгүй байна"}
                    </h3>
                    <p className="text-sm max-w-sm mx-auto mb-4 text-slate-500">
                      {search || statusFilter !== 'all' ? "Хайлтын утгаа өөрчлөөд дахин оролдоно уу." : "Та одоогоор ханган нийлүүлэлтийн захиалга хийгээгүй байна."}
                    </p>
                    {!search && statusFilter === 'all' && (
                      <Button onClick={() => setIsOpen(true)} className="bg-blue-600 hover:bg-blue-700 text-white">
                        <Plus className="mr-2 h-4 w-4" />
                        Эхний захиалгаа үүсгэх
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id} className="hover:bg-white/5 transition-colors border-white/5 text-slate-200">
                  <TableCell className="text-center">
                    <Checkbox
                      checked={selectedIds.has(order.id)}
                      onCheckedChange={() => toggleSelectOne(order.id)}
                      className="border-white/20 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                    />
                  </TableCell>
                  <TableCell className="font-medium text-slate-200">{order.orderNumber}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8 ring-1 ring-white/10">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-slate-800 text-slate-300 text-xs">
                          {getInitials(order.supplierName || "?")}
                        </AvatarFallback>
                      </Avatar>
                      <span className="font-medium text-slate-300">{order.supplierName || "-"}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-400">{order.orderDate ? format(new Date(order.orderDate), "yyyy-MM-dd") : "-"}</TableCell>
                  <TableCell className="text-slate-400">{order.expectedDate ? format(new Date(order.expectedDate), "yyyy-MM-dd") : "-"}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-right font-semibold text-emerald-400">{formatMNT(order.totalAmount || "0")}</TableCell>
                  <TableCell>
                    <div className="flex justify-center gap-1">
                      {order.status === "confirmed" && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleReceive(order.id)}
                          disabled={receiveOrder.isPending}
                          className="text-blue-400 hover:text-blue-300 hover:bg-blue-500/10"
                        >
                          <Package className="h-4 w-4 mr-1" />
                          Хүлээн авах
                        </Button>
                      )}
                      {(order.status === "draft" || order.status === "sent") && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleConfirm(order.id)}
                          disabled={confirmOrder.isPending}
                          title="Баталгаажуулах"
                          className="text-emerald-500 hover:text-emerald-400 hover:bg-emerald-500/10 h-8 w-8"
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Шинэ худалдан авах захиалга</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              {/* Header Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-muted/10 p-4 rounded-lg">
                <FormField
                  control={form.control}
                  name="supplierId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Нийлүүлэгч *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="bg-white">
                            <SelectValue placeholder="Нийлүүлэгч сонгох" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {suppliers.map((s) => (
                            <SelectItem key={s.id} value={s.id}>
                              {s.companyName || `${s.firstName} ${s.lastName}`}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="orderDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Захиалгын огноо *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="bg-white" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="expectedDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Хүлээгдэж буй огноо</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} className="bg-white" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тэмдэглэл</FormLabel>
                      <FormControl>
                        <Input placeholder="Тэмдэглэл..." {...field} className="bg-white" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Order Lines */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-lg">Бараа жагсаалт</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ productId: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 10 })}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Бараа нэмэх
                  </Button>
                </div>

                <div className="border rounded-md overflow-hidden">
                  <Table>
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="w-[30%]">Бараа</TableHead>
                        <TableHead className="text-right w-[15%]">Тоо</TableHead>
                        <TableHead className="text-right w-[20%]">Нэгж үнэ</TableHead>
                        <TableHead className="text-right w-[15%]">Хөнгөлөлт %</TableHead>
                        <TableHead className="text-right w-[15%]">Нийт</TableHead>
                        <TableHead className="w-[5%]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => (
                        <TableRow key={field.id}>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`lines.${index}.productId`}
                              render={({ field }) => (
                                <FormItem className="mb-0">
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger className="h-8">
                                        <SelectValue placeholder="Сонгох" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {products.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                          {p.name} ({formatMNT(p.costPrice || "0")})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`lines.${index}.quantity`}
                              render={({ field }) => (
                                <FormItem className="mb-0">
                                  <FormControl>
                                    <Input
                                      type="number"
                                      className="h-8 text-right"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      onFocus={(e) => e.target.select()}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`lines.${index}.unitPrice`}
                              render={({ field }) => (
                                <FormItem className="mb-0">
                                  <FormControl>
                                    <Input
                                      type="number"
                                      className="h-8 text-right"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      onFocus={(e) => e.target.select()}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`lines.${index}.discount`}
                              render={({ field }) => (
                                <FormItem className="mb-0">
                                  <FormControl>
                                    <Input
                                      type="number"
                                      className="h-8 text-right"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                      onFocus={(e) => e.target.select()}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-right font-medium">
                            {formatMNT(calculateLineTotal(form.watch(`lines.${index}`)).total)}
                          </TableCell>
                          <TableCell>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-destructive"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Footer Totals */}
              <div className="flex justify-end pt-4 border-t">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Дэд дүн:</span>
                    <span>{formatMNT(calculateTotal().subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>НӨАТ (10%):</span>
                    <span>{formatMNT(calculateTotal().tax)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg pt-2 border-t text-primary">
                    <span>Нийт дүн:</span>
                    <span>{formatMNT(calculateTotal().total)}</span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => setIsOpen(false)}>
                  Цуцлах
                </Button>
                <Button type="submit" disabled={createOrder.isPending}>
                  {createOrder.isPending ? "Хадгалагдаж байна..." : "Хадгалах"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
