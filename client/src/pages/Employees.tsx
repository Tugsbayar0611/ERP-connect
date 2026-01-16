import { useState } from "react";
import { useEmployees } from "@/hooks/use-employees";
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
import { Plus, Search, MoreHorizontal, Eye, Pencil, Users, Phone, Mail, Building, MapPin, GraduationCap, Heart, FileText, AlertTriangle } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

// Монголын онцлогт тохирсон константууд
const GENDER_OPTIONS = [
  { value: "male", label: "Эрэгтэй" },
  { value: "female", label: "Эмэгтэй" },
];

const STATUS_OPTIONS = [
  { value: "active", label: "Идэвхтэй", color: "bg-green-100 text-green-800 border-green-200" },
  { value: "inactive", label: "Идэвхгүй", color: "bg-gray-100 text-gray-800 border-gray-200" },
  { value: "on_leave", label: "Чөлөөтэй", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "terminated", label: "Гарсан", color: "bg-red-100 text-red-800 border-red-200" },
];

const CONTRACT_TYPE_OPTIONS = [
  { value: "permanent", label: "Байнгын" },
  { value: "temporary", label: "Түр" },
  { value: "probation", label: "Туршилтын" },
  { value: "contract", label: "Гэрээт" },
];

const MARITAL_STATUS_OPTIONS = [
  { value: "single", label: "Ганц бие" },
  { value: "married", label: "Гэрлэсэн" },
  { value: "divorced", label: "Салсан" },
  { value: "widowed", label: "Бэлэвсэн" },
];

const EDUCATION_OPTIONS = [
  { value: "primary", label: "Бага боловсрол" },
  { value: "secondary", label: "Бүрэн дунд" },
  { value: "vocational", label: "Мэргэжлийн" },
  { value: "bachelor", label: "Бакалавр" },
  { value: "master", label: "Магистр" },
  { value: "phd", label: "Доктор" },
];

const EMERGENCY_RELATION_OPTIONS = [
  { value: "spouse", label: "Эхнэр/Нөхөр" },
  { value: "parent", label: "Эцэг/Эх" },
  { value: "sibling", label: "Ах дүү" },
  { value: "child", label: "Хүүхэд" },
  { value: "other", label: "Бусад" },
];

const BANK_OPTIONS = [
  { value: "khan", label: "Хаан банк" },
  { value: "golomt", label: "Голомт банк" },
  { value: "tdb", label: "Худалдаа хөгжлийн банк" },
  { value: "state", label: "Төрийн банк" },
  { value: "xac", label: "ХасБанк" },
  { value: "bogd", label: "Богд банк" },
  { value: "capitron", label: "Капитрон банк" },
  { value: "arig", label: "Ариг банк" },
  { value: "chinggis", label: "Чингис хаан банк" },
  { value: "national", label: "Үндэсний хөрөнгө оруулалтын банк" },
];

// Регистрийн дугаар шалгах (2 кирилл үсэг + 8 тоо)
const validateRegisterNumber = (value: string | null | undefined) => {
  if (!value) return true; // Optional field
  const regex = /^[А-ЯЁӨҮ]{2}\d{8}$/;
  return regex.test(value.toUpperCase());
};

