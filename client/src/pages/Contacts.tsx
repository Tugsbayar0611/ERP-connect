import React, { useState, useMemo, useCallback } from "react";
import { useContacts } from "@/hooks/use-contacts";
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
import { Plus, Search, Pencil, Users, Download, Printer, Phone, Mail, MapPin, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EmptyState } from "@/components/empty-state";
import { useToast } from "@/hooks/use-toast";
import { useDebounce } from "@/hooks/use-debounce";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-shortcuts";
import { exportToCSV, formatNumberForCSV } from "@/lib/export-utils";
import { printTable } from "@/lib/print-utils";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  insertContactSchema,
  type Contact,
  type InsertContact,
} from "@shared/schema";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useLocation } from "wouter";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Helper to handle null values in form fields
const fieldValue = (value: string | null | undefined) => value ?? "";

const formatMNT = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(num) + '₮';
};

// Display name logic - fix "null null" issue
const getDisplayName = (contact: Contact): string => {
  // Priority 1: organizationName/companyName
  if (contact.companyName?.trim()) {
    return contact.companyName.trim();
  }

  // Priority 2: firstName + lastName (trimmed, no empty strings)
  const firstName = (contact.firstName || "").trim();
  const lastName = (contact.lastName || "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  if (fullName) {
    return fullName;
  }

  // Fallback
  return "Нэргүй харилцагч";
};

// Get avatar initials (2 letters) - premium fallback
const getAvatarInitials = (contact: Contact): string => {
  // Priority 1: organizationName
  if (contact.companyName?.trim()) {
    const words = contact.companyName.trim().split(/\s+/);
    if (words.length >= 2) {
      return (words[0][0] + words[1][0]).toUpperCase();
    }
    return contact.companyName.trim().substring(0, 2).toUpperCase();
  }

  // Priority 2: firstName + lastName
  const firstName = (contact.firstName || "").trim();
  const lastName = (contact.lastName || "").trim();

  if (firstName && lastName) {
    return (firstName[0] + lastName[0]).toUpperCase();
  }
  if (firstName) {
    return firstName.substring(0, 2).toUpperCase();
  }
  if (lastName) {
    return lastName.substring(0, 2).toUpperCase();
  }

  // Fallback: "NH" (Нэргүй Харилцагч)
  return "NH";
};

// Deterministic color based on contact.id hash
const getAvatarColor = (contactId: string): string => {
  const colors = [
    "bg-blue-500",
    "bg-purple-500",
    "bg-green-500",
    "bg-orange-500",
    "bg-pink-500",
    "bg-indigo-500",
    "bg-teal-500",
    "bg-red-500",
  ];

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < contactId.length; i++) {
    hash = contactId.charCodeAt(i) + ((hash << 5) - hash);
  }

  return colors[Math.abs(hash) % colors.length];
};

