import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle2, X as XIcon, Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useEmployees } from "@/hooks/use-employees";
import { Employee } from "@shared/schema";

// Format number as Mongolian Tugrik
const formatMNT = (value: number) => {
    return new Intl.NumberFormat('mn-MN', {
        style: 'decimal',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value) + '₮';
};

export function SalaryRequestsDialogContent({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient();
    const { employees = [] } = useEmployees();

    const { data: requests = [], isLoading } = useQuery({
        queryKey: ["/api/salary-advances", "pending"],
        queryFn: async () => {
            const res = await fetch("/api/salary-advances?status=pending", { credentials: "include" });
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
            queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
        },
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
        },
    });

    if (isLoading) {
        return (
            <div className="flex flex-col gap-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="flex items-center gap-4">
                        <Skeleton className="w-10 h-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Skeleton className="h-4 w-[150px]" />
                            <Skeleton className="h-3 w-[100px]" />
                        </div>
                        <Skeleton className="w-20 h-8" />
                    </div>
                ))}
            </div>
        );
    }

    if (requests.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-10 text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mb-3">
                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <h3 className="font-semibold text-lg">Бүх хүсэлт шийдвэрлэгдсэн</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-xs">
                    Одоогоор батлах хүлээгдэж буй урьдчилгаа эсвэл цалингийн хүсэлт алга байна.
                </p>
                <Button variant="outline" className="mt-4" onClick={onClose}>
                    Хаах
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {requests.map((request: any) => {
                const employee = employees.find((e: Employee) => e.id === request.employeeId);
                if (!employee) return null;

                return (
                    <Card key={request.id} className="overflow-hidden">
                        <div className="p-4 flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
                                {employee.lastName?.[0]}{employee.firstName?.[0]}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="font-semibold truncate">
                                        {(employee.lastName?.substring(0, 1) ?? "")}. {employee.firstName}
                                    </h4>
                                    <Badge variant="outline" className="ml-2 whitespace-nowrap">
                                        {formatMNT(request.amount)}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                    <Badge variant="secondary" className="px-1 py-0 text-[10px] h-4">
                                        Урьдчилгаа
                                    </Badge>
                                    <span>•</span>
                                    <span>{format(new Date(request.createdAt), "yyyy-MM-dd HH:mm")}</span>
                                </div>
                                {request.reason && (
                                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1 italic">
                                        "{request.reason}"
                                    </p>
                                )}
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => rejectMutation.mutate(request.id)}
                                    disabled={rejectMutation.isPending || approveMutation.isPending}
                                >
                                    <XIcon className="w-4 h-4" />
                                </Button>
                                <Button
                                    size="icon"
                                    className="h-8 w-8 bg-green-600 hover:bg-green-700"
                                    onClick={() => approveMutation.mutate(request.id)}
                                    disabled={rejectMutation.isPending || approveMutation.isPending}
                                >
                                    <Check className="w-4 h-4" />
                                </Button>
                            </div>
                        </div>
                    </Card>
                );
            })}
        </div>
    );
}
