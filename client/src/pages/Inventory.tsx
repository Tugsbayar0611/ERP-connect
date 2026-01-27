import { useState } from "react";
import { useStockLevels, useInventoryStats, useInventoryBulkAction } from "@/hooks/use-inventory";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useWarehouses } from "@/hooks/use-warehouses";
import { useProducts } from "@/hooks/use-products";
import { useStockMovements, useCreateStockMovement, useExpiryAlerts, type CreateStockMovementInput } from "@/hooks/use-stock-movements";
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
import { Plus, Search, AlertTriangle, Package, TrendingUp, TrendingDown, RefreshCw, Sparkles, DollarSign, Clock, AlertCircle, Trash2, RotateCcw, X, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  insertWarehouseSchema,
  type InsertWarehouse,
} from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";
import { useDebounce } from "@/hooks/use-debounce";

// Helper to handle null values in form fields
const fieldValue = (value: string | null | undefined) => value ?? "";

const formatMNT = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(num) + '₮';
};

const getInitials = (name: string) => {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
};

const stockMovementSchema = z.object({
  warehouseId: z.string().min(1, "Агуулах сонгоно уу"),
  productId: z.string().min(1, "Бараа сонгоно уу"),
  quantity: z.number().min(0.01, "Тоо хэмжээ оруулна уу"),
  type: z.enum(["in", "out", "adjustment", "transfer"]),
  batchNumber: z.string().optional(),
  expiryDate: z.string().optional(),
  reference: z.string().optional(),
  note: z.string().optional(),
});

type StockMovementFormValues = z.infer<typeof stockMovementSchema>;

