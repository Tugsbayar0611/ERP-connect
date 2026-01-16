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
import { 
  Plus, 
  Search, 
  MoreHorizontal, 
  Eye, 
  Pencil, 
  Users, 
  UserCheck, 
  UserX, 
  Briefcase,
  Phone,
  Mail,
  Calendar,
  Building2,
  CreditCard,
  Grid3X3,
  List
} from "lucide-react";
import { format } from "date-fns";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

// Format number as Mongolian Tugrik
const formatMNT = (value: number | string) => {
  const num = typeof value === 'string' ? parseFloat(value) : value;
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(num) + '₮';
};

// Get status badge variant and text
const getStatusInfo = (status: string) => {
  switch (status) {
    case "active":
      return { variant: "default" as const, text: "Идэвхтэй", color: "bg-green-500" };
    case "inactive":
      return { variant: "secondary" as const, text: "Идэвхгүй", color: "bg-gray-400" };
    case "terminated":
      return { variant: "destructive" as const, text: "Гарсан", color: "bg-red-500" };
    default:
      return { variant: "outline" as const, text: status, color: "bg-gray-400" };
  }
};

// Get gender text
const getGenderText = (gender: string | null) => {
  switch (gender) {
    case "male": return "Эрэгтэй";
    case "female": return "Эмэгтэй";
    default: return "-";
  }
};

