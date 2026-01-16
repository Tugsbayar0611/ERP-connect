import { useState } from "react";
import { useEmployees } from "@/hooks/use-employees";
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
  Banknote,
  Phone,
  Mail,
  Calendar,
  Briefcase,
  Trash2,
  Download,
  Filter,
} from "lucide-react";
import { format } from "date-fns";
import { mn } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Avatar өнгөний палетт
const avatarColors = [
  "bg-gradient-to-br from-blue-500 to-blue-600",
  "bg-gradient-to-br from-emerald-500 to-emerald-600",
  "bg-gradient-to-br from-violet-500 to-violet-600",
  "bg-gradient-to-br from-amber-500 to-amber-600",
  "bg-gradient-to-br from-rose-500 to-rose-600",
  "bg-gradient-to-br from-cyan-500 to-cyan-600",
  "bg-gradient-to-br from-fuchsia-500 to-fuchsia-600",
  "bg-gradient-to-br from-orange-500 to-orange-600",
];

function getAvatarColor(name: string): string {
  const index = name.charCodeAt(0) % avatarColors.length;
  return avatarColors[index];
}

// Статус орчуулга
const statusLabels: Record<string, string> = {
  active: "Идэвхтэй",
  inactive: "Идэвхгүй",
  terminated: "Гарсан",
  termintated: "Гарсан", // typo support
};

const statusColors: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 border-emerald-200",
  inactive: "bg-gray-100 text-gray-700 border-gray-200",
  terminated: "bg-red-100 text-red-700 border-red-200",
  termintated: "bg-red-100 text-red-700 border-red-200",
};

