import { useState } from "react";
import { Link } from "wouter";
import {
    Users,
    Trophy,
    ChevronRight,
    Search,
    SortAsc,
    X
} from "lucide-react";
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent, GlassCardFooter } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface Employee {
    id: string;
    firstName: string;
    lastName?: string;
    position?: string;
    departmentName?: string;
    points?: number;
    avatar?: string;
}

interface EmployeesWidgetProps {
    employees: Employee[];
    isLoading?: boolean;
    title?: string;
    showPoints?: boolean;
    limit?: number;
}

// Single employee row component
function EmployeeRow({
    employee,
    rank,
    showPoints = true
}: {
    employee: Employee;
    rank?: number;
    showPoints?: boolean;
}) {
    const fullName = `${employee.firstName} ${employee.lastName || ""}`.trim();
    const initials = `${employee.firstName?.[0] || ""}${employee.lastName?.[0] || ""}`.toUpperCase();

    return (
        <div className="flex items-center gap-3 p-3 rounded-xl hover:bg-white/5 transition-colors">
            {/* Rank Badge */}
            {rank && rank <= 3 && (
                <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    rank === 1 && "bg-amber-500/20 text-amber-400",
                    rank === 2 && "bg-slate-400/20 text-slate-300",
                    rank === 3 && "bg-amber-700/20 text-amber-600"
                )}>
                    {rank}
                </div>
            )}

            {/* Avatar */}
            <Avatar className="h-9 w-9 border border-white/10">
                <AvatarImage src={employee.avatar} />
                <AvatarFallback className="bg-primary/10 text-primary text-xs">
                    {initials}
                </AvatarFallback>
            </Avatar>

            {/* Info */}
            <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-200 truncate">
                    {fullName}
                </p>
                <p className="text-xs text-slate-500 truncate">
                    {employee.position || employee.departmentName || "—"}
                </p>
            </div>

            {/* Points */}
            {showPoints && employee.points !== undefined && (
                <div className="flex items-center gap-1 text-emerald-400">
                    <Trophy className="h-3.5 w-3.5" />
                    <span className="text-sm font-semibold">{employee.points}</span>
                </div>
            )}
        </div>
    );
}

// Loading skeleton
function EmployeeSkeleton() {
    return (
        <div className="flex items-center gap-3 p-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
            </div>
            <Skeleton className="h-4 w-10" />
        </div>
    );
}

