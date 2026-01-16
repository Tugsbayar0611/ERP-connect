import { useState, useEffect } from "react";
import { usePayroll } from "@/hooks/use-payroll";
import { format } from "date-fns";
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
  CreditCard, 
  TrendingUp,
  Users,
  Wallet,
  ArrowDownCircle,
  ArrowUpCircle,
  Info
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

// Format number as Mongolian Tugrik
const formatMNT = (value: number | string) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(num) + '₮';
};

// Form schema
const payrollFormSchema = z.object({
  employeeId: z.string().min(1, "Ажилтан сонгоно уу"),
  periodStart: z.string().min(1, "Хугацааны эхлэлийг бөглөнө үү"),
  periodEnd: z.string().min(1, "Хугацааны төгсгөлийг бөглөнө үү"),
  paymentDate: z.string().min(1, "Төлбөрийн огноог бөглөнө үү"),
  baseSalary: z.string().optional(),
  netSalary: z.string().optional(),
  tax: z.string().optional(), // ХХОАТ (PIT)
  socialInsurance: z.string().optional(), // НДШ (SHI)
  status: z.enum(["Pending", "Processing", "Paid"]),
});

type PayrollFormValues = z.infer<typeof payrollFormSchema>;

// Mongolian Tax Constants (2024/2025)
const TAX_RATES = {
  SHI_EMPLOYEE: 0.115, // НДШ - 11.5% (ажилтан)
  SHI_EMPLOYER: 0.125, // НДШ - 12.5% (ажил олгогч)
  PIT: 0.10, // ХХОАТ - 10%
  MINIMUM_WAGE: 550000, // Хөдөлмөрийн хөлсний доод хэмжээ
};

