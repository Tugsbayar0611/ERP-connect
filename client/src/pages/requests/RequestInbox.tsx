
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Inbox, ArrowRight } from "lucide-react";
import { format } from "date-fns";

export default function RequestInbox() {
    const [location, setLocation] = useLocation();

    const { data: items = [], isLoading } = useQuery({
        queryKey: ["/api/requests/inbox"],
        queryFn: async () => {
            const res = await fetch("/api/requests/inbox");
            if (!res.ok) throw new Error("Failed");
            return res.json();
        }
    });

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Зөвшөөрлийн жагсаалт</h1>
                    <p className="text-muted-foreground">Танд ирсэн шийдвэрлэх хүсэлтүүд.</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Хүлээгдэж буй</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : items.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground flex flex-col items-center gap-2">
                            <Inbox className="h-12 w-12 opacity-20" />
                            Танд шийдвэрлэх хүсэлт алга.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Огноо</TableHead>
                                    <TableHead>Төрөл / Гарчиг</TableHead>
                                    <TableHead>Алхам</TableHead>
                                    <TableHead className="text-right">Үйлдэл</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map((item: any) => (
                                    <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setLocation(`/requests/${item.id}`)}>
                                        <TableCell>{format(new Date(item.submittedAt), "MMM dd, HH:mm")}</TableCell>
                                        <TableCell>
                                            <div className="font-medium">{item.title || item.type}</div>
                                            <div className="text-xs text-muted-foreground capitalize">{item.type.replace('_', ' ')}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant="secondary">Алхам {item.step}</Badge>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <Button size="sm" variant="ghost">
                                                Харах <ArrowRight className="ml-2 h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
