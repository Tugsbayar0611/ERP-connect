import * as React from "react";
import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import {
    Search,
    ArrowUpDown,
    ArrowDown,
    ArrowUp,
    Filter,
    Clock,
    Calculator,
    CheckCircle,
    CreditCard,
    FileText,
    Plus,
    MoreHorizontal,
    Users,
    Calendar,
    Download,
    Info,
    ChevronDown,
    ChevronUp,
    Eye,
    CheckSquare,
    Square,
    Layers
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useEmployees } from "@/hooks/use-employees";

// Status mapping: draft = pending (legacy alias)
type PayrollStatus = "pending" | "calculated" | "approved" | "paid";

const STATUS_CONFIG: Record<PayrollStatus, { label: string; color: string; icon: React.ElementType; bgClass: string }> = {
    pending: { label: "Хүлээгдэж буй", color: "text-gray-600 dark:text-gray-400", icon: Clock, bgClass: "bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700" },
    calculated: { label: "Тооцоолсон", color: "text-yellow-600 dark:text-yellow-400", icon: Calculator, bgClass: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-200 dark:border-yellow-800" },
    approved: { label: "Батлагдсан", color: "text-blue-600 dark:text-blue-400", icon: CheckCircle, bgClass: "bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800" },
    paid: { label: "Олгосон", color: "text-green-600 dark:text-green-400", icon: CreditCard, bgClass: "bg-green-100 dark:bg-green-900/30 border-green-200 dark:border-green-800" },
};

// Map legacy status to new status
function normalizeStatus(status: string | undefined): PayrollStatus {
    if (status === "draft") return "pending";
    if (status === "paid") return "paid";
    if (status === "calculated") return "calculated";
    if (status === "approved") return "approved";
    return "pending"; // default
}

interface Employee {
    id: string | number;
    firstName: string;
    lastName: string | null;
    position?: string | null;
    departmentId?: number | string | null;
    employeeNo?: string | null;
}

interface SalaryData {
    daysWorked: number;
    totalWorkingDays: number;
    lateDays: number;
    current?: { grossPay: number; netPay: number; totalDeductions: number };
    projected?: { netPay: number };
    breakdown?: { shi: number; pit: number; advances?: number; penalties?: number };
    advances?: { deductedThisMonth: number };
    status?: string;
    batchId?: number;
}

interface EnhancedSalaryCardProps {
    employee: Employee;
    salaryData: SalaryData | null;
    isSelected: boolean;
    onSelect: (id: string | number) => void;
    formatMNT: (amount: number) => string;
}

// KPI Summary Component
function KPISummary({ employees, salaryDataMap, formatMNT }: {
    employees: Employee[];
    salaryDataMap: Map<string | number, SalaryData | null>;
    formatMNT: (amount: number) => string;
}) {
    const stats = useMemo(() => {
        let totalNet = 0;
        let totalGross = 0;
        let totalDeductions = 0;
        let calculatedCount = 0;
        let incompleteAttendance = 0;

        employees.forEach(emp => {
            const data = salaryDataMap.get(emp.id);
            if (data?.current) {
                totalNet += Number(data.current.netPay) || 0;
                totalGross += Number(data.current.grossPay) || 0;
                totalDeductions += Number(data.current.totalDeductions) || 0;
                const status = normalizeStatus(data.status);
                if (status !== "pending") calculatedCount++;
                if (data.daysWorked < data.totalWorkingDays) incompleteAttendance++;
            }
        });

        return { totalNet, totalGross, totalDeductions, calculatedCount, total: employees.length, incompleteAttendance };
    }, [employees, salaryDataMap]);

    return (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 p-3 rounded-lg bg-gradient-to-r from-primary/5 to-accent/5 border mb-4">
            <div className="text-center">
                <p className="text-xs text-muted-foreground">Нийт Net</p>
                <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatMNT(stats.totalNet)}</p>
            </div>
            <div className="text-center">
                <p className="text-xs text-muted-foreground">Нийт Gross</p>
                <p className="text-lg font-bold">{formatMNT(stats.totalGross)}</p>
            </div>
            <div className="text-center">
                <p className="text-xs text-muted-foreground">Нийт суутгал</p>
                <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatMNT(stats.totalDeductions)}</p>
            </div>
            <div className="text-center">
                <p className="text-xs text-muted-foreground">Тооцоолсон</p>
                <p className="text-lg font-bold">{stats.calculatedCount} / {stats.total}</p>
            </div>
            <div className="text-center">
                <p className="text-xs text-muted-foreground">Дутуу ирц</p>
                <p className="text-lg font-bold text-amber-600 dark:text-amber-400">{stats.incompleteAttendance}</p>
            </div>
        </div>
    );
}

