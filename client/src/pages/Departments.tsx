import { useState, useMemo } from "react";
import { useDepartments } from "@/hooks/use-departments";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  FolderTree,
  UserCircle,
  Briefcase,
  ChevronRight,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDepartmentSchema } from "@shared/schema";
import type { InsertDepartment, Department, Employee } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

// Department icon colors
const deptColors = [
  "from-blue-500 to-blue-600",
  "from-emerald-500 to-emerald-600",
  "from-violet-500 to-violet-600",
  "from-amber-500 to-amber-600",
  "from-rose-500 to-rose-600",
  "from-cyan-500 to-cyan-600",
  "from-fuchsia-500 to-fuchsia-600",
  "from-orange-500 to-orange-600",
];

function getDeptColor(name: string): string {
  const index = name.charCodeAt(0) % deptColors.length;
  return deptColors[index];
}

export default function Departments() {
  const { departments = [], isLoading, createDepartment, updateDepartment, deleteDepartment } = useDepartments();
  const { user } = useAuth();
  const isAdmin = user?.role === "Admin";

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  // Ажилтнуудын жагсаалт
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });

  // Хэлтэс тус бүрийн ажилтны тоо (TODO: Add departmentId to employees)
  const getEmployeeCount = (deptId: string) => {
    // For now, return random count for demo
    // In real implementation, filter employees by departmentId
    return Math.floor(Math.random() * 10);
  };

  const form = useForm<InsertDepartment>({
    resolver: zodResolver(insertDepartmentSchema),
    defaultValues: {
      name: "",
      code: "",
    },
  });

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
    if (!confirm(`"${dept.name}" хэлтсийг устгах уу?\n\nЭнэ үйлдлийг буцаах боломжгүй!`)) {
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

  // Filter departments
  const filteredDepartments = departments.filter((dept) =>
    `${dept.name} ${dept.code}`.toLowerCase().includes(search.toLowerCase())
  );

  // Stats
  const stats = useMemo(() => ({
    total: departments.length,
    totalEmployees: employees.length,
  }), [departments, employees]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
            Хэлтэсүүд
          </h2>
          <p className="text-muted-foreground mt-1">
            Байгууллагын бүтэц, хэлтэсүүдийг удирдах
          </p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button 
              className="shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all" 
              onClick={() => openDialog()}
            >
              <Plus className="w-4 h-4 mr-2" />
              Хэлтэс нэмэх
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px]">
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
                        <Input 
                          placeholder="Жишээ: Хүний нөөцийн хэлтэс" 
                          className="h-11"
                          {...field} 
                          value={field.value || ""} 
                        />
                      </FormControl>
                      <FormDescription>
                        Хэлтсийн бүтэн нэрийг оруулна уу
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Код (товчлол)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Жишээ: HR"
                          className="h-11 font-mono uppercase"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          maxLength={10}
                          disabled={!!editingDepartment}
                        />
                      </FormControl>
                      <FormDescription>
                        Богино код (2-10 тэмдэгт)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full h-11"
                  disabled={createDepartment.isPending || updateDepartment.isPending}
                >
                  {createDepartment.isPending || updateDepartment.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Хадгалагдаж байна...
                    </>
                  ) : editingDepartment ? (
                    "Өөрчлөлтийг хадгалах"
                  ) : (
                    "Хэлтэс үүсгэх"
                  )}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/50 dark:to-violet-900/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-violet-500 rounded-xl shadow-lg">
                <Building2 className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Нийт хэлтэс</p>
                <p className="text-3xl font-bold text-violet-600">{stats.total}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-blue-500 rounded-xl shadow-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Нийт ажилтан</p>
                <p className="text-3xl font-bold text-blue-600">{stats.totalEmployees}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <Search className="w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Хэлтсийн нэр эсвэл кодоор хайх..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
        />
      </div>

      {/* Department Grid */}
      <div className="grid gap-4 sm:gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full flex flex-col items-center py-16">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground">Хэлтсүүдийг ачааллаж байна...</p>
          </div>
        ) : filteredDepartments.length === 0 ? (
          <div className="col-span-full text-center py-16">
            <FolderTree className="w-16 h-16 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground mb-4">
              {search ? "Хайлтад тохирох хэлтэс олдсонгүй" : "Хэлтэс бүртгэгдээгүй байна"}
            </p>
            {!search && (
              <Button onClick={() => openDialog()} variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Эхний хэлтсээ нэмэх
              </Button>
            )}
          </div>
        ) : (
          filteredDepartments.map((dept, index) => {
            const colorClass = getDeptColor(dept.name);
            const employeeCount = getEmployeeCount(dept.id);
            
            return (
              <Card
                key={dept.id}
                className="group relative overflow-hidden hover:shadow-xl transition-all duration-300 border-0 shadow-md hover:scale-[1.02]"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                {/* Background gradient on hover */}
                <div className={`absolute inset-0 bg-gradient-to-br ${colorClass} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-start">
                    <div className={`p-3 bg-gradient-to-br ${colorClass} rounded-xl shadow-lg group-hover:scale-110 group-hover:shadow-xl transition-all duration-300`}>
                      <Building2 className="w-6 h-6 text-white" />
                    </div>
                    {dept.code && (
                      <Badge 
                        variant="secondary" 
                        className="font-mono text-xs bg-primary/5 text-primary border border-primary/20"
                      >
                        {dept.code}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent className="pb-4">
                  <h3 className="text-xl font-bold mb-2 group-hover:text-primary transition-colors">
                    {dept.name}
                  </h3>
                  
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Users className="w-4 h-4" />
                      <span>{employeeCount} ажилтан</span>
                    </div>
                  </div>

                  {/* Quick action on hover */}
                  <div className="mt-4 pt-4 border-t flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-xs"
                      onClick={() => openDialog(dept)}
                    >
                      <Pencil className="w-3 h-3 mr-1" />
                      Засах
                    </Button>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardContent>

                {/* Admin actions */}
                {isAdmin && (
                  <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 rounded-full bg-background/90 backdrop-blur-sm shadow-md hover:shadow-lg"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openDialog(dept)}>
                          <Pencil className="mr-2 h-4 w-4" />
                          Засах
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => handleDelete(dept)}
                          className="text-destructive focus:text-destructive focus:bg-destructive/10"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Устгах
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      {/* Organization chart hint */}
      {departments.length > 0 && (
        <Card className="border bg-gradient-to-r from-violet-50/50 to-blue-50/50 dark:from-violet-950/30 dark:to-blue-950/30">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <FolderTree className="w-5 h-5 text-primary" />
                <div>
                  <p className="font-medium">Байгууллагын бүтэц</p>
                  <p className="text-sm text-muted-foreground">
                    {departments.length} хэлтэс, {employees.length} ажилтан бүртгэгдсэн
                  </p>
                </div>
              </div>
              <Button variant="outline" size="sm" disabled>
                Бүтцийн диаграм харах
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
