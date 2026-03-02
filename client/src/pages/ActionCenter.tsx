
import { useState, useEffect } from "react";
import { useNotifications } from "@/hooks/use-notifications";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, ArrowRight, CheckCircle2, Clock, XCircle, Bell, CheckCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { isEmployee, isManager, isPrivileged } from "@shared/roles";
import { format } from "date-fns";

export default function ActionCenter() {
    const { user } = useAuth();
    const { notifications, isLoading, markAsRead, markAllAsRead, unreadCount } = useNotifications();
    const [, setLocation] = useLocation();

    // Check role to adjust UI text
    const isEmployeeUser = user && isEmployee(user.role) && !isManager(user.role) && !isPrivileged(user.role);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
            </div>
        );
    }

    // Sort: Unread first, then by date
    const sortedNotifications = [...notifications].sort((a, b) => {
        if (a.read === b.read) {
            // Newest first
            return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        return a.read ? 1 : -1; // Unread first
    });

    return (
        <div className="p-6 space-y-6 animate-slide-up">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight bg-gradient-to-r from-orange-600 to-amber-600 bg-clip-text text-transparent">
                        {isEmployeeUser ? "Миний мэдэгдлүүд" : "Action Center"}
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        {isEmployeeUser ? "Таны илгээсэн хүсэлтүүдийн төлөв" : "Анхаарал хандуулах шаардлагатай бүх мэдэгдлүүд"}
                    </p>
                </div>
                {unreadCount > 0 && (
                    <Button variant="outline" size="sm" onClick={() => markAllAsRead()}>
                        <CheckCheck className="w-4 h-4 mr-2" />
                        Бүгдийг уншсанаар тэмдэглэх
                    </Button>
                )}
            </div>

            {notifications.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed rounded-xl bg-muted/5">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground">Танд одоогоор мэдэгдэл байхгүй байна</h3>
                    <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                        {isEmployeeUser
                            ? "Таны илгээсэн хүсэлтүүдийн хариу болон бусад мэдэгдлүүд энд харагдана."
                            : "Хяналт шаардлагатай зүйлс энд харагдана."}
                    </p>
                </div>
            ) : (
                <div className="grid gap-4">
                    {sortedNotifications.map((item) => {
                        const isRead = item.read;
                        return (
                            <Card
                                key={item.id}
                                className={`overflow-hidden border-none shadow-md hover:shadow-lg transition-all duration-200 group cursor-pointer ${isRead ? 'opacity-60 bg-muted/30' : 'bg-card'}`}
                                onClick={() => !isRead && markAsRead(String(item.id))}
                            >
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.type === "error" ? "bg-red-500" :
                                    item.type === "warning" ? "bg-amber-500" :
                                        item.type === "success" ? "bg-emerald-500" : "bg-blue-500"
                                    }`} />
                                <CardContent className="p-4 flex items-start gap-4">
                                    <div className={`mt-1 p-2 rounded-full ${item.type === "error" ? "bg-red-500/10 text-red-500" :
                                        item.type === "warning" ? "bg-amber-500/10 text-amber-500" :
                                            item.type === "success" ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"
                                        }`}>
                                        {item.type === "error" && <XCircle className="w-5 h-5" />}
                                        {item.type === "warning" && <AlertTriangle className="w-5 h-5" />}
                                        {item.type === "success" && <CheckCircle2 className="w-5 h-5" />}
                                        {item.type === "info" && <Bell className="w-5 h-5" />}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between mb-1">
                                            <h4 className={`font-semibold text-sm truncate ${isRead ? 'text-muted-foreground' : 'text-foreground'}`}>
                                                {item.title}
                                            </h4>
                                            <div className="flex items-center text-xs text-muted-foreground">
                                                <Clock className="w-3 h-3 mr-1" />
                                                {format(new Date(item.date), "yyyy-MM-dd HH:mm")}
                                            </div>
                                        </div>
                                        <p className={`text-sm line-clamp-2 ${isRead ? 'text-muted-foreground/80' : 'text-muted-foreground'}`}>
                                            {item.description}
                                        </p>
                                    </div>
                                    {!isRead && (
                                        <div className="self-center">
                                            <div className="w-2 h-2 rounded-full bg-blue-500 ring-4 ring-blue-500/20" />
                                        </div>
                                    )}
                                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity self-center" />
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

// Helper for type safety if needed
