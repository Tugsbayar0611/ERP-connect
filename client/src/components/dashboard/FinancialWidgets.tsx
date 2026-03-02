
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, TrendingDown, DollarSign, ArrowRight, Wallet, Receipt, AlertCircle, CheckCircle2 } from "lucide-react";
import { WidgetContext } from "@/components/dashboard/WidgetRegistry";

export function CashFlowWidget({ ctx }: { ctx: WidgetContext }) {
    const data = ctx.stats?.cashFlowProjection;
    const isLoading = !data;

    if (isLoading) {
        return (
            <Card className="h-full flex items-center justify-center p-6">
                <div className="animate-pulse flex flex-col items-center">
                    <div className="h-10 w-10 bg-muted rounded-full mb-3" />
                    <div className="h-4 w-24 bg-muted rounded" />
                </div>
            </Card>
        );
    }

    const netCashFlow = data?.netCashFlow || 0;
    const isPositive = netCashFlow >= 0;

    return (
        <Card className="glass-card animate-scale-in h-full flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                            <Wallet className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Мөнгөн урсгал (7 хоног)</CardTitle>
                            <CardDescription>Таамаглал</CardDescription>
                        </div>
                    </div>
                    <Badge variant={isPositive ? "default" : "destructive"} className="ml-2">
                        {isPositive ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                        {isPositive ? "Эерэг" : "Сөрөг"}
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
                <div className="flex items-end justify-between">
                    <div>
                        <p className="text-sm text-muted-foreground">Цэвэр урсгал</p>
                        <h3 className={`text-2xl font-bold ${isPositive ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>
                            {ctx.formatMNT(Math.abs(netCashFlow))}
                        </h3>
                    </div>
                    <div className="text-right">
                        <p className="text-xs text-muted-foreground mb-1">Итгэлцлийн түвшин</p>
                        <Badge variant="outline">{data?.confidenceLevel || "Дунд"}</Badge>
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                        <span>Орлого (Тооцоолсон)</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-medium">+{ctx.formatMNT(data?.next7DaysRevenue || 0)}</span>
                    </div>
                    <Progress value={data?.next7DaysRevenue ? 70 : 0} className="h-1.5 bg-emerald-100 dark:bg-emerald-900/20" />

                    <div className="flex justify-between text-xs pt-1">
                        <span>Зарлага (Тооцоолсон)</span>
                        <span className="text-red-600 dark:text-red-400 font-medium">-{ctx.formatMNT(data?.next7DaysExpenses || 0)}</span>
                    </div>
                    <Progress value={data?.next7DaysExpenses ? 40 : 0} className="h-1.5 bg-red-100 dark:bg-red-900/20" />
                </div>

                <div className="pt-2">
                    <div className="p-2 bg-muted/50 rounded-lg border border-border/50 text-xs text-muted-foreground flex gap-2 items-start">
                        <AlertCircle className="w-3.5 h-3.5 mt-0.5 text-primary" />
                        <span>{data?.recommendation || "Санхүүгийн урсгал тогтвортой байна."}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

export function InvoiceStatusWidget({ ctx }: { ctx: WidgetContext }) {
    const status = ctx.stats?.invoicePaymentStatus;
    const overdueCount = ctx.stats?.overdueInvoices || 0;

    // Fake data if missing, just for UI demo if undefined
    const paidPercent = status?.paidPercent || 65;
    const pendingPercent = status?.pendingPercent || 25;
    const overduePercent = status?.overduePercent || 10;

    return (
        <Card className="glass-card animate-scale-in h-full flex flex-col">
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                            <Receipt className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <CardTitle className="text-base">Нэхэмжлэхүүд</CardTitle>
                            <CardDescription>Төлбөрийн төлөв</CardDescription>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => ctx.setLocation("/invoices")}>
                        <ArrowRight className="w-4 h-4" />
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="flex-1 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/50">
                        <p className="text-xs text-red-600/80 dark:text-red-400 font-semibold uppercase">Хугацаа хэтэрсэн</p>
                        <h3 className="text-2xl font-bold text-red-700 dark:text-red-400 mt-1">{overdueCount}</h3>
                        <p className="text-[10px] text-red-500/80 mt-1">Анхаарал хандуулна уу</p>
                    </div>
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-100 dark:border-green-900/50">
                        <p className="text-xs text-green-600/80 dark:text-green-400 font-semibold uppercase">Төлөгдсөн</p>
                        <h3 className="text-2xl font-bold text-green-700 dark:text-green-400 mt-1">{status?.paidCount || 0}</h3>
                        <p className="text-[10px] text-green-500/80 mt-1">Энэ сард</p>
                    </div>
                </div>

                <div className="space-y-2 mt-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Төлөв (Нийт дүнгийн %)</span>
                        <span>{paidPercent}% Төлөгдсөн</span>
                    </div>
                    <div className="flex h-2 w-full rounded-full overflow-hidden bg-muted">
                        <div className="bg-green-500 h-full" style={{ width: `${paidPercent}%` }} />
                        <div className="bg-yellow-500 h-full" style={{ width: `${pendingPercent}%` }} />
                        <div className="bg-red-500 h-full" style={{ width: `${overduePercent}%` }} />
                    </div>
                    <div className="flex justify-between text-[10px] text-muted-foreground pt-1 px-1">
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500" /> Төлөгдсөн</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-500" /> Хүлээгдэж буй</div>
                        <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" /> Хэтэрсэн</div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
