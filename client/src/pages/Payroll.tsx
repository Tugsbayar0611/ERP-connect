import { useState, useEffect, useMemo } from "react";
import { usePayroll } from "@/hooks/use-payroll";
import { format } from "date-fns";
import { mn } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Employee } from "@shared/schema";
import { z } from "zod";

// UI Components
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Plus, 
  Loader2, 
  Search, 
  Calculator, 
  Banknote,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  AlertCircle,
  Download,
  FileSpreadsheet,
  Wallet,
  Receipt,
  ArrowRight,
  Building2,
  Eye,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";

// Form Schema
const payrollFormSchema = z.object({
  employeeId: z.string().min(1, "Ажилтан сонгоно уу"),
  periodStart: z.string().min(1, "Хугацааны эхлэлийг бөглөнө үү"),
  periodEnd: z.string().min(1, "Хугацааны төгсгөлийг бөглөнө үү"),
  paymentDate: z.string().min(1, "Төлбөрийн огноог бөглөнө үү"),
  baseSalary: z.string().optional(),
  netSalary: z.string().optional(),
  tax: z.string().optional(),
  socialInsurance: z.string().optional(),
  status: z.enum(["Pending", "Processing", "Paid"]),
});

type PayrollFormValues = z.infer<typeof payrollFormSchema>;

