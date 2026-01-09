import { useState } from "react";
import { useJournalEntries } from "@/hooks/use-journal-entries";
import { useJournals } from "@/hooks/use-journals";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Search, Eye, RotateCcw, FileText, Calendar } from "lucide-react";
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

  const { toast } = useToast();
  const { journals = [] } = useJournals();

  const filters = {
    journalId: journalFilter !== "all" ? journalFilter : undefined,
    status: statusFilter !== "all" ? statusFilter : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  };

  const { entries = [], isLoading, reverseEntry } = useJournalEntries(filters);

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

  const filteredEntries = entries.filter((entry) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      entry.entryNumber?.toLowerCase().includes(searchLower) ||
      entry.description?.toLowerCase().includes(searchLower) ||
      entry.reference?.toLowerCase().includes(searchLower)
    );
  });

  // Calculate totals for each entry (from list - no lines, so use 0)
  const calculateEntryTotals = (entry: any) => {
    if (!entry.lines || entry.lines.length === 0) {
      // For list view, we don't have lines, so return 0
      // Real totals will be shown in detail dialog
      return { debit: 0, credit: 0 };
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Журналын бичилт
          </h2>
          <p className="text-muted-foreground mt-2">
            Санхүүгийн бичлэгүүд, журналын бичилтүүд
          </p>
        </div>
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
            <TableRow>
              <TableHead>Дугаар</TableHead>
              <TableHead>Огноо</TableHead>
              <TableHead>Журнал</TableHead>
              <TableHead>Тайлбар</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead className="text-right">Дебет</TableHead>
              <TableHead className="text-right">Кредит</TableHead>
              <TableHead>Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Journal entries ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredEntries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                      {entry.entryDate ? format(new Date(entry.entryDate), "yyyy-MM-dd") : "-"}
                    </TableCell>
                    <TableCell>{entry.journalName || "-"}</TableCell>
                    <TableCell className="max-w-xs truncate" title={entry.description || ""}>
                      {entry.description || "-"}
                    </TableCell>
                    <TableCell>{getStatusBadge(entry.status)}</TableCell>
                    <TableCell className="text-right">
                      {totals.debit > 0 ? formatMNT(totals.debit) : "-"}
                    </TableCell>
                    <TableCell className="text-right">
                      {totals.credit > 0 ? formatMNT(totals.credit) : "-"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={async () => {
                            setDetailDialog({ open: true, entryId: entry.id });
                            // Fetch full entry with lines
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

      {/* Detail Dialog */}
      <Dialog open={detailDialog.open} onOpenChange={(open) => {
        setDetailDialog({ open, entryId: null });
        if (!open) setDetailEntry(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Журналын бичилт - {detailEntry?.entryNumber || "..."}</DialogTitle>
            <DialogDescription>
              {detailEntry?.description || "Дэлгэрэнгүй мэдээлэл"}
            </DialogDescription>
          </DialogHeader>
          {detailEntry ? (
            <div className="space-y-4">
              {/* Header Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/50 rounded-lg">
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
                        <TableHead className="text-right">Дебет</TableHead>
                        <TableHead className="text-right">Кредит</TableHead>
                        <TableHead>Тайлбар</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {detailEntry.lines?.map((line: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-mono">{line.accountCode}</TableCell>
                          <TableCell>{line.accountName}</TableCell>
                          <TableCell className="text-right">
                            {parseFloat(line.debit || "0") > 0 ? formatMNT(line.debit) : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            {parseFloat(line.credit || "0") > 0 ? formatMNT(line.credit) : "-"}
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
                        <span className="font-bold">{formatMNT(totals.debit)}</span>
                      </div>
                      <div className="flex justify-between items-center text-lg">
                        <span className="font-semibold">Нийт Кредит:</span>
                        <span className="font-bold">{formatMNT(totals.credit)}</span>
                      </div>
                      <div
                        className={`mt-2 p-2 rounded ${
                          isBalanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
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
