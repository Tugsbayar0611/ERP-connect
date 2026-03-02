import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEmployees } from "@/hooks/use-employees";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatMNT } from "@/lib/utils";
import { CheckCircle2, XCircle, Clock, ArrowLeft, CheckCircle } from "lucide-react";
import { useLocation } from "wouter";
import type { Employee } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export default function SalaryAdvances() {
    const [location, setLocation] = useLocation();
    const queryClient = useQueryClient();
    const { employees = [] } = useEmployees();
    const { toast } = useToast();

    // Get status filter from URL or default to pending
    const searchParams = new URLSearchParams(window.location.search);
    const statusFilter = searchParams.get("status") || "pending";

    const { data: requests = [], isLoading } = useQuery({
        queryKey: ["/api/salary-advances", statusFilter],
        queryFn: async () => {
            const res = await fetch(`/api/salary-advances?status=${statusFilter}`, { credentials: "include" });
            if (!res.ok) throw new Error("Failed to fetch requests");
            return res.json();
        },
    });

    const approveMutation = useMutation({
        mutationFn: async (id: number) => {
            await fetch(`/api/salary-advances/${id}/approve`, {
                method: "POST",
                credentials: "include",
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/salary-advances"] });
            queryClient.invalidateQueries({ queryKey: ["/api/stats"] }); // Update dashboard stats too
            toast({ title: "Амжилттай", description: "Хүсэлт батлагдлаа", variant: "success" });
        },
        onError: () => {
            toast({ title: "Алдаа", description: "Үйлдэл амжилтгүй боллоо", variant: "destructive" });
        }
    });

    const rejectMutation = useMutation({
        mutationFn: async (id: number) => {
            await fetch(`/api/salary-advances/${id}/reject`, {
                method: "POST",
                credentials: "include",
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/salary-advances"] });
            queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
            toast({ title: "Амжилттай", description: "Хүсэлт татгалзагдлаа", variant: "default" });
        },
        onError: () => {
            toast({ title: "Алдаа", description: "Үйлдэл амжилтгүй боллоо", variant: "destructive" });
        }
    });

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => setLocation("/")}>
                    <ArrowLeft className="w-5 h-5" />
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-display">Цалингийн урьдчилгаа хүсэлтүүд</h1>
                    <p className="text-muted-foreground">
                        {statusFilter === "pending" ? "Шийдвэрлэх хүлээгдэж буй" : "Шийдвэрлэгдсэн"} хүсэлтүүдийн жагсаалт
                    </p>
                </div>
            </div>

            <div className="flex gap-2 mb-4">
                <Button
                    variant={statusFilter === "pending" ? "default" : "outline"}
                    onClick={() => setLocation("/salary-advances?status=pending")}
                >
                    Хүлээгдэж буй
                </Button>
                <Button
                    variant={statusFilter === "approved" ? "default" : "outline"}
                    onClick={() => setLocation("/salary-advances?status=approved")}
                >
                    Зөвшөөрсөн
                </Button>
                <Button
                    variant={statusFilter === "rejected" ? "default" : "outline"}
                    onClick={() => setLocation("/salary-advances?status=rejected")}
                >
                    Татгалзсан
                </Button>
            </div>

            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map((i) => (
                        <Card key={i}>
                            <CardHeader className="flex flex-row items-center gap-4 pb-2">
                                <Skeleton className="w-12 h-12 rounded-full" />
                                <div className="space-y-2">
                                    <Skeleton className="h-4 w-32" />
                                    <Skeleton className="h-3 w-20" />
                                </div>
                            </CardHeader>
                            <CardContent>
                                <Skeleton className="h-8 w-24 mb-2" />
                                <Skeleton className="h-4 w-full" />
                            </CardContent>
                        </Card>
                    ))}
                </div>
            ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-xl bg-muted/20">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <CheckCircle className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="font-semibold text-lg">Хүсэлт алга байна</h3>
                    <p className="text-muted-foreground mt-1 max-w-sm">
                        {statusFilter === "pending"
                            ? "Одоогоор шийдвэрлэх хүсэлт байхгүй байна."
                            : "Энэ төлөвтэй хүсэлт олдсонгүй."}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {requests.map((request: any) => {
                        const employee = employees.find((e: Employee) => e.id === request.employeeId);
                        if (!employee) return null;

                        return (
                            <Card key={request.id} className="overflow-hidden hover:shadow-md transition-shadow">
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg">
                                                {employee.lastName?.[0] ?? ""}{employee.firstName?.[0] ?? ""}
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-lg">
                                                    {(employee.lastName?.[0] ?? "")}. {employee.firstName}
                                                </h4>
                                                <p className="text-sm text-muted-foreground">{employee.position || "Ажилтан"}</p>
                                            </div>
                                        </div>
                                        <Badge variant={statusFilter === "pending" ? "outline" : statusFilter === "approved" ? "default" : "destructive"}>
                                            {statusFilter === "pending" ? "Хүлээгдэж буй" : statusFilter === "approved" ? "Зөвшөөрсөн" : "Татгалзсан"}
                                        </Badge>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <p className="text-sm text-muted-foreground mb-1">Хүссэн дүн</p>
                                            <p className="text-2xl font-bold text-primary">{formatMNT(request.amount)}</p>
                                        </div>

                                        <div className="bg-muted/50 p-3 rounded-md text-sm">
                                            <p className="font-medium mb-1">Шалтгаан:</p>
                                            <p className="text-muted-foreground italic">"{request.reason || "Тайлбаргүй"}"</p>
                                        </div>

                                        {statusFilter === "pending" && (
                                            <div className="flex gap-3 pt-2">
                                                <Button
                                                    className="flex-1 bg-green-600 hover:bg-green-700"
                                                    onClick={() => approveMutation.mutate(request.id)}
                                                    disabled={approveMutation.isPending}
                                                >
                                                    {approveMutation.isPending ? "Уншиж байна..." : (
                                                        <>
                                                            <CheckCircle2 className="w-4 h-4 mr-2" />
                                                            Зөвшөөрөх
                                                        </>
                                                    )}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900 dark:hover:bg-red-950"
                                                    onClick={() => rejectMutation.mutate(request.id)}
                                                    disabled={rejectMutation.isPending}
                                                >
                                                    {rejectMutation.isPending ? "..." : (
                                                        <>
                                                            <XCircle className="w-4 h-4 mr-2" />
                                                            Татгалзах
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        )}

                                        {request.requestDate && (
                                            <div className="text-xs text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                {new Date(request.requestDate).toLocaleDateString()}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
