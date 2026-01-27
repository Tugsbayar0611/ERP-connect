import { useState, useMemo } from "react";
import { useJournals } from "@/hooks/use-journals";
import { useAccounts } from "@/hooks/use-accounts";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import {
  Plus, Search, Edit, ShoppingCart, ShoppingBag, Building2,
  Banknote, FileText, ArrowRight, BookOpen, Layers
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

const journalTypeLabels: Record<string, string> = {
  sales: "Борлуулалт",
  purchase: "Худалдан авалт",
  bank: "Банк",
  cash: "Бэлэн мөнгө",
  general: "Ерөнхий",
};

// Type configs with icons and colors
const journalTypeConfig: Record<string, { icon: any; color: string; bgColor: string; borderColor: string }> = {
  sales: {
    icon: ShoppingCart,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
    borderColor: "border-t-blue-500"
  },
  purchase: {
    icon: ShoppingBag,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
    borderColor: "border-t-orange-500"
  },
  bank: {
    icon: Building2,
    color: "text-green-600",
    bgColor: "bg-green-50",
    borderColor: "border-t-green-500"
  },
  cash: {
    icon: Banknote,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
    borderColor: "border-t-purple-500"
  },
  general: {
    icon: FileText,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
    borderColor: "border-t-gray-500"
  },
};

const journalSchema = z.object({
  name: z.string().min(1, "Журналын нэр оруулна уу"),
  code: z.string().min(1, "Журналын код оруулна уу"),
  type: z.enum(["sales", "purchase", "bank", "cash", "general"]),
  defaultDebitAccountId: z.string().optional(),
  defaultCreditAccountId: z.string().optional(),
  isActive: z.boolean().default(true),
});

type JournalFormValues = z.infer<typeof journalSchema>;

export default function Journals() {
  const { journals = [], isLoading, createJournal } = useJournals();
  const { accounts = [] } = useAccounts();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingJournal, setEditingJournal] = useState<any | null>(null);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  // Fetch journal entries for stats
  const { data: journalEntries = [] } = useQuery({
    queryKey: ["/api/journal-entries"],
    queryFn: async () => {
      const res = await fetch("/api/journal-entries", { credentials: "include" });
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Count entries per journal
  const entryCountByJournal = useMemo(() => {
    const counts = new Map<string, number>();
    if (Array.isArray(journalEntries)) {
      journalEntries.forEach((entry: any) => {
        if (entry.journalId) {
          counts.set(entry.journalId, (counts.get(entry.journalId) || 0) + 1);
        }
      });
    }
    return counts;
  }, [journalEntries]);

  const form = useForm<JournalFormValues>({
    resolver: zodResolver(journalSchema),
    defaultValues: {
      name: "",
      code: "",
      type: "general",
      defaultDebitAccountId: undefined,
      defaultCreditAccountId: undefined,
      isActive: true,
    },
  });

  const filteredJournals = journals.filter((journal) => {
    const matchesSearch =
      !search ||
      journal.code?.toLowerCase().includes(search.toLowerCase()) ||
      journal.name?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || journal.type === typeFilter;
    return matchesSearch && matchesType;
  });

  // KPI Stats
  const kpiStats = useMemo(() => ({
    totalJournals: journals.length,
    activeJournals: journals.filter(j => j.isActive).length,
    totalEntries: Array.isArray(journalEntries) ? journalEntries.length : 0,
  }), [journals, journalEntries]);

  const onSubmit = async (data: JournalFormValues) => {
    try {
      await createJournal.mutateAsync({
        ...data,
        defaultDebitAccountId: data.defaultDebitAccountId || null,
        defaultCreditAccountId: data.defaultCreditAccountId || null,
      });
      toast({ title: "Амжилттай", description: "Журнал үүсгэгдлээ." });
      setIsCreateOpen(false);
      setEditingJournal(null);
      form.reset();
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Журнал үүсгэхэд алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const handleAdd = () => {
    setEditingJournal(null);
    form.reset({
      name: "",
      code: "",
      type: "general",
      defaultDebitAccountId: undefined,
      defaultCreditAccountId: undefined,
      isActive: true,
    });
    setIsCreateOpen(true);
  };

  const handleEdit = (journal: any) => {
    setEditingJournal(journal);
    form.reset({
      name: journal.name,
      code: journal.code,
      type: journal.type,
      defaultDebitAccountId: journal.defaultDebitAccountId || undefined,
      defaultCreditAccountId: journal.defaultCreditAccountId || undefined,
      isActive: journal.isActive,
    });
    setIsCreateOpen(true);
  };

  const getAccountLabel = (accountId?: string) => {
    if (!accountId) return null;
    const account = accounts.find((a) => a.id === accountId);
    return account ? `${account.code}` : null;
  };

  const handleViewEntries = (journalId: string) => {
    navigate(`/journal-entries?journalId=${journalId}`);
  };

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Журналууд
          </h2>
          <p className="text-muted-foreground mt-2">
            Санхүүгийн журналын тохиргоо
          </p>
        </div>
        <Button onClick={handleAdd} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Журнал нэмэх
        </Button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="shadow-sm border-l-4 border-l-blue-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Нийт журнал</CardTitle>
            <BookOpen className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{kpiStats.totalJournals}</div>
            <p className="text-xs text-muted-foreground">Бүртгэгдсэн журнал</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-green-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Идэвхтэй</CardTitle>
            <Layers className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{kpiStats.activeJournals}</div>
            <p className="text-xs text-muted-foreground">Ашиглагдаж буй</p>
          </CardContent>
        </Card>
        <Card className="shadow-sm border-l-4 border-l-purple-500">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Нийт бичилт</CardTitle>
            <FileText className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">{kpiStats.totalEntries}</div>
            <p className="text-xs text-muted-foreground">Журналын бичилтүүд</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Журналын код, нэрээр хайх..."
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
            <SelectItem value="sales">Борлуулалт</SelectItem>
            <SelectItem value="purchase">Худалдан авалт</SelectItem>
            <SelectItem value="bank">Банк</SelectItem>
            <SelectItem value="cash">Бэлэн мөнгө</SelectItem>
            <SelectItem value="general">Ерөнхий</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Journal Cards Grid */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-12">
          Журналууд ачааллаж байна...
        </div>
      ) : filteredJournals.length === 0 ? (
        <div className="text-center text-muted-foreground py-12">
          {search ? "Хайлтад тохирох журнал олдсонгүй." : "Журнал байхгүй байна."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredJournals.map((journal) => {
            const config = journalTypeConfig[journal.type] || journalTypeConfig.general;
            const IconComponent = config.icon;
            const entryCount = entryCountByJournal.get(journal.id) || 0;
            const debitAcc = getAccountLabel(journal.defaultDebitAccountId);
            const creditAcc = getAccountLabel(journal.defaultCreditAccountId);

            return (
              <Card
                key={journal.id}
                className={`shadow-sm border-t-4 ${config.borderColor} hover:shadow-md transition-shadow ${!journal.isActive ? 'opacity-60' : ''}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${config.bgColor}`}>
                        <IconComponent className={`h-5 w-5 ${config.color}`} />
                      </div>
                      <div>
                        <CardTitle className="text-lg">{journal.name}</CardTitle>
                        <p className="text-sm text-muted-foreground font-mono">{journal.code}</p>
                      </div>
                    </div>
                    <Badge variant={journal.isActive ? "default" : "outline"} className="text-xs">
                      {journal.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="pb-3">
                  <div className="flex items-center gap-2 mb-3">
                    <Badge variant="outline" className={config.color}>
                      {journalTypeLabels[journal.type]}
                    </Badge>
                    <span className="text-sm text-muted-foreground">
                      {entryCount} бичилт
                    </span>
                  </div>

                  {/* Default Accounts */}
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Үндсэн Дебет:</span>
                      {debitAcc ? (
                        <Badge variant="outline" className="font-mono text-xs bg-green-50 text-green-700">
                          {debitAcc}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">–</span>
                      )}
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Үндсэн Кредит:</span>
                      {creditAcc ? (
                        <Badge variant="outline" className="font-mono text-xs bg-red-50 text-red-700">
                          {creditAcc}
                        </Badge>
                      ) : (
                        <span className="text-gray-400">–</span>
                      )}
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="pt-0 gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleEdit(journal)}
                  >
                    <Edit className="h-3 w-3 mr-1" />
                    Засах
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleViewEntries(journal.id)}
                  >
                    Бичилтүүд
                    <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        setIsCreateOpen(open);
        if (!open) {
          form.reset();
          setEditingJournal(null);
        }
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingJournal ? "Журнал засах" : "Шинэ журнал үүсгэх"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="code"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Журналын код *</FormLabel>
                    <FormControl>
                      <Input placeholder="SJ" {...field} />
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
                    <FormLabel>Журналын нэр *</FormLabel>
                    <FormControl>
                      <Input placeholder="Борлуулалтын журнал" {...field} />
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
                        <SelectItem value="sales">🛒 Борлуулалт</SelectItem>
                        <SelectItem value="purchase">📦 Худалдан авалт</SelectItem>
                        <SelectItem value="bank">🏦 Банк</SelectItem>
                        <SelectItem value="cash">💵 Бэлэн мөнгө</SelectItem>
                        <SelectItem value="general">📄 Ерөнхий</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="defaultDebitAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Үндсэн Дебет данс</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Данс сонгох" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Сонгохгүй</SelectItem>
                        {accounts.map((acc) => (
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
                name="defaultCreditAccountId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Үндсэн Кредит данс</FormLabel>
                    <Select
                      onValueChange={(value) => field.onChange(value === "none" ? undefined : value)}
                      value={field.value || "none"}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Данс сонгох" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="none">Сонгохгүй</SelectItem>
                        {accounts.map((acc) => (
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
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsCreateOpen(false);
                    setEditingJournal(null);
                    form.reset();
                  }}
                >
                  Цуцлах
                </Button>
                <Button type="submit" disabled={createJournal.isPending}>
                  {createJournal.isPending ? "Хадгалагдаж байна..." : editingJournal ? "Хадгалах" : "Үүсгэх"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
