import { useState, useMemo } from "react";
import { useAttendance } from "@/hooks/use-attendance";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, isToday, isWeekend, startOfWeek, endOfWeek } from "date-fns";
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, 
  Loader2, 
  ChevronLeft, 
  ChevronRight, 
  Search, 
  CalendarDays,
  UserCheck,
  UserX,
  Clock,
  AlertCircle,
  Calendar,
  Users,
  TrendingUp,
  CheckCircle2,
  XCircle,
  Timer,
  Stethoscope,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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

// Статус тохиргоо
const statusConfig: Record<string, { label: string; color: string; bgColor: string; icon: any }> = {
  Present: { 
    label: "Ирсэн", 
    color: "bg-emerald-500", 
    bgColor: "bg-emerald-100 text-emerald-700 border-emerald-200",
    icon: CheckCircle2,
  },
  Absent: { 
    label: "Ирээгүй", 
    color: "bg-red-500", 
    bgColor: "bg-red-100 text-red-700 border-red-200",
    icon: XCircle,
  },
  Late: { 
    label: "Хоцорсон", 
    color: "bg-amber-500", 
    bgColor: "bg-amber-100 text-amber-700 border-amber-200",
    icon: Timer,
  },
  Sick: { 
    label: "Өвчтэй чөлөө", 
    color: "bg-blue-500", 
    bgColor: "bg-blue-100 text-blue-700 border-blue-200",
    icon: Stethoscope,
  },
};

