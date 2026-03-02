
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Utensils, Moon, Sun, Wallet } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function ServeTerminal() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [confirmMeal, setConfirmMeal] = useState<{ type: string, price: number, name: string } | null>(null);

    // Employee Search Query
    const { data: employees = [], isLoading: isSearching } = useQuery({
        queryKey: ["/api/canteen/employees/search", search],
        queryFn: async () => {
            if (!search || search.length < 2) return [];
            const res = await fetch(`/api/canteen/employees/search?q=${search}`);
            if (!res.ok) throw new Error("Search failed");
            return res.json();
        },
        enabled: search.length >= 2,
    });

    // Serve Mutation
    const serveMutation = useMutation({
        mutationFn: async () => {
            if (!selectedEmployee || !confirmMeal) return;
            const res = await fetch("/api/canteen/serve", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId: selectedEmployee.id,
                    mealType: confirmMeal.type,
                    date: format(new Date(), "yyyy-MM-dd"), // Today
                    price: confirmMeal.price
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Serve failed");
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Амжилттай", description: `${confirmMeal?.name} олгогдлоо.` });
            setConfirmMeal(null);
            setSelectedEmployee(null); // Reset for next person
            setSearch(""); // Optional: clear search to force new entry
            // Invalidate search to refresh balances if needed, generally search again
            queryClient.invalidateQueries({ queryKey: ["/api/canteen/employees/search"] });
        },
        onError: (err: Error) => {
            toast({ title: "Алдаа", description: err.message, variant: "destructive" });
        }
    });

    const handleSelect = (emp: any) => {
        setSelectedEmployee(emp);
        setSearch("");
    };

    return (
        <div className="max-w-4xl mx-auto space-y-8 p-4">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Хоол олголт (Terminal)</h1>
                <p className="text-muted-foreground">Ажилтны код, нэр эсвэл утсаар хайж хоол олгох</p>
            </div>

            {/* Search Section */}
            <div className="relative">
                <Search className="absolute left-3 top-3 h-5 w-5 text-muted-foreground" />
                <Input
                    placeholder="Ажилтны нэр, код, утас..."
                    className="pl-10 h-14 text-lg"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    autoFocus
                />
            </div>

            {/* Search Results */}
            {search.length >= 2 && (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {isSearching ? (
                        <div className="col-span-full flex justify-center p-8">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    ) : employees.length === 0 ? (
                        <div className="col-span-full text-center text-muted-foreground p-8">
                            Илэрц олдсонгүй
                        </div>
                    ) : (
                        employees.map((emp: any) => (
                            <Card key={emp.id} className="cursor-pointer hover:border-primary transition-colors" onClick={() => handleSelect(emp)}>
                                <CardContent className="p-4 flex items-center gap-4">
                                    <Avatar className="h-12 w-12">
                                        <AvatarFallback>{emp.firstName[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <div className="font-bold">{emp.lastName?.substring(0, 1)}. {emp.firstName}</div>
                                        <div className="text-xs text-muted-foreground">{emp.employeeNo}</div>
                                    </div>
                                    <div className="ml-auto flex flex-col items-end">
                                        <div className={cn("font-mono font-bold", emp.wallet?.balance < 5000 ? "text-red-500" : "text-green-600")}>
                                            {emp.wallet?.balance?.toLocaleString()}₮
                                        </div>
                                        <div className="text-[10px] text-muted-foreground">Үлдэгдэл</div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>
            )}

            {/* Selected Employee & Actions */}
            {selectedEmployee && !search && (
                <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
                    <Card className="border-2 border-primary">
                        <CardHeader className="bg-muted/50 pb-4">
                            <div className="flex justify-between items-start">
                                <div>
                                    <CardTitle className="text-2xl">{selectedEmployee.lastName?.substring(0, 1)}. {selectedEmployee.firstName}</CardTitle>
                                    <CardDescription className="text-lg mt-1">{selectedEmployee.employeeNo} • {selectedEmployee.departmentId || "Department"}</CardDescription>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-muted-foreground mb-1">Дансны үлдэгдэл</div>
                                    <div className={cn("text-3xl font-bold font-mono", selectedEmployee.wallet?.balance < 5000 ? "text-red-500" : "text-primary")}>
                                        {selectedEmployee.wallet?.balance?.toLocaleString()}₮
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8">
                            <div className="grid grid-cols-2 gap-6">
                                <Button
                                    className="h-32 text-xl flex flex-col gap-2 bg-orange-100 text-orange-900 border-2 border-orange-200 hover:bg-orange-200 hover:border-orange-300"
                                    variant="outline"
                                    onClick={() => setConfirmMeal({ type: "lunch", price: 10000, name: "Өдрийн хоол" })}
                                >
                                    <Sun className="h-10 w-10 mb-2 text-orange-500" />
                                    Өдрийн хоол
                                    <span className="text-base font-normal opacity-70">10,000₮</span>
                                </Button>

                                <Button
                                    className="h-32 text-xl flex flex-col gap-2 bg-slate-100 text-slate-900 border-2 border-slate-200 hover:bg-slate-200 hover:border-slate-300"
                                    variant="outline"
                                    onClick={() => setConfirmMeal({ type: "dinner", price: 12000, name: "Оройн хоол" })}
                                >
                                    <Moon className="h-10 w-10 mb-2 text-slate-500" />
                                    Оройн хоол
                                    <span className="text-base font-normal opacity-70">12,000₮</span>
                                </Button>
                            </div>
                            <Button variant="ghost" className="w-full mt-6" onClick={() => setSelectedEmployee(null)}>
                                Буцах (Өөр хүн хайх)
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Confirmation Dialog */}
            <Dialog open={!!confirmMeal} onOpenChange={(open) => !open && setConfirmMeal(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Баталгаажуулах</DialogTitle>
                        <DialogDescription>
                            {selectedEmployee?.firstName} ажилтанд {confirmMeal?.name} олгох уу?
                        </DialogDescription>
                    </DialogHeader>

                    {confirmMeal && selectedEmployee && (
                        <div className="py-4 space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Одоогийн үлдэгдэл:</span>
                                <span>{selectedEmployee.wallet?.balance?.toLocaleString()}₮</span>
                            </div>
                            <div className="flex justify-between text-sm font-medium text-destructive">
                                <span>Хасагдах дүн:</span>
                                <span>- {confirmMeal.price.toLocaleString()}₮</span>
                            </div>
                            <div className="border-t pt-2 flex justify-between font-bold">
                                <span>Шинэ үлдэгдэл:</span>
                                <span className={(selectedEmployee.wallet?.balance - confirmMeal.price) < 0 ? "text-red-600" : "text-green-600"}>
                                    {(selectedEmployee.wallet?.balance - confirmMeal.price).toLocaleString()}₮
                                </span>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setConfirmMeal(null)}>Болих</Button>
                        <Button onClick={() => serveMutation.mutate()} disabled={serveMutation.isPending || !selectedEmployee || !confirmMeal}>
                            {serveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Батлах
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
