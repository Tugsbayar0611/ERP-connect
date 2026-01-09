import { useState } from "react";
import { useDepartments } from "@/hooks/use-departments";
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
import { Plus, Users, Pencil, Trash2, MoreHorizontal } from "lucide-react";
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

export default function Departments() {
  const { departments = [], isLoading, createDepartment, updateDepartment, deleteDepartment } = useDepartments();
  const { user } = useAuth();

  const isAdmin = user?.role === "Admin";

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<Department | null>(null);
  const { toast } = useToast();

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

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display">Хэлтэсүүд</h2>
          <p className="text-muted-foreground mt-1">Байгууллагын бүтцийг удирдах.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/25 hover:shadow-primary/30" onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Хэлтэс нэмэх
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
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
                        <Input placeholder="Жишээ: Хүний нөөц" {...field} value={field.value || ""} />
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
                      <FormLabel>Код</FormLabel>
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
                  className="w-full"
                  disabled={createDepartment.isPending || updateDepartment.isPending}
                >
                  {createDepartment.isPending || updateDepartment.isPending
                    ? "Хадгалагдаж байна..."
                    : editingDepartment
                      ? "Хадгалах"
                      : "Үүсгэх"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Хэлтсүүдийг ачааллаж байна...
          </div>
        ) : departments.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Хэлтэс бүртгэгдээгүй байна. Эхний хэлтсээ нэмнэ үү.
          </div>
        ) : (
          departments.map((dept) => (
            <Card
              key={dept.id}
              className="hover:shadow-lg hover:border-primary/50 transition-all duration-300 group relative overflow-hidden"
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  {dept.code && (
                    <span className="text-xs font-mono bg-primary/10 px-3 py-1 rounded-full text-primary font-semibold">
                      {dept.code}
                    </span>
                  )}
                </div>
                <CardTitle className="mt-6 text-xl">{dept.name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm text-muted-foreground">
                  {/* Remove isActive check as it's not in schema */}
                  Хэлтэс
                </div>
              </CardContent>

              {isAdmin && (
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm shadow-md hover:shadow-lg">
                        <MoreHorizontal className="w-5 h-5" />
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
                </div>
              )}
            </Card>
          ))
        )}
      </div>
    </div>
  );
}