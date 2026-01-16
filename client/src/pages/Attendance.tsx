import { useState } from "react";
import { useAttendance } from "@/hooks/use-attendance";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, isToday, isWeekend } from "date-fns";
import { mn } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import type { Employee, InsertAttendanceDay, AttendanceDay } from "@shared/schema";
import { z } from "zod";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, ChevronLeft, ChevronRight, Search, CalendarCheck, UserCheck, Clock, AlertCircle, Thermometer } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// Form Schema
const attendanceFormSchema = z.object({
  employeeId: z.string().min(1, "Ажилтан сонгоно уу"),
  workDate: z.string().min(1, "Огноо бөглөнө үү"),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z.string().min(1, "Төлөв сонгоно уу"),
  workHours: z.string().optional(),
});

type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;

// Mongolian month names
const mongolianMonths = [
  "Нэгдүгээр сар",
  "Хоёрдугаар сар",
  "Гуравдугаар сар",
  "Дөрөвдүгээр сар",
  "Тавдугаар сар",
  "Зургадугаар сар",
  "Долдугаар сар",
  "Наймдугаар сар",
  "Есдүгээр сар",
  "Аравдугаар сар",
  "Арван нэгдүгээр сар",
  "Арван хоёрдугаар сар",
];

// Status configuration
const statusConfig = {
  Present: { 
    color: "bg-green-500", 
    textColor: "text-green-700",
    bgColor: "bg-green-50 dark:bg-green-950/30",
    borderColor: "border-green-200 dark:border-green-800",
    label: "Ирсэн",
    icon: UserCheck 
  },
  Absent: { 
    color: "bg-red-500", 
    textColor: "text-red-700",
    bgColor: "bg-red-50 dark:bg-red-950/30",
    borderColor: "border-red-200 dark:border-red-800",
    label: "Ирээгүй",
    icon: AlertCircle 
  },
  Late: { 
    color: "bg-yellow-500", 
    textColor: "text-yellow-700",
    bgColor: "bg-yellow-50 dark:bg-yellow-950/30",
    borderColor: "border-yellow-200 dark:border-yellow-800",
    label: "Хоцорсон",
    icon: Clock 
  },
  Sick: { 
    color: "bg-blue-500", 
    textColor: "text-blue-700",
    bgColor: "bg-blue-50 dark:bg-blue-950/30",
    borderColor: "border-blue-200 dark:border-blue-800",
    label: "Өвчтэй",
    icon: Thermometer 
  },
};

