
import React, { useState, useEffect } from "react";
import { format } from "date-fns";
import { mn } from "date-fns/locale";
import { useQuery } from "@tanstack/react-query";
import {
    MapPin,
    Clock,
    CheckCircle2,
    AlertCircle,
    Loader2,
    Calendar,
    LogOut,
    RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAttendance } from "@/hooks/use-attendance";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

// --- 1. Mongolian Dictionary & Config ---
const I18N = {
    attendance: {
        checkIn: "Ирц бүртгэх",
        checkOut: "Гарах",
        checkOutStart: "Ирц хаах", // Alternative if needed
        doneForToday: "Өнөөдөр бүртгүүлсэн",
        office: "Гол оффис",
        distanceAway_m: "Оффисоос {{m}} м зайтай",
        distanceAway_km: "Оффисоос {{km}} км зайтай",
        outOfRangeTitle: "Оффисоос хол байна",
        outOfRangeDesc: "Оффисын радиуст ормогц ирц бүртгэх боломжтой болно.",
        outOfRangeTooltip: "Оффисын радиуст ормогц идэвхжинэ",
        recentHistory: "Сүүлийн бүртгэлүүд",
        noHistory: "Одоогоор бүртгэл алга байна.",
        refreshLocation: "Байршлыг дахин шалгах",
        locationError: "Байршил тодорхойлоход алдаа гарлаа",
        locating: "Байршил тогтоож байна...",
        checkingGPS: "GPS шалгаж байна...",
        unknownLocation: "Тодорхойгүй байршил",
        successCheckIn: "Ирц амжилттай бүртгэгдлээ.",
        successCheckOut: "Ирц амжилттай хаагдлаа.",
        errorTitle: "Алдаа",
        errorDesc: "Алдаа гарлаа",
        status: {
            late: "Хоцорсон",
            present: "Хэвийн",
            early_leave: "Эрт гарсан",
            on_leave: "Чөлөөтэй",
            absent: "Тасалсан"
        }
    }
};

// --- 2. Helper Functions ---

// Date Format: "2026.02.02 (Даваа)"
function formatMongolianDate(date: Date): string {
    const yyyy = format(date, "yyyy");
    const MM = format(date, "MM");
    const dd = format(date, "dd");

    // Day name mapping
    const dayNames = ["Ням", "Даваа", "Мягмар", "Лхагва", "Пүрэв", "Баасан", "Бямба"];
    const dayName = dayNames[date.getDay()];

    return `${yyyy}.${MM}.${dd} (${dayName})`;
}

// Distance Format: 3645m -> "3.6 км", 850m -> "850 м"
function formatDistance(meters: number): string {
    if (meters >= 1000) {
        return (meters / 1000).toFixed(1) + " км";
    }
    return Math.round(meters) + " м";
}

// Helper: Calculate distance (Haversine)
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

    return R * c;
}

