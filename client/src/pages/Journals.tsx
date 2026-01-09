import { useState } from "react";
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
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Plus, Search } from "lucide-react";
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
  const { toast } = useToast();

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

  const onSubmit = async (data: JournalFormValues) => {
    try {
      await createJournal.mutateAsync({
        ...data,
        defaultDebitAccountId: data.defaultDebitAccountId || null,
        defaultCreditAccountId: data.defaultCreditAccountId || null,
      });
      toast({ title: "Амжилттай", description: "Журнал үүсгэгдлээ." });
      setIsCreateOpen(false);
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

  const getAccountLabel = (accountId?: string) => {
    if (!accountId) return "-";
    const account = accounts.find((a) => a.id === accountId);
    return account ? `${account.code} - ${account.name}` : "-";
  };

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Журналууд
          </h2>
          <p className="text-muted-foreground mt-2">
            Журналууд, санхүүгийн журналын бүртгэл
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Journal нэмэх
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
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

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Код</TableHead>
              <TableHead>Нэр</TableHead>
              <TableHead>Төрөл</TableHead>
              <TableHead>Үндсэн Дебет данс</TableHead>
              <TableHead>Үндсэн Кредит данс</TableHead>
              <TableHead>Төлөв</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Журналууд ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredJournals.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  {search ? "Хайлтад тохирох journal олдсонгүй." : "Journal байхгүй байна."}
                </TableCell>
              </TableRow>
            ) : (
              filteredJournals.map((journal) => (
                <TableRow key={journal.id}>
                  <TableCell className="font-mono font-semibold">{journal.code}</TableCell>
                  <TableCell className="font-medium">{journal.name}</TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {journalTypeLabels[journal.type] || journal.type}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getAccountLabel(journal.defaultDebitAccountId)}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getAccountLabel(journal.defaultCreditAccountId)}
                  </TableCell>
                  <TableCell>
                    <Badge variant={journal.isActive ? "default" : "outline"}>
                      {journal.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={(open) => {
        setIsCreateOpen(open);
        if (!open) form.reset();
      }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Шинэ журнал үүсгэх</DialogTitle>
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
                      <Input placeholder="SALES" {...field} />
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
                        <SelectItem value="sales">Борлуулалт</SelectItem>
                        <SelectItem value="purchase">Худалдан авалт</SelectItem>
                        <SelectItem value="bank">Банк</SelectItem>
                        <SelectItem value="cash">Бэлэн мөнгө</SelectItem>
                        <SelectItem value="general">Ерөнхий</SelectItem>
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
                          <SelectValue placeholder="Данс сонгох (сонгохгүй)" />
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
                          <SelectValue placeholder="Данс сонгох (сонгохгүй)" />
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
                    form.reset();
                  }}
                >
                  Цуцлах
                </Button>
                <Button type="submit" disabled={createJournal.isPending}>
                  {createJournal.isPending ? "Хадгалагдаж байна..." : "Үүсгэх"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