export default function Attendance() {
  const { attendance = [], isLoading, createAttendance } = useAttendance();
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  // Employees list
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });

  // Statistics
  const currentMonthAttendance = attendance.filter((a) => {
    const date = new Date(a.workDate);
    return date.getMonth() === currentMonth.getMonth() && date.getFullYear() === currentMonth.getFullYear();
  });

  const presentCount = currentMonthAttendance.filter((a) => a.status === "Present").length;
  const absentCount = currentMonthAttendance.filter((a) => a.status === "Absent").length;
  const lateCount = currentMonthAttendance.filter((a) => a.status === "Late").length;
  const sickCount = currentMonthAttendance.filter((a) => a.status === "Sick").length;

  // Form
  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: {
      employeeId: "",
      workDate: format(new Date(), "yyyy-MM-dd"),
      checkIn: "",
      checkOut: "",
      status: "Present",
      workHours: "8",
    },
  });

  // Submit Handler
  const onSubmit = async (values: AttendanceFormValues) => {
    try {
      const dateOnly = values.workDate;
      const hours = Number(values.workHours) || 0;

      const payload: InsertAttendanceDay = {
        employeeId: values.employeeId,
        workDate: dateOnly,
        checkIn: values.checkIn ? new Date(`${dateOnly}T${values.checkIn}`) : null,
        checkOut: values.checkOut ? new Date(`${dateOnly}T${values.checkOut}`) : null,
        status: values.status,
        minutesWorked: Math.round(hours * 60),
        note: "",
      };

      await createAttendance.mutateAsync(payload);

      toast({ title: "Амжилттай", description: "Ирц амжилттай бүртгэгдлээ." });
      setOpen(false);
      form.reset({
        ...values,
        employeeId: "",
        checkIn: "",
        checkOut: "",
      });
    } catch (error: any) {
      console.error(error);
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Ирц бүртгэхэд алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  // Calendar setup (Monday start)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  let startDayOffset = getDay(monthStart) - 1;
  if (startDayOffset < 0) startDayOffset = 6;

  // Get records for a specific day
  const getDayRecords = (date: Date) => {
    if (!attendance) return [];
    return attendance.filter((rec: AttendanceDay) => isSameDay(new Date(rec.workDate), date));
  };

  // Get employee name
  const getEmployeeName = (id: string) => {
    const emp = employees.find((e) => e.id === id);
    return emp ? `${emp.lastName?.[0] || ""}. ${emp.firstName}` : "Тодорхойгүй";
  };

  const getEmployeeFullName = (id: string) => {
    const emp = employees.find((e) => e.id === id);
    return emp ? `${emp.lastName} ${emp.firstName}` : "Тодорхойгүй";
  };

  return (
    <div className="space-y-6 animate-in-fade">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Ирц бүртгэл
          </h2>
          <p className="text-muted-foreground mt-1">
            Ажилчдын өдөр тутмын ирцийг календараар удирдах
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="btn-premium">
              <Plus className="w-4 h-4 mr-2" />
              Ирц бүртгэх
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto glass-card">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-xl">
                <CalendarCheck className="w-5 h-5 text-primary" />
                Шинэ ирц бүртгэх
              </DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-4">
                {/* Employee */}
                <FormField
                  control={form.control}
                  name="employeeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Ажилтан</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger className="h-11">
                            <SelectValue placeholder="Ажилтнаа сонгоно уу" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.lastName} {emp.firstName} ({emp.employeeNo})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Date */}
                <FormField
                  control={form.control}
                  name="workDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Огноо</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value} className="h-11" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Check in / Check out */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="checkIn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ирсэн цаг</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} value={field.value} className="h-11" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="checkOut"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Явсан цаг</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} value={field.value} className="h-11" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Status & Hours */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Төлөв</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Төлөв сонгоно уу" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(statusConfig).map(([key, config]) => {
                              const Icon = config.icon;
                              return (
                                <SelectItem key={key} value={key}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${config.color}`} />
                                    {config.label}
                                  </div>
                                </SelectItem>
                              );
                            })}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="workHours"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ажилласан цаг</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            max="24"
                            step="0.5"
                            {...field}
                            value={field.value}
                            className="h-11"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full btn-premium h-12" disabled={createAttendance.isPending}>
                  {createAttendance.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Хадгалагдаж байна...
                    </>
                  ) : (
                    <>
                      <CalendarCheck className="mr-2 h-4 w-4" />
                      Бүртгэх
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Object.entries(statusConfig).map(([key, config], index) => {
          const Icon = config.icon;
          const counts = { Present: presentCount, Absent: absentCount, Late: lateCount, Sick: sickCount };
          const count = counts[key as keyof typeof counts] || 0;

          return (
            <Card key={key} className={`stat-card glass-card overflow-hidden animate-slide-up`} style={{ animationDelay: `${index * 0.1}s` }}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {config.label}
                </CardTitle>
                <div className={`p-2 rounded-lg ${config.bgColor}`}>
                  <Icon className={`w-5 h-5 ${config.textColor}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${config.textColor}`}>{count}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Энэ сард бүртгэгдсэн
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Calendar Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 glass-card p-4 rounded-xl">
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Огноо эсвэл ажилтны нэрээр хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent min-w-[200px]"
          />
        </div>
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div className="text-center min-w-[200px]">
            <h3 className="text-xl font-bold">
              {currentMonth.getFullYear()} оны {mongolianMonths[currentMonth.getMonth()]}
            </h3>
          </div>
          <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="glass-card rounded-xl p-6 overflow-hidden">
        {/* Weekday Headers */}
        <div className="grid grid-cols-7 text-center text-sm font-medium mb-4">
          {["Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба", "Ням"].map((day, i) => (
            <div 
              key={day} 
              className={cn(
                "py-2 rounded-lg",
                i >= 5 ? "text-primary font-bold bg-primary/5" : "text-muted-foreground"
              )}
            >
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-2">
          {/* Empty cells for offset */}
          {Array.from({ length: startDayOffset }, (_, i) => (
            <div key={`empty-${i}`} className="h-28 bg-muted/20 rounded-xl" />
          ))}

          {/* Calendar days */}
          {monthDays.map((day, index) => {
            const records = getDayRecords(day);
            const dayStr = format(day, "yyyy-MM-dd");
            const matchesSearch = search === "" ||
              dayStr.includes(search) ||
              records.some((rec) => {
                const emp = employees.find((e) => e.id === rec.employeeId);
                return emp && `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(search.toLowerCase());
              });

            if (!matchesSearch && search !== "") {
              return <div key={day.toString()} className="h-28 hidden" />;
            }

            const dayIsToday = isToday(day);
            const dayIsWeekend = isWeekend(day);

            return (
              <div
                key={day.toString()}
                className={cn(
                  "h-28 border rounded-xl p-2 flex flex-col transition-all duration-200 hover:shadow-md animate-scale-in",
                  dayIsToday 
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20" 
                    : dayIsWeekend
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-card hover:bg-muted/30"
                )}
                style={{ animationDelay: `${index * 0.01}s` }}
              >
                <span className={cn(
                  "text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full",
                  dayIsToday 
                    ? "bg-primary text-primary-foreground" 
                    : dayIsWeekend
                      ? "text-primary"
                      : "text-muted-foreground"
                )}>
                  {format(day, "d")}
                </span>

                <div className="flex-1 mt-1 overflow-hidden">
                  <TooltipProvider>
                    <div className="flex flex-wrap gap-1">
                      {records.slice(0, 6).map((rec) => {
                        const status = rec.status || "Present";
                        const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.Present;
                        
                        return (
                          <Tooltip key={rec.id}>
                            <TooltipTrigger asChild>
                              <div className={cn(
                                "w-3 h-3 rounded-full cursor-pointer transition-transform hover:scale-125",
                                config.color
                              )} />
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-xs">
                              <div className="space-y-1">
                                <p className="font-bold">{getEmployeeFullName(rec.employeeId)}</p>
                                <Badge className={cn(config.bgColor, config.textColor, config.borderColor, "border")}>
                                  {config.label}
                                </Badge>
                                <div className="text-xs text-muted-foreground">
                                  <p>Ажилласан: {((rec.minutesWorked || 0) / 60).toFixed(1)} цаг</p>
                                  {rec.checkIn && <p>Ирсэн: {format(new Date(rec.checkIn), "HH:mm")}</p>}
                                  {rec.checkOut && <p>Явсан: {format(new Date(rec.checkOut), "HH:mm")}</p>}
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        );
                      })}
                      {records.length > 6 && (
                        <span className="text-xs text-muted-foreground">+{records.length - 6}</span>
                      )}
                    </div>
                  </TooltipProvider>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-6 justify-center text-sm glass-card p-4 rounded-xl">
        {Object.entries(statusConfig).map(([key, config]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={cn("w-4 h-4 rounded-full", config.color)} />
            <span className="text-muted-foreground">{config.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
