
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Loader2, Calendar as CalendarIcon } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// Types
interface FormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
}

// Schema
const leaveRequestSchema = z.object({
    type: z.enum(["vacation", "sick", "personal", "other"], {
        required_error: "Чөлөөний төрөл сонгоно уу",
    }),
    dateRange: z.object({
        from: z.date({ required_error: "Эхлэх огноо сонгоно уу" }),
        to: z.date({ required_error: "Дуусах огноо сонгоно уу" }),
    }),
    reason: z.string().min(5, "Чөлөө авах шалтгаан бичнэ үү (дор хаяж 5 үсэг)"),
});

type LeaveRequestFormValues = z.infer<typeof leaveRequestSchema>;

export function LeaveRequestForm({ onSuccess, onCancel }: FormProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const form = useForm<LeaveRequestFormValues>({
        resolver: zodResolver(leaveRequestSchema),
        defaultValues: {
            type: "vacation",
        }
    });

    const createMutation = useMutation({
        mutationFn: async (values: LeaveRequestFormValues) => {
            const res = await fetch("/api/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "leave",
                    title: `Leave: ${values.type}`,
                    payload: {
                        leaveType: values.type,
                        startDate: values.dateRange.from.toISOString(),
                        endDate: values.dateRange.to.toISOString(),
                        reason: values.reason,
                    }
                }),
            });
            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to submit request");
            }
            return res.json();
        },
        onSuccess: () => {
            // Safe predicate-based invalidation for all request queries
            const safeInvalidate = (prefix: string) => queryClient.invalidateQueries({
                predicate: (q) => Array.isArray(q.queryKey) && q.queryKey[0] === prefix
            });
            safeInvalidate('requests');         // All list views
            safeInvalidate('request');          // Detail views  
            safeInvalidate('request-timeline'); // Timeline
            queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] }); // Legacy
            toast({ title: "Амжилттай", description: "Чөлөөний хүсэлт илгээгдлээ" });
            onSuccess?.();
            form.reset();
        },
        onError: (error: Error) => {
            toast({
                title: "Алдаа",
                description: error.message,
                variant: "destructive"
            });
        }
    });

    const onSubmit = (values: LeaveRequestFormValues) => {
        createMutation.mutate(values);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                    control={form.control}
                    name="type"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Чөлөөний төрөл</FormLabel>
                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                <FormControl>
                                    <SelectTrigger>
                                        <SelectValue placeholder="Төрөл сонгоно уу" />
                                    </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                    <SelectItem value="vacation">🏖️ Ээлжийн амралт</SelectItem>
                                    <SelectItem value="sick">🤒 Өвчний чөлөө</SelectItem>
                                    <SelectItem value="personal">👤 Хувийн чөлөө</SelectItem>
                                    <SelectItem value="other">📝 Бусад</SelectItem>
                                </SelectContent>
                            </Select>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <FormField
                    control={form.control}
                    name="dateRange"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Хугацаа</FormLabel>
                            <Popover>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant={"outline"}
                                        className={cn(
                                            "w-full pl-3 text-left font-normal",
                                            !field.value && "text-muted-foreground"
                                        )}
                                    >
                                        {field.value?.from ? (
                                            field.value.to ? (
                                                <>
                                                    {format(field.value.from, "LLL dd, y")} -{" "}
                                                    {format(field.value.to, "LLL dd, y")}
                                                </>
                                            ) : (
                                                format(field.value.from, "LLL dd, y")
                                            )
                                        ) : (
                                            <span>Огноо сонгох</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="range"
                                        selected={field.value}
                                        onSelect={field.onChange}
                                        disabled={(date) =>
                                            date < new Date(new Date().setHours(0, 0, 0, 0))
                                        }
                                        initialFocus
                                    />
                                </PopoverContent>
                            </Popover>
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
                                <Textarea
                                    placeholder="Чөлөө авах дэлгэрэнгүй шалтгаан..."
                                    className="resize-none min-h-[100px]"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                <div className="flex justify-end gap-3 pt-4">
                    {onCancel && (
                        <Button type="button" variant="outline" onClick={onCancel}>
                            Болих
                        </Button>
                    )}
                    <Button type="submit" disabled={createMutation.isPending}>
                        {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                        Илгээх
                    </Button>
                </div>
            </form>
        </Form>
    );
}