// Full list drawer component
function EmployeesDrawer({
    employees,
    isLoading,
    showPoints,
    title
}: EmployeesWidgetProps) {
    const [search, setSearch] = useState("");
    const [sortBy, setSortBy] = useState<"points" | "name" | "department">("points");

    // Filter and sort
    const filteredEmployees = employees
        .filter(emp => {
            if (!search) return true;
            const fullName = `${emp.firstName} ${emp.lastName || ""}`.toLowerCase();
            return fullName.includes(search.toLowerCase()) ||
                emp.position?.toLowerCase().includes(search.toLowerCase()) ||
                emp.departmentName?.toLowerCase().includes(search.toLowerCase());
        })
        .sort((a, b) => {
            switch (sortBy) {
                case "points":
                    return (b.points || 0) - (a.points || 0);
                case "name":
                    return a.firstName.localeCompare(b.firstName);
                case "department":
                    return (a.departmentName || "").localeCompare(b.departmentName || "");
                default:
                    return 0;
            }
        });

    return (
        <div className="flex flex-col h-full">
            {/* Search & Sort */}
            <div className="p-4 border-b border-white/10 space-y-3">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
                    <Input
                        placeholder="Хайх..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="pl-9 bg-slate-900/50 border-white/10"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch("")}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                            <X className="h-4 w-4 text-slate-500 hover:text-slate-300" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <SortAsc className="h-4 w-4 text-slate-500" />
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
                        <SelectTrigger className="w-[180px] bg-slate-900/50 border-white/10">
                            <SelectValue placeholder="Эрэмбэлэх" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="points">Оноогоор</SelectItem>
                            <SelectItem value="name">Нэрээр</SelectItem>
                            <SelectItem value="department">Хэлтсээр</SelectItem>
                        </SelectContent>
                    </Select>
                    <span className="text-xs text-slate-500 ml-auto">
                        {filteredEmployees.length} ажилтан
                    </span>
                </div>
            </div>

            {/* Employee List */}
            <div className="flex-1 overflow-y-auto p-2">
                {isLoading ? (
                    <div className="space-y-1">
                        {Array.from({ length: 10 }).map((_, i) => (
                            <EmployeeSkeleton key={i} />
                        ))}
                    </div>
                ) : filteredEmployees.length > 0 ? (
                    <div className="space-y-1">
                        {filteredEmployees.map((employee, index) => (
                            <EmployeeRow
                                key={employee.id}
                                employee={employee}
                                rank={sortBy === "points" ? index + 1 : undefined}
                                showPoints={showPoints}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-slate-500">
                        <Users className="h-12 w-12 mb-3 opacity-30" />
                        <p className="text-sm">Ажилтан олдсонгүй</p>
                        {search && (
                            <button
                                onClick={() => setSearch("")}
                                className="text-xs text-primary mt-2 hover:underline"
                            >
                                Хайлтыг арилгах
                            </button>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

// Main widget component
export function EmployeesWidget({
    employees,
    isLoading = false,
    title = "Шилдэг ажилтнууд",
    showPoints = true,
    limit = 5,
}: EmployeesWidgetProps) {
    // Get top N employees sorted by points
    const topEmployees = [...employees]
        .sort((a, b) => (b.points || 0) - (a.points || 0))
        .slice(0, limit);

    return (
        <GlassCard padding="none" className="overflow-hidden h-full flex flex-col">
            <GlassCardHeader className="px-6 pt-6 pb-0">
                <GlassCardTitle className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-amber-400" />
                    {title}
                </GlassCardTitle>
                <span className="text-xs text-slate-500">
                    Top {limit}
                </span>
            </GlassCardHeader>

            <GlassCardContent className="flex-1 p-2">
                {isLoading ? (
                    <div className="space-y-1">
                        {Array.from({ length: limit }).map((_, i) => (
                            <EmployeeSkeleton key={i} />
                        ))}
                    </div>
                ) : topEmployees.length > 0 ? (
                    <div className="space-y-1">
                        {topEmployees.map((employee, index) => (
                            <EmployeeRow
                                key={employee.id}
                                employee={employee}
                                rank={index + 1}
                                showPoints={showPoints}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-8 text-slate-500">
                        <Users className="h-8 w-8 mb-2 opacity-50" />
                        <span className="text-sm">Ажилтан байхгүй</span>
                    </div>
                )}
            </GlassCardContent>

            {employees.length > limit && (
                <GlassCardFooter className="px-6 pb-6 pt-4 mt-0 border-t-0">
                    <Sheet>
                        <SheetTrigger asChild>
                            <Button
                                variant="ghost"
                                className="w-full justify-center gap-2 text-slate-400 hover:text-slate-200"
                            >
                                Бүгдийг харах ({employees.length})
                                <ChevronRight className="h-4 w-4" />
                            </Button>
                        </SheetTrigger>
                        <SheetContent className="w-[400px] sm:w-[540px] bg-slate-900 border-white/10 p-0">
                            <SheetHeader className="p-6 border-b border-white/10">
                                <SheetTitle className="text-slate-100 flex items-center gap-2">
                                    <Trophy className="h-5 w-5 text-amber-400" />
                                    {title}
                                </SheetTitle>
                            </SheetHeader>
                            <EmployeesDrawer
                                employees={employees}
                                isLoading={isLoading}
                                showPoints={showPoints}
                                title={title}
                            />
                        </SheetContent>
                    </Sheet>
                </GlassCardFooter>
            )}
        </GlassCard>
    );
}
