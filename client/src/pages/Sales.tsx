import { useState, useEffect } from "react";
import { useSalesOrders } from "@/hooks/use-sales";
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
import { Plus, Search, Send, CheckCircle, FileText, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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

export default function Sales() {
  const { orders = [], isLoading, createOrder, confirmOrder, sendOrder, createInvoice } = useSalesOrders();
  const { products = [] } = useProducts();
  const { contacts: customers = [] } = useContacts("customer");
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

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

  const filteredOrders = orders.filter((o) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      o.orderNumber?.toLowerCase().includes(searchLower) ||
      o.customerName?.toLowerCase().includes(searchLower)
    );
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Борлуулалт
          </h2>
          <p className="text-muted-foreground mt-2">
            Борлуулалтын захиалга, үнэлгээ
          </p>
        </div>
        <Button onClick={() => setIsOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Захиалга үүсгэх
        </Button>
      </div>

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

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Захиалгын дугаар</TableHead>
              <TableHead>Үйлчлүүлэгч</TableHead>
              <TableHead>Огноо</TableHead>
              <TableHead>Хүргэлтийн огноо</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead className="text-right">Нийт дүн</TableHead>
              <TableHead>Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Захиалга ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredOrders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  {search ? "Хайлтад тохирох захиалга олдсонгүй." : "Захиалга байхгүй байна."}
                </TableCell>
              </TableRow>
            ) : (
              filteredOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-medium">{order.orderNumber}</TableCell>
                  <TableCell>{order.customerName || "-"}</TableCell>
                  <TableCell>{order.orderDate ? format(new Date(order.orderDate), "yyyy-MM-dd") : "-"}</TableCell>
                  <TableCell>{order.deliveryDate ? format(new Date(order.deliveryDate), "yyyy-MM-dd") : "-"}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatMNT(order.totalAmount || "0")}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Шинэ борлуулалтын захиалга</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold">Бараа</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ productId: "", quantity: 1, unitPrice: 0, discount: 0, taxRate: 10 })}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Мөр нэмэх
                  </Button>
                </div>

                <div className="space-y-4">
                  {fields.map((field, index) => (
                    <div key={field.id} className="border rounded-lg p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Мөр #{index + 1}</span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => remove(index)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                      <div className="grid grid-cols-5 gap-2">
                        <FormField
                          control={form.control}
                          name={`lines.${index}.productId`}
                          render={({ field }) => (
                            <FormItem className="col-span-2">
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Бараа" />
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
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name={`lines.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Тоо"
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
                          name={`lines.${index}.unitPrice`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Үнэ"
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
                          name={`lines.${index}.discount`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Хөнгөлөлт %"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="text-right text-sm text-muted-foreground">
                        Нийт: {formatMNT(calculateLineTotal(form.watch(`lines.${index}`)).total)}
                      </div>
                    </div>
                  ))}
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

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Тэмдэглэл</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Тэмдэглэл..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

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
