import { useState } from "react";
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
import { Plus, Search, Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
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

// Helper to handle null values in form fields
const fieldValue = (value: string | null | undefined) => value ?? "";

const formatMNT = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(num) + '₮';
};

export default function Contacts() {
  const [activeTab, setActiveTab] = useState<"all" | "customer" | "supplier">("all");
  const { contacts = [], isLoading, createContact, updateContact } = useContacts(activeTab === "all" ? undefined : activeTab);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);

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

  const handleAdd = () => {
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
  };

  const handleEdit = (contact: Contact) => {
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
  };

  const onSubmit = async (data: InsertContact) => {
    try {
      if (selectedContact) {
        await updateContact.mutateAsync({ id: selectedContact.id, data });
        toast({ title: "Амжилттай", description: "Харилцагчийн мэдээлэл шинэчлэгдлээ." });
      } else {
        await createContact.mutateAsync(data);
        toast({ title: "Амжилттай", description: "Шинэ харилцагч нэмэгдлээ." });
      }
      setIsEditOpen(false);
    } catch (error: any) {
      toast({
        title: "Алдаа гарлаа",
        description: error.message || "Хадгалахад алдаа гарлаа",
        variant: "destructive",
      });
    }
  };

  const filteredContacts = contacts.filter((c) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      c.firstName?.toLowerCase().includes(searchLower) ||
      c.lastName?.toLowerCase().includes(searchLower) ||
      c.companyName?.toLowerCase().includes(searchLower) ||
      c.email?.toLowerCase().includes(searchLower) ||
      c.phone?.toLowerCase().includes(searchLower)
    );
  });

  const getTypeLabel = (type: string) => {
    switch (type) {
      case "customer": return "Үйлчлүүлэгч";
      case "supplier": return "Борлуулагч";
      case "both": return "Хоёулаа";
      default: return type;
    }
  };

  return (
    <div className="space-y-6 min-h-screen -m-4 md:-m-8 p-4 md:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Харилцагчид
          </h2>
          <p className="text-muted-foreground mt-2">
            Үйлчлүүлэгч, Борлуулагчийн мэдээлэл
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Харилцагч нэмэх
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="all">Бүгд</TabsTrigger>
          <TabsTrigger value="customer">Үйлчлүүлэгчид</TabsTrigger>
          <TabsTrigger value="supplier">Борлуулагчид</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Харилцагчаар хайх..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Нэр/Байгууллага</TableHead>
              <TableHead>Төрөл</TableHead>
              <TableHead>Имэйл</TableHead>
              <TableHead>Утас</TableHead>
              <TableHead>Хаяг</TableHead>
              <TableHead>Хувь хэмжээ</TableHead>
              <TableHead>Төлөв</TableHead>
              <TableHead>Үйлдэл</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Харилцагч ачааллаж байна...
                </TableCell>
              </TableRow>
            ) : filteredContacts.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  {search ? "Хайлтад тохирох харилцагч олдсонгүй." : "Харилцагч бүртгэгдээгүй байна."}
                </TableCell>
              </TableRow>
            ) : (
              filteredContacts.map((contact) => (
                <TableRow key={contact.id}>
                  <TableCell className="font-medium">
                    {contact.companyName || `${contact.firstName} ${contact.lastName}`.trim() || "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={contact.type === "customer" ? "default" : "secondary"}>
                      {getTypeLabel(contact.type || "customer")}
                    </Badge>
                  </TableCell>
                  <TableCell>{contact.email || "-"}</TableCell>
                  <TableCell>{contact.phone || contact.mobile || "-"}</TableCell>
                  <TableCell>{contact.address || "-"}</TableCell>
                  <TableCell>
                    {contact.creditLimit && Number(contact.creditLimit) > 0
                      ? formatMNT(contact.creditLimit)
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant={contact.isActive ? "default" : "secondary"}>
                      {contact.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(contact)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
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

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-2 gap-4">
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

              <div className="grid grid-cols-3 gap-4">
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
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="regNo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>РД (Регистр)</FormLabel>
                        <FormControl>
                          <Input placeholder="12345678" {...field} value={fieldValue(field.value)} />
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
