import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useMyPayslips } from "@/hooks/use-payroll";
import { format, subMonths } from "date-fns";
import { useToast } from "@/hooks/use-toast";
import {
    User, Mail, Phone, Building2, Calendar, Briefcase,
    Clock, Download, FileText, ChevronLeft, ChevronRight, Loader2, QrCode, RefreshCcw
} from "lucide-react";
import QRCode from "qrcode";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { generatePayslipPDF, downloadPayslipPDF, type PayslipPDFData } from "@/lib/payslip-pdf";

interface ProfileData {
    user: {
        id: string;
        username: string;
        email: string;
        role: string;
        fullName: string;
    };
    employee: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
        phone: string;
        position: string;
        departmentId: string;
        hireDate: string;
        status: string;
        baseSalary: string;
        nationalId: string;
        employeeNo?: string;
    } | null;
}

interface AttendanceRecord {
    id: string;
    workDate: string;
    status: string;
    checkIn: string | null;
    checkOut: string | null;
    workedHours: number;
    note: string | null;
}

export default function MyProfile() {
    const { user } = useAuth();
    const { toast } = useToast();
    const [attendanceMonth, setAttendanceMonth] = useState(() => format(new Date(), "yyyy-MM"));
    const [payslipMonth, setPayslipMonth] = useState("all");
    const [downloadingId, setDownloadingId] = useState<string | null>(null);

    // Generate month options for filter
    const monthOptions = [
        { value: "all", label: "Бүгд" },
        { value: format(new Date(), "yyyy-MM"), label: "Энэ сар" },
        { value: format(subMonths(new Date(), 1), "yyyy-MM"), label: "Өнгөрсөн сар" },
        { value: format(subMonths(new Date(), 2), "yyyy-MM"), label: format(subMonths(new Date(), 2), "yyyy/MM") },
        { value: format(subMonths(new Date(), 3), "yyyy-MM"), label: format(subMonths(new Date(), 3), "yyyy/MM") },
    ];

    // Fetch profile data
    const { data: profile, isLoading: profileLoading } = useQuery<ProfileData>({
        queryKey: ["/api/me"],
        queryFn: async () => {
            const res = await fetch("/api/me");
            if (!res.ok) throw new Error("Failed to fetch profile");
            return res.json();
        },
    });

    // Fetch attendance for current month
    const { data: attendance, isLoading: attendanceLoading } = useQuery<AttendanceRecord[]>({
        queryKey: ["/api/attendance", profile?.employee?.id, attendanceMonth],
        queryFn: async () => {
            if (!profile?.employee?.id) return [];
            const startDate = `${attendanceMonth}-01`;
            const endDate = new Date(parseInt(attendanceMonth.split("-")[0]), parseInt(attendanceMonth.split("-")[1]), 0)
                .toISOString().split("T")[0];
            const res = await fetch(`/api/attendance?employeeId=${profile.employee.id}&startDate=${startDate}&endDate=${endDate}`);
            if (!res.ok) throw new Error("Failed to fetch attendance");
            return res.json();
        },
        enabled: !!profile?.employee?.id,
    });

    // Fetch payslips - data type comes from useMyPayslips hook
    const { data: payslipsData, isLoading: payslipsLoading } = useMyPayslips(profile?.employee?.id);
    const payslips = payslipsData || [];

    // Filter payslips by month
    const filteredPayslips = payslips.filter((p) => {
        if (payslipMonth === "all") return true;
        const payslipPeriod = format(new Date(p.periodStart), "yyyy-MM");
        return payslipPeriod === payslipMonth;
    });

    // Handle PDF download
    const handleDownloadPDF = async (payslip: any) => {
        if (!profile?.employee) return;

        setDownloadingId(payslip.id);
        try {
            const pdfData: PayslipPDFData = {
                employeeName: `${profile.employee.firstName} ${profile.employee.lastName || ""}`.trim(),
                employeeNo: profile.employee.employeeNo,
                position: profile.employee.position,
                department: undefined, // TODO: fetch department name
                periodStart: payslip.periodStart,
                periodEnd: payslip.periodEnd,
                baseSalary: Number(profile.employee.baseSalary) || 0,
                grossPay: Number(payslip.grossPay) || 0,
                shi: Number(payslip.shi) || 0,
                pit: Number(payslip.pit) || 0,
                advances: Number(payslip.advances) || 0,
                totalDeductions: Number(payslip.totalDeductions) || 0,
                netPay: Number(payslip.netPay) || 0,
                status: payslip.status,
                companyName: undefined, // TODO: fetch company name
            };

            const pdfUri = await generatePayslipPDF(pdfData);
            const filename = `Payslip-${profile.employee.employeeNo || "EMP"}-${format(new Date(payslip.periodStart), "yyyy-MM")}.pdf`;
            downloadPayslipPDF(pdfUri, filename);

            toast({
                title: "PDF татагдлаа",
                description: filename,
            });
        } catch (error) {
            console.error("PDF generation error:", error);
            toast({
                title: "Алдаа",
                description: "PDF үүсгэхэд алдаа гарлаа",
                variant: "destructive",
            });
        } finally {
            setDownloadingId(null);
        }
    };

    const getStatusBadge = (status: string) => {
        const config: Record<string, { label: string; className: string }> = {
            present: { label: "Ирсэн", className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" },
            late: { label: "Хоцорсон", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300" },
            absent: { label: "Тасалсан", className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300" },
            leave: { label: "Чөлөө", className: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300" },
            holiday: { label: "Амралт", className: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300" },
        };
        const statusConfig = config[status] || { label: status, className: "bg-gray-100 text-gray-800" };
        return <Badge className={statusConfig.className}>{statusConfig.label}</Badge>;
    };

    const getPayslipStatusBadge = (status: string) => {
        const config: Record<string, { label: string; className: string }> = {
            calculated: { label: "Тооцоолсон", className: "bg-yellow-100 text-yellow-800" },
            approved: { label: "Батлагдсан", className: "bg-blue-100 text-blue-800" },
            paid: { label: "Төлөгдсөн", className: "bg-green-100 text-green-800" },
        };
        const statusConfig = config[status] || { label: status, className: "bg-gray-100 text-gray-800" };
        return <Badge className={statusConfig.className}>{statusConfig.label}</Badge>;
    };

    // Attendance navigation
    const goToPreviousMonth = () => {
        const [year, month] = attendanceMonth.split("-").map(Number);
        const newDate = new Date(year, month - 2, 1);
        setAttendanceMonth(format(newDate, "yyyy-MM"));
    };

    const goToNextMonth = () => {
        const [year, month] = attendanceMonth.split("-").map(Number);
        const newDate = new Date(year, month, 1);
        setAttendanceMonth(format(newDate, "yyyy-MM"));
    };

    // Calculate attendance stats
    const attendanceStats = {
        present: attendance?.filter((a) => a.status === "present" || a.status === "late").length || 0,
        late: attendance?.filter((a) => a.status === "late").length || 0,
        absent: attendance?.filter((a) => a.status === "absent").length || 0,
        leave: attendance?.filter((a) => a.status === "leave").length || 0,
    };

    if (profileLoading) {
        return (
            <div className="p-6 space-y-6">
                <Skeleton className="h-10 w-48" />
                <Skeleton className="h-48 w-full" />
            </div>
        );
    }

    const employee = profile?.employee;

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                    <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                        {employee?.firstName?.[0] || user?.fullName?.[0] || "?"}
                        {employee?.lastName?.[0] || ""}
                    </AvatarFallback>
                </Avatar>
                <div>
                    <h1 className="text-3xl font-bold">
                        {employee ? `${employee.firstName} ${employee.lastName || ""}` : profile?.user.fullName || "Миний профайл"}
                    </h1>
                    <p className="text-muted-foreground">
                        {employee?.position || "Ажилтан"} • {profile?.user.role}
                    </p>
                </div>
            </div>

            <Tabs defaultValue="profile" className="w-full">
                <TabsList className="grid w-full grid-cols-3 lg:w-96">
                    <TabsTrigger value="profile">Профайл</TabsTrigger>
                    <TabsTrigger value="digital-id">Digital ID</TabsTrigger>
                    <TabsTrigger value="attendance">Ирц</TabsTrigger>
                    <TabsTrigger value="payslips">Цалин</TabsTrigger>
                </TabsList>

                {/* Digital ID Tab */}
                <TabsContent value="digital-id" className="space-y-4">
                    <DigitalIDCard />
                </TabsContent>

                {/* Profile Tab */}
                <TabsContent value="profile" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <CardTitle>Хувийн мэдээлэл</CardTitle>
                            <CardDescription>Таны системд бүртгэлтэй мэдээлэл</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-6 md:grid-cols-2">
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <User className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Бүтэн нэр</p>
                                        <p className="font-medium">{employee?.firstName} {employee?.lastName}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Mail className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Имэйл</p>
                                        <p className="font-medium">{employee?.email || profile?.user.email || "-"}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Phone className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Утас</p>
                                        <p className="font-medium">{employee?.phone || "-"}</p>
                                    </div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <Briefcase className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Албан тушаал</p>
                                        <p className="font-medium">{employee?.position || "-"}</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Calendar className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Ажилд орсон огноо</p>
                                        <p className="font-medium">
                                            {employee?.hireDate ? format(new Date(employee.hireDate), "yyyy-MM-dd") : "-"}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3">
                                    <Building2 className="h-5 w-5 text-muted-foreground" />
                                    <div>
                                        <p className="text-sm text-muted-foreground">Төлөв</p>
                                        {employee?.status && getStatusBadge(employee.status)}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Attendance Tab */}
                <TabsContent value="attendance" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Ирцийн мэдээлэл</CardTitle>
                                    <CardDescription>Таны сараар ирцийн бүртгэл</CardDescription>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button variant="outline" size="icon" onClick={goToPreviousMonth}>
                                        <ChevronLeft className="h-4 w-4" />
                                    </Button>
                                    <span className="font-medium min-w-24 text-center">{attendanceMonth}</span>
                                    <Button variant="outline" size="icon" onClick={goToNextMonth}>
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {/* Stats */}
                            <div className="grid grid-cols-4 gap-4 mb-6">
                                <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                                    <p className="text-2xl font-bold text-green-600">{attendanceStats.present}</p>
                                    <p className="text-sm text-muted-foreground">Ирцийн өдөр</p>
                                </div>
                                <div className="text-center p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                                    <p className="text-2xl font-bold text-yellow-600">{attendanceStats.late}</p>
                                    <p className="text-sm text-muted-foreground">Хоцорсон</p>
                                </div>
                                <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                                    <p className="text-2xl font-bold text-red-600">{attendanceStats.absent}</p>
                                    <p className="text-sm text-muted-foreground">Тасалсан</p>
                                </div>
                                <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                                    <p className="text-2xl font-bold text-blue-600">{attendanceStats.leave}</p>
                                    <p className="text-sm text-muted-foreground">Чөлөө</p>
                                </div>
                            </div>

                            {/* Attendance List */}
                            {attendanceLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-12 w-full" />
                                    <Skeleton className="h-12 w-full" />
                                    <Skeleton className="h-12 w-full" />
                                </div>
                            ) : attendance && attendance.length > 0 ? (
                                <div className="space-y-2">
                                    {attendance.map((record) => (
                                        <div
                                            key={record.id}
                                            className="flex items-center justify-between p-3 border rounded-lg"
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className="font-medium w-24">
                                                    {format(new Date(record.workDate), "MM/dd (EEE)")}
                                                </div>
                                                {getStatusBadge(record.status)}
                                            </div>
                                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                                                {record.checkIn && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" />
                                                        {format(new Date(record.checkIn), "HH:mm")}
                                                    </span>
                                                )}
                                                {record.checkOut && <span>- {format(new Date(record.checkOut), "HH:mm")}</span>}
                                                {record.workedHours > 0 && (
                                                    <Badge variant="outline">{record.workedHours.toFixed(1)}ц</Badge>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-muted-foreground py-8">
                                    Энэ сар ирцийн бүртгэл байхгүй байна
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* Payslips Tab */}
                <TabsContent value="payslips" className="space-y-4">
                    <Card>
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <div>
                                    <CardTitle>Цалингийн хуудас</CardTitle>
                                    <CardDescription>Таны цалингийн түүх</CardDescription>
                                </div>
                                <Select value={payslipMonth} onValueChange={setPayslipMonth}>
                                    <SelectTrigger className="w-44">
                                        <SelectValue placeholder="Сар сонгох" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {monthOptions.map((opt) => (
                                            <SelectItem key={opt.value} value={opt.value}>
                                                {opt.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {payslipsLoading ? (
                                <div className="space-y-2">
                                    <Skeleton className="h-24 w-full" />
                                    <Skeleton className="h-24 w-full" />
                                </div>
                            ) : filteredPayslips.length > 0 ? (
                                <div className="grid gap-4 md:grid-cols-2">
                                    {filteredPayslips.map((payslip) => (
                                        <Card key={payslip.id} className="overflow-hidden">
                                            <div className="p-4">
                                                <div className="flex items-center justify-between mb-3">
                                                    <div className="font-semibold">
                                                        {format(new Date(payslip.periodStart), "yyyy/MM")}
                                                    </div>
                                                    {getPayslipStatusBadge(payslip.status)}
                                                </div>
                                                <div className="grid grid-cols-3 gap-2 text-sm">
                                                    <div>
                                                        <p className="text-muted-foreground">Нийт</p>
                                                        <p className="font-medium">
                                                            {Number(payslip.grossPay).toLocaleString("mn-MN")}₮
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Суутгал</p>
                                                        <p className="font-medium text-red-600">
                                                            -{Number(payslip.totalDeductions).toLocaleString("mn-MN")}₮
                                                        </p>
                                                    </div>
                                                    <div>
                                                        <p className="text-muted-foreground">Цэвэр</p>
                                                        <p className="font-bold text-green-600">
                                                            {Number(payslip.netPay).toLocaleString("mn-MN")}₮
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="mt-3 flex gap-2">
                                                    <Button variant="outline" size="sm" className="w-full">
                                                        <FileText className="h-4 w-4 mr-1" />
                                                        Дэлгэрэнгүй
                                                    </Button>
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full"
                                                        onClick={() => handleDownloadPDF(payslip)}
                                                        disabled={downloadingId === payslip.id}
                                                    >
                                                        {downloadingId === payslip.id ? (
                                                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                                        ) : (
                                                            <Download className="h-4 w-4 mr-1" />
                                                        )}
                                                        PDF
                                                    </Button>
                                                </div>
                                            </div>
                                        </Card>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-center text-muted-foreground py-8">
                                    {payslipMonth !== "all"
                                        ? "Сонгосон сард цалингийн хуудас үүсээгүй байна"
                                        : "Цалингийн хуудас байхгүй байна"}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}

function DigitalIDCard() {
    const [qrImage, setQrImage] = useState<string | null>(null);

    const { data, isLoading, refetch, isRefetching } = useQuery({
        queryKey: ["/api/digital-id/qr/me"],
        queryFn: async () => {
            const res = await fetch("/api/digital-id/qr/me");
            if (!res.ok) throw new Error("Failed to fetch QR");
            return res.json();
        }
    });

    // Generate QR image when data changes
    if (data?.qrString && !qrImage) {
        QRCode.toDataURL(data.qrString, { width: 300, margin: 2 }, (err, url) => {
            if (!err) setQrImage(url);
        });
    }

    // Refresh handler
    const handleRefresh = () => {
        setQrImage(null); // Clear old image
        refetch();
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Digital ID</CardTitle>
                <CardDescription>Байгууллагын нэвтрэх QR код</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8 space-y-6">
                {isLoading || isRefetching ? (
                    <div className="h-[300px] w-[300px] flex items-center justify-center bg-muted rounded-xl">
                        <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" />
                    </div>
                ) : qrImage ? (
                    <div className="relative group">
                        <div className="bg-white p-4 rounded-xl border shadow-sm">
                            <img src={qrImage} alt="Employee QR Code" className="w-[280px] h-[280px]" />
                        </div>
                        <div className="text-center mt-4 space-y-1">
                            <p className="font-mono text-lg font-bold tracking-wider">{data.employeeCode}</p>
                            <p className="text-sm text-muted-foreground">
                                Хүчинтэй хугацаа: {format(new Date(data.expiresAt), "HH:mm")}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="text-center text-red-500">
                        QR код үүсгэхэд алдаа гарлаа
                    </div>
                )}

                <div className="flex flex-col items-center gap-2 max-w-sm text-center">
                    <p className="text-sm text-muted-foreground">
                        Энэхүү QR кодыг уншуулж байгууллага руу нэвтрэх болон цаг бүртгүүлэх боломжтой.
                    </p>
                    <Button variant="outline" onClick={handleRefresh} disabled={isLoading || isRefetching}>
                        <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading || isRefetching ? "animate-spin" : ""}`} />
                        Шинэчлэх
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
