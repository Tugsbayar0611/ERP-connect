import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { format } from "date-fns";
import {
    Plus, Search, Filter, AlertTriangle, CheckCircle, Clock,
    Shield, Info, Phone, LifeBuoy, Users, MapPin,
    FileText, EyeOff, Calendar, ChevronRight,
    MessageSquare, Briefcase, CheckCircle2, Activity,
    Globe, Lock, ArrowRight, Trash2, Edit
} from "lucide-react";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
    CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
    FormDescription,
} from "@/components/ui/form";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

// --- Translation Layer ---
const TYPE_LABELS: Record<string, string> = {
    hazard: "Аюул / Эрсдэл",
    near_miss: "Ослын өмнөх нөхцөл",
    incident: "Осол / Гэмтэл",
    property_damage: "Эд хөрөнгийн эвдрэл",
};

const SEVERITY_LABELS: Record<string, string> = {
    low: "Бага",
    medium: "Дунд",
    high: "Өндөр",
    urgent: "Яаралтай",
};

const STATUS_LABELS: Record<string, string> = {
    reported: "Бүртгэгдсэн",
    investigating: "Шалгаж буй",
    resolved: "Шийдвэрлэсэн",
    closed: "Хаагдсан",
};

const SEVERITY_COLORS: Record<string, string> = {
    urgent: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/40 dark:text-red-300",
    high: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-900/40 dark:text-orange-300",
    medium: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/40 dark:text-yellow-300",
    low: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/40 dark:text-blue-300",
};

// Form Schema
const incidentFormSchema = z.object({
    title: z.string().min(1, "Гарчиг оруулна уу"),
    incidentType: z.enum(["incident", "near_miss", "hazard", "property_damage"]),
    date: z.string().min(1, "Огноо сонгоно уу"),
    location: z.string().min(1, "Байршил оруулна уу"),
    severity: z.enum(["low", "medium", "high", "urgent"]),
    description: z.string().min(10, "Дэлгэрэнгүй тайлбар оруулна уу (багадаа 10 тэмдэгт)"),
    isAnonymous: z.boolean().default(false),
    status: z.enum(["reported", "investigating", "resolved", "closed"]).default("reported"),
});

type IncidentForm = z.infer<typeof incidentFormSchema>;

