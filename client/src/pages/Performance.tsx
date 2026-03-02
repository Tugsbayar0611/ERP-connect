import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { isEmployee, isAdmin, isManager, isHR, isPrivileged, canViewTeamPerformance } from "@shared/roles";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format, formatDistanceToNow } from "date-fns";
import { Plus, Pencil, Trash2, Target, TrendingUp, Users, Calendar as CalendarIcon, CheckCircle, FileDown, Link as LinkIcon, Lock, History, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { EvidenceModal } from "@/components/performance/EvidenceModal";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { generatePerformanceReportPDF } from "@/lib/performance-pdf";
import { useAuth } from "@/hooks/use-auth";

// Types
interface PerformancePeriod {
  id: string;
  tenantId: string;
  name: string;
  startDate: string;
  endDate: string;
  status: "active" | "closed" | "archived" | "locked";
  createdAt: string;
  updatedAt: string;
}

interface PerformanceGoal {
  id: string;
  tenantId: string;
  periodId: string;
  employeeId: string;
  title: string;
  description?: string;
  metricType: "percent" | "number" | "currency" | "boolean";
  targetValue: string;
  currentValue: string;
  weight: number;
  progress: number;
  status: "draft" | "submitted" | "approved" | "evaluated" | "locked";
  dueDate?: string;
  managerId?: string;
  qualityRating?: number;
  managerComment?: string;
  evidence?: any[];
  createdAt: string;
}

interface PerformanceSummary {
  totalWeight: number;
  totalScore: number;
  goalsCount: number;
  completedCount: number;
}

// Schemas
const periodFormSchema = z.object({
  name: z.string().min(1, "Үеийн нэр оруулна уу"),
  startDate: z.string().min(1, "Эхлэх огноо оруулна уу"),
  endDate: z.string().min(1, "Дуусах огноо оруулна уу"),
  status: z.enum(["active", "closed", "archived"]).default("active"),
});

const goalFormSchema = z.object({
  periodId: z.string().uuid("Үе сонгоно уу"),
  employeeId: z.string().uuid("Ажилтан сонгоно уу"),
  title: z.string().min(1, "Зорилтын нэр оруулна уу"),
  description: z.string().optional(),
  metricType: z.enum(["percent", "number", "currency", "boolean"]).default("percent"),
  targetValue: z.string().default("100"),
  currentValue: z.string().default("0"),
  weight: z.number().min(0).max(100),
  progress: z.number().min(0).max(100).default(0),
  status: z.enum(["draft", "submitted", "approved", "evaluated", "locked"]).default("draft"),
  dueDate: z.string().optional(),
});

const evaluateFormSchema = z.object({
  qualityRating: z.coerce.number().min(1, "1-5 хооронд үнэлнэ үү").max(5, "1-5 хооронд үнэлнэ үү"),
  managerComment: z.string().min(1, "Сэтгэгдэл оруулна уу"),
  progressPercent: z.string().optional(),
});

// Status badge colors
const statusColors: Record<string, string> = {
  active: "bg-green-500",
  closed: "bg-yellow-500",
  archived: "bg-gray-500",
  draft: "bg-gray-400",
  submitted: "bg-blue-500",
  approved: "bg-green-500",
  evaluated: "bg-purple-500",
  locked: "bg-gray-800",
};

const statusLabels: Record<string, string> = {
  active: "Идэвхтэй",
  closed: "Хаагдсан",
  archived: "Архивлагдсан",
  draft: "Ноорог",
  submitted: "Илгээсэн",
  approved: "Зөвшөөрсөн",
  evaluated: "Үнэлсэн",
  locked: "Түгжсэн",
};

const calculateGoalScore = (weight: number, progress: number, qualityRating?: number) => {
  const ratingFactor = qualityRating ? (qualityRating / 5) : 1;
  const score = (weight * (progress / 100)) * ratingFactor;
  return score.toFixed(1);
};

export default function Performance() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const isAdminUser = isAdmin(user?.role);
  const isEmployeeUser = isEmployee(user?.role) && !isAdminUser;
  const canManage = canViewTeamPerformance(user?.role);

  // Redirect Logic
  useEffect(() => {
    if (!user) return;

    // If strict employee visits generic /performance, redirect to /performance/my
    if (isEmployeeUser && location === "/performance") {
      setLocation("/performance/my");
    }
    // If manager visits /performance, default to /performance/team (optional choice, nice to have)
    else if (canManage && location === "/performance") {
      setLocation("/performance/team");
    }
  }, [user, location, isEmployeeUser, canManage, setLocation]);

  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [isAddPeriodOpen, setIsAddPeriodOpen] = useState(false);
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [editingGoal, setEditingGoal] = useState<PerformanceGoal | null>(null);
  const [evaluateGoal, setEvaluateGoal] = useState<PerformanceGoal | null>(null);
  const [evidenceGoalId, setEvidenceGoalId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  // user comes from top hook now

  // Handler for PDF Export ... (omitted for brevity, assume unchanged unless specified)
  const handleExportPDF = async () => {
    // ... existing implementation
    if (!selectedPeriod || !summary) return;
    try {
      setIsExporting(true);
      const currentEmployee = employees.find((e: any) => e.userId === user?.id) || {
        firstName: user?.fullName || "User",
        lastName: "",
        employeeNo: "",
        position: "",
        department: ""
      };

      const reportData = {
        period: selectedPeriod,
        employee: {
          name: `${currentEmployee.firstName} ${currentEmployee.lastName}`.trim(),
          code: currentEmployee.employeeNo,
          position: currentEmployee.jobTitle || currentEmployee.position,
          department: currentEmployee.department?.name || "N/A"
        },
        goals: goals,
        summary: summary,
        generatedBy: user?.fullName || "System",
        generatedAt: new Date()
      };

      const pdfDataUrl = await generatePerformanceReportPDF(reportData);

      const link = document.createElement("a");
      link.href = pdfDataUrl;
      link.download = `Performance_Report_${selectedPeriod.name}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      toast({ title: "Амжилттай", description: "Тайлан татагдлаа" });
    } catch (error) {
      console.error(error);
      toast({ title: "Алдаа", description: "Тайлан үүсгэхэд алдаа гарлаа", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  // Fetch periods
  const { data: periods = [], isLoading: periodsLoading } = useQuery<PerformancePeriod[]>({
    queryKey: ["/api/performance/periods"],
  });

  // Fetch employees for dropdown
  const { data: employees = [] } = useQuery<any[]>({
    queryKey: ["/api/employees"],
  });

  // Fetch goals for selected period
  const { data: goals = [], isLoading: goalsLoading } = useQuery<PerformanceGoal[]>({
    queryKey: ["performance-goals", { periodId: selectedPeriodId, employeeId: selectedEmployeeId }],
    queryFn: () => apiRequest("GET", `/api/performance/goals?periodId=${selectedPeriodId}${selectedEmployeeId ? `&employeeId=${selectedEmployeeId}` : ''}`).then(res => res.json()),
    enabled: !!selectedPeriodId,
    staleTime: 30000, // Cache 30s
  });

  // Fetch summary
  const { data: summary } = useQuery<PerformanceSummary>({
    queryKey: ["performance-summary", { periodId: selectedPeriodId, employeeId: selectedEmployeeId }],
    queryFn: () => apiRequest("GET", `/api/performance/summary?periodId=${selectedPeriodId}${selectedEmployeeId ? `&employeeId=${selectedEmployeeId}` : ''}`).then(res => res.json()),
    enabled: !!selectedPeriodId,
    staleTime: 30000, // Cache 30s
  });

  // Fetch team goals
  const { data: teamGoals = [], isLoading: teamGoalsLoading } = useQuery<PerformanceGoal[]>({
    queryKey: ["performance-team-goals", { periodId: selectedPeriodId }],
    queryFn: () => apiRequest("GET", `/api/performance/team?periodId=${selectedPeriodId}`).then(res => res.json()),
    enabled: !!selectedPeriodId,
    staleTime: 30000, // Cache for 30 seconds to prevent refetch lag
  });

  const [reportSearch, setReportSearch] = useState("");

  const { data: teamReport, isLoading: isReportLoading } = useQuery({
    queryKey: ["performance-report", { periodId: selectedPeriodId }],
    queryFn: () => apiRequest("GET", `/api/performance/reports/team-summary?periodId=${selectedPeriodId}`).then(res => res.json()),
    enabled: !!selectedPeriodId && canViewTeamPerformance(user?.role),
  });

  const handleExportExcel = () => {
    if (!selectedPeriodId) return;
    // Direct download
    window.location.href = `/api/performance/reports/team-summary.xlsx?periodId=${selectedPeriodId}`;
  };

  // Audit History
  const [historyGoalId, setHistoryGoalId] = useState<string | null>(null);
  const { data: auditLogs = [], isLoading: isAuditLoading } = useQuery<any[]>({
    queryKey: ["performance-audit", historyGoalId],
    queryFn: () => apiRequest("GET", `/api/performance/goals/${historyGoalId}/audit`).then(res => res.json()),
    enabled: !!historyGoalId,
  });

  // Bulk Actions
  const [selectedGoalIds, setSelectedGoalIds] = useState<string[]>([]);
  const [teamStatusFilter, setTeamStatusFilter] = useState<string>("all");

  // Filtered team goals
  const filteredTeamGoals = teamStatusFilter === "all"
    ? teamGoals
    : teamGoals.filter(g => g.status === teamStatusFilter);

  // Mutations
  const createPeriodMutation = useMutation({
    mutationFn: (data: z.infer<typeof periodFormSchema>) =>
      apiRequest("POST", "/api/performance/periods", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/periods"] });
      setIsAddPeriodOpen(false);
      toast({ title: "Амжилттай", description: "Шинэ үе үүслээ" });
    },
    onError: (err: any) => {
      toast({ title: "Алдаа", description: err.message, variant: "destructive" });
    },
  });

  const createGoalMutation = useMutation({
    mutationFn: (data: z.infer<typeof goalFormSchema>) =>
      apiRequest("POST", "/api/performance/goals", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance-goals"] });
      queryClient.invalidateQueries({ queryKey: ["performance-team-goals"] });
      queryClient.invalidateQueries({ queryKey: ["performance-summary"] });
      setIsAddGoalOpen(false);
      toast({ title: "Амжилттай", description: "Шинэ зорилт нэмэгдлээ" });
    },
    onError: (err: any) => {
      if (err.message && err.message.includes("403")) {
        toast({ title: "Хандах эрх хүрэлцэхгүй", description: "Та зөвхөн өөрийн зорилтыг үүсгэх эрхтэй.", variant: "destructive" });
      } else {
        toast({ title: "Алдаа", description: err.message, variant: "destructive" });
      }
    },
  });

  const updateGoalMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & Partial<z.infer<typeof goalFormSchema>>) =>
      apiRequest("PATCH", `/api/performance/goals/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance-goals"] });
      queryClient.invalidateQueries({ queryKey: ["performance-team-goals"] });
      queryClient.invalidateQueries({ queryKey: ["performance-summary"] });
      setEditingGoal(null);
      toast({ title: "Амжилттай", description: "Зорилт шинэчлэгдлээ" });
    },
    onError: (err: any) => {
      if (err.message && err.message.includes("403")) {
        toast({ title: "Хандах эрх хүрэлцэхгүй", description: "Та зөвхөн өөрийн зорилтыг засах боломжтой.", variant: "destructive" });
      } else {
        toast({ title: "Алдаа", description: err.message, variant: "destructive" });
      }
    },
  });

  const deleteGoalMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/performance/goals/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance-goals"] });
      queryClient.invalidateQueries({ queryKey: ["performance-team-goals"] });
      queryClient.invalidateQueries({ queryKey: ["performance-summary"] });
      toast({ title: "Амжилттай", description: "Зорилт устгагдлаа" });
    },
    onError: (err: any) => {
      toast({ title: "Алдаа", description: err.message, variant: "destructive" });
    },
  });

  // Workflow Mutations (Submit, Approve)
  const submitGoalMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/performance/goals/${id}/submit`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance-goals"] });
      queryClient.invalidateQueries({ queryKey: ["performance-team-goals"] });
      queryClient.invalidateQueries({ queryKey: ["performance-summary"] });
      toast({ title: "Амжилттай", description: "Зорилт илгээгдлээ" });
    },
    onError: (err: any) => {
      let message = err.message;
      try {
        if (message.includes("{")) {
          const jsonPart = message.substring(message.indexOf("{"));
          const parsed = JSON.parse(jsonPart);
          if (parsed.message) {
            if (parsed.message.includes("Total weight must be exactly 100%")) {
              message = `Нийт жин 100% байх ёстой. Одоо: ${parsed.message.split('Current total: ')[1] || '?'}`;
            } else {
              message = parsed.message;
            }
          }
        }
      } catch (e) { }
      toast({ title: "Анхааруулга", description: message, variant: "destructive" });
    },
  });

  const approveGoalMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/performance/goals/${id}/approve`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance-goals"] });
      queryClient.invalidateQueries({ queryKey: ["performance-team-goals"] });
      toast({ title: "Амжилттай", description: "Зорилт зөвшөөрөгдлөө" });
    },
    onError: (err: any) => {
      toast({ title: "Алдаа", description: err.message, variant: "destructive" });
    },
  });

  // Bulk Approve Mutation
  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      const results = await Promise.allSettled(
        ids.map(id => apiRequest("POST", `/api/performance/goals/${id}/approve`))
      );
      const failed = results.filter(r => r.status === "rejected").length;
      if (failed > 0) throw new Error(`${failed} зорилт амжилтгүй болсон`);
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance-team-goals"] });
      setSelectedGoalIds([]);
      toast({ title: "Амжилттай", description: `${selectedGoalIds.length} зорилт зөвшөөрөгдлөө` });
    },
    onError: (err: any) => {
      queryClient.invalidateQueries({ queryKey: ["performance-team-goals"] });
      setSelectedGoalIds([]);
      toast({ title: "Анхааруулга", description: err.message, variant: "destructive" });
    },
  });

  const evaluateGoalMutation = useMutation({
    mutationFn: ({ id, ...data }: { id: string } & z.infer<typeof evaluateFormSchema>) =>
      apiRequest("POST", `/api/performance/goals/${id}/evaluate`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["performance-goals"] });
      queryClient.invalidateQueries({ queryKey: ["performance-team-goals"] });
      queryClient.invalidateQueries({ queryKey: ["performance-summary"] });
      setEvaluateGoal(null);
      toast({ title: "Амжилттай", description: "Зорилт үнэлэгдлээ" });
    },
    onError: (err: any) => {
      toast({ title: "Алдаа", description: err.message, variant: "destructive" });
    },

  });

  const lockPeriodMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("POST", `/api/performance/periods/${id}/lock`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/performance/periods"] });
      queryClient.invalidateQueries({ queryKey: ["performance-goals"] });
      queryClient.invalidateQueries({ queryKey: ["performance-team-goals"] });
      queryClient.invalidateQueries({ queryKey: ["performance-summary"] });
      toast({ title: "Амжилттай", description: "Үнэлгээний үе түгжигдлээ" });
    },
    onError: (err: any) => {
      toast({ title: "Алдаа", description: err.message, variant: "destructive" });
    },
  });



  // Forms
  const periodForm = useForm<z.infer<typeof periodFormSchema>>({
    resolver: zodResolver(periodFormSchema),
    defaultValues: {
      name: "",
      startDate: format(new Date(), "yyyy-MM-dd"),
      endDate: "",
      status: "active",
    },
  });

  const goalForm = useForm<z.infer<typeof goalFormSchema>>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      periodId: selectedPeriodId || "",
      employeeId: "",
      title: "",
      description: "",
      metricType: "percent",
      targetValue: "100",
      currentValue: "0",
      weight: 10,
      progress: 0,
      status: "draft",
      dueDate: "",
    },
  });

  const editGoalForm = useForm<z.infer<typeof goalFormSchema>>({
    resolver: zodResolver(goalFormSchema),
    defaultValues: {
      periodId: "",
      employeeId: "",
      title: "",
      description: "",
      metricType: "percent",
      targetValue: "100",
      currentValue: "0",
      weight: 0,
      progress: 0,
      status: "draft",
      dueDate: "",
    },
  });

  const evaluateForm = useForm<z.infer<typeof evaluateFormSchema>>({
    resolver: zodResolver(evaluateFormSchema),
    defaultValues: {
      qualityRating: 5,
      managerComment: "",
      progressPercent: "",
    },
  });

  // Sync editing goal state with form
  useEffect(() => {
    if (editingGoal) {
      editGoalForm.reset({
        periodId: editingGoal.periodId,
        employeeId: editingGoal.employeeId,
        title: editingGoal.title,
        description: editingGoal.description || "",
        metricType: editingGoal.metricType,
        targetValue: editingGoal.targetValue,
        currentValue: editingGoal.currentValue,
        weight: editingGoal.weight,
        progress: editingGoal.progress,
        status: editingGoal.status,
        dueDate: editingGoal.dueDate || "",
      });
    }
  }, [editingGoal, editGoalForm]);

  // Sync evaluate goal state with form (optimize: early reset)
  useEffect(() => {
    if (evaluateGoal) {
      evaluateForm.reset({
        qualityRating: evaluateGoal.qualityRating || 5,
        managerComment: evaluateGoal.managerComment || "",
        progressPercent: String(evaluateGoal.progress || 0),
      });
    }
  }, [evaluateGoal]);

  // Sync selectedPeriodId with goalForm
  useEffect(() => {
    if (selectedPeriodId) {
      goalForm.setValue("periodId", selectedPeriodId);
    }
  }, [selectedPeriodId, goalForm]);

  // Calculate goal score
  const calculateScore = (weight: number, progress: number) => {
    return ((weight * progress) / 100).toFixed(1);
  };

  // Selected period
  const selectedPeriod = periods.find((p) => p.id === selectedPeriodId);
  const isPeriodLocked = selectedPeriod?.status === "locked";

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            {isEmployeeUser ? "Миний Зорилго" : "Гүйцэтгэлийн Удирдлага"}
          </h1>
          <p className="text-muted-foreground">KPI үнэлгээ ба төлөвлөгөө</p>
        </div>
        {canManage && (
          <Dialog open={isAddPeriodOpen} onOpenChange={setIsAddPeriodOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Шинэ Үе
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Шинэ Үнэлгээний Үе</DialogTitle>
                <DialogDescription>Жишээ: "2024 - Эхний хагас жил"</DialogDescription>
              </DialogHeader>
              <Form {...periodForm}>
                <form onSubmit={periodForm.handleSubmit((data) => createPeriodMutation.mutate(data))} className="space-y-4">
                  <FormField
                    control={periodForm.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Үеийн нэр</FormLabel>
                        <FormControl>
                          <Input placeholder="2024 - H1" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="grid grid-cols-2 gap-4">
                    <FormField
                      control={periodForm.control}
                      name="startDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Эхлэх огноо</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={periodForm.control}
                      name="endDate"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Дуусах огноо</FormLabel>
                          <FormControl>
                            <Input type="date" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                  <DialogFooter>
                    <Button type="submit" disabled={createPeriodMutation.isPending}>
                      {createPeriodMutation.isPending ? "Хадгалж байна..." : "Хадгалах"}
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Period Selector */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Үнэлгээний Үе
            </CardTitle>
            {selectedPeriodId && (
              <div className="flex gap-2">
                {selectedPeriod?.status === "active" && (user?.role === "manager" || user?.role === "admin") && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (confirm("Үнэлгээний үеийг түгжихдээ итгэлтэй байна уу? Түгжсэний дараа өөрчлөлт хийх боломжгүй.")) {
                        lockPeriodMutation.mutate(selectedPeriodId);
                      }
                    }}
                    disabled={lockPeriodMutation.isPending}
                  >
                    <Lock className="mr-2 h-4 w-4" />
                    {lockPeriodMutation.isPending ? "Түгжиж байна..." : "Түгжих"}
                  </Button>
                )}
                {selectedPeriod?.status === "locked" && (
                  <Button variant="outline" size="sm" disabled>
                    <Lock className="mr-2 h-4 w-4" />
                    Түгжигдсэн
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleExportPDF} disabled={isExporting}>
                  <FileDown className="mr-2 h-4 w-4" />
                  {isExporting ? "Хэвлэж байна..." : "Тайлан Хэвлэх"}
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {periodsLoading ? (
              <p className="text-muted-foreground">Ачаалж байна...</p>
            ) : periods.length === 0 ? (
              <p className="text-muted-foreground">Үе үүсгээгүй байна. "Шинэ Үе" товч дарна уу.</p>
            ) : (
              periods.map((period) => (
                <Button
                  key={period.id}
                  variant={selectedPeriodId === period.id ? "default" : "outline"}
                  onClick={() => setSelectedPeriodId(period.id)}
                  className="flex items-center gap-2"
                >
                  {period.name}
                  <Badge className={statusColors[period.status]}>{statusLabels[period.status]}</Badge>
                </Button>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {selectedPeriodId && (
        <Tabs defaultValue="my" className="w-full">
          {!isEmployeeUser && (
            <TabsList>
              <TabsTrigger value="my">Миний Зорилтууд</TabsTrigger>
              {isPrivileged(user?.role) && (
                <TabsTrigger value="inbox">Inbox</TabsTrigger>
              )}
              {canViewTeamPerformance(user?.role) && (
                <TabsTrigger value="team">Багийн Зорилтууд</TabsTrigger>
              )}
              {isPrivileged(user?.role) && (
                <TabsTrigger value="reports">Тайлан</TabsTrigger>
              )}
            </TabsList>
          )}

          <TabsContent value="inbox" className="space-y-6">
            <InboxList onReview={(goalId, status, inboxItem) => {
              // Try to find goal in currently loaded list, or fallback to inbox item data if structure matches,
              // or fetch fresh.
              const goal = goals.find(g => g.id === goalId);

              if (goal) {
                if (status === 'submitted' || status === 'approved') setEvaluateGoal(goal);
                else setEditingGoal(goal);
                return;
              }

              // If not found in current query (e.g. from different period), fetch it.
              apiRequest("GET", `/api/performance/goals/${goalId}`)
                .then(res => res.json())
                .then(g => {
                  if (status === 'submitted' || status === 'approved') setEvaluateGoal(g);
                  else setEditingGoal(g);
                })
                .catch(err => {
                  toast({ title: "Алдаа", description: "Зорилт олдсонгүй", variant: "destructive" });
                });
            }} />
          </TabsContent>

          <TabsContent value="my" className="space-y-4">


            {/* Summary Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Нийт Оноо</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-primary">{summary?.totalScore || 0}%</div>
                  <p className="text-xs text-muted-foreground">
                    (Жин × Гүйцэтгэл × Чанар) / 100
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Нийт Жин</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary?.totalWeight || 0}%</div>
                  <Progress value={summary?.totalWeight || 0} className="mt-2" />
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Зорилтууд</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{summary?.goalsCount || 0}</div>
                  <p className="text-xs text-muted-foreground">Нийт зорилт</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Дууссан</CardTitle>
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">{summary?.completedCount || 0}</div>
                  <p className="text-xs text-muted-foreground">Биелүүлсэн зорилт</p>
                </CardContent>
              </Card>
            </div>

            {/* Weight Warning Banner */}
            {!isEmployeeUser && (summary?.totalWeight || 0) !== 100 && goals.length > 0 && (
              <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-900 rounded-lg p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-yellow-100 dark:bg-yellow-900/50 p-2 rounded-full">
                    <Target className="h-5 w-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="font-medium text-yellow-800 dark:text-yellow-200">
                      Нийт жин 100% хүрээгүй байна
                    </p>
                    <p className="text-sm text-yellow-600 dark:text-yellow-400">
                      Одоо: <strong>{summary?.totalWeight || 0}%</strong> — Үлдсэн: <strong>{100 - (summary?.totalWeight || 0)}%</strong>
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className="border-yellow-500 text-yellow-700 dark:text-yellow-300">
                  Илгээх боломжгүй
                </Badge>
              </div>
            )}

            {/* Goals Table */}
            {goals.length === 0 ? (
              isEmployeeUser ? (
                <div className="text-center py-10 border rounded-lg bg-muted/20">
                  <h3 className="text-lg font-medium">Энэ улиралд танд оноогдсон зорилт алга</h3>
                  <p className="text-muted-foreground mt-2 mb-4">Менежерт хүсэлт илгээх эсвэл дараа шалгана уу.</p>
                  <div className="flex justify-center gap-2">
                    <Button variant="outline" onClick={() => setLocation("/me")}>Миний Профайл</Button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-10 space-y-4">
                  <div className="text-muted-foreground">Зорилт алга</div>
                  {!isPeriodLocked && canManage && (
                    <Button onClick={() => setIsAddGoalOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Зорилт Нэмэх
                    </Button>
                  )}
                </div>
              )
            ) : (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle>Зорилтууд (KPI)</CardTitle>
                    <CardDescription>{selectedPeriod?.name}</CardDescription>
                  </div>
                  <Dialog open={isAddGoalOpen} onOpenChange={setIsAddGoalOpen}>
                    {!isPeriodLocked && !isEmployeeUser && (
                      <DialogTrigger asChild>
                        <Button size="sm">
                          <Plus className="mr-2 h-4 w-4" />
                          Зорилт Нэмэх
                        </Button>
                      </DialogTrigger>
                    )}
                    <DialogContent className="max-w-lg">
                      <DialogHeader>
                        <DialogTitle>Шинэ Зорилт</DialogTitle>
                      </DialogHeader>
                      <Form {...goalForm}>
                        <form
                          onSubmit={goalForm.handleSubmit((data) =>
                            createGoalMutation.mutate({ ...data, periodId: selectedPeriodId! })
                          )}
                          className="space-y-4"
                        >
                          <FormField
                            control={goalForm.control}
                            name="employeeId"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Ажилтан</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue placeholder="Ажилтан сонгох" />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    {employees.map((emp: any) => (
                                      <SelectItem key={emp.id} value={emp.id}>
                                        {emp.firstName} {emp.lastName}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={goalForm.control}
                            name="title"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Зорилтын нэр</FormLabel>
                                <FormControl>
                                  <Input placeholder="Жишээ: Сарын тайлан гаргах" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={goalForm.control}
                            name="description"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Тайлбар</FormLabel>
                                <FormControl>
                                  <Textarea placeholder="Нэмэлт тайлбар..." {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={goalForm.control}
                            name="metricType"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Хэмжих төрөл</FormLabel>
                                <Select onValueChange={field.onChange} value={field.value}>
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="percent">Хувь (%)</SelectItem>
                                    <SelectItem value="number">Тоо хэмжээ</SelectItem>
                                    <SelectItem value="currency">Мөнгөн дүн</SelectItem>
                                    <SelectItem value="boolean">Тийм/Үгүй</SelectItem>
                                  </SelectContent>
                                </Select>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <div className="grid grid-cols-2 gap-4">
                            <FormField
                              control={goalForm.control}
                              name="targetValue"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Зорилтот утга</FormLabel>
                                  <FormControl>
                                    <Input {...field} disabled={isEmployeeUser} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            <FormField
                              control={goalForm.control}
                              name="currentValue"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>Одоогийн утга</FormLabel>
                                  <FormControl>
                                    <Input {...field} />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <FormField
                            control={goalForm.control}
                            name="weight"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Жин ({field.value}%)</FormLabel>
                                <FormControl>
                                  <Slider
                                    disabled={isEmployeeUser}
                                    min={0}
                                    max={100}
                                    step={5}
                                    value={[field.value]}
                                    onValueChange={(v) => field.onChange(v[0])}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={goalForm.control}
                            name="dueDate"
                            render={({ field }) => (
                              <FormItem className="flex flex-col">
                                <FormLabel>Дуусах хугацаа</FormLabel>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <FormControl>
                                      <Button
                                        variant={"outline"}
                                        className={cn(
                                          "w-full pl-3 text-left font-normal",
                                          !field.value && "text-muted-foreground"
                                        )}
                                      >
                                        {field.value ? (
                                          format(new Date(field.value), "PPP")
                                        ) : (
                                          <span>Огноо сонгох</span>
                                        )}
                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                      </Button>
                                    </FormControl>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                      mode="single"
                                      selected={field.value ? new Date(field.value) : undefined}
                                      onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                      disabled={(date) =>
                                        date < new Date("1900-01-01")
                                      }
                                      initialFocus
                                    />
                                  </PopoverContent>
                                </Popover>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <DialogFooter>
                            <Button type="submit" disabled={createGoalMutation.isPending}>
                              {createGoalMutation.isPending ? "Хадгалж байна..." : "Хадгалах"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </Form>
                    </DialogContent>
                  </Dialog>
                </CardHeader>
                <CardContent>
                  {goalsLoading ? (
                    <p className="text-muted-foreground">Ачаалж байна...</p>
                  ) : goals.length === 0 ? (
                    <p className="text-muted-foreground text-center py-8">
                      Зорилт байхгүй байна. "Зорилт Нэмэх" товч дарна уу.
                    </p>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Ажил</TableHead>
                          <TableHead className="w-20">Жин</TableHead>
                          <TableHead className="w-40">Гүйцэтгэл</TableHead>
                          <TableHead className="w-16 text-center">Чанар</TableHead>
                          <TableHead className="w-24">Төлөв</TableHead>
                          <TableHead className="w-20 text-right">Оноо</TableHead>
                          <TableHead className="w-28"></TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {goals.map((goal) => (
                          <TableRow key={goal.id}>
                            <TableCell>
                              <div>
                                <p className="font-medium">{goal.title}</p>
                                {goal.description && (
                                  <p className="text-sm text-muted-foreground line-clamp-1">{goal.description}</p>
                                )}
                                {/* Due Date Warning */}
                                {goal.dueDate && !["evaluated", "locked", "approved"].includes(goal.status) && (
                                  (() => {
                                    const daysLeft = Math.ceil((new Date(goal.dueDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                                    if (daysLeft < 0) return <Badge variant="destructive" className="mt-1 text-[10px] px-1 h-5">Хугацаа хэтэрсэн</Badge>;
                                    if (daysLeft <= 3) return <Badge variant="outline" className="mt-1 text-orange-600 border-orange-200 bg-orange-50 text-[10px] px-1 h-5">⏳ {daysLeft} хоног үлдлээ</Badge>;
                                    return null;
                                  })()
                                )}
                              </div>
                            </TableCell>
                            <TableCell>{goal.weight}%</TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <Progress value={goal.progress} className="flex-1" />
                                <span className="text-sm text-muted-foreground w-12">{goal.progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-center">
                              {goal.qualityRating ? (
                                <span className="font-medium text-purple-600">{goal.qualityRating}/5</span>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </TableCell>
                            <TableCell>
                              <Badge className={statusColors[goal.status]}>{statusLabels[goal.status]}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold">
                              {calculateGoalScore(goal.weight, goal.progress, goal.qualityRating)}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {goal.status === "draft" && !isPeriodLocked && (
                                  <Button variant="ghost" size="icon" title="Илгээх" onClick={() => submitGoalMutation.mutate(goal.id)}>
                                    <CheckCircle className="h-4 w-4 text-blue-500" />
                                  </Button>
                                )}
                                {goal.status === "approved" && !isPeriodLocked && isEmployeeUser && (
                                  // Quick Update Action for Employee
                                  <Button variant="ghost" size="icon" title="Явц шинэчлэх" onClick={() => setEditingGoal(goal)}>
                                    <TrendingUp className="h-4 w-4 text-primary" />
                                  </Button>
                                )}

                                {goal.status === "submitted" && !isPeriodLocked && (
                                  <Button variant="ghost" size="icon" title="Зөвшөөрөх" onClick={() => approveGoalMutation.mutate(goal.id)}>
                                    <CheckCircle className="h-4 w-4 text-green-500" />
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setEditingGoal(goal)}
                                  disabled={isPeriodLocked || goal.status === "locked" || (goal.status === "evaluated" && isEmployeeUser)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => deleteGoalMutation.mutate(goal.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title={`Нотлох баримт${goal.evidence?.length ? ` (${goal.evidence.length})` : ''}`}
                                  onClick={() => setEvidenceGoalId(goal.id)}
                                  className={!goal.evidence?.length ? "text-muted-foreground/50" : ""}
                                >
                                  <div className="relative">
                                    <LinkIcon className="h-4 w-4" />
                                    {(goal.evidence?.length ?? 0) > 0 && (
                                      <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                                        {goal.evidence?.length}
                                      </span>
                                    )}
                                  </div>
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Түүх"
                                  onClick={() => setHistoryGoalId(goal.id)}
                                >
                                  <History className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Edit Goal Dialog */}
            <Dialog open={!!editingGoal} onOpenChange={(open) => !open && setEditingGoal(null)}>
              <DialogContent className="max-w-lg">
                <DialogHeader>
                  <DialogTitle>Зорилт Засах</DialogTitle>
                </DialogHeader>
                <Form {...editGoalForm}>
                  <form
                    onSubmit={editGoalForm.handleSubmit((data) =>
                      updateGoalMutation.mutate({ id: editingGoal!.id, ...data })
                    )}
                    className="space-y-4"
                  >
                    <FormField
                      control={editGoalForm.control}
                      name="title"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Зорилтын нэр</FormLabel>
                          <FormControl>
                            <Input placeholder="Жишээ: Сарын тайлан гаргах" {...field} disabled={isEmployeeUser} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editGoalForm.control}
                      name="description"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Тайлбар</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Нэмэлт тайлбар..." {...field} disabled={isEmployeeUser} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={editGoalForm.control}
                      name="metricType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Хэмжих төрөл</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="percent" disabled={isEmployeeUser}>Хувь (%)</SelectItem>
                              <SelectItem value="number" disabled={isEmployeeUser}>Тоо хэмжээ</SelectItem>
                              <SelectItem value="currency" disabled={isEmployeeUser}>Мөнгөн дүн</SelectItem>
                              <SelectItem value="boolean" disabled={isEmployeeUser}>Тийм/Үгүй</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editGoalForm.control}
                        name="targetValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Зорилтот утга</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editGoalForm.control}
                        name="currentValue"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Одоогийн утга</FormLabel>
                            <FormControl>
                              <Input {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editGoalForm.control}
                        name="weight"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Жин ({field.value}%)</FormLabel>
                            <FormControl>
                              <Slider
                                min={0}
                                max={100}
                                step={5}
                                value={[field.value]}
                                onValueChange={(v) => field.onChange(v[0])}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editGoalForm.control}
                        name="progress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Гүйцэтгэл ({field.value}%)</FormLabel>
                            <FormControl>
                              <Slider
                                min={0}
                                max={100}
                                step={5}
                                value={[field.value]}
                                onValueChange={(v) => field.onChange(v[0])}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={editGoalForm.control}
                        name="status"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Төлөв</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger>
                                  <SelectValue />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                <SelectItem value="draft">Ноорог</SelectItem>
                                <SelectItem value="submitted">Илгээсэн</SelectItem>
                                <SelectItem value="approved">Зөвшөөрсөн</SelectItem>
                                <SelectItem value="evaluated">Үнэлсэн</SelectItem>
                                <SelectItem value="locked">Түгжсэн</SelectItem>
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={editGoalForm.control}
                        name="dueDate"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>Дуусах хугацаа</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    disabled={isEmployeeUser}
                                    variant={"outline"}
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(new Date(field.value), "PPP")
                                    ) : (
                                      <span>Огноо сонгох</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value ? new Date(field.value) : undefined}
                                  onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                  disabled={(date) =>
                                    date < new Date("1900-01-01")
                                  }
                                  initialFocus
                                />
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setEditingGoal(null)}>
                        Болих
                      </Button>
                      <Button type="submit" disabled={updateGoalMutation.isPending}>
                        {updateGoalMutation.isPending ? "Хадгалж байна..." : "Хадгалах"}
                      </Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </TabsContent>

          <TabsContent value="team" className="space-y-4">
            {/* Filter and Bulk Actions */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Select value={teamStatusFilter} onValueChange={setTeamStatusFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Төлөв шүүх" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Бүгд</SelectItem>
                    <SelectItem value="submitted">Илгээсэн</SelectItem>
                    <SelectItem value="approved">Зөвшөөрсөн</SelectItem>
                    <SelectItem value="evaluated">Үнэлсэн</SelectItem>
                  </SelectContent>
                </Select>
                {selectedGoalIds.length > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {selectedGoalIds.length} сонгосон
                  </span>
                )}
              </div>
              {selectedGoalIds.length > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => bulkApproveMutation.mutate(selectedGoalIds)}
                    disabled={bulkApproveMutation.isPending || selectedGoalIds.every(id => {
                      const goal = teamGoals.find(g => g.id === id);
                      return goal?.status !== "submitted";
                    })}
                  >
                    {bulkApproveMutation.isPending ? "Батлаж байна..." : `Бөөнөөр батлах (${selectedGoalIds.filter(id => teamGoals.find(g => g.id === id)?.status === "submitted").length})`}
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setSelectedGoalIds([])}>
                    Цуцлах
                  </Button>
                </div>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Багийн Гүйцэтгэл</CardTitle>
                <CardDescription>Удирдлагын хяналт ({filteredTeamGoals.length} зорилт)</CardDescription>
              </CardHeader>
              <CardContent>
                {teamGoalsLoading ? (
                  <p>Ачаалж байна...</p>
                ) : filteredTeamGoals.length === 0 ? (
                  <p className="text-muted-foreground p-4 text-center">Багийн зорилт байхгүй байна.</p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">
                          <Checkbox
                            checked={selectedGoalIds.length === filteredTeamGoals.length && filteredTeamGoals.length > 0}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedGoalIds(filteredTeamGoals.map(g => g.id));
                              } else {
                                setSelectedGoalIds([]);
                              }
                            }}
                          />
                        </TableHead>
                        <TableHead>Ажилтан</TableHead>
                        <TableHead>Зорилт</TableHead>
                        <TableHead>Гүйцэтгэл</TableHead>
                        <TableHead className="text-center">Чанар</TableHead>
                        <TableHead>Оноо</TableHead>
                        <TableHead>Төлөв</TableHead>
                        <TableHead>Нотлох</TableHead>
                        <TableHead className="text-right">Үйлдэл</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTeamGoals.map((goal) => (
                        <TableRow key={goal.id} className={selectedGoalIds.includes(goal.id) ? "bg-muted/50" : ""}>
                          <TableCell>
                            <Checkbox
                              checked={selectedGoalIds.includes(goal.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedGoalIds([...selectedGoalIds, goal.id]);
                                } else {
                                  setSelectedGoalIds(selectedGoalIds.filter(id => id !== goal.id));
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">
                                {(goal as any).employee?.firstName || goal.employeeId}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {(goal as any).employee?.position || ""}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{goal.title}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress value={goal.progress} className="w-24" />
                              <span>{goal.progress}%</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            {goal.qualityRating ? (
                              <span className="font-medium text-purple-600">{goal.qualityRating}/5</span>
                            ) : (
                              <span className="text-muted-foreground">-</span>
                            )}
                          </TableCell>
                          <TableCell>
                            <span className="font-bold">{calculateGoalScore(goal.weight, goal.progress, goal.qualityRating)}</span>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[goal.status]}>{statusLabels[goal.status]}</Badge>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => setEvidenceGoalId(goal.id)}
                              className={!(goal.evidence?.length) ? "text-muted-foreground/50" : ""}
                              title={`Нотлох баримт${goal.evidence?.length ? ` (${goal.evidence.length})` : ''}`}
                            >
                              <div className="relative">
                                <LinkIcon className="h-4 w-4" />
                                {(goal.evidence?.length ?? 0) > 0 && (
                                  <span className="absolute -top-1.5 -right-1.5 bg-primary text-primary-foreground text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                                    {goal.evidence?.length}
                                  </span>
                                )}
                              </div>
                            </Button>
                          </TableCell>
                          <TableCell className="text-right">
                            {goal.status === "approved" && !isPeriodLocked && (
                              <Button size="sm" onClick={() => setEvaluateGoal(goal)}>
                                Үнэлэх
                              </Button>
                            )}
                            {goal.status === "submitted" && !isPeriodLocked && (
                              <Button size="sm" onClick={() => approveGoalMutation.mutate(goal.id)}>
                                Батлах
                              </Button>
                            )}
                            {goal.status === "evaluated" && (
                              <Button size="sm" variant="outline" onClick={() => setEvaluateGoal(goal)}>
                                Харах
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="reports" className="space-y-4">
            <div className="flex items-center justify-between print:hidden">
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Ажилтны нэрээр хайх..."
                  value={reportSearch}
                  onChange={(e) => setReportSearch(e.target.value)}
                  className="w-[300px]"
                />
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" onClick={() => window.print()}>
                  <Printer className="mr-2 h-4 w-4" />
                  Хэвлэх
                </Button>
                <Button variant="outline" onClick={handleExportExcel}>
                  <FileDown className="mr-2 h-4 w-4" />
                  Excel татах
                </Button>
              </div>
            </div>

            {/* Print Header - only visible when printing */}
            <div className="hidden print:block print:mb-6">
              <h1 className="text-2xl font-bold">Гүйцэтгэлийн Тайлан</h1>
              <p className="text-muted-foreground">{selectedPeriod?.name} | Хэвлэсэн: {format(new Date(), "yyyy-MM-dd HH:mm")}</p>
            </div>

            {/* Report Cards */}
            <div className="grid gap-4 md:grid-cols-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Нийт Ажилтан</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{teamReport?.totals?.employeeCount || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Нийт Зорилт</CardTitle>
                  <Target className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{teamReport?.totals?.goalCount || 0}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Дундаж Гүйцэтгэл</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{teamReport?.totals?.avgCompletion || 0}%</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Хугацаа хэтэрсэн</CardTitle>
                  <CalendarIcon className="h-4 w-4 text-destructive" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-destructive">{teamReport?.totals?.overdueGoals || 0}</div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Багийн Гүйцэтгэлийн Тайлан</CardTitle>
                <CardDescription>
                  {selectedPeriod?.name} үеийн нэгдсэн тайлан
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Ажилтан</TableHead>
                      <TableHead>Албан тушаал</TableHead>
                      <TableHead>Хэлтэс</TableHead>
                      <TableHead className="text-right">Нийт Жин</TableHead>
                      <TableHead className="text-right">Нийт Оноо</TableHead>
                      <TableHead className="text-right">Зорилт</TableHead>
                      <TableHead className="text-right">Биелсэн</TableHead>
                      <TableHead className="text-right">Хэтэрсэн</TableHead>
                      <TableHead className="text-right">Чанар (Дундаж)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isReportLoading ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-4">Уншиж байна...</TableCell>
                      </TableRow>
                    ) : teamReport?.rows?.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={9} className="text-center py-4 text-muted-foreground">Өгөгдөл алга</TableCell>
                      </TableRow>
                    ) : (
                      teamReport?.rows
                        ?.filter((row: any) => row.employeeName.toLowerCase().includes(reportSearch.toLowerCase()))
                        .map((row: any) => (
                          <TableRow key={row.employeeId}>
                            <TableCell className="font-medium">{row.employeeName}</TableCell>
                            <TableCell>{row.position}</TableCell>
                            <TableCell>{row.department}</TableCell>
                            <TableCell className="text-right">{row.totalWeight}</TableCell>
                            <TableCell className="text-right">
                              <Badge variant={parseFloat(row.totalScore) >= 90 ? "default" : "secondary"}>
                                {row.totalScore}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">{row.goalsTotal}</TableCell>
                            <TableCell className="text-right text-green-600 font-medium">{row.goalsCompleted}</TableCell>
                            <TableCell className="text-right text-destructive font-medium">{row.goalsOverdue}</TableCell>
                            <TableCell className="text-right">{row.avgQuality}</TableCell>
                          </TableRow>
                        ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {/* Evaluate Goal Dialog - placed outside Tabs to work from any tab */}
      <Dialog open={!!evaluateGoal} onOpenChange={(open) => !open && setEvaluateGoal(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Зорилт Үнэлэх</DialogTitle>
            {evaluateGoal && (
              <p className="text-sm text-muted-foreground">{evaluateGoal.title}</p>
            )}
          </DialogHeader>

          {/* Evidence Warning */}
          {evaluateGoal && !(evaluateGoal.evidence?.length) && evaluateGoal.status !== "evaluated" && (
            <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3 flex items-center gap-2">
              <Target className="h-5 w-5 text-yellow-600" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Нотлох баримт шаардлагатай</p>
                <p className="text-yellow-600">Үнэлгээ хийхийн өмнө нотлох баримт оруулна уу.</p>
              </div>
            </div>
          )}

          <Form {...evaluateForm}>
            <form
              onSubmit={evaluateForm.handleSubmit((data) =>
                evaluateGoalMutation.mutate({ id: evaluateGoal!.id, ...data })
              )}
              className="space-y-4"
            >
              <FormField
                control={evaluateForm.control}
                name="qualityRating"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Чанарын үнэлгээ (1-5)</FormLabel>
                    <FormControl>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((rating) => (
                          <Button
                            key={rating}
                            type="button"
                            variant={field.value === rating ? "default" : "outline"}
                            className={cn(
                              "w-10 h-10 p-0",
                              field.value === rating && "bg-purple-600 text-white hover:bg-purple-700"
                            )}
                            onClick={() => field.onChange(rating)}
                          >
                            {rating}
                          </Button>
                        ))}
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={evaluateForm.control}
                name="managerComment"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Сэтгэгдэл</FormLabel>
                    <FormControl>
                      <Textarea {...field} placeholder="Үнэлгээний сэтгэгдэл..." />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setEvaluateGoal(null)}>
                  Болих
                </Button>
                {evaluateGoal && !(evaluateGoal.evidence?.length) && evaluateGoal.status !== "evaluated" && (
                  <Button type="button" variant="secondary" onClick={() => {
                    setEvaluateGoal(null);
                    setEvidenceGoalId(evaluateGoal.id);
                  }}>
                    Баримт оруулах
                  </Button>
                )}
                {evaluateGoal?.status !== "evaluated" && (evaluateGoal?.evidence?.length ?? 0) > 0 && (
                  <Button type="submit" disabled={evaluateGoalMutation.isPending}>
                    {evaluateGoalMutation.isPending ? "Хадгалж байна..." : "Үнэлэх"}
                  </Button>
                )}
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <EvidenceModal
        goalId={evidenceGoalId}
        initialEvidence={
          goals.find(g => g.id === evidenceGoalId)?.evidence ||
          teamGoals.find(g => g.id === evidenceGoalId)?.evidence ||
          []
        }
        readOnly={
          (() => {
            const goal = goals.find(g => g.id === evidenceGoalId) || teamGoals.find(g => g.id === evidenceGoalId);
            if (!goal) return false;
            if (isPeriodLocked || goal.status === "locked") return true;
            if (goal.status === "evaluated" && isEmployeeUser) return true;
            return false;
          })()
        }
        open={!!evidenceGoalId}
        onOpenChange={(open) => !open && setEvidenceGoalId(null)}
      />

      {/* Audit History Dialog */}
      <Dialog open={!!historyGoalId} onOpenChange={(open) => !open && setHistoryGoalId(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>Зорилтын түүх</DialogTitle>
            <DialogDescription>
              Энэ зорилт дээр хийгдсэн бүх үйлдлийн түүх
            </DialogDescription>
          </DialogHeader>
          {isAuditLoading ? (
            <p className="text-muted-foreground text-center py-4">Уншиж байна...</p>
          ) : auditLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">Түүх олдсонгүй</p>
          ) : (
            <div className="space-y-4">
              {auditLogs.map((log: any, index: number) => (
                <div key={log.id || index} className="flex gap-4 items-start border-l-2 border-primary/20 pl-4 pb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="outline" className="capitalize">{log.action}</Badge>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(log.eventTime), "yyyy-MM-dd HH:mm")}
                      </span>
                    </div>
                    {log.message && (
                      <p className="text-sm">{log.message}</p>
                    )}
                    {log.beforeData && log.afterData && (
                      <details className="mt-2">
                        <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                          Өөрчлөлтийн дэлгэрэнгүй
                        </summary>
                        <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                          <div className="bg-red-50 dark:bg-red-950/20 p-2 rounded">
                            <p className="font-medium mb-1">Өмнөх:</p>
                            <pre className="whitespace-pre-wrap overflow-auto max-h-32">
                              {JSON.stringify(log.beforeData, null, 2)}
                            </pre>
                          </div>
                          <div className="bg-green-50 dark:bg-green-950/20 p-2 rounded">
                            <p className="font-medium mb-1">Дараах:</p>
                            <pre className="whitespace-pre-wrap overflow-auto max-h-32">
                              {JSON.stringify(log.afterData, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </details>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InboxList({ onReview }: { onReview: (goalId: string, status: string, item?: any) => void }) {
  const { data: items, isLoading } = useQuery({
    queryKey: ["/api/performance/inbox"],
    queryFn: () => apiRequest("GET", "/api/performance/inbox").then(res => res.json())
  });

  if (isLoading) return <div className="text-center py-4 text-muted-foreground">Уншиж байна...</div>;

  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 border rounded-lg bg-muted/20">
        <div className="bg-muted p-3 rounded-full mb-3">
          <CheckCircle className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground">Шинэ мэдээлэл алга</p>
      </div>
    );
  }

  const getActionBadges = (item: any) => {
    const badges = [];
    if (item.action === 'evidence') badges.push(<Badge variant="secondary" key="ev">Evidence</Badge>);
    if (item.action === 'submit') badges.push(<Badge variant="default" className="bg-blue-600" key="sub">Submitted</Badge>);
    if (item.action === 'create') badges.push(<Badge variant="outline" key="new">New</Badge>);
    if (item.dueDate && new Date(item.dueDate) < new Date()) badges.push(<Badge variant="destructive" key="over">Overdue</Badge>);
    return badges;
  };

  const getMessage = (item: any) => {
    switch (item.action) {
      case 'create': return `Created goal "${item.goalTitle}"`;
      case 'update': return `Updated goal "${item.goalTitle}"`;
      case 'submit': return `Submitted goal "${item.goalTitle}" for approval`;
      case 'approve': return `Approved goal "${item.goalTitle}"`;
      case 'evaluate': return `Evaluated goal "${item.goalTitle}"`;
      case 'evidence': return `Added evidence to "${item.goalTitle}"`;
      default: return item.message || "Updated goal";
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium px-1">Сүүлд хийгдсэн үйлдлүүд</h3>
      <div className="grid gap-3">
        {items.map((item: any) => (
          <Card key={item.logId} className="hover:bg-muted/50 transition-colors">
            <CardHeader className="p-4">
              <div className="flex justify-between items-start gap-4">
                <div className="flex gap-3 items-start">
                  <div className="mt-1">
                    <Avatar className="h-9 w-9 border">
                      <AvatarFallback className="bg-primary/10 text-primary uppercase text-xs">
                        {item.actorName ? item.actorName.split(' ').map((n: string) => n[0]).join('').substring(0, 2) : "UN"}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{item.actorName}</span>
                      <span className="text-muted-foreground text-xs">•</span>
                      <span className="text-sm text-foreground/90">{getMessage(item)}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <CalendarIcon className="h-3 w-3" />
                      {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}

                      <div className="flex gap-1 ml-2">
                        {getActionBadges(item)}
                      </div>
                    </div>
                  </div>
                </div>
                <Button size="sm" variant={item.action === 'submit' ? "default" : "outline"} onClick={() => onReview(item.goalId, item.goalStatus, item)}>
                  {item.action === 'submit' ? "Үнэлэх" : "Харах"}
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </div>
    </div>
  );
}
