import { useState } from "react";
import { useInvoices } from "@/hooks/use-invoices";
import { useContacts } from "@/hooks/use-contacts";
import { useProducts } from "@/hooks/use-products";
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
import { Plus, Search, CheckCircle, Trash2, FileText, Eye, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Textarea } from "@/components/ui/textarea";

const formatMNT = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(num) + '₮';
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "draft": return <Badge variant="outline">Ноорог</Badge>;
    case "sent": return <Badge className="bg-yellow-100 text-yellow-800">Илгээсэн</Badge>;
    case "posted": return <Badge className="bg-blue-100 text-blue-800">Бүртгэгдсэн</Badge>;
    case "paid": return <Badge className="bg-green-100 text-green-800">Төлөгдсөн</Badge>;
    case "cancelled": return <Badge variant="destructive">Цуцлагдсан</Badge>;
    default: return <Badge>{status}</Badge>;
  }
};

const invoiceSchema = z.object({
  contactId: z.string().min(1, "Харилцагч сонгоно уу"),
  invoiceDate: z.string().min(1),
  dueDate: z.string().min(1),
  type: z.enum(["sales", "purchase"]).default("sales"),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    productId: z.string().optional(),
    description: z.string().min(1, "Тайлбар оруулна уу"),
    quantity: z.number().min(0.01, "Тоо хэмжээ оруулна уу"),
    unitPrice: z.number().min(0, "Үнэ оруулна уу"),
    taxRate: z.number().min(0).max(100).default(10),
  })).min(1, "Хамгийн багадаа 1 мөр нэмнэ үү"),
});

type InvoiceFormValues = z.infer<typeof invoiceSchema>;

