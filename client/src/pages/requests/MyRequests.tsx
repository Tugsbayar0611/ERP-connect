
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Plus, FileText, Clock, CheckCircle2, XCircle } from "lucide-react";
import { formatLocalDate } from "@/lib/utils";
import { useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

export default function MyRequests() {
    const [location, setLocation] = useLocation();
    const [activeTab, setActiveTab] = useState("all");

    const { data: requests = [], isLoading } = useQuery({
        queryKey: ["requests", "scope:my", activeTab],
        queryFn: async () => {
            const url = activeTab === 'all'
                ? "/api/requests?scope=my"
                : `/api/requests?scope=my&status=${activeTab}`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Failed");
            return res.json();
        }
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'draft': return <Badge variant="outline">Ноорог</Badge>;
            case 'submitted': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">Илгээсэн</Badge>;
            case 'approved': return <Badge className="bg-green-100 text-green-700 hover:bg-green-200">Зөвшөөрсөн</Badge>;
            case 'rejected': return <Badge variant="destructive">Татгалзсан</Badge>;
            default: return <Badge variant="secondary">{status}</Badge>;
        }
    };

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Миний хүсэлтүүд</h1>
                    <p className="text-muted-foreground">Чөлөө, тодорхойлолт болон бусад хүсэлтүүдийг удирдах.</p>
                </div>
                <Button onClick={() => setLocation("/me/requests/new")}>
                    <Plus className="mr-2 h-4 w-4" /> Шинэ хүсэлт
                </Button>
            </div>

            <Tabs defaultValue="all" onValueChange={setActiveTab}>
                <TabsList>
                    <TabsTrigger value="all">Бүгд</TabsTrigger>
                    <TabsTrigger value="draft">Ноорог</TabsTrigger>
                    <TabsTrigger value="submitted">Илгээсэн</TabsTrigger>
                    <TabsTrigger value="approved">Зөвшөөрсөн</TabsTrigger>
                    <TabsTrigger value="rejected">Татгалзсан</TabsTrigger>
                </TabsList>

                <TabsContent value={activeTab} className="mt-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Хүсэлтийн түүх</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {isLoading ? (
                                <div className="py-8 text-center text-muted-foreground">Уншиж байна...</div>
                            ) : requests.length === 0 ? (
                                <div className="py-12 text-center text-muted-foreground flex flex-col items-center gap-2">
                                    <FileText className="h-10 w-10 opacity-20" />
                                    Хүсэлт олдсонгүй.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {requests.map((req: any) => (
                                        <div
                                            key={req.id}
                                            className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                                            onClick={() => setLocation(`/me/requests/${req.id}`)}
                                        >
                                            <div className="flex flex-col gap-1">
                                                <div className="font-semibold flex items-center gap-2">
                                                    {req.title || req.type}
                                                    {getStatusBadge(req.status)}
                                                </div>
                                                <div className="text-xs text-muted-foreground">
                                                    Үүсгэсэн: {formatLocalDate(req.createdAt)}
                                                </div>
                                            </div>
                                            <div className="text-right text-sm">
                                                <div className="font-medium capitalize">{req.type.replace('_', ' ')}</div>
                                                {req.decidedAt && (
                                                    <div className="text-xs text-muted-foreground">
                                                        Шийдвэрлэсэн: {formatLocalDate(req.decidedAt, "MM/dd")}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
