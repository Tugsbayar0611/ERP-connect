
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useDepartments } from "@/hooks/use-departments";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const jobTitleSchema = z.object({
    name: z.string().min(1, "Албан тушаалын нэр заавал"),
    code: z.string().min(1, "Код заавал").regex(/^[A-Z0-9_]+$/, "Том үсэг, доогуур зураас ашиглана (Жишээ: WAREHOUSE_KEEPER)"),
    departmentId: z.string().optional(),
});

type JobTitleFormValues = z.infer<typeof jobTitleSchema>;

interface AddJobTitleDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (jobTitleId: string) => void;
}

export function AddJobTitleDialog({ open, onOpenChange, onSuccess }: AddJobTitleDialogProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { departments = [] } = useDepartments();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<JobTitleFormValues>({
        resolver: zodResolver(jobTitleSchema),
        defaultValues: {
            name: "",
            code: "",
            departmentId: undefined,
        },
    });

    const createJobTitle = useMutation({
        mutationFn: async (data: JobTitleFormValues) => {
            const res = await fetch("/api/job-titles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...data, isActive: true }),
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Албан тушаал нэмэхэд алдаа гарлаа");
            }
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["/api/job-titles"] });
            toast({ title: "Амжилттай", description: `"${data.name}" албан тушаал нэмэгдлээ.` });
            form.reset();
            onOpenChange(false);
            if (onSuccess) onSuccess(data.id);
        },
        onError: (err: any) => {
            toast({
                title: "Алдаа",
                description: err.message,
                variant: "destructive",
            });
        },
    });

    const onSubmit = async (data: JobTitleFormValues) => {
        setIsSubmitting(true);
        try {
            await createJobTitle.mutateAsync(data);
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Шинэ албан тушаал нэмэх</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Албан тушаалын нэр</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Жишээ: Агуулахын нярав" {...field} />
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
                                        <Input placeholder="Жишээ: WAREHOUSE_KEEPER" {...field} />
                                    </FormControl>
                                    <FormDescription>Том үсэг, underscore ашиглана. Давхцахгүй.</FormDescription>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <FormField
                            control={form.control}
                            name="departmentId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Хэлтэс (заавал биш)</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Хэлтэс сонгох" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {departments.map((dept) => (
                                                <SelectItem key={dept.id} value={dept.id}>
                                                    {dept.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />

                        <DialogFooter className="pt-4">
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                                Цуцлах
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting ? "Хадгалах..." : "Хадгалах"}
                            </Button>
                        </DialogFooter>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
