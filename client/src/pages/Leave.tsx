import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Calendar as CalendarIcon, FileText, CheckCircle2, XCircle, Clock, Search, Filter } from "lucide-react";
import { isPrivileged, isManager } from "@shared/roles";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// Types based on schema
interface LeaveRequest {
    id: string;
    employeeId: string;
    type: "vacation" | "sick" | "personal" | "other";
    startDate: string;
    endDate: string;
    reason: string;
    status: "pending" | "approved" | "rejected";
    approvedBy?: string;
    approvedAt?: string;
    rejectionReason?: string;
    createdAt: string;
    employee?: {
        firstName: string;
        lastName: string;
        department?: {
            name: string;
        };
    };
}

const leaveTypeLabels = {
    vacation: "Ээлжийн амралт",
    sick: "Өвчний чөлөө",
    personal: "Хувийн чөлөө",
    other: "Бусад",
};

const statusColors = {
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-800",
    approved: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800",
    rejected: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800",
};

const statusLabels = {
    pending: "Хүлээгдэж буй",
    approved: "Батлагдсан",
    rejected: "Татгалзсан",
};

// Form Schema
const leaveRequestSchema = z.object({
    type: z.enum(["vacation", "sick", "personal", "other"], {
        required_error: "Чөлөөний төрөл сонгоно уу",
    }),
    dateRange: z.object({
        from: z.date({ required_error: "Эхлэх огноо сонгоно уу" }),
        to: z.date({ required_error: "Дуусах огноо сонгоно уу" }),
    }),
    reason: z.string().min(5, "Чөлөө авах шалтгаан бичнэ үү (дор хаяж 5 үсэг)"),
});

type LeaveRequestFormValues = z.infer<typeof leaveRequestSchema>;

