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
import { Building2, Users, Shield, LogOut, Upload, Loader2, X, QrCode, Eye, EyeOff, KeyRound, User, Receipt, MapPin, Navigation, Plus, PenTool, ChevronRight } from "lucide-react";
import { TwoFactorAuth } from "@/components/TwoFactorAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SettingsSidebar } from "@/components/settings/SettingsSidebar";
import { StickySaveBar } from "@/components/settings/StickySaveBar";
import { SignatureSettings } from "@/components/settings/SignatureSettings";
import { CompanySettings } from "@/components/settings/CompanySettings";
import { JobTitlesSettings } from "@/components/settings/JobTitlesSettings";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigationGuard } from "@/hooks/useNavigationGuard";
import { useToast } from "@/hooks/use-toast";
import { useRoles, useAssignRoleToUser, useRemoveRoleFromUser } from "@/hooks/use-roles";
import { UserRoleRow } from "@/components/UserRoleRow";
import { useQPaySettings } from "@/hooks/use-qpay";
import { useEBarimtSettings } from "@/hooks/use-ebarimt";
import { Switch } from "@/components/ui/switch";
import { RolesLayout } from "@/components/settings/roles/RolesLayout";
import { UsersManagement } from "@/components/settings/UsersManagement";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

// Company schema
const companySchema = z.object({
  name: z.string().min(2, "Нэр хэт богино байна"),
  legalName: z.string().optional(),
  regNo: z.string().optional(),
  vatNo: z.string().optional(),
  logo: z.string().optional(),
  address: z.string().optional(),
  district: z.string().optional(),
  city: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
});
type CompanyForm = z.infer<typeof companySchema>;

// User create schema
const userSchema = z.object({
  email: z.string().email("Зөв имэйл оруулна уу"),
  password: z.string()
    .min(8, "Нууц үг хамгийн багадаа 8 тэмдэгттэй байх ёстой")
    .regex(/[A-Z]/, "Дор хаяж 1 том үсэг агуулсан байх ёстой")
    .regex(/[a-z]/, "Дор хаяж 1 жижиг үсэг агуулсан байх ёстой")
    .regex(/[0-9]/, "Дор хаяж 1 тоо агуулсан байх ёстой")
    .regex(/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/, "Дор хаяж 1 тусгай тэмдэгт агуулсан байх ёстой"),
  role: z.enum(["Admin", "User", "Manager"]),
});
type UserForm = z.infer<typeof userSchema>;

// Change Password Schema
const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, "Хуучин нууц үг шаардлагатай"),
  newPassword: z.string().min(8, "Нууц үг хамгийн багадаа 8 тэмдэгттэй байх ёстой"),
  confirmPassword: z.string().min(1, "Нууц үг давтах шаардлагатай"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Нууц үг таарахгүй байна",
  path: ["confirmPassword"],
});

type ChangePasswordForm = z.infer<typeof changePasswordSchema>;

// Profile Schema
const profileSchema = z.object({
  fullName: z.string().min(2, "Нэр 2-оос багагүй байх ёстой").max(100, "Нэр хэт урт байна"),
  email: z.string().email("Зөв имэйл хаяг оруулна уу"),
});

type ProfileForm = z.infer<typeof profileSchema>;