export default function Contacts() {
  const [location, setLocation] = useLocation();

  // Parse URL search params
  const searchParams = useMemo(() => {
    const params = new URLSearchParams(location.split("?")[1] || "");
    return {
      tab: params.get("tab") || "all",
      q: params.get("q") || "",
      status: params.get("status") || "all",
      location: params.get("location") || "all",
      type: params.get("type") || "all",
      tag: params.get("tag") || "all",
    };
  }, [location]);

  const [activeTab, setActiveTab] = useState<"all" | "customer" | "supplier">(
    searchParams.tab as any
  );
  const [statusFilter, setStatusFilter] = useState<string>(searchParams.status);
  const [locationFilter, setLocationFilter] = useState<string>(searchParams.location);
  const [typeFilter, setTypeFilter] = useState<string>(searchParams.type);
  const [tagFilter, setTagFilter] = useState<string>(searchParams.tag);

  const { contacts = [], isLoading, createContact, updateContact, deleteContact, bulkDeleteContacts } = useContacts(activeTab === "all" ? undefined : activeTab);
  const [search, setSearch] = useState(searchParams.q);
  const debouncedSearch = useDebounce(search, 300);
  const { toast } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

  // Bulk selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sync filters to URL params
  const updateFilters = useCallback((updates: Record<string, string>) => {
    const params = new URLSearchParams(location.split("?")[1] || "");
    Object.entries(updates).forEach(([key, value]) => {
      if (value === "all" || !value) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    const newSearch = params.toString();
    const newPath = newSearch ? `${location.split("?")[0]}?${newSearch}` : location.split("?")[0];
    setLocation(newPath, { replace: true });
  }, [location, setLocation]);

  // Update URL when filters change
  React.useEffect(() => {
    updateFilters({ q: debouncedSearch, tab: activeTab, status: statusFilter, location: locationFilter, type: typeFilter, tag: tagFilter });
  }, [debouncedSearch, activeTab, statusFilter, locationFilter, typeFilter, tagFilter, updateFilters]);

  const form = useForm<InsertContact>({
    resolver: zodResolver(insertContactSchema),
    defaultValues: {
      type: "customer",
      firstName: "",
      lastName: "",
      companyName: "",
      email: "",
      phone: "",
      mobile: "",
      address: "",
      city: "",
      district: "",
      isActive: true,
    },
  });

  const handleAdd = useCallback(() => {
    setSelectedContact(null);
    form.reset({
      type: activeTab === "supplier" ? "supplier" : "customer",
      firstName: "",
      lastName: "",
      companyName: "",
      email: "",
      phone: "",
      mobile: "",
      address: "",
      city: "",
      district: "",
      regNo: "",
      vatNo: "",
      bankName: "",
      bankAccount: "",
      creditLimit: "0",
      paymentTerms: "",
      isActive: true,
    });
    setIsEditOpen(true);
  }, [activeTab, form]);

  const handleEdit = useCallback((contact: Contact) => {
    setSelectedContact(contact);
    form.reset({
      type: contact.type as any,
      firstName: contact.firstName || "",
      lastName: contact.lastName || "",
      companyName: contact.companyName || "",
      email: contact.email || "",
      phone: contact.phone || "",
      mobile: contact.mobile || "",
      address: contact.address || "",
      city: contact.city || "",
      district: contact.district || "",
      regNo: contact.regNo || "",
      vatNo: contact.vatNo || "",
      bankName: contact.bankName || "",
      bankAccount: contact.bankAccount || "",
      creditLimit: contact.creditLimit || "0",
      paymentTerms: contact.paymentTerms || "",
      isActive: contact.isActive ?? true,
    });
    setIsEditOpen(true);
  }, [form]);

  const onSubmit = useCallback(async (data: InsertContact) => {
    try {
      if (selectedContact) {
        await updateContact.mutateAsync({ id: selectedContact.id, data });
        toast({ title: "Амжилттай", description: "Харилцагчийн мэдээлэл шинэчлэгдлээ.", variant: "success" });
      } else {
        await createContact.mutateAsync(data);
        toast({ title: "Амжилттай", description: "Шинэ харилцагч нэмэгдлээ.", variant: "success" });
      }
      setIsEditOpen(false);
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Хадгалахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  }, [selectedContact, createContact, updateContact, toast]);

  // Bulk selection handlers
  const toggleSelectAll = () => {
    if (selectedIds.size === filteredContacts.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredContacts.map(c => c.id)));
    }
  };

  const toggleSelectOne = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  const clearSelection = () => setSelectedIds(new Set());

  // Bulk delete handler
  const handleBulkDelete = async () => {
    if (!window.confirm(`${selectedIds.size} харилцагчийг устгах уу? Энэ үйлдлийг буцаах боломжгүй.`)) {
      return;
    }
    try {
      const result = await bulkDeleteContacts.mutateAsync(Array.from(selectedIds));
      toast({
        title: "Амжилттай",
        description: result.message || `${selectedIds.size} харилцагч устгагдлаа`,
        variant: "success",
      });
      clearSelection();
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  // Export selected contacts
  const handleBulkExport = () => {
    const selectedContacts = contacts.filter(c => selectedIds.has(c.id));

    const dataToExport = selectedContacts.map(c => ({
      type: getTypeLabel(c.type || "customer"),
      companyName: c.companyName || "",
      firstName: c.firstName || "",
      lastName: c.lastName || "",
      email: c.email || "",
      phone: c.phone || c.mobile || "",
      address: c.address || "",
      city: c.city || "",
      district: c.district || "",
      regNo: c.regNo || "",
      vatNo: c.vatNo || "",
      creditLimit: formatNumberForCSV(c.creditLimit),
      isActive: c.isActive ? "Идэвхтэй" : "Идэвхгүй",
    }));

    exportToCSV(
      dataToExport,
      [
        { key: "type", label: "Төрөл" },
        { key: "companyName", label: "Байгууллагын нэр" },
        { key: "firstName", label: "Нэр" },
        { key: "lastName", label: "Овог" },
        { key: "email", label: "Имэйл" },
        { key: "phone", label: "Утас" },
        { key: "address", label: "Хаяг" },
        { key: "city", label: "Хот" },
        { key: "district", label: "Дүүрэг" },
        { key: "regNo", label: "РД" },
        { key: "vatNo", label: "ХХОАТ" },
        { key: "creditLimit", label: "Зээлийн хязгаар (₮)" },
        { key: "isActive", label: "Төлөв" },
      ],
      `харилцагчид_${new Date().toISOString().split("T")[0]}.csv`
    );

    toast({
      title: "Амжилттай",
      description: `${selectedContacts.length} харилцагч экспортлогдлоо`,
      variant: "success",
    });
  };

  // Keyboard shortcuts for Contacts page
  useKeyboardShortcuts([
    {
      key: "k",
      ctrlKey: true,
      action: () => {
        const searchInput = document.querySelector('input[placeholder*="Хайх"], input[type="search"]') as HTMLInputElement;
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      },
      description: "Хайх талбарт шилжих",
    },
    {
      key: "n",
      ctrlKey: true,
      action: () => {
        if (!isEditOpen) {
          handleAdd();
        }
      },
      description: "Шинэ харилцагч нэмэх",
    },
    {
      key: "Escape",
      action: () => {
        if (isEditOpen) setIsEditOpen(false);
      },
      description: "Dialog хаах",
    },
  ]);

  // Get unique locations for filter
  const locations = useMemo(() => {
    const locs = new Set<string>();
    contacts.forEach((c) => {
      if (c.city) locs.add(c.city);
    });
    return Array.from(locs).sort();
  }, [contacts]);

  // Memoize filtered contacts to avoid recalculation on every render
  const filteredContacts = useMemo(() => {
    let filtered = contacts;

    // Search filter
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter((c) => {
        const displayName = getDisplayName(c).toLowerCase();
        return (
          displayName.includes(searchLower) ||
          c.email?.toLowerCase().includes(searchLower) ||
          c.phone?.toLowerCase().includes(searchLower) ||
          c.mobile?.toLowerCase().includes(searchLower)
        );
      });
    }

    // Status filter
    if (statusFilter !== "all") {
      filtered = filtered.filter((c) => {
        if (statusFilter === "active") return c.isActive && !hasMissingInfo(c);
        if (statusFilter === "inactive") return !c.isActive;
        if (statusFilter === "overdue") {
          // TODO: Check AR balance > 0 or overdue invoices
          // For now, just return false (can be enhanced later)
          return false;
        }
        if (statusFilter === "missing") return hasMissingInfo(c);
        return true;
      });
    }

    // Location filter
    if (locationFilter !== "all") {
      filtered = filtered.filter((c) => c.city === locationFilter);
    }

    // Type filter
    if (typeFilter !== "all") {
      filtered = filtered.filter((c) => {
        if (typeFilter === "both") return c.type === "both";
        return c.type === typeFilter;
      });
    }

    // Tag filter (placeholder - tags not in schema yet)
    // if (tagFilter !== "all") { ... }

    return filtered;
  }, [contacts, debouncedSearch, statusFilter, locationFilter, typeFilter, tagFilter]);

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "customer": return "Үйлчлүүлэгч";
      case "supplier": return "Нийлүүлэгч";
      case "both": return "Хоёулаа";
      default: return type;
    }
  };

  const getStatusBadge = (contact: Contact) => {
    // Check if missing info (no email, phone, or company)
    const hasEmail = !!contact.email?.trim();
    const hasPhone = !!(contact.phone?.trim() || contact.mobile?.trim());
    const hasCompany = !!contact.companyName?.trim();
    const hasName = !!(contact.firstName?.trim() || contact.lastName?.trim());
    const isMissingInfo = !hasEmail && !hasPhone && (!hasCompany && !hasName);

    // Check if overdue (AR balance > 0) - placeholder for now
    const isOverdue = false; // TODO: Calculate from invoices/payments

    if (isOverdue) {
      return { label: "Өртэй", variant: "destructive" as const };
    }
    if (isMissingInfo) {
      return { label: "Дутуу", variant: "secondary" as const };
    }
    if (contact.isActive) {
      return { label: "Идэвхтэй", variant: "default" as const };
    }
    return { label: "Идэвхгүй", variant: "secondary" as const };
  };

  // Check if contact has missing info for filter
  const hasMissingInfo = (contact: Contact): boolean => {
    const hasEmail = !!contact.email?.trim();
    const hasPhone = !!(contact.phone?.trim() || contact.mobile?.trim());
    const hasCompany = !!contact.companyName?.trim();
    const hasName = !!(contact.firstName?.trim() || contact.lastName?.trim());
    return !hasEmail && !hasPhone && (!hasCompany && !hasName);
  };

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Харилцагчид
          </h2>
          <p className="text-muted-foreground mt-2">
            Үйлчлүүлэгч, Борлуулагчийн мэдээлэл
          </p>
        </div>
        <Button onClick={handleAdd} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" />
          Харилцагч нэмэх
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Бүгд</TabsTrigger>
          <TabsTrigger value="customer">Үйлчлүүлэгчид</TabsTrigger>
          <TabsTrigger value="supplier">Нийлүүлэгчид</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filter Bar - Single toolbar with all controls */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Нэр, и-мэйл, утсаар хайх…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Төрөл" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүгд</SelectItem>
            <SelectItem value="customer">Үйлчлүүлэгч</SelectItem>
            <SelectItem value="supplier">Нийлүүлэгч</SelectItem>
            <SelectItem value="both">Хоёулаа</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Төлөв" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүгд</SelectItem>
            <SelectItem value="active">Идэвхтэй</SelectItem>
            <SelectItem value="inactive">Идэвхгүй</SelectItem>
            <SelectItem value="missing">Дутуу</SelectItem>
            <SelectItem value="overdue">Өртэй</SelectItem>
          </SelectContent>
        </Select>

        <Select value={locationFilter} onValueChange={setLocationFilter}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Байршил" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Бүгд</SelectItem>
            {locations.map((loc) => (
              <SelectItem key={loc} value={loc}>
                {loc}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 ml-auto">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              const headers = ["Төрөл", "Байгууллагын нэр", "Нэр", "Овог", "Имэйл", "Утас", "Хаяг", "РД", "ХХОАТ", "Зээлийн хязгаар (₮)", "Төлөв"];
              const rows = filteredContacts.map((c) => [
                getTypeLabel(c.type || "customer"),
                c.companyName || "-",
                c.firstName || "-",
                c.lastName || "-",
                c.email || "-",
                c.phone || c.mobile || "-",
                c.address || "-",
                c.regNo || "-",
                c.vatNo || "-",
                formatNumberForCSV(c.creditLimit) || "0",
                c.isActive ? "Идэвхтэй" : "Идэвхгүй",
              ]);

              printTable(
                "Харилцагчид",
                headers,
                rows,
                `Нийт: ${filteredContacts.length} харилцагч`
              );
            }}
          >
            <Printer className="w-4 h-4 mr-2" />
            Хэвлэх
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleBulkExport}
          >
            <Download className="w-4 h-4 mr-2" />
            CSV экспорт
          </Button>
        </div>
      </div>

      {/* Bulk Selection Header */}
      {selectedIds.size > 0 && (
        <div className="flex items-center justify-between p-3 bg-primary/10 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium">
            {selectedIds.size} харилцагч сонгогдсон
          </span>
          <div className="flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  Үйлдэл <span className="ml-1">▼</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleBulkDelete} className="text-destructive">
                  🗑️ Устгах
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleBulkExport}>
                  📤 Excel татах
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
            >
              Болих
            </Button>
          </div>
        </div>
      )}

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">
                <Checkbox
                  checked={selectedIds.size === filteredContacts.length && filteredContacts.length > 0}
                  onCheckedChange={toggleSelectAll}
                />
              </TableHead>
              <TableHead>Харилцагч</TableHead>
              <TableHead>Төрөл</TableHead>
              <TableHead>Имэйл</TableHead>
              <TableHead>Утас</TableHead>
              <TableHead>Байршил</TableHead>
              <TableHead>Зээлийн хязгаар</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead>Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Харилцагч ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="p-0">
                  <div className="py-8">
                    <EmptyState
                      icon={<Users className="w-12 h-12" />}
                      title={search ? "Хайлтад тохирох харилцагч олдсонгүй" : "Харилцагч бүртгэгдээгүй байна"}
                      description={
                        search
                          ? "Хайлтын нэр, компанийн нэр, эсвэл утасны дугаараар дахин оролдоно уу."
                          : "Эхний харилцагчаа нэмээд CRM системээ эхлүүлнэ үү."
                      }
                      action={
                        !search && (
                          <Button onClick={handleAdd} size="sm">
                            <Plus className="w-4 h-4 mr-2" />
                            Харилцагч нэмэх
                          </Button>
                        )
                      }
                    />
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              <TooltipProvider>
                {filteredContacts.map((contact) => {
                  const displayName = getDisplayName(contact);
                  const initials = getAvatarInitials(contact);
                  const avatarColor = getAvatarColor(contact.id);
                  const statusBadge = getStatusBadge(contact);
                  const phone = contact.phone || contact.mobile;
                  const email = contact.email;
                  const location = contact.city ? (contact.district ? `${contact.city}, ${contact.district}` : contact.city) : "-";

                  return (
                    <TableRow key={contact.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIds.has(contact.id)}
                          onCheckedChange={() => toggleSelectOne(contact.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <Avatar className={`${avatarColor} text-white`}>
                            <AvatarImage src={undefined} alt={displayName} />
                            <AvatarFallback className={avatarColor}>
                              {initials}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-medium">{displayName}</div>
                            {(email || phone) && (
                              <div className="text-xs text-muted-foreground">
                                {email && <span>{email}</span>}
                                {email && phone && <span className="mx-1">•</span>}
                                {phone && <span>{phone}</span>}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        {contact.type === "both" ? (
                          <div className="flex gap-1">
                            <Badge variant="default" className="bg-blue-500">Үйлчлүүлэгч</Badge>
                            <Badge variant="default" className="bg-purple-500">Нийлүүлэгч</Badge>
                          </div>
                        ) : (
                          <Badge variant={contact.type === "customer" ? "default" : "secondary"} className={contact.type === "customer" ? "bg-blue-500" : "bg-purple-500"}>
                            {getTypeLabel(contact.type || "customer")}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {email ? (
                          <a href={`mailto:${email}`} className="text-primary hover:underline">
                            {email}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {phone ? (
                          <a href={`tel:${phone}`} className="text-primary hover:underline">
                            {phone}
                          </a>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {location !== "-" ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span>{location}</span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-sm">УБ</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {contact.creditLimit && Number(contact.creditLimit) > 0
                          ? formatMNT(contact.creditLimit)
                          : <span className="text-muted-foreground text-sm">0₮</span>}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusBadge.variant}>
                          {statusBadge.label}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!phone}
                                asChild={!!phone}
                              >
                                {phone ? (
                                  <a href={`tel:${phone}`}>
                                    <Phone className="h-4 w-4" />
                                  </a>
                                ) : (
                                  <span>
                                    <Phone className="h-4 w-4" />
                                  </span>
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {phone ? "Утасдах" : "Утасны дугаар байхгүй"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                disabled={!email}
                                asChild={!!email}
                              >
                                {email ? (
                                  <a href={`mailto:${email}`}>
                                    <Mail className="h-4 w-4" />
                                  </a>
                                ) : (
                                  <span>
                                    <Mail className="h-4 w-4" />
                                  </span>
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                              {email ? "Имэйл илгээх" : "И-мэйл хаяг байхгүй"}
                            </TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(contact)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Засах</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  if (window.confirm("Энэ харилцагчийг устгах уу?")) {
                                    deleteContact.mutate(contact.id, {
                                      onSuccess: () => {
                                        toast({ title: "Амжилттай", description: "Харилцагч устгагдлаа", variant: "success" });
                                      },
                                      onError: (error: any) => {
                                        toast({ title: "Алдаа", description: error.message, variant: "destructive" });
                                      }
                                    });
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Устгах</TooltipContent>
                          </Tooltip>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TooltipProvider>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[95vw] sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedContact ? "Харилцагч засах" : "Шинэ харилцагч нэмэх"}
            </DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Төрөл *</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Төрөл сонгох" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="customer">Үйлчлүүлэгч</SelectItem>
                        <SelectItem value="supplier">Борлуулагч</SelectItem>
                        <SelectItem value="both">Хоёулаа</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Нэр</FormLabel>
                      <FormControl>
                        <Input placeholder="Нэр" {...field} value={fieldValue(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Овог</FormLabel>
                      <FormControl>
                        <Input placeholder="Овог" {...field} value={fieldValue(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="companyName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Байгууллагын нэр</FormLabel>
                    <FormControl>
                      <Input placeholder="Байгууллагын нэр" {...field} value={fieldValue(field.value)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Имэйл</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="email@example.com" {...field} value={fieldValue(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Утас</FormLabel>
                      <FormControl>
                        <Input placeholder="99112233" {...field} value={fieldValue(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="address"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Хаяг</FormLabel>
                    <FormControl>
                      <Textarea placeholder="Хаяг" {...field} value={fieldValue(field.value)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Хот</FormLabel>
                      <FormControl>
                        <Input placeholder="Улаанбаатар" {...field} value={fieldValue(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="district"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Дүүрэг</FormLabel>
                      <FormControl>
                        <Input placeholder="Дүүрэг" {...field} value={fieldValue(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Шуудангийн код</FormLabel>
                      <FormControl>
                        <Input placeholder="12345" {...field} value={fieldValue(field.value)} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="border-t pt-4">
                <h4 className="font-semibold mb-4">Монголын онцлог мэдээлэл</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="regNo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>РД (Регистр)</FormLabel>
                        <FormControl>
                          <Input placeholder="ИБ99061111" maxLength={10} {...field} value={fieldValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="vatNo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>ХХОАТ-ын дугаар</FormLabel>
                        <FormControl>
                          <Input placeholder="123456789" {...field} value={fieldValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <FormField
                    control={form.control}
                    name="bankName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Банкны нэр</FormLabel>
                        <FormControl>
                          <Input placeholder="Төрийн банк" {...field} value={fieldValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="bankAccount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Банкны данс</FormLabel>
                        <FormControl>
                          <Input placeholder="1234567890" {...field} value={fieldValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <FormField
                    control={form.control}
                    name="creditLimit"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Зээлийн хязгаар (₮)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="0" {...field} value={fieldValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="paymentTerms"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Төлбөрийн нөхцөл</FormLabel>
                        <FormControl>
                          <Input placeholder="30 өдөр" {...field} value={fieldValue(field.value)} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsEditOpen(false)}
                >
                  Цуцлах
                </Button>
                <Button type="submit" disabled={createContact.isPending || updateContact.isPending}>
                  {createContact.isPending || updateContact.isPending
                    ? "Хадгалагдаж байна..."
                    : selectedContact
                      ? "Хадгалах"
                      : "Нэмэх"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
