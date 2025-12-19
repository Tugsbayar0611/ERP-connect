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
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Search, MoreHorizontal } from "lucide-react";
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
import { insertEmployeeSchema } from "@shared/schema";
import type { InsertEmployee } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

export default function Employees() {
  const { employees, isLoading, createEmployee } = useEmployees();
  const [search, setSearch] = useState("");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<InsertEmployee>({
    resolver: zodResolver(insertEmployeeSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      employeeCode: `EMP-${Math.floor(Math.random() * 10000)}`,
      position: "",
      personalEmail: "",
      phone: "",
      isActive: true,
    }
  });

  const onSubmit = async (data: InsertEmployee) => {
    try {
      await createEmployee.mutateAsync(data);
      toast({ title: "Success", description: "Employee created successfully" });
      setIsDialogOpen(false);
      form.reset();
    } catch (error) {
      toast({ title: "Error", description: "Failed to create employee", variant: "destructive" });
    }
  };

  const filteredEmployees = employees?.filter(emp =>
    emp.lastName.toLowerCase().includes(search.toLowerCase()) ||
    emp.firstName.toLowerCase().includes(search.toLowerCase()) ||
    emp.employeeCode.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display">Employees</h2>
          <p className="text-muted-foreground mt-1">Manage your organization's workforce.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/25 hover:shadow-primary/30">
              <Plus className="w-4 h-4 mr-2" />
              Add Employee
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Employee</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last Name</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="employeeCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Employee Code</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Position</FormLabel>
                        <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <FormField
                  control={form.control}
                  name="personalEmail"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl><Input type="email" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createEmployee.isPending}>
                  {createEmployee.isPending ? "Creating..." : "Create Employee"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex items-center gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <Search className="w-5 h-5 text-muted-foreground" />
        <Input
          placeholder="Search employees..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent"
        />
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Employee</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Contact</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8">Loading employees...</TableCell>
              </TableRow>
            ) : filteredEmployees?.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No employees found.</TableCell>
              </TableRow>
            ) : (
              filteredEmployees?.map((employee) => (
                <TableRow key={employee.id} className="group">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
                        {employee.firstName[0]}{employee.lastName[0]}
                      </div>
                      <div>
                        <div className="font-medium text-foreground">{employee.firstName} {employee.lastName}</div>
                        <div className="text-xs text-muted-foreground">{employee.employeeCode}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{employee.position || "—"}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm">{employee.personalEmail || "—"}</div>
                    <div className="text-xs text-muted-foreground">{employee.phone || "—"}</div>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {employee.hireDate ? format(new Date(employee.hireDate), "MMM d, yyyy") : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={employee.isActive ? "default" : "secondary"} className={employee.isActive ? "bg-green-100 text-green-700 hover:bg-green-200" : ""}>
                      {employee.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem>View Profile</DropdownMenuItem>
                        <DropdownMenuItem>Edit Details</DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive">Deactivate</DropdownMenuItem>
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
