import React, { useState, useEffect, useRef } from "react";
import { useDepartments, type DepartmentWithStats } from "@/hooks/use-departments";
import { useEmployees } from "@/hooks/use-employees";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Users, Pencil, Trash2, MoreHorizontal, UserCog, CalendarCheck, UserPlus, Search, Building2, BarChart3, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertDepartmentSchema } from "@shared/schema";
import type { InsertDepartment } from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, AreaChart, Area } from "recharts";
import { format } from "date-fns";
import { mn } from "date-fns/locale";

// Department Tree View Component
interface DepartmentTreeViewProps {
  departments: any[];
  departmentsWithStats: DepartmentWithStats[];
  onDepartmentClick?: (dept: any) => void;
  onUpdateParent?: (departmentId: string, newParentId: string | null) => Promise<void>;
}

function DepartmentTreeView({ departments, departmentsWithStats, onDepartmentClick, onUpdateParent }: DepartmentTreeViewProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [draggedDeptId, setDraggedDeptId] = useState<string | null>(null);
  const [dragOverDeptId, setDragOverDeptId] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Handle wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(0.5, Math.min(2, zoom * delta));
      setZoom(newZoom);
    }
  };

  // Handle pan with mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) { // Left mouse button
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) {
      setPan({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Reset zoom/pan
  const handleReset = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Build tree structure from departments
  const buildDepartmentTree = (deptsList: any[]) => {
    const deptMap = new Map(deptsList.map((dept) => [dept.id, { ...dept, children: [] }]));
    const roots: any[] = [];

    deptsList.forEach((dept) => {
      const department = deptMap.get(dept.id)!;
      if (dept.parentDepartmentId && deptMap.has(dept.parentDepartmentId)) {
        const parent = deptMap.get(dept.parentDepartmentId)!;
        parent.children.push(department);
      } else {
        roots.push(department);
      }
    });

    return roots;
  };

  const departmentTree = buildDepartmentTree(departments);

  // Handle drag & drop
  const handleDragStart = (e: React.DragEvent, deptId: string) => {
    setDraggedDeptId(deptId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", deptId);
  };

  const handleDragOver = (e: React.DragEvent, deptId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (draggedDeptId && draggedDeptId !== deptId) {
      setDragOverDeptId(deptId);
    }
  };

  const handleDragLeave = () => {
    setDragOverDeptId(null);
  };

  const handleDrop = async (e: React.DragEvent, targetDeptId: string) => {
    e.preventDefault();
    setDragOverDeptId(null);
    
    if (!draggedDeptId || draggedDeptId === targetDeptId || !onUpdateParent) {
      setDraggedDeptId(null);
      return;
    }

    try {
      // Prevent setting a department as parent of itself or its descendant
      const isDescendant = (childId: string, parentId: string, deptList: any[]): boolean => {
        const child = deptList.find(d => d.id === childId);
        if (!child || !child.parentDepartmentId) return false;
        if (child.parentDepartmentId === parentId) return true;
        return isDescendant(child.parentDepartmentId, parentId, deptList);
      };

      if (isDescendant(targetDeptId, draggedDeptId, departments)) {
        toast({
          title: "Алдаа",
          description: "Хэлтсийг өөрийн дэд хэлтэстэй болгох боломжгүй",
          variant: "destructive",
        });
        setDraggedDeptId(null);
        return;
      }

      await onUpdateParent(draggedDeptId, targetDeptId);
      toast({
        title: "Амжилттай",
        description: "Хэлтсийн бүтэц амжилттай шинэчлэгдлээ",
      });
    } catch (error: any) {
      toast({
        title: "Алдаа",
        description: error.message || "Хэлтсийн бүтэц шинэчлэхэд алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setDraggedDeptId(null);
    }
  };

  // Render tree node
  const renderTreeNode = (dept: any, depth: number = 0) => {
    const indent = depth * 32;
    const deptStats = departmentsWithStats.find(d => d.id === dept.id);
    const hasChildren = dept.children && dept.children.length > 0;
    const isDragged = draggedDeptId === dept.id;
    const isDragOver = dragOverDeptId === dept.id;

    return (
      <div key={dept.id} className="relative">
        <div
          draggable={!!onUpdateParent}
          onDragStart={(e) => handleDragStart(e, dept.id)}
          onDragOver={(e) => handleDragOver(e, dept.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, dept.id)}
          className={`flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-muted/50 transition-all ${
            depth === 0 ? "border-primary/20" : ""
          } ${
            isDragged ? "opacity-50 cursor-grabbing" : onUpdateParent ? "cursor-grab" : "cursor-pointer"
          } ${
            isDragOver ? "ring-2 ring-primary ring-offset-2 bg-primary/10" : ""
          }`}
          style={{ marginLeft: `${indent}px` }}
          onClick={() => !draggedDeptId && onDepartmentClick?.(dept)}
        >
          {/* Tree connector lines */}
          {depth > 0 && (
            <div className="absolute left-0 top-0 bottom-0 w-8 flex items-center">
              <div className="h-px w-4 bg-border"></div>
              <div className="w-px h-full bg-border"></div>
            </div>
          )}

          {/* Department icon */}
          <div className="flex-shrink-0 mt-1">
            <Building2 className={`h-5 w-5 ${depth === 0 ? "text-primary" : "text-muted-foreground"}`} />
          </div>

          {/* Department info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h4 className={`font-semibold ${depth === 0 ? "text-lg" : ""}`}>{dept.name}</h4>
              {dept.code && (
                <Badge variant="outline" className="text-xs">
                  {dept.code}
                </Badge>
              )}
            </div>

            {deptStats && (
              <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
                <div className="flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span>{deptStats.employeeCount || 0} ажилтан</span>
                </div>
                {deptStats.manager && (
                  <div className="flex items-center gap-1">
                    <UserCog className="h-3 w-3" />
                    <span>{deptStats.manager.firstName} {deptStats.manager.lastName || ""}</span>
                  </div>
                )}
                {deptStats.attendanceKPI !== undefined && (
                  <div className="flex items-center gap-1">
                    <CalendarCheck className="h-3 w-3" />
                    <span className={deptStats.attendanceKPI >= 80 ? "text-green-600" : deptStats.attendanceKPI >= 60 ? "text-yellow-600" : "text-red-600"}>
                      {deptStats.attendanceKPI.toFixed(0)}%
                    </span>
                  </div>
                )}
              </div>
            )}

            {hasChildren && (
              <div className="text-xs text-muted-foreground mt-2">
                {dept.children.length} дэд хэлтэс
              </div>
            )}
          </div>
        </div>

        {/* Render children */}
        {hasChildren && (
          <div className="mt-2 space-y-2">
            {dept.children.map((child: any) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  // Show loading skeleton if departments are loading
  // Note: isLoadingStats check should be passed from parent component
  if (departments.length === 0 && !departmentsWithStats) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-48" />
          <div className="flex items-center gap-2">
            <Skeleton className="h-7 w-20" />
            <Skeleton className="h-7 w-16" />
          </div>
        </div>
        <div className="h-[600px] border rounded-lg p-8 space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="p-3 rounded-lg border">
              <div className="flex items-center gap-3">
                <Skeleton className="w-5 h-5" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-2" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (departments.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Building2 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Хэлтэс олдсонгүй</p>
        <p className="text-xs mt-2">Хэлтэс нэмээд бүтцийн мод үүсгэнэ үү</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-lg">Байгууллагын бүтэц</h3>
          <p className="text-sm text-muted-foreground mt-1">
            {departments.length} хэлтэс • Хэлтэс дээр дарж дэлгэрэнгүй мэдээлэл харах
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
              className="h-7 w-7 p-0"
              title="Багасгах"
            >
              <ZoomOut className="w-3 h-3" />
            </Button>
            <span className="text-xs text-muted-foreground min-w-[3rem] text-center">
              {Math.round(zoom * 100)}%
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setZoom(Math.min(2, zoom + 0.1))}
              className="h-7 w-7 p-0"
              title="Нэмэгдүүлэх"
            >
              <ZoomIn className="w-3 h-3" />
            </Button>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="h-7"
            title="Эх байдалд буцаах"
          >
            <RotateCcw className="w-3 h-3 mr-1" />
            Reset
          </Button>
        </div>
      </div>

      <div
        ref={containerRef}
        className="relative h-[600px] border rounded-lg overflow-hidden bg-muted/20 cursor-grab active:cursor-grabbing"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div
          className="absolute inset-0 origin-top-left"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          <ScrollArea className="h-full w-full">
            <div className="p-8 space-y-3 min-w-full">
              {departmentTree.map((dept) => renderTreeNode(dept, 0))}
            </div>
          </ScrollArea>
        </div>
        <div className="absolute bottom-4 right-4 text-xs text-muted-foreground bg-background/80 backdrop-blur-sm px-2 py-1 rounded">
          💡 Ctrl+Wheel zoom, Click & Drag pan{onUpdateParent ? ", Drag & Drop хэлтэс" : ""}
        </div>
      </div>
    </div>
  );
}

// Department Reports Component
interface DepartmentReportsProps {
  department: DepartmentWithStats | null;
  departmentDetails: any;
  employees: any[];
}

function DepartmentReports({ department, departmentDetails, employees }: DepartmentReportsProps) {
  // Calculate monthly salary cost
  const monthlySalaryCost = employees.reduce((sum, emp) => {
    return sum + (Number(emp.baseSalary) || 0);
  }, 0);

  // Calculate annual salary cost
  const annualSalaryCost = monthlySalaryCost * 12;

  // Prepare attendance data for chart (last 30 days)
  const attendanceData = React.useMemo(() => {
    if (!departmentDetails?.todayAttendance) return [];
    
    // For now, use today's attendance as sample
    // In future, can aggregate daily attendance data
    const today = new Date();
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(today);
      date.setDate(date.getDate() - (6 - i));
      return {
        date: format(date, "MM/dd", { locale: mn }),
        dateShort: format(date, "EEE", { locale: mn }),
        present: departmentDetails.attendanceKPI || 0, // Use KPI as approximation
        absent: 100 - (departmentDetails.attendanceKPI || 0),
      };
    });
    
    return last7Days;
  }, [departmentDetails]);

  // Format currency
  const formatMNT = (value: number) => {
    return new Intl.NumberFormat('mn-MN', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value) + '₮';
  };

  if (!department) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <BarChart3 className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>Хэлтэс сонгоно уу</p>
        <p className="text-xs mt-2">Хэлтсийн тайлангуудыг харахын тулд хэлтэс сонгоно уу</p>
      </div>
    );
  }

  const attendanceKPI = department.attendanceKPI || 0;
  const kpiColor = attendanceKPI >= 80 ? "text-green-600" : attendanceKPI >= 60 ? "text-yellow-600" : "text-red-600";

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Ирцийн KPI</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className={`text-3xl font-bold ${kpiColor}`}>{attendanceKPI.toFixed(1)}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Өнөөдрийн ирц</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Сарын цалингийн зардал</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{formatMNT(monthlySalaryCost)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{employees.length} ажилтан</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Жилийн цалингийн зардал</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold">{formatMNT(annualSalaryCost)}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2">12 сар × сарын зардал</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck className="w-5 h-5" />
            Ирцийн график (Сүүлийн 7 өдөр)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendanceData.length > 0 ? (
            <ChartContainer
              config={{
                present: {
                  label: "Ирсэн",
                  color: "hsl(var(--chart-1))",
                },
                absent: {
                  label: "Ирээгүй",
                  color: "hsl(var(--chart-2))",
                },
              }}
              className="h-[300px]"
            >
              <AreaChart data={attendanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="dateShort" 
                  tick={{ fontSize: 12 }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area
                  type="monotone"
                  dataKey="present"
                  stackId="1"
                  stroke="hsl(var(--chart-1))"
                  fill="hsl(var(--chart-1))"
                  fillOpacity={0.6}
                />
                <Area
                  type="monotone"
                  dataKey="absent"
                  stackId="1"
                  stroke="hsl(var(--chart-2))"
                  fill="hsl(var(--chart-2))"
                  fillOpacity={0.6}
                />
              </AreaChart>
            </ChartContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              Ирцийн мэдээлэл байхгүй байна
            </div>
          )}
        </CardContent>
      </Card>

      {/* Employee Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="w-5 h-5" />
            Ажилтнуудын тархалт
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm font-medium">Нийт ажилтан</span>
                <span className="text-lg font-bold">{employees.length}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-primary h-2 rounded-full" 
                  style={{ width: "100%" }}
                />
              </div>
            </div>
            {department.manager && (
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">Удирдагч</span>
                  <span className="text-sm">{department.manager.firstName} {department.manager.lastName || ""}</span>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* KPI Analytics */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5" />
            KPI Аналитик
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Ирцийн хувь</div>
              <div className={`text-2xl font-bold ${kpiColor}`}>{attendanceKPI.toFixed(1)}%</div>
              <div className="text-xs text-muted-foreground mt-1">
                {attendanceKPI >= 80 ? "✅ Маш сайн" : attendanceKPI >= 60 ? "⚠️ Дундаж" : "❌ Сайжруулах шаардлагатай"}
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Ажилтны тоо</div>
              <div className="text-2xl font-bold">{employees.length}</div>
              <div className="text-xs text-muted-foreground mt-1">Идэвхтэй ажилтан</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function Departments() {
  const { 
    departments = [], // Regular departments (with parentDepartmentId)
    departmentsWithStats = [], 
    isLoadingStats, 
    createDepartment, 
    updateDepartment, 
    deleteDepartment,
    batchAssignEmployees,
    getDepartmentDetails
  } = useDepartments();
  const { employees = [], isLoading: isLoadingEmployees } = useEmployees();
  const { user } = useAuth();

  const isAdmin = user?.role === "Admin";

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingDepartment, setEditingDepartment] = useState<DepartmentWithStats | null>(null);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState<DepartmentWithStats | null>(null);
  const [departmentDetails, setDepartmentDetails] = useState<any>(null);
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("employees");
  const { toast } = useToast();

  const form = useForm<InsertDepartment>({
    resolver: zodResolver(insertDepartmentSchema),
    defaultValues: {
      name: "",
      code: "",
    },
  });

  const openDialog = (dept?: DepartmentWithStats) => {
    if (dept) {
      setEditingDepartment(dept);
      form.reset({
        name: dept.name,
        code: dept.code || "",
      });
    } else {
      setEditingDepartment(null);
      form.reset({
        name: "",
        code: "",
      });
    }
    setIsDialogOpen(true);
  };

  const onSubmit = async (data: InsertDepartment) => {
    try {
      const payload = {
        ...data,
        code: data.code ? data.code.toUpperCase().trim() : "",
      };

      if (editingDepartment) {
        await updateDepartment.mutateAsync({ id: editingDepartment.id, data: payload });
        toast({ title: "Амжилттай", description: "Хэлтэс амжилттай засагдлаа." });
      } else {
        await createDepartment.mutateAsync(payload);
        toast({ title: "Амжилттай", description: "Хэлтэс амжилттай нэмэгдлээ." });
      }
      setIsDialogOpen(false);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Үйлдэл амжилтгүй боллоо",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (dept: DepartmentWithStats) => {
    if (!confirm(`${dept.name} хэлтсийг устгах уу? Энэ үйлдлийг буцаах боломжгүй!`)) {
      return;
    }

    try {
      await deleteDepartment.mutateAsync(dept.id);
      toast({ title: "Амжилттай", description: "Хэлтэс устгагдлаа." });
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Устгахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const openDrawer = async (dept: DepartmentWithStats, tab: string = "employees") => {
    setSelectedDepartment(dept);
    setActiveTab(tab);
    setIsDrawerOpen(true);
    setSelectedEmployeeIds([]);
    setSearchQuery("");
    
    // Load department details
    try {
      const details = await getDepartmentDetails(dept.id);
      setDepartmentDetails(details);
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: "Хэлтсийн дэлгэрэнгүй мэдээлэл авахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const handleSmartAssign = async () => {
    if (!selectedDepartment || selectedEmployeeIds.length === 0) {
      toast({
        title: "Алдаа",
        description: "Хуваарилах ажилтнуудыг сонгоно уу",
        variant: "destructive",
      });
      return;
    }

    try {
      await batchAssignEmployees.mutateAsync({
        departmentId: selectedDepartment.id,
        employeeIds: selectedEmployeeIds,
      });
      toast({ title: "Амжилттай", description: `${selectedEmployeeIds.length} ажилтан хуваарилагдлаа.` });
      setSelectedEmployeeIds([]);
      // Reload department details
      if (selectedDepartment) {
        const details = await getDepartmentDetails(selectedDepartment.id);
        setDepartmentDetails(details);
      }
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Ажилтнууд хуваарилахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  // Filter employees for Smart Assign (exclude already assigned to this department)
  const availableEmployees = employees.filter(emp => {
    if (selectedDepartment && emp.departmentId === selectedDepartment.id) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        emp.firstName?.toLowerCase().includes(query) ||
        emp.lastName?.toLowerCase().includes(query) ||
        emp.employeeNo?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  // Get department employees
  const departmentEmployees = departmentDetails?.employees || [];

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display">Хэлтэсүүд</h2>
          <p className="text-muted-foreground mt-1">Байгууллагын бүтцийг удирдах.</p>
        </div>

        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/25 hover:shadow-primary/30" onClick={() => openDialog()}>
              <Plus className="w-4 h-4 mr-2" />
              Хэлтэс нэмэх
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>
                {editingDepartment ? "Хэлтэс засах" : "Шинэ хэлтэс үүсгэх"}
              </DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Хэлтсийн нэр</FormLabel>
                      <FormControl>
                        <Input placeholder="Жишээ: Хүний нөөц" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Код</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Жишээ: HR"
                          {...field}
                          value={field.value || ""}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                          maxLength={10}
                          disabled={!!editingDepartment}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full"
                  disabled={createDepartment.isPending || updateDepartment.isPending}
                >
                  {createDepartment.isPending || updateDepartment.isPending
                    ? "Хадгалагдаж байна..."
                    : editingDepartment
                      ? "Хадгалах"
                      : "Үүсгэх"}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {isLoadingStats ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Хэлтсүүдийг ачааллаж байна...
          </div>
        ) : departmentsWithStats.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            Хэлтэс бүртгэгдээгүй байна. Эхний хэлтсээ нэмнэ үү.
          </div>
        ) : (
          departmentsWithStats.map((dept: DepartmentWithStats) => (
            <Card
              key={dept.id}
              className="hover:shadow-lg hover:border-primary/50 transition-all duration-300 group relative overflow-hidden"
            >
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div className="p-3 bg-primary/10 rounded-xl group-hover:bg-primary/20 group-hover:scale-110 transition-all">
                    <Users className="w-6 h-6 text-primary" />
                  </div>
                  {dept.code && (
                    <span className="text-xs font-mono bg-primary/10 px-3 py-1 rounded-full text-primary font-semibold">
                      {dept.code}
                    </span>
                  )}
                </div>
                <CardTitle 
                  className="mt-6 text-xl cursor-pointer hover:text-primary transition-colors"
                  onClick={() => openDrawer(dept)}
                >
                  {dept.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Stats Row: Employee Count, Manager, Attendance KPI */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      <span className="font-semibold text-foreground">{dept.employeeCount}</span> ажилтан
                    </span>
                  </div>

                  {/* Attendance KPI */}
                  <div className="flex items-center gap-2 text-sm">
                    <CalendarCheck className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Өнөөдрийн ирц: <span className={`font-semibold ${
                        dept.attendanceKPI >= 80 ? "text-green-600" : 
                        dept.attendanceKPI >= 60 ? "text-yellow-600" : 
                        "text-red-600"
                      }`}>
                        {dept.attendanceKPI?.toFixed(0) || 0}%
                      </span>
                    </span>
                  </div>
                </div>

                {/* Manager */}
                {dept.manager ? (
                  <div className="flex items-center gap-2 text-sm">
                    <UserCog className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      Удирдагч: <span className="font-semibold text-foreground">
                        {dept.manager.firstName} {dept.manager.lastName || ""}
                      </span>
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <UserCog className="w-4 h-4" />
                    <span>Удирдагч томилогдоогүй</span>
                  </div>
                )}

                {/* Top Employees Avatar Stack */}
                {dept.topEmployees && dept.topEmployees.length > 0 && (
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-2">
                      {dept.topEmployees.slice(0, 4).map((emp, idx) => {
                        const initials = `${emp.firstName?.[0] || ""}${emp.lastName?.[0] || ""}`.toUpperCase() || "?";
                        return (
                          <Avatar
                            key={emp.id}
                            className="border-2 border-background h-8 w-8"
                            style={{ zIndex: 10 - idx }}
                          >
                            <AvatarFallback className="text-xs bg-primary/10 text-primary font-semibold">
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                        );
                      })}
                    </div>
                    {dept.employeeCount > dept.topEmployees.length && (
                      <span className="text-xs text-muted-foreground">
                        +{dept.employeeCount - dept.topEmployees.length} нэмэлт
                      </span>
                    )}
                  </div>
                )}

                {/* Mini Action: Ажилтан нэмэх */}
                {isAdmin && (
                  <div className="pt-2 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full text-xs"
                      onClick={() => openDrawer(dept, "employees")}
                    >
                      <UserPlus className="w-3 h-3 mr-1" />
                      Ажилтан нэмэх
                    </Button>
                  </div>
                )}
              </CardContent>

              {isAdmin && (
                <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm shadow-md hover:shadow-lg">
                        <MoreHorizontal className="w-5 h-5" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => openDialog(dept)}>
                        <Pencil className="mr-2 h-4 w-4" />
                        Засах
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(dept)}
                        className="text-destructive focus:text-destructive focus:bg-destructive/10"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Устгах
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}
            </Card>
          ))
        )}
      </div>

      {/* Department Drawer */}
      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedDepartment && (
            <>
              <SheetHeader>
                <SheetTitle className="text-2xl">{selectedDepartment.name}</SheetTitle>
                <SheetDescription>
                  {selectedDepartment.code && `Код: ${selectedDepartment.code}`}
                  {selectedDepartment.employeeCount > 0 && ` • ${selectedDepartment.employeeCount} ажилтан`}
                </SheetDescription>
              </SheetHeader>

              <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="employees">
                    <Users className="w-4 h-4 mr-2" />
                    Ажилтнууд
                  </TabsTrigger>
                  <TabsTrigger value="structure">
                    <Building2 className="w-4 h-4 mr-2" />
                    Бүтэц
                  </TabsTrigger>
                  <TabsTrigger value="reports">
                    <BarChart3 className="w-4 h-4 mr-2" />
                    Тайлан
                  </TabsTrigger>
                </TabsList>

                {/* Employees Tab */}
                <TabsContent value="employees" className="mt-4">
                  <div className="space-y-4">
                    {/* Smart Assign Section */}
                    {isAdmin && activeTab === "employees" && (
                      <div className="border rounded-lg p-4 bg-muted/50">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="font-semibold flex items-center gap-2">
                            <UserPlus className="w-4 h-4" />
                            Ажилтан хуваарилах
                          </h3>
                          {selectedEmployeeIds.length > 0 && (
                            <Button
                              size="sm"
                              onClick={handleSmartAssign}
                              disabled={batchAssignEmployees.isPending}
                            >
                              {batchAssignEmployees.isPending
                                ? "Хадгалаж байна..."
                                : `${selectedEmployeeIds.length} ажилтан хуваарилах`}
                            </Button>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="relative">
                            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                            <Input
                              placeholder="Ажилтан хайх..."
                              value={searchQuery}
                              onChange={(e) => setSearchQuery(e.target.value)}
                              className="pl-8"
                            />
                          </div>

                          <ScrollArea className="h-48 border rounded-md p-2">
                            {isLoadingEmployees ? (
                              <div className="text-center py-4 text-muted-foreground">
                                Ачааллаж байна...
                              </div>
                            ) : availableEmployees.length === 0 ? (
                              <div className="text-center py-4 text-muted-foreground">
                                {searchQuery ? "Хайлтын үр дүн олдсонгүй" : "Бүх ажилтан хуваарилагдсан"}
                              </div>
                            ) : (
                              <div className="space-y-2">
                                {availableEmployees.map((emp) => (
                                  <div
                                    key={emp.id}
                                    className="flex items-center space-x-2 p-2 hover:bg-muted rounded"
                                  >
                                    <Checkbox
                                      checked={selectedEmployeeIds.includes(emp.id)}
                                      onCheckedChange={(checked) => {
                                        if (checked) {
                                          setSelectedEmployeeIds([...selectedEmployeeIds, emp.id]);
                                        } else {
                                          setSelectedEmployeeIds(
                                            selectedEmployeeIds.filter((id) => id !== emp.id)
                                          );
                                        }
                                      }}
                                    />
                                    <div className="flex-1">
                                      <div className="font-medium">
                                        {emp.firstName} {emp.lastName || ""}
                                      </div>
                                      {emp.employeeNo && (
                                        <div className="text-xs text-muted-foreground">
                                          {emp.employeeNo}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </ScrollArea>
                        </div>
                      </div>
                    )}

                    {/* Department Employees List */}
                    <div>
                      <h3 className="font-semibold mb-3">Хэлтсийн ажилтнууд</h3>
                      {departmentDetails ? (
                        <ScrollArea className="h-64">
                          {departmentEmployees.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              Ажилтан бүртгэгдээгүй байна
                            </div>
                          ) : (
                            <div className="space-y-2">
                              {departmentEmployees.map((emp: any) => (
                                <div
                                  key={emp.id}
                                  className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50 cursor-pointer"
                                  onClick={() => {
                                    // TODO: Navigate to employee profile
                                    toast({ title: "Ажилтны профайл", description: `${emp.firstName} ${emp.lastName || ""}` });
                                  }}
                                >
                                  <Avatar className="h-10 w-10">
                                    <AvatarFallback>
                                      {`${emp.firstName?.[0] || ""}${emp.lastName?.[0] || ""}`.toUpperCase()}
                                    </AvatarFallback>
                                  </Avatar>
                                  <div className="flex-1">
                                    <div className="font-medium">
                                      {emp.firstName} {emp.lastName || ""}
                                    </div>
                                    {emp.employeeNo && (
                                      <div className="text-sm text-muted-foreground">
                                        {emp.employeeNo}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </ScrollArea>
                      ) : (
                        <div className="text-center py-8 text-muted-foreground">
                          Ачааллаж байна...
                        </div>
                      )}
                    </div>
                  </div>
                </TabsContent>

                {/* Structure Tab - Organization Chart (Tree View) */}
                <TabsContent value="structure" className="mt-4">
                  <DepartmentTreeView 
                    departments={departments} 
                    departmentsWithStats={departmentsWithStats}
                    onDepartmentClick={(dept) => {
                      // When clicking a department in tree, switch to employees tab and load details
                      const deptWithStats = departmentsWithStats.find(d => d.id === dept.id);
                      if (deptWithStats) {
                        openDrawer(deptWithStats, "employees");
                      }
                    }}
                    onUpdateParent={isAdmin ? async (departmentId, newParentId) => {
                      await updateDepartment.mutateAsync({
                        id: departmentId,
                        data: { parentDepartmentId: newParentId || undefined },
                      });
                    } : undefined}
                  />
                </TabsContent>

                {/* Reports Tab - Department Analytics */}
                <TabsContent value="reports" className="mt-4">
                  <DepartmentReports 
                    department={selectedDepartment}
                    departmentDetails={departmentDetails}
                    employees={departmentEmployees}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}