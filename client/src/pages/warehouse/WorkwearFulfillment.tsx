import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { format } from "date-fns";
import {
  PackageCheck, Search, Loader2, AlertCircle, CheckCircle2,
  Clock, HardHat, Shirt, PackageX
} from "lucide-react";

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  clothing: <Shirt className="w-4 h-4 text-blue-500" />,
  footwear: <span className="text-sm">👟</span>,
  headwear: <HardHat className="w-4 h-4 text-yellow-600" />,
  gloves:   <span className="text-sm">🧤</span>,
  eyewear:  <span className="text-sm">🥽</span>,
  other:    <PackageX className="w-4 h-4 text-muted-foreground" />,
};

export default function WarehouseWorkwear() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [selectedIssuanceId, setSelectedIssuanceId] = useState("");
  const [size, setSize] = useState("");

  const { data: employeesRaw = [] } = useQuery({ queryKey: ["/api/employees"] });
  const employees = employeesRaw as any[];

  const filteredEmployees = employees.filter((e: any) => {
    const t = searchTerm.toLowerCase();
    return !searchTerm ||
      e.firstName?.toLowerCase().includes(t) ||
      e.lastName?.toLowerCase().includes(t) ||
      e.employeeNo?.toLowerCase().includes(t);
  });

  const { data: employeeWorkwear, isFetching } = useQuery({
    queryKey: ["/api/workwear/employee", selectedEmployeeId],
    queryFn: async () => {
      const res = await fetch(`/api/workwear/employee/${selectedEmployeeId}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: !!selectedEmployeeId,
  });

  const pendingItems: any[] = employeeWorkwear?.pending ?? [];

  const fulfillMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/workwear/fulfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Алдаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workwear/employee", selectedEmployeeId] });
      queryClient.invalidateQueries({ queryKey: ["/api/workwear/issuances"] });
      setSelectedIssuanceId("");
      setSize("");
      toast({ title: "✅ Амжилттай!", description: "Хувцсыг хүлээлгэн өглөө." });
    },
    onError: (err: any) => toast({ title: "Алдаа", description: err.message, variant: "destructive" }),
  });

  const selectedEmployee = employees.find((e: any) => e.id === selectedEmployeeId);
  const selectedPendingItem = pendingItems.find((i: any) => i.id === selectedIssuanceId);

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <PackageCheck className="w-7 h-7 text-primary" />
          Агуулахаас олгох
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Эрх нь нээгдсэн ажилтанд хувцсыг биечлэн хүлээлгэн өгч бүртгэх
        </p>
      </div>

      {/* Step 1: Select employee */}
      <Card className="glass-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">1. Ажилтан сонгох</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Ажилтан хайх (нэр, дугаар)..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <Select
            value={selectedEmployeeId}
            onValueChange={id => {
              setSelectedEmployeeId(id);
              setSelectedIssuanceId("");
              setSize("");
            }}
          >
            <SelectTrigger>
              <SelectValue placeholder="Ажилтан сонгоно уу" />
            </SelectTrigger>
            <SelectContent>
              {filteredEmployees.map((emp: any) => (
                <SelectItem key={emp.id} value={emp.id}>
                  {emp.lastName?.[0]}. {emp.firstName}
                  {emp.employeeNo ? ` (№${emp.employeeNo})` : ""}
                  {emp.position ? ` — ${emp.position}` : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Step 2: Show pending items */}
      {selectedEmployeeId && (
        <Card className="glass-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <span>2. Авах эрхтэй хувцаснууд</span>
              {selectedEmployee && (
                <Badge variant="outline">
                  {selectedEmployee.lastName?.[0]}. {selectedEmployee.firstName}
                </Badge>
              )}
            </CardTitle>
            <CardDescription>
              Хүний нөөцөөс эрх нь нээгдсэн хувцаснуудын жагсаалт
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isFetching ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : pendingItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center">
                <AlertCircle className="w-8 h-8 text-orange-400" />
                <p className="text-sm font-medium text-muted-foreground">
                  Энэ ажилтанд авах хувцас алга байна.
                </p>
                <p className="text-xs text-muted-foreground">
                  Хүний нөөцөөс эрх нь нээгдсэний дараа олгох боломжтой болно.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingItems.map((iss: any) => (
                  <button
                    key={iss.id}
                    onClick={() => {
                      setSelectedIssuanceId(iss.id);
                      setSize("");
                    }}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors ${
                      selectedIssuanceId === iss.id
                        ? "border-primary bg-primary/10"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <div className="w-9 h-9 rounded-full bg-background border flex items-center justify-center shrink-0">
                      {CATEGORY_ICONS[iss.item?.category] ?? CATEGORY_ICONS.other}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{iss.item?.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant="secondary" className="text-xs">{iss.quantity}ш</Badge>
                        {iss.expiresAt && (
                          <span className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {format(new Date(iss.expiresAt), "yyyy-MM-dd")} хүртэл
                          </span>
                        )}
                      </div>
                    </div>
                    {selectedIssuanceId === iss.id && (
                      <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 3: Enter size & confirm */}
      {selectedIssuanceId && (
        <Card className="glass-card border-primary/30">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">3. Хэмжээ оруулж баталгаажуулах</CardTitle>
            <CardDescription>
              {selectedPendingItem?.item?.name} олгох гэж байна
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Хэмжээ (Заавал биш)</Label>
              <Input
                placeholder="Жишээ нь: 42, XL, M..."
                value={size}
                onChange={e => setSize(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Олгож буй хувцасны бодит хэмжээг бичнэ. Тайлан болон ирээдүйн захиалгад ашиглагдана.
              </p>
            </div>

            <Button
              className="w-full"
              onClick={() => fulfillMutation.mutate({ issuanceId: selectedIssuanceId, size })}
              disabled={fulfillMutation.isPending}
            >
              {fulfillMutation.isPending
                ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Бүртгэж байна...</>
                : <><PackageCheck className="w-4 h-4 mr-2" />Хүлээлгэн өгсөн гэж бүртгэх</>
              }
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
