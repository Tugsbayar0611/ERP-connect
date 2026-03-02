
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Wallet, History, CreditCard } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { WidgetContext } from "./WidgetRegistry";

export function WalletWidget({ ctx }: { ctx?: WidgetContext }) {
    const { data: wallet, isLoading } = useQuery({
        queryKey: ["/api/canteen/wallet/me"],
        queryFn: async () => {
            const res = await fetch("/api/canteen/wallet/me");
            if (!res.ok) throw new Error("Failed");
            return res.json();
        }
    });

    if (isLoading) {
        return <Card className="h-full"><CardContent className="p-6"><Skeleton className="h-full w-full" /></CardContent></Card>;
    }

    if (!wallet) return null; // Or empty state

    const transactions = wallet.transactions || [];

    return (
        <Card className="h-full bg-gradient-to-br from-orange-50 via-amber-50/50 to-yellow-50 dark:from-orange-950/50 dark:via-amber-900/30 dark:to-yellow-950/50 border-orange-200/50 dark:border-orange-800/50 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
                <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-orange-100 dark:bg-orange-900/30">
                        <Wallet className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                        <CardTitle className="text-base">Хоолны эрх</CardTitle>
                        <p className="text-xs text-muted-foreground">Үлдэгдэл шалгах</p>
                    </div>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="flex flex-col">
                    <span className="text-4xl font-extrabold text-orange-600 dark:text-orange-400 tracking-tight">
                        {wallet.balance?.toLocaleString()}₮
                    </span>
                    <span className="text-xs text-muted-foreground mt-1">Одоогийн үлдэгдэл</span>
                </div>

                <div className="space-y-2">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1">
                        <History className="w-3 h-3" /> Сүүлийн гүйлгээ
                    </h4>
                    {transactions.length === 0 ? (
                        <p className="text-xs text-muted-foreground italic">Гүйлгээ байхгүй</p>
                    ) : (
                        <div className="space-y-2 max-h-[140px] overflow-auto pr-1">
                            {transactions.slice(0, 3).map((tx: any) => (
                                <div key={tx.id} className="flex justify-between items-center text-xs p-2 rounded bg-background/50 border border-orange-100 dark:border-orange-800">
                                    <div className="flex flex-col">
                                        <span className={cn("font-medium", tx.type === 'credit' ? "text-green-600" : "text-amber-700")}>
                                            {tx.description || (tx.type === 'meal_serving' ? 'Хоол' : 'Цэнэглэлт')}
                                        </span>
                                        <span className="text-[10px] text-muted-foreground">{format(new Date(tx.createdAt), "MM/dd HH:mm")}</span>
                                    </div>
                                    <span className={cn("font-bold font-mono", tx.type === 'credit' ? "text-green-600" : "text-red-500")}>
                                        {tx.type === 'credit' ? '+' : ''}{tx.amount?.toLocaleString()}₮
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </CardContent>

            {/* Background Icon */}
            <Wallet className="absolute -right-6 -bottom-6 w-32 h-32 text-orange-100/50 dark:text-orange-900/10 group-hover:scale-110 transition-transform duration-500 pointer-events-none" />
        </Card>
    );
}
