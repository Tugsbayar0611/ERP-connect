
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package } from "lucide-react";
import { format } from "date-fns";

export default function MyAssets() {
    // Fetch My Assets
    const { data: assets = [], isLoading } = useQuery({
        queryKey: ["/api/assets/my"],
        queryFn: async () => {
            const res = await fetch("/api/assets/my");
            if (!res.ok) throw new Error("Failed");
            return res.json();
        }
    });

    // We also need products to resolve names if the API logic doesn't join. 
    // Ideally API should return joined data. 
    // Since I implemented `getEmployeeAssets` as a simple SELECT *, it won't have product names.
    // I should fix the API or fetch products here. Fetching products here is easier/faster than SQL join refactor right now.
    const { data: products = [] } = useQuery({
        queryKey: ["/api/inventory/products"],
        queryFn: async () => {
            const res = await fetch("/api/inventory/products");
            if (!res.ok) throw new Error("Failed");
            return res.json();
        }
    });

    return (
        <div className="space-y-6 container mx-auto p-4 md:p-8">
            <div className="flex flex-col gap-2">
                <h1 className="text-3xl font-bold tracking-tight">Миний эд хөрөнгө</h1>
                <p className="text-muted-foreground">Надад олгогдсон эд зүйлс, дүрэмт хувцас</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Жагсаалт</CardTitle>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin" /></div>
                    ) : assets.length === 0 ? (
                        <div className="text-center py-12 text-muted-foreground">
                            <Package className="h-12 w-12 mx-auto mb-3 opacity-20" />
                            Танд олгогдсон хөрөнгө байхгүй байна.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Огноо</TableHead>
                                    <TableHead>Нэр</TableHead>
                                    <TableHead>Сериал</TableHead>
                                    <TableHead>Тоо ширхэг</TableHead>
                                    <TableHead>Төлөв</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {assets.map((asset: any) => {
                                    const product = products.find((p: any) => p.id === asset.productId);
                                    return (
                                        <TableRow key={asset.id}>
                                            <TableCell>{format(new Date(asset.issuedAt), "yyyy-MM-dd")}</TableCell>
                                            <TableCell className="font-medium">{product?.name || "Loading..."}</TableCell>
                                            <TableCell>{asset.serialNumber || "-"}</TableCell>
                                            <TableCell>{asset.quantity}</TableCell>
                                            <TableCell>
                                                <Badge variant={asset.status === 'issued' ? 'default' : 'secondary'}>
                                                    {asset.status === 'issued' ? 'Идэвхтэй' : 'Буцаасан'}
                                                </Badge>
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