export default function Attendance() {
  const { attendance = [], isLoading, createAttendance } = useAttendance();
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [search, setSearch] = useState("");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);
  const { toast } = useToast();

  // Ажилчдын жагсаалт
  const { data: employees = [] } = useQuery<Employee[]>({
    queryKey: ["/api/employees"],
    queryFn: async () => {
      const res = await fetch("/api/employees");
      if (!res.ok) throw new Error("Failed to fetch employees");
      return res.json();
    },
  });

  // Form
  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: {
      employeeId: "",
      workDate: format(new Date(), "yyyy-MM-dd"),
      checkIn: "09:00",
      checkOut: "18:00",
      status: "Present",
      workHours: "8",
    },
  });

  // Статистик тооцоолол
  const stats = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    
    const monthRecords = attendance.filter((rec) => {
      const date = new Date(rec.workDate);
      return date >= monthStart && date <= monthEnd;
    });

    return {
      present: monthRecords.filter(r => r.status === "Present").length,
      absent: monthRecords.filter(r => r.status === "Absent").length,
      late: monthRecords.filter(r => r.status === "Late").length,
      sick: monthRecords.filter(r => r.status === "Sick").length,
      totalHours: monthRecords.reduce((acc, r) => acc + (r.minutesWorked || 0), 0) / 60,
    };
  }, [attendance, currentMonth]);

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
        ...form.getValues(),
        employeeId: "",
        checkIn: "09:00",
        checkOut: "18:00",
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

  // Календарь тохиргоо
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  let startDayOffset = getDay(monthStart) - 1;
  if (startDayOffset < 0) startDayOffset = 6;

  // Өдрийн ирцийн бүртгэлүүд
  const getDayRecords = (date: Date) => {
    if (!attendance) return [];
    return attendance.filter((rec: AttendanceDay) => isSameDay(new Date(rec.workDate), date));
  };

  // Ажилтны нэр олох
  const getEmployeeName = (id: string) => {
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.lastName?.[0] || ""}. ${emp.firstName}` : "Тодорхойгүй";
  };

  const getEmployeeFullName = (id: string) => {
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.lastName} ${emp.firstName}` : "Тодорхойгүй";
  };

  // Quick add for today
  const handleQuickAdd = (day: Date) => {
    form.setValue("workDate", format(day, "yyyy-MM-dd"));
    setOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Толгой хэсэг */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-cyan-600 bg-clip-text text-transparent">
            Ирц бүртгэл
          </h2>
          <p className="text-muted-foreground mt-1">
            Ажилчдын ирцийг календараас харах, бүртгэх
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all">
              <Plus className="w-4 h-4 mr-2" />
              Ирц бүртгэх
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[550px]">
            <DialogHeader>
              <DialogTitle className="text-xl flex items-center gap-2">
                <CalendarDays className="w-5 h-5 text-primary" />
                Ирц бүртгэх
              </DialogTitle>
            </DialogHeader>

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 pt-4">
                {/* Ажилтан */}
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
                              <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                  {emp.firstName[0]}
                                </div>
                                {emp.lastName} {emp.firstName} 
                                <span className="text-muted-foreground">({emp.employeeNo})</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Огноо + Төлөв */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="workDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Огноо</FormLabel>
                        <FormControl>
                          <Input type="date" className="h-11" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Төлөв</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-11">
                              <SelectValue placeholder="Сонгох" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {Object.entries(statusConfig).map(([key, config]) => {
                              const Icon = config.icon;
                              return (
                                <SelectItem key={key} value={key}>
                                  <div className="flex items-center gap-2">
                                    <div className={`w-3 h-3 rounded-full ${config.color}`}></div>
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
                </div>

                {/* Ирсэн / Явсан цаг */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="checkIn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-emerald-500" />
                          Ирсэн цаг
                        </FormLabel>
                        <FormControl>
                          <Input type="time" className="h-11" {...field} />
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
                        <FormLabel className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-red-500" />
                          Явсан цаг
                        </FormLabel>
                        <FormControl>
                          <Input type="time" className="h-11" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Ажилласан цаг */}
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
                          className="h-11"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full h-11 text-base" disabled={createAttendance.isPending}>
                  {createAttendance.isPending ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Хадгалагдаж байна...
                    </>
                  ) : (
                    "Бүртгэх"
                  )}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Статистик картууд */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-0 shadow-md bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-950/50 dark:to-emerald-900/30">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500 rounded-lg shadow">
                <UserCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ирсэн</p>
                <p className="text-2xl font-bold text-emerald-600">{stats.present}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-red-50 to-red-100/50 dark:from-red-950/50 dark:to-red-900/30">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-red-500 rounded-lg shadow">
                <UserX className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ирээгүй</p>
                <p className="text-2xl font-bold text-red-600">{stats.absent}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-amber-50 to-amber-100/50 dark:from-amber-950/50 dark:to-amber-900/30">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500 rounded-lg shadow">
                <AlertCircle className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Хоцорсон</p>
                <p className="text-2xl font-bold text-amber-600">{stats.late}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/50 dark:to-blue-900/30">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-blue-500 rounded-lg shadow">
                <Stethoscope className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Өвчтэй</p>
                <p className="text-2xl font-bold text-blue-600">{stats.sick}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-md bg-gradient-to-br from-violet-50 to-violet-100/50 dark:from-violet-950/50 dark:to-violet-900/30">
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-violet-500 rounded-lg shadow">
                <Clock className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Нийт цаг</p>
                <p className="text-2xl font-bold text-violet-600">{Math.round(stats.totalHours)}ц</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Сар сонгох */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <Search className="w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Ажилтны нэрээр хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent min-w-[200px]"
          />
        </div>
        <div className="flex items-center gap-4">
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setCurrentMonth(new Date())}
          >
            Өнөөдөр
          </Button>
          <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-1">
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-base font-semibold min-w-[140px] text-center">
              {format(currentMonth, "yyyy оны MM-р сар", { locale: mn })}
            </h3>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Календарь */}
      <div className="bg-card rounded-xl border shadow-sm p-4 sm:p-6 overflow-hidden">
        {/* Гаригууд */}
        <div className="grid grid-cols-7 text-center text-sm font-medium text-muted-foreground mb-4 gap-2">
          <div className="py-2">Даваа</div>
          <div className="py-2">Мягмар</div>
          <div className="py-2">Лхагва</div>
          <div className="py-2">Пүрэв</div>
          <div className="py-2">Баасан</div>
          <div className="py-2 text-amber-500 font-semibold">Бямба</div>
          <div className="py-2 text-red-500 font-semibold">Ням</div>
        </div>

        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
            <p className="text-muted-foreground">Ачааллаж байна...</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-2">
            {/* Empty cells for offset */}
            {Array.from({ length: startDayOffset }, (_, i) => (
              <div key={`empty-${i}`} className="h-24 sm:h-28 bg-muted/20 rounded-lg" />
            ))}

            {monthDays.map((day) => {
              const records = getDayRecords(day);
              const dayStr = format(day, "yyyy-MM-dd");
              const isWeekendDay = isWeekend(day);
              const isTodayDay = isToday(day);
              
              const matchesSearch = search === "" ||
                records.some((rec) => {
                  const emp = employees.find((e) => e.id === rec.employeeId);
                  return emp && `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(search.toLowerCase());
                });

              if (!matchesSearch && search !== "") return null;

              return (
                <div
                  key={day.toString()}
                  className={`h-24 sm:h-28 border rounded-lg p-2 flex flex-col gap-1 transition-all hover:shadow-md hover:border-primary/50 cursor-pointer group
                    ${isTodayDay ? "border-primary bg-primary/5 shadow-md" : "border-border bg-card"}
                    ${isWeekendDay ? "bg-muted/30" : ""}`}
                  onClick={() => handleQuickAdd(day)}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full transition-colors
                      ${isTodayDay ? "bg-primary text-primary-foreground" : isWeekendDay ? "text-muted-foreground" : "text-foreground group-hover:bg-muted"}`}>
                      {format(day, "d")}
                    </span>
                    {records.length > 0 && (
                      <Badge variant="secondary" className="text-xs h-5 px-1.5">
                        {records.length}
                      </Badge>
                    )}
                  </div>

                  <div className="flex-1 overflow-hidden">
                    <div className="flex flex-wrap gap-1">
                      <TooltipProvider>
                        {records.slice(0, 4).map((rec) => {
                          const config = statusConfig[rec.status || "Present"];
                          return (
                            <Tooltip key={rec.id}>
                              <TooltipTrigger asChild>
                                <div
                                  className={`w-4 h-4 rounded-full cursor-pointer transition-transform hover:scale-125 ${config?.color || "bg-gray-400"}`}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </TooltipTrigger>
                              <TooltipContent className="p-3">
                                <p className="font-bold">{getEmployeeFullName(rec.employeeId)}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge className={`text-xs ${config?.bgColor}`}>
                                    {config?.label}
                                  </Badge>
                                  <span className="text-xs text-muted-foreground">
                                    {(rec.minutesWorked || 0) / 60} цаг
                                  </span>
                                </div>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {rec.checkIn ? format(new Date(rec.checkIn), "HH:mm") : "--:--"} → {rec.checkOut ? format(new Date(rec.checkOut), "HH:mm") : "--:--"}
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                        {records.length > 4 && (
                          <span className="text-xs text-muted-foreground">+{records.length - 4}</span>
                        )}
                      </TooltipProvider>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Легенд */}
      <div className="flex flex-wrap gap-6 justify-center text-sm bg-muted/30 p-4 rounded-xl">
        {Object.entries(statusConfig).map(([key, config]) => (
          <div key={key} className="flex items-center gap-2">
            <div className={`w-4 h-4 rounded-full ${config.color} shadow-sm`} />
            <span className="font-medium">{config.label}</span>
          </div>
        ))}
      </div>

      {/* Өнөөдрийн ирц - Жагсаалт */}
      <Card className="border shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            Өнөөдрийн ирц
            <Badge variant="secondary" className="ml-2">
              {getDayRecords(new Date()).length} бүртгэл
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {getDayRecords(new Date()).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarDays className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Өнөөдөр ирц бүртгэгдээгүй байна</p>
              <Button 
                variant="outline" 
                size="sm" 
                className="mt-3"
                onClick={() => {
                  form.setValue("workDate", format(new Date(), "yyyy-MM-dd"));
                  setOpen(true);
                }}
              >
                <Plus className="w-4 h-4 mr-2" />
                Ирц бүртгэх
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {getDayRecords(new Date()).map((rec) => {
                const config = statusConfig[rec.status || "Present"];
                return (
                  <div key={rec.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary">
                        {getEmployeeName(rec.employeeId).charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium">{getEmployeeFullName(rec.employeeId)}</p>
                        <p className="text-sm text-muted-foreground">
                          {rec.checkIn ? format(new Date(rec.checkIn), "HH:mm") : "--:--"} → {rec.checkOut ? format(new Date(rec.checkOut), "HH:mm") : "--:--"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {(rec.minutesWorked || 0) / 60} цаг
                      </span>
                      <Badge className={`${config?.bgColor} border`}>
                        {config?.label}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
