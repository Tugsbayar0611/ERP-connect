import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, Loader2, UploadCloud, CheckCircle, XCircle } from "lucide-react";
import { format } from "date-fns";
import { mn } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

const formSchema = z.object({
    amount: z.coerce.number().min(1, "Дүн оруулна уу"),
    currency: z.string().min(1, "Валют сонгоно уу"),
    category: z.string().min(1, "Ангилал сонгоно уу"),
    expenseDate: z.date({
        required_error: "Зарцуулсан огноо сонгоно уу",
    }),
    description: z.string().min(5, "Тайлбар багадаа 5 тэмдэгт байх ёстой"),
    receiptUrl: z.string().optional(),
});

interface Props {
    onSuccess?: () => void;
    onCancel?: () => void;
}

export function ReimbursementRequestForm({ onSuccess, onCancel }: Props) {
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Upload state
    const [uploading, setUploading] = useState(false);
    const [receiptUrl, setReceiptUrl] = useState<string | null>(null);

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            amount: 0,
            currency: "MNT",
            category: "transport",
            description: "",
        },
    });

    const mutation = useMutation({
        mutationFn: async (values: z.infer<typeof formSchema>) => {
            const res = await fetch("/api/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: "reimbursement",
                    title: `Нөхөн олговор: ${values.category} - ${values.amount} ${values.currency}`,
                    payload: {
                        description: values.description,
                        startDate: values.expenseDate, // reuse startDate as expense date for sorting
                        endDate: values.expenseDate,
                        amount: values.amount,
                        currency: values.currency,
                        category: values.category,
                        expenseDate: values.expenseDate,
                        receiptUrl: values.receiptUrl
                    }
                }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to submit");
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
            toast({
                title: "Амжилттай",
                description: "Нөхөн олговрын хүсэлт илгээгдлээ.",
            });
            form.reset();
            onSuccess?.();
        },
        onError: (err) => {
            toast({
                title: "Алдаа",
                description: err.message,
                variant: "destructive",
            });
        },
    });

    function onSubmit(values: z.infer<typeof formSchema>) {
        mutation.mutate(values);
    }

    return (
        <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="amount"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Дүн</FormLabel>
                                <FormControl>
                                    <Input type="number" {...field} />
                                </FormControl>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="currency"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Валют</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Сонгох" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="MNT">₮ MNT</SelectItem>
                                        <SelectItem value="USD">$ USD</SelectItem>
                                        <SelectItem value="EUR">€ EUR</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <FormField
                        control={form.control}
                        name="category"
                        render={({ field }) => (
                            <FormItem>
                                <FormLabel>Ангилал</FormLabel>
                                <Select onValueChange={field.onChange} defaultValue={field.value}>
                                    <FormControl>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Сонгох" />
                                        </SelectTrigger>
                                    </FormControl>
                                    <SelectContent>
                                        <SelectItem value="transport">Тээвэр / Taxi</SelectItem>
                                        <SelectItem value="meal">Хоол</SelectItem>
                                        <SelectItem value="supplies">Албаны хэрэгцээ</SelectItem>
                                        <SelectItem value="accommodation">Буудал</SelectItem>
                                        <SelectItem value="other">Бусад</SelectItem>
                                    </SelectContent>
                                </Select>
                                <FormMessage />
                            </FormItem>
                        )}
                    />

                    <FormField
                        control={form.control}
                        name="expenseDate"
                        render={({ field }) => (
                            <FormItem className="flex flex-col">
                                <FormLabel>Огноо</FormLabel>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <FormControl>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full pl-3 text-left font-normal",
                                                    !field.value && "text-muted-foreground"
                                                )}
                                            >
                                                {field.value ? (
                                                    format(field.value, "PPP", { locale: mn })
                                                ) : (
                                                    <span>Огноо сонгох</span>
                                                )}
                                                <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                            </Button>
                                        </FormControl>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0" align="start">
                                        <Calendar
                                            mode="single"
                                            selected={field.value}
                                            onSelect={field.onChange}
                                            disabled={(date) =>
                                                date > new Date() || date < new Date("1900-01-01")
                                            }
                                            initialFocus
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FormMessage />
                            </FormItem>
                        )}
                    />
                </div>

                <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                        <FormItem>
                            <FormLabel>Тайлбар</FormLabel>
                            <FormControl>
                                <Textarea
                                    placeholder="Юунд зарцуулсан тухай дэлгэрэнгүй..."
                                    className="resize-none"
                                    {...field}
                                />
                            </FormControl>
                            <FormMessage />
                        </FormItem>
                    )}
                />

                {/* File Upload Section */}
                <div className="space-y-2">
                    <FormLabel>Баримт</FormLabel>
                    <div className="border-2 border-dashed rounded-lg p-6 text-center hover:bg-muted/50 transition-colors relative">
                        <input
                            type="file"
                            accept="image/png,image/jpeg,application/pdf"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                            disabled={uploading}
                            onChange={async (e) => {
                                const file = e.target.files?.[0];
                                if (!file) return;

                                // 1. Validation
                                const validTypes = ["image/png", "image/jpeg", "application/pdf"];
                                if (!validTypes.includes(file.type)) {
                                    toast({ title: "Алдаа", description: "Зөвхөн PNG, JPG, PDF файл оруулна уу", variant: "destructive" });
                                    return;
                                }
                                if (file.size > 10 * 1024 * 1024) {
                                    toast({ title: "Алдаа", description: "Файлын хэмжээ 10MB-аас ихгүй байна", variant: "destructive" });
                                    return;
                                }

                                // 2. Upload
                                setUploading(true);
                                try {
                                    const formData = new FormData();
                                    formData.append("file", file);

                                    const res = await fetch("/api/upload", {
                                        method: "POST",
                                        body: formData,
                                    });

                                    if (!res.ok) throw new Error("Upload failed");
                                    const data = await res.json();

                                    setReceiptUrl(data.url);
                                    form.setValue("receiptUrl", data.url);
                                    toast({ title: "Амжилттай", description: "Баримт хуулагдлаа" });
                                } catch (err) {
                                    console.error(err);
                                    toast({ title: "Алдаа", description: "Файл хуулахад алдаа гарлаа", variant: "destructive" });
                                } finally {
                                    setUploading(false);
                                }
                            }}
                        />

                        <div className="flex flex-col items-center justify-center gap-2 pointer-events-none">
                            {uploading ? (
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            ) : receiptUrl ? (
                                <div className="flex flex-col items-center">
                                    <CheckCircle className="w-8 h-8 text-green-500 mb-2" />
                                    <p className="text-sm font-medium text-green-700">Баримт амжилттай орсон</p>
                                    <p className="text-xs text-muted-foreground break-all max-w-[200px]">{receiptUrl.split('/').pop()}</p>
                                </div>
                            ) : (
                                <>
                                    <UploadCloud className="w-8 h-8 text-muted-foreground" />
                                    <div className="space-y-1">
                                        <p className="text-sm font-medium">Баримт оруулах</p>
                                        <p className="text-xs text-muted-foreground">PNG, JPG, PDF (max 10MB)</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    {receiptUrl && (
                        <div className="flex justify-end">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-500 h-8"
                                onClick={() => {
                                    setReceiptUrl(null);
                                    form.setValue("receiptUrl", undefined);
                                }}
                            >
                                <XCircle className="w-4 h-4 mr-2" />
                                Устгах
                            </Button>
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-4">
                    <Button variant="outline" type="button" onClick={onCancel}>
                        Болих
                    </Button>
                    <Button type="submit" disabled={mutation.isPending}>
                        {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Илгээх
                    </Button>
                </div>
            </form>
        </Form>
    );
}
