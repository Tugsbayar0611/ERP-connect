import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { 
  Card, CardContent, CardHeader, CardTitle, CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Plus, Search, UserCheck, Shirt, Shield, FileText, ShieldOff, Users } from "lucide-react";
import { format } from "date-fns";
import WorkwearItemsDialog from "@/components/workwear/WorkwearItemsDialog";
import IssueWorkwearDialog from "@/components/workwear/IssueWorkwearDialog";
import BulkIssueWorkwearDialog from "@/components/workwear/BulkIssueWorkwearDialog";
import { useAuth } from "@/hooks/use-auth";
import { hasPermission } from "@shared/permissions";
import type { Role } from "@shared/permissions";

export default function WorkwearManagement() {
  const { user } = useAuth();
  const userRole = (user?.role ?? "employee") as Role;

  // Only admin, hr can manage workwear
  const canManage = hasPermission(userRole, "assets", "write");

  const [activeTab, setActiveTab] = useState("issuances");
  const [searchTerm, setSearchTerm] = useState("");
  const [isItemsDialogOpen, setIsItemsDialogOpen] = useState(false);
  const [isIssueDialogOpen, setIsIssueDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);

  const { data: itemsData = [], isLoading: isLoadingItems } = useQuery({
    queryKey: ["/api/workwear/items"],
    enabled: canManage,
  });
  const items = itemsData as any[];

  const { data: issuancesData = [], isLoading: isLoadingIssuances } = useQuery({
    queryKey: ["/api/workwear/issuances"],
    enabled: canManage,
  });
  const issuances = issuancesData as any[];

  // If no permission - show access denied immediately
  if (!canManage) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-4 max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mx-auto">
            <ShieldOff className="w-8 h-8 text-destructive" />
          </div>
          <h2 className="text-xl font-bold">Хандах эрхгүй байна</h2>
          <p className="text-muted-foreground text-sm">
            Нормын хувцасны удирдлагын хэсэгт зөвхөн HR болон Администратор хандах боломжтой.
          </p>
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
    const term = searchTerm.toLowerCase();
    return (
      iss.employee?.firstName?.toLowerCase().includes(term) ||
      iss.employee?.lastName?.toLowerCase().includes(term) ||
      iss.item?.name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground flex items-center gap-2">
            <Shirt className="w-8 h-8 text-primary" />
            Нормын Хувцас Удирдлага
          </h1>
          <p className="text-muted-foreground mt-1">
            Ажилчдын хувцас хэрэгслийг олгох болон жилийн нормоо хянах
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setIsItemsDialogOpen(true)}>
            <Shield className="w-4 h-4 mr-2" />
            Хувцасны Төрөл / Норм
          </Button>
          <Button variant="secondary" onClick={() => setIsBulkDialogOpen(true)}>
            <Users className="w-4 h-4 mr-2" />
            Бөөнөөр олгох
          </Button>
          <Button onClick={() => setIsIssueDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Агуулахаас олгох
          </Button>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="issuances">
            <FileText className="w-4 h-4 mr-2" />
            Олголтын Түүх
          </TabsTrigger>
          <TabsTrigger value="overview">
            <UserCheck className="w-4 h-4 mr-2" />
            Ерөнхий Төлөв
          </TabsTrigger>
        </TabsList>

        <TabsContent value="issuances" className="mt-6">
          <Card className="glass-card">
            <CardHeader className="pb-3 border-b">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle>Олгогдсон хувцаснууд</CardTitle>
                  <CardDescription>
                    Нийт {issuances.length} бүртгэл — жил бүрийн нормоор хэн хэдийг авсан
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Ажилтан, хувцас хайх..." 
                    className="pl-9"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ажилтан</TableHead>
                    <TableHead>Хувцас</TableHead>
                    <TableHead>Он</TableHead>
                    <TableHead>Тоо / Хэмжээ</TableHead>
                    <TableHead>Олгосон огноо</TableHead>
                    <TableHead>Олгосон хүн (Эрх)</TableHead>
                    <TableHead>Төлөв</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoadingIssuances ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        Уншиж байна...
                      </TableCell>
                    </TableRow>
                  ) : filteredIssuances.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        {searchTerm ? "Хайлтад тохирох үр дүн олдсонгүй" : "Олголтын бүртгэл алга байна"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredIssuances.map((issuance: any) => (
                      <TableRow key={issuance.id}>
                        <TableCell>
                          <div className="font-medium">
                            {issuance.employee?.lastName?.[0]}. {issuance.employee?.firstName}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {issuance.employee?.position || "—"}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-normal">
                            {issuance.item?.name}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-primary/20 text-primary border-0">{issuance.year}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{issuance.quantity}ш</span>
                            {issuance.size && (
                              <Badge variant="secondary" className="text-xs">{issuance.size}</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(issuance.issuedAt), "yyyy-MM-dd HH:mm")}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {issuance.issuedBy?.fullName || "—"}
                        </TableCell>
                        <TableCell>
                          {issuance.status === "collected" ? (
                            <Badge className="bg-green-100 text-green-700 hover:bg-green-100 border-0">Олгогдсон</Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-600 border-orange-200 bg-orange-50">Эрх үүссэн</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="overview" className="mt-6">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle>Ерөнхий Төлөв</CardTitle>
              <CardDescription>Ажилчдын хувцас авалтын явцын нэгдсэн статистик</CardDescription>
            </CardHeader>
            <CardContent className="h-64 flex items-center justify-center text-muted-foreground">
              Статистик мэдээлэл удахгүй орно.
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <WorkwearItemsDialog 
        open={isItemsDialogOpen} 
        onOpenChange={setIsItemsDialogOpen} 
        items={items}
      />
      <IssueWorkwearDialog 
        open={isIssueDialogOpen} 
        onOpenChange={setIsIssueDialogOpen} 
        items={items}
      />
      <BulkIssueWorkwearDialog
        open={isBulkDialogOpen}
        onOpenChange={setIsBulkDialogOpen}
        items={items}
      />
    </div>
  );
}
