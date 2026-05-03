import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, differenceInDays, parseISO } from "date-fns";
import { Shirt, AlertTriangle, Clock, PackageOpen, Loader2 } from "lucide-react";

type MyUniformIssuance = {
    id: string;
    items: { name: string; qty: number; size?: string }[];
    issuedAt: string;
    nextIssueDue: string | null;
    status: string;
    note: string | null;
    policyName: string | null;
};

const statusColors: Record<string, string> = {
    issued: "bg-blue-100 text-blue-800",
    returned: "bg-gray-100 text-gray-700",
    lost: "bg-orange-100 text-orange-800",
    expired: "bg-red-100 text-red-800",
};

const statusLabels: Record<string, string> = {
    issued: "Одоогоор өмсөж буй",
    returned: "Буцаасан",
    lost: "Гээгдсэн",
    expired: "Хугацаа дууссан",
};

export default function MyUniforms() {
    const { data: issuances = [], isLoading } = useQuery<MyUniformIssuance[]>({
        queryKey: ["/api/uniforms/my"],
    });

    const getDaysUntilDue = (dateStr: string | null) => {
        if (!dateStr) return null;
        return differenceInDays(parseISO(dateStr), new Date());
    };

    if (isLoading) {
        return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin" /></div>;
    }

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                    <Shirt className="h-8 w-8 text-primary" />
                    Миний хувцас
                </h2>
                <p className="text-muted-foreground mt-1">
                    Танд олгогдсон нормын хувцас, хэрэгслийн мэдээлэл болон дараагийн олголтын хугацаа
                </p>
            </div>

            {issuances.length === 0 ? (
                <Card>
                    <CardContent className="text-center py-16 text-muted-foreground">
                        <PackageOpen className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>Танд бүртгэлтэй хувцас олголт одоогоор алга байна.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {issuances.map(iss => {
                        const days = getDaysUntilDue(iss.nextIssueDue);
                        const isOverdue = days !== null && days < 0;
                        const isUpcoming = days !== null && days >= 0 && days <= 45;

                        return (
                            <Card key={iss.id} className="relative overflow-hidden">
                                <div className={`absolute top-0 left-0 w-1.5 h-full ${iss.status === 'issued' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                                <CardHeader className="pb-3 pl-6">
                                    <div className="flex justify-between items-start">
                                        <CardTitle className="text-base">{iss.policyName || "Хувцас олголт"}</CardTitle>
                                        <Badge variant="outline" className={`text-[10px] ${statusColors[iss.status] ?? ""}`}>
                                            {statusLabels[iss.status] ?? iss.status}
                                        </Badge>
                                    </div>
                                    <CardDescription className="text-xs">
                                        Олгосон: {format(new Date(iss.issuedAt), "yyyy оны MM сарын dd")}
                                    </CardDescription>
                                </CardHeader>
                                <CardContent className="pl-6 space-y-4">
                                    <div className="bg-muted/50 rounded-md p-3">
                                        <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">Олгогдсон зүйлс</p>
                                        <ul className="space-y-1">
                                            {iss.items.map((item, i) => (
                                                <li key={i} className="text-sm flex justify-between">
                                                    <span>{item.name} {item.size && <span className="text-xs text-muted-foreground ml-1">({item.size})</span>}</span>
                                                    <span className="font-medium">x{item.qty}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    </div>

                                    {iss.nextIssueDue && iss.status === 'issued' && (
                                        <div className={`p-3 rounded-md border text-sm ${isOverdue ? 'bg-red-50 border-red-200 text-red-800' : isUpcoming ? 'bg-yellow-50 border-yellow-200 text-yellow-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
                                            <div className="flex items-center gap-2 font-medium mb-1">
                                                {isOverdue ? <AlertTriangle className="w-4 h-4" /> : <Clock className="w-4 h-4" />}
                                                Дараагийн олголт
                                            </div>
                                            <p className="text-xs">
                                                Огноо: <strong>{iss.nextIssueDue}</strong>
                                                <br />
                                                Төлөв: {isOverdue ? `${Math.abs(days!)} хоног хэтэрсэн` : days !== null ? `${days} хоног үлдсэн` : ""}
                                            </p>
                                        </div>
                                    )}

                                    {iss.note && (
                                        <p className="text-xs text-muted-foreground italic border-t pt-2 mt-2">
                                            Жич: {iss.note}
                                        </p>
                                    )}
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
