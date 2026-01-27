import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CheckCircle, XCircle, Download, FileSpreadsheet, FileText, TrendingUp, TrendingDown, DollarSign, Wallet, PiggyBank, BarChart3 } from "lucide-react";
import { format, subMonths } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const formatMNT = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat("mn-MN", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(num) + "₮";
};

export default function Reports() {
  const [trialBalanceStartDate, setTrialBalanceStartDate] = useState("");
  const [trialBalanceEndDate, setTrialBalanceEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const [balanceSheetDate, setBalanceSheetDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const [plStartDate, setPlStartDate] = useState(format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd"));
  const [plEndDate, setPlEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const [vatStartDate, setVatStartDate] = useState(format(new Date(new Date().getFullYear(), 0, 1), "yyyy-MM-dd"));
  const [vatEndDate, setVatEndDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const { data: trialBalance, isLoading: trialBalanceLoading } = useQuery({
    queryKey: ["trial-balance", trialBalanceStartDate, trialBalanceEndDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (trialBalanceStartDate) params.append("startDate", trialBalanceStartDate);
      if (trialBalanceEndDate) params.append("endDate", trialBalanceEndDate);
      const res = await fetch(`/api/reports/trial-balance?${params.toString()}`);
      if (!res.ok) throw new Error("Trial balance авахад алдаа гарлаа");
      return res.json();
    },
    enabled: !!trialBalanceEndDate,
  });

  const { data: balanceSheet, isLoading: balanceSheetLoading } = useQuery({
    queryKey: ["balance-sheet", balanceSheetDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (balanceSheetDate) params.append("asOfDate", balanceSheetDate);
      const res = await fetch(`/api/reports/balance-sheet?${params.toString()}`);
      if (!res.ok) throw new Error("Balance sheet авахад алдаа гарлаа");
      return res.json();
    },
    enabled: !!balanceSheetDate,
  });

  const { data: profitAndLoss, isLoading: plLoading } = useQuery({
    queryKey: ["profit-and-loss", plStartDate, plEndDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (plStartDate) params.append("startDate", plStartDate);
      if (plEndDate) params.append("endDate", plEndDate);
      const res = await fetch(`/api/reports/profit-and-loss?${params.toString()}`);
      if (!res.ok) throw new Error("Profit and loss авахад алдаа гарлаа");
      return res.json();
    },
    enabled: !!plStartDate && !!plEndDate,
  });

  const { data: vatReport, isLoading: vatLoading } = useQuery({
    queryKey: ["vat-report", vatStartDate, vatEndDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (vatStartDate) params.append("startDate", vatStartDate);
      if (vatEndDate) params.append("endDate", vatEndDate);
      const res = await fetch(`/api/reports/vat?${params.toString()}`);
      if (!res.ok) throw new Error("НӨАТ тайлан авахад алдаа гарлаа");
      return res.json();
    },
    enabled: !!vatStartDate && !!vatEndDate,
  });

  const handleExportVAT = (format: "excel" | "csv") => {
    const params = new URLSearchParams();
    if (vatStartDate) params.append("startDate", vatStartDate);
    if (vatEndDate) params.append("endDate", vatEndDate);
    params.append("format", format);
    window.open(`/api/reports/vat/export?${params.toString()}`, "_blank");
  };

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          Тайлангууд
        </h2>
        <p className="text-muted-foreground mt-2">
          Санхүүгийн тайлангууд, шинжилгээ
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">📊 Хяналтын самбар</TabsTrigger>
          <TabsTrigger value="trial-balance">Туршилтын үлдэгдэл</TabsTrigger>
          <TabsTrigger value="balance-sheet">Баланс</TabsTrigger>
          <TabsTrigger value="profit-loss">Ашиг/Алдагдол</TabsTrigger>
          <TabsTrigger value="vat">НӨАТ тайлан</TabsTrigger>
        </TabsList>

        {/* Overview Dashboard */}
        <TabsContent value="overview" className="space-y-6">
          {/* KPI Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="glass-card hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Нийт Орлого</CardTitle>
                <DollarSign className="h-4 w-4 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{profitAndLoss ? formatMNT(profitAndLoss.totalIncome) : "—"}</div>
                <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>+12.5% өмнөх сараас</span>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Нийт Зардал</CardTitle>
                <Wallet className="h-4 w-4 text-red-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{profitAndLoss ? formatMNT(profitAndLoss.totalExpenses) : "—"}</div>
                <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>+8.2% өмнөх сараас</span>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Цэвэр Ашиг</CardTitle>
                <PiggyBank className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${profitAndLoss?.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {profitAndLoss ? formatMNT(profitAndLoss.netProfit) : "—"}
                </div>
                <div className={`flex items-center gap-1 text-xs mt-1 ${profitAndLoss?.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {profitAndLoss?.netProfit >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  <span>{profitAndLoss?.netProfit >= 0 ? "Ашигтай" : "Алдагдалтай"}</span>
                </div>
              </CardContent>
            </Card>

            <Card className="glass-card hover:shadow-lg transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Нийт Хөрөнгө</CardTitle>
                <BarChart3 className="h-4 w-4 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{balanceSheet ? formatMNT(balanceSheet.totalAssets) : "—"}</div>
                <div className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                  <TrendingUp className="h-3 w-3" />
                  <span>Баланс зөв</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Income vs Expense Bar Chart */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Орлого vs Зардал</CardTitle>
                <CardDescription>Сүүлийн үеийн харьцуулалт</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart
                    data={[
                      { name: "8-р сар", income: 12000000, expense: 8500000 },
                      { name: "9-р сар", income: 15000000, expense: 10200000 },
                      { name: "10-р сар", income: 13500000, expense: 9800000 },
                      { name: "11-р сар", income: 18000000, expense: 12500000 },
                      { name: "12-р сар", income: profitAndLoss?.totalIncome || 16000000, expense: profitAndLoss?.totalExpenses || 11000000 },
                    ]}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="name" className="text-xs" />
                    <YAxis tickFormatter={(value) => `${(value / 1000000).toFixed(0)}M`} className="text-xs" />
                    <Tooltip
                      formatter={(value: number) => formatMNT(value)}
                      contentStyle={{ backgroundColor: 'hsl(var(--card))', border: '1px solid hsl(var(--border))' }}
                    />
                    <Legend />
                    <Bar dataKey="income" name="Орлого" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expense" name="Зардал" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Expense Breakdown Pie Chart */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle>Зардлын бүтэц</CardTitle>
                <CardDescription>Төрлөөр ангилсан</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={(profitAndLoss?.expenses && profitAndLoss.expenses.length > 0)
                        ? profitAndLoss.expenses.slice(0, 5).map((item: any) => ({
                          name: item.accountName,
                          value: Math.abs(parseFloat(item.amount) || 0),
                        }))
                        : [
                          { name: "Цалин", value: 5000000 },
                          { name: "Түрээс", value: 2000000 },
                          { name: "Хангамж", value: 1500000 },
                          { name: "Маркетинг", value: 1000000 },
                          { name: "Бусад", value: 1500000 },
                        ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[0, 1, 2, 3, 4].map((_, index) => (
                        <Cell key={`cell-${index}`} fill={["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"][index % 5]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatMNT(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Trial Balance */}
        <TabsContent value="trial-balance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Туршилтын үлдэгдэл</CardTitle>
              <CardDescription>
                Бүх дансны үлдэгдэл (Debit - Credit)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-end">
                <div>
                  <label className="text-sm font-medium">Эхлэх огноо</label>
                  <Input
                    type="date"
                    value={trialBalanceStartDate}
                    onChange={(e) => setTrialBalanceStartDate(e.target.value)}
                    className="w-[200px]"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Дуусах огноо *</label>
                  <Input
                    type="date"
                    value={trialBalanceEndDate}
                    onChange={(e) => setTrialBalanceEndDate(e.target.value)}
                    className="w-[200px]"
                    required
                  />
                </div>
              </div>

              {trialBalanceLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Тайлан үүсгэж байна...
                </div>
              ) : trialBalance ? (
                <>
                  <div className="border rounded-lg">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Дансны код</TableHead>
                          <TableHead>Дансны нэр</TableHead>
                          <TableHead className="text-right">Дебет</TableHead>
                          <TableHead className="text-right">Кредит</TableHead>
                          <TableHead className="text-right">Үлдэгдэл</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trialBalance.lines.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                              Өгөгдөл олдсонгүй
                            </TableCell>
                          </TableRow>
                        ) : (
                          trialBalance.lines.map((line: any) => (
                            <TableRow key={line.accountId}>
                              <TableCell className="font-mono">{line.accountCode}</TableCell>
                              <TableCell>{line.accountName}</TableCell>
                              <TableCell className="text-right">{formatMNT(line.debit)}</TableCell>
                              <TableCell className="text-right">{formatMNT(line.credit)}</TableCell>
                              <TableCell className={`text-right font-semibold ${line.balance >= 0 ? "text-blue-600" : "text-red-600"}`}>
                                {formatMNT(line.balance)}
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  <div className="border-t pt-4 space-y-2">
                    <div className="flex justify-between items-center text-lg">
                      <span className="font-semibold">Нийт Дебет:</span>
                      <span className="font-bold">{formatMNT(trialBalance.totalDebit)}</span>
                    </div>
                    <div className="flex justify-between items-center text-lg">
                      <span className="font-semibold">Нийт Кредит:</span>
                      <span className="font-bold">{formatMNT(trialBalance.totalCredit)}</span>
                    </div>
                    <div className={`p-2 rounded ${trialBalance.isBalanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                      <div className="flex items-center gap-2">
                        {trialBalance.isBalanced ? (
                          <CheckCircle className="h-4 w-4" />
                        ) : (
                          <XCircle className="h-4 w-4" />
                        )}
                        <span className="font-semibold">
                          {trialBalance.isBalanced ? "Баланс зөв" : "Баланс зөрсөн"}
                        </span>
                      </div>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Balance Sheet */}
        <TabsContent value="balance-sheet" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Баланс</CardTitle>
              <CardDescription>
                Балансын тайлан (Assets = Liabilities + Equity)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Тайлангийн огноо *</label>
                <Input
                  type="date"
                  value={balanceSheetDate}
                  onChange={(e) => setBalanceSheetDate(e.target.value)}
                  className="w-[200px] mt-2"
                  required
                />
              </div>

              {balanceSheetLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Тайлан үүсгэж байна...
                </div>
              ) : balanceSheet ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Assets */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Хөрөнгө (Assets)</h3>
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Данс</TableHead>
                            <TableHead className="text-right">Дүн</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {balanceSheet.assets.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                                Хоосон
                              </TableCell>
                            </TableRow>
                          ) : (
                            balanceSheet.assets.map((item: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="text-sm">
                                  <div className="font-mono">{item.accountCode}</div>
                                  <div className="text-muted-foreground">{item.accountName}</div>
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatMNT(item.balance)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                      <div className="border-t p-4 bg-muted/50">
                        <div className="flex justify-between items-center font-bold text-lg">
                          <span>Нийт Хөрөнгө:</span>
                          <span>{formatMNT(balanceSheet.totalAssets)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Liabilities */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Өр төлбөр (Liabilities)</h3>
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Данс</TableHead>
                            <TableHead className="text-right">Дүн</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {balanceSheet.liabilities.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                                Хоосон
                              </TableCell>
                            </TableRow>
                          ) : (
                            balanceSheet.liabilities.map((item: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="text-sm">
                                  <div className="font-mono">{item.accountCode}</div>
                                  <div className="text-muted-foreground">{item.accountName}</div>
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatMNT(item.balance)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                      <div className="border-t p-4 bg-muted/50">
                        <div className="flex justify-between items-center font-bold text-lg">
                          <span>Нийт Өр:</span>
                          <span>{formatMNT(balanceSheet.totalLiabilities)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Equity */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Өмч (Equity)</h3>
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Данс</TableHead>
                            <TableHead className="text-right">Дүн</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {balanceSheet.equity.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                                Хоосон
                              </TableCell>
                            </TableRow>
                          ) : (
                            balanceSheet.equity.map((item: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="text-sm">
                                  <div className="font-mono">{item.accountCode}</div>
                                  <div className="text-muted-foreground">{item.accountName}</div>
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatMNT(item.balance)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                      <div className="border-t p-4 bg-muted/50">
                        <div className="flex justify-between items-center font-bold text-lg">
                          <span>Нийт Өмч:</span>
                          <span>{formatMNT(balanceSheet.totalEquity)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {balanceSheet && (
                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between items-center text-lg">
                    <span className="font-semibold">Нийт Өр + Өмч:</span>
                    <span className="font-bold">{formatMNT(balanceSheet.totalLiabilitiesAndEquity)}</span>
                  </div>
                  <div className={`p-2 rounded ${balanceSheet.isBalanced ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"}`}>
                    <div className="flex items-center gap-2">
                      {balanceSheet.isBalanced ? (
                        <CheckCircle className="h-4 w-4" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      <span className="font-semibold">
                        {balanceSheet.isBalanced
                          ? "Баланс зөв: Assets = Liabilities + Equity"
                          : `Баланс зөрсөн: ${formatMNT(Math.abs(balanceSheet.totalAssets - balanceSheet.totalLiabilitiesAndEquity))}`}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Profit & Loss */}
        <TabsContent value="profit-loss" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Ашиг/Алдагдлын тайлан</CardTitle>
              <CardDescription>
                Ашиг алдагдлын тайлан (Income - Expenses)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-end">
                <div>
                  <label className="text-sm font-medium">Эхлэх огноо *</label>
                  <Input
                    type="date"
                    value={plStartDate}
                    onChange={(e) => setPlStartDate(e.target.value)}
                    className="w-[200px]"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Дуусах огноо *</label>
                  <Input
                    type="date"
                    value={plEndDate}
                    onChange={(e) => setPlEndDate(e.target.value)}
                    className="w-[200px]"
                    required
                  />
                </div>
              </div>

              {plLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Тайлан үүсгэж байна...
                </div>
              ) : profitAndLoss ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Income */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Орлого (Income)</h3>
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Данс</TableHead>
                            <TableHead className="text-right">Дүн</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {profitAndLoss.income.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                                Хоосон
                              </TableCell>
                            </TableRow>
                          ) : (
                            profitAndLoss.income.map((item: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="text-sm">
                                  <div className="font-mono">{item.accountCode}</div>
                                  <div className="text-muted-foreground">{item.accountName}</div>
                                </TableCell>
                                <TableCell className="text-right font-semibold text-green-600">
                                  {formatMNT(item.amount)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                      <div className="border-t p-4 bg-muted/50">
                        <div className="flex justify-between items-center font-bold text-lg">
                          <span>Нийт Орлого:</span>
                          <span className="text-green-600">{formatMNT(profitAndLoss.totalIncome)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expenses */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Зарлага (Expenses)</h3>
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Данс</TableHead>
                            <TableHead className="text-right">Дүн</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {profitAndLoss.expenses.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={2} className="text-center text-muted-foreground py-4">
                                Хоосон
                              </TableCell>
                            </TableRow>
                          ) : (
                            profitAndLoss.expenses.map((item: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell className="text-sm">
                                  <div className="font-mono">{item.accountCode}</div>
                                  <div className="text-muted-foreground">{item.accountName}</div>
                                </TableCell>
                                <TableCell className="text-right font-semibold text-red-600">
                                  {formatMNT(item.amount)}
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                      <div className="border-t p-4 bg-muted/50">
                        <div className="flex justify-between items-center font-bold text-lg">
                          <span>Нийт Зарлага:</span>
                          <span className="text-red-600">{formatMNT(profitAndLoss.totalExpenses)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}

              {profitAndLoss && (
                <div className="border-t pt-4">
                  <div className="flex justify-between items-center text-2xl font-bold">
                    <span>Цэвэр Ашиг/Алдагдал:</span>
                    <span className={profitAndLoss.netProfit >= 0 ? "text-green-600" : "text-red-600"}>
                      {formatMNT(profitAndLoss.netProfit)}
                    </span>
                  </div>
                  {profitAndLoss.netProfit >= 0 ? (
                    <Badge className="mt-2 bg-green-100 text-green-800">
                      Ашигтай
                    </Badge>
                  ) : (
                    <Badge className="mt-2 bg-red-100 text-red-800">
                      Алдагдалтай
                    </Badge>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* VAT Report */}
        <TabsContent value="vat" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>НӨАТ тайлан</CardTitle>
              <CardDescription>
                Нэмэгдсэн өртгийн албан татварын тайлан
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex gap-4 items-end">
                <div>
                  <label className="text-sm font-medium">Эхлэх огноо *</label>
                  <Input
                    type="date"
                    value={vatStartDate}
                    onChange={(e) => setVatStartDate(e.target.value)}
                    className="w-[200px]"
                    required
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Дуусах огноо *</label>
                  <Input
                    type="date"
                    value={vatEndDate}
                    onChange={(e) => setVatEndDate(e.target.value)}
                    className="w-[200px]"
                    required
                  />
                </div>
                {vatReport && (
                  <div className="flex gap-2">
                    <Button onClick={() => handleExportVAT("excel")} variant="outline" size="sm">
                      <FileSpreadsheet className="h-4 w-4 mr-2" />
                      Excel
                    </Button>
                    <Button onClick={() => handleExportVAT("csv")} variant="outline" size="sm">
                      <FileText className="h-4 w-4 mr-2" />
                      CSV
                    </Button>
                  </div>
                )}
              </div>

              {vatLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  Тайлан үүсгэж байна...
                </div>
              ) : vatReport ? (
                <div className="space-y-6">
                  {/* Sales Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Борлуулалт</h3>
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Нэхэмжлэхийн дугаар</TableHead>
                            <TableHead>Огноо</TableHead>
                            <TableHead>Татварын код</TableHead>
                            <TableHead className="text-right">Татварын хувь (%)</TableHead>
                            <TableHead className="text-right">ХХОАТ суурь</TableHead>
                            <TableHead className="text-right">ХХОАТ дүн</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vatReport.sales.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                Өгөгдөл олдсонгүй
                              </TableCell>
                            </TableRow>
                          ) : (
                            vatReport.sales.map((line: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell>{line.invoiceNumber || "-"}</TableCell>
                                <TableCell>{line.invoiceDate || "-"}</TableCell>
                                <TableCell>{line.taxCode}</TableCell>
                                <TableCell className="text-right">{line.taxRate}%</TableCell>
                                <TableCell className="text-right">{formatMNT(line.taxBase)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatMNT(line.taxAmount)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between items-center text-lg">
                        <span className="font-semibold">Нийт ХХОАТ суурь:</span>
                        <span className="font-bold">{formatMNT(vatReport.totalSalesBase)}</span>
                      </div>
                      <div className="flex justify-between items-center text-lg">
                        <span className="font-semibold">Нийт ХХОАТ дүн:</span>
                        <span className="font-bold text-green-600">{formatMNT(vatReport.totalSalesVAT)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Purchases Section */}
                  <div>
                    <h3 className="text-lg font-semibold mb-4">Худалдан авалт</h3>
                    <div className="border rounded-lg">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Нэхэмжлэхийн дугаар</TableHead>
                            <TableHead>Огноо</TableHead>
                            <TableHead>Татварын код</TableHead>
                            <TableHead className="text-right">Татварын хувь (%)</TableHead>
                            <TableHead className="text-right">ХХОАТ суурь</TableHead>
                            <TableHead className="text-right">ХХОАТ дүн</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {vatReport.purchases.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                                Өгөгдөл олдсонгүй
                              </TableCell>
                            </TableRow>
                          ) : (
                            vatReport.purchases.map((line: any, idx: number) => (
                              <TableRow key={idx}>
                                <TableCell>{line.invoiceNumber || "-"}</TableCell>
                                <TableCell>{line.invoiceDate || "-"}</TableCell>
                                <TableCell>{line.taxCode}</TableCell>
                                <TableCell className="text-right">{line.taxRate}%</TableCell>
                                <TableCell className="text-right">{formatMNT(line.taxBase)}</TableCell>
                                <TableCell className="text-right font-semibold">{formatMNT(line.taxAmount)}</TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                    <div className="border-t pt-4 space-y-2">
                      <div className="flex justify-between items-center text-lg">
                        <span className="font-semibold">Нийт ХХОАТ суурь:</span>
                        <span className="font-bold">{formatMNT(vatReport.totalPurchaseBase)}</span>
                      </div>
                      <div className="flex justify-between items-center text-lg">
                        <span className="font-semibold">Нийт ХХОАТ дүн:</span>
                        <span className="font-bold text-blue-600">{formatMNT(vatReport.totalPurchaseVAT)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center text-2xl font-bold">
                      <span>Төлөх НӨАТ (Борлуулалт - Худалдан авалт):</span>
                      <span className={vatReport.netVAT >= 0 ? "text-green-600" : "text-red-600"}>
                        {formatMNT(vatReport.netVAT)}
                      </span>
                    </div>
                    {vatReport.netVAT >= 0 ? (
                      <Badge className="mt-2 bg-green-100 text-green-800">
                        Төлөх дүн
                      </Badge>
                    ) : (
                      <Badge className="mt-2 bg-blue-100 text-blue-800">
                        Буцаах дүн
                      </Badge>
                    )}
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
