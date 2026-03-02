import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { format, formatDistanceToNow } from "date-fns";
import { mn } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import {
    Monitor, Smartphone, Tablet, Globe, LogOut, Loader2, Shield, AlertTriangle
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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

interface UserSession {
    id: string;
    deviceName: string;
    ipAddress: string | null;
    createdAt: string;
    lastSeenAt: string;
    isCurrent: boolean;
}

export default function MySessions() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [revokingId, setRevokingId] = useState<string | null>(null);
    const [logoutAllLoading, setLogoutAllLoading] = useState(false);

    // Fetch sessions
    const { data: sessions, isLoading } = useQuery<UserSession[]>({
        queryKey: ["/api/security/sessions/me"],
        queryFn: async () => {
            const res = await fetch("/api/security/sessions/me");
            if (!res.ok) throw new Error("Failed to fetch sessions");
            return res.json();
        },
    });

    // Revoke session mutation
    const revokeMutation = useMutation({
        mutationFn: async (sessionId: string) => {
            const res = await apiRequest("POST", `/api/security/sessions/${sessionId}/revoke`);
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/security/sessions/me"] });
            toast({
                title: "Сешн хаагдлаа",
                description: "Тухайн төхөөрөмж дээрх нэвтрэлт устгагдлаа.",
            });
        },
        onError: () => {
            toast({
                title: "Алдаа",
                description: "Сешн хаахад алдаа гарлаа",
                variant: "destructive",
            });
        },
    });

    // Logout all mutation
    const logoutAllMutation = useMutation({
        mutationFn: async () => {
            const res = await apiRequest("POST", "/api/security/sessions/me/logout-all");
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/security/sessions/me"] });
            toast({
                title: "Бүх төхөөрөмж гарлаа",
                description: "Бусад бүх төхөөрөмж дээрх нэвтрэлт хаагдлаа.",
            });
        },
        onError: () => {
            toast({
                title: "Алдаа",
                description: "Logout хийхэд алдаа гарлаа",
                variant: "destructive",
            });
        },
    });

    const handleRevoke = async (sessionId: string) => {
        setRevokingId(sessionId);
        try {
            await revokeMutation.mutateAsync(sessionId);
        } finally {
            setRevokingId(null);
        }
    };

    const handleLogoutAll = async () => {
        setLogoutAllLoading(true);
        try {
            await logoutAllMutation.mutateAsync();
        } finally {
            setLogoutAllLoading(false);
        }
    };

    // Get device icon based on device name
    const getDeviceIcon = (deviceName: string) => {
        const lower = deviceName.toLowerCase();
        if (lower.includes("iphone") || lower.includes("android")) {
            return <Smartphone className="h-5 w-5" />;
        }
        if (lower.includes("ipad") || lower.includes("tablet")) {
            return <Tablet className="h-5 w-5" />;
        }
        if (lower.includes("chrome") || lower.includes("firefox") || lower.includes("safari") || lower.includes("edge")) {
            return <Monitor className="h-5 w-5" />;
        }
        return <Globe className="h-5 w-5" />;
    };

    const otherSessions = sessions?.filter(s => !s.isCurrent) || [];

    if (isLoading) {
        return (
            <div className="p-6 space-y-6 max-w-3xl mx-auto">
                <Skeleton className="h-10 w-64" />
                <Skeleton className="h-48 w-full" />
                <Skeleton className="h-24 w-full" />
            </div>
        );
    }

    return (
        <div className="p-6 space-y-6 max-w-3xl mx-auto">
            {/* Header */}
            <div className="flex items-center gap-3">
                <Shield className="h-8 w-8 text-primary" />
                <div>
                    <h1 className="text-2xl font-bold">Сешн удирдлага</h1>
                    <p className="text-muted-foreground">
                        Таны бүртгэлтэй нэвтэрсэн төхөөрөмжүүд
                    </p>
                </div>
            </div>

            {/* Current Session */}
            {sessions?.find(s => s.isCurrent) && (
                <Card className="border-primary">
                    <CardHeader className="pb-3">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Badge className="bg-primary">Одоогийн сешн</Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        {(() => {
                            const current = sessions.find(s => s.isCurrent)!;
                            return (
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-primary/10 rounded-lg">
                                            {getDeviceIcon(current.deviceName)}
                                        </div>
                                        <div>
                                            <p className="font-medium">{current.deviceName}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {current.ipAddress || "IP хаяг тодорхойгүй"}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-right text-sm text-muted-foreground">
                                        <p>Нэвтэрсэн: {format(new Date(current.createdAt), "yyyy-MM-dd HH:mm")}</p>
                                        <p>Сүүлд: {formatDistanceToNow(new Date(current.lastSeenAt), { addSuffix: true, locale: mn })}</p>
                                    </div>
                                </div>
                            );
                        })()}
                    </CardContent>
                </Card>
            )}

            {/* Other Sessions */}
            <Card>
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Бусад төхөөрөмжүүд</CardTitle>
                            <CardDescription>
                                {otherSessions.length === 0
                                    ? "Өөр төхөөрөмж дээр нэвтрээгүй байна"
                                    : `${otherSessions.length} идэвхтэй сешн`}
                            </CardDescription>
                        </div>
                        {otherSessions.length > 0 && (
                            <AlertDialog>
                                <AlertDialogTrigger asChild>
                                    <Button variant="destructive" size="sm" disabled={logoutAllLoading}>
                                        {logoutAllLoading ? (
                                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                        ) : (
                                            <LogOut className="h-4 w-4 mr-2" />
                                        )}
                                        Бүгдийг гаргах
                                    </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader>
                                        <AlertDialogTitle className="flex items-center gap-2">
                                            <AlertTriangle className="h-5 w-5 text-destructive" />
                                            Бүх төхөөрөмжийг гаргах уу?
                                        </AlertDialogTitle>
                                        <AlertDialogDescription>
                                            Энэ үйлдэл нь одоогийн төхөөрөмжөөс бусад бүх газраас таныг logout хийнэ.
                                            Тэд дахин нэвтрэх шаардлагатай болно.
                                        </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Болих</AlertDialogCancel>
                                        <AlertDialogAction
                                            onClick={handleLogoutAll}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                        >
                                            Тийм, бүгдийг гаргах
                                        </AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                            </AlertDialog>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {otherSessions.length === 0 ? (
                        <p className="text-center text-muted-foreground py-8">
                            Зөвхөн энэ төхөөрөмж дээр нэвтэрсэн байна 🎉
                        </p>
                    ) : (
                        <div className="space-y-3">
                            {otherSessions.map((session) => (
                                <div
                                    key={session.id}
                                    className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 bg-muted rounded-lg">
                                            {getDeviceIcon(session.deviceName)}
                                        </div>
                                        <div>
                                            <p className="font-medium">{session.deviceName}</p>
                                            <p className="text-sm text-muted-foreground">
                                                {session.ipAddress || "IP хаяг тодорхойгүй"} •{" "}
                                                {formatDistanceToNow(new Date(session.lastSeenAt), { addSuffix: true, locale: mn })}
                                            </p>
                                        </div>
                                    </div>
                                    <AlertDialog>
                                        <AlertDialogTrigger asChild>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                                disabled={revokingId === session.id}
                                            >
                                                {revokingId === session.id ? (
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                ) : (
                                                    <LogOut className="h-4 w-4" />
                                                )}
                                            </Button>
                                        </AlertDialogTrigger>
                                        <AlertDialogContent>
                                            <AlertDialogHeader>
                                                <AlertDialogTitle>Сешн хаах уу?</AlertDialogTitle>
                                                <AlertDialogDescription>
                                                    {session.deviceName} дээрх нэвтрэлтийг хаах гэж байна. Тухайн төхөөрөмж дээр дахин нэвтрэх шаардлагатай болно.
                                                </AlertDialogDescription>
                                            </AlertDialogHeader>
                                            <AlertDialogFooter>
                                                <AlertDialogCancel>Болих</AlertDialogCancel>
                                                <AlertDialogAction
                                                    onClick={() => handleRevoke(session.id)}
                                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                                >
                                                    Тийм, хаах
                                                </AlertDialogAction>
                                            </AlertDialogFooter>
                                        </AlertDialogContent>
                                    </AlertDialog>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Security Tips */}
            <Card className="bg-muted/50">
                <CardContent className="pt-6">
                    <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-muted-foreground mt-0.5" />
                        <div className="text-sm text-muted-foreground">
                            <p className="font-medium text-foreground mb-1">Аюулгүй байдлын зөвлөмж</p>
                            <ul className="list-disc list-inside space-y-1">
                                <li>Таны танихгүй төхөөрөмж байвал тэр даруй хаах хэрэгтэй</li>
                                <li>Олон нийтийн компьютер дээр logout хийхээ мартаж болохгүй</li>
                                <li>Сэжигтэй нэвтрэлт байвал нууц үгээ солих хэрэгтэй</li>
                            </ul>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
