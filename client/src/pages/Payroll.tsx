import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePayroll, useMyPayslips } from "@/hooks/use-payroll";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { Employee } from "@shared/schema";
import { z } from "zod";
import { api } from "@shared/routes";
import { calculateMongolianSocialInsurance, calculateMongolianIncomeTax, calculatePITDeduction } from "@shared/mongolian-validators";
import { calculateMongolianPayroll, type Allowance, type SalaryAdvance } from "@shared/payroll-calculator";

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
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Loader2, Search, Calculator, Pencil, Trash2, MoreHorizontal, X, Check, FileText } from "lucide-react";

// Form-д зориулагдсан Zod schema
const payrollFormSchema = z.object({
  employeeId: z.string().min(1, "Ажилтан сонгоно уу"),
  periodStart: z.string().min(1, "Хугацааны эхлэлийг бөглөнө үү"),
  periodEnd: z.string().min(1, "Хугацааны төгсгөлийг бөглөнө үү"),
  paymentDate: z.string().min(1, "Төлбөрийн огноог бөглөнө үү"),
  baseSalary: z.string().optional(),
  netSalary: z.string().optional(),
  tax: z.string().optional(), // PIT
  socialInsurance: z.string().optional(), // SHI
  overtimeHours: z.string().optional(),
  bonus: z.string().optional(),
  status: z.enum(["Pending", "Processing", "Paid"]),
});

type PayrollFormValues = z.infer<typeof payrollFormSchema>;

