import { useStats } from "@/hooks/use-stats";
import { StatCard } from "@/components/dashboard/StatCard";
import { Users, Building2, CreditCard, Activity, TrendingUp, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";

// Format number as Mongolian Tugrik
const formatMNT = (value: number) => {
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(value) + '₮';
};

// Data will come from stats API

export default function Dashboard() {
  const { data: stats, isLoading } = useStats();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Use real data from API, fallback to empty arrays if not available
  const salaryData = stats?.payrollByMonth || [];
  const attendanceData = stats?.attendanceByDay || [];

  return (
    <div className="space-y-8 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      {/* Header */}
      <div className="animate-slide-up">
        <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Хянах самбар
        </h2>
        <p className="text-muted-foreground mt-2">
          Таны байгууллагын өнөөдрийн үзүүлэлтүүд
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="animate-slide-up stagger-1 opacity-0" style={{ animationFillMode: 'forwards' }}>
          <StatCard
            title="Нийт ажилтан"
            value={stats?.totalEmployees || 0}
            icon={Users}
            trend="Сүүлийн сараас +2.5%"
            trendUp={true}
          />
        </div>
        <div className="animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
          <StatCard
            title="Идэвхтэй ажилтан"
            value={stats?.activeEmployees || 0}
            icon={Activity}
            trend="Сүүлийн сараас +1.2%"
            trendUp={true}
          />
        </div>
        <div className="animate-slide-up stagger-3 opacity-0" style={{ animationFillMode: 'forwards' }}>
          <StatCard
            title="Нийт хэлтэс"
            value={stats?.totalDepartments || 0}
            icon={Building2}
          />
        </div>
        <div className="animate-slide-up stagger-4 opacity-0" style={{ animationFillMode: 'forwards' }}>
          <StatCard
            title="Сарын цалин"
            value={formatMNT(stats?.monthlyPayroll || 0)}
            icon={CreditCard}
            trend="Сүүлийн сараас +4.3%"
            trendUp={true}
          />
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-7">
        {/* Salary Chart */}
        <Card className="col-span-4 glass-card animate-scale-in">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-primary" />
              Цалингийн график
            </CardTitle>
          </CardHeader>
          <CardContent className="pl-2">
            {salaryData.length > 0 ? (
              <ResponsiveContainer width="100%" height={350}>
                <AreaChart data={salaryData}>
                <defs>
                  <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs text-muted-foreground" />
                <YAxis
                  className="text-xs text-muted-foreground"
                  tickFormatter={(value) => `${(value / 1000000).toFixed(0)}сая`}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    borderRadius: '12px',
                    border: '1px solid hsl(var(--border))',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.1)'
                  }}
                  formatter={(value: number) => [formatMNT(value), 'Цалин']}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorValue)"
                />
              </AreaChart>
            </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[350px] text-muted-foreground">
                <p>Цалингийн өгөгдөл байхгүй байна</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card className="col-span-3 glass-card animate-scale-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent" />
              Сүүлийн үйл ажиллагаа
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {[
                { title: "Шинэ ажилтан бүртгэгдлээ", desc: "Б. Болд - IT хэлтэс", time: "2 цагийн өмнө", color: "bg-green-500" },
                { title: "Цалин олгогдлоо", desc: "12 ажилтанд 45,000,000₮", time: "5 цагийн өмнө", color: "bg-blue-500" },
                { title: "Чөлөө хүсэлт батлагдлаа", desc: "О. Оюун - 3 өдөр", time: "1 өдрийн өмнө", color: "bg-purple-500" },
              ].map((item, i) => (
                <div key={i} className="flex items-start gap-4 animate-slide-up" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className={`w-2 h-2 rounded-full mt-2 ${item.color}`} />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm font-medium leading-none">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <div className="text-xs text-muted-foreground whitespace-nowrap">{item.time}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Chart */}
      <Card className="glass-card animate-scale-in">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-green-500" />
            Ирцийн мэдээлэл (7 хоног)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {attendanceData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={attendanceData}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs text-muted-foreground" />
              <YAxis className="text-xs text-muted-foreground" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  borderRadius: '12px',
                  border: '1px solid hsl(var(--border))'
                }}
              />
              <Bar dataKey="present" fill="hsl(var(--success))" name="Ирсэн %" radius={[4, 4, 0, 0]} />
              <Bar dataKey="late" fill="hsl(var(--warning))" name="Хоцорсон %" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[250px] text-muted-foreground">
              <p>Ирцийн өгөгдөл байхгүй байна</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

