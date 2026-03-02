
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow
} from "@/components/ui/table";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
    Search,
    Filter,
    Download,
    MoreHorizontal,
    Plus,
    FileText,
    ArrowUpDown,
    CreditCard,
    Calendar,
    Loader2
} from "lucide-react";
import { format } from "date-fns";
import { mn } from "date-fns/locale";

export default function PayrollOverview() {
    const [searchTerm, setSearchTerm] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [departmentFilter, setDepartmentFilter] = useState("all");

    const { data: payslips, isLoading } = useQuery<any[]>({
        queryKey: ["/api/payroll"],
    });

    // Calculate Summary Stats
    const totalPayroll = payslips?.reduce((sum: number, p: any) => sum + Number(p.netPay || 0), 0) || 0;
    const totalEmployees = new Set(payslips?.map((p: any) => p.employeeId)).size || 0;
    const averageSalary = totalEmployees > 0 ? totalPayroll / totalEmployees : 0;

    // Get unique departments for filter
    const uniqueDepartments = Array.from(new Set(payslips?.map((p: any) => p.employeeDepartmentId).filter(Boolean) || []));

    // Filter Data
    const filteredPayslips = payslips?.filter((p: any) => {
        const matchesSearch =
            (p.employeeFirstName?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (p.employeeLastName?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
            (p.employeeNo?.toLowerCase() || "").includes(searchTerm.toLowerCase());

        // Loose comparison for department filter as select values are strings
        // eslint-disable-next-line eqeqeq
        const matchesDept = departmentFilter === "all" || p.employeeDepartmentId == departmentFilter;

        const matchesStatus = statusFilter === "all" || p.status === statusFilter;

        return matchesSearch && matchesStatus && matchesDept;
    }) || [];

    const formatMoney = (amount: number) => {
        return new Intl.NumberFormat('mn-MN', { style: 'currency', currency: 'MNT', maximumFractionDigits: 0 }).format(amount);
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-screen"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
    }

    return (
        <div className="space-y-6 animate-scale-in pb-10">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                        Цалингийн бүртгэл
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Цалингийн түүх, тооцоолол болон тайлангууд
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button variant="outline">
                        <Download className="w-4 h-4 mr-2" />
                        Экспорт
                    </Button>
                    <Button className="bg-primary hover:bg-primary/90 text-white">
                        <Plus className="w-4 h-4 mr-2" />
                        Шинэ бодолт
                    </Button>
                </div>
            </div>

            {/* KPI Stats Row (Summary) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="glass-card border-l-4 border-l-green-500 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Нийт олгох цалин</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatMoney(totalPayroll)}</div>
                        <p className="text-xs text-green-600 mt-1 flex items-center">
                            <CreditCard className="w-3 h-3 mr-1" /> Батлагдсан дүн
                        </p>
                    </CardContent>
                </Card>
                <Card className="glass-card border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Цалин бодогдсон</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{totalEmployees} ажилтан</div>
                        <p className="text-xs text-blue-600 mt-1 flex items-center">
                            Нийт идэвхтэй ажилтнууд
                        </p>
                    </CardContent>
                </Card>
                <Card className="glass-card border-l-4 border-l-purple-500 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground">Дундаж цалин</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatMoney(averageSalary)}</div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Гарт олгох дундаж
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Main Table Card */}
            <Card className="glass-card shadow-md border-t-4 border-t-primary/20">
                <CardHeader className="pb-4 border-b">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="flex items-center gap-2 flex-1">
                            <div className="relative flex-1 max-w-sm">
                                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Ажилтан хайх (нэр, код)..."
                                    className="pl-9 bg-background/50"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>
                            <Select value={statusFilter} onValueChange={setStatusFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Төлөв" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Бүх төлөв</SelectItem>
                                    <SelectItem value="draft">Ноорог</SelectItem>
                                    <SelectItem value="paid">Олгосон</SelectItem>
                                </SelectContent>
                            </Select>

                            <Select value={departmentFilter} onValueChange={setDepartmentFilter}>
                                <SelectTrigger className="w-[180px]">
                                    <SelectValue placeholder="Хэлтэс" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Бүх хэлтэс</SelectItem>
                                    {uniqueDepartments.map((deptId: any) => (
                                        <SelectItem key={deptId} value={String(deptId)}>
                                            Хэлтэс {deptId}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            <Button variant="ghost" size="icon">
                                <Filter className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader>
                            <TableRow className="hover:bg-muted/50 bg-muted/20">
                                <TableHead>Ажилтан</TableHead>
                                <TableHead>Албан тушаал</TableHead>
                                <TableHead>Үе</TableHead>
                                <TableHead className="text-right">Үндсэн цалин</TableHead>
                                <TableHead className="text-right">Суутгал</TableHead>
                                <TableHead className="text-right">Гарт олгох</TableHead>
                                <TableHead className="text-center">Статус</TableHead>
                                <TableHead className="text-right">Үйлдэл</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredPayslips.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8} className="h-24 text-center">
                                        Өгөгдөл олдсонгүй
                                    </TableCell>
                                </TableRow>
                            ) : (
                                filteredPayslips.map((slip: any) => (
                                    <TableRow key={slip.id} className="group hover:bg-muted/50 transition-colors">
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase border border-primary/20">
                                                    {(slip.employeeFirstName?.[0] || "") + (slip.employeeLastName?.[0] || "")}
                                                </div>
                                                <div>
                                                    <p className="font-semibold text-sm">{slip.employeeFirstName} {slip.employeeLastName}</p>
                                                    <p className="text-[10px] text-muted-foreground">{slip.employeeNo}</p>
                                                </div>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-xs text-muted-foreground">{slip.employeePosition || "-"}</TableCell>
                                        <TableCell className="text-xs">
                                            {slip.periodStart ? format(new Date(slip.periodStart), "yyyy-MM", { locale: mn }) : "-"}
                                        </TableCell>
                                        <TableCell className="text-right font-medium">{formatMoney(Number(slip.grossPay))}</TableCell>
                                        <TableCell className="text-right text-red-500 text-xs">-{formatMoney(Number(slip.totalDeductions))}</TableCell>
                                        <TableCell className="text-right font-bold text-green-700 dark:text-green-400">{formatMoney(Number(slip.netPay))}</TableCell>
                                        <TableCell className="text-center">
                                            <Badge
                                                variant="outline"
                                                className={`${slip.status === 'paid'
                                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-200'
                                                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 border-yellow-200'
                                                    }`}
                                            >
                                                {slip.status === 'paid' ? 'Олгосон' : 'Ноорог'}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 opacity-0 group-hover:opacity-100">
                                                <MoreHorizontal className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))
                            )}
                        </TableBody>
                    </Table>

                    <div className="p-4 border-t flex items-center justify-between text-xs text-muted-foreground bg-muted/5">
                        <div>Нийт {filteredPayslips.length} илэрц</div>
                        <div className="flex gap-2">
                            <Button variant="outline" size="sm" disabled>Өмнөх</Button>
                            <Button variant="outline" size="sm" disabled>Дараах</Button>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
