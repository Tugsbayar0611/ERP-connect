import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Building2, Users, Shield, LogOut, Upload, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// Company schema
const companySchema = z.object({
  name: z.string().min(2, "Нэр хэт богино байна"),
  logo: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});
type CompanyForm = z.infer<typeof companySchema>;

// User create schema
const userSchema = z.object({
  email: z.string().email("Зөв имэйл оруулна уу"),
  password: z.string().min(6, "Нууц үг 6-аас багагүй тэмдэгттэй байх ёстой"),
  role: z.enum(["Admin", "User", "Manager"]),
});
type UserForm = z.infer<typeof userSchema>;

export default function Settings() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "Admin";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [companyLogoPreview, setCompanyLogoPreview] = useState<string | null>(null);

  // Company fetch
  const { data: company } = useQuery({
    queryKey: ["/api/company"],
    queryFn: async () => {
      const res = await fetch("/api/company");
      if (!res.ok) return { name: "Миний Байгууллага", logo: "", address: "", phone: "", email: "" };
      return res.json();
    },
  });

  // Users fetch (Admin only)
  const { data: users = [] } = useQuery({
    queryKey: ["/api/users"],
    enabled: isAdmin,
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) return [];
      return res.json();
    },
  });

  // Forms
  const companyForm = useForm<CompanyForm>({
    resolver: zodResolver(companySchema),
    defaultValues: { name: "", logo: "", address: "", phone: "", email: "" },
  });

  useEffect(() => {
    if (company) {
      companyForm.reset({
        name: company.name ?? "",
        logo: company.logo ?? "",
        address: company.address ?? "",
        phone: company.phone ?? "",
        email: company.email ?? "",
      });
    }
  }, [company]);

  const userForm = useForm<UserForm>({
    resolver: zodResolver(userSchema),
    defaultValues: { email: "", password: "", role: "User" },
  });

  const updateCompany = useMutation({
    mutationFn: async (data: CompanyForm) => {
      const res = await fetch("/api/company", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Хадгалахад алдаа гарлаа");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/company"] });
      toast({ title: "Амжилттай", description: "Байгууллагын мэдээлэл хадгалагдлаа." });
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e?.message ?? "Алдаа гарлаа" }),
  });

  const createUser = useMutation({
    mutationFn: async (data: UserForm) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Хэрэглэгч нэмэхэд алдаа гарлаа");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Амжилттай", description: "Шинэ хэрэглэгч нэмэгдлээ." });
      userForm.reset();
    },
    onError: (e: any) => toast({ title: "Алдаа", description: e?.message ?? "Алдаа гарлаа" }),
  });

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = String(reader.result ?? "");
      setCompanyLogoPreview(base64);
      companyForm.setValue("logo", base64);
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight font-display">Тохиргоо</h1>
        <p className="text-muted-foreground mt-2">Байгууллага болон хэрэглэгчийн тохиргоог удирдах</p>
      </div>

      {/* Current user */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Shield className="w-6 h-6 text-primary" />
            Одоогийн хэрэглэгч
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm text-muted-foreground">Имэйл</Label>
              <p className="font-medium">{user?.email || "-"}</p>
            </div>
            <div>
              <Label className="text-sm text-muted-foreground">Эрх</Label>
              <Badge variant={isAdmin ? "default" : "secondary"} className="mt-1">
                {isAdmin ? "Администратор" : "Хэрэглэгч"}
              </Badge>
            </div>
          </div>
          <Separator />
          <Button variant="outline" onClick={() => logout()}>
            <LogOut className="w-4 h-4 mr-2" />
            Гаргах
          </Button>
        </CardContent>
      </Card>

      {/* Company */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-3">
            <Building2 className="w-6 h-6 text-primary" />
            Байгууллагын мэдээлэл
          </CardTitle>
          <CardDescription>Нэр, лого, холбоо барих мэдээллийг засах</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={companyForm.handleSubmit((data) => updateCompany.mutate(data))} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Байгууллагын нэр</Label>
                <Input {...companyForm.register("name")} placeholder="Миний Байгууллага ХХК" />
              </div>

              <div className="space-y-2">
                <Label>Лого</Label>
                <div className="flex items-center gap-4">
                  {(companyLogoPreview || company?.logo) && (
                    <img
                      src={companyLogoPreview || company?.logo}
                      alt="Logo preview"
                      className="w-20 h-20 object-contain rounded-lg border"
                    />
                  )}
                  <label className="cursor-pointer">
                    <Input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                    <Button type="button" variant="outline" size="sm">
                      <Upload className="w-4 h-4 mr-2" />
                      Upload
                    </Button>
                  </label>
                </div>
                <p className="text-xs text-muted-foreground">
                  * Logo-г DB-д хадгалах бол schema дээр companies хүснэгтэнд logo column нэмэх хэрэгтэй.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Хаяг</Label>
                <Textarea {...companyForm.register("address")} placeholder="Улаанбаатар, Хан-Уул дүүрэг..." rows={3} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Утас</Label>
                  <Input {...companyForm.register("phone")} placeholder="9911-2233" />
                </div>
                <div className="space-y-2">
                  <Label>Имэйл</Label>
                  <Input {...companyForm.register("email")} type="email" placeholder="info@company.mn" />
                </div>
              </div>
            </div>

            <Button type="submit" disabled={updateCompany.isPending}>
              {updateCompany.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Хадгалах
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Users (Admin only) */}
      {isAdmin && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <Users className="w-6 h-6 text-primary" />
              Хэрэглэгч удирдах
            </CardTitle>
            <CardDescription>Шинэ хэрэглэгч нэмэх, эрх өгөх</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <form
              onSubmit={userForm.handleSubmit((data) => createUser.mutate(data))}
              className="space-y-4 p-4 border rounded-lg bg-muted/30"
            >
              <h4 className="font-medium">Шинэ хэрэглэгч нэмэх</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Имэйл</Label>
                  <Input {...userForm.register("email")} type="email" placeholder="user@company.mn" />
                </div>
                <div className="space-y-2">
                  <Label>Нууц үг</Label>
                  <Input {...userForm.register("password")} type="password" placeholder="••••••••" />
                </div>
                <div className="space-y-2">
                  <Label>Эрх</Label>
                  <select {...userForm.register("role")} className="w-full h-10 px-3 rounded-md border">
                    <option value="User">Хэрэглэгч</option>
                    <option value="Manager">Менежер</option>
                    <option value="Admin">Администратор</option>
                  </select>
                </div>
              </div>
              <Button type="submit" disabled={createUser.isPending}>
                {createUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Нэмэх
              </Button>
            </form>

            <div>
              <h4 className="font-medium mb-4">Одоогийн хэрэглэгчид</h4>
              <div className="space-y-3">
                {users.map((u: any) => (
                  <div key={u.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-medium">{u.email}</p>
                      <Badge variant={u.role === "Admin" ? "default" : "secondary"} className="mt-1">
                        {u.role === "Admin" ? "Администратор" : u.role === "Manager" ? "Менежер" : "Хэрэглэгч"}
                      </Badge>
                    </div>
                    <Button variant="ghost" size="sm">
                      Засах
                    </Button>
                  </div>
                ))}
                {users.length === 0 && <p className="text-sm text-muted-foreground">Хэрэглэгч олдсонгүй.</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
