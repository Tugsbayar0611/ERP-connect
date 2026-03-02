
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Route as RouteType, InsertRoute } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Map, Trash, ArrowRight } from "lucide-react";

export default function Routes() {
    const [isAddOpen, setIsAddOpen] = useState(false);
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const { data: routes = [], isLoading } = useQuery<RouteType[]>({
        queryKey: ["/api/transport/routes"],
    });

    const createMutation = useMutation({
        mutationFn: async (data: InsertRoute) => {
            const res = await fetch("/api/transport/routes", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/transport/routes"] });
            setIsAddOpen(false);
            toast({ title: "Амжилттай", description: "Чиглэл амжилттай бүртгэгдлээ." });
        },
        onError: (err) => {
            toast({ title: "Алдаа", description: err.message, variant: "destructive" });
        },
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/transport/routes/${id}`, {
                method: "DELETE",
            });
            if (!res.ok) throw new Error(await res.text());
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/transport/routes"] });
            toast({ title: "Амжилттай", description: "Чиглэл устгагдлаа." });
        },
    });

    const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        const formData = new FormData(e.currentTarget);
        const data: Partial<InsertRoute> = {
            code: formData.get("code") as string,
            name: formData.get("name") as string,
            fromLabel: formData.get("fromLabel") as string,
            toLabel: formData.get("toLabel") as string,
        };
        createMutation.mutate(data as InsertRoute);
    };

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Чиглэлийн жагсаалт</CardTitle>
                    <CardDescription>Автобусны явах маршрутууд</CardDescription>
                </div>
                <Button onClick={() => setIsAddOpen(true)}>
                    <Plus className="mr-2 h-4 w-4" /> Шинэ чиглэл
                </Button>
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <div className="flex justify-center p-8">
                        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                    </div>
                ) : (
                    <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Код</TableHead>
                                <TableHead>Нэр</TableHead>
                                <TableHead>Эхлэх</TableHead>
                                <TableHead>Дуусах</TableHead>
                                <TableHead className="text-right">Үйлдэл</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {routes.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={5} className="text-center text-muted-foreground p-8">
                                        Чиглэл бүртгэгдээгүй байна
                                    </TableCell>
                                </TableRow>
                            ) : (
                                routes.map((r) => (
                                    <TableRow key={r.id}>
                                        <TableCell>
                                            <span className="font-mono bg-muted px-2 py-1 rounded text-xs">{r.code}</span>
                                        </TableCell>
                                        <TableCell className="font-medium">{r.name}</TableCell>
                                        <TableCell>{r.fromLabel}</TableCell>
                                        <TableCell>{r.toLabel}</TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="icon" onClick={() => deleteMutation.mutate(r.id)}>
                                                <Trash className="h-4 w-4 text-destructive" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>
                )}
            </CardContent>

            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Шинэ чиглэл нэмэх</DialogTitle>
                        <DialogDescription>Чиглэлийн мэдээллийг оруулна уу.</DialogDescription>
                    </DialogHeader>
                    <form onSubmit={onSubmit} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="code">Код (Жишээ: R-01)</Label>
                            <Input id="code" name="code" required placeholder="R-01" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Чиглэлийн нэр</Label>
                            <Input id="name" name="name" required placeholder="Төв оффис - Зуслан" />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="fromLabel">Хаанаас</Label>
                                <Input id="fromLabel" name="fromLabel" required placeholder="Төв оффис" />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="toLabel">Хаашаа</Label>
                                <Input id="toLabel" name="toLabel" required placeholder="Зуслан" />
                            </div>
                        </div>

                        <DialogFooter>
                            <Button type="button" variant="outline" onClick={() => setIsAddOpen(false)}>Болих</Button>
                            <Button type="submit" disabled={createMutation.isPending}>
                                {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Нэмэх
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>
        </Card>
    );
}
