import { useStats } from "@/hooks/use-stats";
import { StatCard } from "@/components/dashboard/StatCard";
import { useEmployees } from "@/hooks/use-employees";
import { useDepartments } from "@/hooks/use-departments";
import { 
  Users, 
  Building2, 
  CreditCard, 
  Activity, 
  TrendingUp, 
  Clock, 
  UserCheck, 
  CalendarCheck, 
  Wallet,
  Package,
  ShoppingCart,
  Receipt
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { format } from "date-fns";

// Format number as Mongolian Tugrik
const formatMNT = (value: number) => {
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(value) + '₮';
};

// Mock salary data (would come from real data)
const salaryData = [
  { name: '1-р сар', value: 45000000 },
  { name: '2-р сар', value: 48000000 },
  { name: '3-р сар', value: 47500000 },
  { name: '4-р сар', value: 52000000 },
  { name: '5-р сар', value: 51000000 },
  { name: '6-р сар', value: 55000000 },
];

// Mock attendance data (would come from real data)
const attendanceData = [
  { name: 'Дав', present: 95, late: 5 },
  { name: 'Мяг', present: 92, late: 8 },
  { name: 'Лха', present: 98, late: 2 },
  { name: 'Пүр', present: 94, late: 6 },
  { name: 'Баа', present: 89, late: 11 },
];

const COLORS = ['#3b82f6', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

export default function Dashboard() {
  const { data: stats, isLoading } = useStats();
  const { employees = [] } = useEmployees();
  const { departments = [] } = useDepartments();

  // Calculate department distribution for pie chart
  const departmentDistribution = departments.map((dept, index) => ({
    name: dept.name,
    value: employees.filter(e => e.departmentId === dept.id).length,
    color: COLORS[index % COLORS.length],
  })).filter(d => d.value > 0);

  // Get recent employees (last 5 added)
  const recentEmployees = [...employees]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Calculate active percentage
  const activePercentage = employees.length > 0 
    ? Math.round((employees.filter(e => e.status === 'active').length / employees.length) * 100)
    : 0;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-8 min-h-screen">
      {/* Header */}
      <div className="animate-slide-up">
        <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Хянах самбар
        </h2>
        <p className="text-muted-foreground mt-2">
          Таны байгууллагын өнөөдрийн үзүүлэлтүүд • {format(new Date(), "yyyy оны MM сарын dd")}
        </p>
      </div>

      {/* Main Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <div className="animate-slide-up stagger-1 opacity-0" style={{ animationFillMode: 'forwards' }}>
          <StatCard
            title="Нийт ажилтан"
            value={stats?.totalEmployees || employees.length || 0}
            icon={Users}
            trend="Сүүлийн сараас +2.5%"
            trendUp={true}
          />
        </div>
        <div className="animate-slide-up stagger-2 opacity-0" style={{ animationFillMode: 'forwards' }}>
          <StatCard
            title="Идэвхтэй ажилтан"
            value={stats?.activeEmployees || employees.filter(e => e.status === 'active').length || 0}
            icon={UserCheck}
            trend={`${activePercentage}% нийтийн`}
            trendUp={true}
          />
        </div>
        <div className="animate-slide-up stagger-3 opacity-0" style={{ animationFillMode: 'forwards' }}>
          <StatCard
            title="Нийт хэлтэс"
            value={stats?.totalDepartments || departments.length || 0}
            icon={Building2}
          />
        </div>
        <div className="animate-slide-up stagger-4 opacity-0" style={{ animationFillMode: 'forwards' }}>
          <StatCard
            title="Сарын цалингийн сан"
            value={formatMNT(stats?.monthlyPayroll || employees.reduce((sum, e) => sum + Number(e.baseSalary || 0), 0))}
            icon={Wallet}
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
            <div>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary" />
                Цалингийн график
              </CardTitle>
              <CardDescription>Сүүлийн 6 сарын цалингийн өсөлт</CardDescription>
            </div>
            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
              +12.5%
            </Badge>
          </CardHeader>
          <CardContent className="pl-2">
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
          </CardContent>
        </Card>

        {/* Recent Employees / Activity */}
        <Card className="col-span-3 glass-card animate-scale-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-accent" />
              Сүүлийн бүртгэл
            </CardTitle>
            <CardDescription>Шинээр нэмэгдсэн ажилтнууд</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentEmployees.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">
                  Ажилтан бүртгэгдээгүй байна
                </p>
              ) : (
                recentEmployees.map((emp, i) => {
                  const dept = departments.find(d => d.id === emp.departmentId);
                  return (
                    <div 
                      key={emp.id} 
                      className="flex items-center gap-4 p-3 rounded-lg hover:bg-muted/50 transition-colors animate-slide-up" 
                      style={{ animationDelay: `${i * 0.1}s` }}
                    >
                      <Avatar className="w-10 h-10 border-2 border-primary/20">
                        <AvatarFallback className="bg-gradient-to-br from-primary/20 to-accent/20 text-primary font-semibold">
                          {emp.firstName[0]}{emp.lastName?.[0]}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {emp.lastName} {emp.firstName}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {dept?.name || "Хэлтэсгүй"} • {emp.employeeNo}
                        </p>
                      </div>
                      <Badge 
                        variant={emp.status === 'active' ? 'default' : 'secondary'}
                        className={emp.status === 'active' ? 'bg-green-100 text-green-800' : ''}
                      >
                        {emp.status === 'active' ? 'Идэвхтэй' : 'Идэвхгүй'}
                      </Badge>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Second Row */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Attendance Chart */}
        <Card className="lg:col-span-2 glass-card animate-scale-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarCheck className="w-5 h-5 text-green-500" />
              7 хоногийн ирц
            </CardTitle>
            <CardDescription>Ажилтнуудын ирцийн хувь</CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>

        {/* Department Distribution */}
        <Card className="glass-card animate-scale-in">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-purple-500" />
              Хэлтсийн хуваарилалт
            </CardTitle>
            <CardDescription>Ажилтнуудын тоо хэлтсээр</CardDescription>
          </CardHeader>
          <CardContent>
            {departmentDistribution.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
                Мэдээлэл байхгүй
              </div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie
                      data={departmentDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {departmentDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        borderRadius: '8px',
                        border: '1px solid hsl(var(--border))'
                      }}
                      formatter={(value: number) => [`${value} ажилтан`, '']}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {departmentDistribution.slice(0, 4).map((dept, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: dept.color }} />
                      <span className="truncate text-muted-foreground">{dept.name}</span>
                      <span className="font-medium ml-auto">{dept.value}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="glass-card animate-scale-in">
        <CardHeader>
          <CardTitle>Түргэн үйлдлүүд</CardTitle>
          <CardDescription>Байнга хэрэглэгддэг функцүүд</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a href="/employees" className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-primary/50 hover:bg-primary/5 transition-all cursor-pointer group">
              <div className="p-3 rounded-xl bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Users className="w-6 h-6 text-primary" />
              </div>
              <span className="text-sm font-medium">Ажилтан нэмэх</span>
            </a>
            <a href="/attendance" className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-green-500/50 hover:bg-green-500/5 transition-all cursor-pointer group">
              <div className="p-3 rounded-xl bg-green-500/10 group-hover:bg-green-500/20 transition-colors">
                <CalendarCheck className="w-6 h-6 text-green-500" />
              </div>
              <span className="text-sm font-medium">Ирц бүртгэх</span>
            </a>
            <a href="/payroll" className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-accent/50 hover:bg-accent/5 transition-all cursor-pointer group">
              <div className="p-3 rounded-xl bg-accent/10 group-hover:bg-accent/20 transition-colors">
                <CreditCard className="w-6 h-6 text-accent" />
              </div>
              <span className="text-sm font-medium">Цалин тооцоох</span>
            </a>
            <a href="/invoices" className="flex flex-col items-center gap-2 p-4 rounded-xl border border-border hover:border-orange-500/50 hover:bg-orange-500/5 transition-all cursor-pointer group">
              <div className="p-3 rounded-xl bg-orange-500/10 group-hover:bg-orange-500/20 transition-colors">
                <Receipt className="w-6 h-6 text-orange-500" />
              </div>
              <span className="text-sm font-medium">Нэхэмжлэх</span>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
