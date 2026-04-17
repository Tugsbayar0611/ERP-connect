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

const departmentSchema = z.object({
    name: z.string().min(1, "Хэлтсийн нэр заавал"),
    code: z.string().optional(),
});

type DepartmentFormValues = z.infer<typeof departmentSchema>;

interface AddDepartmentDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (departmentId: string) => void;
}

export function AddDepartmentDialog({ open, onOpenChange, onSuccess }: AddDepartmentDialogProps) {
    const { toast } = useToast();
    const { createDepartment } = useDepartments();
    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm<DepartmentFormValues>({
        resolver: zodResolver(departmentSchema),
        defaultValues: {
            name: "",
            code: "",
        },
    });

    const onSubmit = async (data: DepartmentFormValues) => {
        setIsSubmitting(true);
        try {
            const result = await createDepartment.mutateAsync(data);
            toast({ title: "Амжилттай", description: `"${result.name}" хэлтэс нэмэгдлээ.` });
            form.reset();
            onOpenChange(false);
            if (onSuccess) onSuccess(result.id);
        } catch (err: any) {
             toast({
                title: "Алдаа",
                description: err.message || "Хэлтэс нэмэхэд алдаа гарлаа",
                variant: "destructive",
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Шинэ хэлтэс нэмэх</DialogTitle>
                </DialogHeader>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Хэлтсийн нэр</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Жишээ: Санхүүгийн хэлтэс" {...field} />
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
                                    <FormLabel>Код (Сонголттой)</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Жишээ: FIN" {...field} />
                                    </FormControl>
                                    <FormDescription>Богино код оруулж болно</FormDescription>
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
