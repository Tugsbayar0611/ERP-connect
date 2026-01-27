import React, { useState, useMemo } from "react";
import { useAccounts } from "@/hooks/use-accounts";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";

import { useToast } from "@/hooks/use-toast";
import {
  Plus, Search, Edit, ChevronRight, ChevronDown,
  TrendingUp, TrendingDown, Wallet, Building2, DollarSign, Trash2
} from "lucide-react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const accountTypeLabels: Record<string, string> = {
  asset: "Хөрөнгө",
  liability: "Өр төлбөр",
  equity: "Өмч",
  income: "Орлого",
  expense: "Зарлага",
};

// Type badge colors
const getTypeBadge = (type: string) => {
  const styles: Record<string, string> = {
    asset: "bg-green-100 text-green-800 border-green-300",
    liability: "bg-red-100 text-red-800 border-red-300",
    equity: "bg-purple-100 text-purple-800 border-purple-300",
    income: "bg-blue-100 text-blue-800 border-blue-300",
    expense: "bg-orange-100 text-orange-800 border-orange-300",
  };
  return (
    <Badge variant="outline" className={styles[type] || ""}>
      {accountTypeLabels[type] || type}
    </Badge>
  );
};

// Format currency
const formatMNT = (value: number) => {
  return new Intl.NumberFormat("mn-MN", {
    style: "decimal",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value) + "₮";
};

const accountSchema = z.object({
  code: z.string().min(1, "Дансны код оруулна уу"),
  name: z.string().min(1, "Дансны нэр оруулна уу"),
  type: z.enum(["asset", "liability", "equity", "income", "expense"]),
  parentId: z.string().optional().or(z.literal("")),
  level: z.number().min(1).max(5).default(1),
  isActive: z.boolean().default(true),
});

type AccountFormValues = z.infer<typeof accountSchema>;

export default function Accounts() {
  const { accounts = [], isLoading, createAccount, updateAccount, deleteAccount } = useAccounts();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const [deletingAccount, setDeletingAccount] = useState<any | null>(null);
  const [expandedAccounts, setExpandedAccounts] = useState<Set<string>>(new Set());
  const { toast } = useToast();


  // Fetch trial balance for account balances
  const { data: trialBalance = [] } = useQuery({
    queryKey: ["/api/reports/trial-balance"],
    queryFn: async () => {
      const res = await fetch("/api/reports/trial-balance", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Create balance map from trial balance data
  const balanceMap = useMemo(() => {
    const map = new Map<string, number>();
    if (Array.isArray(trialBalance)) {
      trialBalance.forEach((item: any) => {
        const balance = parseFloat(item.debit || "0") - parseFloat(item.credit || "0");
        map.set(item.accountId, balance);
      });
    }
    return map;
  }, [trialBalance]);

  const form = useForm<AccountFormValues>({
    resolver: zodResolver(accountSchema),
    defaultValues: {
      code: "",
      name: "",
      type: "asset",
      parentId: undefined,
      level: 1,
      isActive: true,
    },
  });

  // Build tree structure for accounts
  const buildAccountTree = (accountsList: any[]) => {
    const accountMap = new Map(accountsList.map((acc) => [acc.id, { ...acc, children: [] }]));
    const roots: any[] = [];

    accountsList.forEach((acc) => {
      const account = accountMap.get(acc.id)!;
      if (acc.parentId && accountMap.has(acc.parentId)) {
        const parent = accountMap.get(acc.parentId)!;
        parent.children.push(account);
      } else {
        roots.push(account);
      }
    });

    // Sort by code
    const sortByCode = (arr: any[]) => {
      arr.sort((a, b) => a.code.localeCompare(b.code));
      arr.forEach((item) => {
        if (item.children?.length > 0) {
          sortByCode(item.children);
        }
      });
    };
    sortByCode(roots);

    return roots;
  };

  // Calculate balance including children
  const calculateBalance = (account: any): number => {
    let balance = balanceMap.get(account.id) || 0;
    if (account.children?.length > 0) {
      account.children.forEach((child: any) => {
        balance += calculateBalance(child);
      });
    }
    return balance;
  };

  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch = !search ||
      acc.code?.toLowerCase().includes(search.toLowerCase()) ||
      acc.name?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || acc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const accountTree = buildAccountTree(filteredAccounts);

  // KPI calculations
  const kpiStats = useMemo(() => {
    let totalAssets = 0;
    let totalLiabilities = 0;
    let totalIncome = 0;
    let totalExpenses = 0;

    const calculateTypeTotal = (tree: any[], type: string) => {
      let total = 0;
      tree.forEach((acc) => {
        if (acc.type === type) {
          total += calculateBalance(acc);
        }
      });
      return total;
    };

    totalAssets = calculateTypeTotal(accountTree, "asset");
    totalLiabilities = calculateTypeTotal(accountTree, "liability");
    totalIncome = calculateTypeTotal(accountTree, "income");
    totalExpenses = calculateTypeTotal(accountTree, "expense");

    return {
      totalAssets: Math.abs(totalAssets),
      totalLiabilities: Math.abs(totalLiabilities),
      netIncome: totalIncome - totalExpenses,
    };
  }, [accountTree, balanceMap]);

  // Toggle expand/collapse
  const toggleExpand = (accountId: string) => {
    setExpandedAccounts((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  // Expand all
  const expandAll = () => {
    const allIds = new Set<string>();
    const collectIds = (tree: any[]) => {
      tree.forEach((acc) => {
        if (acc.children?.length > 0) {
          allIds.add(acc.id);
          collectIds(acc.children);
        }
      });
    };
    collectIds(accountTree);
    setExpandedAccounts(allIds);
  };

  // Collapse all
  const collapseAll = () => {
    setExpandedAccounts(new Set());
  };

  const renderAccountRow = (account: any, depth: number = 0) => {
    const indent = depth * 24;
    const hasChildren = account.children && account.children.length > 0;
    const isExpanded = expandedAccounts.has(account.id);
    const balance = calculateBalance(account);
    const isParent = hasChildren || depth === 0;

    return (
      <React.Fragment key={account.id}>
        <TableRow className={`border-white/5 text-slate-200 hover:bg-white/5 transition ${isParent ? "bg-white/[0.02]" : ""}`}>
          <TableCell style={{ paddingLeft: `${indent + 16}px` }}>
            <div className="flex items-center gap-2">
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(account.id)}
                  className="p-0.5 hover:bg-white/10 rounded transition-colors text-slate-400"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
              ) : (
                <span className="w-5" />
              )}
              <span className={`font-mono ${isParent ? "font-bold text-slate-200" : "font-medium text-slate-300"}`}>
                {account.code}
              </span>
            </div>
          </TableCell>
          <TableCell className={isParent ? "font-semibold text-slate-200" : "font-medium text-slate-300"}>
            {account.name}
          </TableCell>
          <TableCell>{getTypeBadge(account.type)}</TableCell>
          <TableCell className="text-right font-mono">
            {balance !== 0 ? (
              <span className={balance >= 0 ? "text-emerald-400" : "text-red-400"}>
                {formatMNT(Math.abs(balance))}
              </span>
            ) : (
              <span className="text-slate-600">–</span>
            )}
          </TableCell>
          <TableCell>
            <Badge variant={account.isActive ? "default" : "outline"} className={account.isActive ? "bg-blue-500/10 text-blue-300 border-blue-500/20 hover:bg-blue-500/20" : "border-white/10 text-slate-400"}>
              {account.isActive ? "Идэвхтэй" : "Идэвхгүй"}
            </Badge>
          </TableCell>
          <TableCell>
            <div className="flex gap-1">
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-white/5 h-8 w-8 text-slate-400 hover:text-white"
                onClick={() => {
                  setEditingAccount(account);
                  form.reset({
                    code: account.code,
                    name: account.name,
                    type: account.type,
                    parentId: account.parentId || undefined,
                    level: account.level,
                    isActive: account.isActive,
                  });
                  setIsCreateOpen(true);
                }}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="hover:bg-red-500/10 text-slate-400 hover:text-red-400 h-8 w-8"
                onClick={() => setDeletingAccount(account)}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        {hasChildren && isExpanded && account.children.map((child: any) => renderAccountRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  const onSubmit = async (data: AccountFormValues) => {
    try {
      const submitData = {
        ...data,
        parentId: data.parentId === "none" || data.parentId === "" ? undefined : data.parentId,
      };

      if (editingAccount) {
        await updateAccount.mutateAsync({ id: editingAccount.id, data: submitData });
        toast({ title: "Амжилттай", description: "Данс шинэчлэгдлээ." });
      } else {
        await createAccount.mutateAsync(submitData);
        toast({ title: "Амжилттай", description: "Данс үүсгэгдлээ." });
      }
      setIsCreateOpen(false);
      setEditingAccount(null);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Данс үүсгэх/засахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const handleAdd = () => {
    setEditingAccount(null);
    form.reset({
      code: "",
      name: "",
      type: "asset",
      parentId: undefined,
      level: 1,
      isActive: true,
    });
    setIsCreateOpen(true);
  };

  const parentAccounts = accounts.filter((acc) => acc.type === form.watch("type") && acc.id !== editingAccount?.id);

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Дансны систем
          </h2>
          <p className="text-muted-foreground mt-2">
            Дансны мод, үлдэгдэл харах
          </p>
        </div>
        <Button onClick={handleAdd} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Данс нэмэх
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Нийт Хөрөнгө</CardTitle>
            <Wallet className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatMNT(kpiStats.totalAssets)}</div>
            <p className="text-xs text-muted-foreground">1xxx дансны нийлбэр</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-red-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Нийт Өр төлбөр</CardTitle>
            <Building2 className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatMNT(kpiStats.totalLiabilities)}</div>
            <p className="text-xs text-muted-foreground">2xxx дансны нийлбэр</p>
          </CardContent>
        </Card>
        <Card className={`shadow-sm border-l-4 ${kpiStats.netIncome >= 0 ? "border-l-blue-500" : "border-l-orange-500"}`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Цэвэр ашиг</CardTitle>
            {kpiStats.netIncome >= 0 ? (
              <TrendingUp className="h-4 w-4 text-blue-500" />
            ) : (
              <TrendingDown className="h-4 w-4 text-orange-500" />
            )}
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${kpiStats.netIncome >= 0 ? "text-blue-600" : "text-orange-600"}`}>
              {formatMNT(Math.abs(kpiStats.netIncome))}
            </div>
            <p className="text-xs text-muted-foreground">Орлого (4xxx) - Зардал (5xxx)</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Дансны код, нэрээр хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Төрөл" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүх төрөл</SelectItem>
            <SelectItem value="asset">Хөрөнгө</SelectItem>
            <SelectItem value="liability">Өр төлбөр</SelectItem>
            <SelectItem value="equity">Өмч</SelectItem>
            <SelectItem value="income">Орлого</SelectItem>
            <SelectItem value="expense">Зарлага</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={expandAll}>
            Бүгдийг задлах
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll}>
            Бүгдийг хураах
          </Button>
        </div>
      </div>

      {/* Glass Table Container */}
      <div className="rounded-2xl border border-white/10 bg-slate-900/40 backdrop-blur-xl overflow-hidden">
        <Table>
          <TableHeader className="bg-white/5">
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="w-[180px] text-slate-300">Дансны код</TableHead>
              <TableHead className="text-slate-300">Дансны нэр</TableHead>
              <TableHead className="w-[120px] text-slate-300">Төрөл</TableHead>
              <TableHead className="w-[150px] text-right text-slate-300">Үлдэгдэл</TableHead>
              <TableHead className="w-[100px] text-slate-300">Төлөв</TableHead>
              <TableHead className="w-[80px] text-slate-300">Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow className="hover:bg-transparent border-white/5">
                <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                  Дансууд ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredAccounts.length === 0 ? (
              <TableRow className="hover:bg-transparent border-white/5">
                <TableCell colSpan={6} className="text-center text-slate-400 py-8">
                  {search ? "Хайлтад тохирох данс олдсонгүй." : "Данс байхгүй байна."}
                </TableCell>
              </TableRow>
            ) : (
              accountTree.map((account) => renderAccountRow(account))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        setIsCreateOpen(open);
        if (!open) {
          setEditingAccount(null);
          form.reset();
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingAccount ? "Данс засах" : "Шинэ данс үүсгэх"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Дансны код *</FormLabel>
                    <FormControl>
                      <Input placeholder="1000" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Дансны нэр *</FormLabel>
                    <FormControl>
                      <Input placeholder="Бэлэн мөнгө" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Төрөл *</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Төрөл сонгох" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="asset">Хөрөнгө</SelectItem>
                        <SelectItem value="liability">Өр төлбөр</SelectItem>
                        <SelectItem value="equity">Өмч</SelectItem>
                        <SelectItem value="income">Орлого</SelectItem>
                        <SelectItem value="expense">Зарлага</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="parentId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Эцэг данс</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Эцэг данс сонгох (сонгохгүй)" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Эцэг дансгүй</SelectItem>
                        {parentAccounts.map((acc) => (
                          <SelectItem key={acc.id} value={acc.id}>
                            {acc.code} - {acc.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Түвшин</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={5}
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingAccount(null);
                    form.reset();
                  }}
                >
                  Цуцлах
                </Button>
                <Button type="submit" disabled={createAccount.isPending || updateAccount.isPending}>
                  {createAccount.isPending || updateAccount.isPending
                    ? "Хадгалагдаж байна..."
                    : editingAccount
                      ? "Хадгалах"
                      : "Үүсгэх"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deletingAccount} onOpenChange={(open) => !open && setDeletingAccount(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Данс устгах</AlertDialogTitle>
            <AlertDialogDescription>
              Та "{deletingAccount?.code} - {deletingAccount?.name}" дансыг устгахдаа итгэлтэй байна уу?
              <br /><br />
              <span className="text-red-600 font-medium">
                Анхаар: Гүйлгээ хийгдсэн дансыг устгах боломжгүй.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Цуцлах</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                try {
                  await deleteAccount.mutateAsync(deletingAccount.id);
                  toast({ title: "Амжилттай", description: "Данс устгагдлаа." });
                  setDeletingAccount(null);
                } catch (error: any) {
                  toast({
                    title: "Алдаа",
                    description: error.message || "Данс устгахад алдаа гарлаа",
                    variant: "destructive",
                  });
                }
              }}
            >
              {deleteAccount.isPending ? "Устгаж байна..." : "Устгах"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

}
