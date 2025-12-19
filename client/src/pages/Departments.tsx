import { useState } from "react";
import { useDepartments } from "@/hooks/use-departments";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Users } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDepartmentSchema } from "@shared/schema";
import type { InsertDepartment } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

export default function Departments() {
  const { departments, isLoading, createDepartment } = useDepartments();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const { toast } = useToast();

  const form = useForm<InsertDepartment>({
    resolver: zodResolver(insertDepartmentSchema),
    defaultValues: {
      name: "",
      code: "",
      description: "",
      isActive: true,
    }
  });

  const onSubmit = async (data: InsertDepartment) => {
    try {
      await createDepartment.mutateAsync(data);
      toast({ title: "Success", description: "Department created successfully" });
      setIsDialogOpen(false);
      form.reset();
    } catch (error) {
      toast({ title: "Error", description: "Failed to create department", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display">Departments</h2>
          <p className="text-muted-foreground mt-1">Manage organizational structure.</p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/25">
              <Plus className="w-4 h-4 mr-2" />
              Add Department
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Department</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Department Name</FormLabel>
                      <FormControl><Input {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Code</FormLabel>
                      <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl><Textarea {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <Button type="submit" className="w-full" disabled={createDepartment.isPending}>
                  {createDepartment.isPending ? "Creating..." : "Create Department"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div>Loading...</div>
        ) : departments?.map((dept) => (
          <Card key={dept.id} className="hover:border-primary/50 transition-colors group cursor-pointer">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="p-2 bg-primary/5 rounded-lg group-hover:bg-primary/10 transition-colors">
                  <Users className="w-5 h-5 text-primary" />
                </div>
                {dept.code && (
                  <span className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground">{dept.code}</span>
                )}
              </div>
              <CardTitle className="mt-4">{dept.name}</CardTitle>
              <CardDescription>{dept.description || "No description provided."}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-sm text-muted-foreground flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${dept.isActive ? "bg-green-500" : "bg-gray-300"}`} />
                {dept.isActive ? "Active" : "Inactive"}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