export default function Employees() {
  const { employees = [], isLoading, createEmployee, updateEmployee } = useEmployees();
  const { departments = [] } = useDepartments();
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [activeTab, setActiveTab] = useState("basic");

  const form = useForm<InsertEmployee>({
    resolver: zodResolver(insertEmployeeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      employeeNo: "",
      email: "",
      phone: "",
      baseSalary: "0",
      status: "active",
      hireDate: new Date().toISOString().split('T')[0],
      gender: undefined,
      registerNumber: "",
      socialInsuranceNo: "",
      position: "",
      contractType: "permanent",
      maritalStatus: undefined,
      education: undefined,
      address: "",
      city: "",
      district: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelation: undefined,
      bankName: "",
      bankAccount: "",
      notes: "",
    },
  });

  // Handlers
  const handleAdd = () => {
    setSelectedEmployee(null);
    setActiveTab("basic");
    form.reset({
      firstName: "",
      lastName: "",
      employeeNo: `EMP-${Date.now().toString().slice(-6)}`,
      email: "",
      phone: "",
      baseSalary: "0",
      status: "active",
      hireDate: new Date().toISOString().split('T')[0],
      gender: undefined,
      registerNumber: "",
      socialInsuranceNo: "",
      position: "",
      contractType: "permanent",
      contractStartDate: new Date().toISOString().split('T')[0],
      maritalStatus: undefined,
      education: undefined,
      address: "",
      city: "",
      district: "",
      emergencyContactName: "",
      emergencyContactPhone: "",
      emergencyContactRelation: undefined,
      bankName: "",
      bankAccount: "",
      notes: "",
    });
    setIsEditOpen(true);
  };

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    setActiveTab("basic");
    form.reset({
      firstName: employee.firstName,
      lastName: employee.lastName || "",
      employeeNo: employee.employeeNo || "",
      email: employee.email || "",
      phone: employee.phone || "",
      baseSalary: employee.baseSalary || "0",
      status: employee.status,
      hireDate: employee.hireDate ? String(employee.hireDate).split('T')[0] : new Date().toISOString().split('T')[0],
      gender: employee.gender || undefined,
      birthDate: employee.birthDate ? String(employee.birthDate).split('T')[0] : undefined,
      registerNumber: (employee as any).registerNumber || "",
      socialInsuranceNo: (employee as any).socialInsuranceNo || "",
      position: (employee as any).position || "",
      departmentId: employee.departmentId || undefined,
      branchId: employee.branchId || undefined,
      contractType: (employee as any).contractType || "permanent",
      contractStartDate: (employee as any).contractStartDate ? String((employee as any).contractStartDate).split('T')[0] : undefined,
      contractEndDate: (employee as any).contractEndDate ? String((employee as any).contractEndDate).split('T')[0] : undefined,
      probationEndDate: (employee as any).probationEndDate ? String((employee as any).probationEndDate).split('T')[0] : undefined,
      maritalStatus: (employee as any).maritalStatus || undefined,
      education: (employee as any).education || undefined,
      address: (employee as any).address || "",
      city: (employee as any).city || "",
      district: (employee as any).district || "",
      emergencyContactName: (employee as any).emergencyContactName || "",
      emergencyContactPhone: (employee as any).emergencyContactPhone || "",
      emergencyContactRelation: (employee as any).emergencyContactRelation || undefined,
      bankName: (employee as any).bankName || "",
      bankAccount: employee.bankAccount || "",
      notes: (employee as any).notes || "",
    });
    setIsEditOpen(true);
  };

  const handleView = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsViewOpen(true);
  };

  const onSubmit = async (data: InsertEmployee) => {
    // Регистрийн дугаар шалгах
    if (data.registerNumber && !validateRegisterNumber(data.registerNumber)) {
      toast({
        title: "Алдаа",
        description: "Регистрийн дугаар буруу форматтай байна. Жишээ: АБ12345678",
        variant: "destructive",
      });
      return;
    }

    const payload: InsertEmployee = {
      ...data,
      baseSalary: (Number(data.baseSalary) || 0).toString(),
      registerNumber: data.registerNumber?.toUpperCase() || null,
    };

    try {
      if (selectedEmployee) {
        await updateEmployee.mutateAsync({
          id: selectedEmployee.id,
          data: payload,
        });
        toast({ title: "Амжилттай", description: "Ажилтны мэдээлэл шинэчлэгдлээ." });
      } else {
        await createEmployee.mutateAsync(payload);
        toast({ title: "Амжилттай", description: "Шинэ ажилтан нэмэгдлээ." });
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
  };

  const filteredEmployees = employees.filter((emp) =>
    `${emp.firstName} ${emp.lastName} ${emp.employeeNo} ${(emp as any).position || ""} ${(emp as any).registerNumber || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    const option = STATUS_OPTIONS.find(o => o.value === status);
    return (
      <Badge className={option?.color || "bg-gray-100 text-gray-800"}>
        {option?.label || status}
      </Badge>
    );
  };

  const getDepartmentName = (deptId: string | null | undefined) => {
    if (!deptId) return "-";
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || "-";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Ажилтнууд
          </h2>
          <p className="text-muted-foreground mt-1">
            Байгууллагын ажилтнуудын бүртгэл, удирдлага.
          </p>
        </div>

        <Button
          onClick={handleAdd}
          className="shadow-lg shadow-primary/25 hover:shadow-primary/30"
        >
          <Plus className="w-4 h-4 mr-2" />
          Ажилтан нэмэх
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Нийт ажилтан</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{employees.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Идэвхтэй</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {employees.filter(e => e.status === 'active').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Чөлөөтэй</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {employees.filter(e => e.status === 'on_leave').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Хэлтэс</CardTitle>
            <Building className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{departments.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Add / Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">
              {selectedEmployee ? "Ажилтны мэдээлэл засах" : "Шинэ ажилтан бүртгэх"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full grid-cols-5">
                  <TabsTrigger value="basic" className="text-xs sm:text-sm">
                    <Users className="w-4 h-4 mr-1 hidden sm:inline" />
                    Үндсэн
                  </TabsTrigger>
                  <TabsTrigger value="work" className="text-xs sm:text-sm">
                    <FileText className="w-4 h-4 mr-1 hidden sm:inline" />
                    Ажлын
                  </TabsTrigger>
                  <TabsTrigger value="address" className="text-xs sm:text-sm">
                    <MapPin className="w-4 h-4 mr-1 hidden sm:inline" />
                    Хаяг
                  </TabsTrigger>
                  <TabsTrigger value="bank" className="text-xs sm:text-sm">
                    <Building className="w-4 h-4 mr-1 hidden sm:inline" />
                    Банк
                  </TabsTrigger>
                  <TabsTrigger value="emergency" className="text-xs sm:text-sm">
                    <AlertTriangle className="w-4 h-4 mr-1 hidden sm:inline" />
                    Яаралтай
                  </TabsTrigger>
                </TabsList>

                {/* Үндсэн мэдээлэл */}
                <TabsContent value="basic" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Овог *</FormLabel>
                          <FormControl>
                            <Input placeholder="Овог" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Нэр *</FormLabel>
                          <FormControl>
                            <Input placeholder="Нэр" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="registerNumber"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Регистрийн дугаар</FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="АБ12345678" 
                              {...field} 
                              value={field.value ?? ""}
                              onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                              maxLength={10}
                            />
                          </FormControl>
                          <FormDescription className="text-xs">
                            2 үсэг + 8 тоо (жишээ: УБ12345678)
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="gender"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Хүйс</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Сонгох" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {GENDER_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
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
                      name="birthDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Төрсөн огноо</FormLabel>
                          <FormControl>
                            <Input 
                              type="date" 
                              {...field} 
                              value={field.value ? String(field.value) : ""} 
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="maritalStatus"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Гэрлэлтийн байдал</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Сонгох" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {MARITAL_STATUS_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
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
                      name="phone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Утасны дугаар</FormLabel>
                          <FormControl>
                            <Input placeholder="88001234" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Имэйл хаяг</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="example@company.mn" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="education"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Боловсрол</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Боловсролын зэрэг сонгох" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {EDUCATION_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* Ажлын мэдээлэл */}
                <TabsContent value="work" className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
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
                    <FormField
                      control={form.control}
                      name="socialInsuranceNo"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>НДШ-ийн дугаар</FormLabel>
                          <FormControl>
                            <Input placeholder="Нийгмийн даатгалын дугаар" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="position"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Албан тушаал</FormLabel>
                          <FormControl>
                            <Input placeholder="Жишээ: Ахлах инженер" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="departmentId"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Хэлтэс</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Хэлтэс сонгох" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {departments.map(dept => (
                                <SelectItem key={dept.id} value={dept.id}>{dept.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <Separator />
                  <h4 className="font-medium text-sm text-muted-foreground">Гэрээний мэдээлэл</h4>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="contractType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Гэрээний төрөл</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? "permanent"}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Сонгох" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {CONTRACT_TYPE_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                              <SelectTrigger>
                                <SelectValue placeholder="Сонгох" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {STATUS_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
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
                      name="hireDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Ажилд орсон огноо *</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value ? String(field.value) : ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="contractEndDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Гэрээ дуусах огноо</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value ? String(field.value) : ""} />
                          </FormControl>
                          <FormDescription className="text-xs">Түр гэрээний хувьд</FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="probationEndDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Туршилтын хугацаа дуусах</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} value={field.value ? String(field.value) : ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="baseSalary"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Үндсэн цалин (₮)</FormLabel>
                          <FormControl>
                            <Input type="number" placeholder="0" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormDescription className="text-xs">
                            Хамгийн бага цалин: 550,000₮
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <FormField
                    control={form.control}
                    name="notes"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Тэмдэглэл</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Нэмэлт тэмдэглэл..." 
                            {...field} 
                            value={field.value ?? ""} 
                            rows={3}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* Хаягийн мэдээлэл */}
                <TabsContent value="address" className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="address"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Гэрийн хаяг</FormLabel>
                        <FormControl>
                          <Textarea 
                            placeholder="Дэлгэрэнгүй хаяг..." 
                            {...field} 
                            value={field.value ?? ""} 
                            rows={2}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="city"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Хот / Аймаг</FormLabel>
                          <FormControl>
                            <Input placeholder="Улаанбаатар" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="district"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Дүүрэг / Сум</FormLabel>
                          <FormControl>
                            <Input placeholder="Баянзүрх" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>

                {/* Банкны мэдээлэл */}
                <TabsContent value="bank" className="space-y-4 pt-4">
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Банк</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Банк сонгох" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {BANK_OPTIONS.map(opt => (
                              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="bankAccount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Дансны дугаар</FormLabel>
                        <FormControl>
                          <Input placeholder="1234567890" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormDescription className="text-xs">
                          Цалин шилжүүлэх данс
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </TabsContent>

                {/* Яаралтай үед холбогдох */}
                <TabsContent value="emergency" className="space-y-4 pt-4">
                  <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg mb-4">
                    <p className="text-sm text-orange-700 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4" />
                      Яаралтай тохиолдолд холбогдох хүний мэдээлэл
                    </p>
                  </div>

                  <FormField
                    control={form.control}
                    name="emergencyContactName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Холбогдох хүний нэр</FormLabel>
                        <FormControl>
                          <Input placeholder="Овог Нэр" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={form.control}
                      name="emergencyContactPhone"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Утасны дугаар</FormLabel>
                          <FormControl>
                            <Input placeholder="88001234" {...field} value={field.value ?? ""} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="emergencyContactRelation"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Таны хэн болох</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Сонгох" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {EMERGENCY_RELATION_OPTIONS.map(opt => (
                                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </TabsContent>
              </Tabs>

              <Separator />

              <div className="flex justify-end gap-3">
                <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                  Цуцлах
                </Button>
                <Button
                  type="submit"
                  disabled={createEmployee.isPending || updateEmployee.isPending}
                >
                  {createEmployee.isPending || updateEmployee.isPending
                    ? "Хадгалж байна..."
                    : selectedEmployee
                      ? "Хадгалах"
                      : "Нэмэх"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Ажилтны дэлгэрэнгүй мэдээлэл</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6">
              {/* Header with avatar */}
              <div className="flex items-center gap-4 border-b pb-4">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 text-primary flex items-center justify-center font-bold text-3xl">
                  {selectedEmployee.firstName[0]}
                  {selectedEmployee.lastName?.[0]}
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">
                    {selectedEmployee.lastName} {selectedEmployee.firstName}
                  </h3>
                  <p className="text-muted-foreground">{(selectedEmployee as any).position || "Албан тушаал тодорхойгүй"}</p>
                  <div className="mt-2">
                    {getStatusBadge(selectedEmployee.status)}
                  </div>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Ажилтны код</p>
                      <p className="font-medium">{selectedEmployee.employeeNo || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Регистрийн дугаар</p>
                      <p className="font-medium">{(selectedEmployee as any).registerNumber || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Имэйл</p>
                      <p className="font-medium">{selectedEmployee.email || "-"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Утас</p>
                      <p className="font-medium">{selectedEmployee.phone || "-"}</p>
                    </div>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <Building className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Хэлтэс</p>
                      <p className="font-medium">{getDepartmentName(selectedEmployee.departmentId)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Гэрээний төрөл</p>
                      <p className="font-medium">
                        {CONTRACT_TYPE_OPTIONS.find(c => c.value === (selectedEmployee as any).contractType)?.label || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <GraduationCap className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Боловсрол</p>
                      <p className="font-medium">
                        {EDUCATION_OPTIONS.find(e => e.value === (selectedEmployee as any).education)?.label || "-"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Heart className="w-4 h-4 text-muted-foreground" />
                    <div>
                      <p className="text-muted-foreground text-xs">Гэрлэлтийн байдал</p>
                      <p className="font-medium">
                        {MARITAL_STATUS_OPTIONS.find(m => m.value === (selectedEmployee as any).maritalStatus)?.label || "-"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Financial info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <p className="text-muted-foreground text-xs">Үндсэн цалин</p>
                  <p className="text-lg font-bold text-primary">
                    {Number(selectedEmployee.baseSalary).toLocaleString()} ₮
                  </p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Ажилд орсон</p>
                  <p className="font-medium">
                    {selectedEmployee.hireDate
                      ? format(new Date(selectedEmployee.hireDate), "yyyy.MM.dd")
                      : "-"}
                  </p>
                </div>
              </div>

              {/* Emergency Contact */}
              {(selectedEmployee as any).emergencyContactName && (
                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-sm font-medium text-orange-800 mb-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Яаралтай үед холбогдох
                  </p>
                  <p className="text-sm">{(selectedEmployee as any).emergencyContactName}</p>
                  <p className="text-sm text-muted-foreground">{(selectedEmployee as any).emergencyContactPhone}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Search */}
      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <Search className="w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Ажилтнаар хайх (нэр, код, албан тушаал, РД)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
        />
      </div>

      {/* Table */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Ажилтан</TableHead>
              <TableHead>Албан тушаал</TableHead>
              <TableHead>Хэлтэс</TableHead>
              <TableHead>Утас</TableHead>
              <TableHead>Ажилд орсон</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  Ажилтнууд ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                  {search ? "Хайлтад тохирох ажилтан олдсонгүй." : "Ажилтан бүртгэгдээгүй байна."}
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((employee) => (
                <TableRow key={employee.id} className="group hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/10 to-accent/10 text-primary flex items-center justify-center font-bold text-sm">
                        {employee.firstName[0]}
                        {employee.lastName?.[0]}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">
                          {employee.lastName} {employee.firstName}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {employee.employeeNo}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{(employee as any).position || "-"}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{getDepartmentName(employee.departmentId)}</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">{employee.phone || "-"}</span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {employee.hireDate
                      ? format(new Date(employee.hireDate), "yyyy.MM.dd")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    {getStatusBadge(employee.status)}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => handleView(employee)}>
                          <Eye className="mr-2 h-4 w-4" /> Дэлгэрэнгүй
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(employee)}>
                          <Pencil className="mr-2 h-4 w-4" /> Засах
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
