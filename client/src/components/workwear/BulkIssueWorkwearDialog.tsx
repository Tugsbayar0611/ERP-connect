import { useState, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { toast } from "@/hooks/use-toast";
import { Search, Users, CheckSquare, Square, AlertCircle, Loader2, Filter } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface BulkIssueWorkwearDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: any[];
}

export default function BulkIssueWorkwearDialog({ open, onOpenChange, items }: BulkIssueWorkwearDialogProps) {
  const queryClient = useQueryClient();
  const currentYear = new Date().getFullYear();

  // Step state
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1: Employee selection
  const [searchTerm, setSearchTerm] = useState("");
  const [filterDept, setFilterDept] = useState("__all__");
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(new Set());

  // Step 2: Workwear selection
  const [workwearItemId, setWorkwearItemId] = useState("");
  const [size, setSize] = useState("");
  const [notes, setNotes] = useState("");

  // Fetch employees
  const { data: employeesRaw = [], isLoading: isLoadingEmp } = useQuery({
    queryKey: ["/api/employees"],
    enabled: open,
  });
  const employees = employeesRaw as any[];

  // Fetch departments
  const { data: deptsRaw = [] } = useQuery({
    queryKey: ["/api/departments"],
    enabled: open,
  });
  const departments = deptsRaw as any[];

  // Filter employees
  const filtered = useMemo(() => {
    return employees.filter((emp: any) => {
      const term = searchTerm.toLowerCase();
      const matchName = !searchTerm ||
        emp.firstName?.toLowerCase().includes(term) ||
        emp.lastName?.toLowerCase().includes(term) ||
        emp.employeeNo?.toLowerCase().includes(term);
      const matchDept = filterDept === "__all__" || emp.departmentId === filterDept;
      return matchName && matchDept;
    });
  }, [employees, searchTerm, filterDept]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((e: any) => selectedEmployeeIds.has(e.id));

  const toggleEmployee = (id: string) => {
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllFiltered = () => {
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      if (allFilteredSelected) {
        filtered.forEach((e: any) => next.delete(e.id));
      } else {
        filtered.forEach((e: any) => next.add(e.id));
      }
      return next;
    });
  };

  const selectByDept = (deptId: string) => {
    setSelectedEmployeeIds(prev => {
      const next = new Set(prev);
      employees.filter((e: any) => e.departmentId === deptId).forEach((e: any) => next.add(e.id));
      return next;
    });
  };

  // Bulk issue mutation
  const bulkMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/workwear/issuances/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.details || err.error || "Алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: (result: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/workwear/issuances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workwear/eligibility"] });
      toast({
        title: "Амжилттай олголоо!",
        description: `${result.successCount} ажилтанд хувцас олгогдлоо. ${result.skippedCount > 0 ? `${result.skippedCount} ажилтан норм дууссан учир алгасагдлаа.` : ""}`,
      });
      handleClose();
    },
    onError: (err: any) => {
      toast({ title: "Алдаа", description: err.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setStep(1);
    setSelectedEmployeeIds(new Set());
    setSearchTerm("");
    setFilterDept("__all__");
    setWorkwearItemId("");
    setSize("");
    setNotes("");
  };

  const handleIssue = () => {
    if (!workwearItemId || selectedEmployeeIds.size === 0) return;
    bulkMutation.mutate({
      employeeIds: Array.from(selectedEmployeeIds),
      workwearItemId,
      quantity: 1,
      size,
      notes,
      year: currentYear,
    });
  };

  const selectedItem = items.find((i: any) => i.id === workwearItemId);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            Бөөнөөр хувцас олгох
          </DialogTitle>
          {/* <DialogDescription>
            Олон ажилтанд нэгэн зэрэг хувцас олгож бүртгэнэ. Систем нормын хязгаарыг автоматаар шалгана.
          </DialogDescription> */}
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 text-sm">
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${step === 1 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            <span>1</span>
            <span>Ажилтан сонгох</span>
          </div>
          <div className="h-px flex-1 bg-border" />
          <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${step === 2 ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            <span>2</span>
            <span>Хувцас сонгох</span>
          </div>
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-3 flex-1 overflow-hidden">
            {/* Filters */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Ажилтан хайх (нэр, дугаар)..."
                  className="pl-9"
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                />
              </div>
              <Select value={filterDept} onValueChange={setFilterDept}>
                <SelectTrigger className="w-48">
                  <Filter className="w-3 h-3 mr-1 text-muted-foreground" />
                  <SelectValue placeholder="Хэлтэс" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Бүх хэлтэс</SelectItem>
                  {departments.map((d: any) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Quick department select buttons */}
            {departments.length > 0 && (
              <div className="flex items-center gap-2 px-1">
                <span className="text-xs text-muted-foreground whitespace-nowrap">Салбараар нэмэх:</span>
                <Select value="" onValueChange={(val) => {
                  if (val) selectByDept(val);
                }}>
                  <SelectTrigger className="h-8 flex-1 text-xs bg-muted/30">
                    <SelectValue placeholder="Сонгох..." />
                  </SelectTrigger>
                  <SelectContent>
                    {departments.map((d: any) => {
                      const count = employees.filter((e: any) => e.departmentId === d.id).length;
                      return (
                        <SelectItem key={d.id} value={d.id}>
                          {d.name} ({count} хүн)
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Select all row */}
            <div className="flex items-center justify-between px-1">
              <button
                onClick={toggleAllFiltered}
                className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                {allFilteredSelected
                  ? <CheckSquare className="w-4 h-4 text-primary" />
                  : <Square className="w-4 h-4" />
                }
                {allFilteredSelected ? "Бүгдийг болиулах" : `Харагдаж байгаа ${filtered.length}г сонгох`}
              </button>
              {selectedEmployeeIds.size > 0 && (
                <Badge className="bg-primary/20 text-primary border-0">
                  {selectedEmployeeIds.size} ажилтан сонгогдсон
                </Badge>
              )}
            </div>

            <Separator />

            {/* Employee list */}
            <ScrollArea className="flex-1 pr-1">
              {isLoadingEmp ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filtered.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-8">Ажилтан олдсонгүй</p>
              ) : (
                <div className="space-y-1">
                  {filtered.map((emp: any) => {
                    const selected = selectedEmployeeIds.has(emp.id);
                    return (
                      <div
                        key={emp.id}
                        onClick={() => toggleEmployee(emp.id)}
                        className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors ${selected
                          ? "bg-primary/10 border border-primary/30"
                          : "hover:bg-muted/60 border border-transparent"
                          }`}
                      >
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggleEmployee(emp.id)}
                          onClick={e => e.stopPropagation()}
                        />
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-semibold text-primary">
                          {emp.firstName?.[0]}{emp.lastName?.[0]}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {emp.lastName?.[0]}. {emp.firstName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {emp.position || emp.jobTitle || "—"} {emp.employeeNo ? `· №${emp.employeeNo}` : ""}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            <div className="flex justify-between items-center pt-2">
              <Button variant="outline" onClick={handleClose}>Цуцлах</Button>
              <Button
                onClick={() => setStep(2)}
                disabled={selectedEmployeeIds.size === 0}
              >
                Үргэлжлүүлэх →
                {selectedEmployeeIds.size > 0 && (
                  <Badge className="ml-2 bg-white/20 text-white border-0 text-xs">
                    {selectedEmployeeIds.size}
                  </Badge>
                )}
              </Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <Alert>
              <Users className="h-4 w-4" />
              <AlertDescription>
                <strong>{selectedEmployeeIds.size} ажилтан</strong>-д нэгэн зэрэг олгоно.
                Нормоо дуусгасан ажилтнуудыг систем автоматаар алгасана.
              </AlertDescription>
            </Alert>

            <div className="space-y-2">
              <Label>Олгох хувцасны төрөл</Label>
              <Select value={workwearItemId} onValueChange={setWorkwearItemId}>
                <SelectTrigger>
                  <SelectValue placeholder="Хувцас сонгоно уу" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item: any) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name} (жилд {item.allowancePerYear}ш)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Хэмжээ (Заавал биш)</Label>
                <Input
                  placeholder="Жишээ: 42, XL..."
                  value={size}
                  onChange={e => setSize(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Бүх ажилтанд адил хэмжээ бол энд оруулна. Ялгаатай бол хоосон орхино.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Тэмдэглэл</Label>
                <Input
                  placeholder="Нэмэлт тайлбар..."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
            </div>

            {selectedItem && (
              <div className="p-3 rounded-lg bg-muted/50 text-sm space-y-1">
                <p className="font-medium">Олгох тоймлол:</p>
                <p className="text-muted-foreground">
                  • <strong>{selectedItem.name}</strong> — {selectedEmployeeIds.size} ажилтанд
                </p>
                <p className="text-muted-foreground">
                  • {currentYear} оны нормоор 1ш тус бүрд
                </p>
                <p className="text-muted-foreground text-xs">
                  ⚠️ Аль хэдийн нормоо авсан ажилтнууд автоматаар алгасагдана.
                </p>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button variant="outline" onClick={() => setStep(1)}>← Буцах</Button>
              <Button
                onClick={handleIssue}
                disabled={!workwearItemId || bulkMutation.isPending}
                className="min-w-32"
              >
                {bulkMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Бүртгэж байна...
                  </>
                ) : (
                  `${selectedEmployeeIds.size} ажилтанд олгох`
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