export default function EmployeeAttendanceView() {
    const { user } = useAuth();
    const { checkIn, checkOut } = useAttendance();
    const { toast } = useToast();

    // State
    const [now, setNow] = useState(new Date());
    const [locationStatus, setLocationStatus] = useState<{
        inRadius: boolean;
        distance: number;
        branchName: string;
        loading: boolean;
        error?: string;
    }>({ inRadius: false, distance: 0, branchName: "", loading: false });

    // Fetch branches for geofencing
    const { data: branches = [] } = useQuery<any[]>({
        queryKey: ["/api/branches"],
        enabled: !!user,
        queryFn: async () => {
            const res = await fetch("/api/branches");
            if (!res.ok) throw new Error("Failed to fetch branches");
            return res.json();
        },
    });

    // Fetch my attendance for today
    const { data: myHistory = [], refetch } = useQuery({
        queryKey: ["/api/attendance/me", user?.id],
        enabled: !!user,
        queryFn: async () => {
            const res = await fetch("/api/attendance/me");
            if (!res.ok) throw new Error("Failed to fetch history");
            return res.json();
        },
    });

    // Determine current status
    const todayStr = format(new Date(), "yyyy-MM-dd");
    const todayRecord = myHistory.find((r: any) => r.workDate === todayStr);
    const isCheckedIn = !!todayRecord?.checkIn && !todayRecord?.checkOut;
    const isCheckedOut = !!todayRecord?.checkOut;

    // Timer for clock
    useEffect(() => {
        const timer = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    // Location Check Function
    const checkLocation = () => {
        if (!navigator.geolocation) {
            setLocationStatus(prev => ({ ...prev, loading: false, error: "Geolocation not supported" }));
            return;
        }

        setLocationStatus(prev => ({ ...prev, loading: true, error: undefined }));

        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const { latitude, longitude } = pos.coords;

                // Find nearest branch
                let nearest = null;
                let minDistance = Infinity;

                // Filter branches with location
                const validBranches = branches.filter((b: any) => b.latitude && b.longitude);

                if (validBranches.length === 0) {
                    setLocationStatus({
                        inRadius: false,
                        distance: 0,
                        branchName: "",
                        loading: false,
                        error: "No branches with location configured."
                    });
                    return;
                }

                validBranches.forEach((b: any) => {
                    const dist = calculateDistance(latitude, longitude, parseFloat(b.latitude), parseFloat(b.longitude));
                    if (dist < minDistance) {
                        minDistance = dist;
                        nearest = b;
                    }
                });

                if (nearest) {
                    const radius = (nearest as any).geofenceRadius || 100;
                    setLocationStatus({
                        inRadius: minDistance <= radius,
                        distance: minDistance, // keep raw for formatting logic
                        branchName: (nearest as any).name,
                        loading: false
                    });
                }
            },
            (err) => {
                setLocationStatus(prev => ({ ...prev, loading: false, error: err.message }));
                toast({ title: I18N.attendance.errorTitle, description: err.message, variant: "destructive" });
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    // Initial location check check on mount
    // Check location when branches are loaded or user changes
    useEffect(() => {
        if (branches.length > 0 && user) {
            checkLocation();
        }
    }, [branches, user]);

    // Handlers
    const handleCheckIn = async () => {
        if (!locationStatus.loading && !locationStatus.inRadius) {
            toast({ title: I18N.attendance.outOfRangeTitle, description: I18N.attendance.outOfRangeDesc, variant: "destructive" });
            return;
        }

        try {
            await checkIn.mutateAsync({
                latitude: undefined,
            });
            toast({ title: "Success", description: I18N.attendance.successCheckIn });
            refetch();
        } catch (err: any) {
            toast({ title: I18N.attendance.errorTitle, description: err.message, variant: "destructive" });
        }
    };

    const handleCheckOut = async () => {
        try {
            await checkOut.mutateAsync({});
            toast({ title: "Success", description: I18N.attendance.successCheckOut });
            refetch();
        } catch (err: any) {
            toast({ title: I18N.attendance.errorTitle, description: err.message, variant: "destructive" });
        }
    };

    // Construct distance text
    const distanceText = locationStatus.loading
        ? I18N.attendance.checkingGPS
        : (I18N.attendance.distanceAway_m
            .replace("{{m}}", Math.round(locationStatus.distance).toString())
            .replace("{{km}}", (locationStatus.distance / 1000).toFixed(1)));

    // Better logic: if > 1km show KM text, else show M text manually if template logic is simple
    // Or just use our helper:
    const displayDistance = locationStatus.loading
        ? I18N.attendance.checkingGPS
        : `Оффисоос ${formatDistance(locationStatus.distance)} зайтай`;

    return (
        <TooltipProvider>
            <div className="max-w-md mx-auto space-y-6">
                {/* Header / Timer */}
                <div className="text-center space-y-2 py-6">
                    <h2 className="text-5xl font-mono font-bold tracking-widest text-primary drop-shadow-sm">
                        {format(now, "HH:mm:ss")}
                    </h2>
                    <p className="text-lg text-muted-foreground font-medium">
                        {formatMongolianDate(now)}
                    </p>
                </div>

                {/* Location Status */}
                <Card className="border-none shadow-sm bg-muted/50 overflow-hidden">
                    <CardContent className="pt-6 flex items-center justify-between pb-6">
                        <div className="flex items-center space-x-4">
                            <div className={`p-3 rounded-full transition-colors ${locationStatus.inRadius ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                <MapPin className="w-6 h-6" />
                            </div>
                            <div>
                                <p className="font-semibold text-base">
                                    {locationStatus.loading ? I18N.attendance.locating : locationStatus.branchName || I18N.attendance.unknownLocation}
                                </p>
                                <p className="text-sm text-muted-foreground">
                                    {displayDistance}
                                </p>
                            </div>
                        </div>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button variant="ghost" size="icon" onClick={checkLocation} disabled={locationStatus.loading} className="hover:bg-background/80">
                                    {locationStatus.loading ? (
                                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                                    ) : (
                                        <RefreshCw className="w-5 h-5 text-muted-foreground" />
                                    )}
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                <p>{I18N.attendance.refreshLocation}</p>
                            </TooltipContent>
                        </Tooltip>
                    </CardContent>
                </Card>

                {/* Action Button */}
                <div className="grid gap-4">
                    {isCheckedIn ? (
                        <Button
                            size="lg"
                            variant="destructive"
                            className="w-full h-24 text-xl shadow-lg hover:shadow-xl transition-all hover:scale-[1.01] active:scale-[0.99] rounded-xl"
                            onClick={handleCheckOut}
                        >
                            <LogOut className="w-8 h-8 mr-3" />
                            {I18N.attendance.checkOut}
                        </Button>
                    ) : (
                        <Tooltip>
                            {/* Only show tooltip if disabled (out of range) - but TooltipTrigger wraps the button regardless */}
                            <TooltipTrigger asChild>
                                <span tabIndex={0} className="w-full">
                                    {/* Span wrapper needed for disabled button tooltip trigger to work in some UI libs, also safe practice */}
                                    <Button
                                        size="lg"
                                        className={`w-full h-24 text-xl shadow-lg transition-all rounded-xl
                                            ${!locationStatus.inRadius
                                                ? 'opacity-80 cursor-not-allowed bg-slate-200 text-slate-500 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-400'
                                                : 'bg-primary hover:bg-primary/90 hover:scale-[1.01] active:scale-[0.99] hover:shadow-xl'}`}
                                        onClick={handleCheckIn}
                                        disabled={!locationStatus.inRadius || isCheckedOut || locationStatus.loading}
                                    >
                                        {isCheckedOut ? (
                                            <div className="flex flex-col items-center">
                                                <CheckCircle2 className="w-8 h-8 mb-1" />
                                                <span>{I18N.attendance.doneForToday}</span>
                                            </div>
                                        ) : (
                                            <>
                                                <Clock className="w-8 h-8 mr-3" />
                                                {I18N.attendance.checkIn}
                                            </>
                                        )}
                                    </Button>
                                </span>
                            </TooltipTrigger>
                            {!locationStatus.inRadius && !locationStatus.loading && !isCheckedOut && (
                                <TooltipContent>
                                    <p>{I18N.attendance.outOfRangeTooltip}</p>
                                </TooltipContent>
                            )}
                        </Tooltip>
                    )}

                    {/* Error / Warning Banner - Variant B (Polite + Solution) */}
                    {!locationStatus.inRadius && !locationStatus.loading && !isCheckedOut && !isCheckedIn && (
                        <Alert variant="default" className="border-orange-200 bg-orange-50 text-orange-800 dark:bg-orange-900/20 dark:border-orange-900/50 dark:text-orange-300">
                            <AlertCircle className="h-5 w-5 stroke-orange-600 dark:stroke-orange-400" />
                            <AlertTitle className="ml-2 font-semibold">
                                {I18N.attendance.outOfRangeTitle}
                            </AlertTitle>
                            <AlertDescription className="ml-2 mt-1 text-orange-700/90 dark:text-orange-300/90">
                                {I18N.attendance.outOfRangeDesc}
                            </AlertDescription>
                        </Alert>
                    )}
                </div>

                {/* History Summary */}
                <Card className="shadow-sm">
                    <CardHeader className="pb-3 border-b">
                        <CardTitle className="text-lg font-medium tracking-tight">
                            {I18N.attendance.recentHistory}
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="pt-4">
                        {myHistory.length === 0 ? (
                            <p className="text-sm text-muted-foreground text-center py-4">{I18N.attendance.noHistory}</p>
                        ) : (
                            <div className="space-y-4">
                                {myHistory.slice(0, 3).map((rec: any) => (
                                    <div key={rec.id} className="flex justify-between items-center group">
                                        <div className="flex flex-col">
                                            <p className="font-medium text-sm">
                                                {formatMongolianDate(new Date(rec.workDate)).split('(')[0]}
                                            </p>
                                            <div className="flex gap-2 items-center mt-1">
                                                <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded-sm border 
                                                    ${rec.status === 'late'
                                                        ? 'bg-orange-50 text-orange-600 border-orange-200'
                                                        : 'bg-green-50 text-green-600 border-green-200'}`}>
                                                    {I18N.attendance.status[rec.status as keyof typeof I18N.attendance.status] || rec.status}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="text-right text-xs font-mono space-y-0.5">
                                            <div className="flex items-center justify-end text-green-600">
                                                <span className="mr-1">In:</span>
                                                <span className="font-semibold">{rec.checkIn ? format(new Date(rec.checkIn), "HH:mm") : "--:--"}</span>
                                            </div>
                                            <div className="flex items-center justify-end text-red-500">
                                                <span className="mr-1">Out:</span>
                                                <span className="font-semibold">{rec.checkOut ? format(new Date(rec.checkOut), "HH:mm") : "--:--"}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </TooltipProvider>
    );
}
