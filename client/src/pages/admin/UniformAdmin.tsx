import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format, differenceInDays, parseISO } from "date-fns";
import {
  Shirt, Plus, AlertTriangle, Clock, Loader2, RotateCcw, Package, Filter
} from "lucide-react";

type UniformIssuance = {
  id: string;
  employeeId: string;
  employeeFirstName: string;
  employeeLastName: string;
  policyName: string | null;
  items: { name: string; qty: number; size?: string }[];
  issuedAt: string;
  nextIssueDue: string | null;
  status: string;
  note: string | null;
  returnedAt: string | null;
};

type DueAlert = { overdue: UniformIssuance[]; upcoming: UniformIssuance[]; total: number };
type Employee = { id: string; firstName: string; lastName: string };

const statusColors: Record<string, string> = {
  issued:   "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  returned: "bg-muted text-muted-foreground",
  lost:     "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  expired:  "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const statusLabels: Record<string, string> = {
  issued: "Олгогдсон", returned: "Буцаасан", lost: "Гээгдсэн", expired: "Дууссан",
};

export default function UniformAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showIssue, setShowIssue] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [filterStatus, setFilterStatus] = useState("issued");

  const [items, setItems] = useState([{ name: "", qty: 1, size: "" }]);
  const [issuedAt, setIssuedAt] = useState(new Date().toISOString().split("T")[0]);
  const [noteInput, setNoteInput] = useState("");

  const { data: issuances = [], isLoading } = useQuery<UniformIssuance[]>({
    queryKey: ["/api/uniforms/issuances", filterStatus],
    queryFn: async () => {
      const res = await fetch(`/api/uniforms/issuances?status=${filterStatus}`);
      return res.json();
    },
  });

  const { data: dueAlerts } = useQuery<DueAlert>({
    queryKey: ["/api/uniforms/due"],
    queryFn: async () => {
      const res = await fetch("/api/uniforms/due?days=45");
      return res.json();
    },
  });

  const { data: employees = [] } = useQuery<Employee[]>({ queryKey: ["/api/employees"] });

  const issueMutation = useMutation({
    mutationFn: async () => {
      const validItems = items.filter(i => i.name.trim());
      if (!validItems.length) throw new Error("Хамгийн нэг зүйл оруулна уу");
      if (!selectedEmployee) throw new Error("Ажилтан сонгоно уу");
      const res = await fetch("/api/uniforms/issuances", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: selectedEmployee, items: validItems, issuedAt, note: noteInput || undefined }),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uniforms/issuances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/uniforms/due"] });
      setShowIssue(false);
      setItems([{ name: "", qty: 1, size: "" }]);
      setSelectedEmployee(""); setNoteInput("");
      toast({ title: "Амжилттай", description: "Хувцас олгогдлоо." });
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
  });

  const returnMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/uniforms/issuances/${id}/return`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: "Буцааж авлаа" }),
      });
      if (!res.ok) throw new Error("Return failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/uniforms/issuances"] });
      toast({ title: "Амжилттай", description: "Хувцас буцааж авагдлаа." });
    },
  });

  const addItem = () => setItems(p => [...p, { name: "", qty: 1, size: "" }]);
  const removeItem = (i: number) => setItems(p => p.filter((_, idx) => idx !== i));
  const updateItem = (i: number, field: string, value: any) =>
    setItems(p => p.map((item, idx) => idx === i ? { ...item, [field]: value } : item));

  const getDaysUntilDue = (dateStr: string | null) => {
    if (!dateStr) return null;
    return differenceInDays(parseISO(dateStr), new Date());
  };

  const totalAlerts = (dueAlerts?.overdue.length ?? 0) + (dueAlerts?.upcoming.length ?? 0);

  return (
    <div className="space-y-4">
      {/* Header — compact on mobile */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shirt className="h-6 w-6 text-primary shrink-0" />
          <div>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">Нормын хувцас</h2>
            {/* Description hidden on mobile, shown sm+ */}
            <p className="hidden sm:block text-muted-foreground text-sm mt-0.5">
              Жилийн норм олголт, хугацааны хяналт
            </p>
          </div>
        </div>
        <Button size="sm" onClick={() => setShowIssue(true)}>
          <Plus className="w-4 h-4 sm:mr-2" />
          <span className="hidden sm:inline">Хувцас олгох</span>
        </Button>
      </div>

      {/* Alert summary — compact cards on mobile */}
      {dueAlerts && totalAlerts > 0 && (
        <div className="grid grid-cols-2 gap-3">
          {dueAlerts.overdue.length > 0 && (
            <Card className="border-red-200 bg-red-50 dark:bg-red-950/20">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-red-600 shrink-0" />
                  <span className="text-xs font-semibold text-red-700">Хугацаа хэтэрсэн</span>
                </div>
                <p className="text-2xl font-bold text-red-700">{dueAlerts.overdue.length}</p>
                <p className="text-xs text-red-600 mt-0.5">ажилтан</p>
              </CardContent>
            </Card>
          )}
          {dueAlerts.upcoming.length > 0 && (
            <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
              <CardContent className="pt-3 pb-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Clock className="w-3.5 h-3.5 text-yellow-600 shrink-0" />
                  <span className="text-xs font-semibold text-yellow-700">45 хоногт</span>
                </div>
                <p className="text-2xl font-bold text-yellow-700">{dueAlerts.upcoming.length}</p>
                <p className="text-xs text-yellow-600 mt-0.5">ажилтан</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Filter + List */}
      <Card>
        <CardHeader className="pb-2 pt-4">
          <div className="flex items-center justify-between gap-2">
            <CardTitle className="text-sm font-semibold">Олголтын бүртгэл</CardTitle>
            <div className="flex items-center gap-1">
              <Filter className="w-3.5 h-3.5 text-muted-foreground" />
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 w-32 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="issued">Олгогдсон</SelectItem>
                  <SelectItem value="returned">Буцаасан</SelectItem>
                  <SelectItem value="lost">Гээгдсэн</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="animate-spin text-muted-foreground" />
            </div>
          ) : issuances.length === 0 ? (
            <p className="text-center text-muted-foreground text-sm py-10">
              Бүртгэл байхгүй байна
            </p>
          ) : (
            <div className="divide-y">
              {issuances.map(iss => {
                const days = getDaysUntilDue(iss.nextIssueDue);
                const isOverdue = days !== null && days < 0;
                const isUpcoming = days !== null && days >= 0 && days <= 45;
                return (
                  <div key={iss.id} className="px-4 py-3 flex items-start gap-3">
                    {/* Avatar */}
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary">
                      {iss.employeeLastName?.[0]}{iss.employeeFirstName?.[0]}
                    </div>
                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-sm font-semibold leading-tight">
                            {iss.employeeLastName} {iss.employeeFirstName}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {iss.items.slice(0, 2).map((item, i) => (
                              <span key={i} className="text-xs text-muted-foreground">
                                {item.name} ×{item.qty}{item.size ? ` (${item.size})` : ""}
                              </span>
                            ))}
                            {iss.items.length > 2 && (
                              <span className="text-xs text-muted-foreground">+{iss.items.length - 2}</span>
                            )}
                          </div>
                        </div>
                        <Badge className={`text-xs shrink-0 border-0 ${statusColors[iss.status] ?? ""}`}>
                          {statusLabels[iss.status] ?? iss.status}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between mt-1.5 gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(iss.issuedAt), "yyyy/MM/dd")}
                          </span>
                          {iss.nextIssueDue && (
                            <span className={`text-xs flex items-center gap-0.5 ${
                              isOverdue ? "text-red-600 font-medium" : isUpcoming ? "text-yellow-600" : "text-muted-foreground"
                            }`}>
                              {isOverdue && <AlertTriangle className="w-3 h-3" />}
                              {isUpcoming && !isOverdue && <Clock className="w-3 h-3" />}
                              {isOverdue
                                ? `${Math.abs(days!)}х хэтэрсэн`
                                : days !== null ? `${days}х үлдсэн` : ""}
                            </span>
                          )}
                        </div>
                        {iss.status === "issued" && (
                          <Button
                            variant="ghost" size="sm"
                            className="h-7 text-xs px-2 shrink-0"
                            onClick={() => { if (confirm("Хувцас буцааж авах уу?")) returnMutation.mutate(iss.id); }}
                          >
                            <RotateCcw className="w-3 h-3 mr-1" />
                            Буцаах
                          </Button>
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

      {/* Issue Dialog */}
      <Dialog open={showIssue} onOpenChange={setShowIssue}>
        <DialogContent className="max-w-lg w-[calc(100vw-2rem)] sm:w-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Package className="w-5 h-5" />
              Нормын хувцас олгох
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[65vh] overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Ажилтан *</Label>
              <Select value={selectedEmployee} onValueChange={setSelectedEmployee}>
                <SelectTrigger><SelectValue placeholder="Ажилтан сонгох..." /></SelectTrigger>
                <SelectContent>
                  {employees.map(e => (
                    <SelectItem key={e.id} value={e.id}>{e.lastName} {e.firstName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Огноо</Label>
              <Input type="date" value={issuedAt} onChange={e => setIssuedAt(e.target.value)} />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Зүйлс *</Label>
                <Button variant="outline" size="sm" onClick={addItem} className="h-7 text-xs">
                  <Plus className="w-3 h-3 mr-1" /> Нэмэх
                </Button>
              </div>
              <div className="space-y-2">
                {items.map((item, i) => (
                  <div key={i} className="flex gap-2 items-center">
                    <Input
                      className="flex-1 min-w-0"
                      placeholder="Нэр (Гэдэс...)"
                      value={item.name}
                      onChange={e => updateItem(i, "name", e.target.value)}
                    />
                    <Input
                      type="number" min={1}
                      className="w-16 shrink-0"
                      placeholder="Тоо"
                      value={item.qty}
                      onChange={e => updateItem(i, "qty", parseInt(e.target.value) || 1)}
                    />
                    <Input
                      className="w-20 shrink-0"
                      placeholder="Хэмжэ"
                      value={item.size}
                      onChange={e => updateItem(i, "size", e.target.value)}
                    />
                    <Button
                      variant="ghost" size="icon"
                      className="h-9 w-9 shrink-0 text-destructive"
                      onClick={() => removeItem(i)}
                      disabled={items.length === 1}
                    >✕</Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Тэмдэглэл</Label>
              <Input placeholder="Нэмэлт тэмдэглэл..." value={noteInput} onChange={e => setNoteInput(e.target.value)} />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowIssue(false)}>Болих</Button>
            <Button
              onClick={() => issueMutation.mutate()}
              disabled={!selectedEmployee || items.every(i => !i.name) || issueMutation.isPending}
            >
              {issueMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Олгох
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
