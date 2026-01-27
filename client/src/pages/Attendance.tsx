import React, { useState, useRef, useEffect } from "react";
import { useAttendance } from "@/hooks/use-attendance";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, isSameDay, addMonths, subMonths, subDays } from "date-fns";
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
import { Plus, Loader2, ChevronLeft, ChevronRight, Search, Calendar, Table as TableIcon, Pencil, Trash2, MapPin, Navigation, CheckCircle2, AlertCircle, Camera, X, Image as ImageIcon } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

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

// Geofencing: Calculate distance between two coordinates (Haversine formula)
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3; // Earth radius in meters
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in meters
}

export default function Attendance() {
  const { attendance = [], isLoading, createAttendance, updateAttendance, deleteAttendance } = useAttendance();
  const [open, setOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceDay | null>(null);
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"calendar" | "table">("calendar");
  const [selectedDay, setSelectedDay] = useState<Date | null>(null); // For drill-down drawer
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { toast } = useToast();
  
  // Table filters
  const [dateRangeFilter, setDateRangeFilter] = useState<"today" | "week" | "month" | "all">("month");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [departmentFilter, setDepartmentFilter] = useState<string>("all");
  const [issuesOnly, setIssuesOnly] = useState(false); // Only late/absent
  const [groupBy, setGroupBy] = useState<"date" | "employee" | "none">("none");
  
  // Geofencing state
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [isCheckingLocation, setIsCheckingLocation] = useState(false);
  const [geofenceStatus, setGeofenceStatus] = useState<{
    isWithinRadius: boolean;
    distance: number;
    branchName: string;
    radius: number;
  } | null>(null);
  
  // Selfie state
  const [checkInPhoto, setCheckInPhoto] = useState<string | null>(null);
  const [checkOutPhoto, setCheckOutPhoto] = useState<string | null>(null);
  const [isCapturingPhoto, setIsCapturingPhoto] = useState<"checkIn" | "checkOut" | null>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Update video element when stream changes
  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch((err) => {
        console.error("Video play error:", err);
      });
    }
    
    // Cleanup
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, [videoStream]);
  
  // Get branches with location data
  const { data: branches = [] } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

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

  // Helper: Convert time string to Date
  const formatTimeToISO = (dateStr: string, timeStr: string | undefined): Date | null => {
    if (!timeStr) return null;
    const cleanTime = timeStr.trim().split(' ')[0]; // Get "HH:mm" part
    const [hours, minutes] = cleanTime.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    const isoString = `${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`;
    return new Date(isoString);
  };

  // Helper: Convert Date to time string (HH:mm)
  const dateToTimeString = (date: Date | null | string): string => {
    if (!date) return "";
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return "";
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  // Selfie Capture Function
  const startCamera = async (type: "checkIn" | "checkOut") => {
    try {
      // Check if mediaDevices is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        // Check if we're on localhost or secure context
        const isSecureContext = window.isSecureContext || 
          location.protocol === 'https:' || 
          location.hostname === 'localhost' || 
          location.hostname === '127.0.0.1' ||
          location.hostname === '[::1]';
        
        if (!isSecureContext) {
          toast({
            title: "Камер боломжгүй",
            description: "Камер ажиллахын тулд HTTPS эсвэл localhost ашиглах шаардлагатай. Одоогийн хаяг: " + location.href,
            variant: "destructive",
            duration: 7000,
          });
        } else {
          toast({
            title: "Камер боломжгүй",
            description: "Таны браузер камерыг дэмжихгүй байна. Браузерын хувилбарыг шинэчилнэ үү.",
            variant: "destructive",
          });
        }
        setIsCapturingPhoto(null);
        return;
      }

      setIsCapturingPhoto(type);
      
      // Request camera permission with better error handling
      // Try different constraints if the first one fails
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { 
            facingMode: "user", // Front camera
            width: { ideal: 640 },
            height: { ideal: 480 }
          }, 
          audio: false 
        });
      } catch (constraintError: any) {
        // If facingMode fails, try without it
        console.warn("Primary constraint failed, trying fallback:", constraintError);
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: true,
          audio: false 
        });
      }
      
      setVideoStream(stream);
    } catch (err: any) {
      console.error("Camera error:", err);
      setIsCapturingPhoto(null);
      
      // Handle specific error types
      let errorMessage = "Камерын зөвшөөрөл авах боломжгүй байна.";
      
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        errorMessage = "Камерын зөвшөөрөл татгалзсан байна. Браузерын тохиргоонд орж камерын зөвшөөрөл өгнө үү.";
      } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
        errorMessage = "Камер олдсонгүй. Камер холбогдсон эсэхийг шалгана уу.";
      } else if (err.name === "NotReadableError" || err.name === "TrackStartError") {
        errorMessage = "Камер ашиглалтад байна. Өөр програм камер ашиглаж байгаа эсэхийг шалгана уу.";
      } else if (err.name === "OverconstrainedError" || err.name === "ConstraintNotSatisfiedError") {
        errorMessage = "Камерын тохиргоо таарахгүй байна. Өөр камер туршиж үзнэ үү.";
      } else if (err.name === "NotSupportedError") {
        errorMessage = "Камер дэмжигдээгүй байна. HTTPS холболт эсвэл localhost ашиглана уу.";
      } else if (err.message) {
        errorMessage = err.message;
      }

      toast({
        title: "Камер нээхэд алдаа",
        description: errorMessage,
        variant: "destructive",
        duration: 5000,
      });
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !videoStream) return;

    const video = videoRef.current;
    
    // Ensure video is ready
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      toast({
        title: "Анхаар",
        description: "Камер бэлэн болохыг хүлээнэ үү...",
        variant: "default",
      });
      return;
    }

    try {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const photoDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        
        if (isCapturingPhoto === "checkIn") {
          setCheckInPhoto(photoDataUrl);
        } else if (isCapturingPhoto === "checkOut") {
          setCheckOutPhoto(photoDataUrl);
        }
        
        // Stop camera
        videoStream.getTracks().forEach(track => track.stop());
        setVideoStream(null);
        setIsCapturingPhoto(null);
        
        toast({
          title: "Амжилттай",
          description: "Селфи амжилттай авлаа.",
        });
      }
    } catch (err: any) {
      console.error("Capture error:", err);
      toast({
        title: "Алдаа",
        description: "Зураг авах явцад алдаа гарлаа: " + err.message,
        variant: "destructive",
      });
    }
  };

  const cancelCamera = () => {
    if (videoStream) {
      videoStream.getTracks().forEach(track => track.stop());
      setVideoStream(null);
    }
    setIsCapturingPhoto(null);
  };

  const removePhoto = (type: "checkIn" | "checkOut") => {
    if (type === "checkIn") {
      setCheckInPhoto(null);
    } else {
      setCheckOutPhoto(null);
    }
  };

  // 3. Submit Handler (Create or Update)
  const onSubmit = async (values: AttendanceFormValues) => {
    try {
      const dateOnly = values.workDate;
      const hours = Number(values.workHours) || 0;

      const payload: Partial<InsertAttendanceDay> = {
        employeeId: values.employeeId,
        workDate: dateOnly,
        checkIn: formatTimeToISO(dateOnly, values.checkIn) || null,
        checkOut: formatTimeToISO(dateOnly, values.checkOut) || null,
        status: values.status.toLowerCase() as "present" | "absent" | "late" | "sick" | "vacation" | "business_trip" | "remote" | "half_day",
        minutesWorked: Math.round(hours * 60),
        note: "",
        checkInPhoto: checkInPhoto || null,
        checkOutPhoto: checkOutPhoto || null,
      };

      if (editingRecord) {
        // Update existing record
        await updateAttendance.mutateAsync({ id: editingRecord.id, data: payload });
        toast({ title: "Амжилттай", description: "Ирцийн бүртгэл амжилттай шинэчлэгдлээ." });
      } else {
        // Create new record
        await createAttendance.mutateAsync(payload as Omit<InsertAttendanceDay, "tenantId">);
        toast({ title: "Амжилттай", description: "Ирц амжилттай бүртгэгдлээ." });
      }

      setOpen(false);
      setEditingRecord(null);
      setCheckInPhoto(null);
      setCheckOutPhoto(null);
      form.reset({
        employeeId: "",
        workDate: format(new Date(), "yyyy-MM-dd"),
        checkIn: "",
        checkOut: "",
        status: "present",
        workHours: "8",
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

  // Edit handler
  const handleEdit = (record: AttendanceDay) => {
    setEditingRecord(record);
    setCheckInPhoto(record.checkInPhoto || null);
    setCheckOutPhoto(record.checkOutPhoto || null);
    form.reset({
      employeeId: record.employeeId,
      workDate: format(new Date(record.workDate), "yyyy-MM-dd"),
      checkIn: dateToTimeString(record.checkIn),
      checkOut: dateToTimeString(record.checkOut),
      status: record.status || "present",
      workHours: record.minutesWorked ? (record.minutesWorked / 60).toString() : "8",
    });
    setOpen(true);
  };

  // Delete handler
  const handleDelete = async (id: string) => {
    if (!confirm("Та энэ ирцийн бүртгэлийг устгахдаа итгэлтэй байна уу?")) {
      return;
    }

    try {
      await deleteAttendance.mutateAsync(id);
      toast({ title: "Амжилттай", description: "Ирцийн бүртгэл амжилттай устгагдлаа." });
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Ирцийн бүртгэл устгахад алдаа гарлаа",
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
    present: { color: "bg-green-500", label: "Ирсэн" },
    absent: { color: "bg-red-500", label: "Ирээгүй" },
    late: { color: "bg-yellow-500", label: "Хоцорсон" },
    sick: { color: "bg-blue-500", label: "Өвчтэй чөлөө" },
    vacation: { color: "bg-purple-500", label: "Ээлжийн амралт" },
    business_trip: { color: "bg-cyan-500", label: "Томилолт" },
    remote: { color: "bg-indigo-500", label: "Зайнаас ажил" },
    half_day: { color: "bg-orange-500", label: "Хагас өдөр" },
    // Legacy support for old status values
    Present: { color: "bg-green-500", label: "Ирсэн" },
    Absent: { color: "bg-red-500", label: "Ирээгүй" },
    Late: { color: "bg-yellow-500", label: "Хоцорсон" },
    Sick: { color: "bg-blue-500", label: "Өвчтэй чөлөө" },
  };

  const getStatusColor = (status: string) => {
    const normalizedStatus = status || 'present';
    return ATTENDANCE_STATUS[normalizedStatus as keyof typeof ATTENDANCE_STATUS]?.color || "bg-gray-400";
  };

  const getStatusText = (status: string) => {
    const normalizedStatus = status || 'present';
    return ATTENDANCE_STATUS[normalizedStatus as keyof typeof ATTENDANCE_STATUS]?.label || "Тодорхойгүй";
  };

  // Өдрийн ирцийн бүртгэлүүд
  const getDayRecords = (date: Date) => {
    if (!attendance) return [];
    return attendance.filter((rec: AttendanceDay) => isSameDay(new Date(rec.workDate), date));
  };
  
  // Get day summary statistics (for calendar summary chips)
  const getDaySummary = (date: Date) => {
    const records = getDayRecords(date);
    const summary = {
      present: 0,
      late: 0,
      absent: 0,
      vacation: 0,
      sick: 0,
      other: 0,
    };
    
    records.forEach((rec: AttendanceDay) => {
      const status = (rec.status || "present").toLowerCase();
      if (status === "present") summary.present++;
      else if (status === "late") summary.late++;
      else if (status === "absent") summary.absent++;
      else if (status === "vacation") summary.vacation++;
      else if (status === "sick") summary.sick++;
      else summary.other++;
    });
    
    return summary;
  };
  
  // Open drill-down drawer for a specific day
  const handleDayClick = (day: Date) => {
    setSelectedDay(day);
    setDrawerOpen(true);
  };

  // Ажилтны нэр олох
  const getEmployeeName = (id: string) => {
    const emp = employees.find(e => e.id === id);
    return emp ? `${emp.firstName} ${emp.lastName}` : "Unknown";
  };

  // Geofencing: Check location and distance
  const checkLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Боломжгүй",
        description: "Таны төхөөрөмж газрын зургийг дэмжихгүй байна.",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation({ lat: latitude, lon: longitude });

        // Find branch with location data
        const branchWithLocation = branches.find((b: any) => 
          b.latitude && b.longitude && b.geofenceRadius
        );

        if (!branchWithLocation) {
          toast({
            title: "Анхаар",
            description: "Оффисын байршлыг тохируулаагүй байна. Тохиргоо руу орж байршлыг оруулна уу.",
            variant: "default",
          });
          setIsCheckingLocation(false);
          return;
        }

        const officeLat = parseFloat(branchWithLocation.latitude);
        const officeLon = parseFloat(branchWithLocation.longitude);
        const radius = branchWithLocation.geofenceRadius || 100;

        const distance = calculateDistance(latitude, longitude, officeLat, officeLon);
        const isWithinRadius = distance <= radius;

        setGeofenceStatus({
          isWithinRadius,
          distance,
          branchName: branchWithLocation.name,
          radius,
        });

        if (isWithinRadius) {
          toast({
            title: "✅ Байршлын радиус дотор байна",
            description: `${branchWithLocation.name}-ийн ${radius}м радиуст байна. Ойролцоогоор ${Math.round(distance)}м зайд.`,
          });
        } else {
          toast({
            title: "⚠️ Байршлын радиус гадуур байна",
            description: `${branchWithLocation.name}-ийн радиус (${radius}м) гадуур байна. Ойролцоогоор ${Math.round(distance)}м зайд.`,
            variant: "destructive",
          });
        }

        setIsCheckingLocation(false);
      },
      (error) => {
        console.error("Geolocation error:", error);
        toast({
          title: "Алдаа гарлаа",
          description: error.message === "User denied Geolocation" 
            ? "Байршлын зөвшөөрөл өгөөгүй байна."
            : "Байршлыг тодорхойлоход алдаа гарлаа.",
          variant: "destructive",
        });
        setIsCheckingLocation(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  // Handle geofencing check-in
  const handleGeofencingCheckIn = () => {
    if (!geofenceStatus?.isWithinRadius) {
      toast({
        title: "Боломжгүй",
        description: "Оффисын радиус дотор биш байна.",
        variant: "destructive",
      });
      return;
    }

    // Auto-fill form with current date and time
    const now = new Date();
    const currentTime = dateToTimeString(now);
    const currentDate = format(now, "yyyy-MM-dd");

    // Find current user's employee record (you may need to get this from auth context)
    if (employees.length > 0) {
      form.reset({
        employeeId: employees[0].id, // Default to first employee (or get from auth)
        workDate: currentDate,
        checkIn: currentTime,
        checkOut: "",
        status: "present",
        workHours: "8",
      });
      setOpen(true);
    } else {
      toast({
        title: "Анхаар",
        description: "Ажилтны мэдээлэл олдсонгүй.",
        variant: "default",
      });
    }
  };

  // Calculate date range based on filter
  const getDateRange = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (dateRangeFilter === "today") {
      return { start: today, end: today };
    } else if (dateRangeFilter === "week") {
      const weekStart = subDays(today, today.getDay() - 1);
      return { start: weekStart, end: today };
    } else if (dateRangeFilter === "month") {
      return { start: startOfMonth(today), end: today };
    }
    return null; // "all" - no date filter
  };

  // Хүснэгт харагдац: Бүх ирцийн бүртгэл with filters
  const filteredAttendanceForTable = attendance
    .filter((rec: AttendanceDay) => {
      const recDate = new Date(rec.workDate);
      
      // Search filter
      if (search) {
        const emp = employees.find(e => e.id === rec.employeeId);
        const empName = emp ? `${emp.firstName} ${emp.lastName}`.toLowerCase() : "";
        const dateStr = format(recDate, "yyyy-MM-dd");
        if (!empName.includes(search.toLowerCase()) && 
            !dateStr.includes(search) &&
            !getStatusText(rec.status || "present").toLowerCase().includes(search.toLowerCase())) {
          return false;
        }
      }
      
      // Date range filter
      const dateRange = getDateRange();
      if (dateRange) {
        recDate.setHours(0, 0, 0, 0);
        if (recDate < dateRange.start || recDate > dateRange.end) {
          return false;
        }
      }
      
      // Status filter
      if (statusFilter !== "all") {
        if ((rec.status || "present").toLowerCase() !== statusFilter.toLowerCase()) {
          return false;
        }
      }
      
      // Issues only (late/absent)
      if (issuesOnly) {
        const status = (rec.status || "present").toLowerCase();
        if (status !== "late" && status !== "absent") {
          return false;
        }
      }
      
      return true;
    })
    .sort((a: AttendanceDay, b: AttendanceDay) => {
      // Grouping: by date or employee
      if (groupBy === "date") {
        const dateA = new Date(a.workDate).getTime();
        const dateB = new Date(b.workDate).getTime();
        if (dateA !== dateB) return dateB - dateA;
        const nameA = getEmployeeName(a.employeeId);
        const nameB = getEmployeeName(b.employeeId);
        return nameA.localeCompare(nameB);
      } else if (groupBy === "employee") {
        const nameA = getEmployeeName(a.employeeId);
        const nameB = getEmployeeName(b.employeeId);
        if (nameA !== nameB) return nameA.localeCompare(nameB);
        const dateA = new Date(a.workDate).getTime();
        const dateB = new Date(b.workDate).getTime();
        return dateB - dateA;
      } else {
        // Default: date then name
        const dateA = new Date(a.workDate).getTime();
        const dateB = new Date(b.workDate).getTime();
        if (dateA !== dateB) return dateB - dateA;
        const nameA = getEmployeeName(a.employeeId);
        const nameB = getEmployeeName(b.employeeId);
        return nameA.localeCompare(nameB);
      }
    });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display">Ирц бүртгэл</h2>
          <p className="text-muted-foreground mt-1">Ажилчдын ирцийг календараас харах, бүртгэх.</p>
        </div>

        <div className="flex gap-2">
          {/* Geofencing Check Location Button */}
          <Button
            variant="outline"
            onClick={checkLocation}
            disabled={isCheckingLocation}
            className="shadow-md"
          >
            {isCheckingLocation ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Шалгаж байна...
              </>
            ) : (
              <>
                <MapPin className="w-4 h-4 mr-2" />
                Байршлыг шалгах
              </>
            )}
          </Button>

          {/* Ирц бүртгэх Button - Opens dialog */}
          <Button 
            className="shadow-lg shadow-primary/25 hover:shadow-primary/30"
            onClick={() => {
              setEditingRecord(null);
              form.reset({
                employeeId: "",
                workDate: format(new Date(), "yyyy-MM-dd"),
                checkIn: "",
                checkOut: "",
                status: "present",
                workHours: "8",
              });
              setOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Ирц бүртгэх
          </Button>
        </div>
      </div>

      {/* Geofencing Status Alert */}
      {geofenceStatus && (
        <Alert className={geofenceStatus.isWithinRadius ? "border-green-500 bg-green-50 dark:bg-green-950" : "border-orange-500 bg-orange-50 dark:bg-orange-950"}>
          {geofenceStatus.isWithinRadius ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-orange-600" />
          )}
          <AlertTitle className={geofenceStatus.isWithinRadius ? "text-green-800 dark:text-green-200" : "text-orange-800 dark:text-orange-200"}>
            {geofenceStatus.isWithinRadius ? "✅ Оффисын радиус дотор байна" : "⚠️ Оффисын радиус гадуур байна"}
          </AlertTitle>
          <AlertDescription className={geofenceStatus.isWithinRadius ? "text-green-700 dark:text-green-300" : "text-orange-700 dark:text-orange-300"}>
            {geofenceStatus.isWithinRadius ? (
              <div className="flex items-center justify-between">
                <span>
                  <strong>{geofenceStatus.branchName}</strong>-ийн {geofenceStatus.radius}м радиуст байна.
                  Ойролцоогоор <strong>{Math.round(geofenceStatus.distance)}м</strong> зайд.
                </span>
                <Button
                  size="sm"
                  onClick={handleGeofencingCheckIn}
                  className="ml-4 bg-green-600 hover:bg-green-700"
                >
                  <CheckCircle2 className="w-4 h-4 mr-1" />
                  Ирц бүртгэх
                </Button>
              </div>
            ) : (
              <div>
                <strong>{geofenceStatus.branchName}</strong>-ийн радиус ({geofenceStatus.radius}м) гадуур байна.
                Ойролцоогоор <strong>{Math.round(geofenceStatus.distance)}м</strong> зайд.
              </div>
            )}
          </AlertDescription>
        </Alert>
      )}

      {/* Ирц бүртгэх Dialog - Single Dialog */}
      <Dialog open={open} onOpenChange={(isOpen) => {
        setOpen(isOpen);
        if (!isOpen) {
          setEditingRecord(null);
          form.reset({
            employeeId: "",
            workDate: format(new Date(), "yyyy-MM-dd"),
            checkIn: "",
            checkOut: "",
            status: "present",
            workHours: "8",
          });
        }
      }}>
        <DialogContent 
          className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto"
          onInteractOutside={() => {
            // Cleanup video stream when closing
            if (videoStream) {
              videoStream.getTracks().forEach(track => track.stop());
              setVideoStream(null);
              setIsCapturingPhoto(null);
            }
          }}
        >
            <DialogHeader>
              <DialogTitle>{editingRecord ? "Ирцийн бүртгэл засах" : "Шинэ ирц бүртгэх"}</DialogTitle>
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

                {/* Selfie Check-in Photo */}
                <div className="space-y-2">
                  <FormLabel>Ирцийн селфи зураг 📸</FormLabel>
                  {!checkInPhoto && !isCapturingPhoto ? (
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => startCamera("checkIn")}
                        className="w-full"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Селфи авах
                      </Button>
                      <div className="text-xs text-muted-foreground space-y-1 p-2 bg-muted/50 rounded">
                        <p className="font-medium">💡 Камерын зөвшөөрөл өгөх заавар:</p>
                        <ol className="list-decimal list-inside ml-2 space-y-1">
                          <li>Браузерын хаягны мөрний зүүн талд заагийн icon (🔒) дээр дарах</li>
                          <li>"Камер" эсвэл "Camera" сонгох</li>
                          <li>"Зөвшөөрөх" эсвэл "Allow" дарна</li>
                          <li>Эсвэл: <a href="chrome://settings/content/camera" target="_blank" className="text-primary underline">chrome://settings/content/camera</a> (Chrome)</li>
                        </ol>
                        <p className="text-orange-600 dark:text-orange-400 mt-2">
                          ⚠️ Хэрэв localhost дээр ажиллахгүй бол камерын зөвшөөрөл өгсөн эсэхийг шалгана уу.
                        </p>
                      </div>
                    </div>
                  ) : isCapturingPhoto === "checkIn" ? (
                    <div className="space-y-2">
                      <div className="relative bg-black rounded-lg overflow-hidden">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full max-h-64"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={capturePhoto}
                          className="flex-1"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Зураг авах
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={cancelCamera}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : checkInPhoto ? (
                    <div className="space-y-2">
                      <div className="relative rounded-lg overflow-hidden border">
                        <img src={checkInPhoto} alt="Check-in selfie" className="w-full max-h-64 object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => removePhoto("checkIn")}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => startCamera("checkIn")}
                        className="w-full"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Дахин авах
                      </Button>
                    </div>
                  ) : null}
                </div>

                {/* Selfie Check-out Photo */}
                <div className="space-y-2">
                  <FormLabel>Явцын селфи зураг 📸 (Сонголттой)</FormLabel>
                  {!checkOutPhoto && !isCapturingPhoto ? (
                    <div className="space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => startCamera("checkOut")}
                        className="w-full"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Селфи авах
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        💡 Камерын зөвшөөрөл өгөх: Браузерын хаягны мөрний заагийн icon дээр дарах → Камер → Зөвшөөрөх
                      </p>
                    </div>
                  ) : isCapturingPhoto === "checkOut" ? (
                    <div className="space-y-2">
                      <div className="relative bg-black rounded-lg overflow-hidden">
                        <video
                          ref={videoRef}
                          autoPlay
                          playsInline
                          muted
                          className="w-full max-h-64"
                        />
                      </div>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          onClick={capturePhoto}
                          className="flex-1"
                        >
                          <Camera className="w-4 h-4 mr-2" />
                          Зураг авах
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={cancelCamera}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ) : checkOutPhoto ? (
                    <div className="space-y-2">
                      <div className="relative rounded-lg overflow-hidden border">
                        <img src={checkOutPhoto} alt="Check-out selfie" className="w-full max-h-64 object-cover" />
                        <Button
                          type="button"
                          variant="destructive"
                          size="sm"
                          className="absolute top-2 right-2"
                          onClick={() => removePhoto("checkOut")}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => startCamera("checkOut")}
                        className="w-full"
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Дахин авах
                      </Button>
                    </div>
                  ) : null}
                </div>

                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={createAttendance.isPending || updateAttendance.isPending}
                >
                  {(createAttendance.isPending || updateAttendance.isPending) ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Хадгалагдаж байна...
                    </>
                  ) : (
                    editingRecord ? "Хадгалах" : "Бүртгэх"
                  )}
                </Button>
              </form>
            </Form>
          </DialogContent>
        </Dialog>

      {/* Харагдах хэлбэр сонгох Tabs */}
      <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "calendar" | "table")} className="w-full">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-sm">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <Search className="w-5 h-5 text-muted-foreground" />
            <Input
              placeholder={viewMode === "calendar" ? "Огноо эсвэл ажилтны нэрээр хайх..." : "Ажилтны нэр, огноо эсвэл төлөвөөр хайх..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0 px-0 bg-transparent min-w-[200px]"
            />
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {viewMode === "calendar" && (
              <>
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
                {/* Legend as compact pills - Мoved to filter bar */}
                <div className="flex items-center gap-1.5 ml-auto">
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 text-[10px]">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span>Ирсэн</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 text-[10px]">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span>Хоцорсон</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 text-[10px]">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <span>Ирээгүй</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted/50 text-[10px]">
                    <div className="w-2 h-2 rounded-full bg-purple-500" />
                    <span>Чөлөө</span>
                  </div>
                </div>
              </>
            )}
            <TabsList>
              <TabsTrigger value="calendar" className="gap-2">
                <Calendar className="w-4 h-4" />
                Календар
              </TabsTrigger>
              <TabsTrigger value="table" className="gap-2">
                <TableIcon className="w-4 h-4" />
                Хүснэгт
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        {/* Календарь харагдац */}
        <TabsContent value="calendar" className="space-y-8">
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

                <div 
                  className="flex flex-col gap-1 flex-1 overflow-y-auto custom-scrollbar cursor-pointer"
                  onClick={() => handleDayClick(day)}
                >
                  {records.length === 0 ? (
                    <span className="text-[10px] text-muted-foreground">-</span>
                  ) : records.length <= 4 ? (
                    // Show dots if 4 or fewer employees (simple case)
                    <TooltipProvider>
                      <div className="flex flex-wrap gap-1">
                        {records.map((rec) => (
                          <Tooltip key={rec.id}>
                            <TooltipTrigger asChild>
                              <div
                                className={`w-3 h-3 rounded-full ${getStatusColor(rec.status || 'Present')}`}
                              />
                            </TooltipTrigger>
                            <TooltipContent>
                              <p className="font-bold">{getEmployeeName(rec.employeeId)}</p>
                              <p className="text-xs">{getStatusText(rec.status || 'Present')} • {(rec.minutesWorked || 0) / 60}h</p>
                            </TooltipContent>
                          </Tooltip>
                        ))}
                      </div>
                    </TooltipProvider>
                  ) : (
                    // Show summary chips if more than 4 employees (enterprise-ready)
                    (() => {
                      const summary = getDaySummary(day);
                      return (
                        <div className="space-y-0.5 text-[9px]">
                          {summary.present > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
                              <span className="text-green-700 dark:text-green-400">Ирсэн: {summary.present}</span>
                            </div>
                          )}
                          {summary.late > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-yellow-500 flex-shrink-0" />
                              <span className="text-yellow-700 dark:text-yellow-400">Хоцорсон: {summary.late}</span>
                            </div>
                          )}
                          {summary.absent > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
                              <span className="text-red-700 dark:text-red-400">Ирээгүй: {summary.absent}</span>
                            </div>
                          )}
                          {summary.vacation > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                              <span className="text-purple-700 dark:text-purple-400">Чөлөө: {summary.vacation}</span>
                            </div>
                          )}
                          {summary.sick > 0 && (
                            <div className="flex items-center gap-1">
                              <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                              <span className="text-blue-700 dark:text-blue-400">Өвчтэй: {summary.sick}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Легенд - Compact pills in top filter bar instead of separate section */}
        </TabsContent>
        
        {/* Drill-down Drawer for Day Details */}
        <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
          <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto">
            <SheetHeader>
              <SheetTitle>
                {selectedDay ? format(selectedDay, "yyyy-MM-dd (EEEE)") : "Ирцийн дэлгэрэнгүй"}
              </SheetTitle>
              <SheetDescription>
                Энэ өдрийн бүх ажилтнуудын ирцийн мэдээлэл
              </SheetDescription>
            </SheetHeader>
            
            {selectedDay && (() => {
              const dayRecords = getDayRecords(selectedDay);
              const summary = getDaySummary(selectedDay);
              
              return (
                <div className="mt-6 space-y-4">
                  {/* Summary Stats */}
                  <div className="grid grid-cols-2 gap-2 p-4 bg-muted/50 rounded-lg">
                    {summary.present > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-green-500" />
                        <span className="text-sm">Ирсэн: <strong>{summary.present}</strong></span>
                      </div>
                    )}
                    {summary.late > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-yellow-500" />
                        <span className="text-sm">Хоцорсон: <strong>{summary.late}</strong></span>
                      </div>
                    )}
                    {summary.absent > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-red-500" />
                        <span className="text-sm">Ирээгүй: <strong>{summary.absent}</strong></span>
                      </div>
                    )}
                    {summary.vacation > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                        <span className="text-sm">Чөлөө: <strong>{summary.vacation}</strong></span>
                      </div>
                    )}
                  </div>
                  
                  {/* Employee List */}
                  <div className="space-y-2">
                    <h3 className="font-semibold text-sm">Ажилтнууд ({dayRecords.length})</h3>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                      {dayRecords.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">Энэ өдөр ирц бүртгэгдээгүй</p>
                      ) : (
                        dayRecords.map((rec: AttendanceDay) => (
                          <Card key={rec.id} className="p-3">
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <div className={`w-2 h-2 rounded-full ${getStatusColor(rec.status || "present")}`} />
                                  <span className="font-medium">{getEmployeeName(rec.employeeId)}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {getStatusText(rec.status || "present")}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                  <p>Ирсэн: {rec.checkIn ? format(new Date(rec.checkIn), "HH:mm") : "-"}</p>
                                  <p>Явсан: {rec.checkOut ? format(new Date(rec.checkOut), "HH:mm") : "-"}</p>
                                  {rec.minutesWorked && (
                                    <p>Ажилласан: {(rec.minutesWorked / 60).toFixed(1)} цаг</p>
                                  )}
                                </div>
                              </div>
                              <div className="flex gap-1">
                                <Button variant="ghost" size="sm" onClick={() => {
                                  setDrawerOpen(false);
                                  handleEdit(rec);
                                }}>
                                  <Pencil className="w-4 h-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))
                      )}
                    </div>
                  </div>
                  
                  {/* Quick Actions */}
                  <div className="pt-4 border-t">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setDrawerOpen(false);
                        form.reset({
                          workDate: format(selectedDay, "yyyy-MM-dd"),
                          employeeId: "",
                          checkIn: "",
                          checkOut: "",
                          status: "present",
                        });
                        setOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Энэ өдөр ирц нэмэх
                    </Button>
                  </div>
                </div>
              );
            })()}
          </SheetContent>
        </Sheet>

        {/* Хүснэгт харагдац */}
        <TabsContent value="table" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ирцийн бүртгэл</CardTitle>
              <CardDescription>
                Бүх ажилчдын ирцийн бүртгэл хүснэгт хэлбэрээр
              </CardDescription>
            </CardHeader>
            
            {/* Filter Bar */}
            <div className="px-6 pb-4 space-y-3 border-b">
              <div className="flex flex-wrap items-center gap-3">
                {/* Date Range Filter */}
                <Select value={dateRangeFilter} onValueChange={(v: any) => setDateRangeFilter(v)}>
                  <SelectTrigger className="w-32 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="today">Өнөөдөр</SelectItem>
                    <SelectItem value="week">Энэ долоо хоног</SelectItem>
                    <SelectItem value="month">Энэ сар</SelectItem>
                    <SelectItem value="all">Бүгд</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Status Filter */}
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue placeholder="Төлөв" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Бүх төлөв</SelectItem>
                    <SelectItem value="present">Ирсэн</SelectItem>
                    <SelectItem value="late">Хоцорсон</SelectItem>
                    <SelectItem value="absent">Ирээгүй</SelectItem>
                    <SelectItem value="vacation">Чөлөө</SelectItem>
                    <SelectItem value="sick">Өвчтэй</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Issues Only Toggle */}
                <div className="flex items-center gap-2">
                  <Switch
                    id="issues-only"
                    checked={issuesOnly}
                    onCheckedChange={setIssuesOnly}
                  />
                  <Label htmlFor="issues-only" className="text-xs cursor-pointer">
                    Зөвхөн асуудалтай
                  </Label>
                </div>
                
                {/* Grouping Toggle */}
                <Select value={groupBy} onValueChange={(v: any) => setGroupBy(v)}>
                  <SelectTrigger className="w-36 h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Бүлэглэхгүй</SelectItem>
                    <SelectItem value="date">Огноогоор</SelectItem>
                    <SelectItem value="employee">Ажилтнаар</SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Results count */}
                <div className="ml-auto text-xs text-muted-foreground">
                  {filteredAttendanceForTable.length} бүртгэл
                </div>
              </div>
            </div>
            
            <CardContent className="pt-4">
              {isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredAttendanceForTable.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  {search ? "Хайлтын үр дүн олдсонгүй" : "Ирцийн бүртгэл байхгүй байна"}
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Ажилтан</TableHead>
                        <TableHead>Огноо</TableHead>
                        <TableHead>Төлөв</TableHead>
                        <TableHead>Ирсэн цаг</TableHead>
                        <TableHead>Явсан цаг</TableHead>
                        <TableHead>Селфи</TableHead>
                        <TableHead className="text-right">Ажилласан цаг</TableHead>
                        <TableHead className="text-right">Үйлдэл</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {groupBy === "date" ? (
                        // Group by date
                        (() => {
                          const grouped = filteredAttendanceForTable.reduce((acc: Record<string, AttendanceDay[]>, rec: AttendanceDay) => {
                            const dateStr = format(new Date(rec.workDate), "yyyy-MM-dd");
                            if (!acc[dateStr]) acc[dateStr] = [];
                            acc[dateStr].push(rec);
                            return acc;
                          }, {});
                          
                          return Object.entries(grouped).sort(([a], [b]) => b.localeCompare(a)).map(([dateStr, recs]) => (
                            <React.Fragment key={dateStr}>
                              <TableRow className="bg-muted/50">
                                <TableCell colSpan={8} className="font-semibold text-sm">
                                  {format(new Date(dateStr), "yyyy-MM-dd (EEEE)")}
                                </TableCell>
                              </TableRow>
                              {recs.map((rec: AttendanceDay) => (
                                <TableRow key={rec.id}>
                                  <TableCell className="font-medium pl-8">
                                    {getEmployeeName(rec.employeeId)}
                                  </TableCell>
                                  <TableCell>
                                    {format(new Date(rec.workDate), "yyyy-MM-dd")}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${getStatusColor(rec.status || "present")}`} />
                                      <span>{getStatusText(rec.status || "present")}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {rec.checkIn ? format(new Date(rec.checkIn), "HH:mm") : "-"}
                                  </TableCell>
                                  <TableCell>
                                    {rec.checkOut ? format(new Date(rec.checkOut), "HH:mm") : "-"}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      {rec.checkInPhoto && <ImageIcon className="w-4 h-4 text-blue-500" />}
                                      {rec.checkOutPhoto && <ImageIcon className="w-4 h-4 text-green-500" />}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {rec.minutesWorked ? `${(rec.minutesWorked / 60).toFixed(1)}h` : "-"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button variant="ghost" size="sm" onClick={() => handleEdit(rec)}>
                                        <Pencil className="w-4 h-4" />
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => handleDelete(rec.id)}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </React.Fragment>
                          ));
                        })()
                      ) : groupBy === "employee" ? (
                        // Group by employee
                        (() => {
                          const grouped = filteredAttendanceForTable.reduce((acc: Record<string, AttendanceDay[]>, rec: AttendanceDay) => {
                            const name = getEmployeeName(rec.employeeId);
                            if (!acc[name]) acc[name] = [];
                            acc[name].push(rec);
                            return acc;
                          }, {});
                          
                          return Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([name, recs]) => (
                            <React.Fragment key={name}>
                              <TableRow className="bg-muted/50">
                                <TableCell colSpan={8} className="font-semibold text-sm">
                                  {name}
                                </TableCell>
                              </TableRow>
                              {recs.map((rec: AttendanceDay) => (
                                <TableRow key={rec.id}>
                                  <TableCell className="font-medium pl-8">
                                    {getEmployeeName(rec.employeeId)}
                                  </TableCell>
                                  <TableCell>
                                    {format(new Date(rec.workDate), "yyyy-MM-dd")}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex items-center gap-2">
                                      <div className={`w-2 h-2 rounded-full ${getStatusColor(rec.status || "present")}`} />
                                      <span>{getStatusText(rec.status || "present")}</span>
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    {rec.checkIn ? format(new Date(rec.checkIn), "HH:mm") : "-"}
                                  </TableCell>
                                  <TableCell>
                                    {rec.checkOut ? format(new Date(rec.checkOut), "HH:mm") : "-"}
                                  </TableCell>
                                  <TableCell>
                                    <div className="flex gap-1">
                                      {rec.checkInPhoto && <ImageIcon className="w-4 h-4 text-blue-500" />}
                                      {rec.checkOutPhoto && <ImageIcon className="w-4 h-4 text-green-500" />}
                                    </div>
                                  </TableCell>
                                  <TableCell className="text-right">
                                    {rec.minutesWorked ? `${(rec.minutesWorked / 60).toFixed(1)}h` : "-"}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <div className="flex justify-end gap-1">
                                      <Button variant="ghost" size="sm" onClick={() => handleEdit(rec)}>
                                        <Pencil className="w-4 h-4" />
                                      </Button>
                                      <Button variant="ghost" size="sm" onClick={() => handleDelete(rec.id)}>
                                        <Trash2 className="w-4 h-4 text-destructive" />
                                      </Button>
                                    </div>
                                  </TableCell>
                                </TableRow>
                              ))}
                            </React.Fragment>
                          ));
                        })()
                      ) : (
                        // No grouping - default flat list
                        filteredAttendanceForTable.map((rec: AttendanceDay) => (
                          <TableRow key={rec.id}>
                            <TableCell className="font-medium">
                              {getEmployeeName(rec.employeeId)}
                            </TableCell>
                            <TableCell>
                              {format(new Date(rec.workDate), "yyyy-MM-dd")}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${getStatusColor(rec.status || "present")}`} />
                                <span>{getStatusText(rec.status || "present")}</span>
                              </div>
                            </TableCell>
                            <TableCell>
                              {rec.checkIn ? format(new Date(rec.checkIn), "HH:mm") : "-"}
                            </TableCell>
                            <TableCell>
                              {rec.checkOut ? format(new Date(rec.checkOut), "HH:mm") : "-"}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                {rec.checkInPhoto ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={() => {
                                            const newWindow = window.open();
                                            if (newWindow) {
                                              newWindow.document.write(`<img src="${rec.checkInPhoto}" style="max-width: 100%; height: auto;" />`);
                                            }
                                          }}
                                          className="relative"
                                        >
                                          <ImageIcon className="w-5 h-5 text-blue-500 hover:text-blue-700" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Ирцийн селфи</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : null}
                                {rec.checkOutPhoto ? (
                                  <TooltipProvider>
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <button
                                          onClick={() => {
                                            const newWindow = window.open();
                                            if (newWindow) {
                                              newWindow.document.write(`<img src="${rec.checkOutPhoto}" style="max-width: 100%; height: auto;" />`);
                                            }
                                          }}
                                          className="relative"
                                        >
                                          <ImageIcon className="w-5 h-5 text-green-500 hover:text-green-700" />
                                        </button>
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        <p>Явцын селфи</p>
                                      </TooltipContent>
                                    </Tooltip>
                                  </TooltipProvider>
                                ) : null}
                                {!rec.checkInPhoto && !rec.checkOutPhoto && (
                                  <span className="text-muted-foreground text-xs">-</span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {rec.minutesWorked ? `${(rec.minutesWorked / 60).toFixed(1)}h` : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(rec)}
                                  className="h-8 w-8"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(rec.id)}
                                  className="h-8 w-8 text-destructive hover:text-destructive"
                                  disabled={deleteAttendance.isPending}
                                >
                                  {deleteAttendance.isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-4 w-4" />
                                  )}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
              {!isLoading && filteredAttendanceForTable.length > 0 && (
                <div className="mt-4 text-sm text-muted-foreground text-center">
                  Нийт {filteredAttendanceForTable.length} бүртгэл олдлоо
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}