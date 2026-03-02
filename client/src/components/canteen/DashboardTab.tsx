
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Utensils, Wallet, TrendingDown, Calendar } from "lucide-react";
import { format, addDays } from "date-fns";

export function DashboardTab() {
    const today = format(new Date(), "yyyy-MM-dd");
    const tomorrow = format(addDays(new Date(), 1), "yyyy-MM-dd");

    // 1. Kitchen Stats (Today)
    const { data: todayStats } = useQuery<{ lunch: number, dinner: number }>({
        queryKey: ["canteen.admin.pending-stats", today],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/canteen/admin/pending-stats?date=${today}`);
            return res.json();
        }
    });

    // 2. Kitchen Stats (Tomorrow)
    const { data: tomorrowStats } = useQuery<{ lunch: number, dinner: number }>({
        queryKey: ["canteen.admin.pending-stats", tomorrow],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/canteen/admin/pending-stats?date=${tomorrow}`);
            return res.json();
        }
    });

    // 3. Wallet Stats (Aggregation from all wallets)
    const { data: wallets } = useQuery<any[]>({
        queryKey: ["canteen.admin.wallets"],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/canteen/admin/wallets`);
            return res.json();
        }
    });

    // Calculations
    const totalBalance = wallets?.reduce((sum, w) => sum + w.balance, 0) || 0;
    const negativeWallets = wallets?.filter(w => w.balance < 0).length || 0;
    const totalEmployees = wallets?.length || 0;

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-medium">Өнөөдрийн тойм</h3>

            {/* KPI Cards */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="bg-blue-50 border-blue-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-900">Өнөөдрийн хоол</CardTitle>
                        <Utensils className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-800">
                            {((todayStats?.lunch || 0) + (todayStats?.dinner || 0))}
                        </div>
                        <p className="text-xs text-blue-600">
                            Өдөр: {todayStats?.lunch || 0} | Орой: {todayStats?.dinner || 0}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-indigo-50 border-indigo-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-indigo-900">Маргаашийн захиалга</CardTitle>
                        <Calendar className="h-4 w-4 text-indigo-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-indigo-800">
                            {((tomorrowStats?.lunch || 0) + (tomorrowStats?.dinner || 0))}
                        </div>
                        <p className="text-xs text-indigo-600">
                            Өдөр: {tomorrowStats?.lunch || 0} | Орой: {tomorrowStats?.dinner || 0}
                        </p>
                    </CardContent>
                </Card>

                <Card className="bg-green-50 border-green-100">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-green-900">Нийт түрийвч</CardTitle>
                        <Wallet className="h-4 w-4 text-green-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-800">
                            {(totalBalance / 1000).toFixed(1)}k ₮
                        </div>
                        <p className="text-xs text-green-600">
                            {totalEmployees} ажилтны данс
                        </p>
                    </CardContent>
                </Card>

                <Card className={negativeWallets > 0 ? "bg-red-50 border-red-100" : "bg-gray-50 border-gray-100"}>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className={`text-sm font-medium ${negativeWallets > 0 ? "text-red-900" : "text-gray-900"}`}>
                            Зээлтэй данс
                        </CardTitle>
                        <TrendingDown className={`h-4 w-4 ${negativeWallets > 0 ? "text-red-600" : "text-gray-400"}`} />
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${negativeWallets > 0 ? "text-red-800" : "text-gray-800"}`}>
                            {negativeWallets}
                        </div>
                        <p className={`text-xs ${negativeWallets > 0 ? "text-red-600" : "text-gray-500"}`}>
                            Дансны үлдэгдэл &lt; 0
                        </p>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">

                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Санамж</CardTitle>
                        <CardDescription>
                            Системийн анхааруулга болон зөвлөмжүүд.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <ul className="list-disc pl-5 space-y-2 text-sm text-muted-foreground">
                            <li>Маргаашийн хүнсний бэлтгэлийг 16:00 цагаас өмнө гал тогоонд мэдэгдэх.</li>
                            <li>Зээлтэй данснуудыг сарын сүүлээр цалингаас суутгах хүсэлт үүсгэх.</li>
                            <li>Шинэ ажилтнуудын картыг бүртгэх.</li>
                        </ul>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Шуурхай үйлдэл</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                        <div className="text-sm text-gray-500">
                            Дараах цэснүүдээр дамжин дэлгэрэнгүй үйлдэл хийнэ үү.
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
