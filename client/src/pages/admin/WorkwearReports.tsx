import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useState } from "react";
import { 
  BarChart3, TrendingUp, PackageX, CheckCircle2, Clock, 
  AlertTriangle, DollarSign, Shirt, HardHat
} from "lucide-react";
import { format } from "date-fns";

const CATEGORY_LABELS: Record<string, string> = {
  clothing: "Хувцас",
  footwear: "Гутал",
  headwear: "Малгай / Каск",
  gloves: "Бээлий",
  eyewear: "Нүдний хамгаалал",
  other: "Бусад",
};

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  clothing: <Shirt className="w-4 h-4" />,
  footwear: <span>👟</span>,
  headwear: <HardHat className="w-4 h-4" />,
  gloves: <span>🧤</span>,
  eyewear: <span>🥽</span>,
  other: <PackageX className="w-4 h-4" />,
};

export default function WorkwearReports() {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(String(currentYear));

  const { data: summary, isLoading } = useQuery({
    queryKey: ["/api/workwear/reports/summary", year],
    queryFn: async () => {
      const res = await fetch(`/api/workwear/reports/summary?year=${year}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const years = Array.from({ length: 5 }, (_, i) => String(currentYear - i));

  const statCards = [
    {
      label: "Нийт эрх олгогдсон",
      value: summary?.totalGranted ?? 0,
      icon: <Shirt className="w-5 h-5 text-blue-500" />,
      bg: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-900",
    },
    {
      label: "Авсан (Collected)",
      value: summary?.totalCollected ?? 0,
      icon: <CheckCircle2 className="w-5 h-5 text-green-500" />,
      bg: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-900",
    },
    {
      label: "Авааагүй (Хүлээгдэж буй)",
      value: summary?.totalPending ?? 0,
      icon: <Clock className="w-5 h-5 text-orange-500" />,
      bg: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-900",
    },
    {
      label: "Хугацаа дууссан",
      value: summary?.totalExpired ?? 0,
      icon: <AlertTriangle className="w-5 h-5 text-red-500" />,
      bg: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-900",
    },
  ];

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-7 h-7 text-primary" />
            Хувцасны Тайлан
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Жилийн норм олголтын хураангуй статистик
          </p>
        </div>
        <Select value={year} onValueChange={setYear}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {years.map(y => (
              <SelectItem key={y} value={y}>{y} он</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {statCards.map(card => (
          <Card key={card.label} className={`border ${card.bg}`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2 mb-1">
                {card.icon}
                <span className="text-xs text-muted-foreground">{card.label}</span>
              </div>
              {isLoading ? (
                <div className="h-8 w-16 bg-muted/50 animate-pulse rounded" />
              ) : (
                <p className="text-3xl font-bold tracking-tight">{card.value}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Total spent */}
      <Card className="glass-card bg-gradient-to-br from-primary/5 to-transparent border-primary/20">
        <CardContent className="pt-5 pb-5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <DollarSign className="w-6 h-6 text-primary" />
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Нийт зарцуулсан дүн ({year} он)</p>
            {isLoading ? (
              <div className="h-8 w-32 bg-muted/50 animate-pulse rounded mt-1" />
            ) : (
              <p className="text-3xl font-bold text-primary">
                {(summary?.totalSpent ?? 0).toLocaleString("mn-MN")}₮
              </p>
            )}
            <p className="text-xs text-muted-foreground mt-0.5">
              Зөвхөн биечлэн авсан (collected) хувцасны нийт дүн
            </p>
          </div>
        </CardContent>
      </Card>

      {/* By category */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Хувцасны төрлөөр
          </CardTitle>
          <CardDescription>
            Категори тус бүрээр олгогдсон тоо болон зардал
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <div key={i} className="h-14 bg-muted/50 animate-pulse rounded-lg" />)}
            </div>
          ) : !summary?.byCategory || Object.keys(summary.byCategory).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              {year} оны мэдээлэл алга байна.
            </p>
          ) : (
            <div className="divide-y">
              {Object.entries(summary.byCategory).map(([cat, data]: [string, any]) => {
                const pct = data.granted > 0 ? Math.round((data.collected / data.granted) * 100) : 0;
                return (
                  <div key={cat} className="flex items-center gap-4 py-3">
                    <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      {CATEGORY_ICONS[cat] ?? CATEGORY_ICONS.other}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium">{CATEGORY_LABELS[cat] ?? cat}</p>
                        <Badge variant="secondary" className="text-xs">
                          {data.collected}/{data.granted} авсан
                        </Badge>
                      </div>
                      <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-xs text-muted-foreground">{pct}% авсан</span>
                        {data.spent > 0 && (
                          <span className="text-xs text-muted-foreground">
                            {data.spent.toLocaleString("mn-MN")}₮
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
