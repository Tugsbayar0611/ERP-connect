import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shirt, ArrowRight, HardHat, PackageX } from "lucide-react";
import { Link } from "wouter";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  clothing: <Shirt className="w-4 h-4 text-blue-500" />,
  footwear: <span className="text-sm">👟</span>,
  headwear: <HardHat className="w-4 h-4 text-yellow-600" />,
  gloves:   <span className="text-sm">🧤</span>,
  eyewear:  <span className="text-sm">🥽</span>,
  other:    <PackageX className="w-4 h-4 text-muted-foreground" />,
};

export default function WorkwearWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["/api/workwear/my"],
  });

  const myData = data as any;
  const pending: any[] = myData?.pending ?? [];

  if (isLoading) {
    return (
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shirt className="w-4 h-4 text-primary" />
            Нормын хувцас
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-10 rounded bg-muted/50 animate-pulse" />)}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (pending.length === 0) return null; // Зөвхөн авах эрхтэй үед л Widget харагдана

  return (
    <Card className="glass-card border-blue-200 dark:border-blue-900 shadow-md bg-blue-50/20 dark:bg-blue-950/20">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Shirt className="w-4 h-4 text-blue-600" />
            Авах хувцас байна
          </CardTitle>
          <Badge className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 text-xs">
            {pending.length}ш эрх
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-xs text-muted-foreground mb-3">
          Танд дараах хувцас авах эрх нээгдсэн байна. Агуулахаас очиж авна уу.
        </p>
        
        {pending.slice(0, 3).map((iss: any) => (
          <div key={iss.id} className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-full bg-background border flex items-center justify-center shrink-0 text-sm">
              {CATEGORY_ICONS[iss.item?.category] ?? CATEGORY_ICONS.other}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{iss.item?.name}</p>
            </div>
          </div>
        ))}

        {pending.length > 3 && (
          <p className="text-xs text-muted-foreground text-center pt-1">
            болон {pending.length - 3} төрлийн хувцас...
          </p>
        )}

        <Link href="/me/workwear">
          <Button variant="ghost" size="sm" className="w-full mt-2 text-xs">
            Дэлгэрэнгүй харах
            <ArrowRight className="w-3 h-3 ml-1" />
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
