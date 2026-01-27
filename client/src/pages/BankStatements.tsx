import { useState, useEffect } from "react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Upload, Eye, Check, LinkIcon, ArrowRight, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

const formatMNT = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("mn-MN", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(num) + "₮";
};

export default function BankStatements() {
  const [search, setSearch] = useState("");
  const [selectedBankAccount, setSelectedBankAccount] = useState<string>("");
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [selectedStatement, setSelectedStatement] = useState<any>(null);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("statements");

  // Reconciliation state
  const [selectedBankLine, setSelectedBankLine] = useState<any>(null);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);

  // Bank account creation state
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [newBankName, setNewBankName] = useState("");
  const [newAccountNumber, setNewAccountNumber] = useState("");

  const { toast } = useToast();

  const queryClient = useQueryClient();

  // Fetch bank accounts
  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: async () => {
      const res = await fetch("/api/bank-accounts");
      if (!res.ok) throw new Error("Банкны данс авахад алдаа гарлаа");
      return res.json();
    },
  });

  // Fetch bank statements
  const { data: statements = [], isLoading } = useQuery({
    queryKey: ["bank-statements", selectedBankAccount],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBankAccount) params.append("bankAccountId", selectedBankAccount);
      const res = await fetch(`/api/bank-statements?${params.toString()}`);
      if (!res.ok) throw new Error("Банкны тайлбар авахад алдаа гарлаа");
      return res.json();
    },
  });

  // Fetch selected statement details
  const { data: statementDetails } = useQuery({
    queryKey: ["bank-statement", selectedStatement?.id],
    queryFn: async () => {
      const res = await fetch(`/api/bank-statements/${selectedStatement.id}`);
      if (!res.ok) throw new Error("Тайлбарын дэлгэрэнгүй авахад алдаа гарлаа");
      return res.json();
    },
    enabled: !!selectedStatement?.id && isViewOpen,
  });

  // Fetch unreconciled bank lines
  const { data: unreconciledLines = [], isLoading: loadingLines } = useQuery({
    queryKey: ["unreconciled-lines", selectedBankAccount],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedBankAccount) params.append("bankAccountId", selectedBankAccount);
      const res = await fetch(`/api/bank-statement-lines/unreconciled?${params.toString()}`);
      if (!res.ok) throw new Error("Тулгаагүй гүйлгээ авахад алдаа гарлаа");
      return res.json();
    },
    enabled: activeTab === "reconciliation",
  });

  // Fetch unpaid invoices
  const { data: unpaidInvoices = [], isLoading: loadingInvoices } = useQuery({
    queryKey: ["unpaid-invoices"],
    queryFn: async () => {
      const res = await fetch("/api/invoices/unpaid?type=sales");
      if (!res.ok) throw new Error("Төлөгдөөгүй нэхэмжлэх авахад алдаа гарлаа");
      return res.json();
    },
    enabled: activeTab === "reconciliation",
  });

  // Import mutation
  const importMutation = useMutation({
    mutationFn: async (data: { bankAccountId: string; fileData: string; fileName: string }) => {
      const res = await fetch("/api/bank-statements/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Импорт хийхэд алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Амжилттай",
        description: data.message || "Банкны тайлбар амжилттай импорт хийгдлээ",
      });
      setIsImportOpen(false);
      queryClient.invalidateQueries({ queryKey: ["bank-statements"] });
      queryClient.invalidateQueries({ queryKey: ["unreconciled-lines"] });
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа",
        description: error.message || "Импорт хийхэд алдаа гарлаа",
        variant: "destructive",
      });
    },
  });

  // Create bank account mutation
  const createAccountMutation = useMutation({
    mutationFn: async (data: { bankName: string; accountNumber: string }) => {
      const res = await fetch("/api/bank-accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Банкны данс үүсгэхэд алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Амжилттай",
        description: "Банкны данс амжилттай үүсгэлээ",
      });
      setIsAddAccountOpen(false);
      setNewBankName("");
      setNewAccountNumber("");
      queryClient.invalidateQueries({ queryKey: ["bank-accounts"] });
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа",
        description: error.message || "Банкны данс үүсгэхэд алдаа гарлаа",
        variant: "destructive",
      });
    },
  });

  // Reconciliation mutation

  const reconcileMutation = useMutation({
    mutationFn: async (data: { statementLineId: string; invoiceId: string; matchedAmount: number }) => {
      const res = await fetch("/api/reconciliations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Тулгалт хийхэд алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: async (data) => {
      // Confirm the reconciliation
      await fetch(`/api/reconciliations/${data.id}/confirm`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
      });

      toast({
        title: "Амжилттай",
        description: "Тулгалт амжилттай хийгдлээ",
      });
      setSelectedBankLine(null);
      setSelectedInvoice(null);
      queryClient.invalidateQueries({ queryKey: ["unreconciled-lines"] });
      queryClient.invalidateQueries({ queryKey: ["unpaid-invoices"] });
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа",
        description: error.message || "Тулгалт хийхэд алдаа гарлаа",
        variant: "destructive",
      });
    },
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!selectedBankAccount) {
      toast({
        title: "Алдаа",
        description: "Эхлээд банкны данс сонгоно уу",
        variant: "destructive",
      });
      return;
    }

    const fileName = file.name;
    const isExcel = fileName.endsWith(".xlsx") || fileName.endsWith(".xls");
    const isCSV = fileName.endsWith(".csv");

    if (!isExcel && !isCSV) {
      toast({
        title: "Алдаа",
        description: "Зөвхөн Excel (.xlsx, .xls) эсвэл CSV (.csv) файл байх ёстой",
        variant: "destructive",
      });
      return;
    }

    try {
      if (isExcel) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const base64 = (e.target?.result as string).split(",")[1];
          importMutation.mutate({
            bankAccountId: selectedBankAccount,
            fileData: base64,
            fileName,
          });
        };
        reader.readAsDataURL(file);
      } else {
        const reader = new FileReader();
        reader.onload = (e) => {
          const text = e.target?.result as string;
          importMutation.mutate({
            bankAccountId: selectedBankAccount,
            fileData: text,
            fileName,
          });
        };
        reader.readAsText(file);
      }
    } catch (error: any) {
      toast({
        title: "Алдаа",
        description: error.message || "Файл уншихдаа алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const handleReconcile = () => {
    if (!selectedBankLine || !selectedInvoice) {
      toast({
        title: "Алдаа",
        description: "Банкны гүйлгээ болон нэхэмжлэх сонгоно уу",
        variant: "destructive",
      });
      return;
    }

    const bankAmount = parseFloat(selectedBankLine.credit) || parseFloat(selectedBankLine.debit) || 0;

    reconcileMutation.mutate({
      statementLineId: selectedBankLine.id,
      invoiceId: selectedInvoice.id,
      matchedAmount: bankAmount,
    });
  };

  const filteredStatements = statements.filter((stmt: any) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      stmt.statementDate?.toLowerCase().includes(searchLower) ||
      stmt.id?.toLowerCase().includes(searchLower)
    );
  });

  // Smart Matching Logic
  const [matchType, setMatchType] = useState<"reference" | "amount" | null>(null);

  useEffect(() => {
    if (!selectedBankLine || !unpaidInvoices.length) {
      setMatchType(null);
      return;
    }

    // Reset selection first to avoid confusion
    // setSelectedInvoice(null); // Optional: decide if we want to clear previous manual selection

    const bankAmount = parseFloat(selectedBankLine.credit) || parseFloat(selectedBankLine.debit) || 0;
    const description = (selectedBankLine.description || "").toLowerCase();
    const reference = (selectedBankLine.reference || "").toLowerCase();

    // 1. Priority: Reference Match (Invoice Number in Description/Ref)
    const exactRefMatch = unpaidInvoices.find((inv: any) => {
      const invNum = inv.invoiceNumber.toLowerCase();
      return description.includes(invNum) || reference.includes(invNum);
    });

    if (exactRefMatch) {
      setSelectedInvoice(exactRefMatch);
      setMatchType("reference");
      return;
    }

    // 2. Priority: Exact Amount Match
    const amountMatches = unpaidInvoices.filter((inv: any) => {
      const invAmount = parseFloat(inv.remainingAmount || inv.totalAmount);
      return Math.abs(invAmount - bankAmount) < 0.01;
    });

    if (amountMatches.length > 0) {
      // If multiple, pick the one closest in date (todo: better date diff)
      // For now, pick the first one
      setSelectedInvoice(amountMatches[0]);
      setMatchType("amount");
      return;
    }

    // No match found
    setMatchType(null);
    setSelectedInvoice(null);
  }, [selectedBankLine, unpaidInvoices]);

  // Check if amounts match
  const amountsMatch = () => {
    if (!selectedBankLine || !selectedInvoice) return false;
    const bankAmount = parseFloat(selectedBankLine.credit) || parseFloat(selectedBankLine.debit) || 0;
    const invoiceAmount = parseFloat(selectedInvoice.remainingAmount || selectedInvoice.totalAmount) || 0;
    return Math.abs(bankAmount - invoiceAmount) < 0.01;
  };

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Банкны тайлан & Тулгалт
          </h2>
          <p className="text-muted-foreground mt-2">
            Банкны хуулга импорт хийх, гүйлгээ тулгах
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsAddAccountOpen(true)}>
            + Данс нэмэх
          </Button>
          <Button onClick={() => setIsImportOpen(true)}>
            <Upload className="h-4 w-4 mr-2" />
            Импорт хийх
          </Button>
        </div>
      </div>


      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="statements">📄 Банкны хуулга</TabsTrigger>
          <TabsTrigger value="reconciliation">🔗 Тулгалт</TabsTrigger>
        </TabsList>

        {/* Bank Statements Tab */}
        <TabsContent value="statements" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Банкны хуулгууд</CardTitle>
              <CardDescription>
                Импорт хийсэн банкны хуулгууд
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-center">
                <div className="flex-1">
                  <Input
                    placeholder="Хайх..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="max-w-sm"
                  />
                </div>
                <div className="w-[250px]">
                  <Select
                    value={selectedBankAccount || "all"}
                    onValueChange={(value) => setSelectedBankAccount(value === "all" ? "" : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Бүх банкны данс" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Бүх банкны данс</SelectItem>
                      {bankAccounts.map((account: any) => (
                        <SelectItem key={account.id} value={account.id}>
                          {account.bankName} - {account.accountNumber}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {isLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Ачааллаж байна...
                </div>
              ) : filteredStatements.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Банкны хуулга олдсонгүй
                </div>
              ) : (
                <div className="border rounded-lg">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Банкны данс</TableHead>
                        <TableHead>Огноо</TableHead>
                        <TableHead className="text-right">Эхлэх үлдэгдэл</TableHead>
                        <TableHead className="text-right">Төгсгөлийн үлдэгдэл</TableHead>
                        <TableHead>Импорт хийсэн</TableHead>
                        <TableHead className="text-right">Үйлдлүүд</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredStatements.map((stmt: any) => {
                        const account = bankAccounts.find((acc: any) => acc.id === stmt.bankAccountId);
                        return (
                          <TableRow key={stmt.id}>
                            <TableCell>
                              {account ? `${account.bankName} - ${account.accountNumber}` : "-"}
                            </TableCell>
                            <TableCell>{stmt.statementDate || "-"}</TableCell>
                            <TableCell className="text-right">{formatMNT(stmt.openingBalance)}</TableCell>
                            <TableCell className="text-right">{formatMNT(stmt.closingBalance)}</TableCell>
                            <TableCell>
                              {stmt.importedAt
                                ? format(new Date(stmt.importedAt), "yyyy-MM-dd HH:mm")
                                : "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setSelectedStatement(stmt);
                                  setIsViewOpen(true);
                                }}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                Харах
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Reconciliation Tab */}
        <TabsContent value="reconciliation" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Panel - Bank Lines */}
            <Card className="border-2 border-blue-200 dark:border-blue-900">
              <CardHeader className="bg-blue-50 dark:bg-blue-900/20">
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">🏦</span>
                  Банкны гүйлгээнүүд
                </CardTitle>
                <CardDescription>
                  Тулгаагүй орлогын гүйлгээнүүд ({unreconciledLines.filter((l: any) => parseFloat(l.credit) > 0).length})
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingLines ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Ачааллаж байна...
                  </div>
                ) : unreconciledLines.filter((l: any) => parseFloat(l.credit) > 0).length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Тулгаагүй гүйлгээ олдсонгүй
                  </div>
                ) : (
                  <div className="max-h-[500px] overflow-y-auto">
                    {unreconciledLines
                      .filter((l: any) => parseFloat(l.credit) > 0)
                      .map((line: any) => (
                        <div
                          key={line.id}
                          className={`p-4 border-b cursor-pointer transition-all hover:bg-blue-50 dark:hover:bg-blue-900/30 ${selectedBankLine?.id === line.id
                            ? "bg-blue-100 dark:bg-blue-900/50 border-l-4 border-l-blue-500"
                            : ""
                            }`}
                          onClick={() => setSelectedBankLine(line)}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-sm text-muted-foreground">{line.date}</span>
                            <span className="font-bold text-green-600">{formatMNT(line.credit)}</span>
                          </div>
                          <p className="text-sm line-clamp-2">{line.description || "Тайлбаргүй"}</p>
                          {line.reference && (
                            <Badge variant="outline" className="mt-2 text-xs">
                              {line.reference}
                            </Badge>
                          )}
                        </div>
                      ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Right Panel - Invoices */}
            <Card className="border-2 border-orange-200 dark:border-orange-900">
              <CardHeader className="bg-orange-50 dark:bg-orange-900/20">
                <CardTitle className="flex items-center gap-2">
                  <span className="text-2xl">📄</span>
                  Нэхэмжлэхүүд
                </CardTitle>
                <CardDescription>
                  Төлөгдөөгүй нэхэмжлэхүүд ({unpaidInvoices.length})
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {loadingInvoices ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Ачааллаж байна...
                  </div>
                ) : unpaidInvoices.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Төлөгдөөгүй нэхэмжлэх олдсонгүй
                  </div>
                ) : (
                  <div className="max-h-[500px] overflow-y-auto">
                    {unpaidInvoices.map((invoice: any) => (
                      <div
                        key={invoice.id}
                        className={`p-4 border-b cursor-pointer transition-all hover:bg-orange-50 dark:hover:bg-orange-900/30 ${selectedInvoice?.id === invoice.id
                          ? "bg-orange-100 dark:bg-orange-900/50 border-l-4 border-l-orange-500"
                          : ""
                          }`}
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold">{invoice.invoiceNumber}</span>
                          <span className="font-bold text-orange-600">
                            {formatMNT(invoice.remainingAmount || invoice.totalAmount)}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">{invoice.contactName || "Харилцагчгүй"}</p>
                        <span className="text-xs text-muted-foreground">
                          Дуусах: {invoice.dueDate}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Match Button */}
          <Card className="mt-6">
            <CardContent className="py-6">
              <div className="flex items-center justify-center gap-4">
                <div className="text-center flex-1">
                  {selectedBankLine ? (
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
                      <p className="font-semibold text-green-600">{formatMNT(selectedBankLine.credit)}</p>
                      <p className="text-sm text-muted-foreground line-clamp-1">
                        {selectedBankLine.description || "Сонгосон гүйлгээ"}
                      </p>
                    </div>
                  ) : (
                    <div className="p-4 border-2 border-dashed rounded-lg text-muted-foreground">
                      Банкны гүйлгээ сонгоно уу
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-center gap-2">
                  <ArrowRight className="h-8 w-8 text-muted-foreground" />
                  <Button
                    size="lg"
                    disabled={!selectedBankLine || !selectedInvoice || reconcileMutation.isPending}
                    onClick={handleReconcile}
                    className="gap-2"
                  >
                    {reconcileMutation.isPending ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <LinkIcon className="h-4 w-4" />
                    )}
                    Тулгах
                  </Button>
                  {amountsMatch() && (
                    <Badge className="bg-green-600">
                      <Check className="h-3 w-3 mr-1" />
                      Дүн таарч байна
                    </Badge>
                  )}
                </div>

                <div className="text-center flex-1">
                  {selectedInvoice ? (
                    <div className="p-4 bg-orange-50 dark:bg-orange-900/30 rounded-lg">
                      <p className="font-semibold text-orange-600">
                        {formatMNT(selectedInvoice.remainingAmount || selectedInvoice.totalAmount)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {selectedInvoice.invoiceNumber}
                      </p>
                      {matchType === "reference" && (
                        <Badge className="mt-2 bg-purple-100 text-purple-700 hover:bg-purple-200 border-purple-200">
                          <Check className="h-3 w-3 mr-1" />
                          Reference Match
                        </Badge>
                      )}
                      {matchType === "amount" && (
                        <Badge className="mt-2 bg-blue-100 text-blue-700 hover:bg-blue-200 border-blue-200">
                          <Check className="h-3 w-3 mr-1" />
                          Amount Match
                        </Badge>
                      )}
                    </div>
                  ) : (
                    <div className="p-4 border-2 border-dashed rounded-lg text-muted-foreground">
                      Нэхэмжлэх сонгоно уу
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Import Dialog */}
      <Dialog open={isImportOpen} onOpenChange={setIsImportOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Банкны хуулга импорт хийх</DialogTitle>
            <DialogDescription>
              Excel (.xlsx, .xls) эсвэл CSV (.csv) файл сонгоно уу
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Банкны данс *</Label>
              <Select
                value={selectedBankAccount || undefined}
                onValueChange={setSelectedBankAccount}
                disabled={importMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Банкны данс сонгох" />
                </SelectTrigger>
                <SelectContent>
                  {bankAccounts.length === 0 ? (
                    <SelectItem value="no-accounts" disabled>
                      Банкны данс байхгүй байна
                    </SelectItem>
                  ) : (
                    bankAccounts.map((account: any) => (
                      <SelectItem key={account.id} value={account.id}>
                        {account.bankName} - {account.accountNumber}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Файл сонгох *</Label>
              <div className="mt-2">
                <Input
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  disabled={importMutation.isPending || !selectedBankAccount}
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Дэмжигдсэн банкууд: Хаан банк, Голомт банк, ХХБ
                </p>
              </div>
            </div>
            {importMutation.isPending && (
              <div className="text-sm text-muted-foreground">
                Импорт хийж байна...
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* View Statement Dialog */}
      <Dialog open={isViewOpen} onOpenChange={setIsViewOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Банкны хуулгын дэлгэрэнгүй</DialogTitle>
            <DialogDescription>
              Огноо: {selectedStatement?.statementDate}
            </DialogDescription>
          </DialogHeader>
          {statementDetails && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Эхлэх үлдэгдэл</Label>
                  <p className="text-lg font-semibold">{formatMNT(statementDetails.openingBalance)}</p>
                </div>
                <div>
                  <Label>Төгсгөлийн үлдэгдэл</Label>
                  <p className="text-lg font-semibold">{formatMNT(statementDetails.closingBalance)}</p>
                </div>
                <div>
                  <Label>Гүйлгээний тоо</Label>
                  <p className="text-lg font-semibold">{statementDetails.lines?.length || 0}</p>
                </div>
              </div>
              <div className="border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Огноо</TableHead>
                      <TableHead>Тайлбар</TableHead>
                      <TableHead className="text-right">Зарлага</TableHead>
                      <TableHead className="text-right">Орлого</TableHead>
                      <TableHead className="text-right">Үлдэгдэл</TableHead>
                      <TableHead>Тулгалт</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {statementDetails.lines?.map((line: any) => (
                      <TableRow key={line.id}>
                        <TableCell>{line.date || "-"}</TableCell>
                        <TableCell>{line.description || "-"}</TableCell>
                        <TableCell className="text-right text-red-600">
                          {parseFloat(line.debit) > 0 ? formatMNT(line.debit) : "-"}
                        </TableCell>
                        <TableCell className="text-right text-green-600">
                          {parseFloat(line.credit) > 0 ? formatMNT(line.credit) : "-"}
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatMNT(line.balance)}
                        </TableCell>
                        <TableCell>
                          {line.reconciled ? (
                            <Badge className="bg-green-600">
                              <Check className="h-3 w-3 mr-1" />
                              Тулгасан
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Тулгаагүй</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Bank Account Dialog */}
      <Dialog open={isAddAccountOpen} onOpenChange={setIsAddAccountOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Банкны данс нэмэх</DialogTitle>
            <DialogDescription>
              Шинэ банкны данс нэмэх
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Банкны нэр *</Label>
              <Select value={newBankName} onValueChange={setNewBankName}>
                <SelectTrigger>
                  <SelectValue placeholder="Банк сонгох" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Хаан банк">Хаан банк</SelectItem>
                  <SelectItem value="Голомт банк">Голомт банк</SelectItem>
                  <SelectItem value="ХХБ">ХХБ</SelectItem>
                  <SelectItem value="Төрийн банк">Төрийн банк</SelectItem>
                  <SelectItem value="Худалдаа хөгжлийн банк">Худалдаа хөгжлийн банк</SelectItem>
                  <SelectItem value="Богд банк">Богд банк</SelectItem>
                  <SelectItem value="Капитрон банк">Капитрон банк</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Дансны дугаар *</Label>
              <Input
                placeholder="Жишээ: 5001234567"
                value={newAccountNumber}
                onChange={(e) => setNewAccountNumber(e.target.value)}
              />
            </div>
            <Button
              className="w-full"
              disabled={!newBankName || !newAccountNumber || createAccountMutation.isPending}
              onClick={() => createAccountMutation.mutate({ bankName: newBankName, accountNumber: newAccountNumber })}
            >

              {createAccountMutation.isPending ? "Үүсгэж байна..." : "Данс нэмэх"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

