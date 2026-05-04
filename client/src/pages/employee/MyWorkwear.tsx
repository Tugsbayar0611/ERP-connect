import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Shirt, CheckCircle2, Clock, PackageX, HardHat, ArrowRight, AlertTriangle } from "lucide-react";
import { format, differenceInDays } from "date-fns";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  clothing: <Shirt className="w-5 h-5 text-blue-500" />,
  footwear: <span className="text-xl">👟</span>,
  headwear: <HardHat className="w-5 h-5 text-yellow-600" />,
  gloves:   <span className="text-xl">🧤</span>,
  eyewear:  <span className="text-xl">🥽</span>,
  other:    <PackageX className="w-5 h-5 text-muted-foreground" />,
};

const CATEGORY_LABELS: Record<string, string> = {
  clothing: "Хувцас", footwear: "Гутал", headwear: "Малгай",
  gloves: "Бээлий", eyewear: "Нүдний хамгаалал", other: "Бусад",
};

function getDaysLeft(expiresAt?: string | null) {
  if (!expiresAt) return null;
  return differenceInDays(new Date(expiresAt), new Date());
}

export default function MyWorkwear() {
  const { data = { pending: [], history: [] }, isLoading } = useQuery({ queryKey: ["/api/workwear/my"] });
  const myData = data as any;
  const pending: any[] = myData.pending ?? [];
  const history: any[] = myData.history ?? [];

  return (
    <div className="space-y-5 max-w-lg mx-auto pb-8">
      {/* Header */}
      <div className="flex items-center gap-2 pt-1">
        <Shirt className="w-6 h-6 text-primary shrink-0" />
        <div>
          <h1 className="text-xl font-bold tracking-tight">Миний хувцас</h1>
          <p className="text-xs text-muted-foreground">Авах эрх болон авсан түүх</p>
        </div>
      </div>

      {/* Pending — "Авах эрхтэй" section */}
      <section>
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <h2 className="text-sm font-semibold">Агуулахаас авах</h2>
          {pending.length > 0 && (
            <Badge className="bg-blue-100 text-blue-700 border-0 text-xs h-5">{pending.length}</Badge>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-20 rounded-2xl bg-muted/50 animate-pulse" />)}
          </div>
        ) : pending.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 rounded-2xl bg-muted/30 text-center">
            <CheckCircle2 className="w-8 h-8 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">Авах хувцас байхгүй байна</p>
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((iss: any) => {
              const daysLeft = getDaysLeft(iss.expiresAt);
              const isExpiringSoon = daysLeft !== null && daysLeft <= 14 && daysLeft >= 0;
              const isExpired = daysLeft !== null && daysLeft < 0;
              return (
                <div
                  key={iss.id}
                  className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-colors ${
                    isExpired ? "border-red-200 bg-red-50 dark:bg-red-950/20"
                    : isExpiringSoon ? "border-orange-200 bg-orange-50/50 dark:bg-orange-950/20"
                    : "border-blue-200/60 bg-blue-50/30 dark:bg-blue-950/20"
                  }`}
                >
                  {/* Icon */}
                  <div className="w-11 h-11 rounded-xl bg-white dark:bg-card border flex items-center justify-center shrink-0 shadow-sm">
                    {CATEGORY_ICONS[iss.item?.category] ?? CATEGORY_ICONS.other}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold leading-tight">{iss.item?.name}</p>
                      <Badge className="text-xs shrink-0 bg-blue-100 text-blue-700 border-0 h-5">
                        {iss.quantity}ш
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {CATEGORY_LABELS[iss.item?.category] ?? "Бусад"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1.5">
                      {isExpired ? (
                        <span className="text-xs text-red-600 flex items-center gap-1 font-medium">
                          <AlertTriangle className="w-3 h-3" />
                          Эрхийн хугацаа дууссан
                        </span>
                      ) : isExpiringSoon ? (
                        <span className="text-xs text-orange-600 flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3" />
                          {daysLeft} хоног үлдсэн
                        </span>
                      ) : iss.expiresAt ? (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {format(new Date(iss.expiresAt), "yyyy/MM/dd")} хүртэл
                        </span>
                      ) : null}
                      {!isExpired && !isExpiringSoon && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <ArrowRight className="w-3 h-3 text-blue-500" />
                          Агуулах дээр очиж авна уу
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* History section */}
      <section>
        <div className="flex items-center gap-2 mb-2 px-1">
          <div className="w-2 h-2 rounded-full bg-muted-foreground/40" />
          <h2 className="text-sm font-semibold">Авсан түүх</h2>
          {history.length > 0 && (
            <Badge variant="secondary" className="text-xs h-5">{history.length}</Badge>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[1, 2].map(i => <div key={i} className="h-16 rounded-2xl bg-muted/50 animate-pulse" />)}
          </div>
        ) : history.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Хувцас авсан түүх байхгүй байна
          </p>
        ) : (
          <div className="rounded-2xl border overflow-hidden divide-y">
            {history.map((iss: any) => (
              <div key={iss.id} className="flex items-center gap-3 px-4 py-3 bg-card">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  {CATEGORY_ICONS[iss.item?.category] ?? <Shirt className="w-4 h-4 text-primary" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{iss.item?.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {iss.collectedAt ? format(new Date(iss.collectedAt), "yyyy/MM/dd") : "—"}
                  </p>
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
      </section>
    </div>
  );
}
