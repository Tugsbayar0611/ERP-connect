import React, { useState } from "react";
import { useTaxCodes } from "@/hooks/use-tax-codes";
import { useAccounts } from "@/hooks/use-accounts";
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
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search } from "lucide-react";
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

const taxTypeLabels: Record<string, string> = {
  vat: "НӨАТ",
  income_tax: "Орлогын татвар",
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

const formatMNT = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("mn-MN", {
    style: "decimal",
    maximumFractionDigits: 2,
  }).format(num) + "%";
};

export default function TaxCodes() {
  const { taxCodes = [], isLoading, createTaxCode, isCreating } = useTaxCodes();
  const { accounts = [] } = useAccounts();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
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

  // Get liability accounts for payable (VAT payable accounts are usually liabilities)
  const liabilityAccounts = accounts.filter((acc) => acc.type === "liability" && acc.isActive);
  
  // Get asset accounts for receivable (VAT receivable accounts are usually assets)
  const assetAccounts = accounts.filter((acc) => acc.type === "asset" && acc.isActive);

  const onSubmit = async (data: TaxCodeFormValues) => {
    try {
      await createTaxCode({
        code: data.code,
        name: data.name,
        rate: data.rate,
        type: data.type,
        taxAccountPayableId: data.taxAccountPayableId || null,
        taxAccountReceivableId: data.taxAccountReceivableId || null,
        isActive: data.isActive,
      });
      toast({ title: "Амжилттай", description: "Татварын код үүсгэгдлээ." });
      setIsCreateOpen(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Татварын код үүсгэхэд алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const handleAdd = () => {
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

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Татварын Кодууд
          </h2>
          <p className="text-muted-foreground mt-2">
            Татварын кодуудын удирдлага - НӨАТ, Орлогын татвар
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Татварын код нэмэх
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
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

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Код</TableHead>
              <TableHead>Нэр</TableHead>
              <TableHead>Төрөл</TableHead>
              <TableHead>Хувь</TableHead>
              <TableHead>Төлөх данс</TableHead>
              <TableHead>Авах данс</TableHead>
              <TableHead>Төлөв</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Татварын кодууд ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredTaxCodes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {search ? "Хайлтад тохирох татварын код олдсонгүй." : "Татварын код байхгүй байна."}
                </TableCell>
              </TableRow>
            ) : (
              filteredTaxCodes.map((tc) => {
                const payableAccount = tc.taxAccountPayableId 
                  ? accounts.find((acc) => acc.id === tc.taxAccountPayableId)
                  : null;
                const receivableAccount = tc.taxAccountReceivableId
                  ? accounts.find((acc) => acc.id === tc.taxAccountReceivableId)
                  : null;

                return (
                  <TableRow key={tc.id}>
                    <TableCell className="font-mono font-semibold">{tc.code}</TableCell>
                    <TableCell className="font-medium">{tc.name}</TableCell>
                    <TableCell>
                      <Badge variant={tc.type === "vat" ? "default" : "secondary"}>
                        {taxTypeLabels[tc.type] || tc.type}
                      </Badge>
                    </TableCell>
                    <TableCell>{formatMNT(tc.rate)}</TableCell>
                    <TableCell>
                      {payableAccount ? (
                        <span className="text-sm text-muted-foreground">
                          {payableAccount.code} - {payableAccount.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Тохируулаагүй</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {receivableAccount ? (
                        <span className="text-sm text-muted-foreground">
                          {receivableAccount.code} - {receivableAccount.name}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Тохируулаагүй</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={tc.isActive ? "default" : "outline"}>
                        {tc.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        setIsCreateOpen(open);
        if (!open) {
          form.reset();
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Шинэ татварын код үүсгэх</DialogTitle>
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
                    form.reset();
                  }}
                >
                  Цуцлах
                </Button>
                <Button type="submit" disabled={isCreating}>
                  {isCreating ? "Хадгалагдаж байна..." : "Үүсгэх"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