export default function Safety() {
    const [activeTab, setActiveTab] = useState("my_reports");
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [selectedIncident, setSelectedIncident] = useState<any>(null);
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    // Permissions
    const userRole = user?.role?.toLowerCase();
    const canManageAll = ["admin", "hr", "manager"].includes(userRole || "");

    // Fetching Logic
    const { data: safetyData, isLoading, refetch } = useQuery<any>({
        queryKey: ["/api/safety"],
        queryFn: async () => {
            const res = await apiRequest("GET", "/api/safety");
            return await res.json();
        },
        enabled: !!user,
    });

    // Handle Data Structure (Object vs Array)
    const isArrayResponse = Array.isArray(safetyData);

    // Derived values
    const myReports = isArrayResponse
        ? safetyData.filter((i: any) => i.reportedBy === user?.id)
        : (safetyData?.my || []);

    const publicFeed = isArrayResponse
        ? safetyData.filter((i: any) => i.reportedBy !== user?.id)
        : (safetyData?.public || []);

    // If canManageAll, they might see ALL in 'safetyData' if backend sends array,
    // or they might see object if backend strictly sends {my, public} even for admins (though backend logic says admin gets array).
    // Let's rely on the backend response structure.

    const displayReports = activeTab === "my_reports"
        ? (canManageAll ? (isArrayResponse ? safetyData : myReports) : myReports)
        : publicFeed;

    // Stats
    const openIncidentsCount = (isArrayResponse ? safetyData : [...myReports, ...publicFeed])?.filter((i: any) => ["reported", "investigating"].includes(i.status)).length || 0;
    const resolvedCount = (isArrayResponse ? safetyData : [...myReports, ...publicFeed])?.filter((i: any) => ["resolved", "closed"].includes(i.status)).length || 0;
    const myTotal = myReports.length;

    const form = useForm<IncidentForm>({
        resolver: zodResolver(incidentFormSchema),
        defaultValues: {
            title: "",
            incidentType: "hazard",
            date: format(new Date(), "yyyy-MM-dd"),
            location: "",
            severity: "low",
            description: "",
            isAnonymous: false,
            status: "reported",
        },
    });

    const createMutation = useMutation({
        mutationFn: (data: IncidentForm) =>
            apiRequest("POST", "/api/safety", {
                ...data,
                date: new Date(data.date).toISOString(),
            }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/safety"] });
            setIsAddOpen(false);
            setActiveTab("my_reports");
            form.reset();
            toast({ title: "Амжилттай", description: "Мэдээлэл бүртгэгдлээ." });
        },
        onError: (err: any) => {
            toast({
                title: "Алдаа",
                description: err.message || "Бүртгэл хийхэд алдаа гарлаа",
                variant: "destructive"
            });
        },
    });

    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: string, status: string }) =>
            apiRequest("PATCH", `/api/safety/${id}`, { status }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/safety"] });
            toast({ title: "Статус шинэчлэгдлээ" });
            setSelectedIncident(null);
        },
        onError: (err: any) => {
            toast({ title: "Алдаа", description: err.message || "Статус өөрчлөх боломжгүй", variant: "destructive" });
        }
    });

    const deleteMutation = useMutation({
        mutationFn: (id: string) => apiRequest("DELETE", `/api/safety/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/safety"] });
            toast({ title: "Амжилттай устгагдлаа" });
            setSelectedIncident(null);
        },
        onError: (err: any) => {
            toast({ title: "Алдаа", description: err.message || "Устгах боломжгүй", variant: "destructive" });
        }
    });

    const getStatusBadge = (s: string) => {
        switch (s) {
            case "resolved": return <Badge className="bg-green-600 shadow-sm shadow-green-500/20">Шийдвэрлэсэн</Badge>;
            case "closed": return <Badge variant="secondary">Хаагдсан</Badge>;
            case "investigating": return <Badge className="bg-blue-600 shadow-sm shadow-blue-500/20">Шалгаж буй</Badge>;
            default: return <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50 font-bold">Бүртгэгдсэн</Badge>;
        }
    };

    const StatusTimeline = ({ status }: { status: string }) => {
        const statuses = ["reported", "investigating", "resolved", "closed"];
        const currentIndex = statuses.indexOf(status);

        return (
            <div className="space-y-4 my-6">
                {statuses.map((s, idx) => {
                    const isActive = idx <= currentIndex;
                    const isCurrent = idx === currentIndex;

                    return (
                        <div key={s} className="flex items-start gap-4 relative">
                            {/* Connector Line */}
                            {idx < statuses.length - 1 && (
                                <div className={`absolute left-[11px] top-6 w-[2px] h-6 ${isActive && idx < currentIndex ? "bg-blue-600" : "bg-muted"}`} />
                            )}
                            {/* Dot */}
                            <div className={`mt-1.5 w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 z-10 ${isActive ? "bg-blue-600 border-blue-600 shadow-sm" : "bg-background border-muted"
                                }`}>
                                {isActive ? <CheckCircle2 className="w-4 h-4 text-white" /> : <div className="w-2 h-2 rounded-full bg-muted" />}
                            </div>
                            <div className="flex flex-col">
                                <span className={`text-sm font-bold ${isActive ? "text-foreground" : "text-muted-foreground"}`}>
                                    {STATUS_LABELS[s]}
                                </span>
                                {isCurrent && (
                                    <span className="text-[10px] text-blue-600 font-bold bg-blue-50 dark:bg-blue-900/30 px-2 py-0.5 rounded-full w-fit uppercase tracking-tighter mt-1">
                                        Одоогийн төлөв
                                    </span>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        );
    };

    const IncidentCard = ({ incident }: { incident: any }) => {
        const isMyReport = incident.reportedBy === user?.id;
        // const isOwner = incident.reportedBy === user?.id; // Same as above
        const isPublic = incident.isPublicRecord;

        return (
            <Card
                className={`group hover:shadow-2xl transition-all border-none ring-1 ring-muted-foreground/10 cursor-pointer overflow-hidden rounded-2xl flex flex-col h-full ${isPublic ? "opacity-90" : ""}`}
                onClick={() => setSelectedIncident(incident)}
            >
                {/* Header Strip */}
                <div className={`h-1.5 bg-gradient-to-r ${isPublic ? "from-slate-400 to-slate-500" : "from-blue-600 to-indigo-600"}`} />

                <CardHeader className="pb-3 space-y-3">
                    <div className="flex justify-between items-start gap-2">
                        {/* Badge Row */}
                        <Badge className={`px-2 py-0.5 rounded-md font-bold uppercase text-[10px] tracking-tight border-none ${SEVERITY_COLORS[incident.severity] || SEVERITY_COLORS.low}`}>
                            {SEVERITY_LABELS[incident.severity] || incident.severity}
                        </Badge>
                        {getStatusBadge(incident.status)}
                    </div>
                    {/* Title */}
                    <CardTitle className="text-lg font-bold leading-tight group-hover:text-blue-600 transition-colors line-clamp-2">
                        {incident.title}
                    </CardTitle>
                    {/* Meta Row */}
                    <div className="flex flex-wrap items-center gap-3 text-[10px] font-bold uppercase text-muted-foreground tracking-wide">
                        <span className="flex items-center gap-1.5 overflow-hidden max-w-[120px]">
                            <MapPin className="w-3 h-3 text-blue-500 shrink-0" />
                            <span className="truncate">{incident.location || "-"}</span>
                        </span>
                        <span className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3 text-indigo-500 shrink-0" />
                            {format(new Date(incident.date), "yyyy-MM-dd")}
                        </span>
                    </div>
                </CardHeader>

                <CardContent className="flex-1 pb-4">
                    <Badge variant="secondary" className="mb-3 bg-muted/50 text-muted-foreground font-semibold uppercase text-[9px] tracking-wider border-none">
                        {TYPE_LABELS[incident.incidentType] || "Бусад"}
                    </Badge>
                    <p className="text-sm text-foreground/80 line-clamp-2 italic">
                        {incident.description ? `"${incident.description}"` : '"Анонимчилсан мэдээлэл"'}
                    </p>
                </CardContent>

                <CardFooter className="pt-3 pb-4 px-6 border-t border-muted/20 bg-muted/5 flex justify-between items-center mt-auto">
                    <div className="flex items-center gap-2">
                        {isMyReport ? (
                            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-blue-600 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md">
                                <Users className="w-3 h-3" />
                                Минийх
                            </div>
                        ) : (
                            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase tracking-widest text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded-md">
                                <Globe className="w-3 h-3" />
                                {incident.isAnonymous ? "Нууц" : "Нийтийн"}
                            </div>
                        )}
                    </div>
                    <span className="text-xs font-bold text-blue-600 flex items-center group-hover:underline">
                        Дэлгэрэнгүй <ArrowRight className="w-3 h-3 ml-1" />
                    </span>
                </CardFooter>
            </Card>
        );
    };

    return (
        <div className="container mx-auto p-4 md:p-6 space-y-8 text-foreground pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                <div>
                    <h1 className="text-3xl md:text-4xl font-black tracking-tight bg-gradient-to-r from-blue-700 via-indigo-600 to-blue-700 bg-clip-text text-transparent">
                        HSE Hub
                    </h1>
                    <p className="text-muted-foreground mt-1 font-medium italic uppercase tracking-tighter text-[10px] opacity-70">
                        Health, Safety & Environment
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    {/* Debug Button for Admin Only */}
                    {userRole === 'admin' && (
                        <Button variant="outline" size="icon" onClick={() => refetch()} className="rounded-xl" title="Refresh">
                            <Activity className="w-5 h-5 text-muted-foreground" />
                        </Button>
                    )}

                    <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                        <DialogTrigger asChild>
                            <Button size="lg" className="bg-blue-600 hover:bg-blue-700 shadow-xl shadow-blue-500/20 font-bold px-8 h-12 rounded-xl">
                                <Plus className="mr-2 h-5 w-5" />
                                Мэдүүлэх
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl border-none shadow-2xl rounded-3xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
                            <div className="h-2 bg-blue-600 shrink-0" />
                            <div className="flex flex-col h-full overflow-hidden">
                                <div className="p-8 pb-0 space-y-6 shrink-0">
                                    <DialogHeader>
                                        <DialogTitle className="flex items-center gap-3 text-2xl font-black text-blue-700 uppercase">
                                            <Shield className="w-8 h-8" />
                                            Шинэ мэдүүлэг
                                        </DialogTitle>
                                        <DialogDescription className="text-base font-medium">
                                            Ажлын байранд гарсан аливаа эрсдэл, зөрчлийг цаг алдалгүй мэдээлнэ үү.
                                        </DialogDescription>
                                    </DialogHeader>
                                </div>
                                <div className="p-8 pt-6 overflow-y-auto flex-1">
                                    <Form {...form}>
                                        <form onSubmit={form.handleSubmit((data) => createMutation.mutate(data))} className="space-y-6">

                                            {/* Type & Severity */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <FormField
                                                    control={form.control}
                                                    name="incidentType"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="font-bold uppercase text-[10px] text-muted-foreground tracking-widest">Зөрчлийн төрөл</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger className="h-12 font-bold rounded-xl bg-muted/30 border-none shadow-inner">
                                                                        <SelectValue placeholder="Сонгох" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="hazard">Аюул / Эрсдэл</SelectItem>
                                                                    <SelectItem value="near_miss">Ослын өмнөх нөхцөл</SelectItem>
                                                                    <SelectItem value="incident">Осол / Гэмтэл</SelectItem>
                                                                    <SelectItem value="property_damage">Эд хөрөнгийн эвдрэл</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="severity"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="font-bold uppercase text-[10px] text-muted-foreground tracking-widest">Зэрэглэл</FormLabel>
                                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                                <FormControl>
                                                                    <SelectTrigger className="h-12 font-bold rounded-xl bg-muted/30 border-none shadow-inner">
                                                                        <SelectValue placeholder="Сонгох" />
                                                                    </SelectTrigger>
                                                                </FormControl>
                                                                <SelectContent>
                                                                    <SelectItem value="low">Бага</SelectItem>
                                                                    <SelectItem value="medium">Дунд</SelectItem>
                                                                    <SelectItem value="high">Өндөр</SelectItem>
                                                                    <SelectItem value="urgent">Яаралтай</SelectItem>
                                                                </SelectContent>
                                                            </Select>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            {/* Title */}
                                            <FormField
                                                control={form.control}
                                                name="title"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-bold uppercase text-[10px] text-muted-foreground tracking-widest">Гарчиг</FormLabel>
                                                        <FormControl>
                                                            <Input className="h-12 font-bold rounded-xl bg-muted/30 border-none shadow-inner" placeholder="Жишээ: Шатны гишгүүр эвдэрсэн" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            {/* Date & Location */}
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                <FormField
                                                    control={form.control}
                                                    name="date"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="font-bold uppercase text-[10px] text-muted-foreground tracking-widest">Огноо</FormLabel>
                                                            <FormControl>
                                                                <Input type="date" className="h-12 font-bold rounded-xl bg-muted/30 border-none shadow-inner" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                                <FormField
                                                    control={form.control}
                                                    name="location"
                                                    render={({ field }) => (
                                                        <FormItem>
                                                            <FormLabel className="font-bold uppercase text-[10px] text-muted-foreground tracking-widest">Байршил</FormLabel>
                                                            <FormControl>
                                                                <Input className="h-12 font-bold rounded-xl bg-muted/30 border-none shadow-inner" placeholder="Жишээ: Агуулах №3" {...field} />
                                                            </FormControl>
                                                            <FormMessage />
                                                        </FormItem>
                                                    )}
                                                />
                                            </div>

                                            {/* Description */}
                                            <FormField
                                                control={form.control}
                                                name="description"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className="font-bold uppercase text-[10px] text-muted-foreground tracking-widest">Дэлгэрэнгүй</FormLabel>
                                                        <FormControl>
                                                            <Textarea
                                                                placeholder="Юу болсон, ямар арга хэмжээ авах..."
                                                                className="min-h-[120px] font-medium leading-relaxed rounded-xl bg-muted/30 border-none shadow-inner resize-none"
                                                                {...field}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            {/* Anonymous Checkbox */}
                                            <FormField
                                                control={form.control}
                                                name="isAnonymous"
                                                render={({ field }) => (
                                                    <FormItem className="flex flex-row items-center space-x-3 space-y-0 rounded-2xl border p-4 bg-muted/10">
                                                        <FormControl>
                                                            <Checkbox
                                                                checked={field.value}
                                                                onCheckedChange={field.onChange}
                                                            />
                                                        </FormControl>
                                                        <div className="space-y-1 leading-none">
                                                            <FormLabel className="font-bold text-foreground">Нэрээ нууцлах (Anonymous)</FormLabel>
                                                            <FormDescription className="text-xs">
                                                                Таны мэдээлэл админы хэсэгт ч нэргүй харагдана.
                                                            </FormDescription>
                                                        </div>
                                                    </FormItem>
                                                )}
                                            />

                                            {/* Footer - moved outside scrolling area but inside form to submit */}
                                        </form>
                                    </Form>
                                </div>
                                <div className="p-6 border-t border-muted bg-muted/5 shrink-0">
                                    <Button
                                        type="button"
                                        onClick={form.handleSubmit((data) => createMutation.mutate(data))}
                                        disabled={createMutation.isPending}
                                        className="w-full h-14 text-lg font-black uppercase tracking-widest bg-blue-700 hover:bg-blue-800 rounded-xl shadow-lg"
                                    >
                                        {createMutation.isPending ? "Илгээж байна..." : "Илгээх"}
                                    </Button>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                </div>
            </div>

            {/* KPI Section */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="bg-white dark:bg-slate-900 shadow-xl border-none ring-1 ring-orange-500/10 overflow-hidden relative rounded-2xl">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-orange-600 font-black uppercase text-[10px] tracking-widest">Нээлттэй</CardDescription>
                        <CardTitle className="text-5xl font-black mt-2">{openIncidentsCount}</CardTitle>
                    </CardHeader>
                    <div className="h-1 w-full bg-orange-100"><div className="h-full bg-orange-500 w-1/3" /></div>
                </Card>
                <Card className="bg-white dark:bg-slate-900 shadow-xl border-none ring-1 ring-green-500/10 overflow-hidden relative rounded-2xl">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-green-500/5 rounded-full -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-green-600 font-black uppercase text-[10px] tracking-widest">Шийдвэрлэсэн</CardDescription>
                        <CardTitle className="text-5xl font-black mt-2">{resolvedCount}</CardTitle>
                    </CardHeader>
                    <div className="h-1 w-full bg-green-100"><div className="h-full bg-green-500 w-full" /></div>
                </Card>
                <Card className="bg-white dark:bg-slate-900 shadow-xl border-none ring-1 ring-blue-500/10 overflow-hidden relative rounded-2xl">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500/5 rounded-full -mr-8 -mt-8" />
                    <CardHeader className="pb-2">
                        <CardDescription className="text-blue-600 font-black uppercase text-[10px] tracking-widest">Нийт (Миний)</CardDescription>
                        <CardTitle className="text-5xl font-black mt-2">{myTotal}</CardTitle>
                    </CardHeader>
                    <div className="h-1 w-full bg-blue-100"><div className="h-full bg-blue-500 w-2/3" /></div>
                </Card>
            </div>

            {/* List Section */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-6">
                <TabsList className="bg-muted/50 p-1 rounded-2xl h-12 inline-flex">
                    <TabsTrigger value="my_reports" className="rounded-xl px-6 h-10 text-xs font-bold uppercase tracking-wide">
                        {canManageAll ? "Бүх Мэдүүлэг" : "Миний Мэдүүлэг"}
                    </TabsTrigger>
                    <TabsTrigger value="public_feed" className="rounded-xl px-6 h-10 text-xs font-bold uppercase tracking-wide">
                        Нийтийн Самбар
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="my_reports" className="space-y-6">
                    {isLoading ? (
                        <div className="text-center py-20 text-muted-foreground animate-pulse font-bold">Уншиж байна...</div>
                    ) : displayReports.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground border-2 border-dashed rounded-3xl bg-muted/10">
                            <p className="font-medium">Мэдээлэл олдсонгүй.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {displayReports.map((incident: any) => (
                                <IncidentCard key={incident.id} incident={incident} />
                            ))}
                        </div>
                    )}
                </TabsContent>

                <TabsContent value="public_feed" className="space-y-6">
                    <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-200 dark:border-slate-800 text-sm text-muted-foreground">
                        <p>Нийтийн мэдээллийн самбар дээр зөвхөн зөвшөөрөгдсөн мэдээлэл харагдах бөгөөд хувийн мэдээллүүд нууцлагдсан байна.</p>
                    </div>
                    {publicFeed.length === 0 ? (
                        <div className="text-center py-20 text-muted-foreground">Одоогоор нийтийн мэдээлэл алга байна.</div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {publicFeed.map((incident: any) => (
                                <IncidentCard key={incident.id} incident={incident} />
                            ))}
                        </div>
                    )}
                </TabsContent>
            </Tabs>

            {/* DETAIL DIALOG & ACTIONS */}
            {
                selectedIncident && (
                    <Dialog open={!!selectedIncident} onOpenChange={() => setSelectedIncident(null)}>
                        <DialogContent className="max-w-4xl overflow-y-auto max-h-[95vh] border-none shadow-2xl p-0 overflow-hidden rounded-3xl">
                            <div className="h-2 bg-gradient-to-r from-blue-600 to-indigo-600" />
                            <div className="p-8 space-y-8">

                                {/* Header */}
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                    <div>
                                        <div className="flex items-center gap-3 mb-2">
                                            <Badge className={`px-2.5 py-1 rounded-md text-[10px] uppercase font-black tracking-widest ${SEVERITY_COLORS[selectedIncident.severity] || SEVERITY_COLORS.low}`}>
                                                {SEVERITY_LABELS[selectedIncident.severity] || selectedIncident.severity}
                                            </Badge>
                                            <span className="text-muted-foreground text-xs font-bold uppercase tracking-wider">{format(new Date(selectedIncident.date), "yyyy-MM-dd")}</span>
                                        </div>
                                        <DialogTitle className="text-3xl font-black uppercase leading-tight text-slate-900 dark:text-white">
                                            {selectedIncident.title}
                                        </DialogTitle>
                                        <p className="text-sm font-bold text-muted-foreground flex items-center gap-2 mt-2">
                                            <MapPin className="w-4 h-4" /> {selectedIncident.location || "Байршил тодорхойгүй"}
                                        </p>
                                    </div>
                                    {getStatusBadge(selectedIncident.status)}
                                </div>

                                <Separator />

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
                                    {/* Left Content */}
                                    <div className="md:col-span-2 space-y-8">
                                        <div className="space-y-4">
                                            <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest flex items-center gap-2">
                                                <FileText className="w-4 h-4" /> Дэлгэрэнгүй
                                            </h4>
                                            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-lg leading-relaxed font-medium">
                                                {selectedIncident.description || "Мэдээлэл нууцлагдсан байна."}
                                            </div>
                                        </div>

                                        {/* Action History / Resolution */}
                                        {selectedIncident.correctiveAction && (
                                            <div className="space-y-4">
                                                <h4 className="text-xs font-black uppercase text-green-600 tracking-widest flex items-center gap-2">
                                                    <CheckCircle className="w-4 h-4" /> Шийдвэрлэлт
                                                </h4>
                                                <div className="p-6 bg-green-50 dark:bg-green-900/10 rounded-2xl border border-green-100 text-green-900 dark:text-green-100 font-medium italic">
                                                    "{selectedIncident.correctiveAction}"
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Right Sidebar - Timeline & Actions */}
                                    <div className="space-y-8">
                                        <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-2xl border border-muted">
                                            <h4 className="text-xs font-black uppercase text-muted-foreground tracking-widest mb-4">Статус</h4>
                                            <StatusTimeline status={selectedIncident.status} />
                                        </div>

                                        {/* Permission Gate Actions */}
                                        <div className="space-y-3">
                                            {canManageAll ? (
                                                // --- MANAGER ACTIONS ---
                                                <>
                                                    {selectedIncident.status === 'reported' && (
                                                        <Button
                                                            className="w-full h-12 bg-blue-600 hover:bg-blue-700 font-bold uppercase text-xs tracking-widest"
                                                            onClick={() => updateStatusMutation.mutate({ id: selectedIncident.id, status: 'investigating' })}
                                                        >
                                                            Шалгаж эхлэх
                                                        </Button>
                                                    )}
                                                    {selectedIncident.status === 'investigating' && (
                                                        <Button
                                                            className="w-full h-12 bg-green-600 hover:bg-green-700 font-bold uppercase text-xs tracking-widest"
                                                            onClick={() => updateStatusMutation.mutate({ id: selectedIncident.id, status: 'resolved' })}
                                                        >
                                                            Шийдвэрлэх
                                                        </Button>
                                                    )}
                                                    {selectedIncident.status === 'resolved' && (
                                                        <Button
                                                            variant="outline"
                                                            className="w-full h-12 border-slate-300 font-bold uppercase text-xs tracking-widest hover:bg-slate-100"
                                                            onClick={() => updateStatusMutation.mutate({ id: selectedIncident.id, status: 'closed' })}
                                                        >
                                                            Хаах
                                                        </Button>
                                                    )}
                                                </>
                                            ) : (
                                                // --- EMPLOYEE ACTIONS ---
                                                <>
                                                    {/* Only owner can delete and only if reported status */}
                                                    {selectedIncident.reportedBy === user?.id && selectedIncident.status === 'reported' && (
                                                        <AlertDialog>
                                                            <AlertDialogTrigger asChild>
                                                                <Button variant="destructive" className="w-full h-12 font-bold uppercase text-xs tracking-widest opacity-90 hover:opacity-100">
                                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                                    Устгах
                                                                </Button>
                                                            </AlertDialogTrigger>
                                                            <AlertDialogContent>
                                                                <AlertDialogHeader>
                                                                    <AlertDialogTitle>Та итгэлтэй байна уу?</AlertDialogTitle>
                                                                    <AlertDialogDescription>
                                                                        Энэ үйлдлийг буцаах боломжгүй. Таны мэдүүлэг бүр мөсөн устгагдана.
                                                                    </AlertDialogDescription>
                                                                </AlertDialogHeader>
                                                                <AlertDialogFooter>
                                                                    <AlertDialogCancel>Болих</AlertDialogCancel>
                                                                    <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => deleteMutation.mutate(selectedIncident.id)}>
                                                                        Устгах
                                                                    </AlertDialogAction>
                                                                </AlertDialogFooter>
                                                            </AlertDialogContent>
                                                        </AlertDialog>
                                                    )}
                                                    {selectedIncident.status !== 'reported' && selectedIncident.reportedBy === user?.id && (
                                                        <div className="p-4 bg-blue-50 text-blue-800 text-xs font-medium rounded-xl text-center">
                                                            Таны мэдүүлэг шалгагдаж байгаа тул засварлах боломжгүй.
                                                        </div>
                                                    )}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )
            }
        </div>
    );
}
