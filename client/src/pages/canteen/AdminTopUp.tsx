
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Wallet, ArrowUpCircle, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";

export default function AdminTopUp() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    const [selectedEmployee, setSelectedEmployee] = useState<any>(null);
    const [amount, setAmount] = useState("");
    const [note, setNote] = useState("Admin top-up");
    const [isConfirmOpen, setIsConfirmOpen] = useState(false);

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

    // Top-up Mutation
    const topUpMutation = useMutation({
        mutationFn: async () => {
            if (!selectedEmployee || !amount) return;
            const res = await fetch("/api/canteen/wallet/topup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId: selectedEmployee.id,
                    amount: parseInt(amount),
                    description: note
                })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Top-up failed");
            }
            return res.json();
        },
        onSuccess: () => {
            toast({ title: "Амжилттай", description: `Данс цэнэглэгдлээ: ${parseInt(amount).toLocaleString()}₮` });
            setIsConfirmOpen(false);
            setAmount("");
            setNote("Admin top-up");
            setSelectedEmployee(null); // Reset
            setSearch("");
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
                <h1 className="text-3xl font-bold tracking-tight">Цэнэглэлт (Admin)</h1>
                <p className="text-muted-foreground">Ажилтны хоолны эрхийг цэнэглэх</p>
            </div>

            {/* Search Section */}
            {!selectedEmployee && (
                <div className="space-y-4">
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
                                                <div className="font-mono font-bold text-primary">
                                                    {emp.wallet?.balance?.toLocaleString()}₮
                                                </div>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* Selected Employee & Top-up Form */}
            {selectedEmployee && (
                <div className="animate-in fade-in slide-in-from-bottom-4 space-y-6">
                    <Card className="border-2 border-primary/20">
                        <CardHeader className="bg-muted/30 pb-4">
                            <div className="flex justify-between items-start">
                                <div className="flex items-center gap-4">
                                    <Avatar className="h-16 w-16 border-2 border-background shadow-sm">
                                        <AvatarFallback className="text-xl">{selectedEmployee.firstName[0]}</AvatarFallback>
                                    </Avatar>
                                    <div>
                                        <CardTitle className="text-2xl">{selectedEmployee.lastName?.substring(0, 1)}. {selectedEmployee.firstName}</CardTitle>
                                        <CardDescription className="text-lg mt-1">{selectedEmployee.employeeNo} • {selectedEmployee.departmentId || "Department"}</CardDescription>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-muted-foreground mb-1">Одоогийн үлдэгдэл</div>
                                    <div className="text-3xl font-bold font-mono text-primary">
                                        {selectedEmployee.wallet?.balance?.toLocaleString()}₮
                                    </div>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent className="p-8 space-y-6">
                            <div className="grid gap-4 max-w-md mx-auto">
                                <div className="space-y-2">
                                    <Label>Цэнэглэх дүн (₮)</Label>
                                    <Input
                                        type="number"
                                        placeholder="Enter amount..."
                                        value={amount}
                                        onChange={(e) => setAmount(e.target.value)}
                                        className="text-lg h-12"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label>Тайлбар</Label>
                                    <Input
                                        placeholder="Transaction note..."
                                        value={note}
                                        onChange={(e) => setNote(e.target.value)}
                                    />
                                </div>

                                <div className="flex gap-2 pt-4">
                                    <Button variant="outline" className="flex-1" onClick={() => setSelectedEmployee(null)}>
                                        Буцах
                                    </Button>
                                    <Button
                                        className="flex-1 bg-green-600 hover:bg-green-700"
                                        onClick={() => setIsConfirmOpen(true)}
                                        disabled={!amount || parseInt(amount) <= 0}
                                    >
                                        <ArrowUpCircle className="mr-2 h-5 w-5" />
                                        Цэнэглэх
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}

            {/* Confirmation Dialog */}
            <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Цэнэглэлт баталгаажуулах</DialogTitle>
                        <DialogDescription>
                            Дараах цэнэглэлтийг хийх үү?
                        </DialogDescription>
                    </DialogHeader>

                    {selectedEmployee && amount && (
                        <div className="py-4 space-y-3 bg-muted/30 p-4 rounded-lg">
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Ажилтан:</span>
                                <span className="font-medium">{selectedEmployee.firstName} ({selectedEmployee.employeeNo})</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-muted-foreground">Одоогийн үлдэгдэл:</span>
                                <span>{selectedEmployee.wallet?.balance?.toLocaleString()}₮</span>
                            </div>
                            <div className="flex justify-between text-base font-bold text-green-600 border-t border-dashed border-green-200 pt-2">
                                <span>Нэмэгдэх дүн:</span>
                                <span>+ {parseInt(amount).toLocaleString()}₮</span>
                            </div>
                            <div className="flex justify-between font-bold pt-2 border-t mt-2">
                                <span>Шинэ үлдэгдэл:</span>
                                <span className="text-primary">
                                    {(selectedEmployee.wallet?.balance + parseInt(amount)).toLocaleString()}₮
                                </span>
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsConfirmOpen(false)}>Болих</Button>
                        <Button onClick={() => topUpMutation.mutate()} disabled={topUpMutation.isPending} className="bg-green-600 hover:bg-green-700">
                            {topUpMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Баталгаажуулах
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