export default function Payroll() {
  const { payroll = [], isLoading } = usePayroll();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Employees list
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });

  // Statistics
  const totalPayroll = payroll.reduce((sum, p) => sum + Number(p.netPay || 0), 0);
  const totalDeductions = payroll.reduce((sum, p) => sum + Number(p.totalDeductions || 0), 0);
  const paidCount = payroll.filter((p) => p.status === "Paid").length;
  const pendingCount = payroll.filter((p) => p.status === "Pending").length;

  const form = useForm<PayrollFormValues>({
    resolver: zodResolver(payrollFormSchema),
    defaultValues: {
      employeeId: "",
      periodStart: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"),
      periodEnd: format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd"),
      paymentDate: format(new Date(), "yyyy-MM-dd"),
      baseSalary: "0",
      netSalary: "0",
      tax: "0",
      socialInsurance: "0",
      status: "Pending",
    },
  });

  // Watch for baseSalary and employeeId changes
  const baseSalary = form.watch("baseSalary");
  const employeeId = form.watch("employeeId");

  // Auto-fill base salary when employee is selected
  useEffect(() => {
    if (employeeId) {
      const employee = employees.find((e) => e.id === employeeId);
      if (employee?.baseSalary) {
        form.setValue("baseSalary", employee.baseSalary);
      }
    }
  }, [employeeId, employees, form]);

  // Calculate taxes when baseSalary changes
  useEffect(() => {
    if (baseSalary && !isNaN(Number(baseSalary))) {
      const gross = Number(baseSalary);

      // Mongolian Tax Calculation
      // 1. НДШ (Social Health Insurance) - 11.5% employee contribution
      const shiAmount = Math.round(gross * TAX_RATES.SHI_EMPLOYEE);

      // 2. ХХОАТ (Personal Income Tax) - 10% on (gross - SHI)
      const taxableIncome = gross - shiAmount;
      const pitAmount = Math.round(taxableIncome * TAX_RATES.PIT);

      // Net = Gross - SHI - PIT
      const net = gross - shiAmount - pitAmount;

      form.setValue("socialInsurance", shiAmount.toString());
      form.setValue("tax", pitAmount.toString());
      form.setValue("netSalary", net.toString());
    }
  }, [baseSalary, form]);

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
      form.reset({
        employeeId: "",
        periodStart: format(new Date(new Date().getFullYear(), new Date().getMonth(), 1), "yyyy-MM-dd"),
        periodEnd: format(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0), "yyyy-MM-dd"),
        paymentDate: format(new Date(), "yyyy-MM-dd"),
        baseSalary: "0",
        netSalary: "0",
        tax: "0",
        socialInsurance: "0",
        status: "Pending",
      });
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

  // Search filter
  const filteredPayroll = payroll.filter((record) => {
    const employee = employees.find((e) => e.id === record.employeeId);
    const employeeName = employee
      ? `${employee.firstName} ${employee.lastName}`.toLowerCase()
      : "";

    const periodText = `${format(
      new Date(record.periodStart as any),
      "yyyy-MM-dd",
    )} - ${format(new Date(record.periodEnd as any), "yyyy-MM-dd")}`;

    const statusText = (record.status || "").toLowerCase();
    const searchLower = search.toLowerCase();

    return (
      employeeName.includes(searchLower) ||
      periodText.toLowerCase().includes(searchLower) ||
      statusText.includes(searchLower)
    );
  });

  const getStatusBadge = (status?: string | null) => {
    switch (status) {
      case "Paid":
        return <Badge className="bg-green-100 text-green-800 border-green-200">Төлөгдсөн</Badge>;
      case "Pending":
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">Хүлээгдэж байгаа</Badge>;
      case "Processing":
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Боловсруулж байна</Badge>;
      default:
        return <Badge variant="outline">{status ?? "Тодорхойгүй"}</Badge>;
    }
  };

  return (
    <div className="space-y-6 animate-in-fade">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Цалингийн тооцоо
          </h2>
          <p className="text-muted-foreground">
            Ажилчдын цалин, НДШ, ХХОАТ татварын тооцоолол
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="btn-premium">
              <Plus className="w-5 h-5 mr-2" />
              Цалин тооцоолох
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto glass-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Calculator className="w-5 h-5 text-primary" />
                Шинэ цалин тооцоолох
              </DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
                {/* Employee Selection */}
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ажилтан сонгох</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Ажилтнаа сонгоно уу" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id.toString()}>
                              <div className="flex items-center gap-2">
                                <span>{emp.lastName} {emp.firstName}</span>
                                <span className="text-muted-foreground">({emp.employeeNo})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Period Selection */}
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

                {/* Tax Calculation Section */}
                <div className="p-5 bg-gradient-to-br from-muted/50 to-muted/30 rounded-xl space-y-5 border border-border/50">
                  <div className="flex items-center justify-between">
                    <h4 className="font-semibold flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-primary" />
                      Монголын татварын тооцоо
                    </h4>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <Info className="w-4 h-4 text-muted-foreground" />
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">
                            <strong>НДШ (Нийгмийн даатгалын шимтгэл):</strong> 11.5% (ажилтан)<br />
                            <strong>ХХОАТ (Хувь хүний орлогын албан татвар):</strong> 10%<br />
                            Суутгал = НДШ + ХХОАТ
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  {/* Base Salary */}
                  <FormField
                    control={form.control}
                    name="baseSalary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold">Үндсэн цалин (Нийт орлого)</FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type="number" 
                              {...field} 
                              className="h-12 text-lg font-medium pr-10" 
                              placeholder="0" 
                            />
                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">₮</span>
                          </div>
                        </FormControl>
                        <FormDescription>
                          Хөдөлмөрийн хөлсний доод хэмжээ: {formatMNT(TAX_RATES.MINIMUM_WAGE)}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Separator />

                  {/* Tax Breakdown */}
                  <div className="space-y-4">
                    <h5 className="text-sm font-medium text-muted-foreground">Суутгалын задаргаа</h5>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="socialInsurance"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-2">
                              <ArrowDownCircle className="w-4 h-4 text-red-500" />
                              <span>НДШ (11.5%)</span>
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type="number" 
                                  {...field} 
                                  readOnly 
                                  className="bg-red-50/50 dark:bg-red-950/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 font-medium pr-10" 
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-red-400">₮</span>
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
                            <FormLabel className="flex items-center gap-2">
                              <ArrowDownCircle className="w-4 h-4 text-orange-500" />
                              <span>ХХОАТ (10%)</span>
                            </FormLabel>
                            <FormControl>
                              <div className="relative">
                                <Input 
                                  type="number" 
                                  {...field} 
                                  readOnly 
                                  className="bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800 text-orange-700 dark:text-orange-400 font-medium pr-10" 
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400">₮</span>
                              </div>
                            </FormControl>
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Net Salary */}
                  <FormField
                    control={form.control}
                    name="netSalary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-base font-semibold flex items-center gap-2 text-green-600">
                          <ArrowUpCircle className="w-5 h-5" />
                          Гар дээрх цалин
                        </FormLabel>
                        <FormControl>
                          <div className="relative">
                            <Input 
                              type="number" 
                              {...field} 
                              readOnly 
                              className="h-14 bg-green-50 dark:bg-green-950/30 border-green-300 dark:border-green-700 text-green-700 dark:text-green-400 font-bold text-2xl pr-10" 
                            />
                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500 text-lg">₮</span>
                          </div>
                        </FormControl>
                        <FormDescription className="text-green-600/80">
                          Нийт орлого - НДШ - ХХОАТ = Гар дээрх цалин
                        </FormDescription>
                      </FormItem>
                    )}
                  />
                </div>

                {/* Payment Date & Status */}
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
                            <SelectItem value="Pending">Хүлээгдэж байгаа</SelectItem>
                            <SelectItem value="Processing">Боловсруулж байна</SelectItem>
                            <SelectItem value="Paid">Төлөгдсөн</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full btn-premium h-12" disabled={createPayrollMutation.isPending}>
                  {createPayrollMutation.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Боловсруулж байна...
                    </>
                  ) : (
                    <>
                      <CreditCard className="mr-2 h-5 w-5" />
                      Цалин хадгалах
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card glass-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Нийт цалингийн сан
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Wallet className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{formatMNT(totalPayroll)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Гар дээрх нийт дүн
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card glass-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Нийт суутгал
            </CardTitle>
            <div className="p-2 bg-red-500/10 rounded-lg">
              <ArrowDownCircle className="w-5 h-5 text-red-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatMNT(totalDeductions)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              НДШ + ХХОАТ
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card glass-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Төлөгдсөн
            </CardTitle>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{paidCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Амжилттай олгогдсон
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card glass-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Хүлээгдэж буй
            </CardTitle>
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <Users className="w-5 h-5 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{pendingCount}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Боловсруулах шаардлагатай
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="glass-card rounded-xl p-1">
        <div className="flex items-center gap-4 p-3">
          <Search className="w-5 h-5 text-muted-foreground ml-2" />
          <Input
            placeholder="Ажилтан, хугацаа, төлөвөөр хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent h-10 w-full"
          />
        </div>
      </div>

      {/* Payroll Table */}
      <div className="glass-card rounded-xl overflow-hidden shadow-lg border-opacity-50">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/40">
              <TableHead>Хугацаа</TableHead>
              <TableHead>Ажилтан</TableHead>
              <TableHead className="text-right">Нийт орлого</TableHead>
              <TableHead className="text-right">НДШ (11.5%)</TableHead>
              <TableHead className="text-right">ХХОАТ (10%)</TableHead>
              <TableHead className="text-right font-bold text-green-600">Гар дээрх</TableHead>
              <TableHead>Төлөв</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p>Цалингийн мэдээллийг ачааллаж байна...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPayroll.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <CreditCard className="w-12 h-12 text-muted-foreground/50" />
                    <p>{search ? "Хайлтад тохирох цалин олдсонгүй." : "Цалингийн бүртгэл байхгүй байна."}</p>
                    <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
                      <Plus className="w-4 h-4 mr-2" />
                      Цалин нэмэх
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredPayroll.map((record, index) => {
                const employee = employees.find((e) => e.id === record.employeeId);
                const totalDeduction = Number(record.totalDeductions ?? 0);
                const grossPay = Number(record.grossPay ?? 0);
                
                // Calculate individual deductions (estimated if not stored)
                const shiEstimate = Math.round(grossPay * TAX_RATES.SHI_EMPLOYEE);
                const pitEstimate = totalDeduction - shiEstimate;

                const periodText = `${format(new Date(record.periodStart as any), "yyyy.MM.dd")} - ${format(new Date(record.periodEnd as any), "yyyy.MM.dd")}`;

                return (
                  <TableRow 
                    key={record.id} 
                    className="table-row-hover animate-slide-up" 
                    style={{ animationDelay: `${index * 0.03}s` }}
                  >
                    <TableCell className="font-medium text-muted-foreground">{periodText}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-primary font-bold text-xs">
                          {employee?.firstName?.[0] || "?"}
                        </div>
                        <div>
                          <div>{employee ? `${employee.lastName} ${employee.firstName}` : `EMP-${record.employeeId}`}</div>
                          <div className="text-xs text-muted-foreground">{employee?.employeeNo}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {formatMNT(grossPay)}
                    </TableCell>
                    <TableCell className="text-right text-red-500">
                      -{formatMNT(shiEstimate)}
                    </TableCell>
                    <TableCell className="text-right text-orange-500">
                      -{formatMNT(pitEstimate > 0 ? pitEstimate : 0)}
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-600 text-lg">
                      {formatMNT(record.netPay ?? 0)}
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Info Footer */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium mb-1">Монголын татварын тооцооллын талаар:</p>
              <ul className="list-disc list-inside space-y-1 text-xs">
                <li><strong>НДШ (Нийгмийн даатгалын шимтгэл):</strong> Ажилтан 11.5%, Ажил олгогч 12.5%</li>
                <li><strong>ХХОАТ (Хувь хүний орлогын албан татвар):</strong> Татвар ногдуулах орлогоос 10%</li>
                <li><strong>Татвар ногдуулах орлого:</strong> Нийт орлого - НДШ</li>
                <li><strong>Хөдөлмөрийн хөлсний доод хэмжээ:</strong> {formatMNT(TAX_RATES.MINIMUM_WAGE)}</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
