
import React, { useState } from "react";
import { useShifts } from "@/hooks/use-roster";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus } from "lucide-react";

// Form Schema
const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    startMinutes: z.coerce.number().min(0).max(1439, "Must be between 0 and 1439"),
    endMinutes: z.coerce.number().min(0).max(1439, "Must be between 0 and 1439"),
});

// Helper to convert time "HH:mm" to minutes
const timeToMinutes = (time: string) => {
    const [h, m] = time.split(":").map(Number);
    return h * 60 + m;
};

// Helper to convert minutes to "HH:mm"
const minutesToTime = (minutes: number) => {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}`;
};

export default function ShiftsPage() {
    const { shiftsQuery, createShiftMutation } = useShifts();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            startMinutes: 480, // 08:00
            endMinutes: 1020, // 17:00
        },
    });

    // State for time inputs (controlled separately for better UX)
    const [startTime, setStartTime] = useState("08:00");
    const [endTime, setEndTime] = useState("17:00");

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        // Override minutes from time inputs
        const finalValues = {
            ...values,
            startMinutes: timeToMinutes(startTime),
            endMinutes: timeToMinutes(endTime)
        };

        createShiftMutation.mutate(finalValues, {
            onSuccess: () => {
                setIsDialogOpen(false);
                form.reset();
                setStartTime("08:00");
                setEndTime("17:00");
            },
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Ээлжийн төрөл</h2>
                    <p className="text-muted-foreground">Ээлжийн цагийн хуваарийн тохиргоо.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Шинэ төрөл</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Шинэ ээлжийн төрөл үүсгэх</DialogTitle>
                            <DialogDescription>Эхлэх болон дуусах цагийг тохируулна уу.</DialogDescription>
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Ээлжийн нэр</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Өдрийн ээлж 1" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-2 gap-4">
                                    <FormItem>
                                        <FormLabel>Эхлэх цаг</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="time"
                                                value={startTime}
                                                onChange={(e) => setStartTime(e.target.value)}
                                            />
                                        </FormControl>
                                    </FormItem>

                                    <FormItem>
                                        <FormLabel>Дуусах цаг</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="time"
                                                value={endTime}
                                                onChange={(e) => setEndTime(e.target.value)}
                                            />
                                        </FormControl>
                                    </FormItem>
                                </div>

                                {/* Note for Night Shift */}
                                <div className="text-xs text-muted-foreground p-2 bg-muted rounded">
                                    Хэрэв дуусах цаг эхлэх цагаас бага бол дараа өдөр дуусна гэж тооцогдоно (Шөнийн ээлж).
                                </div>

                                <DialogFooter>
                                    <Button type="submit" disabled={createShiftMutation.isPending}>
                                        {createShiftMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                        Үүсгэх
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </DialogContent>
                </Dialog>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Бүртгэлтэй төрлүүд</CardTitle>
                    <CardDescription>Тохируулсан ээлжийн жагсаалт.</CardDescription>
                </CardHeader>
                <CardContent>
                    {shiftsQuery.isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Нэр</TableHead>
                                    <TableHead>Эхлэх</TableHead>
                                    <TableHead>Дуусах</TableHead>
                                    <TableHead>Үргэлжлэх</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {shiftsQuery.data?.map((shift) => {
                                    const length = shift.endMinutes >= shift.startMinutes
                                        ? shift.endMinutes - shift.startMinutes
                                        : (1440 - shift.startMinutes) + shift.endMinutes;
                                    const hours = Math.floor(length / 60);
                                    const mins = length % 60;

                                    return (
                                        <TableRow key={shift.id}>
                                            <TableCell className="font-medium">{shift.name}</TableCell>
                                            <TableCell>{minutesToTime(shift.startMinutes)}</TableCell>
                                            <TableCell>{minutesToTime(shift.endMinutes)}</TableCell>
                                            <TableCell className="text-muted-foreground">
                                                {hours}h {mins > 0 ? `${mins}m` : ''}
                                                {shift.endMinutes < shift.startMinutes && <span className="ml-2 text-indigo-500 text-xs font-bold">NIGHT</span>}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