function ProfileForm() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isUpdating, setIsUpdating] = useState(false);

  const form = useForm<ProfileForm>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      email: user?.email || "",
    },
  });

  // Update form when user data changes
  useEffect(() => {
    if (user) {
      form.reset({
        fullName: user.fullName || "",
        email: user.email || "",
      });
    }
  }, [user, form]);

  const onSubmit = async (data: ProfileForm) => {
    try {
      setIsUpdating(true);
      const res = await fetch("/api/auth/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Профайл засах амжилтгүй");
      }

      const updatedUser = await res.json();

      // Update query cache
      queryClient.setQueryData(["/api/auth/me"], updatedUser);

      toast({
        title: "Амжилттай",
        description: "Профайл амжилттай шинэчлэгдлээ",
      });
    } catch (err: any) {
      form.setError("root", { message: err.message || "Алдаа гарлаа" });
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <User className="w-6 h-6 text-primary" />
          Миний профайл
        </CardTitle>
        <CardDescription>Өөрийн мэдээллийг засах</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="fullName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Бүтэн нэр</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="Бүтэн нэрээ оруулна уу"
                      {...field}
                      className="h-12"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Имэйл</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="имэйл@жишээ.com"
                      {...field}
                      className="h-12"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                {form.formState.errors.root.message}
              </div>
            )}

            <Button type="submit" disabled={isUpdating}>
              {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Хадгалах
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function ChangePasswordForm() {
  const { toast } = useToast();
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChanging, setIsChanging] = useState(false);

  const form = useForm<ChangePasswordForm>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const onSubmit = async (data: ChangePasswordForm) => {
    try {
      setIsChanging(true);
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          oldPassword: data.oldPassword,
          newPassword: data.newPassword,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Нууц үг солих амжилтгүй");
      }

      toast({
        title: "Амжилттай",
        description: "Нууц үг амжилттай солигдлоо",
      });

      form.reset();
    } catch (err: any) {
      form.setError("root", { message: err.message || "Алдаа гарлаа" });
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <KeyRound className="w-6 h-6 text-primary" />
          Нууц үг солих
        </CardTitle>
        <CardDescription>Нууц үгээ шинэчлэхийн тулд хуучин нууц үгээ оруулна уу</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="oldPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Хуучин нууц үг</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showOldPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...field}
                        className="pr-12"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted"
                        onClick={() => setShowOldPassword(!showOldPassword)}
                      >
                        {showOldPassword ? (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="newPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Шинэ нууц үг</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showNewPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...field}
                        className="pr-12"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                      >
                        {showNewPassword ? (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                  <p className="text-xs text-muted-foreground">
                    Хамгийн багадаа 8 тэмдэгт, 1 том үсэг, 1 жижиг үсэг, 1 тоо, 1 тусгай тэмдэгт
                  </p>
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="confirmPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Шинэ нууц үг давтах</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showConfirmPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...field}
                        className="pr-12"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-muted"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <Eye className="w-4 h-4 text-muted-foreground" />
                        )}
                      </Button>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {form.formState.errors.root && (
              <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                {form.formState.errors.root.message}
              </div>
            )}

            <Button type="submit" disabled={isChanging}>
              {isChanging && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Нууц үг солих
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function QPaySettingsCard() {
  const { data: settings, isLoading, update, isUpdating } = useQPaySettings();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    enabled: false,
    mode: "sandbox" as "sandbox" | "production",
    clientId: "",
    clientSecret: "",
    invoiceCode: "",
    callbackSecret: "",
    autoPosting: false,
  });

  useEffect(() => {
    if (settings) {
      setFormData({
        enabled: settings.enabled || false,
        mode: settings.mode || "sandbox",
        clientId: settings.clientId || "",
        clientSecret: settings.clientSecret || "",
        invoiceCode: settings.invoiceCode || "",
        callbackSecret: settings.callbackSecret || "",
        autoPosting: settings.autoPosting || false,
      });
    }
  }, [settings]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    update(formData);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <QrCode className="w-6 h-6 text-primary" />
          QPay Тохиргоо
        </CardTitle>
        <CardDescription>QPay төлбөрийн системийн тохиргоо</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>QPay идэвхжүүлэх</Label>
              <p className="text-sm text-muted-foreground">QPay төлбөрийн системийг идэвхжүүлэх</p>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
          </div>

          {formData.enabled && (
            <>
              <div className="space-y-2">
                <Label>Режим</Label>
                <select
                  value={formData.mode}
                  onChange={(e) => setFormData({ ...formData, mode: e.target.value as "sandbox" | "production" })}
                  className="w-full h-10 px-3 rounded-md border"
                >
                  <option value="sandbox">Sandbox (Туршилт)</option>
                  <option value="production">Production (Бодит)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>Client ID</Label>
                <Input
                  value={formData.clientId}
                  onChange={(e) => setFormData({ ...formData, clientId: e.target.value })}
                  placeholder="QPay Client ID"
                />
              </div>

              <div className="space-y-2">
                <Label>Client Secret</Label>
                <Input
                  type="password"
                  value={formData.clientSecret}
                  onChange={(e) => setFormData({ ...formData, clientSecret: e.target.value })}
                  placeholder={settings?.clientSecret === "********" ? "********" : "QPay Client Secret"}
                />
                {settings?.clientSecret === "********" && (
                  <p className="text-xs text-muted-foreground">* Хуучин нууц үг хадгалагдсан. Шинэ нууц үг оруулахгүй бол өөрчлөхгүй.</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>Invoice Code</Label>
                <Input
                  value={formData.invoiceCode}
                  onChange={(e) => setFormData({ ...formData, invoiceCode: e.target.value })}
                  placeholder="QPay Invoice Code"
                />
              </div>

              <div className="space-y-2">
                <Label>Callback Secret</Label>
                <Input
                  type="password"
                  value={formData.callbackSecret}
                  onChange={(e) => setFormData({ ...formData, callbackSecret: e.target.value })}
                  placeholder={settings?.callbackSecret === "********" ? "********" : "Webhook Callback Secret"}
                />
                {settings?.callbackSecret === "********" && (
                  <p className="text-xs text-muted-foreground">* Хуучин нууц үг хадгалагдсан. Шинэ нууц үг оруулахгүй бол өөрчлөхгүй.</p>
                )}
              </div>

              {settings?.webhookUrl && (
                <div className="space-y-2">
                  <Label>Webhook URL</Label>
                  <div className="flex gap-2">
                    <Input value={settings.webhookUrl} readOnly className="bg-muted" />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        navigator.clipboard.writeText(settings.webhookUrl || "");
                        toast({ title: "Хуулагдлаа", description: "Webhook URL хуулагдлаа." });
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">Энэ URL-ийг QPay dashboard дээр тохируулна уу.</p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div>
                  <Label>Автомат бичилт</Label>
                  <p className="text-sm text-muted-foreground">Төлбөр ирэхэд автоматаар журналын бичилт үүсгэх</p>
                </div>
                <Switch
                  checked={formData.autoPosting}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoPosting: checked })}
                />
              </div>
            </>
          )}

          <Button type="submit" disabled={isUpdating || !formData.enabled}>
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Хадгалах
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function EBarimtSettingsCard() {
  const { data: settings, isLoading, update, isUpdating } = useEBarimtSettings();
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    enabled: false,
    mode: "sandbox" as "sandbox" | "production",
    posEndpoint: "",
    apiKey: "",
    apiSecret: "",
    autoSend: false,
  });
  const [endpointError, setEndpointError] = useState<string | null>(null);

  useEffect(() => {
    if (settings) {
      setFormData({
        enabled: settings.enabled || false,
        mode: settings.mode || "sandbox",
        posEndpoint: settings.posEndpoint || "",
        apiKey: settings.apiKey || "",
        apiSecret: settings.apiSecret || "",
        autoSend: settings.autoSend || false,
      });
    }
  }, [settings]);

  const validateEndpoint = (value: string) => {
    if (!value) {
      setEndpointError(null);
      return true;
    }
    const isValid = value.startsWith("http://") || value.startsWith("https://");
    setEndpointError(isValid ? null : "pos_endpoint нь http:// эсвэл https://-ээр эхлэх ёстой.");
    return isValid;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateEndpoint(formData.posEndpoint)) {
      toast({
        title: "Алдаа",
        description: "API Endpoint талбарыг зөв форматтай оруулна уу.",
        variant: "destructive",
      });
      return;
    }
    update(formData);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Receipt className="w-6 h-6 text-primary" />
          E-barimt Тохиргоо
        </CardTitle>
        <CardDescription>И-баримтын PosAPI 3.0 тохиргоо</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>E-barimt идэвхжүүлэх</Label>
              <p className="text-sm text-muted-foreground">И-баримтын интеграцийг идэвхжүүлэх</p>
            </div>
            <Switch
              checked={formData.enabled}
              onCheckedChange={(checked) => setFormData({ ...formData, enabled: checked })}
            />
          </div>

          {formData.enabled && (
            <>
              <div className="space-y-2">
                <Label>Режим</Label>
                <select
                  value={formData.mode}
                  onChange={(e) => setFormData({ ...formData, mode: e.target.value as "sandbox" | "production" })}
                  className="w-full h-10 px-3 rounded-md border"
                >
                  <option value="sandbox">Sandbox (Туршилт)</option>
                  <option value="production">Production (Бодит)</option>
                </select>
              </div>

              <div className="space-y-2">
                <Label>API Endpoint (pos_endpoint)</Label>
                <Input
                  value={formData.posEndpoint}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFormData({ ...formData, posEndpoint: value });
                    validateEndpoint(value);
                  }}
                  placeholder="https://api.ebarimt.mn/api/v3"
                />
                {endpointError && (
                  <p className="text-xs text-destructive">{endpointError}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  value={formData.apiKey}
                  onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
                  placeholder="E-barimt API Key"
                />
              </div>

              <div className="space-y-2">
                <Label>API Secret</Label>
                <Input
                  type="password"
                  value={formData.apiSecret}
                  onChange={(e) => setFormData({ ...formData, apiSecret: e.target.value })}
                  placeholder={settings?.apiSecret === "********" ? "********" : "E-barimt API Secret"}
                />
                {settings?.apiSecret === "********" && (
                  <p className="text-xs text-muted-foreground">
                    * Хуучин нууц үг хадгалагдсан. Шинэ нууц үг оруулахгүй бол өөрчлөхгүй.
                  </p>
                )}
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label>Автоматаар илгээх</Label>
                  <p className="text-sm text-muted-foreground">
                    Төлбөр ормогц нэхэмжлэлийг И-баримт руу автоматаар илгээх
                  </p>
                </div>
                <Switch
                  checked={formData.autoSend}
                  onCheckedChange={(checked) => setFormData({ ...formData, autoSend: checked })}
                />
              </div>
            </>
          )}

          <Button type="submit" disabled={isUpdating || !formData.enabled}>
            {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Хадгалах
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}



// Branch Settings Component
function BranchSettingsCard() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isLoading, setIsLoading] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);

  // Fetch branches
  const { data: branches = [], isLoading: branchesLoading } = useQuery<any[]>({
    queryKey: ["/api/branches"],
    queryFn: async () => {
      const res = await fetch("/api/branches");
      if (!res.ok) throw new Error("Failed to fetch branches");
      return res.json();
    },
  });

  // Get current location from browser
  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Боломжгүй",
        description: "Таны төхөөрөмж газрын зургийг дэмжихгүй байна.",
        variant: "destructive",
      });
      return;
    }

    setIsGettingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
        setIsGettingLocation(false);
        toast({
          title: "Амжилттай",
          description: `Байршлыг олсон: ${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`,
        });
      },
      (error) => {
        setIsGettingLocation(false);
        toast({
          title: "Боломжгүй",
          description: error.message || "Байршлыг олох боломжгүй байна.",
          variant: "destructive",
        });
      }
    );
  };

  // Create or update branch
  const saveBranchLocation = async (branchId: string | undefined, formData: any) => {
    setIsUpdating(true);
    try {
      if (branchId) {
        // Update existing branch
        const res = await fetch(`/api/branches/${branchId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Хадгалахад алдаа гарлаа");
        }
      } else {
        // Create new branch
        const res = await fetch("/api/branches", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(formData),
        });
        if (!res.ok) {
          const errorData = await res.json();
          throw new Error(errorData.message || "Үүсгэхэд алдаа гарлаа");
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/branches"] });
      toast({
        title: "Амжилттай",
        description: "Оффисын байршлыг амжилттай хадгаллаа.",
      });
    } catch (error: any) {
      toast({
        title: "Алдаа",
        description: error.message || "Хадгалахад алдаа гарлаа",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  if (branchesLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Ачааллаж байна...</p>
        </CardContent>
      </Card>
    );
  }

  const hqBranch = branches.find((b: any) => b.isHq) || branches[0] || null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <MapPin className="w-6 h-6 text-primary" />
          Оффисын байршлын тохиргоо
        </CardTitle>
        <CardDescription>Геофенсинг (GPS check-in) ашиглахын тулд оффисын координат оруулна уу</CardDescription>
      </CardHeader>
      <CardContent>
        <BranchLocationForm
          branch={hqBranch}
          currentLocation={currentLocation}
          isGettingLocation={isGettingLocation}
          onGetLocation={getCurrentLocation}
          onSave={saveBranchLocation}
          isUpdating={isUpdating}
        />
      </CardContent>
    </Card>
  );
}

// Branch Location Form Component
function BranchLocationForm({
  branch,
  currentLocation,
  isGettingLocation,
  onGetLocation,
  onSave,
  isUpdating,
}: {
  branch: any;
  currentLocation: { lat: number; lon: number } | null;
  isGettingLocation: boolean;
  onGetLocation: () => void;
  onSave: (branchId: string | undefined, data: any) => Promise<void>;
  isUpdating: boolean;
}) {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: branch?.name || "Гол оффис",
    address: branch?.address || "",
    latitude: branch?.latitude || "",
    longitude: branch?.longitude || "",
    geofenceRadius: branch?.geofenceRadius || 100,
    wifiSsids: branch?.officeWifiSsid || [],
    wifiSsidInput: "",
  });

  useEffect(() => {
    if (branch) {
      setFormData({
        name: branch.name || "Гол оффис",
        address: branch.address || "",
        latitude: branch.latitude || "",
        longitude: branch.longitude || "",
        geofenceRadius: branch.geofenceRadius || 100,
        wifiSsids: branch.officeWifiSsid || [],
        wifiSsidInput: "",
      });
    }
  }, [branch]);

  // Use current location when available
  useEffect(() => {
    if (currentLocation) {
      setFormData((prev) => ({
        ...prev,
        latitude: currentLocation.lat.toString(),
        longitude: currentLocation.lon.toString(),
      }));
    }
  }, [currentLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate
    if (!formData.latitude || !formData.longitude) {
      toast({
        title: "Алдаа",
        description: "Latitude болон Longitude оруулах шаардлагатай.",
        variant: "destructive",
      });
      return;
    }

    const lat = parseFloat(formData.latitude);
    const lon = parseFloat(formData.longitude);

    if (isNaN(lat) || isNaN(lon)) {
      toast({
        title: "Алдаа",
        description: "Latitude болон Longitude нь тоо байх ёстой.",
        variant: "destructive",
      });
      return;
    }

    if (lat < -90 || lat > 90) {
      toast({
        title: "Алдаа",
        description: "Latitude нь -90 ба 90 хооронд байх ёстой.",
        variant: "destructive",
      });
      return;
    }

    if (lon < -180 || lon > 180) {
      toast({
        title: "Алдаа",
        description: "Longitude нь -180 ба 180 хооронд байх ёстой.",
        variant: "destructive",
      });
      return;
    }

    await onSave(branch?.id, {
      name: formData.name,
      address: formData.address,
      latitude: lat.toString(),
      longitude: lon.toString(),
      geofenceRadius: formData.geofenceRadius,
      officeWifiSsid: formData.wifiSsids && formData.wifiSsids.length > 0 ? formData.wifiSsids : null,
      isHq: true,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <Label>Оффисын нэр</Label>
        <Input
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          placeholder="Гол оффис"
        />
      </div>

      <div className="space-y-2">
        <Label>Хаяг</Label>
        <Input
          value={formData.address}
          onChange={(e) => setFormData({ ...formData, address: e.target.value })}
          placeholder="Жишээ: Сүхбаатар дүүрэг, Сүхбаатарын талбай 1"
        />
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Координат (GPS)</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onGetLocation}
            disabled={isGettingLocation}
          >
            {isGettingLocation ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Олж байна...
              </>
            ) : (
              <>
                <Navigation className="w-4 h-4 mr-2" />
                Одоогийн байршлыг авах
              </>
            )}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Latitude (Өргөрөг)</Label>
            <Input
              type="number"
              step="any"
              value={formData.latitude}
              onChange={(e) => setFormData({ ...formData, latitude: e.target.value })}
              placeholder="47.9197"
            />
            <p className="text-xs text-muted-foreground">Жишээ: 47.9197 (Улаанбаатар)</p>
          </div>

          <div className="space-y-2">
            <Label>Longitude (Уртраг)</Label>
            <Input
              type="number"
              step="any"
              value={formData.longitude}
              onChange={(e) => setFormData({ ...formData, longitude: e.target.value })}
              placeholder="106.9172"
            />
            <p className="text-xs text-muted-foreground">Жишээ: 106.9172 (Улаанбаатар)</p>
          </div>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Геофенсийн радиус (метр)</Label>
        <Input
          type="number"
          min="10"
          max="1000"
          value={formData.geofenceRadius}
          onChange={(e) => setFormData({ ...formData, geofenceRadius: parseInt(e.target.value) || 100 })}
        />
        <p className="text-xs text-muted-foreground">
          Ирц өгөхөд хэрэглэгдэх радиус. Жишээ: 100 метр = оффисын 100 метр радиуст байвал check-in хийх боломжтой
        </p>
      </div>

      <div className="space-y-2">
        <Label>Оффисын WiFi SSID (Сонголттой)</Label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <Input
              placeholder="Жишээ: Office-WiFi-5G"
              value={formData.wifiSsidInput || ""}
              onChange={(e) => setFormData({ ...formData, wifiSsidInput: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === "Enter" && formData.wifiSsidInput?.trim()) {
                  e.preventDefault();
                  const newSsid = formData.wifiSsidInput.trim();
                  if (!formData.wifiSsids?.includes(newSsid)) {
                    setFormData({
                      ...formData,
                      wifiSsids: [...(formData.wifiSsids || []), newSsid],
                      wifiSsidInput: "",
                    });
                  }
                }
              }}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                if (formData.wifiSsidInput?.trim()) {
                  const newSsid = formData.wifiSsidInput.trim();
                  if (!formData.wifiSsids?.includes(newSsid)) {
                    setFormData({
                      ...formData,
                      wifiSsids: [...(formData.wifiSsids || []), newSsid],
                      wifiSsidInput: "",
                    });
                  }
                }
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          {formData.wifiSsids && formData.wifiSsids.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.wifiSsids.map((ssid: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="flex items-center gap-1">
                  {ssid}
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({
                        ...formData,
                        wifiSsids: formData.wifiSsids?.filter((_: string, i: number) => i !== idx),
                      });
                    }}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Оффисын WiFi сүлжээний нэрүүд. Ирц өгөх үед WiFi шалгах боломжтой (Mobile app дээр илүү найдвартай).
          <br />
          <span className="text-orange-600 dark:text-orange-400">
            ⚠️ Web browser дээр WiFi SSID шууд харах боломжгүй (security шалтгаанаар). Mobile app эсвэл backend IP validation ашиглана.
          </span>
        </p>
      </div>

      {formData.latitude && formData.longitude && (
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium mb-2">Байршлын урьдчилсан харагдац:</p>
          <a
            href={`https://www.google.com/maps?q=${formData.latitude},${formData.longitude}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline text-sm"
          >
            Google Maps дээр харах →
          </a>
        </div>
      )}

      <Button type="submit" disabled={isUpdating}>
        {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Хадгалах
      </Button>
    </form>
  );
}

export default function Settings() {
  const { user, logout } = useAuth();
  const isAdmin = user?.role === "Admin";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // RBAC hooks
  const { roles = [] } = useRoles();
  const assignRole = useAssignRoleToUser();
  const removeRole = useRemoveRoleFromUser();

  // Sidebar navigation state
  const [activeTab, setActiveTabState] = useState("profile");
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [companyLogoPreview, setCompanyLogoPreview] = useState<string | null>(null);

  // Navigation Guard
  const { guardedNavigate } = useNavigationGuard({
    when: isDirty,
  });

  const setActiveTab = (newTab: string) => {
    // If clicking same tab, do nothing
    if (activeTab === newTab) return;

    // Check for unsaved changes before switching
    guardedNavigate(() => {
      setActiveTabState(newTab);
      // Optional: Reset dirty state if we discard changes (or keep it if we want persistent dirty across tabs)
      // For now, we assume switching tabs discards unsaved changes of the previous tab if confirmed
      setIsDirty(false);
    });
  };

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
    defaultValues: {
      name: "",
      legalName: "",
      regNo: "",
      vatNo: "",
      logo: "",
      address: "",
      district: "",
      city: "Улаанбаатар",
      phone: "",
      email: ""
    },
  });

  useEffect(() => {
    if (company) {
      companyForm.reset({
        name: company.name ?? "",
        legalName: company.legalName ?? "",
        regNo: company.regNo ?? "",
        vatNo: company.vatNo ?? "",
        logo: company.logo ?? "",
        address: company.address ?? "",
        district: company.district ?? "",
        city: company.city ?? "Улаанбаатар",
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
    <div className="flex h-[calc(100vh-4rem)]">
      {/* Sidebar */}
      <SettingsSidebar activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Content Area */}
      {activeTab === "roles" ? (
        <div className="flex-1 overflow-hidden p-6 bg-muted/10">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <span>Тохиргоо</span>
            <ChevronRight className="w-4 h-4" />
            <span className="text-foreground font-medium">Эрх & Permissions</span>
          </div>
          <RolesLayout />
        </div>
      ) : (
        <ScrollArea className="flex-1 h-full">
          <div className="p-6 max-w-4xl">
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
              <span>Тохиргоо</span>
              <ChevronRight className="w-4 h-4" />
              <span className="text-foreground font-medium">
                {activeTab === "profile" && "Профайл"}
                {activeTab === "organization" && "Байгууллага"}
                {activeTab === "office" && "Оффис"}
                {activeTab === "signature" && "Гарын үсэг"}
                {activeTab === "users" && "Хэрэглэгчид"}
                {activeTab === "integrations" && "Интеграц"}
                {activeTab === "roles" && "Эрх & Permissions"}
                {activeTab === "security" && "Аюулгүй байдал"}
                {activeTab === "job-titles" && "Албан тушаал"}
              </span>
            </div>

            {/* Profile Tab */}
            {activeTab === "profile" && (
              <div className="space-y-6">
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
                <ProfileForm />
              </div>
            )}

            {/* Organization Tab */}
            {activeTab === "organization" && (
              <div className="space-y-6">
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
                          <Textarea {...companyForm.register("address")} placeholder="Хаяг дэлгэрэнгүй..." rows={3} />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Дүүрэг</Label>
                            <Input {...companyForm.register("district")} placeholder="Хан-Уул дүүрэг" />
                          </div>
                          <div className="space-y-2">
                            <Label>Хот</Label>
                            <Input {...companyForm.register("city")} placeholder="Улаанбаатар" />
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label>Байгууллагын нэр (Албан ёсны)</Label>
                            <Input {...companyForm.register("legalName")} placeholder="Албан ёсны нэр" />
                          </div>
                          <div className="space-y-2">
                            <Label>ТТД/НӨАТ дугаар</Label>
                            <Input {...companyForm.register("vatNo")} placeholder="12345678" />
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
              </div>
            )}

            {/* Office Tab */}
            {activeTab === "office" && (
              <div className="space-y-6">
                <BranchSettingsCard />
              </div>
            )}

            {/* Work Hours Tab - NEW */}
            {activeTab === "work-hours" && (
              <div className="space-y-6">
                <CompanySettings />
              </div>
            )}

            {/* Security Tab */}
            {activeTab === "security" && (
              <div className="space-y-6">
                <ChangePasswordForm />
                <TwoFactorAuth />
              </div>
            )}

            {/* Job Titles Tab */}
            {activeTab === "job-titles" && (
              <div className="space-y-6">
                <JobTitlesSettings />
              </div>
            )}

            {/* Signature Tab - New Enhanced Component */}
            {activeTab === "signature" && (
              <SignatureSettings
                onDirtyChange={setIsDirty}
                onSave={async () => setIsDirty(false)}
              />
            )}

            {/* Users Tab */}
            {activeTab === "users" && isAdmin && (
              <div className="space-y-6">
                {/* Pending Users Management - NEW */}
                <UsersManagement />

                {/* Manual User Creation Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3">
                      <Users className="w-6 h-6 text-primary" />
                      Шинэ хэрэглэгч нэмэх (Админ)
                    </CardTitle>
                    <CardDescription>Шинээр хэрэглэгч үүсгэх, эрх өгөх</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <form
                      onSubmit={userForm.handleSubmit((data) => createUser.mutate(data))}
                      className="space-y-4 p-4 border rounded-lg bg-muted/30"
                    >
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
                        Шууд нэмэх
                      </Button>
                    </form >

                    <div>
                      <h4 className="font-medium mb-4">Role удирдлага</h4>
                      <div className="space-y-3">
                        {users.map((u: any) => (
                          <UserRoleRow
                            key={u.id}
                            user={u}
                            currentUserId={user?.id}
                            roles={roles}
                            onAssignRole={(roleId) => {
                              assignRole.mutate(
                                { userId: u.id, roleId },
                                {
                                  onSuccess: () => {
                                    toast({ title: "Эрх амжилттай оноогдлоо" });
                                    queryClient.invalidateQueries({ queryKey: ["/api/users"] });
                                  },
                                }
                              );
                            }}
                            onRemoveRole={(roleId) => {
                              if (u.id === user?.id && roles.find((r: any) => r.id === roleId)?.name === "Admin") {
                                toast({
                                  title: "Алдаа",
                                  description: "Өөрийн Admin эрхийг устгах боломжгүй",
                                  variant: "destructive",
                                });
                                return;
                              }
                              removeRole.mutate(
                                { userId: u.id, roleId },
                                {
                                  onSuccess: () => {
                                    toast({ title: "Эрх амжилттай устгагдлаа" });
                                    queryClient.invalidateQueries({ queryKey: ["/api/users"] });
                                  },
                                }
                              );
                            }}
                          />
                        ))}
                        {users.length === 0 && <p className="text-sm text-muted-foreground">Хэрэглэгч олдсонгүй.</p>}
                      </div>
                    </div>
                  </CardContent >
                </Card >
              </div >
            )
            }

            {/* Integrations Tab */}
            {
              activeTab === "integrations" && isAdmin && (
                <div className="space-y-6">
                  <QPaySettingsCard />
                  <EBarimtSettingsCard />
                </div>
              )
            }
          </div >
        </ScrollArea>
      )}

      {/* Sticky Save Bar */}
      < StickySaveBar
        isDirty={isDirty}
        isSaving={isSaving}
        onSave={async () => {
          setIsSaving(true);
          // Save logic would go here
          setIsSaving(false);
          setIsDirty(false);
        }}
        onCancel={() => setIsDirty(false)}
      />
    </div >
  );
}