export default function Employees() {
  const { employees = [], isLoading, createEmployee, updateEmployee } = useEmployees();
  const { departments = [] } = useDepartments();
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "grid">("table");
  const { toast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  const form = useForm<InsertEmployee>({
    resolver: zodResolver(insertEmployeeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      employeeNo: "",
      email: "",
      phone: "",
      gender: undefined,
      baseSalary: "0",
      status: "active",
      hireDate: new Date().toISOString().split('T')[0],
    },
  });

  // Statistics
  const totalEmployees = employees.length;
  const activeEmployees = employees.filter(e => e.status === "active").length;
  const inactiveEmployees = employees.filter(e => e.status === "inactive").length;
  const totalSalary = employees.reduce((sum, e) => sum + Number(e.baseSalary || 0), 0);

  // Handlers
  const handleAdd = () => {
    setSelectedEmployee(null);
    form.reset({
      firstName: "",
      lastName: "",
      employeeNo: `EMP-${Date.now().toString().slice(-6)}`,
      email: "",
      phone: "",
      gender: undefined,
      baseSalary: "0",
      status: "active",
      hireDate: new Date().toISOString().split('T')[0],
    });
    setIsEditOpen(true);
  };

  const handleEdit = (employee: Employee) => {
    setSelectedEmployee(employee);
    form.reset({
      firstName: employee.firstName,
      lastName: employee.lastName || "",
      employeeNo: employee.employeeNo || "",
      email: employee.email || "",
      phone: employee.phone || "",
      gender: (employee.gender as "male" | "female" | undefined) || undefined,
      departmentId: employee.departmentId || undefined,
      baseSalary: employee.baseSalary || "0",
      status: employee.status,
      hireDate: employee.hireDate ? String(employee.hireDate).split('T')[0] : new Date().toISOString().split('T')[0],
    });
    setIsEditOpen(true);
  };

  const handleView = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsViewOpen(true);
  };

  const onSubmit = async (data: InsertEmployee) => {
    const payload: InsertEmployee = {
      ...data,
      baseSalary: (Number(data.baseSalary) || 0).toString(),
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
    `${emp.firstName} ${emp.lastName} ${emp.employeeNo} ${emp.email || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const getDepartmentName = (deptId: string | null) => {
    if (!deptId) return "-";
    const dept = departments.find(d => d.id === deptId);
    return dept?.name || "-";
  };

  return (
    <div className="space-y-6 animate-in-fade">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Хүний нөөц
          </h2>
          <p className="text-muted-foreground mt-1">
            Байгууллагын ажилтнуудын бүртгэл ба удирдлага
          </p>
        </div>

        <Button onClick={handleAdd} className="btn-premium">
          <Plus className="w-4 h-4 mr-2" />
          Ажилтан нэмэх
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card glass-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Нийт ажилтан
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Users className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalEmployees}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Бүртгэгдсэн ажилтнууд
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card glass-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Идэвхтэй
            </CardTitle>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <UserCheck className="w-5 h-5 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{activeEmployees}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Одоо ажиллаж байгаа
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card glass-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Идэвхгүй
            </CardTitle>
            <div className="p-2 bg-gray-500/10 rounded-lg">
              <UserX className="w-5 h-5 text-gray-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-gray-600">{inactiveEmployees}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Түр чөлөө, идэвхгүй
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card glass-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Нийт цалингийн сан
            </CardTitle>
            <div className="p-2 bg-accent/10 rounded-lg">
              <CreditCard className="w-5 h-5 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-accent">{formatMNT(totalSalary)}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Сарын үндсэн цалин
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and View Toggle */}
      <div className="flex flex-col sm:flex-row items-center gap-4 glass-card p-4 rounded-xl">
        <div className="flex items-center gap-4 flex-1 w-full">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Ажилтнаар хайх (нэр, овог, код, имэйл)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
          />
        </div>
        <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "table" | "grid")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="table" className="flex items-center gap-2">
              <List className="w-4 h-4" />
              Хүснэгт
            </TabsTrigger>
            <TabsTrigger value="grid" className="flex items-center gap-2">
              <Grid3X3 className="w-4 h-4" />
              Карт
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Add / Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto glass-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-display flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {selectedEmployee ? "Ажилтан засах" : "Шинэ ажилтан нэмэх"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 pt-4">
              {/* Personal Info Section */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">
                  Хувийн мэдээлэл
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
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
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="gender"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Хүйс</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Хүйс сонгох" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="male">Эрэгтэй</SelectItem>
                            <SelectItem value="female">Эмэгтэй</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                </div>
              </div>

              {/* Contact Info Section */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">
                  Холбоо барих
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Имэйл хаяг</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder="example@company.mn"
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
                </div>
              </div>

              {/* Work Info Section */}
              <div className="space-y-4">
                <h4 className="font-medium text-sm text-muted-foreground border-b pb-2">
                  Ажлын мэдээлэл
                </h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Хэлтэс</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value || ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Хэлтэс сонгох" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
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
                            <SelectItem value="inactive">Идэвхгүй</SelectItem>
                            <SelectItem value="terminated">Гарсан</SelectItem>
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
                        <FormLabel>Ажилд орсон огноо</FormLabel>
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
                          <Input
                            type="number"
                            placeholder="0"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full btn-premium h-12"
                disabled={createEmployee.isPending || updateEmployee.isPending}
              >
                {createEmployee.isPending || updateEmployee.isPending
                  ? "Хадгалагдаж байна..."
                  : selectedEmployee
                    ? "Хадгалах"
                    : "Ажилтан нэмэх"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* View Modal */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[600px] glass-card">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Ажилтны дэлгэрэнгүй</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6">
              {/* Profile Header */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl">
                <Avatar className="w-20 h-20 border-4 border-white shadow-lg">
                  <AvatarFallback className="text-2xl font-bold bg-gradient-to-br from-primary to-accent text-white">
                    {selectedEmployee.firstName[0]}
                    {selectedEmployee.lastName?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold">
                    {selectedEmployee.lastName} {selectedEmployee.firstName}
                  </h3>
                  <p className="text-muted-foreground">{selectedEmployee.employeeNo}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge className={getStatusInfo(selectedEmployee.status).color + " text-white"}>
                      {getStatusInfo(selectedEmployee.status).text}
                    </Badge>
                    {selectedEmployee.gender && (
                      <Badge variant="outline">
                        {getGenderText(selectedEmployee.gender)}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Mail className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Имэйл</p>
                    <p className="font-medium">{selectedEmployee.email || "-"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Phone className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Утас</p>
                    <p className="font-medium">{selectedEmployee.phone || "-"}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Building2 className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Хэлтэс</p>
                    <p className="font-medium">{getDepartmentName(selectedEmployee.departmentId)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Calendar className="w-5 h-5 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">Ажилд орсон</p>
                    <p className="font-medium">
                      {selectedEmployee.hireDate
                        ? format(new Date(selectedEmployee.hireDate), "yyyy.MM.dd")
                        : "-"}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-950/30 rounded-lg col-span-2">
                  <CreditCard className="w-5 h-5 text-green-600" />
                  <div>
                    <p className="text-xs text-muted-foreground">Үндсэн цалин</p>
                    <p className="text-xl font-bold text-green-600">
                      {formatMNT(selectedEmployee.baseSalary || 0)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => setIsViewOpen(false)}>
                  Хаах
                </Button>
                <Button className="flex-1" onClick={() => { setIsViewOpen(false); handleEdit(selectedEmployee); }}>
                  <Pencil className="w-4 h-4 mr-2" />
                  Засах
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Content - Table or Grid View */}
      {viewMode === "table" ? (
        <div className="glass-card rounded-xl overflow-hidden shadow-lg">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30 hover:bg-muted/40">
                <TableHead>Ажилтан</TableHead>
                <TableHead>Код</TableHead>
                <TableHead>Хэлтэс</TableHead>
                <TableHead>Холбоо барих</TableHead>
                <TableHead>Ажилд орсон</TableHead>
                <TableHead className="text-right">Цалин</TableHead>
                <TableHead>Төлөв</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    <div className="flex flex-col items-center gap-3">
                      <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                      <p>Ажилтнуудыг ачааллаж байна...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredEmployees.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    {search ? "Хайлтад тохирох ажилтан олдсонгүй." : "Ажилтан бүртгэгдээгүй байна."}
                  </TableCell>
                </TableRow>
              ) : (
                filteredEmployees.map((employee, index) => (
                  <TableRow 
                    key={employee.id} 
                    className="group table-row-hover animate-slide-up"
                    style={{ animationDelay: `${index * 0.03}s` }}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="w-10 h-10">
                          <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary font-semibold">
                            {employee.firstName[0]}
                            {employee.lastName?.[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <div className="font-medium">
                            {employee.lastName} {employee.firstName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {getGenderText(employee.gender)}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {employee.employeeNo}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-muted-foreground" />
                        {getDepartmentName(employee.departmentId)}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm space-y-1">
                        <div className="flex items-center gap-2">
                          <Mail className="w-3 h-3 text-muted-foreground" />
                          {employee.email || "—"}
                        </div>
                        <div className="flex items-center gap-2">
                          <Phone className="w-3 h-3 text-muted-foreground" />
                          {employee.phone || "—"}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {employee.hireDate
                        ? format(new Date(employee.hireDate), "yyyy.MM.dd")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMNT(employee.baseSalary || 0)}
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={getStatusInfo(employee.status).variant}
                        className={employee.status === "active" ? "bg-green-100 text-green-800 border-green-200" : ""}
                      >
                        {getStatusInfo(employee.status).text}
                      </Badge>
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
      ) : (
        /* Grid View */
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {isLoading ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              <div className="flex flex-col items-center gap-3">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
                <p>Ажилтнуудыг ачааллаж байна...</p>
              </div>
            </div>
          ) : filteredEmployees.length === 0 ? (
            <div className="col-span-full text-center py-12 text-muted-foreground">
              {search ? "Хайлтад тохирох ажилтан олдсонгүй." : "Ажилтан бүртгэгдээгүй байна."}
            </div>
          ) : (
            filteredEmployees.map((employee, index) => (
              <Card 
                key={employee.id} 
                className="glass-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer group animate-slide-up overflow-hidden"
                style={{ animationDelay: `${index * 0.05}s` }}
                onClick={() => handleView(employee)}
              >
                <div className="h-2 bg-gradient-to-r from-primary to-accent" />
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <Avatar className="w-14 h-14 border-2 border-primary/20">
                      <AvatarFallback className="bg-gradient-to-br from-primary to-accent text-white text-lg font-bold">
                        {employee.firstName[0]}
                        {employee.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <Badge 
                      variant={getStatusInfo(employee.status).variant}
                      className={employee.status === "active" ? "bg-green-100 text-green-800" : ""}
                    >
                      {getStatusInfo(employee.status).text}
                    </Badge>
                  </div>

                  <h3 className="font-bold text-lg mb-1">
                    {employee.lastName} {employee.firstName}
                  </h3>
                  <p className="text-sm text-muted-foreground mb-3">{employee.employeeNo}</p>

                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Building2 className="w-4 h-4" />
                      <span>{getDepartmentName(employee.departmentId)}</span>
                    </div>
                    {employee.email && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Mail className="w-4 h-4" />
                        <span className="truncate">{employee.email}</span>
                      </div>
                    )}
                    {employee.phone && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Phone className="w-4 h-4" />
                        <span>{employee.phone}</span>
                      </div>
                    )}
                  </div>

                  <div className="mt-4 pt-4 border-t border-border/50 flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Цалин</span>
                    <span className="font-bold text-green-600">{formatMNT(employee.baseSalary || 0)}</span>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </div>
  );
}