export default function LeavePage() {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("my-requests");
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);

    const canManage = isPrivileged(user?.role) || isManager(user?.role);

    // Fetch My Requests
    const { data: myRequests = [], isLoading: isLoadingMy } = useQuery<LeaveRequest[]>({
        queryKey: ["/api/leave-requests", { employeeId: (user as any)?.employeeId }],
        queryFn: async () => {
            const empId = (user as any)?.employeeId || '';
            const res = await fetch(`/api/leave-requests?employeeId=${empId}`);
            if (!res.ok) throw new Error("Failed to fetch requests");
            return res.json();
        },
        enabled: !!(user as any)?.employeeId,
    });

    // Fetch All Requests (for Approvals) - Only if manager
    const { data: allRequests = [], isLoading: isLoadingAll } = useQuery<LeaveRequest[]>({
        queryKey: ["/api/leave-requests", { status: "all" }],
        queryFn: async () => {
            const res = await fetch("/api/leave-requests");
            if (!res.ok) throw new Error("Failed to fetch requests");
            return res.json();
        },
        enabled: canManage && activeTab === "approvals",
    });

    // Create Mutation
    const createMutation = useMutation({
        mutationFn: async (values: LeaveRequestFormValues) => {
            const res = await fetch("/api/leave-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    employeeId: (user as any)?.employeeId,
                    type: values.type,
                    startDate: format(values.dateRange.from, "yyyy-MM-dd"),
                    endDate: format(values.dateRange.to, "yyyy-MM-dd"),
                    reason: values.reason,
                }),
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed to submit request");
            }
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
            toast({ title: "Амжилттай", description: "Чөлөөний хүсэлт илгээгдлээ" });
            setIsDrawerOpen(false);
            form.reset();
        },
        onError: (err: Error) => {
            toast({ title: "Алдаа", description: err.message, variant: "destructive" });
        },
    });

    // Update Status Mutation
    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status, rejectionReason }: { id: string, status: string, rejectionReason?: string }) => {
            const res = await fetch(`/api/leave-requests/${id}/status`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status, rejectionReason }),
            });
            if (!res.ok) throw new Error("Failed to update status");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/leave-requests"] });
            toast({ title: "Амжилттай", description: "Төлөв шинэчлэгдлээ" });
        },
    });

    const form = useForm<LeaveRequestFormValues>({
        resolver: zodResolver(leaveRequestSchema),
        defaultValues: {
            type: "vacation",
        }
    });

    const onSubmit = (values: LeaveRequestFormValues) => {
        createMutation.mutate(values);
    };

    const pendingCount = allRequests.filter(r => r.status === "pending").length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight font-display">Чөлөө & Амралт</h2>
                    <p className="text-muted-foreground mt-1">Чөлөө авах хүсэлт илгээх, шийдвэрлэх.</p>
                </div>
                <Button onClick={() => setIsDrawerOpen(true)} className="shadow-lg shadow-primary/20">
                    <Plus className="w-4 h-4 mr-2" />
                    Чөлөө хүсэх
                </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
                <TabsList>
                    <TabsTrigger value="my-requests" className="relative">
                        Миний хүсэлтүүд
                    </TabsTrigger>
                    {canManage && (
                        <TabsTrigger value="approvals" className="relative">
                            Хүсэлтүүд
                            {pendingCount > 0 && (
                                <span className="ml-2 bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 text-[10px] px-1.5 py-0.5 rounded-full font-bold">
                                    {pendingCount}
                                </span>
                            )}
                        </TabsTrigger>
                    )}
                </TabsList>

                <TabsContent value="my-requests" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Миний илгээсэн хүсэлтүүд</CardTitle>
                            <CardDescription>Таны илгээсэн бүх чөлөөний хүсэлтүүдийн түүх.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {isLoadingMy ? (
                                <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                            ) : myRequests.length === 0 ? (
                                <div className="text-center py-12 text-muted-foreground">
                                    <FileText className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>Танд илгээсэн хүсэлт байхгүй байна.</p>
                                    <Button variant="link" onClick={() => setIsDrawerOpen(true)}>Шинэ хүсэлт үүсгэх</Button>
                                </div>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Төрөл</TableHead>
                                            <TableHead>Хугацаа</TableHead>
                                            <TableHead>Хоног</TableHead>
                                            <TableHead>Шалтгаан</TableHead>
                                            <TableHead>Төлөв</TableHead>
                                            <TableHead className="text-right">Огноо</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {myRequests.map((req) => (
                                            <TableRow key={req.id}>
                                                <TableCell>
                                                    <div className="font-medium">{leaveTypeLabels[req.type]}</div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center text-sm">
                                                        <CalendarIcon className="w-3 h-3 mr-2 opacity-70" />
                                                        {format(new Date(req.startDate), "MM/dd")} - {format(new Date(req.endDate), "MM/dd")}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {differenceInDays(new Date(req.endDate), new Date(req.startDate)) + 1}
                                                </TableCell>
                                                <TableCell className="max-w-[200px] truncate text-muted-foreground" title={req.reason}>
                                                    {req.reason}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="outline" className={cn("font-normal", statusColors[req.status])}>
                                                        {statusLabels[req.status]}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right text-muted-foreground text-xs">
                                                    {format(new Date(req.createdAt), "yyyy-MM-dd")}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {canManage && (
                    <TabsContent value="approvals" className="space-y-4">
                        <Card>
                            <CardHeader>
                                <CardTitle>Шийдвэрлэх хүсэлтүүд</CardTitle>
                                <CardDescription>Ажилтнуудаас ирсэн чөлөөний хүсэлтүүдийг хянах.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {isLoadingAll ? (
                                    <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-muted-foreground" /></div>
                                ) : allRequests.length === 0 ? (
                                    <div className="text-center py-12 text-muted-foreground">
                                        <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20 text-green-500" />
                                        <p>Бүх хүсэлтийг шийдвэрлэсэн байна.</p>
                                    </div>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Ажилтан</TableHead>
                                                <TableHead>Төрөл</TableHead>
                                                <TableHead>Хугацаа</TableHead>
                                                <TableHead>Шалтгаан</TableHead>
                                                <TableHead>Төлөв</TableHead>
                                                <TableHead className="text-right">Үйлдэл</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {allRequests.map((req) => (
                                                <TableRow key={req.id}>
                                                    <TableCell>
                                                        <div className="flex items-center gap-2">
                                                            <Avatar className="w-8 h-8">
                                                                <AvatarFallback>{req.employee?.firstName?.[0]}</AvatarFallback>
                                                            </Avatar>
                                                            <div>
                                                                <div className="font-medium">{req.employee?.firstName} {req.employee?.lastName}</div>
                                                                <div className="text-xs text-muted-foreground">{req.employee?.department?.name}</div>
                                                            </div>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="secondary" className="font-normal">
                                                            {leaveTypeLabels[req.type]}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell>
                                                        <div className="text-sm">
                                                            {format(new Date(req.startDate), "MM/dd")} - {format(new Date(req.endDate), "MM/dd")}
                                                            <span className="text-muted-foreground text-xs ml-1">
                                                                ({differenceInDays(new Date(req.endDate), new Date(req.startDate)) + 1} хоног)
                                                            </span>
                                                        </div>
                                                    </TableCell>
                                                    <TableCell className="max-w-[200px]">
                                                        <p className="truncate text-sm" title={req.reason}>{req.reason}</p>
                                                    </TableCell>
                                                    <TableCell>
                                                        <Badge variant="outline" className={cn("font-normal", statusColors[req.status])}>
                                                            {statusLabels[req.status]}
                                                        </Badge>
                                                    </TableCell>
                                                    <TableCell className="text-right">
                                                        {req.status === "pending" && (
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    size="sm"
                                                                    variant="default"
                                                                    className="h-8 bg-green-600 hover:bg-green-700"
                                                                    onClick={() => updateStatusMutation.mutate({ id: req.id, status: "approved" })}
                                                                >
                                                                    <CheckCircle2 className="w-4 h-4 mr-1" /> Батлах
                                                                </Button>
                                                                <Button
                                                                    size="sm"
                                                                    variant="destructive"
                                                                    className="h-8"
                                                                    onClick={() => {
                                                                        const reason = prompt("Татгалзах шалтгаан:");
                                                                        if (reason) {
                                                                            updateStatusMutation.mutate({ id: req.id, status: "rejected", rejectionReason: reason });
                                                                        }
                                                                    }}
                                                                >
                                                                    <XCircle className="w-4 h-4 mr-1" /> Татгалзах
                                                                </Button>
                                                            </div>
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
                )}
            </Tabs>

            {/* Request Drawer */}
            <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
                <SheetContent className="sm:max-w-[500px]">
                    <SheetHeader>
                        <SheetTitle>Чөлөөний хүсэлт илгээх</SheetTitle>
                        <SheetDescription>
                            Та чөлөө авах шалтгаан болон хугацааг тодорхой бичнэ үү.
                        </SheetDescription>
                    </SheetHeader>
                    <div className="mt-6">
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                                <FormField
                                    control={form.control}
                                    name="type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Чөлөөний төрөл</FormLabel>
                                            <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="Төрөл сонгоно уу" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="vacation">🏖️ Ээлжийн амралт</SelectItem>
                                                    <SelectItem value="sick">🤒 Өвчний чөлөө</SelectItem>
                                                    <SelectItem value="personal">👤 Хувийн чөлөө</SelectItem>
                                                    <SelectItem value="other">📝 Бусад</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="dateRange"
                                    render={({ field }) => (
                                        <FormItem className="flex flex-col">
                                            <FormLabel>Хугацаа</FormLabel>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value?.from ? (
                                                            field.value.to ? (
                                                                <>
                                                                    {format(field.value.from, "LLL dd, y")} -{" "}
                                                                    {format(field.value.to, "LLL dd, y")}
                                                                </>
                                                            ) : (
                                                                format(field.value.from, "LLL dd, y")
                                                            )
                                                        ) : (
                                                            <span>Огноо сонгох</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent className="w-auto p-0" align="start">
                                                    <Calendar
                                                        mode="range"
                                                        selected={field.value}
                                                        onSelect={field.onChange}
                                                        disabled={(date) =>
                                                            date < new Date(new Date().setHours(0, 0, 0, 0))
                                                        }
                                                        initialFocus
                                                    />
                                                </PopoverContent>
                                            </Popover>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="reason"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Шалтгаан</FormLabel>
                                            <FormControl>
                                                <Textarea
                                                    placeholder="Чөлөө авах дэлгэрэнгүй шалтгаан..."
                                                    className="resize-none min-h-[100px]"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="flex justify-end gap-3 pt-4">
                                    <Button type="button" variant="outline" onClick={() => setIsDrawerOpen(false)}>Болих</Button>
                                    <Button type="submit" disabled={createMutation.isPending}>
                                        {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                        Илгээх
                                    </Button>
                                </div>
                            </form>
                        </Form>
                    </div>
                </SheetContent>
            </Sheet>
        </div>
    );
}
