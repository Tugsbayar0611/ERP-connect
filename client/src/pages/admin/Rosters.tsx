
import React, { useState } from "react";
import { useRosters } from "@/hooks/use-roster";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { Loader2, Plus, Calendar, Settings2 } from "lucide-react";

const formSchema = z.object({
    name: z.string().min(1, "Name is required"),
    cycleDays: z.coerce.number().min(1).max(366, "Cycle must be between 1 and 366 days"),
});

export default function RostersPage() {
    const { rostersQuery, createRosterMutation } = useRosters();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const { toast } = useToast();

    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            cycleDays: 28, // Default to 28 days (standard 14/14)
        },
    });

    const onSubmit = (values: z.infer<typeof formSchema>) => {
        createRosterMutation.mutate(values, {
            onSuccess: () => {
                setIsDialogOpen(false);
                form.reset();
            },
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight">Ээлж төлөвлөлт</h2>
                    <p className="text-muted-foreground">Ээлжийн загвар болон мөчлөгийг удирдах.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button><Plus className="mr-2 h-4 w-4" /> Шинэ ээлж</Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Ээлж үүсгэх</DialogTitle>
                            <DialogDescription>Шинэ ээлжийн мөчлөгийг тодорхойлох (жишээ нь, 14/14).</DialogDescription>
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
                                                <Input placeholder="Хээрийн 14/14 А" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="cycleDays"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Мөчлөгийн урт (Хоног)</FormLabel>
                                            <FormControl>
                                                <Input type="number" {...field} />
                                            </FormControl>
                                            <div className="text-xs text-muted-foreground">
                                                Нийтлэг мөчлөгүүд: 28 хоног (14/14), 7 хоног (7 хоног бүр)
                                            </div>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <DialogFooter>
                                    <Button type="submit" disabled={createRosterMutation.isPending}>
                                        {createRosterMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
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
                    <CardTitle>Боломжит ээлжүүд</CardTitle>
                    <CardDescription>Ээлж бүрийн загварыг тохируулах.</CardDescription>
                </CardHeader>
                <CardContent>
                    {rostersQuery.isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Нэр</TableHead>
                                    <TableHead>Мөчлөг (Хоног)</TableHead>
                                    <TableHead className="text-right">Үйлдэл</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {rostersQuery.data?.map((roster) => (
                                    <TableRow key={roster.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="h-4 w-4 text-muted-foreground" />
                                                {roster.name}
                                            </div>
                                        </TableCell>
                                        <TableCell>{roster.cycleDays} days</TableCell>
                                        <TableCell className="text-right">
                                            <Link href={`/admin/rosters/${roster.id}/template`}>
                                                <Button variant="outline" size="sm">
                                                    <Settings2 className="mr-2 h-4 w-4" />
                                                    Загвар
                                                </Button>
                                            </Link>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
