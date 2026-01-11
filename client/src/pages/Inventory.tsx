import { useState } from "react";
import { useStockLevels } from "@/hooks/use-inventory";
import { useWarehouses } from "@/hooks/use-warehouses";
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
import { Plus, Search, AlertTriangle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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

export default function Inventory() {
  const [warehouseFilter, setWarehouseFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const { levels = [], isLoading } = useStockLevels(warehouseFilter === "all" ? undefined : warehouseFilter);
  const { warehouses = [], isLoading: warehousesLoading, createWarehouse } = useWarehouses();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<InsertWarehouse>({
    resolver: zodResolver(insertWarehouseSchema),
    defaultValues: {
      name: "",
      code: "",
      address: "",
      isDefault: false,
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

  const filteredLevels = levels.filter((l: any) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      l.productName?.toLowerCase().includes(searchLower) ||
      l.productSku?.toLowerCase().includes(searchLower) ||
      l.warehouseName?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Агуулах
          </h2>
          <p className="text-muted-foreground mt-2">
            Барааны нөөц, агуулахуудын удирдлага
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Агуулах нэмэх
        </Button>
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
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Агуулах</TableHead>
              <TableHead>Бараа</TableHead>
              <TableHead>Код</TableHead>
              <TableHead className="text-right">Нөөц</TableHead>
              <TableHead className="text-right">Захиалгдсан</TableHead>
              <TableHead className="text-right">Боломжтой</TableHead>
              <TableHead>Төлөв</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Нөөцийн мэдээлэл ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredLevels.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {search ? "Хайлтад тохирох нөөц олдсонгүй." : "Нөөцийн мэдээлэл байхгүй байна."}
                </TableCell>
              </TableRow>
            ) : (
              filteredLevels.map((level: any) => {
                const quantity = Number(level.quantity || 0);
                const reserved = Number(level.reservedQuantity || 0);
                const available = quantity - reserved;
                const isLowStock = available < 10;

                return (
                  <TableRow key={level.id}>
                    <TableCell className="font-medium">{level.warehouseName || "-"}</TableCell>
                    <TableCell>{level.productName || "-"}</TableCell>
                    <TableCell>{level.productSku || "-"}</TableCell>
                    <TableCell className="text-right">{quantity.toFixed(2)}</TableCell>
                    <TableCell className="text-right">{reserved.toFixed(2)}</TableCell>
                    <TableCell className={`text-right font-semibold ${isLowStock ? "text-red-600" : ""}`}>
                      {available.toFixed(2)}
                      {isLowStock && <AlertTriangle className="inline h-4 w-4 ml-1 text-yellow-500" />}
                    </TableCell>
                    <TableCell>
                      {isLowStock ? (
                        <Badge variant="destructive">Нөөц дуусч байна</Badge>
                      ) : available > 0 ? (
                        <Badge className="bg-green-100 text-green-800">Боломжтой</Badge>
                      ) : (
                        <Badge variant="secondary">Нөөцгүй</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl">
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

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Код</FormLabel>
                      <FormControl>
                        <Input placeholder="WH-001" {...field} value={field.value ?? ''} />
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
                      <Textarea placeholder="Агуулахын хаяг" {...field} value={field.value ?? ''} />
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
    </div>
  );
}
