import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useEmployees, useJobTitles } from "@/hooks/use-employees";
import { useAuth } from "@/hooks/use-auth";
import { usePayroll } from "@/hooks/use-payroll";
import { useDepartments } from "@/hooks/use-departments";
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
import { Plus, Search, MoreHorizontal, Eye, EyeOff, Pencil, DollarSign, Trash2, CreditCard, Users, UserPlus, Download, Printer } from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertEmployeeSchema,
  type Employee,
  type InsertEmployee,
} from "@shared/schema";
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
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { EmptyState } from "@/components/empty-state";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { exportToCSV, formatDateForCSV, formatNumberForCSV } from "@/lib/export-utils";
import { printTable } from "@/lib/print-utils";
import { calculateMongolianSocialInsurance, calculateMongolianIncomeTax } from "@shared/mongolian-validators";
import { z } from "zod";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";

import { useRoles } from "@/hooks/use-roles";
import { EmployeeAllowancesDialog } from "@/components/employees/EmployeeAllowancesDialog";
import { SalaryAdvanceRequestForm } from "@/components/employees/SalaryAdvanceRequestForm";
import { AddJobTitleDialog } from "@/components/employees/AddJobTitleDialog";
import { AddDepartmentDialog } from "@/components/employees/AddDepartmentDialog";
import { Mail } from "lucide-react";

const employeeFormSchema = insertEmployeeSchema.extend({
  createUser: z.boolean().optional().default(false),
  role: z.string().optional(), // System Role
});

type EmployeeFormValues = z.infer<typeof employeeFormSchema>;