// Enhanced Salary Card Component
function EnhancedSalaryCard({ employee, salaryData, isSelected, onSelect, formatMNT }: EnhancedSalaryCardProps) {
    const [, setLocation] = useLocation();
    const status = normalizeStatus(salaryData?.status);
    const statusConfig = STATUS_CONFIG[status];
    const StatusIcon = statusConfig.icon;

    const currentNet = Number(salaryData?.current?.netPay) || 0;
    const currentGross = Number(salaryData?.current?.grossPay) || 0;
    const totalDeductions = Number(salaryData?.current?.totalDeductions) || 0;
    const shi = Number(salaryData?.breakdown?.shi) || 0;
    const pit = Number(salaryData?.breakdown?.pit) || 0;
    const advances = Number(salaryData?.breakdown?.advances) || Number(salaryData?.advances?.deductedThisMonth) || 0;
    const penalties = Number(salaryData?.breakdown?.penalties) || 0;
    const projectedNet = Number(salaryData?.projected?.netPay) || 0;
    const daysWorked = salaryData?.daysWorked || 0;
    const totalDays = salaryData?.totalWorkingDays || 22;
    const lateDays = salaryData?.lateDays || 0;
    const isLate = lateDays > 0;
    const progressPercent = totalDays > 0 ? (daysWorked / totalDays) * 100 : 0;

    // Zero amount card
    const isZeroAmount = currentNet === 0 && currentGross === 0;

    // Deductions have value
    const hasDeductions = totalDeductions > 0;

    // Build deduction tooltip
    const deductionDetails = [
        shi > 0 && `НДШ: ${formatMNT(shi)}`,
        pit > 0 && `ХХОАТ: ${formatMNT(pit)}`,
        advances > 0 && `Урьдчилгаа: ${formatMNT(advances)}`,
        penalties > 0 && `Торгууль: ${formatMNT(penalties)}`,
    ].filter(Boolean).join("\n");

    // Smart actions based on status
    const renderActions = () => {
        switch (status) {
            case "pending":
                return (
                    <>
                        <Button size="sm" className="flex-1 text-xs h-7" onClick={() => setLocation(`/payroll?action=calculate&employeeId=${employee.id}`)}>
                            <Calculator className="w-3 h-3 mr-1" />
                            Тооцоолох
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => setLocation(`/employees/${employee.id}`)}>
                            <Eye className="w-3 h-3 mr-1" />
                            Дэлгэрэнгүй
                        </Button>
                    </>
                );
            case "calculated":
                return (
                    <>
                        <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => setLocation(`/payroll?employeeId=${employee.id}`)}>
                            <FileText className="w-3 h-3 mr-1" />
                            Payslip
                        </Button>
                        <Button size="sm" className="flex-1 text-xs h-7" onClick={() => setLocation(`/payroll?action=create&employeeId=${employee.id}`)}>
                            <Plus className="w-3 h-3 mr-1" />
                            Batch-д нэмэх
                        </Button>
                    </>
                );
            case "approved":
                return (
                    <>
                        <Button size="sm" className="flex-1 text-xs h-7" onClick={() => setLocation(`/payroll?action=pay&employeeId=${employee.id}`)}>
                            <CreditCard className="w-3 h-3 mr-1" />
                            Шилжүүлэх
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1 text-xs h-7" onClick={() => setLocation(`/payroll?employeeId=${employee.id}`)}>
                            <FileText className="w-3 h-3 mr-1" />
                            Payslip
                        </Button>
                    </>
                );
            case "paid":
                return (
                    <Button size="sm" variant="outline" className="w-full text-xs h-7" onClick={() => setLocation(`/payroll?employeeId=${employee.id}`)}>
                        <Download className="w-3 h-3 mr-1" />
                        Payslip татах
                    </Button>
                );
        }
    };

    return (
        <Card className={cn(
            "relative group hover:shadow-md transition-all",
            isZeroAmount && "opacity-60",
            isSelected && "ring-2 ring-primary"
        )}>
            {/* Selection Checkbox */}
            <div
                className="absolute top-2 left-2 z-10"
                onClick={(e) => { e.stopPropagation(); onSelect(employee.id); }}
            >
                {isSelected ? (
                    <CheckSquare className="w-5 h-5 text-primary cursor-pointer" />
                ) : (
                    <Square className="w-5 h-5 text-muted-foreground/50 cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity" />
                )}
            </div>

            <CardContent className="p-4 pt-3">
                {/* Header: Name + Status + More Menu */}
                <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0 pl-6">
                        <p className="text-sm font-semibold truncate">{employee.firstName} {employee.lastName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                            {employee.position || "Албан тушаал"} • {employee.employeeNo || ""}
                        </p>
                    </div>
                    <div className="flex items-center gap-1">
                        {/* Status Pill */}
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0.5", statusConfig.bgClass, statusConfig.color)}>
                            <StatusIcon className="w-3 h-3 mr-0.5" />
                            {statusConfig.label}
                        </Badge>
                        {/* Attendance Badge */}
                        <Badge variant={isLate ? "destructive" : "secondary"} className="text-[10px] px-1.5 py-0.5">
                            {daysWorked}/{totalDays}
                        </Badge>
                        {/* More Menu */}
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="icon" className="h-6 w-6">
                                    <MoreHorizontal className="w-3 h-3" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setLocation(`/employees?id=${employee.id}`)}>
                                    <Users className="w-3 h-3 mr-2" /> Ажилтны дэлгэрэнгүй
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setLocation(`/attendance?employeeId=${employee.id}&month=${format(new Date(), "yyyy-MM")}`)}>
                                    <Calendar className="w-3 h-3 mr-2" /> Энэ сарын ирц
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => setLocation(`/payroll?employeeId=${employee.id}&month=${format(new Date(), "yyyy-MM")}`)}>
                                    <FileText className="w-3 h-3 mr-2" /> Энэ сарын цалингийн тайлан
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </div>

                {/* Main Amount */}
                <div className="text-2xl font-bold mb-2">
                    {formatMNT(currentNet)}
                </div>

                {/* Gross / Net / Deduction breakdown */}
                <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
                    <div className="p-1.5 rounded bg-green-50 dark:bg-green-950/30 border border-green-200/50 dark:border-green-800/50">
                        <p className="text-[10px] text-muted-foreground">Gross</p>
                        <p className="font-semibold text-green-700 dark:text-green-300">{formatMNT(currentGross)}</p>
                    </div>
                    <div className="p-1.5 rounded bg-blue-50 dark:bg-blue-950/30 border border-blue-200/50 dark:border-blue-800/50">
                        <p className="text-[10px] text-muted-foreground">Net</p>
                        <p className="font-semibold text-blue-700 dark:text-blue-300">{formatMNT(currentNet)}</p>
                    </div>
                </div>

                {/* Deductions Block with Tooltip */}
                {hasDeductions && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <div className="mb-2 p-2 rounded bg-orange-50 dark:bg-orange-950/30 border border-orange-200/50 dark:border-orange-800/50 cursor-help">
                                    <div className="flex items-center justify-between">
                                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                                            Суутгал <Info className="w-3 h-3" />
                                        </span>
                                        <span className="text-sm font-semibold text-orange-700 dark:text-orange-300">
                                            {formatMNT(totalDeductions)}
                                        </span>
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[200px]">
                                <p className="text-xs whitespace-pre-line">{deductionDetails || "Суутгал байхгүй"}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}

                {/* Progress Bar */}
                <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                        className={cn("h-full transition-all", isLate ? "bg-orange-500" : "bg-primary")}
                        style={{ width: `${progressPercent}%` }}
                    />
                </div>

                {/* Projected amount */}
                {projectedNet > currentNet && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                        Төлөвлөсөн: {formatMNT(projectedNet)}
                    </div>
                )}

                {/* Smart Actions */}
                <div className="flex gap-2 mt-3">
                    {renderActions()}
                </div>
            </CardContent>
        </Card>
    );
}