export default function Invoices() {
  const [activeTab, setActiveTab] = useState<"all" | "sales" | "purchase">("all");
  const { invoices = [], isLoading, createInvoice, updateInvoiceStatus, previewPosting, postDocument } = useInvoices(activeTab === "all" ? undefined : activeTab);
  const { contacts = [] } = useContacts();
  const { products = [] } = useProducts();
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; invoice: any | null }>({
    open: false,
    invoice: null,
  });
  const [paidAmount, setPaidAmount] = useState("");
  const [postingPreview, setPostingPreview] = useState<{ open: boolean; invoice: any | null; preview: any | null }>({
    open: false,
    invoice: null,
    preview: null,
  });

  const form = useForm<InvoiceFormValues>({
    resolver: zodResolver(invoiceSchema),
    defaultValues: {
      contactId: "",
      invoiceDate: format(new Date(), "yyyy-MM-dd"),
      dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
      type: activeTab === "purchase" ? "purchase" : "sales",
      paymentMethod: "",
      notes: "",
      lines: [{ description: "", quantity: 1, unitPrice: 0, taxRate: 10 }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "lines",
  });

  const onSubmit = async (data: InvoiceFormValues) => {
    try {
      await createInvoice.mutateAsync(data);
      toast({ title: "Амжилттай", description: "Нэхэмжлэх үүсгэгдлээ." });
      setIsCreateOpen(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Нэхэмжлэх үүсгэхэд алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const handleMarkPaid = async () => {
    if (!paymentDialog.invoice) return;
    try {
      const amount = parseFloat(paidAmount) || parseFloat(paymentDialog.invoice.totalAmount || "0");
      await updateInvoiceStatus.mutateAsync({
        id: paymentDialog.invoice.id,
        status: "paid",
        paidAmount: amount,
      });
      toast({ title: "Амжилттай", description: "Нэхэмжлэх төлөгдсөн гэж тэмдэглэгдлээ." });
      setPaymentDialog({ open: false, invoice: null });
      setPaidAmount("");
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Төлбөрийг бүртгэхэд алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const handlePreviewPosting = async (invoice: any) => {
    try {
      const preview = await previewPosting.mutateAsync({
        modelType: "invoice",
        modelId: invoice.id,
      });
      setPostingPreview({ open: true, invoice, preview });
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Posting preview авахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const handlePostInvoice = async () => {
    if (!postingPreview.invoice) return;
    try {
      await postDocument.mutateAsync({
        modelType: "invoice",
        modelId: postingPreview.invoice.id,
      });
      toast({ 
        title: "Амжилттай", 
        description: "Нэхэмжлэх амжилттай бүртгэгдлээ. Journal entry үүсгэгдлээ." 
      });
      setPostingPreview({ open: false, invoice: null, preview: null });
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Posting хийхэд алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const calculateLineTotal = (line: any) => {
    const qty = Number(line.quantity || 0);
    const price = Number(line.unitPrice || 0);
    const taxRate = Number(line.taxRate || 10);
    const subtotal = qty * price;
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

  const filteredInvoices = invoices.filter((inv) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      inv.invoiceNumber?.toLowerCase().includes(searchLower) ||
      inv.contactName?.toLowerCase().includes(searchLower)
    );
  });

  const handleAdd = () => {
    form.reset({
      contactId: "",
      invoiceDate: format(new Date(), "yyyy-MM-dd"),
      dueDate: format(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd"),
      type: activeTab === "purchase" ? "purchase" : "sales",
      paymentMethod: "",
      notes: "",
      lines: [{ description: "", quantity: 1, unitPrice: 0, taxRate: 10 }],
    });
    setIsCreateOpen(true);
  };

  const filteredContacts = contacts.filter((c) => {
    if (activeTab === "sales") return c.type === "customer" || c.type === "both";
    if (activeTab === "purchase") return c.type === "supplier" || c.type === "both";
    return true;
  });

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Нэхэмжлэх
          </h2>
          <p className="text-muted-foreground mt-2">
            Борлуулалт, худалдан авалтын нэхэмжлэх
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Нэхэмжлэх үүсгэх
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Бүгд</TabsTrigger>
          <TabsTrigger value="sales">Борлуулалт</TabsTrigger>
          <TabsTrigger value="purchase">Худалдан авалт</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Нэхэмжлэхээр хайх..."
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
              <TableHead>Нэхэмжлэхийн дугаар</TableHead>
              <TableHead>Харилцагч</TableHead>
              <TableHead>Огноо</TableHead>
              <TableHead>Төлөх хугацаа</TableHead>
              <TableHead>Төрөл</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead className="text-right">Нийт дүн</TableHead>
              <TableHead className="text-right">Төлсөн</TableHead>
              <TableHead>Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Нэхэмжлэх ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredInvoices.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  {search ? "Хайлтад тохирох нэхэмжлэх олдсонгүй." : "Нэхэмжлэх байхгүй байна."}
                </TableCell>
              </TableRow>
            ) : (
              filteredInvoices.map((invoice) => {
                const total = parseFloat(invoice.totalAmount || "0");
                const paid = parseFloat(invoice.paidAmount || "0");
                const remaining = total - paid;

                return (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                    <TableCell>{invoice.contactName || "-"}</TableCell>
                    <TableCell>
                      {invoice.invoiceDate ? format(new Date(invoice.invoiceDate), "yyyy-MM-dd") : "-"}
                    </TableCell>
                    <TableCell>
                      {invoice.dueDate ? format(new Date(invoice.dueDate), "yyyy-MM-dd") : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={invoice.type === "sales" ? "default" : "secondary"}>
                        {invoice.type === "sales" ? "Борлуулалт" : "Худалдан авалт"}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell className="text-right font-semibold">{formatMNT(total)}</TableCell>
                    <TableCell className="text-right">
                      {paid > 0 ? (
                        <span className={remaining > 0 ? "text-yellow-600" : "text-green-600"}>
                          {formatMNT(paid)}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => window.open(`/invoices/${invoice.id}/print`, '_blank')}
                          title="PDF татах / Хэвлэх"
                        >
                          <Printer className="h-3 w-3 mr-1" />
                          PDF
                        </Button>
                        {invoice.status === "draft" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePreviewPosting(invoice)}
                            disabled={previewPosting.isPending}
                            title="Journal entry preview"
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            Preview
                          </Button>
                        )}
                        {invoice.status !== "paid" && invoice.status !== "cancelled" && invoice.status !== "posted" && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPaymentDialog({ open: true, invoice });
                              setPaidAmount(total.toString());
                            }}
                            disabled={updateInvoiceStatus.isPending}
                          >
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Төлбөр
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Нэхэмжлэх үүсгэх Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Шинэ нэхэмжлэх үүсгэх</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="contactId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Харилцагч *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Харилцагч сонгох" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredContacts.map((c) => (
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
                  name="type"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Төрөл *</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Төрөл сонгох" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="sales">Борлуулалт</SelectItem>
                          <SelectItem value="purchase">Худалдан авалт</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="invoiceDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Нэхэмжлэхийн огноо *</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="dueDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Төлөх хугацаа *</FormLabel>
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
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Төлбөрийн арга</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Төлбөрийн арга сонгох" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="cash">Бэлэн мөнгө</SelectItem>
                        <SelectItem value="bank_transfer">Банкны шилжүүлэг</SelectItem>
                        <SelectItem value="qr_code">QR код</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold">Мөрүүд</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ description: "", quantity: 1, unitPrice: 0, taxRate: 10 })}
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
                                    <SelectValue placeholder="Бараа (сонгохгүй бол)" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  <SelectItem value="none">Бараагүй</SelectItem>
                                  {products.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name}
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
                                  onChange={(e) => {
                                    const val = parseFloat(e.target.value) || 0;
                                    field.onChange(val);
                                    // Auto-fill product price if product selected
                                    const productId = form.watch(`lines.${index}.productId`);
                                    if (productId && productId !== "none") {
                                      const product = products.find(p => p.id === productId);
                                      if (product) {
                                        form.setValue(`lines.${index}.unitPrice`, Number(product.salePrice || 0));
                                      }
                                    }
                                  }}
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
                          name={`lines.${index}.taxRate`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  placeholder="Татвар %"
                                  {...field}
                                  onChange={(e) => field.onChange(parseFloat(e.target.value) || 10)}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <FormField
                        control={form.control}
                        name={`lines.${index}.description`}
                        render={({ field }) => (
                          <FormItem>
                            <FormControl>
                              <Input placeholder="Тайлбар *" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
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
                    <span>ХХОАТ:</span>
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
                <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                  Цуцлах
                </Button>
                <Button type="submit" disabled={createInvoice.isPending}>
                  {createInvoice.isPending ? "Хадгалагдаж байна..." : "Хадгалах"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Төлбөр бүртгэх Dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={(open) => setPaymentDialog({ open, invoice: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Төлбөр бүртгэх</DialogTitle>
          </DialogHeader>
          {paymentDialog.invoice && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Нэхэмжлэхийн дугаар:</p>
                <p className="font-semibold">{paymentDialog.invoice.invoiceNumber}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Нийт дүн:</p>
                <p className="font-semibold text-lg">{formatMNT(paymentDialog.invoice.totalAmount)}</p>
              </div>
              <div>
                <label className="text-sm font-medium">Төлсөн дүн (₮)</label>
                <Input
                  type="number"
                  value={paidAmount}
                  onChange={(e) => setPaidAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setPaymentDialog({ open: false, invoice: null })}>
                  Цуцлах
                </Button>
                <Button onClick={handleMarkPaid} disabled={updateInvoiceStatus.isPending}>
                  {updateInvoiceStatus.isPending ? "Хадгалагдаж байна..." : "Төлбөр бүртгэх"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Posting Preview Dialog */}
      <Dialog open={postingPreview.open} onOpenChange={(open) => setPostingPreview({ open, invoice: null, preview: null })}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Journal Entry Preview - Posting</DialogTitle>
          </DialogHeader>
          {postingPreview.invoice && postingPreview.preview && (
            <div className="space-y-4">
              <div className="border rounded-lg p-4 bg-muted/50">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Нэхэмжлэхийн дугаар:</p>
                    <p className="font-semibold">{postingPreview.invoice.invoiceNumber}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Огноо:</p>
                    <p className="font-semibold">
                      {postingPreview.preview.journalEntry.entryDate
                        ? format(new Date(postingPreview.preview.journalEntry.entryDate), "yyyy-MM-dd")
                        : "-"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-muted-foreground">Тайлбар:</p>
                    <p className="font-semibold">{postingPreview.preview.journalEntry.description}</p>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-3">Journal Lines:</h4>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Данс</TableHead>
                        <TableHead>Дансны нэр</TableHead>
                        <TableHead className="text-right">Дебет</TableHead>
                        <TableHead className="text-right">Кредит</TableHead>
                        <TableHead>Тайлбар</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {postingPreview.preview.journalEntry.lines.map((line: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono">{line.accountCode}</TableCell>
                          <TableCell>{line.accountName}</TableCell>
                          <TableCell className="text-right">
                            {line.debit > 0 ? formatMNT(line.debit) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {line.credit > 0 ? formatMNT(line.credit) : "-"}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">{line.description}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {postingPreview.preview.journalEntry.taxLines && postingPreview.preview.journalEntry.taxLines.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-3">Tax Lines:</h4>
                  <div className="border rounded-lg p-4">
                    {postingPreview.preview.journalEntry.taxLines.map((taxLine: any, idx: number) => (
                      <div key={idx} className="flex justify-between items-center py-2 border-b last:border-0">
                        <div>
                          <span className="font-semibold">{taxLine.taxCode}</span>
                          <span className="text-sm text-muted-foreground ml-2">
                            Суурь: {formatMNT(taxLine.taxBase)}
                          </span>
                        </div>
                        <span className="font-semibold">{formatMNT(taxLine.taxAmount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="border-t pt-4">
                <div className="flex justify-between items-center text-lg">
                  <span className="font-semibold">Нийт Дебет:</span>
                  <span className="font-bold">{formatMNT(postingPreview.preview.totalDebit)}</span>
                </div>
                <div className="flex justify-between items-center text-lg">
                  <span className="font-semibold">Нийт Кредит:</span>
                  <span className="font-bold">{formatMNT(postingPreview.preview.totalCredit)}</span>
                </div>
                <div className={`mt-2 p-2 rounded ${postingPreview.preview.isBalanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                  <p className="font-semibold text-center">
                    {postingPreview.preview.isBalanced ? "✅ Double-entry баланс зөв" : "❌ Double-entry баланс зөрсөн"}
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setPostingPreview({ open: false, invoice: null, preview: null })}>
                  Цуцлах
                </Button>
                <Button 
                  onClick={handlePostInvoice} 
                  disabled={postDocument.isPending || !postingPreview.preview.isBalanced}
                >
                  {postDocument.isPending ? "Бүртгэж байна..." : "Бүртгэх (Post)"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
