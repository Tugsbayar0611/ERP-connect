import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, Search, Shirt, Shield, ShieldOff, Users, FileText, UserCheck } from "lucide-react";
import { format } from "date-fns";
import WorkwearItemsDialog from "@/components/workwear/WorkwearItemsDialog";
import IssueWorkwearDialog from "@/components/workwear/IssueWorkwearDialog";
import BulkIssueWorkwearDialog from "@/components/workwear/BulkIssueWorkwearDialog";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@shared/permissions";
import type { Role } from "@shared/permissions";

const STATUS_STYLE: Record<string, string> = {
  collected: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300 border-0",
  granted:   "bg-orange-50 text-orange-600 border-orange-200",
  expired:   "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300 border-0",
};
const STATUS_LABEL: Record<string, string> = {
  collected: "Авсан", granted: "Эрх үүссэн", expired: "Дууссан",
};

export default function WorkwearManagement() {
  const { user } = useAuth();
  const userRole = (user?.role ?? "employee") as Role;
  const canManage = hasPermission(userRole, "assets", "write");

  const [activeTab, setActiveTab] = useState("issuances");
  const [searchTerm, setSearchTerm] = useState("");
  const [isItemsDialogOpen, setIsItemsDialogOpen] = useState(false);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);

  const { data: itemsData = [] } = useQuery({ queryKey: ["/api/workwear/items"], enabled: canManage });
  const items = itemsData as any[];

  const { data: issuancesData = [], isLoading } = useQuery({ queryKey: ["/api/workwear/issuances"], enabled: canManage });
  const issuances = issuancesData as any[];

  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] px-4">
        <div className="text-center space-y-4 max-w-sm">
          <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <ShieldOff className="w-7 h-7 text-destructive" />
          </div>
          <h2 className="text-lg font-bold">Хандах эрхгүй байна</h2>
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertTitle>Зөвшөөрөл шаардлагатай</AlertTitle>
            <AlertDescription>
              Өөрийн хувцасны мэдээллийг харахыг хүсвэл <strong>Миний хувцас</strong> хэсэгт орно уу.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const filteredIssuances = issuances.filter((iss: any) => {
    const t = searchTerm.toLowerCase();
    return (
      iss.employee?.firstName?.toLowerCase().includes(t) ||
      iss.employee?.lastName?.toLowerCase().includes(t) ||
      iss.item?.name?.toLowerCase().includes(t)
    );
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shirt className="w-6 h-6 text-primary shrink-0" />
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Нормын Хувцас</h1>
            <p className="hidden sm:block text-muted-foreground text-sm mt-0.5">
              Ажилчдын хувцасны эрх болон нормын хяналт
            </p>
          </div>
        </div>
        {/* Mobile: icon-only buttons; sm+: full labels */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsItemsDialogOpen(true)} title="Хувцасны Төрөл">
            <Shield className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline text-xs">Норм тохиргоо</span>
          </Button>
          <Button variant="secondary" size="sm" onClick={() => setIsBulkDialogOpen(true)} title="Бөөнөөр олгох">
            <Users className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline text-xs">Бөөнөөр</span>
          </Button>
          <Button size="sm" onClick={() => setIsIssueDialogOpen(true)} title="Агуулахаас олгох">
            <Plus className="w-4 h-4 sm:mr-2" />
            <span className="hidden sm:inline text-xs">Олгох</span>
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="issuances" className="flex-1 sm:flex-none">
            <FileText className="w-3.5 h-3.5 mr-1.5" />
            Бүртгэл
          </TabsTrigger>
          <TabsTrigger value="overview" className="flex-1 sm:flex-none">
            <UserCheck className="w-3.5 h-3.5 mr-1.5" />
            Товч
          </TabsTrigger>
        </TabsList>

        <TabsContent value="issuances" className="mt-4">
          <Card className="glass-card">
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Олгогдсон хувцаснууд</CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    Нийт {issuances.length} бүртгэл
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-56">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Ажилтан, хувцас хайх..."
                    className="pl-8 h-9 text-sm"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="space-y-3 p-4">
                  {[1, 2, 3].map(i => <div key={i} className="h-14 rounded-lg bg-muted/50 animate-pulse" />)}
                </div>
              ) : filteredIssuances.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-10">
                  {searchTerm ? "Хайлтад тохирох үр дүн олдсонгүй" : "Олголтын бүртгэл алга байна"}
                </p>
              ) : (
                <div className="divide-y">
                  {filteredIssuances.map((iss: any) => (
                    <div key={iss.id} className="flex items-start gap-3 px-4 py-3">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                        {iss.employee?.lastName?.[0]}{iss.employee?.firstName?.[0]}
                      </div>
                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-tight truncate">
                              {iss.employee?.lastName?.[0]}. {iss.employee?.firstName}
                            </p>
                            <p className="text-xs text-muted-foreground truncate">
                              {iss.employee?.position || "—"}
                            </p>
                          </div>
                          <Badge className={`text-xs shrink-0 ${STATUS_STYLE[iss.status] ?? ""}`}>
                            {STATUS_LABEL[iss.status] ?? iss.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                          <Badge variant="outline" className="text-xs font-normal h-5">
                            {iss.item?.name}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {iss.quantity}ш{iss.size ? ` · ${iss.size}` : ""} · {iss.year}он
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(iss.issuedAt), "MM/dd")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="mt-4">
          {/* Quick stats */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[
              { label: "Нийт эрх", value: issuances.length, color: "text-foreground" },
              { label: "Авсан", value: issuances.filter((i: any) => i.status === "collected").length, color: "text-green-600" },
              { label: "Хүлээгдэж буй", value: issuances.filter((i: any) => i.status === "granted").length, color: "text-orange-500" },
              { label: "Дууссан", value: issuances.filter((i: any) => i.status === "expired").length, color: "text-red-500" },
            ].map(stat => (
              <Card key={stat.label}>
                <CardContent className="pt-3 pb-3">
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                  <p className={`text-3xl font-bold ${stat.color} mt-0.5`}>{stat.value}</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <Card className="glass-card">
            <CardContent className="h-40 flex items-center justify-center text-sm text-muted-foreground">
              Дэлгэрэнгүй статистик → Хувцасны тайлан хуудсаас харна уу
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <WorkwearItemsDialog open={isItemsDialogOpen} onOpenChange={setIsItemsDialogOpen} items={items} />
      <IssueWorkwearDialog open={isIssueDialogOpen} onOpenChange={setIsIssueDialogOpen} items={items} />
      <BulkIssueWorkwearDialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen} items={items} />
    </div>
  );
}
