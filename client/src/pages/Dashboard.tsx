import { useStats } from "@/hooks/use-stats";
import { StatCard } from "@/components/dashboard/StatCard";
import { Users, Building2, CreditCard, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const data = [
  { name: 'Jan', value: 4000 },
  { name: 'Feb', value: 3000 },
  { name: 'Mar', value: 2000 },
  { name: 'Apr', value: 2780 },
  { name: 'May', value: 1890 },
  { name: 'Jun', value: 2390 },
];

export default function Dashboard() {
  const { data: stats, isLoading } = useStats();

  if (isLoading) return <div>Loading dashboard...</div>;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight font-display">Үзүүлэлтийн хүснэгт</h2>
        <p className="text-muted-foreground mt-2">Таны байгууллагын гол үзүүлэлтүүдийн нэмэлт мэдээлэл.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Нийт ажилтан"
          value={stats?.totalEmployees || 0}
          icon={Users}
          trend="Сүүлийн сараас +2.5%"
          trendUp={true}
        />
        <StatCard
          title="Идэвхтэй ажилтан"
          value={stats?.activeEmployees || 0}
          icon={Activity}
          trend="Сүүлийн сараас +1.2%"
          trendUp={true}
        />
        <StatCard
          title="Нийт хэлтэс"
          value={stats?.totalDepartments || 0}
          icon={Building2}
        />
        <StatCard
          title="Сарын цалин"
          value={`$${(stats?.monthlyPayroll || 0).toLocaleString()}`}
          icon={CreditCard}
          trend="Сүүлийн сараас +4.3%"
          trendUp={true}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
        <Card className="col-span-4">
          <CardHeader>
            <CardTitle>Цалины нэмэлт мэдээлэл</CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs text-muted-foreground" />
                <YAxis className="text-xs text-muted-foreground" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }}
                />
                <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="col-span-3">
          <CardHeader>
            <CardTitle>Сүүлийн үйл ажиллагаа</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-8">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center">
                  <div className="space-y-1">
                    <p className="text-sm font-medium leading-none">Шинэ ажилтан хөлс олгөгдөв</p>
                    <p className="text-xs text-muted-foreground">Төм Үнэлэн Инженерийн хэлтэст элссэн</p>
                  </div>
                  <div className="ml-auto font-medium text-xs text-muted-foreground">2 цаг</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