export default function Employees() {
  const { employees = [], isLoading, createEmployee, updateEmployee } =
    useEmployees();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const { toast } = useToast();

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(
    null
  );

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
    },
  });

  // Статистик тооцоолол
  const stats = {
    total: employees.length,
    active: employees.filter(e => e.status === "active").length,
    inactive: employees.filter(e => e.status !== "active").length,
    avgSalary: employees.length > 0 
      ? Math.round(employees.reduce((acc, e) => acc + Number(e.baseSalary || 0), 0) / employees.length)
      : 0,
  };

  // Handlers
  const handleAdd = () => {
    setSelectedEmployee(null);
    form.reset({
      firstName: "",
      lastName: "",
      employeeNo: `EMP-${Date.now().toString().slice(-6)}`,
      email: "",
      phone: "",
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

  // Шүүлт
  const filteredEmployees = employees.filter((emp) => {
    const matchesSearch = `${emp.firstName} ${emp.lastName} ${emp.employeeNo} ${emp.email}`
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || emp.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* Толгой хэсэг */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
            Ажилтнууд
          </h2>
          <p className="text-muted-foreground mt-1">
            Таны байгууллагын ажилтнуудыг удирдах, мэдээллийг хянах
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            className="hidden sm:flex"
          >
            <Download className="w-4 h-4 mr-2" />
            Экспорт
          </Button>
          <Button
            onClick={handleAdd}
            className="shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all"
          >
            <Plus className="w-4 h-4 mr-2" />
            Ажилтан нэмэх
          </Button>
        </div>
      </div>

      {/* Статистик карт */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-0 shadow-md hover:shadow-lg transition-all bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500 rounded-xl shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Нийт ажилтан</p>
                <p className="text-3xl font-bold text-blue-600">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-all bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/50 dark:to-emerald-900/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-emerald-500 rounded-xl shadow-lg">
                <UserCheck className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Идэвхтэй</p>
                <p className="text-3xl font-bold text-emerald-600">{stats.active}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-all bg-gradient-to-br from-gray-50 to-gray-100/50 dark:from-gray-950/50 dark:to-gray-900/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gray-500 rounded-xl shadow-lg">
                <UserX className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Идэвхгүй/Гарсан</p>
                <p className="text-3xl font-bold text-gray-600">{stats.inactive}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md hover:shadow-lg transition-all bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/50 dark:to-amber-900/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-amber-500 rounded-xl shadow-lg">
                <Banknote className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Дундаж цалин</p>
                <p className="text-2xl font-bold text-amber-600">
                  {stats.avgSalary.toLocaleString()}₮
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Нэмэх / Засах Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {selectedEmployee ? "Ажилтны мэдээлэл засах" : "Шинэ ажилтан бүртгэх"}
            </DialogTitle>
          </DialogHeader>

          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-6 pt-4"
            >
              {/* Нэр + Овог */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Овог</FormLabel>
                      <FormControl>
                        <Input placeholder="Жишээ: Бат" {...field} value={field.value ?? ""} />
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
                        <Input placeholder="Жишээ: Болд" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Код + Статус */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="employeeNo"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ажилтны код</FormLabel>
                      <FormControl>
                        <Input 
                          {...field} 
                          value={field.value ?? ""} 
                          disabled={!!selectedEmployee}
                          className="font-mono"
                        />
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
                          <SelectTrigger>
                            <SelectValue placeholder="Төлөв сонгох" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="active">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                              Идэвхтэй
                            </span>
                          </SelectItem>
                          <SelectItem value="inactive">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-gray-500"></span>
                              Идэвхгүй
                            </span>
                          </SelectItem>
                          <SelectItem value="terminated">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-red-500"></span>
                              Гарсан
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Email + Утас */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Имэйл хаяг</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="email"
                            placeholder="example@company.mn"
                            className="pl-10"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </div>
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
                        <div className="relative">
                          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            placeholder="88001234"
                            className="pl-10"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* Ажилд орсон огноо + Үндсэн цалин */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="hireDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ажилд орсон огноо</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input 
                            type="date" 
                            className="pl-10"
                            {...field} 
                            value={field.value ? String(field.value) : ""} 
                          />
                        </div>
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
                        <div className="relative">
                          <Banknote className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            type="number"
                            placeholder="0"
                            className="pl-10"
                            {...field}
                            value={field.value ?? ""}
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base shadow-lg"
                disabled={
                  createEmployee.isPending || updateEmployee.isPending
                }
              >
                {createEmployee.isPending || updateEmployee.isPending
                  ? "Хадгалагдаж байна..."
                  : selectedEmployee
                    ? "Өөрчлөлтийг хадгалах"
                    : "Ажилтан нэмэх"}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Дэлгэрэнгүй харах Modal */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="text-xl">Ажилтны дэлгэрэнгүй</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="space-y-6">
              {/* Profile Header */}
              <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary/5 to-accent/5 rounded-xl border">
                <div className={`w-20 h-20 rounded-2xl ${getAvatarColor(selectedEmployee.firstName)} text-white flex items-center justify-center font-bold text-2xl shadow-lg`}>
                  {selectedEmployee.firstName[0]}
                  {selectedEmployee.lastName?.[0]}
                </div>
                <div className="flex-1">
                  <h3 className="text-2xl font-bold">
                    {selectedEmployee.lastName} {selectedEmployee.firstName}
                  </h3>
                  <p className="text-muted-foreground font-mono text-sm">
                    {selectedEmployee.employeeNo}
                  </p>
                  <Badge className={`mt-2 ${statusColors[selectedEmployee.status] || statusColors.active}`}>
                    {statusLabels[selectedEmployee.status] || selectedEmployee.status}
                  </Badge>
                </div>
              </div>

              {/* Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Mail className="w-4 h-4" />
                    <span className="text-xs font-medium">Имэйл</span>
                  </div>
                  <p className="font-medium">{selectedEmployee.email || "—"}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Phone className="w-4 h-4" />
                    <span className="text-xs font-medium">Утас</span>
                  </div>
                  <p className="font-medium">{selectedEmployee.phone || "—"}</p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Banknote className="w-4 h-4" />
                    <span className="text-xs font-medium">Үндсэн цалин</span>
                  </div>
                  <p className="font-bold text-lg text-primary">
                    {Number(selectedEmployee.baseSalary).toLocaleString()} ₮
                  </p>
                </div>
                <div className="p-4 bg-muted/50 rounded-xl">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Calendar className="w-4 h-4" />
                    <span className="text-xs font-medium">Ажилд орсон</span>
                  </div>
                  <p className="font-medium">
                    {selectedEmployee.hireDate
                      ? format(new Date(selectedEmployee.hireDate), "yyyy оны MM сарын dd", { locale: mn })
                      : "—"}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => {
                    setIsViewOpen(false);
                    handleEdit(selectedEmployee);
                  }}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Засах
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Хайлт ба шүүлт */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <Search className="w-5 h-5 text-muted-foreground shrink-0" />
          <Input
            placeholder="Нэр, код, имэйлээр хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder="Бүх төлөв" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүгд</SelectItem>
              <SelectItem value="active">Идэвхтэй</SelectItem>
              <SelectItem value="inactive">Идэвхгүй</SelectItem>
              <SelectItem value="terminated">Гарсан</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Хүснэгт */}
      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              <TableHead className="font-semibold">Ажилтан</TableHead>
              <TableHead className="font-semibold">Код</TableHead>
              <TableHead className="font-semibold hidden md:table-cell">Холбоо барих</TableHead>
              <TableHead className="font-semibold hidden lg:table-cell">Ажилд орсон</TableHead>
              <TableHead className="font-semibold text-right hidden lg:table-cell">Цалин</TableHead>
              <TableHead className="font-semibold">Төлөв</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-muted-foreground">Ажилтнуудыг ачааллаж байна...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <Users className="w-12 h-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      {search || statusFilter !== "all"
                        ? "Хайлтад тохирох ажилтан олдсонгүй"
                        : "Ажилтан бүртгэгдээгүй байна"}
                    </p>
                    {!search && statusFilter === "all" && (
                      <Button onClick={handleAdd} variant="outline" size="sm">
                        <Plus className="w-4 h-4 mr-2" />
                        Эхний ажилтнаа нэмэх
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((employee, index) => (
                <TableRow 
                  key={employee.id} 
                  className="group hover:bg-muted/50 transition-colors cursor-pointer"
                  onClick={() => handleView(employee)}
                  style={{ animationDelay: `${index * 0.03}s` }}
                >
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl ${getAvatarColor(employee.firstName)} text-white flex items-center justify-center font-bold text-sm shadow-md`}>
                        {employee.firstName[0]}
                        {employee.lastName?.[0]}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">
                          {employee.lastName} {employee.firstName}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm text-muted-foreground">
                      {employee.employeeNo}
                    </span>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="space-y-1">
                      {employee.email && (
                        <div className="text-sm flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="w-3.5 h-3.5" />
                          {employee.email}
                        </div>
                      )}
                      {employee.phone && (
                        <div className="text-sm flex items-center gap-1.5 text-muted-foreground">
                          <Phone className="w-3.5 h-3.5" />
                          {employee.phone}
                        </div>
                      )}
                      {!employee.email && !employee.phone && (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                    {employee.hireDate
                      ? format(new Date(employee.hireDate), "yyyy.MM.dd")
                      : "—"}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-right">
                    <span className="font-semibold text-primary">
                      {Number(employee.baseSalary || 0).toLocaleString()}₮
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge className={`${statusColors[employee.status] || statusColors.active} border`}>
                      {statusLabels[employee.status] || employee.status}
                    </Badge>
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
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
                          <Eye className="mr-2 h-4 w-4" /> 
                          Дэлгэрэнгүй
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleEdit(employee)}>
                          <Pencil className="mr-2 h-4 w-4" /> 
                          Засах
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          className="text-destructive focus:text-destructive"
                          onClick={() => {
                            toast({
                              title: "Анхааруулга",
                              description: "Устгах функц одоогоор хөгжүүлэлт хийгдэж байна.",
                            });
                          }}
                        >
                          <Trash2 className="mr-2 h-4 w-4" /> 
                          Устгах
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

      {/* Footer info */}
      {filteredEmployees.length > 0 && (
        <div className="flex justify-between items-center text-sm text-muted-foreground">
          <p>Нийт {filteredEmployees.length} ажилтан</p>
          <p>Сүүлд шинэчлэгдсэн: {format(new Date(), "yyyy.MM.dd HH:mm")}</p>
        </div>
      )}
    </div>
  );
}
