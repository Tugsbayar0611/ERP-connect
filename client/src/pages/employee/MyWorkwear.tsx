import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shirt, CheckCircle2, Clock, PackageX, HardHat, AlertCircle, ArrowRight
} from "lucide-react";
import { format } from "date-fns";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  clothing:  <Shirt className="w-5 h-5 text-blue-500" />,
  footwear:  <span className="text-lg">👟</span>,
  headwear:  <HardHat className="w-5 h-5 text-yellow-600" />,
  gloves:    <span className="text-lg">🧤</span>,
  eyewear:   <span className="text-lg">🥽</span>,
  other:     <PackageX className="w-5 h-5 text-muted-foreground" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  clothing: "Хувцас",
  footwear: "Гутал",
  headwear: "Малгай / Каск",
  gloves:   "Бээлий",
  eyewear:  "Нүдний хамгаалал",
  other:    "Бусад",
};

const currentYear = new Date().getFullYear();

export default function MyWorkwear() {
  const { data = { pending: [], history: [] }, isLoading } = useQuery({
    queryKey: ["/api/workwear/my"],
  });

  const myData = data as any;
  const pending: any[] = myData.pending ?? [];
  const history: any[] = myData.history ?? [];

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold font-display tracking-tight text-foreground flex items-center gap-2">
            <Shirt className="w-7 h-7 text-primary" />
            Миний Нормын Хувцас
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Агуулахаас авах хувцасны жагсаалт болон таны авсан түүх
          </p>
        </div>
      </div>

      {/* Pending Items */}
      <Card className="glass-card border-blue-200 dark:border-blue-900 bg-blue-50/30 dark:bg-blue-950/20">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ArrowRight className="w-4 h-4 text-blue-500" />
            Агуулахаас очиж авах хувцаснууд
          </CardTitle>
          <CardDescription>
            Хүний нөөцөөс танд дараах хувцас хэрэгслийг авах эрх олгосон байна. Агуулах дээр очиж авна уу.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-16 rounded-lg bg-muted/50 animate-pulse" />)}
            </div>
          ) : pending.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center gap-2">
              <CheckCircle2 className="w-10 h-10 text-muted-foreground/30" />
              <p className="text-sm font-medium text-muted-foreground">Одоогоор авах хувцас алга байна</p>
            </div>
          ) : (
            <div className="space-y-3 mt-2">
              {pending.map((iss: any) => (
                <div
                  key={iss.id}
                  className="flex items-center gap-4 p-3 sm:p-4 rounded-xl bg-card border shadow-sm"
                >
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center border shrink-0">
                    {CATEGORY_ICONS[iss.item?.category] ?? CATEGORY_ICONS.other}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm leading-tight">{iss.item?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {CATEGORY_LABELS[iss.item?.category] ?? "Бусад"}
                        </p>
                      </div>
                      <Badge className="bg-blue-100 text-blue-700 border-blue-300 dark:bg-blue-900/40 dark:text-blue-300 shrink-0">
                        {iss.quantity}ш авах эрхтэй
                      </Badge>
                    </div>
                    <div className="mt-2 text-xs text-muted-foreground">
                      Эрх олгогдсон: {format(new Date(iss.issuedAt), "yyyy-MM-dd")}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* History */}
      <Card className="glass-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            Авсан хувцасны түүх
          </CardTitle>
          <CardDescription>Өмнө нь хүлээж авсан хувцас хэрэгслийн дэлгэрэнгүй</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2].map(i => <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />)}
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Хувцас авсан түүх байхгүй байна.
            </p>
          ) : (
            <div className="divide-y">
              {history.map((iss: any) => (
                <div key={iss.id} className="flex items-center justify-between py-3 gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      {CATEGORY_ICONS[iss.item?.category] ?? <Shirt className="w-4 h-4 text-primary" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-tight">{iss.item?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Хүлээж авсан: {iss.collectedAt ? format(new Date(iss.collectedAt), "yyyy-MM-dd") : "-"}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold">{iss.quantity}ш</p>
                    {iss.size && (
                      <Badge variant="secondary" className="text-xs mt-0.5">{iss.size}</Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