// Main Component
export function EnhancedSalaryCardsSection() {
    const [, setLocation] = useLocation();
    const { employees = [], isLoading: employeesLoading } = useEmployees();
    const currentMonth = format(new Date(), "yyyy-MM");

    // States
    const [searchQuery, setSearchQuery] = useState("");
    const [sortBy, setSortBy] = useState<"net" | "gross" | "attendance" | "status">("net");
    const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
    const [statusFilter, setStatusFilter] = useState<"all" | PayrollStatus>("all");
    const [attendanceFilter, setAttendanceFilter] = useState<"all" | "full" | "partial" | "late">("all");
    const [hideZero, setHideZero] = useState(false);
    const [selectedIds, setSelectedIds] = useState<Set<string | number>>(new Set());
    const [zeroCollapsed, setZeroCollapsed] = useState(true);

    // Fetch salary data for all employees
    const { data: salaryDataMap = new Map(), isLoading: salaryLoading } = useQuery({
        queryKey: ["/api/employees/realtime-salary-batch", currentMonth],
        queryFn: async () => {
            const map = new Map<string | number, SalaryData | null>();
            // Fetch in parallel for all employees
            const promises = employees.map(async (emp) => {
                try {
                    const res = await fetch(`/api/employees/${emp.id}/realtime-salary?month=${currentMonth}`, { credentials: "include" });
                    if (res.ok) {
                        const data = await res.json();
                        map.set(emp.id, data);
                    } else {
                        map.set(emp.id, null);
                    }
                } catch {
                    map.set(emp.id, null);
                }
            });
            await Promise.all(promises);
            return map;
        },
        enabled: employees.length > 0,
        refetchInterval: 2 * 60 * 1000,
    });

    const formatMNT = (amount: number) => {
        return new Intl.NumberFormat("mn-MN", { style: "currency", currency: "MNT", maximumFractionDigits: 0 }).format(amount);
    };

    // Filter & Sort
    const processedEmployees = useMemo(() => {
        let result = [...employees];

        // Search
        if (searchQuery) {
            const q = searchQuery.toLowerCase();
            result = result.filter(emp =>
                emp.firstName?.toLowerCase().includes(q) ||
                emp.lastName?.toLowerCase().includes(q) ||
                emp.position?.toLowerCase().includes(q) ||
                emp.employeeNo?.toLowerCase().includes(q)
            );
        }

        // Status filter
        if (statusFilter !== "all") {
            result = result.filter(emp => {
                const data = salaryDataMap.get(emp.id);
                return normalizeStatus(data?.status) === statusFilter;
            });
        }

        // Attendance filter
        if (attendanceFilter !== "all") {
            result = result.filter(emp => {
                const data = salaryDataMap.get(emp.id);
                if (!data) return false;
                const percent = data.totalWorkingDays > 0 ? (data.daysWorked / data.totalWorkingDays) * 100 : 0;
                if (attendanceFilter === "full") return percent >= 100;
                if (attendanceFilter === "partial") return percent > 0 && percent < 100;
                if (attendanceFilter === "late") return (data.lateDays || 0) > 0;
                return true;
            });
        }

        // Sort
        result.sort((a, b) => {
            const dataA = salaryDataMap.get(a.id);
            const dataB = salaryDataMap.get(b.id);
            let valA = 0, valB = 0;

            if (sortBy === "net") {
                valA = Number(dataA?.current?.netPay) || 0;
                valB = Number(dataB?.current?.netPay) || 0;
            } else if (sortBy === "gross") {
                valA = Number(dataA?.current?.grossPay) || 0;
                valB = Number(dataB?.current?.grossPay) || 0;
            } else if (sortBy === "attendance") {
                valA = dataA ? (dataA.daysWorked / (dataA.totalWorkingDays || 1)) * 100 : 0;
                valB = dataB ? (dataB.daysWorked / (dataB.totalWorkingDays || 1)) * 100 : 0;
            } else if (sortBy === "status") {
                const order = { pending: 0, calculated: 1, approved: 2, paid: 3 };
                valA = order[normalizeStatus(dataA?.status)] || 0;
                valB = order[normalizeStatus(dataB?.status)] || 0;
            }

            return sortDir === "desc" ? valB - valA : valA - valB;
        });

        return result;
    }, [employees, searchQuery, statusFilter, attendanceFilter, sortBy, sortDir, salaryDataMap]);

    // Separate zero-amount employees
    const { nonZeroEmployees, zeroEmployees } = useMemo(() => {
        const nonZero: Employee[] = [];
        const zero: Employee[] = [];

        processedEmployees.forEach(emp => {
            const data = salaryDataMap.get(emp.id);
            const net = Number(data?.current?.netPay) || 0;
            const gross = Number(data?.current?.grossPay) || 0;
            if (net === 0 && gross === 0) {
                zero.push(emp);
            } else {
                nonZero.push(emp);
            }
        });

        return { nonZeroEmployees: nonZero, zeroEmployees: zero };
    }, [processedEmployees, salaryDataMap]);

    // Filter logic
    const filteredList = hideZero ? nonZeroEmployees : processedEmployees;
    const [showAll, setShowAll] = useState(false);
    const displayEmployees = showAll ? filteredList : filteredList.slice(0, 6);

    // Selection handlers
    const toggleSelect = (id: string | number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const selectAll = () => {
        setSelectedIds(new Set(displayEmployees.map(e => e.id)));
    };

    const clearSelection = () => {
        setSelectedIds(new Set());
    };

    const isLoading = employeesLoading || salaryLoading;

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="h-20 bg-muted rounded-lg animate-pulse" />
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {[1, 2, 3].map(i => (
                        <Card key={i} className="p-4">
                            <div className="animate-pulse space-y-3">
                                <div className="h-4 bg-muted rounded w-3/4" />
                                <div className="h-8 bg-muted rounded w-1/2" />
                                <div className="h-2 bg-muted rounded" />
                            </div>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    if (employees.length === 0) {
        return (
            <div className="text-center py-12 text-muted-foreground border-2 border-dashed rounded-lg">
                <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">Ажилтан бүртгэгдээгүй байна.</p>
                <p className="text-xs mt-1">Орлого тооцохын тулд ажилтан нэмнэ үү.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* KPI Summary */}
            <KPISummary employees={employees} salaryDataMap={salaryDataMap} formatMNT={formatMNT} />

            {/* Filters & Search Row */}
            <div className="flex flex-wrap gap-2 items-center">
                <div className="relative flex-1 min-w-[200px] max-w-sm">
                    <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Нэр, албан тушаал, код..."
                        className="pl-9 h-9"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                    <SelectTrigger className="w-[120px] h-9">
                        <ArrowUpDown className="w-3 h-3 mr-1" />
                        <SelectValue placeholder="Эрэмбэ" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="net">Net</SelectItem>
                        <SelectItem value="gross">Gross</SelectItem>
                        <SelectItem value="attendance">Ирц %</SelectItem>
                        <SelectItem value="status">Төлөв</SelectItem>
                    </SelectContent>
                </Select>

                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}>
                    {sortDir === "desc" ? <ArrowDown className="h-4 w-4" /> : <ArrowUp className="h-4 w-4" />}
                </Button>

                <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
                    <SelectTrigger className="w-[140px] h-9">
                        <SelectValue placeholder="Төлөв" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Бүх төлөв</SelectItem>
                        <SelectItem value="pending">Хүлээгдэж буй</SelectItem>
                        <SelectItem value="calculated">Тооцоолсон</SelectItem>
                        <SelectItem value="approved">Батлагдсан</SelectItem>
                        <SelectItem value="paid">Олгосон</SelectItem>
                    </SelectContent>
                </Select>

                <Select value={attendanceFilter} onValueChange={(v: any) => setAttendanceFilter(v)}>
                    <SelectTrigger className="w-[120px] h-9">
                        <SelectValue placeholder="Ирц" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Бүх ирц</SelectItem>
                        <SelectItem value="full">Бүтэн</SelectItem>
                        <SelectItem value="partial">Дутуу</SelectItem>
                        <SelectItem value="late">Хоцорсон</SelectItem>
                    </SelectContent>
                </Select>

                <Button
                    variant={hideZero ? "secondary" : "outline"}
                    size="sm"
                    className="h-9"
                    onClick={() => setHideZero(!hideZero)}
                >
                    {hideZero ? "0₮ харуулах" : "0₮ нуух"}
                </Button>
            </div>

            {/* Bulk Actions Bar */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <span className="text-sm font-medium">{selectedIds.size} сонгосон</span>
                    <Button size="sm" variant="default" onClick={() => setLocation(`/payroll?action=batch&ids=${Array.from(selectedIds).join(",")}`)}>
                        <Layers className="w-3 h-3 mr-1" /> Batch-д нэмэх
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => setLocation(`/payroll?action=download&ids=${Array.from(selectedIds).join(",")}`)}>
                        <Download className="w-3 h-3 mr-1" /> Payslip татах
                    </Button>
                    <Button size="sm" variant="ghost" onClick={clearSelection}>
                        Цуцлах
                    </Button>
                    <Button size="sm" variant="ghost" onClick={selectAll}>
                        Бүгдийг сонгох
                    </Button>
                </div>
            )}

            {/* Cards Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {displayEmployees.map((emp) => (
                    <EnhancedSalaryCard
                        key={emp.id}
                        employee={emp}
                        salaryData={salaryDataMap.get(emp.id) || null}
                        isSelected={selectedIds.has(emp.id)}
                        onSelect={toggleSelect}
                        formatMNT={formatMNT}
                    />
                ))}
            </div>

            {!showAll && filteredList.length > 6 && (
                <div className="flex justify-center mt-4">
                    <Button
                        variant="outline"
                        onClick={() => setShowAll(true)}
                        className="w-full md:w-auto min-w-[200px]"
                    >
                        Бүгдийг харах ({filteredList.length - 6} ажилтан)
                        <ChevronDown className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            )}

            {showAll && (
                <div className="flex justify-center mt-4">
                    <Button
                        variant="ghost"
                        onClick={() => setShowAll(false)}
                        className="text-muted-foreground"
                    >
                        Хураах
                        <ChevronUp className="w-4 h-4 ml-2" />
                    </Button>
                </div>
            )}

            {/* Zero Amount Collapsed Section */}
            {!hideZero && zeroEmployees.length > 0 && (
                <div className="border border-dashed rounded-lg">
                    <Button
                        variant="ghost"
                        className="w-full justify-between p-3 h-auto"
                        onClick={() => setZeroCollapsed(!zeroCollapsed)}
                    >
                        <span className="text-sm text-muted-foreground">
                            0₮ ажилтнууд ({zeroEmployees.length})
                        </span>
                        {zeroCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                    </Button>
                    {!zeroCollapsed && (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 p-4 pt-0">
                            {zeroEmployees.map((emp) => (
                                <EnhancedSalaryCard
                                    key={emp.id}
                                    employee={emp}
                                    salaryData={salaryDataMap.get(emp.id) || null}
                                    isSelected={selectedIds.has(emp.id)}
                                    onSelect={toggleSelect}
                                    formatMNT={formatMNT}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
