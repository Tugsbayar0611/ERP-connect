import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useCompanySettings } from "@/hooks/use-company-settings";
import { insertCompanySettingsSchema } from "@shared/schema";
import type { InsertCompanySettings } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2, Clock, ShieldCheck } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import { z } from "zod";

const formSchema = insertCompanySettingsSchema.pick({
    workStartTime: true,
    workEndTime: true,
    lateThresholdMinutes: true,
    documentAccessPolicy: true,
});

type FormValues = z.infer<typeof formSchema>;

export function CompanySettings() {
    const { settings, isLoading, updateSettings } = useCompanySettings();

    const form = useForm<FormValues>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            workStartTime: "09:00",
            workEndTime: "18:00",
            lateThresholdMinutes: 0,
            documentAccessPolicy: "history",
        },
        values: settings ? {
            workStartTime: settings.workStartTime,
            workEndTime: settings.workEndTime,
            lateThresholdMinutes: settings.lateThresholdMinutes,
            documentAccessPolicy: settings.documentAccessPolicy,
        } : undefined,
    });

    function onSubmit(data: FormValues) {
        // Cast to any to bypass the mismatch with InsertCompanySettings which expects tenantId
        // The backend will handle the tenantId injection
        updateSettings.mutate(data as any);
    }

    if (isLoading) {
        return <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>;
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Ажлын цагийн тохиргоо
                </CardTitle>
                <CardDescription>
                    Байгууллагын нийт ажилтнуудын ажиллах цагийн хуваарь болон хоцролтын тохиргоо.
                </CardDescription>
            </CardHeader>
            <CardContent>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <FormField
                                control={form.control}
                                name="workStartTime"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ажил эхлэх цаг</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            Өглөө ажил эхлэх цаг (Жнь: 09:00)
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="workEndTime"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Ажил тарах цаг</FormLabel>
                                        <FormControl>
                                            <Input type="time" {...field} />
                                        </FormControl>
                                        <FormDescription>
                                            Орой ажил тарах цаг (Жнь: 18:00)
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="lateThresholdMinutes"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Хоцролт тооцохгүй хугацаа (минут)</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="number"
                                                {...field}
                                                onChange={e => field.onChange(parseInt(e.target.value))}
                                            />
                                        </FormControl>
                                        <FormDescription>
                                            Заасан цагаас хэдэн минут хэтэрвэл хоцорсонд тооцохгүй байх вэ? (Жнь: 15 минут)
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />

                            <FormField
                                control={form.control}
                                name="documentAccessPolicy"
                                render={({ field }) => (
                                    <FormItem>
                                        <div className="flex items-center gap-2 mb-2">
                                            <ShieldCheck className="w-4 h-4 text-primary" />
                                            <FormLabel>Баримт бичгийн хандах бодлого</FormLabel>
                                        </div>
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <FormControl>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Бодлого сонгох" />
                                                </SelectTrigger>
                                            </FormControl>
                                            <SelectContent>
                                                <SelectItem value="history">History (Түүхэн)</SelectItem>
                                                <SelectItem value="strict">Strict (Хатуу)</SelectItem>
                                            </SelectContent>
                                        </Select>
                                        <FormDescription>
                                            History: Тухайн баримтын хөдөлгөөнд оролцсон бүх хүн харна.
                                            Strict: Зөвхөн одоогийн эзэмшигч болон илгээгч харна.
                                        </FormDescription>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>

                        <Button type="submit" disabled={updateSettings.isPending}>
                            {updateSettings.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Хадгалах
                        </Button>
                    </form>
                </Form>
            </CardContent>
        </Card>
    );
}
