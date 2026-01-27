import React, { useState, useMemo } from "react";
import { useTaxCodes } from "@/hooks/use-tax-codes";
import { useAccounts } from "@/hooks/use-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Search, Plus, Edit, Percent, Receipt, Building2, CheckCircle2, Star, Trash2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Checkbox } from "@/components/ui/checkbox";

const taxTypeLabels: Record<string, string> = {
  vat: "НӨАТ (VAT)",
  income_tax: "Орлогын татвар",
};

// Visual config for tax types
const taxTypeConfig: Record<string, { color: string; bgColor: string; borderColor: string; icon: any }> = {
  vat: {
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-t-blue-500",
    icon: Receipt
  },
  income_tax: {
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-t-orange-500",
    icon: Building2
  },
};

const taxCodeSchema = z.object({
  code: z.string().min(1, "Татварын кодын код оруулна уу"),
  name: z.string().min(1, "Татварын кодын нэр оруулна уу"),
  rate: z.number().min(0).max(100, "Хувь 0-100 хооронд байх ёстой"),
  type: z.enum(["vat", "income_tax"]),
  taxAccountPayableId: z.string().optional().nullable(),
  taxAccountReceivableId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

type TaxCodeFormValues = z.infer<typeof taxCodeSchema>;

const formatPercent = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("mn-MN", {
    style: "decimal",
    maximumFractionDigits: 2,
  }).format(num) + "%";
};

export default function TaxCodes() {
  const { taxCodes = [], isLoading, createTaxCode, updateTaxCode, deleteTaxCode, setDefaultTaxCode, isCreating, isUpdating, isDeleting } = useTaxCodes();
  const { accounts = [] } = useAccounts();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTaxCode, setEditingTaxCode] = useState<any | null>(null);
  const [isDeleteAlertOpen, setIsDeleteAlertOpen] = useState(false);
  const [taxCodeToDelete, setTaxCodeToDelete] = useState<string | null>(null);
  const { toast } = useToast();

  const form = useForm<TaxCodeFormValues>({
    resolver: zodResolver(taxCodeSchema),
    defaultValues: {
      code: "",
      name: "",
      rate: 10,
      type: "vat",
      taxAccountPayableId: null,
      taxAccountReceivableId: null,
      isActive: true,
    },
  });

  const filteredTaxCodes = taxCodes.filter((tc) => {
    const matchesSearch = !search ||
      tc.code?.toLowerCase().includes(search.toLowerCase()) ||
      tc.name?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || tc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // KPI Stats
  const stats = useMemo(() => ({
    total: taxCodes.length,
    active: taxCodes.filter(tc => tc.isActive).length,
    vatCount: taxCodes.filter(tc => tc.type === "vat").length
  }), [taxCodes]);

  // Get liability accounts for payable
  const liabilityAccounts = accounts.filter((acc) => acc.type === "liability" && acc.isActive);

  // Get asset accounts for receivable
  const assetAccounts = accounts.filter((acc) => acc.type === "asset" && acc.isActive);

  const onSubmit = async (data: TaxCodeFormValues) => {
    try {
      const payload = {
        code: data.code,
        name: data.name,
        rate: data.rate,
        type: data.type,
        taxAccountPayableId: data.taxAccountPayableId || null,
        taxAccountReceivableId: data.taxAccountReceivableId || null,
        isActive: data.isActive,
      };

      if (editingTaxCode) {
        await updateTaxCode({ id: editingTaxCode.id, ...payload });
      } else {
        await createTaxCode(payload);
      }

      setIsCreateOpen(false);
      setEditingTaxCode(null);
      form.reset();
    } catch (error: any) {
      // Toast is handled in mutation
    }
  };

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTaxCodeToDelete(id);
    setIsDeleteAlertOpen(true);
  };

  const confirmDelete = async () => {
    if (taxCodeToDelete) {
      await deleteTaxCode(taxCodeToDelete);
      setIsDeleteAlertOpen(false);
      setTaxCodeToDelete(null);
    }
  };

  const handleAdd = () => {
    setEditingTaxCode(null);
    form.reset({
      code: "",
      name: "",
      rate: 10,
      type: "vat",
      taxAccountPayableId: null,
      taxAccountReceivableId: null,
      isActive: true,
    });
    setIsCreateOpen(true);
  };

  const handleEdit = (tc: any) => {
    setEditingTaxCode(tc);
    form.reset({
      code: tc.code,
      name: tc.name,
      rate: tc.rate,
      type: tc.type,
      taxAccountPayableId: tc.taxAccountPayableId || undefined,
      taxAccountReceivableId: tc.taxAccountReceivableId || undefined,
      isActive: tc.isActive,
    });
    setIsCreateOpen(true);
  };

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Татварын Кодууд
          </h2>
          <p className="text-muted-foreground mt-2">
            Татварын тохиргоо, НӨАТ болон бусад татвар
          </p>
        </div>
        <Button onClick={handleAdd} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Татвар нэмэх
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Нийт татвар</CardTitle>
            <Percent className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Бүртгэгдсэн татварын кодууд</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Идэвхтэй</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{stats.active}</div>
            <p className="text-xs text-muted-foreground">Ашиглаж буй татварууд</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">НӨАТ төрөл</CardTitle>
            <Receipt className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{stats.vatCount}</div>
            <p className="text-xs text-muted-foreground">НӨАТ-тай холбоотой</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Код, нэрээр хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Төрөл" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх төрөл</SelectItem>
            <SelectItem value="vat">НӨАТ</SelectItem>
            <SelectItem value="income_tax">Орлогын татвар</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tax Cards Grid */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">
          Татварын кодууд ачааллаж байна...
        </div>
      ) : filteredTaxCodes.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          {search ? "Хайлтад тохирох татвар олдсонгүй." : "Татварын код байхгүй байна."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTaxCodes.map((tc) => {
            const config = taxTypeConfig[tc.type] || taxTypeConfig.vat;
            const IconComponent = config.icon;
            const payableAccount = tc.taxAccountPayableId
              ? accounts.find((acc) => acc.id === tc.taxAccountPayableId)
              : null;
            const receivableAccount = tc.taxAccountReceivableId
              ? accounts.find((acc) => acc.id === tc.taxAccountReceivableId)
              : null;

            return (
              <Card
                key={tc.id}
                className={`shadow-sm border-t-4 ${config.borderColor} hover:shadow-md transition-shadow relative overflow-hidden`}
              >
                {/* Background Pattern */}
                <div className={`absolute top-0 right-0 p-4 opacity-10 ${config.color}`}>
                  <IconComponent className="w-24 h-24 transform translate-x-4 -translate-y-4" />
                </div>

                <CardHeader className="pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className={`${config.bgColor} ${config.color} border-none`}>
                          {tc.code}
                        </Badge>
                        {!tc.isActive && <Badge variant="destructive" className="text-xs px-1 py-0 h-5">Идэвхгүй</Badge>}
                      </div>
                      <CardTitle className="text-lg">{tc.name}</CardTitle>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 hover:bg-yellow-50"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDefaultTaxCode(tc.id);
                        }}
                      >
                        <Star className={`h-5 w-5 ${tc.isDefault ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                      </Button>
                      <span className={`text-3xl font-bold ${config.color}`}>
                        {formatPercent(tc.rate)}
                      </span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <IconComponent className="h-4 w-4" />
                    <span>{taxTypeLabels[tc.type]}</span>
                  </div>

                  <div className="space-y-2 text-sm border-t pt-3">
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Төлөх данс (Payable):</span>
                      {payableAccount ? (
                        <Badge variant="secondary" className="font-mono text-xs">
                          {payableAccount.code}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Тохируулаагүй</span>
                      )}
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-muted-foreground">Авах данс (Receivable):</span>
                      {receivableAccount ? (
                        <Badge variant="secondary" className="font-mono text-xs">
                          {receivableAccount.code}
                        </Badge>
                      ) : (
                        <span className="text-gray-400 text-xs italic">Тохируулаагүй</span>
                      )}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-2 flex gap-2">
                  <Button variant="ghost" className="flex-1 text-muted-foreground hover:text-primary" onClick={() => handleEdit(tc)}>
                    <Edit className="h-4 w-4 mr-2" />
                    Засах
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1 text-muted-foreground hover:text-destructive"
                    onClick={(e) => handleDeleteClick(tc.id, e)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Устгах
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        setIsCreateOpen(open);
        if (!open) {
          form.reset();
          setEditingTaxCode(null);
        }
      }}>
        <DialogContent className="w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTaxCode ? "Татварын код засах" : "Шинэ татварын код үүсгэх"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Код *</FormLabel>
                      <FormControl>
                        <Input placeholder="VAT10" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Нэр *</FormLabel>
                      <FormControl>
                        <Input placeholder="НӨАТ 10%" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="rate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Хувь (%) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          min={0}
                          max={100}
                          placeholder="10.00"
                          {...field}
                          onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
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
                          <SelectItem value="vat">НӨАТ</SelectItem>
                          <SelectItem value="income_tax">Орлогын татвар</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="taxAccountPayableId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Татвар төлөх данс (VAT Payable)</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Данс сонгох" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Данс сонгохгүй</SelectItem>
                        {liabilityAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
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
                name="taxAccountReceivableId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Татвар авах данс (VAT Receivable)</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? null : value)}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Данс сонгох" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Данс сонгохгүй</SelectItem>
                        {assetAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingTaxCode(null);
                    form.reset();
                  }}
                >
                  Цуцлах
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Хадгалагдаж байна..." : editingTaxCode ? "Хадгалах" : "Үүсгэх"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteAlertOpen} onOpenChange={setIsDeleteAlertOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Та итгэлтэй байна уу?</AlertDialogTitle>
            <AlertDialogDescription>
              Татварын кодыг устгаснаар буцаах боломжгүй.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Цуцлах</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Устгах
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}
