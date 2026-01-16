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
import { Separator } from "@/components/ui/separator";
import { 
  Plus, 
  Loader2, 
  Search, 
  Calculator, 
  AlertTriangle, 
  TrendingUp,
  Users,
  Wallet,
  Clock,
  Info
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ==========================================
// Монголын татварын тогтмолууд (2024-2025)
// ==========================================
const MONGOLIA_TAX_CONSTANTS = {
  // Хамгийн бага цалин (2024 оны 1-р сарын 1-ээс)
  MINIMUM_WAGE: 550000,
  
  // Нийгмийн даатгалын шимтгэл (НДШ) - Ажилтны хувь
  SHI_EMPLOYEE_RATE: 0.115, // 11.5%
  
  // Хувь хүний орлогын албан татвар (ХХОАТ)
  PIT_RATE: 0.10, // 10%
  
  // Ажил олгогчийн НДШ
  SHI_EMPLOYER_RATE: 0.125, // 12.5%
  
  // Илүү цагийн тооцоолол
  OVERTIME_RATE: 1.5, // 50% нэмэгдэл
  WEEKEND_OVERTIME_RATE: 2.0, // 100% нэмэгдэл (Бямба, Ням)
  HOLIDAY_OVERTIME_RATE: 2.0, // 100% нэмэгдэл (Баяр ёслол)
  
  // Сарын ажлын цаг (стандарт)
  STANDARD_MONTHLY_HOURS: 176, // 8 цаг * 22 хоног
};

// Татварын тооцоолол функц
const calculateMongolianTax = (
  baseSalary: number,
  overtimeHours: number = 0,
  bonusAmount: number = 0,
  allowanceAmount: number = 0
) => {
  const { SHI_EMPLOYEE_RATE, PIT_RATE, STANDARD_MONTHLY_HOURS, OVERTIME_RATE, MINIMUM_WAGE } = MONGOLIA_TAX_CONSTANTS;
  
  // Илүү цагийн тооцоолол
  const hourlyRate = baseSalary / STANDARD_MONTHLY_HOURS;
  const overtimePay = Math.round(overtimeHours * hourlyRate * OVERTIME_RATE);
  
  // Нийт орлого
  const grossSalary = baseSalary + overtimePay + bonusAmount + allowanceAmount;
  
  // НДШ тооцоолол (11.5%)
  const shiAmount = Math.round(grossSalary * SHI_EMPLOYEE_RATE);
  
  // ХХОАТ суурь (НДШ-ийг хасаад)
  const taxableIncome = grossSalary - shiAmount;
  
  // ХХОАТ (10%)
  const pitAmount = Math.round(taxableIncome * PIT_RATE);
  
  // Нийт суутгал
  const totalDeductions = shiAmount + pitAmount;
  
  // Гар дээрх цалин
  const netSalary = grossSalary - totalDeductions;
  
  // Ажил олгогчийн НДШ (12.5%)
  const employerSHI = Math.round(grossSalary * MONGOLIA_TAX_CONSTANTS.SHI_EMPLOYER_RATE);
  
  // Хамгийн бага цалингаас доогуур эсэхийг шалгах
  const isBelowMinimum = baseSalary < MINIMUM_WAGE;
  
  return {
    baseSalary,
    overtimePay,
    bonusAmount,
    allowanceAmount,
    grossSalary,
    shiAmount,
    pitAmount,
    totalDeductions,
    netSalary,
    employerSHI,
    isBelowMinimum,
    hourlyRate: Math.round(hourlyRate),
  };
};

// Form-д зориулагдсан Zod schema
const payrollFormSchema = z.object({
  employeeId: z.string().min(1, "Ажилтан сонгоно уу"),
  periodStart: z.string().min(1, "Хугацааны эхлэлийг бөглөнө үү"),
  periodEnd: z.string().min(1, "Хугацааны төгсгөлийг бөглөнө үү"),
  paymentDate: z.string().min(1, "Төлбөрийн огноог бөглөнө үү"),
  baseSalary: z.string().optional(),
  overtimeHours: z.string().optional(),
  bonusAmount: z.string().optional(),
  allowanceAmount: z.string().optional(),
  netSalary: z.string().optional(),
  tax: z.string().optional(),
  socialInsurance: z.string().optional(),
  status: z.enum(["Pending", "Processing", "Paid"]),
});

type PayrollFormValues = z.infer<typeof payrollFormSchema>;

export default function Payroll() {
  const { payroll = [], isLoading } = usePayroll();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
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

  const form = useForm<PayrollFormValues>({
    resolver: zodResolver(payrollFormSchema),
    defaultValues: {
      employeeId: "",
      periodStart: format(new Date(), "yyyy-MM-dd"),
      periodEnd: format(new Date(), "yyyy-MM-dd"),
      paymentDate: format(new Date(), "yyyy-MM-dd"),
      baseSalary: "0",
      overtimeHours: "0",
      bonusAmount: "0",
      allowanceAmount: "0",
      netSalary: "0",
      tax: "0",
      socialInsurance: "0",
      status: "Pending",
    },
  });

  // Сонгосон ажилтны үндсэн цалинг автоматаар авах
  const selectedEmployeeId = form.watch("employeeId");
  useEffect(() => {
    if (selectedEmployeeId) {
      const emp = employees.find(e => e.id === selectedEmployeeId);
      if (emp?.baseSalary) {
        form.setValue("baseSalary", String(emp.baseSalary));
      }
    }
  }, [selectedEmployeeId, employees, form]);

  // Татварын автомат тооцоолол
  const baseSalary = form.watch("baseSalary");
  const overtimeHours = form.watch("overtimeHours");
  const bonusAmount = form.watch("bonusAmount");
  const allowanceAmount = form.watch("allowanceAmount");

  const [taxBreakdown, setTaxBreakdown] = useState<ReturnType<typeof calculateMongolianTax> | null>(null);

  useEffect(() => {
    const salary = Number(baseSalary) || 0;
    const overtime = Number(overtimeHours) || 0;
    const bonus = Number(bonusAmount) || 0;
    const allowance = Number(allowanceAmount) || 0;

    if (salary > 0) {
      const breakdown = calculateMongolianTax(salary, overtime, bonus, allowance);
      setTaxBreakdown(breakdown);
      
      form.setValue("socialInsurance", breakdown.shiAmount.toString());
      form.setValue("tax", breakdown.pitAmount.toString());
      form.setValue("netSalary", breakdown.netSalary.toString());
    }
  }, [baseSalary, overtimeHours, bonusAmount, allowanceAmount, form]);

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
        periodStart: format(new Date(), "yyyy-MM-dd"),
        periodEnd: format(new Date(), "yyyy-MM-dd"),
        paymentDate: format(new Date(), "yyyy-MM-dd"),
        baseSalary: "0",
        overtimeHours: "0",
        bonusAmount: "0",
        allowanceAmount: "0",
        netSalary: "0",
        tax: "0",
        socialInsurance: "0",
        status: "Pending",
      });
      setTaxBreakdown(null);
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
    // Хамгийн бага цалингийн шалгалт
    if (Number(data.baseSalary) < MONGOLIA_TAX_CONSTANTS.MINIMUM_WAGE) {
      toast({
        title: "Анхааруулга",
        description: `Үндсэн цалин хамгийн бага цалингаас (${MONGOLIA_TAX_CONSTANTS.MINIMUM_WAGE.toLocaleString()}₮) доогуур байна!`,
        variant: "destructive",
      });
      return;
    }
    createPayrollMutation.mutate(data);
  };

  // Хайлт
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

  // Статистик тоо
  const totalNetPay = payroll.reduce((sum, p) => sum + Number(p.netPay || 0), 0);
  const totalGrossPay = payroll.reduce((sum, p) => sum + Number(p.grossPay || 0), 0);
  const paidCount = payroll.filter(p => p.status === "Paid").length;

  return (
    <div className="space-y-8 animate-in-fade">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Цалингийн бүртгэл
          </h2>
          <p className="text-muted-foreground">
            Монголын татварын хуульд нийцсэн цалингийн тооцоолол.
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="btn-premium">
              <Plus className="w-5 h-5 mr-2" />
              Цалин боловсруулах
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto glass-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Calculator className="w-5 h-5 text-primary" />
                Цалин боловсруулах
              </DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
                {/* Ажилтан сонголт */}
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
                            <SelectItem key={emp.id} value={emp.id.toString()}>
                              <div className="flex items-center gap-2">
                                <span>{emp.lastName} {emp.firstName}</span>
                                <span className="text-muted-foreground text-xs">({emp.employeeNo})</span>
                                {emp.baseSalary && (
                                  <span className="text-primary text-xs ml-2">
                                    {Number(emp.baseSalary).toLocaleString()}₮
                                  </span>
                                )}
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Хугацаа */}
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

                {/* Цалин, илүү цаг, урамшуулал */}
                <div className="p-4 bg-muted/50 rounded-xl space-y-4 border border-border/50">
                  <h4 className="font-medium flex items-center gap-2">
                    <Wallet className="w-4 h-4" />
                    Орлогын мэдээлэл
                  </h4>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="baseSalary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Үндсэн цалин (₮)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} className="h-11" placeholder="0" />
                          </FormControl>
                          <FormDescription className="text-xs flex items-center gap-1">
                            <Info className="w-3 h-3" />
                            Хамгийн бага: {MONGOLIA_TAX_CONSTANTS.MINIMUM_WAGE.toLocaleString()}₮
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="overtimeHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Илүү цаг
                          </FormLabel>
                          <FormControl>
                            <Input type="number" {...field} className="h-11" placeholder="0" min="0" />
                          </FormControl>
                          <FormDescription className="text-xs">
                            50% нэмэгдэлтэй ({taxBreakdown?.hourlyRate?.toLocaleString() || 0}₮/цаг)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="bonusAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Урамшуулал (₮)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} className="h-11" placeholder="0" min="0" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="allowanceAmount"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Нэмэгдэл (₮)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} className="h-11" placeholder="0" min="0" />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Унаа, хоол, гар утас гм
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                {/* Татварын тооцоолол */}
                {taxBreakdown && (
                  <div className="p-4 bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl space-y-4 border border-primary/20">
                    <h4 className="font-medium flex items-center gap-2 text-primary">
                      <Calculator className="w-4 h-4" />
                      Татварын тооцоолол
                    </h4>

                    {/* Хамгийн бага цалин анхааруулга */}
                    {taxBreakdown.isBelowMinimum && (
                      <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5" />
                        <div className="text-sm text-red-700">
                          <p className="font-medium">Хамгийн бага цалингаас доогуур!</p>
                          <p className="text-xs">
                            2024 оны хамгийн бага цалин: {MONGOLIA_TAX_CONSTANTS.MINIMUM_WAGE.toLocaleString()}₮
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Үндсэн цалин:</span>
                          <span>{taxBreakdown.baseSalary.toLocaleString()}₮</span>
                        </div>
                        {taxBreakdown.overtimePay > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Илүү цагийн:</span>
                            <span className="text-blue-600">+{taxBreakdown.overtimePay.toLocaleString()}₮</span>
                          </div>
                        )}
                        {taxBreakdown.bonusAmount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Урамшуулал:</span>
                            <span className="text-blue-600">+{taxBreakdown.bonusAmount.toLocaleString()}₮</span>
                          </div>
                        )}
                        {taxBreakdown.allowanceAmount > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Нэмэгдэл:</span>
                            <span className="text-blue-600">+{taxBreakdown.allowanceAmount.toLocaleString()}₮</span>
                          </div>
                        )}
                        <Separator />
                        <div className="flex justify-between font-medium">
                          <span>Нийт орлого:</span>
                          <span>{taxBreakdown.grossSalary.toLocaleString()}₮</span>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex justify-between">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="text-muted-foreground flex items-center gap-1">
                                НДШ (11.5%): <Info className="w-3 h-3" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Нийгмийн даатгалын шимтгэл</p>
                                <p className="text-xs text-muted-foreground">Тэтгэвэр 7%, ЭМД 2%, ҮОМШӨ 1%, Ажилгүйдэл 0.5%, Орон сууц 0.5%</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <span className="text-red-600">-{taxBreakdown.shiAmount.toLocaleString()}₮</span>
                        </div>
                        <div className="flex justify-between">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger className="text-muted-foreground flex items-center gap-1">
                                ХХОАТ (10%): <Info className="w-3 h-3" />
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Хувь хүний орлогын албан татвар</p>
                                <p className="text-xs text-muted-foreground">НДШ-ийг хассан дүнгээс 10%</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                          <span className="text-red-600">-{taxBreakdown.pitAmount.toLocaleString()}₮</span>
                        </div>
                        <Separator />
                        <div className="flex justify-between font-medium">
                          <span>Нийт суутгал:</span>
                          <span className="text-red-600">-{taxBreakdown.totalDeductions.toLocaleString()}₮</span>
                        </div>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex justify-between items-center">
                      <span className="text-lg font-bold text-green-600">Гар дээрх цалин:</span>
                      <span className="text-2xl font-bold text-green-600">
                        {taxBreakdown.netSalary.toLocaleString()}₮
                      </span>
                    </div>

                    <div className="pt-2 border-t border-dashed text-xs text-muted-foreground">
                      <div className="flex justify-between">
                        <span>Ажил олгогчийн НДШ (12.5%):</span>
                        <span>{taxBreakdown.employerSHI.toLocaleString()}₮</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Төлбөр, төлөв */}
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
                    "Хадгалах"
                  )}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Нийт бүртгэл</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{payroll.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Нийт цалингийн сан</CardTitle>
            <Wallet className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalGrossPay.toLocaleString()}₮</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Төлсөн</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalNetPay.toLocaleString()}₮</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Төлөгдсөн</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{paidCount} / {payroll.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Info Banner */}
      <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start gap-3">
        <Info className="w-5 h-5 text-blue-600 mt-0.5" />
        <div className="text-sm text-blue-700">
          <p className="font-medium">Монголын татварын мэдээлэл (2024)</p>
          <p className="text-xs mt-1">
            НДШ: 11.5% (ажилтан) + 12.5% (ажил олгогч) | ХХОАТ: 10% | Хамгийн бага цалин: 550,000₮
          </p>
        </div>
      </div>

      {/* Search */}
      <div className="glass-card rounded-xl p-1 mb-6">
        <div className="flex items-center gap-4 p-2">
          <Search className="w-5 h-5 text-muted-foreground ml-2" />
          <Input
            placeholder="Ажилтан, хугацаа, төлөвөөр хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent h-10 w-full"
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-xl overflow-hidden shadow-lg border-opacity-50">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/40">
              <TableHead>Хугацаа</TableHead>
              <TableHead>Ажилтан</TableHead>
              <TableHead className="text-right">Нийт орлого</TableHead>
              <TableHead className="text-right">Суутгал (НДШ+ХХОАТ)</TableHead>
              <TableHead className="text-right font-bold text-primary">Гар дээрх</TableHead>
              <TableHead>Төлөв</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p>Цалингийн мэдээллийг ачааллаж байна...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPayroll.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-12 text-muted-foreground">
                  {search ? "Хайлтад тохирох цалин олдсонгүй." : "Цалингийн бүртгэл байхгүй байна."}
                </TableCell>
              </TableRow>
            ) : (
              filteredPayroll.map((record, index) => {
                const employee = employees.find((e) => e.id === record.employeeId);
                const deductions = Number(record.totalDeductions ?? 0);

                const periodText = `${format(new Date(record.periodStart as any), "yyyy.MM.dd")} - ${format(new Date(record.periodEnd as any), "yyyy.MM.dd")}`;

                return (
                  <TableRow key={record.id} className="table-row-hover animate-slide-up" style={{ animationDelay: `${index * 0.05}s` }}>
                    <TableCell className="font-medium text-muted-foreground">{periodText}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 flex items-center justify-center text-primary font-bold text-xs">
                          {employee?.firstName?.[0] || "?"}
                        </div>
                        <div>
                          <div>{employee ? `${employee.lastName || ""} ${employee.firstName}` : `EMP-${record.employeeId}`}</div>
                          <div className="text-xs text-muted-foreground">{employee?.employeeNo}</div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {Number(record.grossPay ?? 0).toLocaleString()} ₮
                    </TableCell>
                    <TableCell className="text-right text-red-500 font-medium">
                      -{deductions.toLocaleString()} ₮
                    </TableCell>
                    <TableCell className="text-right font-bold text-green-600 text-lg">
                      {Number(record.netPay ?? 0).toLocaleString()} ₮
                    </TableCell>
                    <TableCell>{getStatusBadge(record.status)}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
