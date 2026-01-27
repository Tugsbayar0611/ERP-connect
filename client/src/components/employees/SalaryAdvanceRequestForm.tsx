import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { type Employee } from "@shared/schema";

const advanceFormSchema = z.object({
  amount: z.string().min(1, "Дүн оруулна уу"),
  reason: z.string().optional(),
  deductionType: z.enum(["monthly", "one-time"]),
  monthlyDeductionAmount: z.string().optional(),
  totalDeductionMonths: z.string().optional(),
  loanInterestRate: z.string().optional(),
});

export function SalaryAdvanceRequestForm({ employee, onClose }: { employee: Employee; onClose: () => void }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoan, setIsLoan] = useState(false);

  const form = useForm<z.infer<typeof advanceFormSchema>>({
    resolver: zodResolver(advanceFormSchema),
    defaultValues: {
      amount: "",
      reason: "",
      deductionType: "monthly",
      monthlyDeductionAmount: "",
      totalDeductionMonths: "",
      loanInterestRate: "",
    },
  });

  const deductionType = form.watch("deductionType");
  const amount = form.watch("amount");

  // Auto-calculate monthly deduction if amount and months are provided
  const totalDeductionMonths = form.watch("totalDeductionMonths");
  useEffect(() => {
    if (deductionType === "monthly" && amount && totalDeductionMonths) {
      const amt = Number(amount);
      const months = Number(totalDeductionMonths);
      if (amt > 0 && months > 0) {
        form.setValue("monthlyDeductionAmount", Math.round(amt / months).toString());
      }
    }
  }, [amount, deductionType, totalDeductionMonths, form]);

  const createAdvanceMutation = useMutation({
    mutationFn: async (data: z.infer<typeof advanceFormSchema>) => {
      const payload: any = {
        employeeId: employee.id,
        amount: Number(data.amount),
        reason: data.reason || null,
        deductionType: data.deductionType,
        isLoan: isLoan,
        status: "pending",
      };

      if (data.deductionType === "monthly") {
        if (data.monthlyDeductionAmount) {
          payload.monthlyDeductionAmount = Number(data.monthlyDeductionAmount);
        }
        if (data.totalDeductionMonths) {
          payload.totalDeductionMonths = Number(data.totalDeductionMonths);
        }
      }

      if (isLoan && data.loanInterestRate) {
        payload.loanInterestRate = Number(data.loanInterestRate);
      }

      const res = await fetch("/api/salary-advances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const error = await res.json().catch(() => ({}));
        throw new Error(error.message || "Урьдчилгаа хүсэхэд алдаа гарлаа");
      }

      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/salary-advances"] });
      toast({
        title: "Амжилттай",
        description: "Урьдчилгааны хүсэлт илгээгдлээ. Баталгаажуулалт хүлээж байна.",
      });
      onClose();
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Урьдчилгаа хүсэхэд алдаа гарлаа",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: z.infer<typeof advanceFormSchema>) => {
    if (data.deductionType === "monthly" && !data.monthlyDeductionAmount) {
      toast({
        title: "Алдаа",
        description: "Сар бүр хэдэн төгрөг хасахыг оруулна уу",
        variant: "destructive",
      });
      return;
    }
    createAdvanceMutation.mutate(data);
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-4">
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <p className="text-sm font-medium">Ажилтан: {employee.firstName} {employee.lastName}</p>
          <p className="text-xs text-muted-foreground">Код: {employee.employeeNo}</p>
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

        <FormField
          control={form.control}
          name="reason"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Шалтгаан</FormLabel>
              <FormControl>
                <Input {...field} placeholder="Урьдчилгаа авах шалтгаан" />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex items-center space-x-2">
          <input
            type="checkbox"
            id="isLoan"
            checked={isLoan}
            onChange={(e) => setIsLoan(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="isLoan" className="text-sm font-medium">
            Энэ нь урт хугацааны зээл (хүүтэй)
          </label>
        </div>

        {isLoan && (
          <FormField
            control={form.control}
            name="loanInterestRate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Хүүгийн хувь (%)</FormLabel>
                <FormControl>
                  <Input type="number" step="0.1" {...field} placeholder="1.5" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <FormField
          control={form.control}
          name="deductionType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Суутгалын төрөл *</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Суутгалын төрөл сонгох" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="monthly">Сар бүр тогтмол суутгал</SelectItem>
                  <SelectItem value="one-time">Нэг удаагийн суутгал</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        {deductionType === "monthly" && (
          <>
            <FormField
              control={form.control}
              name="totalDeductionMonths"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Хэдэн сар хасах *</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} placeholder="3" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="monthlyDeductionAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Сар бүр хэдэн төгрөг хасах *</FormLabel>
                  <FormControl>
                    <Input type="number" {...field} placeholder="Автоматаар тооцоолно" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </>
        )}

        <div className="flex justify-end gap-2 pt-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Цуцлах
          </Button>
          <Button type="submit" disabled={createAdvanceMutation.isPending}>
            {createAdvanceMutation.isPending ? "Илгээж байна..." : "Хүсэлт илгээх"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
