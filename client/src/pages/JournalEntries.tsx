import { useState, useMemo } from "react";
import { useJournalEntries } from "@/hooks/use-journal-entries";
import { useJournals } from "@/hooks/use-journals";
import { useAccounts } from "@/hooks/use-accounts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Search, Eye, RotateCcw, Plus, Trash2, CheckCircle, XCircle, TrendingUp, TrendingDown, Scale } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

const formatMNT = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0₮";
  return new Intl.NumberFormat("mn-MN", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(num) + "₮";
};

const getStatusBadge = (status: string) => {
  switch (status) {
    case "draft":
      return <Badge variant="outline">Ноорог</Badge>;
    case "posted":
      return <Badge className="bg-blue-100 text-blue-800">Бүртгэгдсэн</Badge>;
    case "reversed":
      return <Badge className="bg-orange-100 text-orange-800">Буцаагдсан</Badge>;
    case "cancelled":
      return <Badge variant="destructive">Цуцлагдсан</Badge>;
    default:
      return <Badge>{status}</Badge>;
  }
};

const getSourceBadge = (reference: string | null | undefined) => {
  if (!reference) {
    return <Badge variant="outline" className="text-purple-600 border-purple-300">Гараар</Badge>;
  }
  if (reference.startsWith("INV-") || reference.includes("Invoice")) {
    return <Badge className="bg-green-100 text-green-800">Борлуулалт</Badge>;
  }
  if (reference.startsWith("PO-") || reference.includes("Purchase")) {
    return <Badge className="bg-amber-100 text-amber-800">Худалдан авалт</Badge>;
  }
  if (reference.startsWith("PAY-") || reference.includes("Payment")) {
    return <Badge className="bg-blue-100 text-blue-800">Төлбөр</Badge>;
  }
  return <Badge variant="outline" className="text-gray-600">Автомат</Badge>;
};

interface JournalLine {
  accountId: string;
  accountCode?: string;
  accountName?: string;
  debit: string;
  credit: string;
  description: string;
}