export default function Employees(): JSX.Element {
  const { employees = [], isLoading, createEmployee, updateEmployee, deleteEmployee, deleteEmployees } =
    useEmployees();
  const { data: jobTitles = [] } = useJobTitles();
  const { roles = [] } = useRoles();
  const { user } = useAuth();
  const userRole = user?.role?.toLowerCase() || '';
  const isManager = userRole === "admin" || userRole === "hr";

  const { payroll = [] } = usePayroll(); // Fetch payslips for salary display
  const { departments = [] } = useDepartments(); // Fetch departments for selection
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 300); // Debounce search by 300ms
  const { toast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [isSalaryEditOpen, setIsSalaryEditOpen] = useState(false);
  const [isAdvanceRequestOpen, setIsAdvanceRequestOpen] = useState(false);
  const [isAllowanceOpen, setIsAllowanceOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );
  const [isSalaryAdvanceOpen, setIsSalaryAdvanceOpen] = useState(false);
  const [isAddJobTitleOpen, setIsAddJobTitleOpen] = useState(false);
  const [isAddDepartmentOpen, setIsAddDepartmentOpen] = useState(false);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(10); // Items per page
  const [salaryVisible, setSalaryVisible] = useState(false); // Цалин нуух/харуулах
  const [departmentFilter, setDepartmentFilter] = useState<string>("all"); // Хэлтсээр шүүх

  // Status badge тохиргоо
  const statusConfig: Record<string, { label: string; className: string }> = {
    active: { label: "Идэвхтэй", className: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/20" },
    probation: { label: "Туршилтын", className: "bg-amber-500/10 text-amber-600 border-amber-500/20 hover:bg-amber-500/20" },
    on_leave: { label: "Амралттай", className: "bg-blue-500/10 text-blue-600 border-blue-500/20 hover:bg-blue-500/20" },
    terminated: { label: "Гарсан", className: "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20" },
    inactive: { label: "Идэвхгүй", className: "bg-gray-500/10 text-gray-500 border-gray-500/20 hover:bg-gray-500/20" },
  };

  const form = useForm<EmployeeFormValues>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      employeeNo: "",
      nationalId: "",
      email: "",
      phone: "",
      baseSalary: "0",
      status: "active",
      hireDate: new Date().toISOString().split('T')[0], // Default today
      departmentId: undefined,
      position: "", // Албан тушаал
      createUser: false,
      role: "User",
    },
  });

  // Memoized handlers to prevent unnecessary re-renders
  const handleAdd = useCallback(() => {
    setSelectedEmployee(null);
    form.reset({
      firstName: "",
      lastName: "",
      employeeNo: `EMP-${Date.now().toString().slice(-6)}`,
      nationalId: "",
      email: "",
      phone: "",
      baseSalary: "0",
      status: "active",
      hireDate: new Date().toISOString().split('T')[0],

      position: "",
      jobTitleId: undefined, // New
      createUser: true,
      role: "User",
    } as any);
    setIsEditOpen(true);
  }, [form]);

  const handleEdit = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);

    // Convert baseSalary - numeric field from DB comes as string like "150000.00"
    // We'll keep it simple and just convert to string, removing unnecessary .00
    let baseSalaryStr = "0";
    if (employee.baseSalary) {
      const str = String(employee.baseSalary);
      // Remove trailing .00 if present
      if (str.endsWith('.00')) {
        baseSalaryStr = str.replace('.00', '');
      } else {
        baseSalaryStr = str;
      }
    }

    form.reset({
      firstName: employee.firstName,
      lastName: employee.lastName || "",
      employeeNo: employee.employeeNo || "",
      nationalId: employee.nationalId || "",
      email: employee.email || "",
      phone: employee.phone || "",
      baseSalary: baseSalaryStr,
      status: employee.status || "active",
      // Handle date string or Date object
      hireDate: employee.hireDate ? String(employee.hireDate).split('T')[0] : new Date().toISOString().split('T')[0],
      departmentId: employee.departmentId || undefined,

      position: (employee as any).position || "",
      jobTitleId: (employee as any).jobTitleId || undefined,
      createUser: true,
      role: "User",
    } as any);
    setIsEditOpen(true);
  }, [form]);

  const handleView = useCallback((employee: Employee) => {
    setSelectedEmployee(employee);
    setIsViewOpen(true);
  }, []);


  const handleToggleSelect = useCallback((employeeId: string, event: React.ChangeEvent<HTMLInputElement> | React.MouseEvent) => {
    event.stopPropagation();
    setSelectedEmployeeIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(employeeId)) {
        newSet.delete(employeeId);
      } else {
        newSet.add(employeeId);
      }
      return newSet;
    });
  }, []);

  // Reset to page 1 when search changes (using debounced value)
  React.useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch]);

  const handleBulkDelete = useCallback(async () => {
    if (selectedEmployeeIds.size === 0) return;

    if (!window.confirm(`Та ${selectedEmployeeIds.size} ажилтныг устгахдаа итгэлтэй байна уу?`)) {
      return;
    }

    try {
      await deleteEmployees.mutateAsync(Array.from(selectedEmployeeIds));
      toast({
        title: "Амжилттай",
        description: `${selectedEmployeeIds.size} ажилтан амжилттай устгагдлаа.`,
        variant: "success",
      });
      setSelectedEmployeeIds(new Set());
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Ажилтан устгахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  }, [selectedEmployeeIds, deleteEmployees, toast]);

  const handleDelete = useCallback(async (employee: Employee) => {
    if (!window.confirm(`Та ${employee.firstName} ${employee.lastName}-г устгахдаа итгэлтэй байна уу?`)) {
      return;
    }
    console.log(employee, "aaaaaaaaaaaaaa");
    try {
      await deleteEmployee.mutateAsync(employee.id);
      toast({
        title: "Амжилттай",
        description: "Ажилтан амжилттай устгагдлаа.",
      });
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Ажилтан устгахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  }, [deleteEmployee, toast]);

  const onSubmit = useCallback(async (data: EmployeeFormValues) => {
    // Ensure numeric fields are strings/numbers as schema expects
    // Drizzle numeric is string in JS usually, but verify input
    const payload = {
      ...data,
      baseSalary: (Number(data.baseSalary) || 0).toString(),
    };

    try {
      if (selectedEmployee) {
        await updateEmployee.mutateAsync({
          id: selectedEmployee.id,
          data: payload,
        });
        toast({ title: "Амжилттай", description: "Ажилтны мэдээлэл шинэчлэгдлээ.", variant: "success" });
      } else {
        await createEmployee.mutateAsync(payload);
        toast({ title: "Амжилттай", description: "Шинэ ажилтан нэмэгдлээ.", variant: "success" });
      }
      setIsEditOpen(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Хадгалахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  }, [selectedEmployee, createEmployee, updateEmployee, toast, form]);

  const queryClient = useQueryClient();

  // Salary edit form schema
  const salaryFormSchema = z.object({
    baseSalary: z.string().min(1, "Цалин оруулна уу"),
    periodStart: z.string().min(1, "Хугацааны эхлэл"),
    periodEnd: z.string().min(1, "Хугацааны төгсгөл"),
    paymentDate: z.string().min(1, "Төлбөрийн огноо"),
    socialInsurance: z.string().optional(),
    tax: z.string().optional(),
    netSalary: z.string().optional(),
  });

  type SalaryFormValues = z.infer<typeof salaryFormSchema>;

  const salaryForm = useForm<SalaryFormValues>({
    resolver: zodResolver(salaryFormSchema),
    defaultValues: {
      baseSalary: "0",
      periodStart: format(new Date(), "yyyy-MM-dd"),
      periodEnd: format(new Date(), "yyyy-MM-dd"),
      paymentDate: format(new Date(), "yyyy-MM-dd"),
      socialInsurance: "0",
      tax: "0",
      netSalary: "0",
    },
  });

  // Watch for baseSalary changes to calculate taxes automatically
  const baseSalaryValue = salaryForm.watch("baseSalary");

  // Calculate taxes when baseSalary changes
  React.useEffect(() => {
    if (baseSalaryValue && !isNaN(Number(baseSalaryValue))) {
      const gross = Number(baseSalaryValue);
      const shi = calculateMongolianSocialInsurance(gross, 11, 12.5);
      const shiAmount = shi.employee;
      const taxableIncome = gross - shiAmount;
      const incomeTax = calculateMongolianIncomeTax(taxableIncome);
      const pitAmount = incomeTax.tax;
      const net = gross - shiAmount - pitAmount;

      salaryForm.setValue("socialInsurance", shiAmount.toString());
      salaryForm.setValue("tax", pitAmount.toString());
      salaryForm.setValue("netSalary", net.toString());
    }
  }, [baseSalaryValue, salaryForm]);

  const updateSalaryMutation = useMutation({
    mutationFn: async (values: SalaryFormValues & { employeeId: string }) => {
      const payload = {
        employeeId: values.employeeId,
        periodStart: new Date(values.periodStart).toISOString().split('T')[0],
        periodEnd: new Date(values.periodEnd).toISOString().split('T')[0],
        paymentDate: new Date(values.paymentDate).toISOString().split('T')[0],
        baseSalary: Number(values.baseSalary) || 0,
        netSalary: Number(values.netSalary) || 0,
        tax: Number(values.tax) || 0,
        socialInsurance: Number(values.socialInsurance) || 0,
        status: "Pending" as const,
      };

      const res = await fetch("/api/payroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Цалин шинэчлэхэд алдаа гарлаа");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/payroll-runs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payroll"] });
      queryClient.invalidateQueries({ queryKey: ["/api/employees"] });
      toast({
        title: "Амжилттай",
        description: "Цалин амжилттай шинэчлэгдлээ.",
      });
      setIsSalaryEditOpen(false);
      salaryForm.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Цалин шинэчлэхэд алдаа гарлаа",
        variant: "destructive",
      });
    },
  });

  const handleEditSalary = (employee: Employee) => {
    setSelectedEmployee(employee);
    const latestSalary = getEmployeeLatestSalary(employee.id);
    const currentDate = format(new Date(), "yyyy-MM-dd");

    if (latestSalary) {
      salaryForm.reset({
        baseSalary: String(latestSalary.grossPay || employee.baseSalary || 0),
        periodStart: latestSalary.periodStart ? format(new Date(latestSalary.periodStart), "yyyy-MM-dd") : currentDate,
        periodEnd: latestSalary.periodEnd ? format(new Date(latestSalary.periodEnd), "yyyy-MM-dd") : currentDate,
        paymentDate: currentDate, // Payslip doesn't have paymentDate, use current date
      });
    } else {
      salaryForm.reset({
        baseSalary: String(employee.baseSalary || 0),
        periodStart: currentDate,
        periodEnd: currentDate,
        paymentDate: currentDate,
      });
    }
    setIsSalaryEditOpen(true);
  };

  const onSalarySubmit = (data: SalaryFormValues) => {
    if (!selectedEmployee) return;
    updateSalaryMutation.mutate({
      ...data,
      employeeId: selectedEmployee.id,
    });
  };

  // Memoize filtered employees to avoid recalculation on every render
  const filteredEmployees = useMemo(() => {
    let result = employees;

    // Хэлтсээр шүүх
    if (departmentFilter !== "all") {
      result = result.filter((emp) => emp.departmentId === departmentFilter);
    }

    // Текстээр хайх
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      result = result.filter((emp) => {
        return (
          `${emp.firstName} ${emp.lastName} ${emp.employeeNo}`
            .toLowerCase()
            .includes(searchLower)
        );
      });
    }

    return result;
  }, [employees, debouncedSearch, departmentFilter]);

  // Memoize pagination calculations
  const { totalPages, paginatedEmployees, startIndex, endIndex } = useMemo(() => {
    const total = Math.ceil(filteredEmployees.length / pageSize);
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const paginated = filteredEmployees.slice(start, end);
    return { totalPages: total, paginatedEmployees: paginated, startIndex: start, endIndex: end };
  }, [filteredEmployees, currentPage, pageSize]);

  // Memoize selection state checks
  const allEmployeesSelected = useMemo(() =>
    filteredEmployees.length > 0 && filteredEmployees.every(emp => selectedEmployeeIds.has(emp.id)),
    [filteredEmployees, selectedEmployeeIds]
  );

  const allCurrentPageSelected = useMemo(() =>
    paginatedEmployees.length > 0 && paginatedEmployees.every(emp => selectedEmployeeIds.has(emp.id)),
    [paginatedEmployees, selectedEmployeeIds]
  );

  // Handlers that depend on memoized values - must be declared after them
  const handleSelectAll = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      // Select ALL employees (across all pages)
      setSelectedEmployeeIds(new Set(filteredEmployees.map((emp: Employee) => emp.id)));
    } else {
      // Deselect all
      setSelectedEmployeeIds(new Set());
    }
  }, [filteredEmployees]);

  const handleSelectCurrentPage = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      // Select only current page employees
      const currentPageIds = new Set(paginatedEmployees.map((emp: Employee) => emp.id));
      setSelectedEmployeeIds(prev => new Set([...Array.from(prev), ...Array.from(currentPageIds)]));
    } else {
      // Deselect current page employees
      const currentPageIds = new Set(paginatedEmployees.map((emp: Employee) => emp.id));
      setSelectedEmployeeIds(prev => {
        const newSet = new Set(prev);
        currentPageIds.forEach(id => newSet.delete(id));
        return newSet;
      });
    }
  }, [paginatedEmployees]);

  // Memoize helper function to get latest salary for an employee
  const getEmployeeLatestSalary = useCallback((employeeId: string) => {
    const employeePayslips = payroll.filter((p: any) => p.employeeId === employeeId);
    if (employeePayslips.length === 0) return null;
    // Sort by periodStart descending to get latest
    const sorted = employeePayslips.sort((a: any, b: any) => {
      const dateA = new Date(a.periodStart || 0).getTime();
      const dateB = new Date(b.periodStart || 0).getTime();
      return dateB - dateA;
    });
    return sorted[0];
  }, [payroll]);

  // Keyboard shortcuts for Employees page
  useKeyboardShortcuts([
    {
      key: "k",
      ctrlKey: true,
      action: () => {
        // Focus on search input
        const searchInput = document.querySelector('input[placeholder*="Хайх"], input[type="search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      },
      description: "Хайх талбарт шилжих",
    },
    {
      key: "n",
      ctrlKey: true,
      action: () => {
        if (!isEditOpen && !isViewOpen && !isSalaryEditOpen && !isAdvanceRequestOpen && !isAllowanceOpen) {
          handleAdd();
        }
      },
      description: "Шинэ ажилтан нэмэх",
    },
    {
      key: "Escape",
      action: () => {
        if (isEditOpen) setIsEditOpen(false);
        if (isViewOpen) setIsViewOpen(false);
        if (isSalaryEditOpen) setIsSalaryEditOpen(false);
        if (isAdvanceRequestOpen) setIsAdvanceRequestOpen(false);
        if (isAllowanceOpen) setIsAllowanceOpen(false);
      },
      description: "Dialog хаах",
    },
  ]);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display">
            Ажилтнууд
          </h2>
          <p className="text-muted-foreground mt-1">
            Байгууллагын ажилтнуудыг удирдах.
          </p>
        </div>

        {isManager && (
          <Button
            onClick={handleAdd}
            className="shadow-lg shadow-primary/25 hover:shadow-primary/30"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ажилтан нэмэх
          </Button>
        )}
      </div>

      {/* Add / Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEmployee ? "Ажилтан засах" : "Шинэ ажилтан нэмэх"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6 pt-4"
            >
              {/* Үндсэн мэдээлэл: Нэр + Овог */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Нэр</FormLabel>
                      <FormControl>
                        <Input placeholder="Нэрээ оруулна уу" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Овог</FormLabel>
                      <FormControl>
                        <Input placeholder="Овгоо оруулна уу" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Код + Хэлтэс */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="employeeNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ажилтны код</FormLabel>
                      <FormControl>
                        <Input {...field} value={field.value ?? ""} disabled={!!selectedEmployee} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormField
                      control={form.control}
                      name="departmentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Хэлтэс</FormLabel>
                          <Select
                            onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                            value={field.value || "none"}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Хэлтэс сонгох" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="none">Бусад</SelectItem>
                              {departments.map((dept) => (
                                <SelectItem key={dept.id} value={dept.id}>
                                  {dept.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {isManager && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mb-1"
                      onClick={() => setIsAddDepartmentOpen(true)}
                      title="Шинэ хэлтэс нэмэх"
                    >
                      +
                    </Button>
                  )}
                </div>
              </div>

              {/* Албан тушаал + Төлөв */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <FormField
                      control={form.control}
                      name="jobTitleId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Албан тушаал</FormLabel>
                          <Select
                            onValueChange={(val) => {
                              field.onChange(val);
                              // Also update 'position' text for backward compatibility
                              const title = jobTitles.find(t => t.id === val);
                              if (title) form.setValue("position", title.name);
                            }}
                            value={field.value || undefined}
                          >
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Албан тушаал сонгох" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {jobTitles
                                .filter(t => t.isActive || t.id === field.value)
                                .map((title) => (
                                  <SelectItem key={title.id} value={title.id} className="items-start">
                                    <div className="flex flex-col text-left">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold">{title.name}</span>
                                        {!title.isActive && (
                                          <Badge variant="secondary" className="text-[10px] h-4 px-1">
                                            Идэвхгүй
                                          </Badge>
                                        )}
                                      </div>
                                      <span className="text-xs text-muted-foreground">
                                        {title.code || ""}
                                        {title.departmentId && departments?.find(d => d.id === title.departmentId)?.name ? ` • ${departments.find(d => d.id === title.departmentId)?.name}` : ""}
                                      </span>
                                    </div>
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                          {/* <FormDescription className="text-xs">
                            Албан тушаал нь стандарт жагсаалтаас сонгогдоно (HR).
                          </FormDescription> */}
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  {isManager && (
                    <Button
                      type="button"
                      variant="outline"
                      className="" // Align with input box
                      onClick={() => setIsAddJobTitleOpen(true)}
                      title="Шинэ албан тушаал нэмэх"
                    >
                      +
                    </Button>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="status"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Төлөв</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Төлөв сонгох" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">Идэвхтэй</SelectItem>
                          <SelectItem value="probation">Туршилтын</SelectItem>
                          <SelectItem value="on_leave">Чөлөөтэй</SelectItem>
                          <SelectItem value="terminated">Гарсан</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Ажилд орсон огноо + Үндсэн цалин (засах үед л) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="hireDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ажилд орсон огноо</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value ? String(field.value).split('T')[0] : ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {selectedEmployee && (
                  <FormField
                    control={form.control}
                    name="baseSalary"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Үндсэн цалин (₮)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            value={field.value ?? "0"}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </div>

              {/* Create User Section - Only for new employees */}
              <div className="space-y-4 pt-4 border-t">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="createUser"
                    checked={form.watch("createUser")}
                    onCheckedChange={(checked) => {
                      form.setValue("createUser", checked === true);
                    }}
                  />
                  <label
                    htmlFor="createUser"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Системийн эрх үүсгэх
                  </label>
                </div>

                {form.watch("createUser") && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Имэйл</FormLabel>
                          <FormControl>
                            <Input
                              type="email"
                              placeholder="example@gmail.com"
                              {...field}
                              value={field.value ?? ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Системийн эрх</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value || "User"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Эрх сонгох" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="User">Ажилтан (Employee)</SelectItem>
                              <SelectItem value="Manager">Менежер (Manager)</SelectItem>
                              <SelectItem value="HR">Хүний нөөц (HR)</SelectItem>
                              <SelectItem value="Admin">Админ (Admin)</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="col-span-1 sm:col-span-2">
                      <div className="flex items-center gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <span>Урилгын холбоос имэйлээр илгээгдэнэ. Хэрэглэгч өөрийн нууц үгийг тохируулна.</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Засах үед Имэйл */}
              {/* {selectedEmployee && (
                <div className="pt-4 border-t">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Имэйл</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="example@gmail.com"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )} */}

              {/* Нэмэлтээр заавал бөглөх шаардлагагүй */}
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium text-muted-foreground">Нэмэлтээр заавал бөглөх шаардлагагүй</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="phone"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Утасны дугаар</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="88001234"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nationalId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Регистрийн дугаар (РД)</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="ИБ99061111"
                            maxLength={10}
                            value={field.value ?? ""}
                            onChange={(e) => {
                              let value = e.target.value.toUpperCase();

                              if (value.length > 0 && value.length <= 2) {
                                value = value.replace(/[^А-ЯЁ]/g, '');
                              }
                              else if (value.length > 2) {
                                const firstTwo = value.substring(0, 2).replace(/[^А-ЯЁ]/g, '');
                                const rest = value.substring(2).replace(/\D/g, '').slice(0, 8);
                                value = firstTwo + rest;
                              }

                              field.onChange(value);
                            }}
                          />
                        </FormControl>
                        <FormMessage />
                        <p className="text-xs text-muted-foreground">
                          Формат: 2 кирилл үсэг + 8 оронтой тоо
                        </p>
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={
                  createEmployee.isPending || updateEmployee.isPending
                }
              >
                {createEmployee.isPending || updateEmployee.isPending
                  ? "Хадгалагдаж байна..."
                  : selectedEmployee
                    ? "Хадгалах"
                    : "Нэмэх"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Inline Add Department Dialog */}
      <AddDepartmentDialog
        open={isAddDepartmentOpen}
        onOpenChange={setIsAddDepartmentOpen}
        onSuccess={(deptId) => {
          form.setValue("departmentId", deptId);
        }}
      />

      {/* Inline Add Job Title Dialog */}
      <AddJobTitleDialog
        open={isAddJobTitleOpen}
        onOpenChange={setIsAddJobTitleOpen}
        onSuccess={(jobTitleId) => {
          form.setValue("jobTitleId", jobTitleId);
        }}
      />

      {/* View Modal */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ажилтны дэлгэрэнгүй мэдээлэл</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-4">
              <div className="flex items-center gap-4 border-b pb-4">
                <div className="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-2xl">
                  {selectedEmployee.firstName?.[0] || ""}
                  {selectedEmployee.lastName?.[0] || ""}
                </div>
                <div>
                  <h3 className="text-xl font-bold">
                    {selectedEmployee.firstName} {selectedEmployee.lastName}
                  </h3>
                  <Badge variant={selectedEmployee.status === 'active' ? "default" : "secondary"}>
                    {selectedEmployee.status}
                  </Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-muted-foreground">Код:</p>
                  <p>{selectedEmployee.employeeNo}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">Email:</p>
                  <p>{selectedEmployee.email || "-"}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">Утас:</p>
                  <p>{selectedEmployee.phone || "-"}</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">
                    Үндсэн цалин:
                  </p>
                  <p>{Number(selectedEmployee.baseSalary).toLocaleString()} ₮</p>
                </div>
                <div>
                  <p className="font-semibold text-muted-foreground">
                    Ажилд орсон:
                  </p>
                  <p>
                    {selectedEmployee.hireDate
                      ? format(
                        new Date(selectedEmployee.hireDate),
                        "yyyy-MM-dd"
                      )
                      : "-"}
                  </p>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Bulk Actions Bar - ABOVE the table */}
      {isManager && selectedEmployeeIds.size > 0 && (
        <div className="flex items-center justify-between bg-primary/10 border border-primary/20 rounded-xl p-4">
          <div className="flex items-center gap-2">
            <span className="font-medium text-primary">
              {selectedEmployeeIds.size} ажилтан сонгогдлоо
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={deleteEmployees.isPending}
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Устгах ({selectedEmployeeIds.size})
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedEmployeeIds(new Set())}
            >
              Цуцлах
            </Button>
          </div>
        </div>
      )}

      {/* Export & Print Buttons */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1" />
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const headers = ["Код", "Нэр", "Овог", "Имэйл", "Утас", "РД", "Ажилд орсон огноо", "Үндсэн цалин (₮)", "Одоогийн цалин (₮)", "Төлөв"];
              const rows = paginatedEmployees.map((emp) => {
                const latestSalary = getEmployeeLatestSalary(emp.id);
                const displaySalary = latestSalary
                  ? Number(latestSalary.grossPay || emp.baseSalary || 0)
                  : Number(emp.baseSalary || 0);

                return [
                  emp.employeeNo || "-",
                  emp.firstName || "",
                  emp.lastName || "",
                  emp.email || "-",
                  emp.phone || "-",
                  emp.nationalId || "-",
                  emp.hireDate ? format(new Date(emp.hireDate), "yyyy-MM-dd") : "-",
                  formatNumberForCSV(emp.baseSalary) || "0",
                  formatNumberForCSV(displaySalary) || "0",
                  emp.status === "active" ? "Идэвхтэй" : emp.status === "inactive" ? "Идэвхгүй" : "Татгалзсан",
                ];
              });

              printTable(
                "Ажилтнууд",
                headers,
                rows,
                `Нийт: ${filteredEmployees.length} ажилтан (${currentPage}/${totalPages} хуудас)`
              );
            }}
          >
            <Printer className="w-4 h-4 mr-2" />
            Хэвлэх
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const dataToExport = filteredEmployees.map((emp) => {
                const latestSalary = getEmployeeLatestSalary(emp.id);
                const displaySalary = latestSalary
                  ? Number(latestSalary.grossPay || emp.baseSalary || 0)
                  : Number(emp.baseSalary || 0);

                return {
                  employeeNo: emp.employeeNo || "",
                  firstName: emp.firstName || "",
                  lastName: emp.lastName || "",
                  email: emp.email || "",
                  phone: emp.phone || "",
                  nationalId: emp.nationalId || "",
                  hireDate: formatDateForCSV(emp.hireDate),
                  baseSalary: formatNumberForCSV(emp.baseSalary),
                  currentSalary: formatNumberForCSV(displaySalary),
                  status: emp.status || "",
                };
              });

              exportToCSV(
                dataToExport,
                [
                  { key: "employeeNo", label: "Ажилтны код" },
                  { key: "firstName", label: "Нэр" },
                  { key: "lastName", label: "Овог" },
                  { key: "email", label: "Имэйл" },
                  { key: "phone", label: "Утас" },
                  { key: "nationalId", label: "РД" },
                  { key: "hireDate", label: "Ажилд орсон огноо" },
                  { key: "baseSalary", label: "Үндсэн цалин (₮)" },
                  { key: "currentSalary", label: "Одоогийн цалин (₮)" },
                  { key: "status", label: "Төлөв" },
                ],
                `ажилтнууд_${new Date().toISOString().split("T")[0]}.csv`
              );

              toast({
                title: "Амжилттай",
                description: `${dataToExport.length} ажилтны мэдээлэл CSV файлд экспорт хийгдлээ.`,
                variant: "success",
              });
            }}
          >
            <Download className="w-4 h-4 mr-2" />
            CSV экспорт
          </Button>
        </div>
      </div>

      {/* Search + Department Filter */}
      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <Search className="w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Ажилтнаар хайх (нэр, овог, код)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
        />
        <div className="flex items-center gap-2">
          <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Хэлтсээр шүүх" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх хэлтэс</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept.id} value={dept.id}>
                  {dept.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="w-[50px]">
                <div className="flex flex-col gap-1">
                  <input
                    type="checkbox"
                    checked={allEmployeesSelected}
                    onChange={handleSelectAll}
                    className="rounded border-gray-300"
                    title="Бүх хуудаснаас сонгох"
                  />
                  {totalPages > 1 && (
                    <input
                      type="checkbox"
                      checked={allCurrentPageSelected}
                      onChange={handleSelectCurrentPage}
                      className="rounded border-gray-300"
                      title="Одоогийн хуудаснаас сонгох"
                    />
                  )}
                </div>
              </TableHead>
              <TableHead>Ажилтан</TableHead>
              <TableHead>Код</TableHead>
              <TableHead>Хэлтэс</TableHead>
              {isManager && (
                <TableHead>
                  <div className="flex items-center gap-2">
                    <span>Цалин</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => setSalaryVisible(!salaryVisible)}
                      title={salaryVisible ? "Цалин нуух" : "Цалин харуулах"}
                    >
                      {salaryVisible ? (
                        <Eye className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <EyeOff className="h-4 w-4 text-muted-foreground" />
                      )}
                    </Button>
                  </div>
                </TableHead>
              )}
              <TableHead>Ажилд орсон</TableHead>
              <TableHead>Төлөв</TableHead>
              {isManager && <TableHead className="w-[150px]">Үйлдэл</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="text-center py-12 text-muted-foreground"
                >
                  Ажилтнууд ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="p-0">
                  <div className="py-8">
                    <EmptyState
                      icon={<Users className="w-12 h-12" />}
                      title={search ? "Хайлтад тохирох ажилтан олдсонгүй" : "Ажилтан бүртгэгдээгүй байна"}
                      description={
                        search
                          ? "Хайлтын нэр, код, эсвэл утасны дугаараар дахин оролдоно уу."
                          : "Эхний ажилтнаа нэмээд системдээ ажилтнуудыг удирдаж эхлэнэ үү."
                      }
                      action={
                        !search && (
                          <Button onClick={handleAdd} size="sm">
                            <UserPlus className="w-4 h-4 mr-2" />
                            Ажилтан нэмэх
                          </Button>
                        )
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              paginatedEmployees.map((employee, index) => {
                const latestSalary = getEmployeeLatestSalary(employee.id);
                const displaySalary = latestSalary
                  ? Number(latestSalary.grossPay || employee.baseSalary || 0)
                  : Number(employee.baseSalary || 0);
                const isSelected = selectedEmployeeIds.has(employee.id);

                return (
                  <TableRow
                    key={employee.id}
                    className={`group ${isSelected ? 'bg-primary/5' : ''}`}
                  >
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => handleToggleSelect(employee.id, e)}
                        className="rounded border-gray-300"
                        onClick={(e) => e.stopPropagation()}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                          {employee.firstName?.[0] || ""}
                          {employee.lastName?.[0] || ""}
                        </div>
                        <div className="flex flex-col">
                          <div className="font-medium text-foreground">
                            {employee.lastName?.slice(0, 1)}. {employee.firstName}
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {(employee as any).position || "Албан тушаалгүй"}
                          </span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {employee.employeeNo}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {departments.find(d => d.id === employee.departmentId)?.name || "—"}
                      </div>
                    </TableCell>
                    {isManager && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div>
                            <div className="font-medium">
                              {salaryVisible ? (
                                displaySalary > 0
                                  ? `${displaySalary.toLocaleString('mn-MN')}₮`
                                  : "-"
                              ) : (
                                <span className="text-muted-foreground">●●●●●●</span>
                              )}
                            </div>
                            {salaryVisible && latestSalary && (
                              <div className="text-xs text-muted-foreground">
                                Цэвэр: {Number(latestSalary.netPay || 0).toLocaleString('mn-MN')}₮
                              </div>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => handleEditSalary(employee)}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground text-sm">
                      {employee.hireDate
                        ? format(new Date(employee.hireDate), "yyyy-MM-dd")
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={statusConfig[employee.status]?.className || statusConfig.inactive.className}
                      >
                        {statusConfig[employee.status]?.label || employee.status}
                      </Badge>
                    </TableCell>
                    {isManager && (
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(employee)}
                            className="h-8"
                          >
                            <Pencil className="w-4 h-4 mr-1" /> Засах
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setIsAdvanceRequestOpen(true);
                            }}
                            className="h-8"
                            title="Цалингийн урьдчилгаа хүсэх"
                          >
                            <CreditCard className="w-4 h-4 mr-1" /> Урьдчилгаа
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedEmployee(employee);
                              setIsAllowanceOpen(true);
                            }}
                            className="h-8"
                            title="Нэмэгдэл, урамшуулал бүртгэх"
                          >
                            <DollarSign className="w-4 h-4 mr-1" /> Нэмэгдэл
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(employee)}
                            className="h-8 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="w-4 h-4 mr-1" /> Устгах
                          </Button>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2 py-4 bg-card rounded-xl border shadow-sm">
          <div className="text-sm text-muted-foreground">
            Нийт {filteredEmployees.length} ажилтнаас {startIndex + 1}-{Math.min(endIndex, filteredEmployees.length)} харуулж байна
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={currentPage === 1}
            >
              Өмнөх
            </Button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                return (
                  <Button
                    key={pageNum}
                    variant={currentPage === pageNum ? "default" : "outline"}
                    size="sm"
                    onClick={() => setCurrentPage(pageNum)}
                    className="w-10"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={currentPage === totalPages}
            >
              Дараах
            </Button>
          </div>
        </div>
      )}

      {/* Цалин засах Dialog */}
      <Dialog open={isSalaryEditOpen} onOpenChange={setIsSalaryEditOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Цалин засах - {selectedEmployee?.firstName} {selectedEmployee?.lastName}
            </DialogTitle>
          </DialogHeader>

          <Form {...salaryForm}>
            <form onSubmit={salaryForm.handleSubmit(onSalarySubmit)} className="space-y-6 mt-4">
              <FormField
                control={salaryForm.control}
                name="baseSalary"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Үндсэн цалин (₮)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="0"
                        {...field}
                        value={field.value ?? "0"}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={salaryForm.control}
                  name="periodStart"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Хугацааны эхлэл</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={salaryForm.control}
                  name="periodEnd"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Хугацааны төгсгөл</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={salaryForm.control}
                name="paymentDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Төлбөрийн огноо</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Calculated fields (read-only) */}
              <div className="grid grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <p className="text-sm text-muted-foreground">НДШ</p>
                  <p className="font-medium">
                    {Number(salaryForm.watch("socialInsurance") || 0).toLocaleString('mn-MN')}₮
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">ХХОАТ</p>
                  <p className="font-medium">
                    {Number(salaryForm.watch("tax") || 0).toLocaleString('mn-MN')}₮
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Цэвэр цалин</p>
                  <p className="font-medium">
                    {Number(salaryForm.watch("netSalary") || 0).toLocaleString('mn-MN')}₮
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsSalaryEditOpen(false)}
                >
                  Цуцлах
                </Button>
                <Button
                  type="submit"
                  disabled={updateSalaryMutation.isPending}
                >
                  {updateSalaryMutation.isPending ? "Хадгалж байна..." : "Хадгалах"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Salary Advance Request Dialog */}
      <Dialog open={isAdvanceRequestOpen} onOpenChange={setIsAdvanceRequestOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Цалингийн урьдчилгаа хүсэх</DialogTitle>
          </DialogHeader>
          {selectedEmployee && <SalaryAdvanceRequestForm employee={selectedEmployee} onClose={() => setIsAdvanceRequestOpen(false)} />}
        </DialogContent>
      </Dialog>

      {/* Employee Allowances Dialog */}
      <Dialog open={isAllowanceOpen} onOpenChange={setIsAllowanceOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Нэмэгдэл, урамшуулал бүртгэх</DialogTitle>
          </DialogHeader>
          {selectedEmployee && <EmployeeAllowancesDialog employee={selectedEmployee} />}
        </DialogContent>
      </Dialog>
      <AddJobTitleDialog
        open={isAddJobTitleOpen}
        onOpenChange={setIsAddJobTitleOpen}
        onSuccess={(newId) => {
          // Auto-select the new title
          form.setValue("jobTitleId", newId);
          // Also update position text
          // We might not have the new title in 'jobTitles' array immediately if react-query didn't refetch yet.
          // But invalidateQueries was called in dialog.
          // We can optimistically set it or wait.
          // For now, ID is enough to select it once list updates.
        }}
      />
    </div>
  );
}