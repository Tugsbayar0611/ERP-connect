import { useState } from "react";
import { useAttendance } from "@/hooks/use-attendance";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
// Updated imports for new schema
import type { Employee, InsertAttendanceDay, AttendanceDay } from "@shared/schema";
import { z } from "zod";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Loader2, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// 1. Form Schema
const attendanceFormSchema = z.object({
  employeeId: z.string().min(1, "Ажилтан сонгоно уу"),
  workDate: z.string().min(1, "Огноо бөглөнө үү"),
  checkIn: z.string().optional(),
  checkOut: z.string().optional(),
  status: z.string().min(1, "Төлөв сонгоно уу"),
  workHours: z.string().optional(), // We'll convert this to minutesWorked
});

type AttendanceFormValues = z.infer<typeof attendanceFormSchema>;

export default function Attendance() {
  const { attendance = [], isLoading, createAttendance } = useAttendance();
  const [open, setOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [search, setSearch] = useState("");
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

  // 2. Form Default Values
  const form = useForm<AttendanceFormValues>({
    resolver: zodResolver(attendanceFormSchema),
    defaultValues: {
      employeeId: "",
      workDate: format(new Date(), "yyyy-MM-dd"),
      checkIn: "",
      checkOut: "",
      status: "present",
      workHours: "8",
    },
  });

  // 3. Submit Handler
  const onSubmit = async (values: AttendanceFormValues) => {
    try {
      const dateOnly = values.workDate;
      const hours = Number(values.workHours) || 0;

      const payload: InsertAttendanceDay = {
        employeeId: values.employeeId, // UUID usually, but schema might expect string
        // Wait, schema UUIDs are strings. But employeeId in form is string.
        // If schema expects UUID string, we pass it directly.
        // But checking previous file, it used Number(values.employeeId).
        // New schema uses UUIDs, so it should remain string!
        workDate: dateOnly, // string date
        checkIn: values.checkIn
          ? new Date(`${dateOnly}T${values.checkIn}`)
          : null,
        checkOut: values.checkOut
          ? new Date(`${dateOnly}T${values.checkOut}`)
          : null,
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

  // 4. Календарь тохиргоо (Даваа гаригаас эхлүүлэх)
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const monthDays = eachDayOfInterval({ start: monthStart, end: monthEnd });

  let startDayOffset = getDay(monthStart) - 1;
  if (startDayOffset < 0) startDayOffset = 6;

  // Өнгө ба Текст - Монголын ирцийн төлөв
  const ATTENDANCE_STATUS = {
    present: { color: "bg-green-500", label: "Ирсэн", icon: "check" },
    absent: { color: "bg-red-500", label: "Ирээгүй", icon: "x" },
    late: { color: "bg-yellow-500", label: "Хоцорсон", icon: "clock" },
    sick: { color: "bg-blue-500", label: "Өвчтэй чөлөө", icon: "heart" },
    vacation: { color: "bg-purple-500", label: "Ээлжийн амралт", icon: "sun" },
    business_trip: { color: "bg-cyan-500", label: "Томилолт", icon: "plane" },
    remote: { color: "bg-indigo-500", label: "Зайнаас ажил", icon: "home" },
    half_day: { color: "bg-orange-500", label: "Хагас өдөр", icon: "half" },
    // Legacy support for old status values
    Present: { color: "bg-green-500", label: "Ирсэн", icon: "check" },
    Absent: { color: "bg-red-500", label: "Ирээгүй", icon: "x" },
    Late: { color: "bg-yellow-500", label: "Хоцорсон", icon: "clock" },
    Sick: { color: "bg-blue-500", label: "Өвчтэй чөлөө", icon: "heart" },
  };

  const getStatusColor = (status: string) => {
    return ATTENDANCE_STATUS[status as keyof typeof ATTENDANCE_STATUS]?.color || "bg-gray-400";
  };

  const getStatusText = (status: string) => {
    return ATTENDANCE_STATUS[status as keyof typeof ATTENDANCE_STATUS]?.label || "Тодорхойгүй";
  };

  // Өдрийн ирцийн бүртгэлүүд
  const getDayRecords = (date: Date) => {
    if (!attendance) return [];
    return attendance.filter((rec: AttendanceDay) => isSameDay(new Date(rec.workDate), date));
  };

  // Ажилтны нэр олох
  const getEmployeeName = (id: string) => {
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.firstName} ${emp.lastName}` : "Unknown";
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display">Ирц бүртгэл</h2>
          <p className="text-muted-foreground mt-1">Ажилчдын ирцийг календараас харах, бүртгэх.</p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shadow-lg shadow-primary/25 hover:shadow-primary/30">
              <Plus className="w-4 h-4 mr-2" />
              Ирц бүртгэх
            </Button>
          </DialogTrigger>

          <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Шинэ ирц бүртгэх</DialogTitle>
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
                          <SelectTrigger>
                            <SelectValue placeholder="Ажилтнаа сонгоно уу" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {employees.map((emp) => (
                            <SelectItem key={emp.id} value={emp.id}>
                              {emp.firstName} {emp.lastName} ({emp.employeeNo})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Огноо */}
                <FormField
                  control={form.control}
                  name="workDate"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Огноо</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} value={field.value} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Ирсэн / Явсан цаг */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="checkIn"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Ирсэн цаг</FormLabel>
                        <FormControl>
                          <Input type="time" {...field} value={field.value} />
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
                          <Input type="time" {...field} value={field.value} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Төлөв */}
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Төлөв</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Төлөв сонгоно уу" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="present">Ирсэн</SelectItem>
                            <SelectItem value="absent">Ирээгүй</SelectItem>
                            <SelectItem value="late">Хоцорсон</SelectItem>
                            <SelectItem value="sick">Өвчтэй чөлөө</SelectItem>
                            <SelectItem value="vacation">Ээлжийн амралт</SelectItem>
                            <SelectItem value="business_trip">Томилолт</SelectItem>
                            <SelectItem value="remote">Зайнаас ажил</SelectItem>
                            <SelectItem value="half_day">Хагас өдөр</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

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
                            {...field}
                            value={field.value}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={createAttendance.isPending}>
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

      {/* Хайлт */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
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
          <h3 className="text-xl font-semibold capitalize min-w-[150px] text-center">
            {format(currentMonth, "yyyy MMM")}
          </h3>
          <div className="flex gap-1">
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Календарь Grid */}
      <div className="bg-card rounded-xl border shadow-sm p-6 overflow-hidden">
        {/* Гаригууд */}
        <div className="grid grid-cols-7 text-center text-sm font-medium text-muted-foreground mb-4">
          <div>Даваа</div>
          <div>Мягмар</div>
          <div>Лхагва</div>
          <div>Пүрэв</div>
          <div>Баасан</div>
          <div className="text-primary font-bold">Бямба</div>
          <div className="text-primary font-bold">Ням</div>
        </div>

        <div className="grid grid-cols-7 gap-3">
          {Array.from({ length: startDayOffset }, (_, i) => (
            <div key={`empty-${i}`} className="h-24 sm:h-32 bg-muted/5 rounded-xl border border-transparent" />
          ))}

          {monthDays.map((day) => {
            const records = getDayRecords(day);
            const dayStr = format(day, "yyyy-MM-dd");
            const matchesSearch = search === "" ||
              dayStr.includes(search) ||
              records.some((rec) => {
                const emp = employees.find((e) => e.id === rec.employeeId);
                return emp && `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(search.toLowerCase());
              });

            if (!matchesSearch && search !== "") return <div key={day.toString()} className="h-32 hidden" />;

            return (
              <div
                key={day.toString()}
                className={`h-24 sm:h-32 border rounded-xl p-2 flex flex-col gap-2 transition-all hover:shadow-md
                  ${isSameDay(day, new Date()) ? "border-primary bg-primary/5" : "border-border bg-card"}`}
              >
                <span className={`text-sm font-semibold w-7 h-7 flex items-center justify-center rounded-full
                   ${isSameDay(day, new Date()) ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                  {format(day, "d")}
                </span>

                <div className="flex flex-wrap content-start gap-1 overflow-y-auto custom-scrollbar">
                  <TooltipProvider>
                    {records.map((rec) => (
                      <Tooltip key={rec.id}>
                        <TooltipTrigger asChild>
                          <div
                            className={`w-3 h-3 rounded-full cursor-pointer ${getStatusColor(rec.status || 'Present')}`}
                          />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-bold">{getEmployeeName(rec.employeeId)}</p>
                          <p className="text-xs">{getStatusText(rec.status || 'Present')} • {(rec.minutesWorked || 0) / 60}h</p>
                          <p className="text-xs">
                            {rec.checkIn ? format(new Date(rec.checkIn), "HH:mm") : "-"} -
                            {rec.checkOut ? format(new Date(rec.checkOut), "HH:mm") : "-"}
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                  </TooltipProvider>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Легенд */}
      <div className="flex flex-wrap gap-4 justify-center text-sm bg-muted/30 p-4 rounded-lg">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-500" />
          <span>Ирсэн</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500" />
          <span>Ирээгүй</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500" />
          <span>Хоцорсон</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Өвчтэй</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span>Амралт</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-cyan-500" />
          <span>Томилолт</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-indigo-500" />
          <span>Зайнаас</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-orange-500" />
          <span>Хагас өдөр</span>
        </div>
      </div>
    </div>
  );
}