import React, { useState, useMemo, useCallback } from "react";
import { useProducts } from "@/hooks/use-products";
import { useProductCategories } from "@/hooks/use-product-categories";
import { useWarehouses } from "@/hooks/use-warehouses";
import { useCreateStockMovement, type CreateStockMovementInput } from "@/hooks/use-stock-movements";
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
import { Plus, Search, Pencil, Package, Download, Printer, Layers, Filter, Grid3x3, List, PackagePlus, FileText, Laptop, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { exportToCSV, formatNumberForCSV } from "@/lib/export-utils";
import { printTable } from "@/lib/print-utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertProductSchema,
  type Product,
  type InsertProduct,
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
import { Switch } from "@/components/ui/switch";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { z } from "zod";

// Helper to handle null values in form fields
const fieldValue = (value: string | null | undefined) => value ?? "";

const formatMNT = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(num) + '₮';
};

// Stock status helper with reorderLevel (default 10)
const getStockStatus = (
  stockQuantity: number | string,
  trackInventory: boolean,
  productType: string,
  reorderLevel: number = 10
) => {
  // Don't show stock status for services
  if (productType === "service" || !trackInventory) return null;

  const qty = typeof stockQuantity === "string" ? parseFloat(stockQuantity) : stockQuantity;
  if (qty <= 0) return { label: "Дууссан", variant: "destructive" as const };
  if (qty <= reorderLevel) return { label: "Бага", variant: "secondary" as const };
  return { label: "Байгаа", variant: "default" as const };
};

