import { useState, useMemo } from "react";
import { useTaxCodes } from "@/hooks/use-tax-codes";
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
import { Plus, Search, CheckCircle, Trash2, FileText, Eye, QrCode, Download, Printer, Receipt, Loader2, ArrowUpCircle, ArrowDownCircle, AlertTriangle, Banknote, MoreHorizontal, Ban } from "lucide-react";
import { useQPaySettings, useGenerateQPayQR } from "@/hooks/use-qpay";
import { QPayQrModal } from "@/components/qpay/QPayQrModal";
import { useSendEBarimt } from "@/hooks/use-ebarimt";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useSalesOrders } from "@/hooks/use-sales";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { generateInvoicePDF, type InvoicePDFData } from "@/lib/invoice-pdf";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useDocuments } from "@/hooks/use-documents";

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
    case "sent": return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Илгээсэн</Badge>;
    case "posted": return <Badge className="bg-indigo-100 text-indigo-800 border-indigo-200">Бүртгэгдсэн</Badge>;
    case "paid": return <Badge className="bg-green-100 text-green-800 border-green-200">Төлөгдсөн</Badge>;
    case "partially_paid": return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Дутуу төлсөн</Badge>;
    case "overdue": return <Badge className="bg-red-100 text-red-800 border-red-200">Хугацаа хэтэрсэн</Badge>;
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
  const [actionConfirm, setActionConfirm] = useState<{
    open: boolean;
    type: "delete" | "void";
    invoiceId: string;
    invoiceNumber: string;
  } | null>(null);

  const { invoices = [], isLoading, createInvoice, updateInvoiceStatus, previewPosting, postDocument, deleteInvoice } = useInvoices(activeTab === "all" ? undefined : activeTab);
  const { taxCodes = [] } = useTaxCodes();

  const defaultTaxRate = useMemo(() => {
    const def = taxCodes.find(tc => tc.isDefault);
    return def ? Number(def.rate) : 10;
  }, [taxCodes]);

  const { contacts = [] } = useContacts();
  const { products = [] } = useProducts();
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();
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

  // QPay
  const { data: qpaySettings } = useQPaySettings();
  const generateQR = useGenerateQPayQR();
  const [qpayQrModal, setQpayQrModal] = useState<{ open: boolean; qrData: any | null }>({
    open: false,
    qrData: null,
  });

  // E-barimt
  const sendEBarimt = useSendEBarimt();
  const [invoiceDetail, setInvoiceDetail] = useState<{ open: boolean; invoiceId: string | null }>({
    open: false,
    invoiceId: null,
  });

  // Documents - for saving PDFs
  const { createDocument } = useDocuments();

  // Fetch company info for PDF
  const { data: company } = useQuery({
    queryKey: ["/api/company"],
    queryFn: async () => {
      const res = await fetch("/api/company", { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
  });

  // Fetch invoice detail for PDF and E-barimt
  const { data: detailInvoice } = useQuery({
    queryKey: ["/api/invoices", invoiceDetail.invoiceId],
    queryFn: async () => {
      if (!invoiceDetail.invoiceId) return null;
      const res = await fetch(`/api/invoices/${invoiceDetail.invoiceId}`, { credentials: "include" });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!invoiceDetail.invoiceId,
  });


  const handleGenerateQR = async (invoiceId: string) => {
    try {
      const qrData = await generateQR.mutateAsync(invoiceId);
      setQpayQrModal({ open: true, qrData });
    } catch (error: any) {
      toast({
        title: "Алдаа",
        description: error.message || "QR код үүсгэхэд алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

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
      const newInvoice = await createInvoice.mutateAsync(data);

      // Automatically generate and save PDF to Documents
      try {
        // Fetch full invoice details with contact info
        const detailRes = await fetch(`/api/invoices/${newInvoice.id}`, { credentials: "include" });
        if (!detailRes.ok) throw new Error("Failed to fetch invoice details");
        const detailInvoice = await detailRes.json();

        // Find contact from contacts list
        const contact = contacts.find((c) => c.id === detailInvoice.contactId);

        if (detailInvoice && company) {
          const pdfData: InvoicePDFData = {
            invoiceNumber: detailInvoice.invoiceNumber,
            invoiceDate: detailInvoice.invoiceDate,
            dueDate: detailInvoice.dueDate,
            type: detailInvoice.type,
            status: detailInvoice.status,
            companyName: company.legalName || company.name,
            companyAddress: company.address,
            companyPhone: company.phone,
            companyEmail: company.email,
            companyRegNo: company.regNo,
            companyVatNo: company.vatNo,
            contactName: contact?.companyName || `${contact?.firstName || ""} ${contact?.lastName || ""}`.trim() || detailInvoice.contactName || "",
            contactAddress: contact?.address || undefined,
            contactPhone: contact?.phone || undefined,
            contactEmail: contact?.email || undefined,
            contactRegNo: contact?.regNo || undefined,
            contactVatNo: contact?.vatNo || undefined,
            lines: (detailInvoice.lines || []).map((line: any) => ({
              description: line.description || "",
              quantity: parseFloat(line.quantity?.toString() || "0"),
              unitPrice: parseFloat(line.unitPrice?.toString() || "0"),
              taxRate: parseFloat(line.taxRate?.toString() || "10"),
              subtotal: parseFloat(line.subtotal?.toString() || "0"),
              taxAmount: parseFloat(line.taxAmount?.toString() || "0"),
              total: parseFloat(line.total?.toString() || "0"),
            })),
            subtotal: parseFloat(detailInvoice.subtotal?.toString() || "0"),
            taxAmount: parseFloat(detailInvoice.taxAmount?.toString() || "0"),
            totalAmount: parseFloat(detailInvoice.totalAmount?.toString() || "0"),
            paidAmount: parseFloat(detailInvoice.paidAmount?.toString() || "0"),
            remainingAmount: parseFloat(detailInvoice.totalAmount?.toString() || "0") - parseFloat(detailInvoice.paidAmount?.toString() || "0"),
            notes: detailInvoice.notes,
            ebarimtQrCode: detailInvoice.ebarimtQrCode,
            ebarimtReceiptNumber: detailInvoice.ebarimtReceiptNumber,
            ebarimtDocumentId: detailInvoice.ebarimtDocumentId,
          };

          const pdfDataUrl = await generateInvoicePDF(pdfData);
          const fileName = `Нэхэмжлэх-${detailInvoice.invoiceNumber}.pdf`;

          // Validate PDF data before saving
          if (!pdfDataUrl || pdfDataUrl.length < 100) {
            throw new Error("PDF үүсгэхэд алдаа гарлаа: өгөгдөл хэт богино байна");
          }

          // Check for corruption patterns (multiple slashes at start indicate corruption)
          if (pdfDataUrl.includes('t////////') ||
            pdfDataUrl.includes('////////') ||
            pdfDataUrl.includes('////////////////////////////////////////////////////////////////')) {
            throw new Error("PDF үүсгэхэд алдаа гарлаа: өгөгдөл эвдэрсэн байна");
          }

          // Check if data URL is properly formatted
          if (!pdfDataUrl.includes(',') || pdfDataUrl.split(',').length < 2) {
            throw new Error("PDF үүсгэхэд алдаа гарлаа: data URL формат буруу байна");
          }

          // Ensure proper data URL format for storage
          let filePath: string;
          if (pdfDataUrl.startsWith('data:application/pdf;base64,')) {
            // Already in correct format
            filePath = pdfDataUrl;
          } else if (pdfDataUrl.startsWith('data:')) {
            // Has data: prefix but might need to ensure base64 format
            // Check if it already has base64 in the MIME type
            if (pdfDataUrl.includes(';base64,')) {
              filePath = pdfDataUrl;
            } else {
              // Convert to base64 format: data:application/pdf;base64,<data>
              const commaIndex = pdfDataUrl.indexOf(',');
              if (commaIndex !== -1) {
                const mimeType = pdfDataUrl.substring(0, commaIndex);
                const data = pdfDataUrl.substring(commaIndex + 1);
                filePath = `${mimeType};base64,${data}`;
              } else {
                filePath = `data:application/pdf;base64,${pdfDataUrl}`;
              }
            }
          } else {
            // No data: prefix, add it
            filePath = `data:application/pdf;base64,${pdfDataUrl}`;
          }

          // Validate base64 data is valid
          const base64Data = filePath.includes(',') ? filePath.split(',')[1] : filePath;
          if (!base64Data || base64Data.length < 100) {
            throw new Error("PDF үүсгэхэд алдаа гарлаа: base64 өгөгдөл хэт богино байна");
          }

          // Try to decode a small portion to verify it's valid PDF
          try {
            const testDecode = atob(base64Data.substring(0, Math.min(100, base64Data.length)));
            if (!testDecode.startsWith('%PDF-')) {
              console.warn("Generated PDF may be corrupted: does not start with PDF header");
            }
          } catch (e) {
            throw new Error("PDF үүсгэхэд алдаа гарлаа: base64 decode хийхэд алдаа гарлаа");
          }

          // Calculate file size from base64 (approximate: base64 is ~33% larger than binary)
          const fileSize = Math.round((base64Data.length * 3) / 4);

          await createDocument.mutateAsync({
            name: fileName,
            type: "file",
            mimeType: "application/pdf",
            path: filePath,
            size: fileSize,
            relatedEntityType: "invoice",
            relatedEntityId: detailInvoice.id,
          });
        }
      } catch (pdfError: any) {
        // PDF generation error shouldn't block invoice creation
        console.warn("Failed to auto-save invoice PDF:", pdfError);
      }

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
      lines: [{ description: "", quantity: 1, unitPrice: 0, taxRate: defaultTaxRate }],
    });
    setIsCreateOpen(true);
  };

  const filteredContacts = contacts.filter((c) => {
    if (activeTab === "sales") return c.type === "customer" || c.type === "both";
    if (activeTab === "purchase") return c.type === "supplier" || c.type === "both";
    return true;
  });

  const { orders: salesOrders = [] } = useSalesOrders();

  // KPI Calculations
  const stats = {
    receivables: invoices
      .filter((inv: any) => inv.type === 'sales' && inv.status !== 'cancelled')
      .reduce((acc: number, inv: any) => acc + (parseFloat(inv.totalAmount || "0") - parseFloat(inv.paidAmount || "0")), 0),
    payables: invoices
      .filter((inv: any) => inv.type === 'purchase' && inv.status !== 'cancelled')
      .reduce((acc: number, inv: any) => acc + (parseFloat(inv.totalAmount || "0") - parseFloat(inv.paidAmount || "0")), 0),
    overdueCount: invoices.filter((inv: any) => {
      if (inv.status === 'paid' || inv.status === 'cancelled') return false;
      return new Date(inv.dueDate) < new Date();
    }).length
  };

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Нэхэмжлэх
          </h2>
          <p className="text-muted-foreground mt-2">
            Борлуулалт, худалдан авалтын нэхэмжлэх
          </p>
        </div>
        <Button onClick={handleAdd} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Нэхэмжлэх үүсгэх
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Авах авлага</CardTitle>
            <ArrowUpCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatMNT(stats.receivables)}</div>
            <p className="text-xs text-muted-foreground">Борлуулалтаас орж ирэх</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Өгөх өглөг</CardTitle>
            <ArrowDownCircle className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatMNT(stats.payables)}</div>
            <p className="text-xs text-muted-foreground">Худалдан авалтын төлбөр</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-yellow-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Хугацаа хэтэрсэн</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.overdueCount} нэхэмжлэх</div>
            <p className="text-xs text-muted-foreground">Төлөх хугацаа өнгөрсөн</p>
          </CardContent>
        </Card>
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
              <TableHead className="w-[200px]">Төлбөрийн явц</TableHead>
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
                      {invoice.dueDate ? (
                        <div className="flex flex-col">
                          <span>{format(new Date(invoice.dueDate), "yyyy-MM-dd")}</span>
                          {(() => {
                            const isOverdue = new Date(invoice.dueDate) < new Date() && invoice.status !== 'paid' && invoice.status !== 'cancelled';
                            if (isOverdue) {
                              const days = Math.ceil((new Date().getTime() - new Date(invoice.dueDate).getTime()) / (1000 * 3600 * 24));
                              return <span className="text-xs text-red-500 font-medium">{days} хоног хэтэрсэн</span>;
                            }
                            return null;
                          })()}
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={invoice.type === "sales" ? "default" : "secondary"}>
                        {invoice.type === "sales" ? "Борлуулалт" : "Худалдан авалт"}
                      </Badge>
                    </TableCell>
                    <TableCell>{getStatusBadge(invoice.status)}</TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className={`${remaining > 0 ? "text-muted-foreground" : "text-green-600 font-medium"}`}>
                            {formatMNT(paid)}
                          </span>
                          <span className="font-medium">{formatMNT(total)}</span>
                        </div>
                        <Progress value={(paid / total) * 100} className="h-2" />
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Үйлдэл</DropdownMenuLabel>
                            <DropdownMenuItem
                              onClick={() => setInvoiceDetail({ open: true, invoiceId: invoice.id })}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              Дэлгэрэнгүй
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />

                            {/* Actions for unpaid/active invoices - allow payment for posted invoices too */}
                            {invoice.status !== "paid" && invoice.status !== "cancelled" && (
                              <DropdownMenuItem
                                onClick={() => {
                                  setPaymentDialog({ open: true, invoice });
                                  setPaidAmount(total.toString());
                                }}
                              >
                                <Banknote className="mr-2 h-4 w-4 text-green-600" />
                                Төлбөр бүртгэх
                              </DropdownMenuItem>
                            )}

                            {/* Preview Posting (Draft only) */}
                            {invoice.status === "draft" && (
                              <DropdownMenuItem onClick={() => handlePreviewPosting(invoice)}>
                                <Eye className="mr-2 h-4 w-4" />
                                Preview Posting
                              </DropdownMenuItem>
                            )}

                            {/* QPay (Sales only) */}
                            {invoice.type === "sales" &&
                              invoice.status !== "paid" &&
                              invoice.status !== "cancelled" &&
                              qpaySettings?.enabled && (
                                <DropdownMenuItem onClick={() => handleGenerateQR(invoice.id)}>
                                  <QrCode className="mr-2 h-4 w-4" />
                                  QPay QR
                                </DropdownMenuItem>
                              )}

                            <DropdownMenuSeparator />

                            {/* Smart Actions Logic */}
                            {invoice.status === "draft" ? (
                              <DropdownMenuItem
                                className="text-red-600 focus:text-red-600"
                                onClick={() => setActionConfirm({
                                  open: true,
                                  type: "delete",
                                  invoiceId: invoice.id,
                                  invoiceNumber: invoice.invoiceNumber
                                })}
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Устгах
                              </DropdownMenuItem>
                            ) : (
                              invoice.status !== "cancelled" && (
                                <DropdownMenuItem
                                  className="text-orange-600 focus:text-orange-600"
                                  onClick={() => setActionConfirm({
                                    open: true,
                                    type: "void",
                                    invoiceId: invoice.id,
                                    invoiceNumber: invoice.invoiceNumber
                                  })}
                                >
                                  <Ban className="mr-2 h-4 w-4" />
                                  Хүчингүй болгох
                                </DropdownMenuItem>
                              )
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
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
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Шинэ нэхэмжлэх үүсгэх</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

              {/* Type Selection Tabs */}
              <div className="flex justify-center mb-6">
                <Tabs
                  value={form.watch("type")}
                  onValueChange={(v) => form.setValue("type", v as "sales" | "purchase")}
                  className="w-[400px]"
                >
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger
                      value="sales"
                      className="data-[state=active]:bg-blue-600 data-[state=active]:text-white"
                    >
                      Борлуулалт
                    </TabsTrigger>
                    <TabsTrigger
                      value="purchase"
                      className="data-[state=active]:bg-orange-600 data-[state=active]:text-white"
                    >
                      Худалдан авалт
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 border rounded-lg bg-slate-50">
                {/* Left Column: Contact & Import */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Харилцагч</h3>
                  <FormField
                    control={form.control}
                    name="contactId"
                    render={({ field }) => (
                      <FormItem>
                        <Select onValueChange={(val) => {
                          field.onChange(val);
                          // Check for importable orders logic here if needed immediately
                        }} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white">
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

                  {/* Import from Order Logic */}
                  {form.watch("contactId") && form.watch("type") === 'sales' && (() => {
                    // Find confirmed orders for this contact
                    const contactOrders = salesOrders.filter(o =>
                      o.customerId === form.watch("contactId") &&
                      o.status === "confirmed" &&
                      !invoices.some((inv: any) => inv.reference === o.orderNumber) // Simple check, ideally check linked IDs
                    );

                    if (contactOrders.length > 0) {
                      return (
                        <div className="mt-2 space-y-2">
                          {contactOrders.slice(0, 3).map(order => (
                            <div key={order.id} className="text-sm bg-blue-50 text-blue-700 p-2 rounded border border-blue-200 flex items-center justify-between">
                              <span>Захиалга: <b>{order.orderNumber}</b> ({formatMNT(order.totalAmount)})</span>
                              <Button size="sm" variant="outline" type="button" onClick={() => {
                                // Import items
                                const newLines = (order.lines || []).map((l: any) => ({
                                  productId: l.productId,
                                  description: l.productName || "Product", // Fallback
                                  quantity: Number(l.quantity),
                                  unitPrice: Number(l.unitPrice),
                                  taxRate: 10 // Assumption
                                }));
                                form.setValue("lines", newLines);
                                toast({ title: "Амжилттай", description: "Захиалгын барааг татлаа." });
                              }}>
                                Татах
                              </Button>
                            </div>
                          ))}
                        </div>
                      )
                    }
                    return null;
                  })()}

                </div>

                {/* Right Column: Invoice Details */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">Баримтын мэдээлэл</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="invoiceDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Огноо</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="bg-white" />
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
                          <FormLabel>Төлөх хугацаа</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="bg-white" />
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
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="bg-white">
                              <SelectValue placeholder="Төлбөрийн нөхцөл" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="cash">Бэлэн мөнгө</SelectItem>
                            <SelectItem value="bank_transfer">Банкны шилжүүлэг</SelectItem>
                            <SelectItem value="qr_code">QR код</SelectItem>
                          </SelectContent>
                        </Select>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold">Мөрүүд</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => append({ description: "", quantity: 1, unitPrice: 0, taxRate: defaultTaxRate })}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Мөр нэмэх
                  </Button>
                </div>

                <div className="space-y-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[30%]">Бараа / Тайлбар</TableHead>
                        <TableHead className="w-[15%]">Тоо</TableHead>
                        <TableHead className="w-[20%]">Үнэ</TableHead>
                        <TableHead className="w-[15%]">Татвар %</TableHead>
                        <TableHead className="w-[15%] text-right">Нийт</TableHead>
                        <TableHead className="w-[5%]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {fields.map((field, index) => (
                        <TableRow key={field.id}>
                          <TableCell className="space-y-2">
                            <FormField
                              control={form.control}
                              name={`lines.${index}.productId`}
                              render={({ field }) => (
                                <FormItem>
                                  <Select onValueChange={field.onChange} value={field.value}>
                                    <FormControl>
                                      <SelectTrigger>
                                        <SelectValue placeholder="Сонгох..." />
                                      </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                      <SelectItem value="none">Бараагүй (Үйлчилгээ)</SelectItem>
                                      {products.map((p) => (
                                        <SelectItem key={p.id} value={p.id}>
                                          {p.name}
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={form.control}
                              name={`lines.${index}.description`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input placeholder="Тайлбар" {...field} />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="valign-top">
                            <FormField
                              control={form.control}
                              name={`lines.${index}.quantity`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      {...field}
                                      onChange={(e) => {
                                        const val = parseFloat(e.target.value) || 0;
                                        field.onChange(val);
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
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="valign-top">
                            <FormField
                              control={form.control}
                              name={`lines.${index}.unitPrice`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="valign-top">
                            <FormField
                              control={form.control}
                              name={`lines.${index}.taxRate`}
                              render={({ field }) => (
                                <FormItem>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 10)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </TableCell>
                          <TableCell className="text-right align-top pt-4">
                            {formatMNT(calculateLineTotal(form.watch(`lines.${index}`)).total)}
                          </TableCell>
                          <TableCell className="align-top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => remove(index)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div className="flex justify-between items-center bg-slate-100 p-4 rounded-lg mt-8 border">
                  <div>
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              placeholder="Тэмдэглэл, банкны мэдээлэл..."
                              className="w-[300px] h-20 bg-white"
                              {...field}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>
                  <div className="w-[300px] space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Дэд дүн:</span>
                      <span>{formatMNT(calculateTotal().subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">НӨАТ (10%):</span>
                      <span>{formatMNT(calculateTotal().tax)}</span>
                    </div>
                    <div className="border-t pt-2 mt-2 flex justify-between items-center">
                      <span className="font-bold text-lg">НИЙТ ТӨЛӨХ:</span>
                      <span className="font-bold text-2xl text-blue-600">{formatMNT(calculateTotal().total)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Болих
                  </Button>
                  <Button type="submit" disabled={createInvoice.isPending}>
                    {createInvoice.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Нэхэмжлэх хадгалах
                  </Button>
                </div>
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
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
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

      {/* QPay QR Modal */}
      <QPayQrModal
        open={qpayQrModal.open}
        onOpenChange={(open) => setQpayQrModal({ ...qpayQrModal, open })}
        qrData={qpayQrModal.qrData}
      />

      {/* Invoice Detail Dialog */}
      <Dialog open={invoiceDetail.open} onOpenChange={(open) => setInvoiceDetail({ open, invoiceId: null })}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Нэхэмжлэхийн дэлгэрэнгүй</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-end gap-2 mb-4">
            {detailInvoice && (
              <>
                {/* E-barimt Send Button */}
                {!detailInvoice.ebarimtDocumentId && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (!detailInvoice?.id) return;
                      sendEBarimt.mutate(detailInvoice.id);
                    }}
                    disabled={sendEBarimt.isPending}
                  >
                    {sendEBarimt.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Илгээж байна...
                      </>
                    ) : (
                      <>
                        <Receipt className="h-4 w-4 mr-2" />
                        И-баримт илгээх
                      </>
                    )}
                  </Button>
                )}

                {/* PDF Export Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!detailInvoice || !company) return;
                    const contact = contacts.find((c) => c.id === detailInvoice.contactId);
                    const pdfData: InvoicePDFData = {
                      invoiceNumber: detailInvoice.invoiceNumber,
                      invoiceDate: detailInvoice.invoiceDate,
                      dueDate: detailInvoice.dueDate,
                      type: detailInvoice.type,
                      status: detailInvoice.status,
                      companyName: company.name,
                      companyAddress: company.address,
                      companyPhone: company.phone,
                      companyEmail: company.email,
                      companyRegNo: company.regNo,
                      companyVatNo: company.vatNo,
                      contactName: contact?.companyName || `${contact?.firstName || ""} ${contact?.lastName || ""}`.trim(),
                      contactAddress: contact?.address || undefined,
                      contactPhone: contact?.phone || undefined,
                      contactEmail: contact?.email || undefined,
                      contactRegNo: contact?.regNo || undefined,
                      contactVatNo: contact?.vatNo || undefined,
                      lines: (detailInvoice.lines || []).map((line: any) => ({
                        description: line.description || "",
                        quantity: parseFloat(line.quantity || "0"),
                        unitPrice: parseFloat(line.unitPrice || "0"),
                        taxRate: parseFloat(line.taxRate || "10"),
                        subtotal: parseFloat(line.subtotal || "0"),
                        taxAmount: parseFloat(line.taxAmount || "0"),
                        total: parseFloat(line.total || "0"),
                      })),
                      subtotal: parseFloat(detailInvoice.subtotal || "0"),
                      taxAmount: parseFloat(detailInvoice.taxAmount || "0"),
                      totalAmount: parseFloat(detailInvoice.totalAmount || "0"),
                      paidAmount: parseFloat(detailInvoice.paidAmount || "0"),
                      remainingAmount: parseFloat(detailInvoice.totalAmount || "0") - parseFloat(detailInvoice.paidAmount || "0"),
                      notes: detailInvoice.notes,
                      // E-barimt info
                      ebarimtQrCode: detailInvoice.ebarimtQrCode,
                      ebarimtReceiptNumber: detailInvoice.ebarimtReceiptNumber,
                      ebarimtDocumentId: detailInvoice.ebarimtDocumentId,
                    };
                    try {
                      // Generate PDF and get base64 data
                      const pdfBase64 = await generateInvoicePDF(pdfData);
                      const fileName = `Нэхэмжлэх-${detailInvoice.invoiceNumber}.pdf`;

                      // Trigger browser download
                      const base64Data = pdfBase64.split(',')[1];
                      const byteCharacters = atob(base64Data);
                      const byteNumbers = new Array(byteCharacters.length);
                      for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                      }
                      const byteArray = new Uint8Array(byteNumbers);
                      const blob = new Blob([byteArray], { type: 'application/pdf' });
                      const downloadUrl = URL.createObjectURL(blob);
                      const link = document.createElement('a');
                      link.href = downloadUrl;
                      link.download = fileName;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                      URL.revokeObjectURL(downloadUrl);

                      // Also save PDF to Documents system
                      createDocument.mutate({
                        name: fileName,
                        type: "file",
                        mimeType: "application/pdf",
                        path: pdfBase64,
                        size: Math.round((pdfBase64.length * 3) / 4),
                        relatedEntityType: "invoice",
                        relatedEntityId: detailInvoice.id,
                      }, {
                        onSuccess: () => {
                          toast({
                            title: "Амжилттай",
                            description: "PDF файл татагдлаа.",
                          });
                        },
                        onError: () => {
                          toast({
                            title: "Амжилттай",
                            description: "PDF файл татагдлаа.",
                          });
                        }
                      });
                    } catch (error: any) {
                      toast({
                        title: "Алдаа",
                        description: error.message || "PDF үүсгэхэд алдаа гарлаа",
                        variant: "destructive",
                      });
                    }
                  }}
                >
                  <Download className="h-4 w-4 mr-2" />
                  PDF татах
                </Button>
              </>
            )}
          </div>
          {detailInvoice && (
            <div className="space-y-6">
              {/* Invoice Header */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">Нэхэмжлэхийн дугаар</p>
                  <p className="font-semibold text-lg">{detailInvoice.invoiceNumber}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Төлөв</p>
                  <p>{getStatusBadge(detailInvoice.status)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Огноо</p>
                  <p className="font-semibold">
                    {detailInvoice.invoiceDate ? format(new Date(detailInvoice.invoiceDate), "yyyy-MM-dd") : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Төлөх хугацаа</p>
                  <p className="font-semibold">
                    {detailInvoice.dueDate ? format(new Date(detailInvoice.dueDate), "yyyy-MM-dd") : "-"}
                  </p>
                </div>
              </div>

              {/* Contact Info */}
              {contacts.find((c) => c.id === detailInvoice.contactId) && (
                <div className="p-4 border rounded-lg">
                  <p className="text-sm font-semibold mb-2">
                    {detailInvoice.type === "sales" ? "Харилцагч:" : "Нийлүүлэгч:"}
                  </p>
                  <p className="font-medium">
                    {contacts.find((c) => c.id === detailInvoice.contactId)?.companyName ||
                      `${contacts.find((c) => c.id === detailInvoice.contactId)?.firstName || ""} ${contacts.find((c) => c.id === detailInvoice.contactId)?.lastName || ""
                        }`.trim()}
                  </p>
                </div>
              )}

              {/* Invoice Lines */}
              <div>
                <h3 className="font-semibold mb-3">Мөрүүд</h3>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>№</TableHead>
                      <TableHead>Тайлбар</TableHead>
                      <TableHead className="text-right">Тоо</TableHead>
                      <TableHead className="text-right">Үнэ</TableHead>
                      <TableHead className="text-right">Татвар %</TableHead>
                      <TableHead className="text-right">Дэд дүн</TableHead>
                      <TableHead className="text-right">Татвар</TableHead>
                      <TableHead className="text-right">Нийт</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(detailInvoice.lines || []).map((line: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{index + 1}</TableCell>
                        <TableCell>{line.description || "-"}</TableCell>
                        <TableCell className="text-right">{line.quantity || "0"}</TableCell>
                        <TableCell className="text-right">{formatMNT(line.unitPrice)}</TableCell>
                        <TableCell className="text-right">{line.taxRate || "10"}%</TableCell>
                        <TableCell className="text-right">{formatMNT(line.subtotal)}</TableCell>
                        <TableCell className="text-right">{formatMNT(line.taxAmount)}</TableCell>
                        <TableCell className="text-right font-semibold">{formatMNT(line.total)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Totals */}
              <div className="space-y-2 text-right border-t pt-4">
                <div className="flex justify-end gap-4">
                  <span>Дэд дүн:</span>
                  <span className="font-semibold">{formatMNT(detailInvoice.subtotal)}</span>
                </div>
                <div className="flex justify-end gap-4">
                  <span>ХХОАТ:</span>
                  <span className="font-semibold">{formatMNT(detailInvoice.taxAmount)}</span>
                </div>
                <div className="flex justify-end gap-4 text-lg font-bold border-t pt-2">
                  <span>Нийт дүн:</span>
                  <span className="text-primary">{formatMNT(detailInvoice.totalAmount)}</span>
                </div>
                {parseFloat(detailInvoice.paidAmount || "0") > 0 && (
                  <>
                    <div className="flex justify-end gap-4">
                      <span>Төлсөн дүн:</span>
                      <span className="font-semibold text-green-600">{formatMNT(detailInvoice.paidAmount)}</span>
                    </div>
                    <div className="flex justify-end gap-4">
                      <span>Үлдэгдэл:</span>
                      <span className="font-semibold">
                        {formatMNT(
                          parseFloat(detailInvoice.totalAmount || "0") - parseFloat(detailInvoice.paidAmount || "0")
                        )}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {/* Notes */}
              {detailInvoice.notes && (
                <div className="p-4 border rounded-lg">
                  <p className="text-sm font-semibold mb-2">Тэмдэглэл:</p>
                  <p className="text-sm text-muted-foreground">{detailInvoice.notes}</p>
                </div>
              )}

              {/* E-barimt Information */}
              {detailInvoice.ebarimtDocumentId && (
                <Card className="border-green-200 bg-green-50/50">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-green-700">
                      <Receipt className="h-5 w-5" />
                      И-баримтын мэдээлэл
                    </CardTitle>
                    <CardDescription>Энэ нэхэмжлэх И-баримт руу илгээгдсэн</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {detailInvoice.ebarimtReceiptNumber && (
                      <div>
                        <p className="text-sm text-muted-foreground">Сугалааны дугаар:</p>
                        <p className="font-semibold text-lg">{detailInvoice.ebarimtReceiptNumber}</p>
                      </div>
                    )}
                    {detailInvoice.ebarimtQrCode && (
                      <div>
                        <p className="text-sm text-muted-foreground mb-2">QR код:</p>
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-white rounded border">
                            {detailInvoice.ebarimtQrCode.startsWith("data:image") || detailInvoice.ebarimtQrCode.startsWith("http") ? (
                              <img
                                src={detailInvoice.ebarimtQrCode}
                                alt="E-barimt QR Code"
                                className="w-32 h-32"
                                onError={(e) => {
                                  // If image fails, show QR text as fallback
                                  const target = e.target as HTMLImageElement;
                                  target.style.display = "none";
                                }}
                              />
                            ) : (
                              <div className="w-32 h-32 flex items-center justify-center text-xs text-muted-foreground break-all p-2">
                                {detailInvoice.ebarimtQrCode}
                              </div>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              navigator.clipboard.writeText(detailInvoice.ebarimtQrCode || "");
                              toast({
                                title: "Хуулагдлаа",
                                description: "QR код хуулагдлаа",
                              });
                            }}
                          >
                            <Download className="h-4 w-4 mr-2" />
                            QR хуулах
                          </Button>
                        </div>
                      </div>
                    )}
                    {detailInvoice.ebarimtDocumentId && (
                      <div>
                        <p className="text-sm text-muted-foreground">Баримтын ID:</p>
                        <p className="font-mono text-sm">{detailInvoice.ebarimtDocumentId}</p>
                      </div>
                    )}
                    {detailInvoice.ebarimtSentAt && (
                      <div>
                        <p className="text-sm text-muted-foreground">Илгээсэн огноо:</p>
                        <p className="text-sm">
                          {format(new Date(detailInvoice.ebarimtSentAt), "yyyy-MM-dd HH:mm:ss")}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
      {/* Smart Action Confirmation Dialog */}
      <AlertDialog open={!!actionConfirm?.open} onOpenChange={(open) => !open && setActionConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Та итгэлтэй байна уу?</AlertDialogTitle>
            <AlertDialogDescription>
              {actionConfirm?.type === "delete"
                ? `Та ${actionConfirm?.invoiceNumber} дугаартай нэхэмжлэхийг устгах гэж байна. Энэ үйлдлийг буцаах боломжгүй.`
                : `Та ${actionConfirm?.invoiceNumber} дугаартай нэхэмжлэхийг хүчингүй болгох гэж байна. Энэ нь төлөвийг 'Цуцлагдсан' болгоно.`
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Болих</AlertDialogCancel>
            <AlertDialogAction
              className={actionConfirm?.type === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-orange-600 hover:bg-orange-700"}
              onClick={() => {
                if (actionConfirm?.type === "delete") {
                  deleteInvoice.mutate(actionConfirm.invoiceId, {
                    onSuccess: () => {
                      toast({ title: "Амжилттай", description: "Нэхэмжлэх устгагдлаа" });
                      setActionConfirm(null);
                    }
                  });
                } else if (actionConfirm?.type === "void") {
                  updateInvoiceStatus.mutate({
                    id: actionConfirm!.invoiceId,
                    status: "cancelled"
                  }, {
                    onSuccess: () => {
                      toast({ title: "Амжилттай", description: "Нэхэмжлэх хүчингүй боллоо" });
                      setActionConfirm(null);
                    }
                  });
                }
              }}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
