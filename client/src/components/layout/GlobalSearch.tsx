
import * as React from "react";
import {
    Calculator,
    Calendar,
    CreditCard,
    Settings,
    Smile,
    User,
    LayoutDashboard,
    BarChart3,
    Bell,
    Users,
    Building2,
    CalendarCheck,
    TrendingUp,
    AlertTriangle,
    MessageSquare,
    Package,
    Warehouse,
    ShoppingCart,
    ShoppingBag,
    UserCircle,
    Receipt,
    BookMarked,
    BookOpen,
    FileSpreadsheet,
    FileCheck,
    Banknote,
    FileText,
    History,
    Search
} from "lucide-react";

import {
    CommandDialog,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
    CommandSeparator,
    CommandShortcut,
} from "@/components/ui/command";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";

export function GlobalSearch() {
    const [open, setOpen] = React.useState(false);
    const [, setLocation] = useLocation();

    React.useEffect(() => {
        const down = (e: KeyboardEvent) => {
            if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                setOpen((open) => !open);
            }
        };

        document.addEventListener("keydown", down);
        return () => document.removeEventListener("keydown", down);
    }, []);

    const runCommand = React.useCallback((command: () => unknown) => {
        setOpen(false);
        command();
    }, []);

    return (
        <>
            <Button
                variant="outline"
                className="w-full justify-between text-muted-foreground bg-muted/20 hover:bg-muted/30 border-muted-foreground/20 hidden md:flex"
                onClick={() => setOpen(true)}
            >
                <span className="flex items-center gap-2">
                    <Search className="h-4 w-4" />
                    <span className="hidden lg:inline">Хайх...</span>
                    <span className="inline lg:hidden">Хайх</span>
                </span>
                <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </Button>

            <CommandDialog open={open} onOpenChange={setOpen}>
                <CommandInput placeholder="Модуль хайх (Жишээ нь: Нэхэмжлэх)..." />
                <CommandList>
                    <CommandEmpty>Үр дүн олдсонгүй.</CommandEmpty>

                    <CommandGroup heading="Санал болгож буй">
                        <CommandItem onSelect={() => runCommand(() => setLocation("/"))}>
                            <LayoutDashboard className="mr-2 h-4 w-4" />
                            <span>Хянах самбар</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/invoices?action=create"))}>
                            <Receipt className="mr-2 h-4 w-4" />
                            <span>Нэхэмжлэх үүсгэх</span>
                            <CommandShortcut>N</CommandShortcut>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/employees"))}>
                            <Users className="mr-2 h-4 w-4" />
                            <span>Ажилтнууд</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandSeparator />

                    <CommandGroup heading="Санхүү">
                        <CommandItem onSelect={() => runCommand(() => setLocation("/invoices"))}>
                            <Receipt className="mr-2 h-4 w-4" />
                            <span>Нэхэмжлэх</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/journals"))}>
                            <BookMarked className="mr-2 h-4 w-4" />
                            <span>Ерөнхий журнал (GL)</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/journal-entries"))}>
                            <BookOpen className="mr-2 h-4 w-4" />
                            <span>Журналын бичилт</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/accounts"))}>
                            <FileSpreadsheet className="mr-2 h-4 w-4" />
                            <span>Дансны төлөвлөгөө</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/tax-codes"))}>
                            <FileCheck className="mr-2 h-4 w-4" />
                            <span>Татварын тохиргоо</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/bank-statements"))}>
                            <Banknote className="mr-2 h-4 w-4" />
                            <span>Банкны хуулга</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandGroup heading="HR & Байгууллага">
                        <CommandItem onSelect={() => runCommand(() => setLocation("/employees"))}>
                            <Users className="mr-2 h-4 w-4" />
                            <span>Ажилтнууд</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/departments"))}>
                            <Building2 className="mr-2 h-4 w-4" />
                            <span>Хэлтсүүд</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/attendance"))}>
                            <CalendarCheck className="mr-2 h-4 w-4" />
                            <span>Ирц бүртгэл</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/payroll"))}>
                            <CreditCard className="mr-2 h-4 w-4" />
                            <span>Цалин</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/performance"))}>
                            <TrendingUp className="mr-2 h-4 w-4" />
                            <span>Гүйцэтгэл</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandGroup heading="Operation">
                        <CommandItem onSelect={() => runCommand(() => setLocation("/products"))}>
                            <Package className="mr-2 h-4 w-4" />
                            <span>Бараа материал</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/inventory"))}>
                            <Warehouse className="mr-2 h-4 w-4" />
                            <span>Агуулах</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/sales"))}>
                            <ShoppingCart className="mr-2 h-4 w-4" />
                            <span>Борлуулалт</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/purchase"))}>
                            <ShoppingBag className="mr-2 h-4 w-4" />
                            <span>Худалдан авалт</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/contacts"))}>
                            <UserCircle className="mr-2 h-4 w-4" />
                            <span>Харилцагчид</span>
                        </CommandItem>
                    </CommandGroup>

                    <CommandGroup heading="System">
                        <CommandItem onSelect={() => runCommand(() => setLocation("/documents"))}>
                            <FileText className="mr-2 h-4 w-4" />
                            <span>Баримтууд (File)</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/settings"))}>
                            <Settings className="mr-2 h-4 w-4" />
                            <span>Тохиргоо</span>
                        </CommandItem>
                        <CommandItem onSelect={() => runCommand(() => setLocation("/audit-logs"))}>
                            <History className="mr-2 h-4 w-4" />
                            <span>Хяналтын бүртгэл</span>
                        </CommandItem>
                    </CommandGroup>
                </CommandList>
            </CommandDialog>
        </>
    );
}
