import React, { useState } from "react";
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
import { Plus, Search, Edit, Trash2 } from "lucide-react";
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
  const { accounts = [], isLoading, createAccount, updateAccount } = useAccounts();
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<any | null>(null);
  const { toast } = useToast();

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

    return roots;
  };

  const filteredAccounts = accounts.filter((acc) => {
    const matchesSearch = !search || 
      acc.code?.toLowerCase().includes(search.toLowerCase()) ||
      acc.name?.toLowerCase().includes(search.toLowerCase());
    const matchesType = typeFilter === "all" || acc.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const accountTree = buildAccountTree(filteredAccounts);

  const renderAccountRow = (account: any, depth: number = 0) => {
    const indent = depth * 24;
    return (
      <React.Fragment key={account.id}>
        <TableRow>
          <TableCell style={{ paddingLeft: `${indent + 16}px` }}>
            <div className="flex items-center gap-2">
              {account.children && account.children.length > 0 && (
                <span className="text-muted-foreground">└─</span>
              )}
              <span className="font-mono font-semibold">{account.code}</span>
            </div>
          </TableCell>
          <TableCell className="font-medium">{account.name}</TableCell>
          <TableCell>
            <Badge variant={account.type === "asset" ? "default" : "secondary"}>
              {accountTypeLabels[account.type] || account.type}
            </Badge>
          </TableCell>
          <TableCell>
            <Badge variant="outline">{account.level}</Badge>
          </TableCell>
          <TableCell>
            <Badge variant={account.isActive ? "default" : "outline"}>
              {account.isActive ? "Идэвхтэй" : "Идэвхгүй"}
            </Badge>
          </TableCell>
          <TableCell>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="sm"
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
                <Edit className="h-3 w-3" />
              </Button>
            </div>
          </TableCell>
        </TableRow>
        {account.children?.map((child: any) => renderAccountRow(child, depth + 1))}
      </React.Fragment>
    );
  };

  const onSubmit = async (data: AccountFormValues) => {
    try {
      // Convert "none" parentId to undefined
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

  // Get parent accounts for select
  const parentAccounts = accounts.filter((acc) => acc.type === form.watch("type") && acc.id !== editingAccount?.id);

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Дансны систем
          </h2>
          <p className="text-muted-foreground mt-2">
            Дансны систем, дансны бүтэц
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Данс нэмэх
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
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
      </div>

      {/* Table */}
      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дансны код</TableHead>
              <TableHead>Дансны нэр</TableHead>
              <TableHead>Төрөл</TableHead>
              <TableHead>Түвшин</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead>Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Дансууд ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredAccounts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
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
    </div>
  );
}
