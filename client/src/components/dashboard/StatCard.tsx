import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  className?: string;
}

export function StatCard({ title, value, icon: Icon, trend, trendUp, className }: StatCardProps) {
  return (
    <Card className={cn("glass-card stat-card overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className="p-2.5 bg-gradient-to-br from-primary/20 to-accent/20 rounded-xl">
          <Icon className="h-5 w-5 text-primary" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
          {value}
        </div>
        {trend && (
          <p className={cn(
            "text-xs mt-2 font-medium flex items-center gap-1",
            trendUp ? "text-green-600" : "text-red-600"
          )}>
            <span className={cn(
              "inline-block w-0 h-0 border-l-[4px] border-r-[4px] border-transparent",
              trendUp ? "border-b-[6px] border-b-green-600" : "border-t-[6px] border-t-red-600"
            )} />
            {trend}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
