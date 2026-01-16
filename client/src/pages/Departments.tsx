import { useState } from "react";
import { useDepartments } from "@/hooks/use-departments";
import { useEmployees } from "@/hooks/use-employees";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { 
  Plus, 
  Users, 
  Pencil, 
  Trash2, 
  MoreHorizontal, 
  Building2, 
  Search,
  UserPlus,
  TrendingUp
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDepartmentSchema } from "@shared/schema";
import type { InsertDepartment, Department } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

export default function Departments() {
  const { departments = [], isLoading, createDepartment, updateDepartment, deleteDepartment } = useDepartments();
  const { employees = [] } = useEmployees();
  const { user } = useAuth();

  const isAdmin = user?.role === "Admin";

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const form = useForm<InsertDepartment>({
    resolver: zodResolver(insertDepartmentSchema),
    defaultValues: {
      name: "",
      code: "",
    },
  });

  // Get employee count by department
  const getEmployeeCount = (deptId: string) => {
    return employees.filter((e) => e.departmentId === deptId).length;
  };

  // Get employees in department
  const getDepartmentEmployees = (deptId: string) => {
    return employees.filter((e) => e.departmentId === deptId).slice(0, 5);
  };

  // Statistics
  const totalDepartments = departments.length;
  const totalEmployeesAssigned = employees.filter((e) => e.departmentId).length;
  const unassignedEmployees = employees.filter((e) => !e.departmentId).length;
  const avgEmployeesPerDept = totalDepartments > 0 ? Math.round(totalEmployeesAssigned / totalDepartments) : 0;

  // Filter departments by search
  const filteredDepartments = departments.filter((dept) =>
    `${dept.name} ${dept.code || ""}`.toLowerCase().includes(search.toLowerCase())
  );

  const openDialog = (dept?: Department) => {
    if (dept) {
      setEditingDepartment(dept);
      form.reset({
        name: dept.name,
        code: dept.code || "",
      });
    } else {
      setEditingDepartment(null);
      form.reset({
        name: "",
        code: "",
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: InsertDepartment) => {
    try {
      const payload = {
        ...data,
        code: data.code ? data.code.toUpperCase().trim() : "",
      };

      if (editingDepartment) {
        await updateDepartment.mutateAsync({ id: editingDepartment.id, data: payload });
        toast({ title: "Амжилттай", description: "Хэлтэс амжилттай засагдлаа." });
      } else {
        await createDepartment.mutateAsync(payload);
        toast({ title: "Амжилттай", description: "Хэлтэс амжилттай нэмэгдлээ." });
      }
      setIsDialogOpen(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Үйлдэл амжилтгүй боллоо",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (dept: Department) => {
    const employeeCount = getEmployeeCount(dept.id);
    if (employeeCount > 0) {
      toast({
        title: "Устгах боломжгүй",
        description: `${dept.name} хэлтэст ${employeeCount} ажилтан бүртгэлтэй байна. Эхлээд ажилтнуудыг шилжүүлнэ үү.`,
        variant: "destructive",
      });
      return;
    }

    if (!confirm(`${dept.name} хэлтсийг устгах уу? Энэ үйлдлийг буцаах боломжгүй!`)) {
      return;
    }

    try {
      await deleteDepartment.mutateAsync(dept.id);
      toast({ title: "Амжилттай", description: "Хэлтэс устгагдлаа." });
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Устгахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  // Color palette for department cards
  const getCardColor = (index: number) => {
    const colors = [
      "from-blue-500/20 to-blue-600/10",
      "from-purple-500/20 to-purple-600/10",
      "from-green-500/20 to-green-600/10",
      "from-orange-500/20 to-orange-600/10",
      "from-pink-500/20 to-pink-600/10",
      "from-cyan-500/20 to-cyan-600/10",
    ];
    return colors[index % colors.length];
  };

  const getIconColor = (index: number) => {
    const colors = [
      "text-blue-500 bg-blue-500/10",
      "text-purple-500 bg-purple-500/10",
      "text-green-500 bg-green-500/10",
      "text-orange-500 bg-orange-500/10",
      "text-pink-500 bg-pink-500/10",
      "text-cyan-500 bg-cyan-500/10",
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="space-y-6 animate-in-fade">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Хэлтэсүүд
          </h2>
          <p className="text-muted-foreground mt-1">
            Байгууллагын бүтэц, хэлтсүүдийн удирдлага
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="btn-premium" onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Хэлтэс нэмэх
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px] glass-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <Building2 className="w-5 h-5 text-primary" />
                {editingDepartment ? "Хэлтэс засах" : "Шинэ хэлтэс үүсгэх"}
              </DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Хэлтсийн нэр</FormLabel>
                      <FormControl>
                        <Input placeholder="Жишээ: Хүний нөөцийн хэлтэс" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Товч код</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Жишээ: HR"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          maxLength={10}
                          disabled={!!editingDepartment}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full btn-premium"
                  disabled={createDepartment.isPending || updateDepartment.isPending}
                >
                  {createDepartment.isPending || updateDepartment.isPending
                    ? "Хадгалагдаж байна..."
                    : editingDepartment
                      ? "Хадгалах"
                      : "Хэлтэс үүсгэх"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="stat-card glass-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Нийт хэлтэс
            </CardTitle>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-foreground">{totalDepartments}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Бүртгэгдсэн хэлтэсүүд
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card glass-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Хуваарилсан ажилтан
            </CardTitle>
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Users className="w-5 h-5 text-green-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">{totalEmployeesAssigned}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Хэлтэст хуваарилсан
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card glass-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Хуваарилаагүй
            </CardTitle>
            <div className="p-2 bg-yellow-500/10 rounded-lg">
              <UserPlus className="w-5 h-5 text-yellow-500" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-yellow-600">{unassignedEmployees}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Хэлтэсгүй ажилтнууд
            </p>
          </CardContent>
        </Card>

        <Card className="stat-card glass-card overflow-hidden">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Дундаж
            </CardTitle>
            <div className="p-2 bg-accent/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-accent" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-accent">{avgEmployeesPerDept}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Хэлтэс тутамд
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="glass-card rounded-xl p-1">
        <div className="flex items-center gap-4 p-3">
          <Search className="w-5 h-5 text-muted-foreground ml-2" />
          <Input
            placeholder="Хэлтсээр хайх (нэр, код)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent h-10 w-full"
          />
        </div>
      </div>

      {/* Department Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            <div className="flex flex-col items-center gap-3">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
              <p>Хэлтсүүдийг ачааллаж байна...</p>
            </div>
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <div className="flex flex-col items-center gap-4">
              <Building2 className="w-16 h-16 text-muted-foreground/30" />
              <div className="space-y-1">
                <p className="text-muted-foreground">
                  {search ? "Хайлтад тохирох хэлтэс олдсонгүй." : "Хэлтэс бүртгэгдээгүй байна."}
                </p>
                {!search && (
                  <p className="text-sm text-muted-foreground">Эхний хэлтсээ нэмж эхлэнэ үү.</p>
                )}
              </div>
              {!search && (
                <Button onClick={() => openDialog()} className="mt-2">
                  <Plus className="w-4 h-4 mr-2" />
                  Хэлтэс нэмэх
                </Button>
              )}
            </div>
          </div>
        ) : (
          filteredDepartments.map((dept, index) => {
            const employeeCount = getEmployeeCount(dept.id);
            const deptEmployees = getDepartmentEmployees(dept.id);

            return (
              <Card
                key={dept.id}
                className={`glass-card hover:shadow-xl hover:-translate-y-1 transition-all duration-300 group relative overflow-hidden animate-slide-up`}
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Gradient top bar */}
                <div className={`h-2 bg-gradient-to-r ${getCardColor(index)}`} />

                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className={`p-3 rounded-xl ${getIconColor(index)} transition-all group-hover:scale-110`}>
                      <Building2 className="w-6 h-6" />
                    </div>
                    <div className="flex items-center gap-2">
                      {dept.code && (
                        <Badge variant="outline" className="font-mono text-xs">
                          {dept.code}
                        </Badge>
                      )}
                      {isAdmin && (
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDialog(dept)}>
                              <Pencil className="mr-2 h-4 w-4" />
                              Засах
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => handleDelete(dept)}
                              className="text-destructive focus:text-destructive focus:bg-destructive/10"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Устгах
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </div>
                  </div>
                  <CardTitle className="text-xl mt-4">{dept.name}</CardTitle>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Employee count */}
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">Ажилтнууд</span>
                    </div>
                    <span className="text-xl font-bold">{employeeCount}</span>
                  </div>

                  {/* Employee avatars */}
                  {deptEmployees.length > 0 ? (
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Хэлтсийн гишүүд:</p>
                      <div className="flex -space-x-2">
                        {deptEmployees.map((emp, i) => (
                          <Avatar 
                            key={emp.id} 
                            className="w-8 h-8 border-2 border-background ring-1 ring-border"
                            style={{ zIndex: deptEmployees.length - i }}
                          >
                            <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-xs font-medium">
                              {emp.firstName[0]}{emp.lastName?.[0]}
                            </AvatarFallback>
                          </Avatar>
                        ))}
                        {employeeCount > 5 && (
                          <div className="w-8 h-8 rounded-full bg-muted border-2 border-background flex items-center justify-center text-xs font-medium text-muted-foreground">
                            +{employeeCount - 5}
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">
                      Ажилтан бүртгэгдээгүй байна
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