// Status configuration
const statusConfig: Record<string, { label: string; color: string; icon: any }> = {
  Paid: { 
    label: "Төлөгдсөн", 
    color: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  Pending: { 
    label: "Хүлээгдэж байна", 
    color: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Clock,
  },
  Processing: { 
    label: "Боловсруулж байна", 
    color: "bg-blue-100 text-blue-700 border-blue-200",
    icon: AlertCircle,
  },
};

export default function Payroll() {
  const { payroll = [], isLoading } = usePayroll();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [viewOpen, setViewOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Ажилчдын жагсаалт
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });

  // Statistics
  const stats = useMemo(() => {
    const totalGross = payroll.reduce((acc, r) => acc + Number(r.grossPay || 0), 0);
    const totalNet = payroll.reduce((acc, r) => acc + Number(r.netPay || 0), 0);
    const totalDeductions = payroll.reduce((acc, r) => acc + Number(r.totalDeductions || 0), 0);
    const paidCount = payroll.filter(r => r.status === "Paid").length;
    const pendingCount = payroll.filter(r => r.status === "Pending").length;

    return { totalGross, totalNet, totalDeductions, paidCount, pendingCount };
  }, [payroll]);

  const form = useForm<PayrollFormValues>({
    resolver: zodResolver(payrollFormSchema),
    defaultValues: {
      employeeId: "",
      periodStart: format(new Date(), "yyyy-MM-01"),
      periodEnd: format(new Date(), "yyyy-MM-dd"),
      paymentDate: format(new Date(), "yyyy-MM-dd"),
      baseSalary: "0",
      netSalary: "0",
      tax: "0",
      socialInsurance: "0",
      status: "Pending",
    },
  });

  // Auto-calculate taxes
  const baseSalary = form.watch("baseSalary");

  useEffect(() => {
    if (baseSalary && !isNaN(Number(baseSalary))) {
      const gross = Number(baseSalary);

      // Монголын татварын тооцоолол (2024/2025)
      // НДШ (Нийгмийн даатгалын шимтгэл) - Ажилтан 11.5%
      // ХХОАТ (Хувь хүний орлогын албан татвар) - НДШ хассаны дараа 10%
      const shiRate = 0.115;
      const pitRate = 0.10;

      const shiAmount = Math.round(gross * shiRate);
      const taxableIncome = gross - shiAmount;
      const pitAmount = Math.round(taxableIncome * pitRate);
      const net = gross - shiAmount - pitAmount;

      form.setValue("socialInsurance", shiAmount.toString());
      form.setValue("tax", pitAmount.toString());
      form.setValue("netSalary", net.toString());
    }
  }, [baseSalary, form]);

  // Set salary when employee selected
  const selectedEmployeeId = form.watch("employeeId");
  useEffect(() => {
    if (selectedEmployeeId) {
      const emp = employees.find(e => e.id === selectedEmployeeId);
      if (emp?.baseSalary) {
        form.setValue("baseSalary", emp.baseSalary);
      }
    }
  }, [selectedEmployeeId, employees, form]);

  const createPayrollMutation = useMutation({
    mutationFn: async (values: PayrollFormValues) => {
      const payload = {
        employeeId: values.employeeId,
        periodStart: new Date(values.periodStart).toISOString().split('T')[0],
        periodEnd: new Date(values.periodEnd).toISOString().split('T')[0],
        paymentDate: new Date(values.paymentDate).toISOString().split('T')[0],
        baseSalary: Number(values.baseSalary) || 0,
        netSalary: Number(values.netSalary) || 0,
        tax: Number(values.tax) || 0,
        socialInsurance: Number(values.socialInsurance) || 0,
        status: values.status,
      };

      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Failed to create payroll");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      toast({
        title: "Амжилттай",
        description: "Цалингийн бүртгэл амжилттай хийгдлээ.",
      });
      setOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Цалин бүртгэхэд алдаа гарлаа",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: PayrollFormValues) => {
    createPayrollMutation.mutate(data);
  };

  // Filter
  const filteredPayroll = payroll.filter((record) => {
    const employee = employees.find((e) => e.id === record.employeeId);
    const employeeName = employee
      ? `${employee.firstName} ${employee.lastName}`.toLowerCase()
      : "";

    const periodText = `${format(new Date(record.periodStart as any), "yyyy-MM-dd")} - ${format(new Date(record.periodEnd as any), "yyyy-MM-dd")}`;
    const statusText = (record.status || "").toLowerCase();
    const searchLower = search.toLowerCase();

    return (
      employeeName.includes(searchLower) ||
      periodText.toLowerCase().includes(searchLower) ||
      statusText.includes(searchLower)
    );
  });

  const handleView = (record: any) => {
    setSelectedRecord(record);
    setViewOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent">
            Цалингийн бүртгэл
          </h2>
          <p className="text-muted-foreground mt-1">
            Ажилчдын цалин, татвар, НДШ-ийн тооцоолол
          </p>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="hidden sm:flex">
            <Download className="w-4 h-4 mr-2" />
            Экспорт
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button className="shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
                <Plus className="w-4 h-4 mr-2" />
                Цалин боловсруулах
              </Button>
            </DialogTrigger>

            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-xl">
                  <Calculator className="w-5 h-5 text-primary" />
                  Цалин боловсруулах
                </DialogTitle>
              </DialogHeader>

              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
                  <FormField
                    control={form.control}
                    name="employeeId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ажилтан</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Ажилтнаа сонгоно уу" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {employees.map((emp) => (
                              <SelectItem key={emp.id} value={emp.id}>
                                <div className="flex items-center gap-2">
                                  <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                    {emp.firstName[0]}
                                  </div>
                                  {emp.lastName} {emp.firstName}
                                  <span className="text-muted-foreground ml-1">
                                    ({emp.employeeNo})
                                  </span>
                                </div>
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
                      control={form.control}
                      name="periodStart"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Хугацааны эхлэл</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-11" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="periodEnd"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Хугацааны төгсгөл</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-11" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Tax calculation panel */}
                  <div className="p-5 bg-gradient-to-br from-muted/50 to-muted/30 rounded-xl space-y-5 border">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-5 h-5 text-primary" />
                      <h4 className="font-semibold">Татварын тооцоолол</h4>
                      <Badge variant="secondary" className="text-xs">Автомат</Badge>
                    </div>

                    <FormField
                      control={form.control}
                      name="baseSalary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <Banknote className="w-4 h-4" />
                            Үндсэн цалин (Нийт орлого)
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                {...field} 
                                className="h-12 text-lg font-semibold pr-12" 
                                placeholder="0" 
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">₮</span>
                            </div>
                          </FormControl>
                          <FormDescription>
                            Ажилтны сарын үндсэн цалинг оруулна уу
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Separator />

                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="socialInsurance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-muted-foreground">
                              <Building2 className="w-4 h-4" />
                              НДШ (11.5%)
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type="number" 
                                  {...field} 
                                  readOnly 
                                  className="bg-red-50/50 text-red-600 border-red-200 pr-12 font-medium" 
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-red-400">₮</span>
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="tax"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2 text-muted-foreground">
                              <Receipt className="w-4 h-4" />
                              ХХОАТ (10%)
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type="number" 
                                  {...field} 
                                  readOnly 
                                  className="bg-red-50/50 text-red-600 border-red-200 pr-12 font-medium" 
                                />
                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-red-400">₮</span>
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>

                    <Separator />

                    <FormField
                      control={form.control}
                      name="netSalary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2 text-emerald-600 font-bold">
                            <Wallet className="w-4 h-4" />
                            Гар дээрх цалин
                          </FormLabel>
                          <FormControl>
                            <div className="relative">
                              <Input 
                                type="number" 
                                {...field} 
                                readOnly 
                                className="h-14 bg-emerald-50 border-emerald-300 text-emerald-700 font-bold text-xl pr-12" 
                              />
                              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-emerald-500 font-bold">₮</span>
                            </div>
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="paymentDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Төлбөрийн огноо</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} className="h-11" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="status"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Төлөв</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger className="h-11">
                                <SelectValue placeholder="Төлөв сонгоно уу" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(statusConfig).map(([key, config]) => (
                                <SelectItem key={key} value={key}>
                                  <div className="flex items-center gap-2">
                                    <config.icon className="w-4 h-4" />
                                    {config.label}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Button type="submit" className="w-full h-12 text-base" disabled={createPayrollMutation.isPending}>
                    {createPayrollMutation.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Боловсруулж байна...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="mr-2 h-5 w-5" />
                        Хадгалах
                      </>
                    )}
                  </Button>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500 rounded-lg shadow">
                <Banknote className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Нийт цалин</p>
                <p className="text-lg font-bold text-blue-600">
                  {(stats.totalGross / 1000000).toFixed(1)}M₮
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/50 dark:to-emerald-900/30">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500 rounded-lg shadow">
                <Wallet className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Гар дээр</p>
                <p className="text-lg font-bold text-emerald-600">
                  {(stats.totalNet / 1000000).toFixed(1)}M₮
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/50 dark:to-red-900/30">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-500 rounded-lg shadow">
                <TrendingDown className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Нийт суутгал</p>
                <p className="text-lg font-bold text-red-600">
                  {(stats.totalDeductions / 1000000).toFixed(1)}M₮
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/50 dark:to-green-900/30">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-green-500 rounded-lg shadow">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Төлөгдсөн</p>
                <p className="text-2xl font-bold text-green-600">{stats.paidCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/50 dark:to-amber-900/30">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 rounded-lg shadow">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Хүлээгдэж байгаа</p>
                <p className="text-2xl font-bold text-amber-600">{stats.pendingCount}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <Search className="w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Ажилтан, хугацаа, төлөвөөр хайх..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
        />
      </div>

      {/* View Modal */}
      <Dialog open={viewOpen} onOpenChange={setViewOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="w-5 h-5 text-primary" />
              Цалингийн дэлгэрэнгүй
            </DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4">
              {(() => {
                const emp = employees.find(e => e.id === selectedRecord.employeeId);
                const config = statusConfig[selectedRecord.status || "Pending"];
                return (
                  <>
                    <div className="flex items-center gap-4 p-4 bg-muted/50 rounded-xl">
                      <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-bold text-xl">
                        {emp?.firstName?.[0] || "?"}
                      </div>
                      <div>
                        <h3 className="text-xl font-bold">
                          {emp ? `${emp.lastName} ${emp.firstName}` : "Тодорхойгүй"}
                        </h3>
                        <p className="text-sm text-muted-foreground">{emp?.employeeNo}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">Хугацаа</p>
                        <p className="font-medium">
                          {format(new Date(selectedRecord.periodStart), "MM/dd")} - {format(new Date(selectedRecord.periodEnd), "MM/dd")}
                        </p>
                      </div>
                      <div className="p-3 bg-muted/30 rounded-lg">
                        <p className="text-xs text-muted-foreground">Төлөв</p>
                        <Badge className={`${config?.color} border mt-1`}>
                          {config?.label}
                        </Badge>
                      </div>
                    </div>

                    <Separator />

                    <div className="space-y-3">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Нийт цалин</span>
                        <span className="font-semibold">{Number(selectedRecord.grossPay || 0).toLocaleString()}₮</span>
                      </div>
                      <div className="flex justify-between items-center text-red-600">
                        <span>НДШ + ХХОАТ суутгал</span>
                        <span className="font-medium">-{Number(selectedRecord.totalDeductions || 0).toLocaleString()}₮</span>
                      </div>
                      <Separator />
                      <div className="flex justify-between items-center text-lg">
                        <span className="font-semibold text-emerald-600">Гар дээрх цалин</span>
                        <span className="font-bold text-emerald-600">{Number(selectedRecord.netPay || 0).toLocaleString()}₮</span>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Хугацаа</TableHead>
              <TableHead className="font-semibold">Ажилтан</TableHead>
              <TableHead className="text-right font-semibold">Нийт цалин</TableHead>
              <TableHead className="text-right font-semibold hidden md:table-cell">Суутгал</TableHead>
              <TableHead className="text-right font-semibold text-emerald-600">Гар дээр</TableHead>
              <TableHead className="font-semibold">Төлөв</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p className="text-muted-foreground">Цалингийн мэдээллийг ачааллаж байна...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPayroll.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <FileSpreadsheet className="w-12 h-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      {search ? "Хайлтад тохирох цалин олдсонгүй" : "Цалингийн бүртгэл байхгүй байна"}
                    </p>
                    {!search && (
                      <Button onClick={() => setOpen(true)} variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Эхний цалин боловсруулах
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredPayroll.map((record, index) => {
                const employee = employees.find((e) => e.id === record.employeeId);
                const deductions = Number(record.totalDeductions ?? 0);
                const config = statusConfig[record.status || "Pending"];
                const periodText = `${format(new Date(record.periodStart as any), "MM/dd")} - ${format(new Date(record.periodEnd as any), "MM/dd")}`;

                return (
                  <TableRow 
                    key={record.id} 
                    className="group hover:bg-muted/50 cursor-pointer"
                    onClick={() => handleView(record)}
                  >
                    <TableCell className="font-medium text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {periodText}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                          {employee?.firstName?.[0] || "?"}
                        </div>
                        <div>
                          <div className="font-medium">
                            {employee ? `${employee.lastName} ${employee.firstName}` : `EMP-${record.employeeId}`}
                          </div>
                          <div className="text-xs text-muted-foreground">{employee?.employeeNo}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {Number(record.grossPay ?? 0).toLocaleString()}₮
                    </TableCell>
                    <TableCell className="text-right text-red-500 font-medium hidden md:table-cell">
                      -{deductions.toLocaleString()}₮
                    </TableCell>
                    <TableCell className="text-right font-bold text-emerald-600">
                      {Number(record.netPay ?? 0).toLocaleString()}₮
                    </TableCell>
                    <TableCell>
                      <Badge className={`${config?.color} border`}>
                        {config?.label}
                      </Badge>
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleView(record)}
                      >
                        <Eye className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Info Footer */}
      <Card className="border bg-gradient-to-r from-blue-50/50 to-emerald-50/50 dark:from-blue-950/30 dark:to-emerald-950/30">
        <CardContent className="py-4">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">НДШ:</span>
                <span className="font-medium">11.5%</span>
              </div>
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-muted-foreground" />
                <span className="text-muted-foreground">ХХОАТ:</span>
                <span className="font-medium">10%</span>
              </div>
            </div>
            <p className="text-muted-foreground text-xs">
              Монгол Улсын татварын хууль тогтоомжийн дагуу тооцоологдсон (2024)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
