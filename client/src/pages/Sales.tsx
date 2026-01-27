import { useState, useEffect } from "react";
import { useSalesOrders, useSalesStats, useSalesOrderDetails } from "@/hooks/use-sales";
import { useProducts } from "@/hooks/use-products";
import { useContacts } from "@/hooks/use-contacts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportToCSV, formatNumberForCSV } from "@/lib/export-utils";
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Plus, Search, Send, CheckCircle, FileText, Trash2, TrendingUp, DollarSign, Eye } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

const formatMNT = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(num) + '₮';
};

const salesOrderSchema = z.object({
  customerId: z.string().min(1, "Үйлчлүүлэгч сонгоно уу"),
  orderDate: z.string().min(1),
  deliveryDate: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    productId: z.string().min(1, "Бараа сонгоно уу"),
    quantity: z.number().min(0.01, "Тоо хэмжээ оруулна уу"),
    unitPrice: z.number().min(0, "Үнэ оруулна уу"),
    discount: z.number().min(0).max(100).optional(),
    taxRate: z.number().min(0).max(100).default(10),
  })).min(1, "Хамгийн багадаа 1 мөр нэмнэ үү"),
});

type SalesOrderFormValues = z.infer<typeof salesOrderSchema>;

const getStatusBadge = (status: string) => {
  switch (status) {
    case "draft": return <Badge variant="outline">Ноорог</Badge>;
    case "quotation": return <Badge className="bg-blue-100 text-blue-800">Үнэлгээ</Badge>;
    case "sent": return <Badge className="bg-yellow-100 text-yellow-800">Илгээсэн</Badge>;
    case "confirmed": return <Badge className="bg-green-100 text-green-800">Баталгаажсан</Badge>;
    case "invoiced": return <Badge className="bg-purple-100 text-purple-800">Нэхэмжлэгдсэн</Badge>;
    case "cancelled": return <Badge variant="destructive">Цуцлагдсан</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

const getPaymentStatusBadge = (order: any) => {
  const total = parseFloat(order.totalAmount || "0");
  const paid = parseFloat(order.paidAmount || "0");

  if (paid >= total && total > 0) {
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">Төлөгдсөн</Badge>;
  } else if (paid > 0) {
    return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100">Хэсэгчлэн</Badge>;
  } else {
    return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100">Төлөгдөөгүй</Badge>;
  }
};

export default function Sales() {
  const { orders = [], isLoading, createOrder, confirmOrder, sendOrder, createInvoice, bulkCancel, bulkDelete } = useSalesOrders();
  const { products = [] } = useProducts();
  const { contacts: customers = [] } = useContacts("customer");
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);
  const [viewOrderId, setViewOrderId] = useState<string | null>(null);

  // Filter states
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [dateRangeFilter, setDateRangeFilter] = useState<string>("all"); // all, thisMonth, lastMonth, custom
  const [customStartDate, setCustomStartDate] = useState<string>("");
  const [customEndDate, setCustomEndDate] = useState<string>("");

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sales stats for KPI cards
  const { data: stats, isLoading: statsLoading } = useSalesStats();

  const form = useForm<SalesOrderFormValues>({
    resolver: zodResolver(salesOrderSchema),
    defaultValues: {
      customerId: "",
      orderDate: format(new Date(), "yyyy-MM-dd"),
      deliveryDate: "",
      notes: "",
      lines: [{ productId: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 10 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const onSubmit = async (data: SalesOrderFormValues) => {
    try {
      await createOrder.mutateAsync(data);
      toast({ title: "Амжилттай", description: "Борлуулалтын захиалга үүсгэгдлээ." });
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
      toast({ title: "Амжилттай", description: "Захиалга баталгаажлаа. Нөөц захиалгдлаа." });
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Баталгаажуулахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const handleSend = async (id: string) => {
    try {
      await sendOrder.mutateAsync(id);
      toast({ title: "Амжилттай", description: "Захиалга илгээгдлээ." });
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Илгээхэд алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const handleCreateInvoice = async (id: string) => {
    try {
      await createInvoice.mutateAsync(id);
      toast({ title: "Амжилттай", description: "Нэхэмжлэх үүсгэгдлээ." });
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Нэхэмжлэх үүсгэхэд алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

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

  const clearSelection = () => setSelectedIds(new Set());

  // Bulk action handlers
  const handleBulkCancel = async () => {
    try {
      const result = await bulkCancel.mutateAsync(Array.from(selectedIds));
      toast({
        title: "Амжилттай",
        description: result.message || `${result.updated} захиалга цуцлагдлаа`
      });
      if (result.errors?.length > 0) {
        console.warn("Bulk cancel warnings:", result.errors);
      }
      clearSelection();
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleBulkDelete = async () => {
    if (!window.confirm("Зөвхөн НООРОГ захиалгууд устгагдах болно. Үргэлжлүүлэх үү?")) {
      return;
    }
    try {
      const result = await bulkDelete.mutateAsync(Array.from(selectedIds));
      toast({
        title: "Амжилттай",
        description: result.message || `${result.deleted} ноорог захиалга устгагдлаа`
      });
      if (result.errors?.length > 0) {
        toast({
          title: "Анхааруулга",
          description: `${result.errors.length} захиалга устгагдсангүй`,
          variant: "destructive",
        });
        console.warn("Delete errors:", result.errors);
      }
      clearSelection();
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleBulkExport = () => {
    const selectedOrders = orders.filter(o => selectedIds.has(o.id));

    const dataToExport = selectedOrders.map(o => ({
      orderNumber: o.orderNumber || "",
      customerName: o.customerName || "",
      orderDate: o.orderDate || "",
      deliveryDate: o.deliveryDate || "",
      status: o.status || "",
      totalAmount: formatNumberForCSV(o.totalAmount),
      paidAmount: formatNumberForCSV(o.paidAmount),
      notes: o.notes || "",
    }));

    exportToCSV(
      dataToExport,
      [
        { key: "orderNumber", label: "Захиалгын дугаар" },
        { key: "customerName", label: "Үйлчлүүлэгч" },
        { key: "orderDate", label: "Огноо" },
        { key: "deliveryDate", label: "Хүргэлтийн огноо" },
        { key: "status", label: "Төлөв" },
        { key: "totalAmount", label: "Нийт дүн (₮)" },
        { key: "paidAmount", label: "Төлсөн (₮)" },
        { key: "notes", label: "Тэмдэглэл" },
      ],
      `борлуулалт_${new Date().toISOString().split("T")[0]}.csv`
    );

    toast({
      title: "Амжилттай",
      description: `${selectedOrders.length} захиалга экспортлогдлоо`,
      variant: "success",
    });
  };

  // Calculate date ranges for filters
  const getDateRange = () => {
    const now = new Date();
    if (dateRangeFilter === "thisMonth") {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      return { start, end };
    } else if (dateRangeFilter === "lastMonth") {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start, end };
    } else if (dateRangeFilter === "custom" && customStartDate && customEndDate) {
      return {
        start: new Date(customStartDate),
        end: new Date(customEndDate)
      };
    }
    return null;
  };

  const filteredOrders = orders.filter((o) => {
    // Search filter
    if (search) {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        o.orderNumber?.toLowerCase().includes(searchLower) ||
        o.customerName?.toLowerCase().includes(searchLower);
      if (!matchesSearch) return false;
    }

    // Status filter
    if (statusFilter !== "all" && o.status !== statusFilter) {
      return false;
    }

    // Payment status filter
    if (paymentFilter !== "all") {
      const total = parseFloat(o.totalAmount || "0");
      const paid = parseFloat(o.paidAmount || "0");

      if (paymentFilter === "paid" && !(paid >= total && total > 0)) {
        return false;
      } else if (paymentFilter === "partial" && !(paid > 0 && paid < total)) {
        return false;
      } else if (paymentFilter === "unpaid" && paid !== 0) {
        return false;
      }
    }

    // Date range filter
    const dateRange = getDateRange();
    if (dateRange && o.orderDate) {
      const orderDate = new Date(o.orderDate);
      if (orderDate < dateRange.start || orderDate > dateRange.end) {
        return false;
      }
    }

    return true;
  });

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
            Борлуулалт
          </h2>
          <p className="text-muted-foreground mt-2">
            Борлуулалтын захиалга, үнэлгээ
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
            <CardTitle className="text-sm font-medium">Энэ сарын борлуулалт</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {formatMNT(stats?.thisMonthSales || 0)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Төлөгдөөгүй үлдэгдэл</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-orange-600">
                {formatMNT(stats?.arOutstanding || 0)}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Нийт захиалга</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold">
                {stats?.totalOrders || 0}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Search Bar */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Захиалгаар хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Filter Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 p-4 bg-muted/50 rounded-lg border">
        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Төлөв</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Бүгд" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүгд</SelectItem>
              <SelectItem value="draft">Ноорог</SelectItem>
              <SelectItem value="sent">Илгээсэн</SelectItem>
              <SelectItem value="confirmed">Баталгаажсан</SelectItem>
              <SelectItem value="invoiced">Нэхэмжлэгдсэн</SelectItem>
              <SelectItem value="cancelled">Цуцлагдсан</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Төлбөрийн төлөв</label>
          <Select value={paymentFilter} onValueChange={setPaymentFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Бүгд" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүгд</SelectItem>
              <SelectItem value="paid">Төлөгдсөн</SelectItem>
              <SelectItem value="partial">Хэсэгчлэн</SelectItem>
              <SelectItem value="unpaid">Төлөгдөөгүй</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground">Хугацаа</label>
          <Select value={dateRangeFilter} onValueChange={setDateRangeFilter}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Бүгд" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүгд</SelectItem>
              <SelectItem value="thisMonth">Энэ сар</SelectItem>
              <SelectItem value="lastMonth">Өнгөрсөн сар</SelectItem>
              <SelectItem value="custom">Тусгай...</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-end">
          <Button
            variant="outline"
            size="sm"
            className="h-9"
            onClick={() => {
              setStatusFilter("all");
              setPaymentFilter("all");
              setDateRangeFilter("all");
              setCustomStartDate("");
              setCustomEndDate("");
            }}
          >
            Шүүлтүүр цэвэрлэх
          </Button>
        </div>
      </div>

      {/* Custom Date Range (shown when dateRangeFilter === "custom") */}
      {dateRangeFilter === "custom" && (
        <div className="grid grid-cols-2 gap-3 p-4 bg-muted/30 rounded-lg border">
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Эхлэх огноо</label>
            <Input
              type="date"
              value={customStartDate}
              onChange={(e) => setCustomStartDate(e.target.value)}
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground">Дуусах огноо</label>
            <Input
              type="date"
              value={customEndDate}
              onChange={(e) => setCustomEndDate(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      )}

      {/* Bulk Selection Header */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} захиалга сонгогдсон
          </span>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Үйлдэл <span className="ml-1">▼</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleBulkCancel}>
                  🚫 Бөөнөөр цуцлах
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBulkExport}>
                  📤 Excel татах
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleBulkDelete}
                  className="text-destructive"
                >
                  🗑️ Ноорог устгах
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
            >
              Болих
            </Button>
          </div>
        </div>
      )}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === filteredOrders.length && filteredOrders.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Захиалгын дугаар</TableHead>
              <TableHead>Үйлчлүүлэгч</TableHead>
              <TableHead>Огноо</TableHead>
              <TableHead>Хүргэлтийн огноо</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead>Төлбөрийн төлөв</TableHead>
              <TableHead className="text-right">Нийт дүн</TableHead>
              <TableHead>Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Захиалга ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  {search ? "Хайлтад тохирох захиалга олдсонгүй." : "Захиалга байхгүй байна."}
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell>
                    <Checkbox
                      checked={selectedIds.has(order.id)}
                      onCheckedChange={() => toggleSelectOne(order.id)}
                    />
                  </TableCell>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                  <TableCell>{order.customerName || "-"}</TableCell>
                  <TableCell>{order.orderDate ? format(new Date(order.orderDate), "yyyy-MM-dd") : "-"}</TableCell>
                  <TableCell>{order.deliveryDate ? format(new Date(order.deliveryDate), "yyyy-MM-dd") : "-"}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell>{getPaymentStatusBadge(order)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatMNT(order.totalAmount || "0")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setViewOrderId(order.id)}
                        title="Дэлгэрэнгүй харах"
                      >
                        <Eye className="h-3 w-3" />
                      </Button>
                      {order.status === "draft" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSend(order.id)}
                          disabled={sendOrder.isPending}
                        >
                          <Send className="h-3 w-3" />
                        </Button>
                      )}
                      {(order.status === "sent" || order.status === "quotation") && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleConfirm(order.id)}
                          disabled={confirmOrder.isPending}
                        >
                          <CheckCircle className="h-3 w-3" />
                        </Button>
                      )}
                      {order.status === "confirmed" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCreateInvoice(order.id)}
                          disabled={createInvoice.isPending}
                        >
                          <FileText className="h-3 w-3" />
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
            <DialogTitle>Шинэ борлуулалтын захиалга</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Үйлчлүүлэгч *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Үйлчлүүлэгч сонгох" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {customers.map((c) => (
                            <SelectItem key={c.id} value={c.id}>
                              {c.companyName || `${c.firstName} ${c.lastName}`}
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
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="deliveryDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Хүргэлтийн огноо</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
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
                        <Input placeholder="Нэмэлт тайлбар..." {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Захиалгын бараанууд</h4>
                </div>

                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[40px]">№</TableHead>
                        <TableHead className="w-[30%]">Бараа / Үйлчилгээ</TableHead>
                        <TableHead className="text-right">Тоо ширхэг</TableHead>
                        <TableHead className="text-right">Нэгж үнэ</TableHead>
                        <TableHead className="text-right">Хөнгөлөлт (%)</TableHead>
                        <TableHead className="text-right">Нийт дүн</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => (
                        <TableRow key={field.id}>
                          <TableCell className="font-medium text-muted-foreground">
                            {index + 1}
                          </TableCell>
                          <TableCell>
                            <FormField
                              control={form.control}
                              name={`lines.${index}.productId`}
                              render={({ field }) => (
                                <FormItem className="mb-0">
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Бараа сонгох" />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      {products.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                          {p.name} ({formatMNT(p.salePrice || "0")})
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
                                      className="text-right"
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
                                      className="text-right"
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
                                      className="text-right"
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
                  <div className="p-4 border-t bg-muted/50">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => append({ productId: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 10 })}
                      className="font-medium text-primary hover:text-primary"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Бараа нэмэх
                    </Button>
                  </div>
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="space-y-2 text-right">
                  <div className="flex justify-end gap-4">
                    <span>Дэд дүн:</span>
                    <span className="font-semibold">{formatMNT(calculateTotal().subtotal)}</span>
                  </div>
                  <div className="flex justify-end gap-4">
                    <span>ХХОАТ (10%):</span>
                    <span className="font-semibold">{formatMNT(calculateTotal().tax)}</span>
                  </div>
                  <div className="flex justify-end gap-4 text-lg font-bold border-t pt-2">
                    <span>Нийт дүн:</span>
                    <span className="text-primary">{formatMNT(calculateTotal().total)}</span>
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

      {/* Sales Order Details Drawer */}
      <Sheet open={!!viewOrderId} onOpenChange={() => setViewOrderId(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-xl">
              Захиалгын дэлгэрэнгүй
            </SheetTitle>
          </SheetHeader>
          <SalesOrderDetailsContent orderId={viewOrderId} />
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Separate component for order details to keep main component clean
function SalesOrderDetailsContent({ orderId }: { orderId: string | null }) {
  const { data: order, isLoading } = useSalesOrderDetails(orderId);

  if (isLoading) {
    return (
      <div className="py-8 space-y-4">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="py-8 text-center text-muted-foreground">
        Захиалга олдсонгүй
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-6">
      {/* Header Info */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Захиалгын дугаар:</span>
          <span className="font-mono font-semibold">{order.orderNumber}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Төлөв:</span>
          {getStatusBadge(order.status)}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Огноо:</span>
          <span>{order.orderDate ? format(new Date(order.orderDate), "yyyy-MM-dd") : "-"}</span>
        </div>
        {order.deliveryDate && (
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Хүргэлтийн огноо:</span>
            <span>{format(new Date(order.deliveryDate), "yyyy-MM-dd")}</span>
          </div>
        )}
      </div>

      {/* Customer Info */}
      <div className="border-t pt-4 space-y-2">
        <h4 className="font-semibold">Үйлчлүүлэгчийн мэдээлэл</h4>
        <div className="text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Нэр:</span>
            <span>{order.customerName || "-"}</span>
          </div>
          {order.customerEmail && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">И-мэйл:</span>
              <span className="text-blue-600">{order.customerEmail}</span>
            </div>
          )}
          {order.customerPhone && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Утас:</span>
              <span>{order.customerPhone}</span>
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="border-t pt-4">
        <h4 className="font-semibold mb-3">Барааны жагсаалт</h4>
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Бараа</TableHead>
                <TableHead className="text-right">Тоо</TableHead>
                <TableHead className="text-right">Үнэ</TableHead>
                <TableHead className="text-right">Дүн</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {order.lines?.map((line: any) => (
                <TableRow key={line.id}>
                  <TableCell className="font-medium">
                    {line.productName || line.productId}
                  </TableCell>
                  <TableCell className="text-right">{line.quantity}</TableCell>
                  <TableCell className="text-right">{formatMNT(line.unitPrice)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatMNT(line.total)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      {/* Totals */}
      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span>Дэд дүн:</span>
          <span className="font-semibold">{formatMNT(order.subtotal || "0")}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span>ХХОАТ ({order.lines?.[0]?.taxRate || "10"}%):</span>
          <span className="font-semibold">{formatMNT(order.taxAmount || "0")}</span>
        </div>
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>Нийт дүн:</span>
          <span className="text-primary">{formatMNT(order.totalAmount || "0")}</span>
        </div>
        <div className="flex justify-between text-sm text-green-600">
          <span>Төлөгдсөн:</span>
          <span className="font-semibold">{formatMNT(order.paidAmount || "0")}</span>
        </div>
        <div className="flex justify-between text-sm text-orange-600">
          <span>Үлдэгдэл:</span>
          <span className="font-semibold">{formatMNT(order.remainingAmount || "0")}</span>
        </div>
      </div>

      {/* Notes */}
      {order.notes && (
        <div className="border-t pt-4">
          <h4 className="font-semibold mb-2">Тэмдэглэл</h4>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{order.notes}</p>
        </div>
      )}
    </div>
  );
}