export default function Inventory() {
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [activeTab, setActiveTab] = useState<"levels" | "movements" | "alerts">("levels");

  const { levels = [], isLoading } = useStockLevels(warehouseFilter === "all" ? undefined : warehouseFilter);
  const { warehouses = [], isLoading: warehousesLoading, createWarehouse } = useWarehouses();
  const { products = [] } = useProducts();
  const { movements = [], isLoading: movementsLoading } = useStockMovements(
    warehouseFilter === "all" ? undefined : warehouseFilter
  );
  const { alerts = [] } = useExpiryAlerts(30, warehouseFilter === "all" ? undefined : warehouseFilter);

  const [statusFilter, setStatusFilter] = useState<string[]>([]);
  const [movementTypeFilter, setMovementTypeFilter] = useState<string[]>([]);
  const [expiryFilter, setExpiryFilter] = useState<string[]>([]);

  // Filter Logic
  const filteredLevels = levels.filter((level: any) => {
    // Search filter
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      const productName = level.productName?.toLowerCase() || "";
      const productSku = level.productSku?.toLowerCase() || "";
      const warehouseName = level.warehouseName?.toLowerCase() || "";
      if (!productName.includes(searchLower) && !productSku.includes(searchLower) && !warehouseName.includes(searchLower)) return false;
    }

    // Status Filter
    if (statusFilter.length > 0) {
      const quantity = Number(level.quantity || 0);
      let status = "available";
      if (quantity <= 0) status = "out_of_stock";
      else if (quantity < 10) status = "low_stock";

      if (!statusFilter.includes(status)) return false;
    }

    return true;
  });

  const filteredMovements = movements.filter((mov: any) => {
    // Movement Type Filter
    if (movementTypeFilter.length > 0 && !movementTypeFilter.includes(mov.type)) {
      return false;
    }

    if (!debouncedSearch) return true;
    const searchLower = debouncedSearch.toLowerCase();
    return (
      mov.productName?.toLowerCase().includes(searchLower) ||
      mov.productSku?.toLowerCase().includes(searchLower) ||
      mov.warehouseName?.toLowerCase().includes(searchLower) ||
      mov.batchNumber?.toLowerCase().includes(searchLower) ||
      mov.reference?.toLowerCase().includes(searchLower) ||
      mov.note?.toLowerCase().includes(searchLower)
    );
  });

  const filteredAlerts = alerts.filter((alert: any) => {
    // Expiry Status Filter
    if (expiryFilter.length > 0) {
      const isExpired = alert.daysUntilExpiry < 0;
      const isUrgent = alert.daysUntilExpiry >= 0 && alert.daysUntilExpiry <= 7;
      const isWarning = alert.daysUntilExpiry > 7 && alert.daysUntilExpiry <= 30;

      const matchesExpired = expiryFilter.includes('expired') && isExpired;
      const matchesUrgent = expiryFilter.includes('urgent') && isUrgent;
      const matchesWarning = expiryFilter.includes('warning') && isWarning;

      if (!matchesExpired && !matchesUrgent && !matchesWarning) return false;
    }

    if (!debouncedSearch) return true;
    const searchLower = debouncedSearch.toLowerCase();
    return (
      alert.productName?.toLowerCase().includes(searchLower) ||
      alert.productSku?.toLowerCase().includes(searchLower) ||
      alert.warehouseName?.toLowerCase().includes(searchLower) ||
      alert.batchNumber?.toLowerCase().includes(searchLower)
    );
  });

  // Selection State
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      const allIds = filteredLevels.map((l: any) => l.id);
      setSelectedIds(allIds);
    } else {
      setSelectedIds([]);
    }
  };
  const toggleSelectRow = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };




  // New Stats Hook
  const { stats, isLoading: statsLoading } = useInventoryStats();
  const bulkAction = useInventoryBulkAction();

  const handleBulkAction = async (action: "delete" | "reset") => {
    if (!confirm(action === "delete" ? "Сонгосон бараануудыг устгахдаа итгэлтэй байна уу?" : "Сонгосон бараануудын нөөцийг тэглэхдээ итгэлтэй байна уу?")) return;

    try {
      await bulkAction.mutateAsync({ action, ids: selectedIds });
      toast({ title: "Амжилттай", description: "Үйлдэл амжилттай хийгдлээ." });
      setSelectedIds([]);
    } catch (error: any) {
      toast({
        title: "Алдаа",
        description: error.message || "Үйлдэл хийхэд алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const createMovement = useCreateStockMovement();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [isMovementOpen, setIsMovementOpen] = useState(false);

  const form = useForm<InsertWarehouse>({
    resolver: zodResolver(insertWarehouseSchema),
    defaultValues: {
      name: "",
      code: "",
      address: "",
      isDefault: false,
    },
  });

  const movementForm = useForm<StockMovementFormValues>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: {
      warehouseId: "",
      productId: "",
      quantity: 0,
      type: "in",
      batchNumber: "",
      expiryDate: "",
      reference: "",
      note: "",
    },
  });

  const handleAdd = () => {
    form.reset({
      name: "",
      code: "",
      address: "",
      isDefault: false,
    });
    setIsOpen(true);
  };

  const onSubmit = async (data: InsertWarehouse) => {
    try {
      await createWarehouse.mutateAsync(data);
      toast({ title: "Амжилттай", description: "Шинэ агуулах нэмэгдлээ." });
      setIsOpen(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Агуулах нэмэхэд алдаа гарлаа",
        variant: "destructive",
      });
    }
  };



  const handleMovementAdd = () => {
    movementForm.reset({
      warehouseId: warehouseFilter !== "all" ? warehouseFilter : "",
      productId: "",
      quantity: 0,
      type: "out", // Default to 'out' or keep generic
      batchNumber: "",
      expiryDate: "",
      reference: "",
      note: "",
    });
    setIsMovementOpen(true);
  };

  const onMovementSubmit = async (data: StockMovementFormValues) => {
    try {
      // Check if product requires expiry tracking
      const product = products.find(p => p.id === data.productId);
      if (product && (product as any).trackExpiry && data.type === "out") {
        if (!data.batchNumber) {
          toast({
            title: "Алдаа",
            description: "Batch number шаардлагатай (trackExpiry product)",
            variant: "destructive",
          });
          return;
        }
        if (!data.expiryDate) {
          toast({
            title: "Алдаа",
            description: "Expiry date шаардлагатай (trackExpiry product)",
            variant: "destructive",
          });
          return;
        }
      }

      const payload: CreateStockMovementInput = {
        warehouseId: data.warehouseId,
        productId: data.productId,
        quantity: data.quantity,
        type: data.type,
        batchNumber: data.batchNumber || undefined,
        expiryDate: data.expiryDate || undefined,
        reference: data.reference || undefined,
        note: data.note || undefined,
      };

      // Validation for "Out" movement
      if (data.type === "out") {
        const currentLevel = levels.find(l =>
          l.productId === data.productId &&
          l.warehouseId === data.warehouseId
        );
        const currentQty = currentLevel ? Number(currentLevel.quantity) : 0;

        if (data.quantity > currentQty) {
          toast({
            title: "Алдаа",
            description: `Үлдэгдэл хүрэлцэхгүй байна. (Одоогийн үлдэгдэл: ${currentQty})`,
            variant: "destructive",
          });
          return;
        }
      }

      await createMovement.mutateAsync(payload);
      toast({ title: "Амжилттай", description: "Stock movement үүсгэгдлээ." });
      setIsMovementOpen(false);
      movementForm.reset();
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Stock movement үүсгэхэд алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const selectedProductId = movementForm.watch("productId");
  const selectedWarehouseId = movementForm.watch("warehouseId");
  const selectedQuantity = movementForm.watch("quantity");
  const movementType = movementForm.watch("type");

  const selectedProduct = products.find(p => p.id === selectedProductId);
  const requiresExpiry = selectedProduct && (selectedProduct as any).trackExpiry;

  const [fefoSuggestions, setFefoSuggestions] = useState<any[]>([]);
  const [loadingFEFO, setLoadingFEFO] = useState(false);

  const handleFEFOSuggest = async () => {
    if (!selectedProductId || !selectedWarehouseId || !selectedQuantity) {
      toast({
        title: "Алдаа",
        description: "Бараа, агуулах, тоо хэмжээ сонгоно уу",
        variant: "destructive",
      });
      return;
    }

    setLoadingFEFO(true);
    try {
      const res = await fetch(
        `/api/stock/fefo-suggest?productId=${selectedProductId}&warehouseId=${selectedWarehouseId}&quantity=${selectedQuantity}`,
        { credentials: "include" }
      );
      if (!res.ok) throw new Error("FEFO suggest авахад алдаа гарлаа");
      const suggestions = await res.json();
      setFefoSuggestions(suggestions);

      if (suggestions.length > 0) {
        // Auto-fill with first suggestion (earliest expiry)
        const first = suggestions[0];
        movementForm.setValue("batchNumber", first.batchNumber || "");
        movementForm.setValue("expiryDate", first.expiryDate);
        toast({
          title: "Санал болгосон",
          description: `Хамгийн ойрын хугацаа: ${first.expiryDate} (${first.daysUntilExpiry} хоног үлдлээ)`,
        });
      } else {
        toast({
          title: "Мэдээлэл",
          description: "Санал болгох batch олдсонгүй",
        });
      }
    } catch (error: any) {
      toast({
        title: "Алдаа",
        description: error.message || "FEFO suggest авахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setLoadingFEFO(false);
    }
  };

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Агуулах
          </h2>
          <p className="text-muted-foreground mt-2">
            Барааны нөөц, хөдөлгөөн, агуулахуудын удирдлага
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleMovementAdd} variant="outline" className="w-full sm:w-auto">
            <Package className="mr-2 h-4 w-4" />
            Хөдөлгөөн нэмэх
          </Button>
          <Button onClick={handleAdd} className="w-full sm:w-auto" variant="secondary">
            <Plus className="mr-2 h-4 w-4" />
            Агуулах нэмэх
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Нийт өртөг</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-green-600">
                {formatMNT(stats?.totalValue || 0)}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">Агуулах дахь нийт барааны өртөг</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Дуусаж буй бараа</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-yellow-600">
                {stats?.lowStockCount || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">10-аас доош үлдэгдэлтэй</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Хугацаа дөхсөн</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {statsLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="text-2xl font-bold text-red-600">
                {stats?.expiringCount || 0}
              </div>
            )}
            <p className="text-xs text-muted-foreground mt-1">30 хоногт хугацаа нь дуусах</p>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center gap-4">
        <Select value={warehouseFilter} onValueChange={setWarehouseFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Агуулах сонгох" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх агуулах</SelectItem>
            {warehouses.map((w) => (
              <SelectItem key={w.id} value={w.id}>
                {w.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Бараагаар хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className="h-10 gap-2">
              <Filter className="h-4 w-4" />
              Шүүлтүүр
              {(activeTab === 'levels' && statusFilter.length > 0) ||
                (activeTab === 'movements' && movementTypeFilter.length > 0) ||
                (activeTab === 'alerts' && expiryFilter.length > 0) ? (
                <Badge variant="secondary" className="h-5 px-1.5 text-xs">
                  {activeTab === 'levels' ? statusFilter.length :
                    activeTab === 'movements' ? movementTypeFilter.length :
                      expiryFilter.length}
                </Badge>
              ) : null}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[200px] p-0" align="end">
            <div className="p-2 space-y-2">
              {activeTab === 'levels' && (
                <>
                  <div className="font-medium text-sm px-2 text-muted-foreground mb-2">Нөөцийн төлөв</div>
                  {['available', 'low_stock', 'out_of_stock'].map(status => (
                    <div key={status} className="flex items-center space-x-2 px-2 py-1 hover:bg-muted/50 rounded-sm cursor-pointer" onClick={() => {
                      setStatusFilter(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
                    }}>
                      <Checkbox checked={statusFilter.includes(status)} />
                      <span className="text-sm">
                        {status === 'available' ? 'Хэвийн' : status === 'low_stock' ? 'Багасч байна' : 'Дууссан'}
                      </span>
                    </div>
                  ))}
                  {statusFilter.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full mt-2 h-8 text-xs" onClick={() => setStatusFilter([])}>
                      Цэвэрлэх
                    </Button>
                  )}
                </>
              )}

              {activeTab === 'movements' && (
                <>
                  <div className="font-medium text-sm px-2 text-muted-foreground mb-2">Хөдөлгөөний төрөл</div>
                  {['in', 'out', 'transfer'].map(type => (
                    <div key={type} className="flex items-center space-x-2 px-2 py-1 hover:bg-muted/50 rounded-sm cursor-pointer" onClick={() => {
                      setMovementTypeFilter(prev => prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]);
                    }}>
                      <Checkbox checked={movementTypeFilter.includes(type)} />
                      <span className="text-sm">
                        {type === 'in' ? 'Орлого' : type === 'out' ? 'Зарлага' : 'Шилжүүлэлт'}
                      </span>
                    </div>
                  ))}
                  {movementTypeFilter.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full mt-2 h-8 text-xs" onClick={() => setMovementTypeFilter([])}>
                      Цэвэрлэх
                    </Button>
                  )}
                </>
              )}

              {activeTab === 'alerts' && (
                <>
                  <div className="font-medium text-sm px-2 text-muted-foreground mb-2">Хугацааны төлөв</div>
                  {['expired', 'urgent', 'warning'].map(status => (
                    <div key={status} className="flex items-center space-x-2 px-2 py-1 hover:bg-muted/50 rounded-sm cursor-pointer" onClick={() => {
                      setExpiryFilter(prev => prev.includes(status) ? prev.filter(s => s !== status) : [...prev, status]);
                    }}>
                      <Checkbox checked={expiryFilter.includes(status)} />
                      <span className="text-sm">
                        {status === 'expired' ? 'Хугацаа дууссан' : status === 'urgent' ? 'Яаралтай (<7 хоног)' : 'Анхааруулга (<30 хоног)'}
                      </span>
                    </div>
                  ))}
                  {expiryFilter.length > 0 && (
                    <Button variant="ghost" size="sm" className="w-full mt-2 h-8 text-xs" onClick={() => setExpiryFilter([])}>
                      Цэвэрлэх
                    </Button>
                  )}
                </>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="levels">Нөөц</TabsTrigger>
          <TabsTrigger value="movements">Хөдөлгөөн</TabsTrigger>
          <TabsTrigger value="alerts">
            Хугацаа дуусах
            {alerts.length > 0 && (
              <Badge variant="destructive" className="ml-2">
                {alerts.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="levels" className="space-y-4">
          {/* Glass Table Container - Levels */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="w-[40px] text-center">
                    <Checkbox
                      checked={filteredLevels.length > 0 && selectedIds.length === filteredLevels.length}
                      onCheckedChange={toggleSelectAll}
                      className="border-white/20 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                    />
                  </TableHead>
                  <TableHead className="text-slate-300">Бараа</TableHead>
                  <TableHead className="text-slate-300">Агуулах</TableHead>
                  <TableHead className="text-right text-slate-300">Нөөц</TableHead>
                  <TableHead className="w-[150px] text-center text-slate-300">Түвшин</TableHead>
                  <TableHead className="text-right text-slate-300">Захиалгдсан</TableHead>
                  <TableHead className="text-right text-slate-300">Боломжтой</TableHead>
                  <TableHead className="text-slate-300">Төлөв</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                      Нөөцийн мэдээлэл ачааллаж байна...
                    </TableCell>
                  </TableRow>
                ) : filteredLevels.length === 0 ? (
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                      {search ? "Хайлтад тохирох нөөц олдсонгүй." : "Нөөцийн мэдээлэл байхгүй байна."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredLevels.map((level: any) => {
                    const quantity = Number(level.quantity || 0);
                    const reserved = Number(level.reservedQuantity || 0);
                    const available = quantity - reserved;
                    const maxStock = 100; // Arbitrary max for visualization
                    const percentage = Math.min((available / maxStock) * 100, 100);
                    const isLowStock = available < 10;

                    let progressColor = "bg-green-500";
                    if (available <= 0) progressColor = "bg-red-500";
                    else if (available < 10) progressColor = "bg-red-500";
                    else if (available < 30) progressColor = "bg-yellow-500";

                    return (
                      <TableRow key={level.id} className="hover:bg-white/5 transition-colors border-white/5 text-slate-200">
                        <TableCell className="text-center">
                          <Checkbox
                            checked={selectedIds.includes(level.id)}
                            onCheckedChange={() => toggleSelectRow(level.id)}
                            className="border-white/20 data-[state=checked]:bg-blue-500 data-[state=checked]:border-blue-500"
                          />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-9 w-9 border border-white/10 ring-1 ring-white/5">
                              <AvatarImage src="" />
                              <AvatarFallback className="bg-slate-800 text-slate-300">
                                {getInitials(level.productName || "?")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium text-slate-200">{level.productName || "-"}</div>
                              <div className="text-xs text-slate-500">{level.productSku || "-"}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-slate-400 text-sm">{level.warehouseName || "-"}</TableCell>
                        <TableCell className="text-right font-medium text-slate-200">{quantity.toFixed(2)}</TableCell>
                        <TableCell>
                          <div className="w-full flex items-center gap-2">
                            <Progress value={percentage} className={`h-1.5 bg-slate-800 ${progressColor}`} />
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-slate-400">{reserved.toFixed(2)}</TableCell>
                        <TableCell className={`text-right font-bold ${available <= 0 ? "text-red-400" : "text-emerald-400"}`}>
                          {available.toFixed(2)}
                        </TableCell>
                        <TableCell>
                          {available <= 0 ? (
                            <Badge variant="destructive" className="bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500/20">Нөөцгүй</Badge>
                          ) : isLowStock ? (
                            <Badge variant="outline" className="text-yellow-400 border-yellow-500/20 bg-yellow-500/10">Багасч байна</Badge>
                          ) : (
                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 border">Боломжтой</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>

          {/* Floating Bulk Action Bar */}
          {selectedIds.length > 0 && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 bg-white dark:bg-zinc-900 border shadow-lg rounded-full px-6 py-3 flex items-center gap-4 z-50 animate-in slide-in-from-bottom-5">
              <span className="text-sm font-medium">{selectedIds.length} бараа сонгогдсон</span>
              <div className="h-4 w-px bg-border" />
              <Button variant="ghost" size="sm" onClick={() => handleBulkAction("reset")} className="text-muted-foreground hover:text-foreground">
                <RotateCcw className="h-4 w-4 mr-2" />
                Тэглэх
              </Button>
              <Button variant="destructive" size="sm" onClick={() => handleBulkAction("delete")}>
                <Trash2 className="h-4 w-4 mr-2" />
                Устгах
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 ml-2 -mr-2 rounded-full" onClick={() => setSelectedIds([])}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="movements" className="space-y-4">
          {/* Glass Table Container - Movements */}
          <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl overflow-hidden">
            <Table>
              <TableHeader className="bg-white/5">
                <TableRow className="border-white/10 hover:bg-transparent">
                  <TableHead className="text-slate-300">Төрөл</TableHead>
                  <TableHead className="text-slate-300">Огноо</TableHead>
                  <TableHead className="text-slate-300">Бараа</TableHead>
                  <TableHead className="text-slate-300">Агуулах</TableHead>
                  <TableHead className="text-right text-slate-300">Тоо хэмжээ</TableHead>
                  <TableHead className="text-slate-300">Баглаа</TableHead>
                  <TableHead className="text-slate-300">Хугацаа</TableHead>
                  <TableHead className="text-slate-300">Холбоос</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movementsLoading ? (
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                      Хөдөлгөөний мэдээлэл ачааллаж байна...
                    </TableCell>
                  </TableRow>
                ) : filteredMovements.length === 0 ? (
                  <TableRow className="hover:bg-transparent border-white/5">
                    <TableCell colSpan={8} className="text-center text-slate-400 py-8">
                      {search ? "Хайлтад тохирох хөдөлгөөн олдсонгүй." : "Хөдөлгөөний мэдээлэл байхгүй байна."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredMovements.map((mov: any) => {
                    const expiryDate = mov.expiryDate ? new Date(mov.expiryDate) : null;
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const daysUntilExpiry = expiryDate ? Math.ceil((expiryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)) : null;
                    const isExpired = daysUntilExpiry !== null && daysUntilExpiry < 0;

                    const isOut = mov.type === "out";
                    const isIn = mov.type === "in";

                    return (
                      <TableRow key={mov.id} className="hover:bg-white/5 transition-colors border-white/5 text-slate-200">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {isIn ? (
                              <div className="h-8 w-8 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                                <TrendingDown className="h-4 w-4 text-emerald-400" />
                              </div>
                            ) : isOut ? (
                              <div className="h-8 w-8 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                <TrendingUp className="h-4 w-4 text-red-400" />
                              </div>
                            ) : (
                              <div className="h-8 w-8 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                                <RefreshCw className="h-4 w-4 text-blue-400" />
                              </div>
                            )}
                            <span className={`font-medium text-sm ${isIn ? "text-emerald-400" : isOut ? "text-red-400" : "text-blue-400"}`}>
                              {isIn ? "Орлого" : isOut ? "Зарлага" : mov.type === "adjustment" ? "Тохируулга" : "Шилжүүлэлт"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-400">
                          {format(new Date(mov.createdAt), "yyyy-MM-dd HH:mm")}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium text-slate-200">{mov.productName || "-"}</div>
                            <div className="text-xs text-slate-500">{mov.productSku || "-"}</div>
                          </div>
                        </TableCell>
                        <TableCell className="text-sm text-slate-300">{mov.warehouseName || "-"}</TableCell>
                        <TableCell className="text-right font-medium">
                          {isIn ? (
                            <span className="text-emerald-400">+{Number(mov.quantity).toFixed(2)}</span>
                          ) : (
                            <span className="text-red-400">-{Number(mov.quantity).toFixed(2)}</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-300">{mov.batchNumber || "-"}</TableCell>
                        <TableCell>
                          {expiryDate ? (
                            <div className={isExpired ? "text-red-400 font-semibold" : daysUntilExpiry && daysUntilExpiry <= 30 ? "text-yellow-400" : "text-slate-300"}>
                              {format(expiryDate, "yyyy-MM-dd")}
                            </div>
                          ) : (
                            <span className="text-slate-500">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-slate-500">{mov.reference || "-"}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="alerts" className="space-y-4">
          <div className="border rounded-lg bg-white overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Бараа</TableHead>
                  <TableHead>Агуулах</TableHead>
                  <TableHead>Баглаа</TableHead>
                  <TableHead>Хугацаа дуусах</TableHead>
                  <TableHead className="text-right">Тоо хэмжээ</TableHead>
                  <TableHead>Хоног үлдлээ</TableHead>
                  <TableHead>Үйлдэл</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredAlerts.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      {search ? "Хайлтад тохирох бараа олдсонгүй." : "Хугацаа дуусах бараа байхгүй байна."}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredAlerts.map((alert: any) => {
                    const isExpired = alert.daysUntilExpiry < 0;
                    const isUrgent = alert.daysUntilExpiry <= 7;
                    const isWarning = alert.daysUntilExpiry <= 30;

                    let rowClass = "";
                    if (isExpired) rowClass = "bg-red-50";
                    else if (isUrgent) rowClass = "bg-orange-50";

                    return (
                      <TableRow key={`${alert.productId}-${alert.warehouseId}-${alert.batchNumber}-${alert.expiryDate}`} className={rowClass}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Avatar className="h-8 w-8">
                              <AvatarFallback className={isExpired ? "bg-red-200 text-red-700" : "bg-primary/10"}>
                                {getInitials(alert.productName || "?")}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <div className="font-medium">{alert.productName}</div>
                              <div className="text-xs text-muted-foreground">{alert.productSku}</div>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{alert.warehouseName}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{alert.batchNumber || "-"}</Badge>
                        </TableCell>
                        <TableCell className={isExpired ? "text-red-600 font-bold" : isUrgent ? "text-orange-600 font-medium" : ""}>
                          {alert.expiryDate}
                        </TableCell>
                        <TableCell className="text-right font-medium">{Number(alert.quantity).toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant={isExpired ? "destructive" : isUrgent ? "default" : "secondary"} className={isUrgent && !isExpired ? "bg-orange-500 hover:bg-orange-600" : ""}>
                            {isExpired ? "Хугацаа хэтэрсэн" : `${alert.daysUntilExpiry} хоног`}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50">
                            Шилжүүлэх
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Шинэ агуулах нэмэх</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Агуулахын нэр *</FormLabel>
                    <FormControl>
                      <Input placeholder="Агуулахын нэр" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Код</FormLabel>
                      <FormControl>
                        <Input placeholder="WH-001" {...field} value={fieldValue(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isDefault"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0 pt-8">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Үндсэн агуулах</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Хаяг</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Агуулахын хаяг" {...field} value={fieldValue(field.value)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsOpen(false)}
                >
                  Цуцлах
                </Button>
                <Button type="submit" disabled={createWarehouse.isPending}>
                  {createWarehouse.isPending ? "Хадгалагдаж байна..." : "Нэмэх"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Stock Movement Dialog */}
      <Dialog open={isMovementOpen} onOpenChange={setIsMovementOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className={`p-6 border-b ${movementType === "in" ? "bg-green-50/50 border-green-100" :
            movementType === "out" ? "bg-red-50/50 border-red-100" :
              movementType === "transfer" ? "bg-blue-50/50 border-blue-100" : ""
            }`}>
            <DialogTitle className={`flex items-center gap-2 ${movementType === "in" ? "text-green-700" :
              movementType === "out" ? "text-red-700" :
                movementType === "transfer" ? "text-blue-700" : ""
              }`}>
              {movementType === "in" && <TrendingDown className="h-5 w-5" />}
              {movementType === "out" && <TrendingUp className="h-5 w-5" />}
              {movementType === "transfer" && <RefreshCw className="h-5 w-5" />}
              {movementType === "adjustment" && <Sparkles className="h-5 w-5" />}
              Stock хөдөлгөөн нэмэх
            </DialogTitle>
          </DialogHeader>

          <div className="p-6">
            <Form {...movementForm}>
              <form onSubmit={movementForm.handleSubmit(onMovementSubmit)} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={movementForm.control}
                    name="type"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Төрөл *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Төрөл сонгох" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="in">
                              <span className="flex items-center gap-2 text-green-600">
                                <TrendingDown className="h-4 w-4" /> Орлого
                              </span>
                            </SelectItem>
                            <SelectItem value="out">
                              <span className="flex items-center gap-2 text-red-600">
                                <TrendingUp className="h-4 w-4" /> Зарлага
                              </span>
                            </SelectItem>
                            <SelectItem value="transfer">
                              <span className="flex items-center gap-2 text-blue-600">
                                <RefreshCw className="h-4 w-4" /> Шилжүүлэлт
                              </span>
                            </SelectItem>
                            <SelectItem value="adjustment">
                              <span className="flex items-center gap-2 text-orange-600">
                                <Sparkles className="h-4 w-4" /> Тохируулга
                              </span>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={movementForm.control}
                    name="warehouseId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Агуулах *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Агуулах сонгох" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {warehouses.map((w) => (
                              <SelectItem key={w.id} value={w.id}>
                                {w.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={movementForm.control}
                  name="productId"
                  render={({ field }) => {
                    // Calculate current stock for display
                    const currentLevel = levels.find(l =>
                      l.productId === field.value &&
                      l.warehouseId === selectedWarehouseId
                    );
                    const currentQty = currentLevel ? Number(currentLevel.quantity) : 0;

                    return (
                      <FormItem>
                        <FormLabel>Бараа *</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Бараа сонгох" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products.filter(p => p.trackInventory).map((p) => (
                              <SelectItem key={p.id} value={p.id}>
                                {p.name} ({p.sku})
                                {(p as any).trackExpiry && (
                                  <Badge variant="outline" className="ml-2">Expiry</Badge>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {field.value && selectedWarehouseId && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                            <Package className="h-3 w-3" />
                            Одоогийн үлдэгдэл: <span className="font-medium text-foreground">{currentQty}</span>
                            {(movementType === "out" || movementType === "transfer") && currentQty < (selectedQuantity || 0) && (
                              <span className="text-destructive font-medium ml-2 flex items-center gap-1">
                                <AlertCircle className="h-3 w-3" />
                                Үлдэгдэл хүрэлцэхгүй байна!
                              </span>
                            )}
                          </div>
                        )}
                        <FormMessage />
                      </FormItem>
                    );
                  }}
                />


                <FormField
                  control={movementForm.control}
                  name="quantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Тоо хэмжээ *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Batch/Expiry Fields */}
                {(requiresExpiry || movementForm.watch("batchNumber") || movementForm.watch("expiryDate")) && (
                  <div className="p-4 bg-muted/50 rounded-lg space-y-4 border">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium text-sm">Batch / Expiry мэдээлэл</h4>
                      {movementType === "out" && selectedProductId && selectedWarehouseId && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleFEFOSuggest}
                          disabled={loadingFEFO}
                        >
                          <Sparkles className="w-4 h-4 mr-2" />
                          {loadingFEFO ? "Хайж байна..." : "FEFO санал"}
                        </Button>
                      )}
                    </div>

                    {fefoSuggestions.length > 0 && movementType === "out" && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs font-medium text-blue-800 mb-2">Санал болгосон batch-ууд:</p>
                        <div className="space-y-1">
                          {fefoSuggestions.slice(0, 3).map((sug: any, idx: number) => (
                            <div
                              key={idx}
                              className="text-xs text-blue-700 cursor-pointer hover:bg-blue-100 p-2 rounded"
                              onClick={() => {
                                movementForm.setValue("batchNumber", sug.batchNumber || "");
                                movementForm.setValue("expiryDate", sug.expiryDate);
                              }}
                            >
                              Batch: {sug.batchNumber || "-"} | Expiry: {sug.expiryDate} |
                              Qty: {sug.quantity.toFixed(2)} | {sug.daysUntilExpiry} хоног үлдлээ
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={movementForm.control}
                        name="batchNumber"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Баглааны дугаар
                              {requiresExpiry && movementType === "out" && <span className="text-red-500"> *</span>}
                            </FormLabel>
                            <FormControl>
                              <Input placeholder="BATCH-001" {...field} />
                            </FormControl>
                            <FormDescription className="text-xs">
                              {requiresExpiry && movementType === "out" && "Шаардлагатай"}
                              {movementType === "out" && " (FEFO санал товч дараад автоматаар бөглөнө)"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={movementForm.control}
                        name="expiryDate"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>
                              Хугацаа дуусах огноо
                              {requiresExpiry && movementType === "out" && <span className="text-red-500"> *</span>}
                            </FormLabel>
                            <FormControl>
                              <Input type="date" {...field} />
                            </FormControl>
                            <FormDescription className="text-xs">
                              {requiresExpiry && movementType === "out" && "Шаардлагатай"}
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsMovementOpen(false)}
                  >
                    Цуцлах
                  </Button>
                  <Button type="submit" disabled={createMovement.isPending || ((movementType === "out" || movementType === "transfer") &&
                    (() => {
                      const currentLevel = levels.find(l =>
                        l.productId === selectedProductId &&
                        l.warehouseId === selectedWarehouseId
                      );
                      return (currentLevel ? Number(currentLevel.quantity) : 0) < selectedQuantity;
                    })()
                  )}>
                    {createMovement.isPending ? "Хадгалагдаж байна..." : "Хадгалах"}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
