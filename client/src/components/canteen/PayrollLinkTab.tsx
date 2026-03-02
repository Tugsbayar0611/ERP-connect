
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Loader2, RefreshCw, FileText, Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
    Table, TableBody, TableCell, TableHead, TableHeader, TableRow
} from "@/components/ui/table";
import {
    Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger
} from "@/components/ui/dialog";

export function PayrollLinkTab() {
    const [period, setPeriod] = useState<string>(format(new Date(), "yyyy-MM"));
    const { toast } = useToast();
    const [needsRegen, setNeedsRegen] = useState(false);

    // Listen for void events
    useEffect(() => {
        const handleVoid = () => setNeedsRegen(true);
        window.addEventListener('canteen-voided', handleVoid);
        return () => window.removeEventListener('canteen-voided', handleVoid);
    }, []);

    // 1. Staging Lines Query
    const { data: stagingLines, isLoading, refetch } = useQuery<any[]>({
        queryKey: ["canteen.admin.payroll-staging", period],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/canteen/admin/payroll-staging?period=${period}`);
            return res.json();
        }
    });

    // 2. Generate Mutation
    const generateMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/canteen/admin/generate-payroll", { period });
            return res.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Амжилттай",
                description: `${data.count} ажилтны суутгал үүсгэгдлээ.`
            });
            setNeedsRegen(false);
            refetch();
        },
        onError: (err: any) => {
            toast({
                title: "Алдаа",
                description: err.message,
                variant: "destructive"
            });
        }
    });

    // 3. Approve Mutation
    const approveMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/canteen/admin/approve-payroll", { period });
            return res.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Амжилттай",
                description: `${data.count} гүйлгээ батлагдлаа.`
            });
            refetch();
        },
        onError: (err: any) => {
            toast({
                title: "Алдаа",
                description: err.message,
                variant: "destructive"
            });
        }
    });

    const isApproved = stagingLines?.length ? stagingLines.every(l => l.status === 'approved' || l.status === 'posted') : false;
    const hasPending = stagingLines?.length ? stagingLines.some(l => l.status === 'pending') : false;

    return (
        <div className="space-y-4">
            {needsRegen && (
                <div className="bg-yellow-50 border-1 border-yellow-200 p-3 rounded flex items-center gap-2 text-yellow-800 text-sm">
                    <Filter className="w-4 h-4" />
                    Анхаар: Зарим хоолны захиалга цуцлагдсан тул суутгалыг дахин үүсгэх шаардлагатай байж болзошгүй.
                </div>
            )}

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <div>
                            <CardTitle>Цалингийн суутгал бэлтгэх</CardTitle>
                        </div>
                        <div className="flex gap-2 items-center">
                            <Input
                                type="month"
                                value={period}
                                onChange={e => setPeriod(e.target.value)}
                                className="w-40"
                            />

                            <Button variant="outline" onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending || isApproved}>
                                <RefreshCw className={`w-4 h-4 mr-2 ${generateMutation.isPending ? 'animate-spin' : ''}`} />
                                {generateMutation.isPending ? "Үүсгэж байна..." : "Тооцоолох"}
                            </Button>

                            {hasPending && (
                                <Dialog>
                                    <DialogTrigger asChild>
                                        <Button variant="default">Батлах</Button>
                                    </DialogTrigger>
                                    <DialogContent>
                                        <DialogHeader>
                                            <DialogTitle>Суутгал батлах</DialogTitle>
                                            <DialogDescription>
                                                Та {stagingLines?.filter(l => l.status === 'pending').length} ажилтны суутгалыг батлахдаа итгэлтэй байна уу?
                                                Батлагдсан суутгал Цалингийн модуль руу орох болно.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter>
                                            <Button onClick={() => approveMutation.mutate()} disabled={approveMutation.isPending}>
                                                {approveMutation.isPending ? "Уншиж байна..." : "Тийм, Баталгаажуулах"}
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="animate-spin" /></div>
                    ) : (
                        <div className="border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Огноо</TableHead>
                                        <TableHead>Ажилтан</TableHead>
                                        <TableHead>Тайлбар</TableHead>
                                        <TableHead>Дүн</TableHead>
                                        <TableHead>Төлөв</TableHead>
                                        <TableHead>Эх сурвалж</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {stagingLines?.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center h-24 text-muted-foreground">
                                                Өгөгдөл алга. Суутгал үүсгэнэ үү.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        stagingLines?.map((line, i) => (
                                            <TableRow key={i}>
                                                <TableCell>{line.period}</TableCell>
                                                <TableCell>{line.firstName} {line.lastName}</TableCell>
                                                <TableCell>{line.description}</TableCell>
                                                <TableCell className="font-mono">
                                                    {Math.abs(line.amount).toLocaleString()}₮
                                                </TableCell>
                                                <TableCell>
                                                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${line.status === 'approved' ? 'bg-green-100 text-green-700' :
                                                        line.status === 'posted' ? 'bg-blue-100 text-blue-700' :
                                                            'bg-yellow-100 text-yellow-700'
                                                        }`}>
                                                        {line.status}
                                                    </span>
                                                </TableCell>
                                                <TableCell className="text-xs text-muted-foreground">{line.sourceType}</TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
