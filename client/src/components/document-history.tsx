import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { format } from "date-fns";
import { mn } from "date-fns/locale"; // Монгол хэлний огноо

// Түүхийн өгөгдлийн бүтэц
interface Log {
    id: string; // Changed from number to string as per schema
    actorId?: string;
    actorName?: string; // Need to ensure backend joins this or we fetch it
    action: string;
    note?: string; // Schema uses 'comment'
    comment?: string;
    timestamp: string | Date; // Schema uses 'timestamp'
}

interface DocumentHistoryProps {
    logs: Log[];
    users?: any[]; // Pass users list to resolve names if actorName is missing
}

export function DocumentHistory({ logs, users = [] }: DocumentHistoryProps) {
    if (!logs || logs.length === 0) {
        return <div className="text-sm text-muted-foreground text-center py-4">Түүх олдсонгүй.</div>;
    }

    const getActorName = (log: Log) => {
        if (log.actorName) return log.actorName;
        if (log.actorId && users.length) {
            const u = users.find(u => u.id === log.actorId);
            return u?.fullName || u?.username || "Unknown";
        }
        return "System";
    };

    return (
        <Card className="w-full border-none shadow-none bg-transparent">
            <CardHeader className="pb-3 px-0">
                <CardTitle className="text-lg font-medium self-start">Шилжилт хөдөлгөөний түүх</CardTitle>
            </CardHeader>
            <CardContent className="px-0">
                <ScrollArea className="h-[300px] w-full pr-4">
                    <div className="relative border-l border-muted ml-4 space-y-6">
                        {logs.map((log, index) => (
                            <div key={log.id} className="relative pl-6">
                                {/* Timeline Dot */}
                                <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full border border-primary bg-background ring-4 ring-background" />

                                <div className="flex flex-col gap-1">
                                    <div className="flex items-center justify-between">
                                        <p className="text-sm font-semibold leading-none">{getActorName(log)}</p>
                                        <span className="text-xs text-muted-foreground">
                                            {log.timestamp ? format(new Date(log.timestamp), "yyyy-MM-dd HH:mm", { locale: mn }) : '-'}
                                        </span>
                                    </div>

                                    <p className="text-sm text-foreground/80 mt-1">
                                        {getActionLabel(log.action)}
                                    </p>

                                    {(log.note || log.comment) && (
                                        <div className="mt-2 rounded-md bg-muted p-2 text-xs text-foreground italic">
                                            "{log.note || log.comment}"
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
}

// Action-ийг монгол руу хөрвүүлэх
function getActionLabel(action: string) {
    switch (action) {
        case 'created': return '✨ Бичгийг анх бүртгэсэн';
        case 'forwarded': return '➡️ Дараагийн хүнд шилжүүлсэн';
        case 'status_change': return '🔄 Төлөв өөрчилсөн';
        case 'approved': return '✅ Зөвшөөрсөн';
        case 'rejected': return '❌ Буцаасан';
        case 'draft': return '📝 Ноорог үүсгэсэн';
        case 'pending': return '⏳ Хүлээгдэж байна';
        case 'processing': return '⚙️ Боловсруулж байна';
        case 'completed': return '✅ Дуусгавар болгосон';
        case 'expired': return '⏰ Хугацаа хэтэрсэн';
        default: return action;
    }
}