export default function Payroll() {
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || '';
  const isAdminOrHR = userRole === 'admin' || userRole === 'hr';

  if (!isAdminOrHR) {
    return <MyPayslipsView />;
  }

  const { payroll = [], isLoading } = usePayroll();
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [calculationResult, setCalculationResult] = useState<any>(null);
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
      netSalary: "0",
      tax: "0",
      socialInsurance: "0",
      overtimeHours: "0",
      bonus: "0",
      status: "Pending",
    },
  });

  // Helper function to calculate working days in a period (excluding weekends)
  const calculateWorkingDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    let workingDays = 0;
    const current = new Date(start);

    while (current <= end) {
      const dayOfWeek = current.getDay();
      // 0 = Sunday, 6 = Saturday - exclude weekends
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        workingDays++;
      }
      current.setDate(current.getDate() + 1);
    }

    return workingDays;
  };

  // Helper to set bi-weekly periods (1-14, 15-28/end)
  const setBiWeeklyPeriod = (date: Date, period: 1 | 2) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    if (period === 1) {
      return {
        start: format(new Date(year, month, 1), "yyyy-MM-dd"),
        end: format(new Date(year, month, 14), "yyyy-MM-dd"),
      };
    } else {
      return {
        start: format(new Date(year, month, 15), "yyyy-MM-dd"),
        end: format(new Date(year, month, daysInMonth), "yyyy-MM-dd"),
      };
    }
  };

  // Watch for form changes
  const baseSalary = form.watch("baseSalary");
  const employeeId = form.watch("employeeId");
  const periodStart = form.watch("periodStart");
  const periodEnd = form.watch("periodEnd");
  const overtimeHours = form.watch("overtimeHours");
  const bonus = form.watch("bonus");

  // Fetch employee allowances and advances
  const { data: allowances = [] } = useQuery({
    queryKey: ["/api/employee-allowances", employeeId, periodStart, periodEnd],
    queryFn: async () => {
      if (!employeeId || !periodStart || !periodEnd) return [];
      const res = await fetch(`/api/employee-allowances?employeeId=${employeeId}`, { credentials: "include" });
      if (!res.ok) return [];
      const data = await res.json();
      // Filter only recurring allowances that are active for the period
      const periodStartDate = new Date(periodStart);
      const periodEndDate = new Date(periodEnd);
      return data.filter((a: any) => {
        if (!a.isRecurring) return false;
        const effectiveFrom = new Date(a.effectiveFrom);
        const effectiveTo = a.effectiveTo ? new Date(a.effectiveTo) : null;
        return effectiveFrom <= periodEndDate && (!effectiveTo || effectiveTo >= periodStartDate);
      });
    },
    enabled: !!employeeId && !!periodStart && !!periodEnd,
  });

  const { data: advances = [] } = useQuery({
    queryKey: ["/api/salary-advances", employeeId],
    queryFn: async () => {
      if (!employeeId) return [];
      const res = await fetch(`/api/salary-advances?employeeId=${employeeId}&status=approved`, { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!employeeId,
  });

  // Fetch attendance data when employee and period are selected
  const { data: attendanceData = [] } = useQuery({
    queryKey: ["/api/attendance", employeeId, periodStart, periodEnd],
    queryFn: async () => {
      if (!employeeId || !periodStart || !periodEnd) return [];
      const res = await fetch(
        `/api/attendance?employeeId=${employeeId}&startDate=${periodStart}&endDate=${periodEnd}`,
        { credentials: "include" }
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!employeeId && !!periodStart && !!periodEnd,
  });

  // Calculate days worked and hours worked from attendance
  const daysWorked = attendanceData.filter((a: any) =>
    a.status === "present" || a.status === "late"
  ).length;
  const totalHoursWorked = attendanceData.reduce((sum: number, a: any) => {
    const hours = a.minutesWorked ? Number(a.minutesWorked) / 60 : 0;
    return sum + hours;
  }, 0);

  // Calculate daily rate and adjust salary based on days worked
  useEffect(() => {
    if (employeeId && periodStart && periodEnd && baseSalary && !isNaN(Number(baseSalary))) {
      const baseAmount = Number(baseSalary);

      // Calculate total working days in the period (excluding weekends)
      const totalWorkingDaysInPeriod = calculateWorkingDays(periodStart, periodEnd);

      // If attendance data exists, calculate based on actual days worked
      let calculatedSalary = baseAmount;
      if (attendanceData.length > 0 && daysWorked > 0 && totalWorkingDaysInPeriod > 0) {
        // Calculate daily rate based on working days in the period
        const dailyRate = baseAmount / totalWorkingDaysInPeriod;
        calculatedSalary = dailyRate * daysWorked;
      } else if (totalWorkingDaysInPeriod > 0) {
        // If no attendance data, use full period salary (all working days)
        calculatedSalary = baseAmount;
      }

      // Convert allowances and advances to calculator format
      const allowanceData: Allowance[] = allowances.map((a: any) => ({
        id: a.id,
        code: a.code,
        name: a.name,
        amount: Number(a.amount || 0),
        isTaxable: a.isTaxable ?? true,
        isSHI: a.isSHI ?? true,
        isPIT: a.isPIT ?? true,
      }));

      const advanceData: SalaryAdvance[] = advances
        .filter((a: any) => {
          // Only include advances that haven't been fully deducted
          const remaining = Number(a.amount || 0) - Number(a.deductedAmount || 0);
          return remaining > 0;
        })
        .map((a: any) => ({
          id: a.id,
          amount: Number(a.amount || 0),
          deductedAmount: Number(a.deductedAmount || 0),
          deductionType: a.deductionType || "monthly",
          monthlyDeductionAmount: a.monthlyDeductionAmount ? Number(a.monthlyDeductionAmount) : undefined,
        }));

      // Use new payroll calculator
      const calculation = calculateMongolianPayroll({
        baseSalary: calculatedSalary,
        allowances: allowanceData,
        advances: advanceData,
        overtimeHours: Number(overtimeHours || 0),
        bonus: Number(bonus || 0),
        minimumWage: 550000, // 2025 оны доод хэмжээ
        employeeSHIRate: 11.5, // 2025 он: 11.5%
        employerSHIRate: 12.5, // 2025 он: 12.5%
      });

      form.setValue("baseSalary", calculatedSalary.toString());
      form.setValue("socialInsurance", calculation.shi.employee.toString());
      form.setValue("tax", calculation.pit.tax.toString());
      form.setValue("netSalary", calculation.netPay.toString());

      // Store calculation result for display
      setCalculationResult(calculation);
    }
  }, [baseSalary, employeeId, periodStart, periodEnd, attendanceData, daysWorked, allowances, advances, overtimeHours, bonus, form]);

  const createPayrollMutation = useMutation({
    mutationFn: async (values: PayrollFormValues) => {
      const payload = {
        employeeId: values.employeeId,
        periodStart: new Date(values.periodStart).toISOString().split('T')[0], // Ensure YYYY-MM-DD
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
      // Invalidate all payroll-related queries
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      queryClient.invalidateQueries({ queryKey: [api.payroll.list.path] });
      const isEdit = !!editingRecord;
      toast({
        title: "Амжилттай",
        description: isEdit ? "Цалин амжилттай шинэчлэгдлээ." : "Цалингийн бүртгэл амжилттай хийгдлээ.",
      });
      handleClose();
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Цалин бүртгэхэд алдаа гарлаа",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deletePayrollMutation = useMutation({
    mutationFn: async (payslipId: string) => {
      const res = await fetch(`/api/payslips/${payslipId}`, {
        method: "DELETE",
        credentials: "include",
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Цалин устгахад алдаа гарлаа");
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      queryClient.invalidateQueries({ queryKey: [api.payroll.list.path] });
      toast({
        title: "Амжилттай",
        description: "Цалин амжилттай устгагдлаа.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Цалин устгахад алдаа гарлаа",
        variant: "destructive",
      });
    },
  });

  const handleEdit = (record: any) => {
    const employee = employees.find((e) => e.id === record.employeeId);
    setEditingRecord(record);
    form.reset({
      employeeId: record.employeeId,
      periodStart: format(new Date(record.periodStart as any), "yyyy-MM-dd"),
      periodEnd: format(new Date(record.periodEnd as any), "yyyy-MM-dd"),
      paymentDate: record.payDate ? format(new Date(record.payDate as any), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"),
      baseSalary: String(record.grossPay || 0),
      netSalary: String(record.netPay || 0),
      tax: String(Number(record.totalDeductions || 0) * 0.4), // Approximate tax portion
      socialInsurance: String(Number(record.totalDeductions || 0) * 0.6), // Approximate SHI portion
      overtimeHours: "0",
      bonus: "0",
      status: record.status || "Pending",
    });
    setCalculationResult(null);
    setOpen(true);
  };

  const handleDelete = (record: any) => {
    if (window.confirm("Та энэ цалингийн бүртгэлийг устгахдаа итгэлтэй байна уу?")) {
      deletePayrollMutation.mutate(record.id);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setEditingRecord(null);
    form.reset({
      employeeId: "",
      periodStart: format(new Date(), "yyyy-MM-dd"),
      periodEnd: format(new Date(), "yyyy-MM-dd"),
      paymentDate: format(new Date(), "yyyy-MM-dd"),
      baseSalary: "0",
      netSalary: "0",
      tax: "0",
      socialInsurance: "0",
      overtimeHours: "0",
      bonus: "0",
      status: "Pending",
    });
    setCalculationResult(null);
  };

  const onSubmit = (data: PayrollFormValues) => {
    if (editingRecord) {
      // Update existing payslip
      createPayrollMutation.mutate(data); // The API already handles updates
    } else {
      createPayrollMutation.mutate(data);
    }
  };

  // Хайлт: Ажилтны нэр, хугацаа, статус
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
        return (
          <Badge className="bg-blue-100 text-blue-700 border-blue-200 hover:bg-blue-200 transition-colors px-3 py-1">
            Төлөгдсөн
          </Badge>
        );
      case "Pending":
        return (
          <Badge className="bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 transition-colors px-3 py-1">
            Хүлээгдэж байгаа
          </Badge>
        );
      case "Processing":
        return (
          <Badge className="bg-amber-100 text-amber-700 border-amber-200 hover:bg-amber-200 transition-colors px-3 py-1">
            Боловсруулж байна
          </Badge>
        );
      default:
        return <Badge variant="outline">{status ?? "Тодорхойгүй"}</Badge>;
    }
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredPayroll.map(p => p.id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleSelectRow = (id: string, checked: boolean) => {
    if (checked) {
      setSelectedIds(prev => [...prev, id]);
    } else {
      setSelectedIds(prev => prev.filter(selectedId => selectedId !== id));
    }
  };

  const handleBulkAction = async (action: 'approve' | 'draft' | 'delete') => {
    if (!selectedIds.length) return;

    const actionText =
      action === 'approve' ? "батлах" :
        action === 'draft' ? "ноорог болгох" :
          "устгах";

    if (!window.confirm(`${selectedIds.length} цалинг ${actionText}даа итгэлтэй байна уу?`)) return;

    try {
      // Execute sequentially to avoid overwhelming server
      for (const id of selectedIds) {
        if (action === 'delete') {
          await deletePayrollMutation.mutateAsync(id);
        } else {
          const record = payroll.find(p => p.id === id);
          if (record) {
            const status = action === 'approve' ? 'Paid' : 'Pending';
            // Use createPayrollMutation for status update
            await createPayrollMutation.mutateAsync({
              ...record,
              employeeId: record.employeeId,
              periodStart: format(new Date(record.periodStart), "yyyy-MM-dd"),
              periodEnd: format(new Date(record.periodEnd), "yyyy-MM-dd"),
              paymentDate: format(new Date(record.periodEnd), "yyyy-MM-dd"),
              baseSalary: String(record.grossPay),
              netSalary: String(record.netPay),
              tax: String(Number(record.totalDeductions || 0) * 0.4),
              socialInsurance: String(Number(record.totalDeductions || 0) * 0.6),
              status: status as any
            });
          }
        }
      }
      setSelectedIds([]);
      toast({
        title: "Амжилттай",
        description: `Олноор ${actionText} үйлдэл амжилттай боллоо.`,
      });
    } catch (error: any) {
      toast({
        title: "Алдаа",
        description: error.message || "Олноор үйлдэл хийхэд алдаа гарлаа",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="space-y-8 animate-in-fade">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Цалингийн бүртгэл
          </h2>
          <p className="text-muted-foreground">
            Ажилчдын цалингийн түүх болон татварын тооцоолол.
          </p>
        </div>

        <Dialog open={open} onOpenChange={(isOpen) => {
          if (isOpen) setOpen(true);
          else handleClose();
        }}>
          <DialogTrigger asChild>
            <Button className="btn-premium">
              <Plus className="w-5 h-5 mr-2" />
              Цалин боловсруулах
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto glass-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Calculator className="w-5 h-5 text-primary" />
                Шинэ цалин боловсруулах
              </DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 mt-4">
                {/* Quick period selection buttons */}
                <div className="flex gap-2 pb-2 border-b">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const period = setBiWeeklyPeriod(new Date(), 1);
                      form.setValue("periodStart", period.start);
                      form.setValue("periodEnd", period.end);
                    }}
                  >
                    1-14 өдөр
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const period = setBiWeeklyPeriod(new Date(), 2);
                      form.setValue("periodStart", period.start);
                      form.setValue("periodEnd", period.end);
                    }}
                  >
                    15-{new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()} өдөр
                  </Button>
                </div>
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
                              {emp.firstName} {emp.lastName} ({emp.employeeNo})
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

                {/* Attendance Summary */}
                {employeeId && periodStart && periodEnd && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-950/20 rounded-xl border border-blue-200 dark:border-blue-800">
                    <h4 className="font-medium mb-3 text-sm">Ирцийн мэдээлэл</h4>
                    {(() => {
                      const totalWorkingDays = calculateWorkingDays(periodStart, periodEnd);
                      const dailyRate = baseSalary && !isNaN(Number(baseSalary)) && totalWorkingDays > 0
                        ? Number(baseSalary) / totalWorkingDays
                        : 0;

                      return (
                        <div className="space-y-3">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <p className="text-muted-foreground">Ажлын өдөр (хугацаа)</p>
                              <p className="font-semibold text-lg">{totalWorkingDays} өдөр</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Ажилласан өдөр</p>
                              <p className="font-semibold text-lg">{daysWorked} өдөр</p>
                            </div>
                            <div>
                              <p className="text-muted-foreground">Ажилласан цаг</p>
                              <p className="font-semibold text-lg">{totalHoursWorked.toFixed(1)} цаг</p>
                            </div>
                          </div>
                          {dailyRate > 0 && (
                            <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-muted-foreground">Өдрийн цалин:</span>
                                <span className="font-semibold">{dailyRate.toLocaleString('mn-MN', { maximumFractionDigits: 0 })}₮</span>
                              </div>
                              {daysWorked > 0 && (
                                <div className="flex justify-between items-center text-sm mt-1">
                                  <span className="text-muted-foreground">Тооцоолсон цалин:</span>
                                  <span className="font-semibold text-primary">
                                    {(dailyRate * daysWorked).toLocaleString('mn-MN', { maximumFractionDigits: 0 })}₮
                                  </span>
                                </div>
                              )}
                            </div>
                          )}
                          {attendanceData.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-800">
                              <p className="text-xs text-muted-foreground mb-2">Ажилласан өдрүүд:</p>
                              <div className="flex flex-wrap gap-1">
                                {attendanceData
                                  .filter((a: any) => a.status === "present" || a.status === "late")
                                  .map((a: any) => (
                                    <span
                                      key={a.id}
                                      className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs"
                                    >
                                      {format(new Date(a.workDate), "MM/dd")}
                                    </span>
                                  ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                )}

                <div className="p-4 bg-muted/50 rounded-xl space-y-4 border border-border/50">
                  <h4 className="font-medium flex items-center gap-2">
                    <Calculator className="w-4 h-4" />
                    Татварын тооцоолол
                  </h4>

                  <FormField
                    control={form.control}
                    name="baseSalary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Үндсэн цалин (₮)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} className="h-11" placeholder="0" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  {/* Allowances Display */}
                  {allowances.length > 0 && (
                    <div className="p-3 bg-blue-50/50 rounded-lg border border-blue-200">
                      <p className="text-sm font-medium mb-2">Нэмэгдлүүд (автомат):</p>
                      <div className="space-y-1">
                        {allowances.map((a: any) => (
                          <div key={a.id} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{a.name}</span>
                            <span className="font-medium">+{Number(a.amount).toLocaleString('mn-MN')}₮</span>
                          </div>
                        ))}
                        <div className="pt-1 border-t border-blue-200 flex justify-between text-sm font-semibold">
                          <span>Нийт нэмэгдэл:</span>
                          <span className="text-blue-600">
                            +{allowances.reduce((sum: number, a: any) => sum + Number(a.amount || 0), 0).toLocaleString('mn-MN')}₮
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="overtimeHours"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Илүү цаг (цаг)</FormLabel>
                          <FormControl>
                            <Input type="number" step="0.5" {...field} className="h-11" placeholder="0" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="bonus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Урамшуулал (₮)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} className="h-11" placeholder="0" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Advances Display */}
                  {advances.length > 0 && (
                    <div className="p-3 bg-orange-50/50 rounded-lg border border-orange-200">
                      <p className="text-sm font-medium mb-2">Урьдчилгаа/Зээл (суутгал):</p>
                      <div className="space-y-1">
                        {advances.map((a: any) => {
                          const remaining = Number(a.amount || 0) - Number(a.deductedAmount || 0);
                          const deductionThisMonth = a.deductionType === "monthly" && a.monthlyDeductionAmount
                            ? Math.min(remaining, Number(a.monthlyDeductionAmount))
                            : remaining;
                          return (
                            <div key={a.id} className="flex justify-between text-xs">
                              <span className="text-muted-foreground">
                                {a.isLoan ? "Зээл" : "Урьдчилгаа"} ({a.deductionType === "monthly" ? "сарын" : "нэг удаа"})
                              </span>
                              <span className="font-medium text-orange-600">
                                -{deductionThisMonth.toLocaleString('mn-MN')}₮
                              </span>
                            </div>
                          );
                        })}
                        {calculationResult && (
                          <div className="pt-1 border-t border-orange-200 flex justify-between text-sm font-semibold">
                            <span>Энэ сард хасах:</span>
                            <span className="text-orange-600">
                              -{calculationResult.advances.deducted.toLocaleString('mn-MN')}₮
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Calculation Breakdown */}
                  {calculationResult && (
                    <div className="p-3 bg-muted/30 rounded-lg border space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Нийт орлого:</span>
                        <span className="font-semibold">{calculationResult.grossPay.toLocaleString('mn-MN')}₮</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground pl-2">
                        <span>• Үндсэн цалин:</span>
                        <span>{calculationResult.baseSalary.toLocaleString('mn-MN')}₮</span>
                      </div>
                      {calculationResult.allowances.taxable + calculationResult.allowances.nonTaxable > 0 && (
                        <div className="flex justify-between text-xs text-muted-foreground pl-2">
                          <span>• Нэмэгдэл:</span>
                          <span>+{(calculationResult.allowances.taxable + calculationResult.allowances.nonTaxable).toLocaleString('mn-MN')}₮</span>
                        </div>
                      )}
                      {calculationResult.overtime > 0 && (
                        <div className="flex justify-between text-xs text-muted-foreground pl-2">
                          <span>• Илүү цаг:</span>
                          <span>+{calculationResult.overtime.toLocaleString('mn-MN')}₮</span>
                        </div>
                      )}
                      {calculationResult.bonus > 0 && (
                        <div className="flex justify-between text-xs text-muted-foreground pl-2">
                          <span>• Урамшуулал:</span>
                          <span>+{calculationResult.bonus.toLocaleString('mn-MN')}₮</span>
                        </div>
                      )}
                      <div className="pt-2 border-t flex justify-between">
                        <span className="text-muted-foreground">Нийт суутгал:</span>
                        <span className="font-semibold text-red-600">-{calculationResult.totalDeductions.toLocaleString('mn-MN')}₮</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground pl-2">
                        <span>• НДШ (ажилтан):</span>
                        <span>-{calculationResult.shi.employee.toLocaleString('mn-MN')}₮</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground pl-2">
                        <span>• ХХОАТ:</span>
                        <span>-{calculationResult.pit.tax.toLocaleString('mn-MN')}₮</span>
                      </div>
                      {calculationResult.advances.deducted > 0 && (
                        <div className="flex justify-between text-xs text-muted-foreground pl-2">
                          <span>• Урьдчилгаа:</span>
                          <span>-{calculationResult.advances.deducted.toLocaleString('mn-MN')}₮</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="socialInsurance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">НДШ (11.5% ажилтан)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} readOnly className="bg-muted text-muted-foreground" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="tax"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">ХХОАТ (шатлал)</FormLabel>
                          <FormControl>
                            <Input type="number" {...field} readOnly className="bg-muted text-muted-foreground" />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="netSalary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-green-600 font-bold">Гар дээрх цалин (₮)</FormLabel>
                        <FormControl>
                          <Input type="number" {...field} readOnly className="bg-green-50/50 border-green-200 text-green-700 font-bold text-lg" />
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

      {/* Dashboard KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="glass-card p-4 rounded-xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-full w-1 group-hover:bg-primary transition-all duration-300"></div>
          <p className="text-sm font-medium text-muted-foreground">Нийт бодогдсон (Gross)</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {filteredPayroll.reduce((sum, item) => sum + Number(item.grossPay || 0), 0).toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">₮</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-full w-1 group-hover:bg-red-500 transition-all duration-300"></div>
          <p className="text-sm font-medium text-muted-foreground">Нийт суутгал</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-red-600">
              {filteredPayroll.reduce((sum, item) => sum + Number(item.totalDeductions || 0), 0).toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">₮</span>
          </div>
        </div>

        <div className="glass-card p-4 rounded-xl relative overflow-hidden group">
          <div className="absolute right-0 top-0 h-full w-1 group-hover:bg-green-500 transition-all duration-300"></div>
          <p className="text-sm font-medium text-muted-foreground">Гар дээр олгох</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-green-600">
              {filteredPayroll.reduce((sum, item) => sum + Number(item.netPay || 0), 0).toLocaleString()}
            </span>
            <span className="text-sm text-muted-foreground">₮</span>
          </div>
        </div>
      </div>

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

      <div className="glass-card rounded-xl overflow-hidden shadow-lg border-opacity-50 relative pb-20">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/40">
              <TableHead className="w-[40px] pl-4">
                <Checkbox
                  checked={filteredPayroll.length > 0 && selectedIds.length === filteredPayroll.length}
                  onCheckedChange={(checked) => handleSelectAll(!!checked)}
                  aria-label="Select all"
                />
              </TableHead>
              <TableHead>Хугацаа</TableHead>
              <TableHead>Ажилтан</TableHead>
              <TableHead className="text-right">Үндсэн цалин</TableHead>
              <TableHead className="text-right">Суутгал (НДШ+ХХОАТ)</TableHead>
              <TableHead className="text-right font-bold text-primary">Гар дээрх</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                    <p>Цалингийн мэдээллийг ачааллаж байна...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredPayroll.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                  {search ? "Хайлтад тохирох цалин олдсонгүй." : "Цалингийн бүртгэл байхгүй байна."}
                </TableCell>
              </TableRow>
            ) : (
              filteredPayroll.map((record, index) => {
                const employee = employees.find((e) => e.id === record.employeeId);
                const deductions = Number(record.totalDeductions ?? 0);
                const isSelected = selectedIds.includes(record.id);

                const periodText = `${format(new Date(record.periodStart as any), "yyyy.MM.dd")} - ${format(new Date(record.periodEnd as any), "yyyy.MM.dd")}`;

                return (
                  <TableRow
                    key={record.id}
                    className={`table-row-hover group animate-slide-up ${isSelected ? "bg-primary/5 hover:bg-primary/10" : ""}`}
                    style={{ animationDelay: `${index * 0.05}s` }}
                  >
                    <TableCell className="pl-4">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => handleSelectRow(record.id, !!checked)}
                        aria-label="Select row"
                      />
                    </TableCell>
                    <TableCell className="font-medium text-muted-foreground">{periodText}</TableCell>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                          {employee?.firstName?.[0] || "?"}
                        </div>
                        <div>
                          <div>{employee ? `${employee.firstName} ${employee.lastName}` : `EMP-${record.employeeId}`}</div>
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
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="opacity-0 group-hover:opacity-100 transition-opacity h-8 w-8"
                          >
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(record)}>
                            <Pencil className="mr-2 h-4 w-4" /> Засах
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleDelete(record)}
                            className="text-red-600 focus:text-red-600"
                          >
                            <Trash2 className="mr-2 h-4 w-4" /> Устгах
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>

        {/* Floating Action Bar */}
        {selectedIds.length > 0 && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10 fade-in z-50 hover:scale-105 transition-transform">
            <div className="flex items-center gap-2 border-r border-gray-700 pr-4">
              <span className="bg-white text-gray-900 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold">
                {selectedIds.length}
              </span>
              <span className="text-sm font-medium">цалин сонгогдлоо</span>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="text-green-400 hover:text-green-300 hover:bg-white/10"
                onClick={() => handleBulkAction('approve')}
              >
                <Check className="w-4 h-4 mr-2" />
                Батлах
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-yellow-400 hover:text-yellow-300 hover:bg-white/10"
                onClick={() => handleBulkAction('draft')}
              >
                <FileText className="w-4 h-4 mr-2" />
                Ноорог
              </Button>
              <div className="h-4 w-px bg-gray-700 mx-2"></div>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-400 hover:text-red-300 hover:bg-white/10"
                onClick={() => handleBulkAction('delete')}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Устгах
              </Button>
            </div>

            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 ml-2 text-gray-500 hover:text-white rounded-full hover:bg-white/20"
              onClick={() => setSelectedIds([])}
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function MyPayslipsView() {
  const { data: payslips, isLoading } = useMyPayslips();

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Миний цалингийн хуудас</h1>
        <p className="text-muted-foreground">Таны цалингийн түүх болон дэлгэрэнгүй мэдээлэл</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {payslips?.map((slip: any) => (
          <div key={slip.id} className="bg-card rounded-lg border shadow-sm p-6 hover:shadow-md transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Цалингийн үе</p>
                <h3 className="font-bold text-lg">{format(new Date(slip.periodStart), "yyyy.MM.dd")} - {format(new Date(slip.periodEnd), "yyyy.MM.dd")}</h3>
              </div>
              <Badge variant={slip.status === "Paid" ? "default" : "secondary"}>
                {slip.status === "Paid" ? "Олгосон" : slip.status}
              </Badge>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Нийт олгох:</span>
                <span className="font-medium">{Number(slip.grossPay).toLocaleString()} ₮</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Суутгал:</span>
                <span className="font-medium text-red-500">-{Number(slip.totalDeductions).toLocaleString()} ₮</span>
              </div>
              <div className="pt-3 border-t flex justify-between items-center">
                <span className="font-bold">Гар дээр:</span>
                <span className="font-bold text-xl text-primary">{Number(slip.netPay).toLocaleString()} ₮</span>
              </div>
            </div>
          </div>
        ))}

        {(!payslips || payslips.length === 0) && (
          <div className="col-span-full text-center py-12 text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
            Цалингийн мэдээлэл олдсонгүй
          </div>
        )}
      </div>
    </div>
  );
}