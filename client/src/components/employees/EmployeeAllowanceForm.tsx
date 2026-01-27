import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { type Employee } from "@shared/schema";

const formSchema = z.object({
  name: z.string().min(1, "Нэр оруулна уу"),
  code: z.string().min(1, "Код оруулна уу"), // LUNCH, TRANSPORT etc.
  amount: z.string().min(1, "Дүн оруулна уу"),
  isRecurring: z.boolean().default(true),
  isTaxable: z.boolean().default(true), // General flag
  isSHI: z.boolean().default(true),
  isPIT: z.boolean().default(true),
  effectiveFrom: z.string().min(1, "Эхлэх огноо"),
  effectiveTo: z.string().optional(),
});

export function EmployeeAllowanceForm({ employee, onSuccess, onCancel }: { employee: Employee; onSuccess: () => void; onCancel: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      code: "",
      amount: "",
      isRecurring: true,
      isTaxable: true,
      isSHI: true,
      isPIT: true,
      effectiveFrom: new Date().toISOString().split('T')[0],
    },
  });

  const onSubmit = async (data: z.infer<typeof formSchema>) => {
    try {
      const payload = {
        employeeId: employee.id,
        ...data,
        amount: Number(data.amount),
        effectiveTo: data.effectiveTo || null,
      };

      const res = await fetch("/api/employee-allowances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error("Failed to create allowance");

      queryClient.invalidateQueries({ queryKey: ["/api/employee-allowances", employee.id] });
      toast({ title: "Амжилттай", description: "Нэмэгдэл хадгалагдлаа." });
      onSuccess();
    } catch (error: any) {
      toast({
        title: "Алдаа",
        description: error.message || "Алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  // Preset allowance types for quick fill
  const handleTypeSelect = (type: string) => {
    switch (type) {
      case "lunch":
        form.setValue("name", "Хоолны мөнгө");
        form.setValue("code", "LUNCH");
        form.setValue("isSHI", false); // Usually exempt up to limit
        form.setValue("isPIT", false); // Usually exempt up to limit
        break;
      case "transport":
        form.setValue("name", "Унааны мөнгө");
        form.setValue("code", "TRANSPORT");
        form.setValue("isSHI", false);
        form.setValue("isPIT", false);
        break;
      case "phone":
        form.setValue("name", "Утасны хөнгөлөлт");
        form.setValue("code", "PHONE");
        break;
      case "bonus":
        form.setValue("name", "Урамшуулал");
        form.setValue("code", "BONUS");
        break;
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 border p-4 rounded-lg bg-card">
        <div className="flex gap-2 overflow-x-auto pb-2">
          <Badge variant="outline" className="cursor-pointer hover:bg-muted" onClick={() => handleTypeSelect("lunch")}>Хоол</Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-muted" onClick={() => handleTypeSelect("transport")}>Унаа</Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-muted" onClick={() => handleTypeSelect("phone")}>Утас</Badge>
          <Badge variant="outline" className="cursor-pointer hover:bg-muted" onClick={() => handleTypeSelect("bonus")}>Урамшуулал</Badge>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Нэр *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="Жишээ: Хоолны мөнгө" />
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
                <FormLabel>Код *</FormLabel>
                <FormControl>
                  <Input {...field} placeholder="CODE" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="amount"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Дүн (₮) *</FormLabel>
              <FormControl>
                <Input type="number" {...field} placeholder="0" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="isRecurring"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="h-4 w-4"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Сар бүр олгох</FormLabel>
                </div>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isTaxable"
            render={({ field }) => (
              <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4">
                <FormControl>
                  <input
                    type="checkbox"
                    checked={field.value}
                    onChange={field.onChange}
                    className="h-4 w-4"
                  />
                </FormControl>
                <div className="space-y-1 leading-none">
                  <FormLabel>Татвар тооцох</FormLabel>
                </div>
              </FormItem>
            )}
          />
        </div>

        {form.watch("isTaxable") && (
          <div className="flex gap-4 pl-2">
            <FormField
              control={form.control}
              name="isSHI"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2">
                  <FormControl>
                    <input type="checkbox" checked={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-normal">НДШ суутгах</FormLabel>
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="isPIT"
              render={({ field }) => (
                <FormItem className="flex items-center space-x-2">
                  <FormControl>
                    <input type="checkbox" checked={field.value} onChange={field.onChange} />
                  </FormControl>
                  <FormLabel className="font-normal">ХХОАТ суутгах</FormLabel>
                </FormItem>
              )}
            />
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="effectiveFrom"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Эхлэх огноо</FormLabel>
                <FormControl>
                  <Input type="date" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="effectiveTo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Дуусах огноо (Заавал биш)</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outline" onClick={onCancel}>Цуцлах</Button>
          <Button type="submit">Хадгалах</Button>
        </div>
      </form>
    </Form>
  );
}
