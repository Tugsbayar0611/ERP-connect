
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { format } from "date-fns";
import { Loader2, Calendar as CalendarIcon, MapPin, Banknote } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// Types
interface FormProps {
    onSuccess?: () => void;
    onCancel?: () => void;
}

// Schema
const travelRequestSchema = z.object({
    destination: z.string().min(2, "Байршил дор хаяж 2 үсэгтэй байна"),
    dateRange: z.object({
        from: z.date({ required_error: "Эхлэх огноо сонгоно уу" }),
        to: z.date({ required_error: "Дуусах огноо сонгоно уу" }),
    }),
    purpose: z.string().min(10, "Томилолтын зорилго (дор хаяж 10 үсэг)"),
    budget: z.string().optional().refine((val) => !val || !isNaN(Number(val)), {
        message: "Төсөв зөв тоо байх ёстой",
    }),
});

type TravelRequestFormValues = z.infer<typeof travelRequestSchema>;

export function TravelRequestForm({ onSuccess, onCancel }: FormProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const form = useForm<TravelRequestFormValues>({
        resolver: zodResolver(travelRequestSchema),
        defaultValues: {
            destination: "",
            budget: "",
            purpose: "",
        }
    });

    const createMutation = useMutation({
        mutationFn: async (values: TravelRequestFormValues) => {
            const res = await fetch("/api/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "travel",
                    title: `Travel: ${values.destination}`, // Auto-generated title
                    payload: {
                        description: values.purpose,
                        startDate: values.dateRange.from.toISOString(),
                        endDate: values.dateRange.to.toISOString(),
                        destination: values.destination,
                        budget: values.budget ? Number(values.budget) : 0,
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
            toast({ title: "Амжилттай", description: "Томилолтын хүсэлт илгээгдлээ" });
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

    const onSubmit = (values: TravelRequestFormValues) => {
        createMutation.mutate(values);
    };

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">

                {/* Destination */}
                <FormField
                    control={form.control}
                    name="destination"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Байршил (Хаашаа)</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input placeholder="Жишээ: Дархан, Эрдэнэт..." className="pl-9" {...field} />
                                </div>
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Date Range */}
                <FormField
                    control={form.control}
                    name="dateRange"
                    render={({ field }) => (
                        <FormItem className="flex flex-col">
                            <FormLabel>Томилолтын хугацаа</FormLabel>
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
                                                    {format(field.value.from, "yyyy.MM.dd")} -{" "}
                                                    {format(field.value.to, "yyyy.MM.dd")}
                                                </>
                                            ) : (
                                                format(field.value.from, "yyyy.MM.dd")
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

                {/* Purpose */}
                <FormField
                    control={form.control}
                    name="purpose"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Томилолтын зорилго</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Жишээ: Харилцагчтай уулзах, гэрээ байгуулах..."
                                    className="resize-none min-h-[100px]"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* Budget (Optional) */}
                <FormField
                    control={form.control}
                    name="budget"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Урьдчилсан төсөв (₮)</FormLabel>
                            <FormControl>
                                <div className="relative">
                                    <Banknote className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                                    <Input type="number" placeholder="0" className="pl-9" {...field} />
                                </div>
                            </FormControl>
                            <FormDescription>
                                Шаардлагатай бол бөглөнө үү.
                            </FormDescription>
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