export default function JournalEntries() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [journalFilter, setJournalFilter] = useState<string>("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [detailDialog, setDetailDialog] = useState<{ open: boolean; entryId: string | null }>({
    open: false,
    entryId: null,
  });
  const [detailEntry, setDetailEntry] = useState<any | null>(null);
  const [reverseDialog, setReverseDialog] = useState<{ open: boolean; entry: any | null }>({
    open: false,
    entry: null,
  });
  const [reverseDescription, setReverseDescription] = useState("");
  const [reverseDate, setReverseDate] = useState(format(new Date(), "yyyy-MM-dd"));

  // Manual Entry Dialog state
  const [manualEntryDialog, setManualEntryDialog] = useState(false);
  const [manualEntryDate, setManualEntryDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [manualEntryDescription, setManualEntryDescription] = useState("");
  const [manualEntryJournalId, setManualEntryJournalId] = useState<string>("");
  const [manualEntryLines, setManualEntryLines] = useState<JournalLine[]>([
    { accountId: "", debit: "", credit: "", description: "" },
    { accountId: "", debit: "", credit: "", description: "" },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { toast } = useToast();
  const { journals = [] } = useJournals();
  const { accounts = [] } = useAccounts();

  const filters = {
    journalId: journalFilter !== "all" ? journalFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  const { entries = [], isLoading, reverseEntry } = useJournalEntries(filters);

  // Calculate KPI totals from all filtered entries
  const kpiTotals = useMemo(() => {
    let totalDebit = 0;
    let totalCredit = 0;

    entries.forEach((entry: any) => {
      if (entry.lines && entry.lines.length > 0) {
        entry.lines.forEach((line: any) => {
          totalDebit += parseFloat(line.debit || "0");
          totalCredit += parseFloat(line.credit || "0");
        });
      } else if (entry.totalDebit !== undefined && entry.totalCredit !== undefined) {
        totalDebit += parseFloat(entry.totalDebit || "0");
        totalCredit += parseFloat(entry.totalCredit || "0");
      }
    });

    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;
    return { totalDebit, totalCredit, isBalanced };
  }, [entries]);

  // Manual entry line totals
  const lineTotals = useMemo(() => {
    const totalDebit = manualEntryLines.reduce((sum, line) => sum + parseFloat(line.debit || "0"), 0);
    const totalCredit = manualEntryLines.reduce((sum, line) => sum + parseFloat(line.credit || "0"), 0);
    const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01 && totalDebit > 0;
    return { totalDebit, totalCredit, isBalanced };
  }, [manualEntryLines]);

  const handleReverse = async () => {
    if (!reverseDialog.entry) return;
    try {
      await reverseEntry.mutateAsync({
        id: reverseDialog.entry.id,
        entryDate: reverseDate,
        description: reverseDescription || undefined,
      });
      toast({
        title: "Амжилттай",
        description: "Журналын бичилт амжилттай буцаагдлаа.",
      });
      setReverseDialog({ open: false, entry: null });
      setReverseDescription("");
      setReverseDate(format(new Date(), "yyyy-MM-dd"));
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Журналын бичилт буцаахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const handleAddManualLine = () => {
    setManualEntryLines([...manualEntryLines, { accountId: "", debit: "", credit: "", description: "" }]);
  };

  const handleRemoveManualLine = (index: number) => {
    if (manualEntryLines.length > 2) {
      setManualEntryLines(manualEntryLines.filter((_, i) => i !== index));
    }
  };

  const handleManualLineChange = (index: number, field: keyof JournalLine, value: string) => {
    const newLines = [...manualEntryLines];
    newLines[index] = { ...newLines[index], [field]: value };

    // Add account info when account is selected
    if (field === "accountId" && value) {
      const account = accounts.find((a: any) => a.id === value);
      if (account) {
        newLines[index].accountCode = account.code;
        newLines[index].accountName = account.name;
      }
    }

    setManualEntryLines(newLines);
  };

  const handleSubmitManualEntry = async () => {
    if (!lineTotals.isBalanced || !manualEntryJournalId || !manualEntryDate) {
      toast({
        title: "Алдаа",
        description: "Мэдээллээ бүрэн бөглөнө үү. Дебет, Кредит тэнцэх ёстой.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch("/api/journal-entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          journalId: manualEntryJournalId,
          entryDate: manualEntryDate,
          description: manualEntryDescription,
          lines: manualEntryLines.filter(l => l.accountId && (parseFloat(l.debit || "0") > 0 || parseFloat(l.credit || "0") > 0)),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || "Журналын бичилт үүсгэхэд алдаа гарлаа");
      }

      toast({
        title: "Амжилттай",
        description: "Журналын бичилт амжилттай үүсгэгдлээ.",
      });
      setManualEntryDialog(false);
      resetManualEntryForm();
      // Refresh entries
      window.location.reload();
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetManualEntryForm = () => {
    setManualEntryDate(format(new Date(), "yyyy-MM-dd"));
    setManualEntryDescription("");
    setManualEntryJournalId("");
    setManualEntryLines([
      { accountId: "", debit: "", credit: "", description: "" },
      { accountId: "", debit: "", credit: "", description: "" },
    ]);
  };

  const filteredEntries = entries.filter((entry) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      entry.entryNumber?.toLowerCase().includes(searchLower) ||
      entry.description?.toLowerCase().includes(searchLower) ||
      entry.reference?.toLowerCase().includes(searchLower)
    );
  });

  const calculateEntryTotals = (entry: any) => {
    if (!entry.lines || entry.lines.length === 0) {
      return { debit: parseFloat(entry.totalDebit || "0"), credit: parseFloat(entry.totalCredit || "0") };
    }
    const debit = entry.lines.reduce((sum: number, line: any) => {
      return sum + parseFloat(line.debit || "0");
    }, 0);
    const credit = entry.lines.reduce((sum: number, line: any) => {
      return sum + parseFloat(line.credit || "0");
    }, 0);
    return { debit, credit };
  };

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Журналын бичилт
          </h2>
          <p className="text-muted-foreground mt-2">
            Санхүүгийн бичлэгүүд, журналын бичилтүүд
          </p>
        </div>
        <Button onClick={() => setManualEntryDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Шинэ бичилт
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-l-4 border-l-green-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Нийт Дебет</p>
                <p className="text-2xl font-bold text-green-600">{formatMNT(kpiTotals.totalDebit)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-red-500">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Нийт Кредит</p>
                <p className="text-2xl font-bold text-red-600">{formatMNT(kpiTotals.totalCredit)}</p>
              </div>
              <TrendingDown className="h-8 w-8 text-red-500 opacity-50" />
            </div>
          </CardContent>
        </Card>
        <Card className={`border-l-4 ${kpiTotals.isBalanced ? "border-l-green-500 bg-green-50/50" : "border-l-red-500 bg-red-50/50"}`}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Тэнцэл</p>
                <p className={`text-2xl font-bold ${kpiTotals.isBalanced ? "text-green-600" : "text-red-600"}`}>
                  {kpiTotals.isBalanced ? "ТЭНЦСЭН ✅" : "ЗӨРСӨН ❌"}
                </p>
              </div>
              <Scale className={`h-8 w-8 ${kpiTotals.isBalanced ? "text-green-500" : "text-red-500"} opacity-50`} />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Дугаар, тайлбар хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Төлөв" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх төлөв</SelectItem>
            <SelectItem value="draft">Ноорог</SelectItem>
            <SelectItem value="posted">Бүртгэгдсэн</SelectItem>
            <SelectItem value="reversed">Буцаагдсан</SelectItem>
          </SelectContent>
        </Select>
        <Select value={journalFilter} onValueChange={setJournalFilter}>
          <SelectTrigger>
            <SelectValue placeholder="Журнал" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх журнал</SelectItem>
            {journals.map((j) => (
              <SelectItem key={j.id} value={j.id}>
                {j.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          placeholder="Эхлэх огноо"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
        <Input
          type="date"
          placeholder="Дуусах огноо"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30">
              <TableHead>Дугаар</TableHead>
              <TableHead>Огноо</TableHead>
              <TableHead>Журнал</TableHead>
              <TableHead>Эх үүсвэр</TableHead>
              <TableHead>Тайлбар</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead className="text-right bg-green-50 text-green-700 font-semibold">Дебет</TableHead>
              <TableHead className="text-right bg-red-50 text-red-700 font-semibold">Кредит</TableHead>
              <TableHead>Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Journal entries ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  {search ? "Хайлтад тохирох журналын бичилт олдсонгүй." : "Журналын бичилт байхгүй байна."}
                </TableCell>
              </TableRow>
            ) : (
              filteredEntries.map((entry) => {
                const totals = calculateEntryTotals(entry);
                return (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium font-mono">{entry.entryNumber}</TableCell>
                    <TableCell>
                      {entry.entryDate ? format(new Date(entry.entryDate), "yyyy-MM-dd") : "–"}
                    </TableCell>
                    <TableCell>{entry.journalName || "–"}</TableCell>
                    <TableCell>{getSourceBadge(entry.reference)}</TableCell>
                    <TableCell className="max-w-xs truncate" title={entry.description || ""}>
                      {entry.description || "–"}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell className="text-right font-mono">
                      {totals.debit > 0 ? formatMNT(totals.debit) : <span className="text-gray-400">–</span>}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {totals.credit > 0 ? formatMNT(totals.credit) : <span className="text-gray-400">–</span>}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            setDetailDialog({ open: true, entryId: entry.id });
                            try {
                              const res = await fetch(`/api/journal-entries/${entry.id}`);
                              if (res.ok) {
                                const fullEntry = await res.json();
                                setDetailEntry(fullEntry);
                              }
                            } catch (err) {
                              console.error("Failed to fetch entry details:", err);
                            }
                          }}
                          title="Дэлгэрэнгүй харах"
                        >
                          <Eye className="h-3 w-3" />
                        </Button>
                        {entry.status === "posted" && !entry.reversedByEntryId && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setReverseDialog({ open: true, entry });
                              setReverseDate(format(new Date(), "yyyy-MM-dd"));
                              setReverseDescription(`Reversal of ${entry.entryNumber}`);
                            }}
                            title="Буцаах"
                          >
                            <RotateCcw className="h-3 w-3 text-orange-600" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      {/* Manual Entry Dialog */}
      <Dialog open={manualEntryDialog} onOpenChange={setManualEntryDialog}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Шинэ журналын бичилт</DialogTitle>
            <DialogDescription>
              Гараар журналын бичилт оруулах. Дебет, Кредит тэнцэх ёстой.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Header Info */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="entry-date">Огноо *</Label>
                <Input
                  id="entry-date"
                  type="date"
                  value={manualEntryDate}
                  onChange={(e) => setManualEntryDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="entry-journal">Журнал *</Label>
                <Select value={manualEntryJournalId} onValueChange={setManualEntryJournalId}>
                  <SelectTrigger id="entry-journal">
                    <SelectValue placeholder="Журнал сонгох..." />
                  </SelectTrigger>
                  <SelectContent>
                    {journals.map((j) => (
                      <SelectItem key={j.id} value={j.id}>
                        {j.code} - {j.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="entry-description">Тайлбар</Label>
                <Input
                  id="entry-description"
                  value={manualEntryDescription}
                  onChange={(e) => setManualEntryDescription(e.target.value)}
                  placeholder="Бичилтийн тайлбар..."
                />
              </div>
            </div>

            {/* Lines Table */}
            <div className="border rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[300px]">Данс</TableHead>
                    <TableHead className="text-right bg-green-50 text-green-700">Дебет</TableHead>
                    <TableHead className="text-right bg-red-50 text-red-700">Кредит</TableHead>
                    <TableHead>Тайлбар</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manualEntryLines.map((line, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Select
                          value={line.accountId}
                          onValueChange={(value) => handleManualLineChange(index, "accountId", value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Данс сонгох..." />
                          </SelectTrigger>
                          <SelectContent>
                            {accounts.map((a: any) => (
                              <SelectItem key={a.id} value={a.id}>
                                {a.code} - {a.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={line.debit}
                          onChange={(e) => handleManualLineChange(index, "debit", e.target.value)}
                          placeholder="0"
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={line.credit}
                          onChange={(e) => handleManualLineChange(index, "credit", e.target.value)}
                          placeholder="0"
                          className="text-right"
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          value={line.description}
                          onChange={(e) => handleManualLineChange(index, "description", e.target.value)}
                          placeholder="Мөрийн тайлбар..."
                        />
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveManualLine(index)}
                          disabled={manualEntryLines.length <= 2}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            <Button variant="outline" onClick={handleAddManualLine} className="gap-2">
              <Plus className="h-4 w-4" />
              Мөр нэмэх
            </Button>

            {/* Totals */}
            <div className="border-t pt-4">
              <div className="flex justify-end gap-8">
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Нийт Дебет</p>
                  <p className="text-xl font-bold text-green-600">{formatMNT(lineTotals.totalDebit)}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Нийт Кредит</p>
                  <p className="text-xl font-bold text-red-600">{formatMNT(lineTotals.totalCredit)}</p>
                </div>
              </div>
              <div className={`mt-4 p-3 rounded-lg flex items-center justify-center gap-2 ${lineTotals.isBalanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                }`}>
                {lineTotals.isBalanced ? (
                  <>
                    <CheckCircle className="h-5 w-5" />
                    <span className="font-semibold">Тэнцсэн ✅</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-5 w-5" />
                    <span className="font-semibold">
                      Зөрүү: {formatMNT(Math.abs(lineTotals.totalDebit - lineTotals.totalCredit))}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setManualEntryDialog(false)}>
              Цуцлах
            </Button>
            <Button
              onClick={handleSubmitManualEntry}
              disabled={!lineTotals.isBalanced || !manualEntryJournalId || !manualEntryDate || isSubmitting}
            >
              {isSubmitting ? "Хадгалж байна..." : "Хадгалах"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => {
        setDetailDialog({ open, entryId: null });
        if (!open) setDetailEntry(null);
      }}>
        <DialogContent className="w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Журналын бичилт - {detailEntry?.entryNumber || "..."}</DialogTitle>
            <DialogDescription>
              {detailEntry?.description || "Дэлгэрэнгүй мэдээлэл"}
            </DialogDescription>
          </DialogHeader>
          {detailEntry ? (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
                <div>
                  <Label className="text-muted-foreground">Огноо:</Label>
                  <p className="font-semibold">
                    {detailEntry.entryDate
                      ? format(new Date(detailEntry.entryDate), "yyyy-MM-dd")
                      : "-"}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Журнал:</Label>
                  <p className="font-semibold">{detailEntry.journalName || "-"}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Төлөв:</Label>
                  <p>{getStatusBadge(detailEntry.status)}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Эх үүсвэр:</Label>
                  <p>{getSourceBadge(detailEntry.reference)}</p>
                </div>
                {detailEntry.reference && (
                  <div>
                    <Label className="text-muted-foreground">Reference:</Label>
                    <p className="font-semibold">{detailEntry.reference}</p>
                  </div>
                )}
                {detailEntry.reversedByEntryId && (
                  <div className="col-span-2">
                    <Label className="text-muted-foreground">Буцаагдсан:</Label>
                    <p className="font-semibold text-orange-600">
                      Entry {detailEntry.reversedByEntryId} буцаагдсан
                    </p>
                  </div>
                )}
              </div>

              {/* Lines */}
              <div>
                <h4 className="font-semibold mb-3">Journal Lines:</h4>
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Данс</TableHead>
                        <TableHead>Дансны нэр</TableHead>
                        <TableHead className="text-right bg-green-50 text-green-700">Дебет</TableHead>
                        <TableHead className="text-right bg-red-50 text-red-700">Кредит</TableHead>
                        <TableHead>Тайлбар</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailEntry.lines?.map((line: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono">{line.accountCode}</TableCell>
                          <TableCell>{line.accountName}</TableCell>
                          <TableCell className="text-right font-mono">
                            {parseFloat(line.debit || "0") > 0 ? formatMNT(line.debit) : <span className="text-gray-400">–</span>}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {parseFloat(line.credit || "0") > 0 ? formatMNT(line.credit) : <span className="text-gray-400">–</span>}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {line.description || "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Totals */}
              <div className="border-t pt-4">
                {(() => {
                  const totals = calculateEntryTotals(detailEntry);
                  const isBalanced = Math.abs(totals.debit - totals.credit) < 0.01;
                  return (
                    <>
                      <div className="flex justify-between items-center text-lg">
                        <span className="font-semibold">Нийт Дебет:</span>
                        <span className="font-bold text-green-600">{formatMNT(totals.debit)}</span>
                      </div>
                      <div className="flex justify-between items-center text-lg">
                        <span className="font-semibold">Нийт Кредит:</span>
                        <span className="font-bold text-red-600">{formatMNT(totals.credit)}</span>
                      </div>
                      <div
                        className={`mt-2 p-2 rounded ${isBalanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                          }`}
                      >
                        <p className="font-semibold text-center">
                          {isBalanced ? "✅ Double-entry баланс зөв" : "❌ Double-entry баланс зөрсөн"}
                        </p>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* Reverse Dialog */}
      <Dialog open={reverseDialog.open} onOpenChange={(open) => setReverseDialog({ open, entry: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Журналын бичилт буцаах</DialogTitle>
            <DialogDescription>
              Уучлаарай, энэ entry-г буцаах нь урвуу бичилт үүсгэнэ. Энэ үйлдлийг буцаах боломжгүй.
            </DialogDescription>
          </DialogHeader>
          {reverseDialog.entry && (
            <div className="space-y-4">
              <div>
                <Label className="text-muted-foreground">Entry дугаар:</Label>
                <p className="font-semibold">{reverseDialog.entry.entryNumber}</p>
              </div>
              <div>
                <Label htmlFor="reverse-date">Буцаах огноо *</Label>
                <Input
                  id="reverse-date"
                  type="date"
                  value={reverseDate}
                  onChange={(e) => setReverseDate(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="reverse-description">Тайлбар</Label>
                <Textarea
                  id="reverse-description"
                  value={reverseDescription}
                  onChange={(e) => setReverseDescription(e.target.value)}
                  placeholder="Буцаах шалтгаан..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setReverseDialog({ open: false, entry: null })}>
                  Цуцлах
                </Button>
                <Button
                  onClick={handleReverse}
                  disabled={reverseEntry.isPending || !reverseDate}
                  variant="destructive"
                >
                  {reverseEntry.isPending ? "Буцаалж байна..." : "Буцаах"}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