// Format quantity - integers for whole units, decimals for weight/volume
const formatQuantity = (qty: number | string, unit: string) => {
  const num = typeof qty === "string" ? parseFloat(qty) : qty;
  const isDecimalUnit = ["кг", "л", "м", "м²", "м³"].some(u => unit.includes(u));

  if (isDecimalUnit) {
    return new Intl.NumberFormat('mn-MN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(num);
  }

  // Integer units
  return Math.floor(num).toString();
};

// Product type icon helper
const getProductTypeIcon = (type: string) => {
  if (type === "service") return <FileText className="h-4 w-4 text-blue-500" />;
  if (type === "product") return <Package className="h-4 w-4 text-green-500" />;
  return <Laptop className="h-4 w-4 text-purple-500" />;
};

// Stock movement schema
const stockMovementSchema = z.object({
  warehouseId: z.string().min(1, "Агуулах сонгоно уу"),
  quantity: z.number().min(0.01, "Тоо хэмжээ оруулна уу"),
  type: z.enum(["in", "adjustment"]).default("in"),
  note: z.string().optional(),
});

type StockMovementFormValues = z.infer<typeof stockMovementSchema>;

export default function Products() {
  const { products = [], isLoading, createProduct, updateProduct, deleteProduct, bulkDeleteProducts } = useProducts();
  const { categories = [] } = useProductCategories();
  const { warehouses = [] } = useWarehouses();
  const createMovement = useCreateStockMovement();
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300);
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [groupByCategory, setGroupByCategory] = useState(false);
  const { toast } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isStockOpen, setIsStockOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [stockProduct, setStockProduct] = useState<Product | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const form = useForm<InsertProduct>({
    resolver: zodResolver(insertProductSchema),
    defaultValues: {
      name: "",
      sku: "",
      description: "",
      type: "product",
      salePrice: "0",
      costPrice: "0",
      unit: "ш",
      trackInventory: true,
      trackExpiry: false,
      stockQuantity: "0",
      isActive: true,
    },
  });

  const stockForm = useForm<StockMovementFormValues>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: {
      warehouseId: warehouses.find(w => w.isDefault)?.id || "",
      quantity: 0,
      type: "in",
      note: "",
    },
  });

  const handleAdd = useCallback(() => {
    setSelectedProduct(null);
    form.reset({
      name: "",
      sku: `PRD-${Date.now().toString().slice(-6)}`,
      description: "",
      type: "product",
      salePrice: "0",
      costPrice: "0",
      unit: "ш",
      trackInventory: true,
      trackExpiry: false,
      stockQuantity: "0",
      isActive: true,
    });
    setIsEditOpen(true);
  }, []);

  const handleEdit = useCallback((product: Product) => {
    setSelectedProduct(product);
    form.reset({
      name: product.name,
      sku: product.sku || "",
      description: product.description || "",
      categoryId: product.categoryId || undefined,
      type: product.type as any,
      salePrice: product.salePrice || "0",
      costPrice: product.costPrice || "0",
      unit: product.unit || "ш",
      trackInventory: product.trackInventory ?? true,
      trackExpiry: (product as any).trackExpiry ?? false,
      stockQuantity: product.stockQuantity || "0",
      isActive: product.isActive ?? true,
      barcode: product.barcode || undefined,
    });
    setIsEditOpen(true);
  }, [form]);

  const handleAddStock = useCallback((product: Product) => {
    setStockProduct(product);
    const defaultWarehouse = warehouses.find(w => w.isDefault);
    stockForm.reset({
      warehouseId: defaultWarehouse?.id || warehouses[0]?.id || "",
      quantity: 0,
      type: "in",
      note: "",
    });
    setIsStockOpen(true);
  }, [warehouses, stockForm]);

  const onStockSubmit = useCallback(async (data: StockMovementFormValues) => {
    if (!stockProduct) return;
    try {
      const payload: CreateStockMovementInput = {
        warehouseId: data.warehouseId,
        productId: stockProduct.id,
        quantity: data.quantity,
        type: data.type,
        note: data.note || undefined,
      };
      await createMovement.mutateAsync(payload);
      toast({ title: "Амжилттай", description: "Нөөц нэмэгдлээ.", variant: "success" });
      setIsStockOpen(false);
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Нөөц нэмэхэд алдаа гарлаа",
        variant: "destructive",
      });
    }
  }, [stockProduct, createMovement, toast]);

  const onSubmit = useCallback(async (data: InsertProduct) => {
    try {
      if (selectedProduct) {
        await updateProduct.mutateAsync({ id: selectedProduct.id, data });
        toast({ title: "Амжилттай", description: "Барааны мэдээлэл шинэчлэгдлээ.", variant: "success" });
      } else {
        await createProduct.mutateAsync(data);
        toast({ title: "Амжилттай", description: "Шинэ бараа нэмэгдлээ.", variant: "success" });
      }
      setIsEditOpen(false);
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Хадгалахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  }, [selectedProduct, createProduct, updateProduct, toast]);

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProducts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProducts.map(p => p.id)));
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

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (!window.confirm(`${selectedIds.size} барааг устгах уу? Энэ үйлдлийг буцаах боломжгүй.`)) {
      return;
    }
    try {
      const result = await bulkDeleteProducts.mutateAsync(Array.from(selectedIds));
      toast({
        title: "Амжилттай",
        description: result.message || `${selectedIds.size} бараа устгагдлаа`,
        variant: "success",
      });
      clearSelection();
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Export selected products
  const handleBulkExport = () => {
    const selectedProducts = products.filter(p => selectedIds.has(p.id));

    const dataToExport = selectedProducts.map((p) => ({
      sku: p.sku || "",
      name: p.name || "",
      type: p.type === "product" ? "Бараа" : "Үйлчилгээ",
      salePrice: formatNumberForCSV(p.salePrice),
      costPrice: formatNumberForCSV(p.costPrice),
      stockQuantity: formatNumberForCSV(p.stockQuantity),
      unit: p.unit || "",
      barcode: p.barcode || "",
      trackInventory: p.trackInventory ? "Тийм" : "Үгүй",
      isActive: p.isActive ? "Идэвхтэй" : "Идэвхгүй",
    }));

    exportToCSV(
      dataToExport,
      [
        { key: "sku", label: "Барааны код" },
        { key: "name", label: "Нэр" },
        { key: "type", label: "Төрөл" },
        { key: "salePrice", label: "Борлуулалтын үнэ (₮)" },
        { key: "costPrice", label: "Зардлын үнэ (₮)" },
        { key: "stockQuantity", label: "Нөөцийн тоо хэмжээ" },
        { key: "unit", label: "Нэгж" },
        { key: "barcode", label: "Баркод" },
        { key: "trackInventory", label: "Нөөц хянах" },
        { key: "isActive", label: "Төлөв" },
      ],
      `бараа_${new Date().toISOString().split("T")[0]}.csv`
    );

    toast({
      title: "Амжилттай",
      description: `${selectedProducts.length} бараа экспортлогдлоо`,
      variant: "success",
    });
  };

  // Keyboard shortcuts for Products page
  useKeyboardShortcuts([
    {
      key: "k",
      ctrlKey: true,
      action: () => {
        const searchInput = document.querySelector('input[placeholder*="Хайх"], input[type="search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      },
      description: "Хайх талбарт шилжих",
    },
    {
      key: "n",
      ctrlKey: true,
      action: () => {
        if (!isEditOpen) {
          handleAdd();
        }
      },
      description: "Шинэ бараа нэмэх",
    },
    {
      key: "Escape",
      action: () => {
        if (isEditOpen) setIsEditOpen(false);
      },
      description: "Dialog хаах",
    },
  ]);

  // Memoize filtered products to avoid recalculation on every render
  const filteredProducts = useMemo(() => {
    let filtered = products;

    // Search filter
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter((p) => {
        return (
          p.name?.toLowerCase().includes(searchLower) ||
          p.sku?.toLowerCase().includes(searchLower) ||
          p.barcode?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((p) => p.categoryId === categoryFilter);
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((p) => p.type === typeFilter);
    }

    // Stock status filter
    if (stockFilter !== "all") {
      filtered = filtered.filter((p) => {
        if (!p.trackInventory) return stockFilter === "none";
        const qty = Number(p.stockQuantity || 0);
        if (stockFilter === "out") return qty <= 0;
        if (stockFilter === "low") return qty > 0 && qty < 10;
        if (stockFilter === "in") return qty >= 10;
        return true;
      });
    }

    return filtered;
  }, [products, debouncedSearch, categoryFilter, typeFilter, stockFilter]);

  // Group products by category
  const groupedProducts = useMemo(() => {
    if (!groupByCategory) return null;

    const grouped = new Map<string, Product[]>();
    const uncategorized: Product[] = [];

    filteredProducts.forEach((product) => {
      if (product.categoryId) {
        const category = categories.find(c => c.id === product.categoryId);
        const categoryName = category?.name || "Бусад";
        if (!grouped.has(categoryName)) {
          grouped.set(categoryName, []);
        }
        grouped.get(categoryName)!.push(product);
      } else {
        uncategorized.push(product);
      }
    });

    if (uncategorized.length > 0) {
      grouped.set("Ангилалгүй", uncategorized);
    }

    return Array.from(grouped.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [filteredProducts, groupByCategory, categories]);

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Бараа
          </h2>
          <p className="text-muted-foreground mt-2">
            Бүтээгдэхүүн, үйлчилгээний удирдлага
          </p>
        </div>
        <Button onClick={handleAdd} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Бараа нэмэх
        </Button>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Бараагаар хайх (нэр, код, баркод)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Бүх ангилал" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх ангилал</SelectItem>
              {categories.map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {cat.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Бараа/Үйлчилгээ" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бараа/Үйлчилгээ</SelectItem>
              <SelectItem value="product">Бараа</SelectItem>
              <SelectItem value="service">Үйлчилгээ</SelectItem>
            </SelectContent>
          </Select>

          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Идэвхтэй/Идэвхгүй" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Идэвхтэй/Идэвхгүй</SelectItem>
              <SelectItem value="in">Байгаа</SelectItem>
              <SelectItem value="low">Бага</SelectItem>
              <SelectItem value="out">Дууссан</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex items-center gap-2 px-3 py-2 border rounded-md">
            <Layers className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Ангилалаар бүлэглэх</span>
            <Switch checked={groupByCategory} onCheckedChange={setGroupByCategory} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const headers = ["Код", "Нэр", "Төрөл", "Борлуулалтын үнэ (₮)", "Зардлын үнэ (₮)", "Нөөц", "Нэгж", "Баркод", "Төлөв"];
            const rows = filteredProducts.map((p) => [
              p.sku || "-",
              p.name || "",
              p.type === "product" ? "Бараа" : "Үйлчилгээ",
              formatNumberForCSV(p.salePrice) || "0",
              formatNumberForCSV(p.costPrice) || "0",
              formatNumberForCSV(p.stockQuantity) || "0",
              p.unit || "ш",
              p.barcode || "-",
              p.isActive ? "Идэвхтэй" : "Идэвхгүй",
            ]);

            printTable(
              "Бараа",
              headers,
              rows,
              `Нийт: ${filteredProducts.length} бараа`
            );
          }}
        >
          <Printer className="w-4 h-4 mr-2" />
          Хэвлэх
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleBulkExport}
        >
          <Download className="w-4 h-4 mr-2" />
          CSV экспорт
        </Button>
      </div>

      {/* Bulk Selection Header */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} бараа сонгогдсон
          </span>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Үйлдэл <span className="ml-1">▼</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleBulkDelete} className="text-destructive">
                  🗑️ Устгах
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBulkExport}>
                  📤 Excel татах
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
                  checked={selectedIds.size === filteredProducts.length && filteredProducts.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead className="w-12"></TableHead>
              <TableHead>Бараа</TableHead>
              <TableHead>Ангилал</TableHead>
              <TableHead>Төрөл</TableHead>
              <TableHead className="text-right">Борлуулалтын үнэ</TableHead>
              <TableHead className="text-right">Зардлын үнэ</TableHead>
              <TableHead className="text-right">Нөөц</TableHead>
              <TableHead>Нэгж</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead>Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                  Бараа ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredProducts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={11} className="p-0">
                  <div className="py-8">
                    <EmptyState
                      icon={<Package className="w-12 h-12" />}
                      title={search || categoryFilter !== "all" || typeFilter !== "all" || stockFilter !== "all" ? "Хайлтад тохирох бараа олдсонгүй" : "Бараа бүртгэгдээгүй байна"}
                      description={
                        search || categoryFilter !== "all" || typeFilter !== "all" || stockFilter !== "all"
                          ? "Шүүлтийг өөрчилж дахин оролдоно уу."
                          : "Эхний бараагаа нэмээд барааны каталогийг үүсгэнэ үү."
                      }
                      action={
                        !search && categoryFilter === "all" && typeFilter === "all" && stockFilter === "all" && (
                          <Button onClick={handleAdd} size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Бараа нэмэх
                          </Button>
                        )
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ) : groupByCategory && groupedProducts ? (
              <TooltipProvider>
                {groupedProducts.map(([categoryName, categoryProducts]) => (
                  <React.Fragment key={categoryName}>
                    <TableRow className="bg-muted/50 sticky top-0 z-10">
                      <TableCell colSpan={11} className="font-semibold py-3">
                        <div className="flex items-center gap-2">
                          <Layers className="h-4 w-4" />
                          {categoryName} ({categoryProducts.length})
                        </div>
                      </TableCell>
                    </TableRow>
                    {categoryProducts.map((product) => {
                      const stockStatus = getStockStatus(
                        product.stockQuantity || 0,
                        product.trackInventory ?? false,
                        product.type
                      );
                      const category = categories.find(c => c.id === product.categoryId);
                      const qty = Number(product.stockQuantity || 0);
                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedIds.has(product.id)}
                              onCheckedChange={() => toggleSelectOne(product.id)}
                            />
                          </TableCell>
                          <TableCell>{getProductTypeIcon(product.type)}</TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{product.name}</div>
                              {product.sku && (
                                <div className="text-xs text-muted-foreground">{product.sku}</div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {category ? (
                              <Badge variant="outline">{category.name}</Badge>
                            ) : (
                              <span className="text-muted-foreground text-sm">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge variant={product.type === "product" ? "default" : "secondary"}>
                              {product.type === "product" ? "Бараа" : "Үйлчилгээ"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">{formatMNT(product.salePrice || "0")}</TableCell>
                          <TableCell className="text-right">{formatMNT(product.costPrice || "0")}</TableCell>
                          <TableCell className="text-right">
                            {product.trackInventory && product.type !== "service" ? (
                              <div className="flex flex-col items-end gap-1">
                                <span>{formatQuantity(qty, product.unit || "ш")} {product.unit}</span>
                                {stockStatus && (
                                  <Badge variant={stockStatus.variant} className="text-xs">
                                    {stockStatus.label}
                                  </Badge>
                                )}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>{product.unit || "ш"}</TableCell>
                          <TableCell>
                            <Badge variant={product.isActive ? "default" : "secondary"}>
                              {product.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleEdit(product)}
                                  >
                                    <Pencil className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Засах</TooltipContent>
                              </Tooltip>
                              {product.trackInventory && product.type !== "service" && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleAddStock(product)}
                                    >
                                      <PackagePlus className="h-4 w-4" />
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Нөөц өөрчлөх</TooltipContent>
                                </Tooltip>
                              )}
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    onClick={() => {
                                      if (window.confirm("Энэ барааг устгах уу?")) {
                                        deleteProduct.mutate(product.id, {
                                          onSuccess: () => {
                                            toast({ title: "Амжилттай", description: "Бараа устгагдлаа", variant: "success" });
                                          },
                                          onError: (error: any) => {
                                            toast({ title: "Алдаа", description: error.message, variant: "destructive" });
                                          }
                                        });
                                      }
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Устгах</TooltipContent>
                              </Tooltip>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </React.Fragment>
                ))}
              </TooltipProvider>
            ) : (
              <TooltipProvider>
                {filteredProducts.map((product) => {
                  const stockStatus = getStockStatus(
                    product.stockQuantity || 0,
                    product.trackInventory ?? false,
                    product.type
                  );
                  const category = categories.find(c => c.id === product.categoryId);
                  const qty = Number(product.stockQuantity || 0);
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(product.id)}
                          onCheckedChange={() => toggleSelectOne(product.id)}
                        />
                      </TableCell>
                      <TableCell>{getProductTypeIcon(product.type)}</TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{product.name}</div>
                          {product.sku && (
                            <div className="text-xs text-muted-foreground">{product.sku}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {category ? (
                          <Badge variant="outline">{category.name}</Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={product.type === "product" ? "default" : "secondary"}>
                          {product.type === "product" ? "Бараа" : "Үйлчилгээ"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">{formatMNT(product.salePrice || "0")}</TableCell>
                      <TableCell className="text-right">{formatMNT(product.costPrice || "0")}</TableCell>
                      <TableCell className="text-right">
                        {product.trackInventory && product.type !== "service" ? (
                          <div className="flex flex-col items-end gap-1">
                            <span>{formatQuantity(qty, product.unit || "ш")} {product.unit}</span>
                            {stockStatus && (
                              <Badge variant={stockStatus.variant} className="text-xs">
                                {stockStatus.label}
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>{product.unit || "ш"}</TableCell>
                      <TableCell>
                        <Badge variant={product.isActive ? "default" : "secondary"}>
                          {product.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(product)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Засах</TooltipContent>
                          </Tooltip>
                          {product.trackInventory && product.type !== "service" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleAddStock(product)}
                                >
                                  <PackagePlus className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Нөөц өөрчлөх</TooltipContent>
                            </Tooltip>
                          )}
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (window.confirm("Энэ барааг устгах уу?")) {
                                    deleteProduct.mutate(product.id, {
                                      onSuccess: () => {
                                        toast({ title: "Амжилттай", description: "Бараа устгагдлаа", variant: "success" });
                                      },
                                      onError: (error: any) => {
                                        toast({ title: "Алдаа", description: error.message, variant: "destructive" });
                                      }
                                    });
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Устгах</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TooltipProvider>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedProduct ? "Бараа засах" : "Шинэ бараа нэмэх"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Нэр *</FormLabel>
                      <FormControl>
                        <Input placeholder="Барааны нэр" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sku"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Барааны код (SKU)</FormLabel>
                      <FormControl>
                        <Input placeholder="PRD-001" {...field} value={fieldValue(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тайлбар</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Барааны тайлбар..." {...field} value={fieldValue(field.value)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="categoryId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ангилал</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                        value={field.value || "none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Ангилал сонгох" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="none">Ангилалгүй</SelectItem>
                          {categories.map((cat) => (
                            <SelectItem key={cat.id} value={cat.id}>
                              {cat.name}
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
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Төрөл</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Төрөл сонгох" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="product">Бараа</SelectItem>
                          <SelectItem value="service">Үйлчилгээ</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="unit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Нэгж</FormLabel>
                      <FormControl>
                        <Input placeholder="ш, кг, л" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="salePrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Борлуулалтын үнэ (₮) *</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="costPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Зардлын үнэ (₮) *</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="barcode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Баркод</FormLabel>
                      <FormControl>
                        <Input placeholder="Баркод" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="stockQuantity"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Эхний нөөц</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="0" {...field} disabled={!form.watch("trackInventory")} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="trackInventory"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Нөөцийг хянах</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="trackExpiry"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Хугацаа дуусах огнооны хяналт</FormLabel>
                        <p className="text-xs text-muted-foreground">
                          Хүнс/эм/гоо сайхны бараа (FEFO compliance)
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Идэвхтэй</FormLabel>
                      </div>
                    </FormItem>
                  )}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                >
                  Цуцлах
                </Button>
                <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending}>
                  {createProduct.isPending || updateProduct.isPending
                    ? "Хадгалагдаж байна..."
                    : selectedProduct
                      ? "Хадгалах"
                      : "Нэмэх"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Stock Movement Dialog */}
      <Dialog open={isStockOpen} onOpenChange={setIsStockOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Нөөц нэмэх</DialogTitle>
          </DialogHeader>
          <Form {...stockForm}>
            <form onSubmit={stockForm.handleSubmit(onStockSubmit)} className="space-y-4">
              {stockProduct && (
                <div className="p-3 bg-muted rounded-md">
                  <p className="font-medium">{stockProduct.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {stockProduct.sku || "-"} • Одоогийн нөөц: {stockProduct.stockQuantity || "0"} {stockProduct.unit}
                  </p>
                </div>
              )}

              <FormField
                control={stockForm.control}
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
                        {warehouses.map((wh) => (
                          <SelectItem key={wh.id} value={wh.id}>
                            {wh.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={stockForm.control}
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
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={stockForm.control}
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Төрөл *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="in">Орлого</SelectItem>
                          <SelectItem value="adjustment">Тохируулга</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={stockForm.control}
                name="note"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тэмдэглэл</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Тэмдэглэл..." {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsStockOpen(false)}
                >
                  Цуцлах
                </Button>
                <Button type="submit" disabled={createMovement.isPending}>
                  {createMovement.isPending ? "Хадгалагдаж байна..." : "Нэмэх"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
