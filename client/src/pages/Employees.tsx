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
import { Plus, Search, MoreHorizontal, Eye, Pencil } from "lucide-react";
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
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

export default function Employees() {
  const { employees = [], isLoading, createEmployee, updateEmployee } =
    useEmployees();
  const [search, setSearch] = useState("");
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
      hireDate: new Date().toISOString().split('T')[0], // Default today
    },
  });

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
      // Handle date string or Date object
      hireDate: employee.hireDate ? String(employee.hireDate).split('T')[0] : new Date().toISOString().split('T')[0],
    });
    setIsEditOpen(true);
  };

  const handleView = (employee: Employee) => {
    setSelectedEmployee(employee);
    setIsViewOpen(true);
  };

  const onSubmit = async (data: InsertEmployee) => {
    // Ensure numeric fields are strings/numbers as schema expects
    // Drizzle numeric is string in JS usually, but verify input
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
    `${emp.firstName} ${emp.lastName} ${emp.employeeNo}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display">
            Ажилтнууд
          </h2>
          <p className="text-muted-foreground mt-1">
            Таны байгууллагын ажилтнуудыг удирдах.
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
              {/* Нэр + Овог */}
              <div className="grid grid-cols-2 gap-4">
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

              {/* Код + Статус */}
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
                          <SelectItem value="termintated">Гарсан</SelectItem>
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

              {/* Ажилд орсон огноо + Үндсэн цалин */}
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
                  {selectedEmployee.firstName[0]}
                  {selectedEmployee.lastName?.[0]}
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

      {/* Search */}
      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <Search className="w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Ажилтнаар хайх (нэр, овог, код)..."
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
              <TableHead>Код</TableHead>
              <TableHead>Имэйл</TableHead>
              <TableHead>Ажилд орсон</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-12 text-muted-foreground"
                >
                  Ажилтнууд ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredEmployees.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={6}
                  className="text-center py-12 text-muted-foreground"
                >
                  {search
                    ? "Хайлтад тохирох ажилтан олдсонгүй."
                    : "Ажилтан бүртгэгдээгүй байна."}
                </TableCell>
              </TableRow>
            ) : (
              filteredEmployees.map((employee) => (
                <TableRow key={employee.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                        {employee.firstName[0]}
                        {employee.lastName?.[0]}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">
                          {employee.firstName} {employee.lastName}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {employee.employeeNo}
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">
                      {employee.email || "—"}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {employee.hireDate
                      ? format(new Date(employee.hireDate), "yyyy-MM-dd")
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={employee.status === 'active' ? "default" : "secondary"}>
                      {employee.status}
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
    </div>
  );
}