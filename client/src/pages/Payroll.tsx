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
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Loader2, Search, Calculator } from "lucide-react";

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
      netSalary: "0",
      tax: "0",
      socialInsurance: "0",
      status: "Pending",
    },
  });

  // Watch for baseSalary changes to calculate taxes automatically
  const baseSalary = form.watch("baseSalary");

  useEffect(() => {
    if (baseSalary && !isNaN(Number(baseSalary))) {
      const gross = Number(baseSalary);

      // Mongolian Tax Calculation Logic (2024/2025 approx)
      // SHI (Social Health Insurance) - Employee pays ~11.5% usually
      // PIT (Personal Income Tax) - 10% after SHI

      const shiRate = 0.115; // 11.5%
      const pitRate = 0.10; // 10%

      const shiAmount = Math.round(gross * shiRate);
      const taxableIncome = gross - shiAmount;
      const pitAmount = Math.round(taxableIncome * pitRate);

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

        <Dialog open={open} onOpenChange={setOpen}>
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

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="socialInsurance"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-muted-foreground">НДШ (11.5%)</FormLabel>
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
                          <FormLabel className="text-muted-foreground">ХХОАТ (10%)</FormLabel>
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

      <div className="glass-card rounded-xl overflow-hidden shadow-lg border-opacity-50">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/40">
              <TableHead>Хугацаа</TableHead>
              <TableHead>Ажилтан</TableHead>
              <TableHead className="text-right">Үндсэн цалин</TableHead>
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