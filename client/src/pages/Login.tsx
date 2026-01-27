import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Eye, EyeOff, Building2, Shield, UserPlus, KeyRound, Mail, CheckCircle2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";

// Validation Schemas
const loginSchema = z.object({
  username: z.string().min(3, "Нэвтрэх нэр 3-аас багагүй байх ёстой"),
  password: z.string().min(1, "Нууц үг оруулна уу"),
});

const registerSchema = z.object({
  email: z.string().email("Имэйл хаяг буруу байна").min(1, "Имэйл хаяг оруулна уу"),
  username: z.string().min(3, "Нэвтрэх нэр 3-аас багагүй байх ёстой").max(50, "Нэвтрэх нэр хэт урт байна"),
  password: z.string()
    .min(8, "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой")
    .regex(/[A-Z]/, "Нууц үг дор хаяж 1 том үсэг агуулсан байх ёстой")
    .regex(/[a-z]/, "Нууц үг дор хаяж 1 жижиг үсэг агуулсан байх ёстой")
    .regex(/[0-9]/, "Нууц үг дор хаяж 1 тоо агуулсан байх ёстой")
    .max(100, "Нууц үг хэт урт байна"),
  confirmPassword: z.string().min(1, "Нууц үг давтах шаардлагатай"),
  lastName: z.string().min(1, "Овог оруулна уу"),
  firstName: z.string().min(1, "Нэр оруулна уу"),
  companyName: z.string().min(2, "Компанийн нэр 2-оос багагүй байх ёстой"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Нууц үг таарахгүй байна",
  path: ["confirmPassword"],
});

// Schema for joining an existing company
const joinRegisterSchema = z.object({
  email: z.string().email("Имэйл хаяг буруу байна").min(1, "Имэйл хаяг оруулна уу"),
  username: z.string().min(3, "Нэвтрэх нэр 3-аас багагүй байх ёстой").max(50, "Нэвтрэх нэр хэт урт байна"),
  password: z.string()
    .min(8, "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой")
    .regex(/[A-Z]/, "Нууц үг дор хаяж 1 том үсэг агуулсан байх ёстой")
    .regex(/[a-z]/, "Нууц үг дор хаяж 1 жижиг үсэг агуулсан байх ёстой")
    .regex(/[0-9]/, "Нууц үг дор хаяж 1 тоо агуулсан байх ёстой")
    .max(100, "Нууц үг хэт урт байна"),
  confirmPassword: z.string().min(1, "Нууц үг давтах шаардлагатай"),
  lastName: z.string().min(1, "Овог оруулна уу"),
  firstName: z.string().min(1, "Нэр оруулна уу"),
  companyCode: z.string().min(4, "Компанийн код буруу байна").max(20, "Компанийн код буруу байна"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Нууц үг таарахгүй байна",
  path: ["confirmPassword"],
});



const forgotPasswordSchema = z.object({
  email: z.string().email("Имэйл хаяг буруу байна").min(1, "Имэйл хаяг оруулна уу"),
});

const resetPasswordSchema = z.object({
  token: z.string().min(1, "Токен шаардлагатай"),
  newPassword: z.string().min(8, "Нууц үг хамгийн багадаа 8 тэмдэгт байх ёстой"),
  confirmPassword: z.string().min(1, "Нууц үг давтах шаардлагатай"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "Нууц үг таарахгүй байна",
  path: ["confirmPassword"],
});

type LoginFormData = z.infer<typeof loginSchema>;
type RegisterFormData = z.infer<typeof registerSchema>;
type JoinRegisterFormData = z.infer<typeof joinRegisterSchema>;
type ForgotPasswordFormData = z.infer<typeof forgotPasswordSchema>;
type ResetPasswordFormData = z.infer<typeof resetPasswordSchema>;

type ViewMode = "login" | "register" | "forgot-password" | "reset-password";
type RegistrationMode = "create" | "join";

export default function Login() {
  const { login, isLoggingIn } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<ViewMode>("login");

  // UI States
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [requires2FA, setRequires2FA] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState("");

  // Loading States
  const [isRegistering, setIsRegistering] = useState(false);
  const [isRequestingReset, setIsRequestingReset] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  // Reset Token (Dev mode helper)
  const [resetToken, setResetToken] = useState("");

  // Registration mode: create new company vs join existing
  const [registrationMode, setRegistrationMode] = useState<RegistrationMode>("create");
  const [pendingSuccess, setPendingSuccess] = useState<{ message: string; companyName?: string } | null>(null);

  // Forms with realtime validation mode
  const loginForm = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: "onChange",
    defaultValues: { username: "", password: "" },
  });

  const registerForm = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      lastName: "",
      firstName: "",
      companyName: "",
    },
  });

  const forgotPasswordForm = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onChange",
    defaultValues: { email: "" },
  });

  const joinRegisterForm = useForm<JoinRegisterFormData>({
    resolver: zodResolver(joinRegisterSchema),
    mode: "onChange",
    defaultValues: {
      email: "",
      username: "",
      password: "",
      confirmPassword: "",
      lastName: "",
      firstName: "",
      companyCode: "",
    },
  });

  const resetPasswordForm = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: "onChange",
    defaultValues: { token: "", newPassword: "", confirmPassword: "" },
  });

  // Handlers
  const onSubmitLogin = async (data: LoginFormData) => {
    try {
      const result = await login(data);
      if (result?.requires2FA) {
        setRequires2FA(true);
        return;
      }
      setLocation("/");
    } catch (err: any) {
      loginForm.setError("root", { message: err.message || "Буруу нэвтрэх мэдээлэл" });
    }
  };

  const onSubmitRegister = async (data: RegisterFormData) => {
    try {
      setIsRegistering(true);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: data.email,
          username: data.username,
          password: data.password,
          fullName: `${data.lastName} ${data.firstName}`.trim(),
          companyName: data.companyName,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Бүртгэл амжилтгүй");
      }

      const result = await res.json();

      // Show company code to admin
      if (result.companyCode) {
        toast({
          title: "Компани үүслээ! 🎉",
          description: `Таны компанийн код: ${result.companyCode}. Энэ кодыг ажилтнуудадаа хуваалцаарай.`,
          duration: 10000,
        });
      } else {
        toast({ title: "Амжилттай", description: "Бүртгэл амжилттай. Нэвтэрч байна..." });
      }

      setTimeout(() => setLocation("/"), 1500);
    } catch (err: any) {
      registerForm.setError("root", { message: err.message || "Бүртгэл амжилтгүй" });
    } finally {
      setIsRegistering(false);
    }
  };

  // Join existing company with code
  const onSubmitJoinRegister = async (data: JoinRegisterFormData) => {
    try {
      setIsRegistering(true);
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          email: data.email,
          username: data.username,
          password: data.password,
          fullName: `${data.lastName} ${data.firstName}`.trim(),
          companyCode: data.companyCode.toUpperCase(),
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        throw new Error(result.message || "Бүртгэл амжилтгүй");
      }

      // User registered with pending status
      if (result.status === "pending") {
        setPendingSuccess({
          message: result.message || "Бүртгэл амжилттай. Админ баталгаажуулахыг хүлээнэ үү.",
          companyName: result.companyName,
        });
        joinRegisterForm.reset();
      } else {
        // Direct login (shouldn't happen for join, but handle it)
        toast({ title: "Амжилттай", description: "Бүртгэл амжилттай. Нэвтэрч байна..." });
        setTimeout(() => setLocation("/"), 1000);
      }
    } catch (err: any) {
      joinRegisterForm.setError("root", { message: err.message || "Бүртгэл амжилтгүй" });
    } finally {
      setIsRegistering(false);
    }
  };

  const onSubmitForgotPassword = async (data: ForgotPasswordFormData) => {
    try {
      setIsRequestingReset(true);
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.email }),
      });

      if (!res.ok) throw new Error("Алдаа гарлаа");
      const result = await res.json();

      if (result.resetToken) {
        setResetToken(result.resetToken);
        setViewMode("reset-password");
        resetPasswordForm.setValue("token", result.resetToken);
        toast({ title: "Токен үүслээ (Dev)", description: "Token auto-filled" });
      } else {
        toast({ title: "Имэйл илгээгдлээ", description: "Нууц үг сэргээх холбоос илгээгдлээ." });
        setViewMode("login");
      }
    } catch (err: any) {
      forgotPasswordForm.setError("root", { message: err.message || "Алдаа гарлаа" });
    } finally {
      setIsRequestingReset(false);
    }
  };

  const onSubmitResetPassword = async (data: ResetPasswordFormData) => {
    try {
      setIsResetting(true);
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: data.token, newPassword: data.newPassword }),
      });

      if (!res.ok) throw new Error("Нууц үг сэргээх амжилтгүй");

      toast({ title: "Амжилттай", description: "Нууц үг шинэчлэгдлээ. Нэвтэрнэ үү." });
      setViewMode("login");
      resetPasswordForm.reset();
    } catch (err: any) {
      resetPasswordForm.setError("root", { message: err.message });
    } finally {
      setIsResetting(false);
    }
  };

  const handle2FAVerify = async () => {
    try {
      const res = await fetch("/api/auth/2fa/verify-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token: twoFactorToken }),
      });

      if (!res.ok) throw new Error("Invalid TOTP token");
      setLocation("/");
    } catch (err: any) {
      loginForm.setError("root", { message: err.message });
    }
  };

  // Content Configuration
  const getContent = () => {
    switch (viewMode) {
      case "register":
        return {
          title: "Бүртгэл үүсгэх",
          subtitle: "Шинэ байгууллага үүсгэн эхлүүлнэ үү",
          icon: <UserPlus className="w-8 h-8 text-white" />,
        };
      case "forgot-password":
        return {
          title: "Нууц үг сэргээх",
          subtitle: "Имэйл хаягаа оруулна уу",
          icon: <KeyRound className="w-8 h-8 text-white" />,
        };
      case "reset-password":
        return {
          title: "Шинэ нууц үг",
          subtitle: "Шинэ нууц үгээ оруулна уу",
          icon: <KeyRound className="w-8 h-8 text-white" />,
        };
      default:
        return {
          title: "Нэвтрэх",
          subtitle: "Системд нэвтэрч үргэлжлүүлнэ үү",
          icon: <Building2 className="w-8 h-8 text-white" />,
        };
    }
  };

  const content = getContent();

  return (
    <div className="flex min-h-screen w-full font-sans">
      {/* LEFT SIDE - BRANDING */}
      <div className="hidden lg:flex w-1/2 bg-slate-900 relative flex-col justify-between p-12 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 sidebar-gradient opacity-90" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-primary/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />

        {/* Content */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl sidebar-gradient flex items-center justify-center shadow-lg shadow-primary/20">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-white tracking-tight">MonERP</span>
          </div>
        </div>

        <div className="relative z-10 max-w-lg">
          <h1 className="text-5xl font-bold text-white mb-6 leading-tight">
            Байгууллагын нөөц төлөвлөлтийн цогц систем
          </h1>
          <p className="text-lg text-slate-400 leading-relaxed">
            Санхүү, хүний нөөц, агуулах, борлуулалтын үйл ажиллагаагаа нэг дор, нэг системээр удирд.
          </p>
        </div>

        <div className="relative z-10 flex items-center gap-4 text-sm text-slate-500">
          <span>© 2026 MonERP Platform</span>
          <span className="w-1 h-1 rounded-full bg-slate-700" />
          <span>v2.1.0 Enterprise</span>
        </div>
      </div>

      {/* RIGHT SIDE - FORMS */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 bg-background relative">
        <div className="w-full max-w-md space-y-8 animate-in slide-in-from-right-8 duration-500">

          {/* Mobile Header (Visible only on small screens) */}
          <div className="lg:hidden text-center mb-8">
            <div className="w-12 h-12 rounded-xl sidebar-gradient mx-auto flex items-center justify-center shadow-lg shadow-primary/20 mb-4">
              <Building2 className="w-6 h-6 text-white" />
            </div>
            <h2 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">MonERP</h2>
          </div>

          <div className="space-y-2 text-center lg:text-left">
            <h2 className="text-3xl font-bold tracking-tight">{content.title}</h2>
            <p className="text-muted-foreground">{content.subtitle}</p>
          </div>

          {/* LOGIN FORM */}
          {viewMode === "login" && !requires2FA && (
            <Form {...loginForm}>
              <form onSubmit={loginForm.handleSubmit(onSubmitLogin)} className="space-y-5">
                <FormField
                  control={loginForm.control}
                  name="username"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Нэвтрэх нэр</FormLabel>
                      <FormControl>
                        <Input className="h-12 border-input/50 focus:border-primary/50" placeholder="Нэвтрэх нэр" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={loginForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <div className="flex items-center justify-between">
                        <FormLabel>Нууц үг</FormLabel>
                        <Button
                          variant="link"
                          className="px-0 font-normal text-xs h-auto text-primary"
                          type="button"
                          onClick={() => setViewMode("forgot-password")}
                        >
                          Нууц үг мартсан?
                        </Button>
                      </div>
                      <FormControl>
                        <div className="relative">
                          <Input
                            type={showPassword ? "text" : "password"}
                            className="h-12 border-input/50 focus:border-primary/50 pr-10"
                            placeholder="••••••••"
                            {...field}
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {loginForm.formState.errors.root && (
                  <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
                    {loginForm.formState.errors.root.message}
                  </div>
                )}

                <Button type="submit" className="w-full h-12 text-base rounded-xl sidebar-gradient hover:opacity-90 transition-opacity" disabled={isLoggingIn}>
                  {isLoggingIn ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : "Нэвтрэх"}
                </Button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/50" /></div>
                  <div className="relative flex justify-center text-xs uppercase"><span className="bg-background px-2 text-muted-foreground">эсвэл</span></div>
                </div>

                <Button variant="outline" type="button" className="w-full h-12 text-base rounded-xl gap-2 hover:bg-slate-50 dark:hover:bg-slate-900 border-input/50" onClick={() => window.location.href = "/api/auth/google"}>
                  <Mail className="w-5 h-5 text-red-500" />
                  Google-ээр нэвтрэх
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  Бүртгэлгүй юу?{" "}
                  <button type="button" onClick={() => setViewMode("register")} className="font-semibold text-primary hover:underline">
                    Бүртгэл үүсгэх
                  </button>
                </p>
              </form>
            </Form>
          )}

          {/* REGISTER FORM */}
          {viewMode === "register" && (
            <div className="space-y-4">
              {/* Pending Success State */}
              {pendingSuccess && (
                <div className="p-6 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 space-y-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                    <div>
                      <h3 className="font-semibold text-green-800 dark:text-green-200">Бүртгэл амжилттай!</h3>
                      {pendingSuccess.companyName && (
                        <p className="text-sm text-green-700 dark:text-green-300">{pendingSuccess.companyName}</p>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300">{pendingSuccess.message}</p>
                  <Button
                    variant="outline"
                    className="w-full border-green-300 text-green-700 hover:bg-green-100 dark:hover:bg-green-900"
                    onClick={() => {
                      setPendingSuccess(null);
                      setViewMode("login");
                    }}
                  >
                    Нэвтрэх хуудас руу буцах
                  </Button>
                </div>
              )}

              {/* Registration Mode Tabs */}
              {!pendingSuccess && (
                <>
                  <div className="flex gap-2 p-1 rounded-lg bg-muted/50">
                    <button
                      type="button"
                      onClick={() => setRegistrationMode("create")}
                      className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${registrationMode === "create"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      <Building2 className="w-4 h-4 inline mr-2" />
                      Шинэ компани
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegistrationMode("join")}
                      className={`flex-1 py-2.5 px-4 rounded-md text-sm font-medium transition-all ${registrationMode === "join"
                        ? "bg-background shadow-sm text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                        }`}
                    >
                      <UserPlus className="w-4 h-4 inline mr-2" />
                      Компанид нэгдэх
                    </button>
                  </div>

                  {/* CREATE NEW COMPANY FORM */}
                  {registrationMode === "create" && (
                    <Form {...registerForm}>
                      <form onSubmit={registerForm.handleSubmit(onSubmitRegister)} className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <FormField
                            control={registerForm.control}
                            name="lastName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Овог</FormLabel>
                                <FormControl>
                                  <Input className="h-12" placeholder="Овог" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                          <FormField
                            control={registerForm.control}
                            name="firstName"
                            render={({ field }) => (
                              <FormItem>
                                <FormLabel>Нэр</FormLabel>
                                <FormControl>
                                  <Input className="h-12" placeholder="Нэр" {...field} />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />
                        </div>

                        <FormField
                          control={registerForm.control}
                          name="companyName"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Компанийн нэр</FormLabel>
                              <FormControl>
                                <Input className="h-12" placeholder="Компанийн нэр" {...field} />
                              </FormControl>
                              <FormDescription className="text-xs">Ж: MonPay LLC</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={registerForm.control}
                          name="email"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Имэйл хаяг</FormLabel>
                              <FormControl>
                                <Input
                                  type="email"
                                  autoComplete="email"
                                  className="h-12"
                                  placeholder="name@company.com"
                                  {...field}
                                  value={field.value || ""}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={registerForm.control}
                          name="username"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Нэвтрэх нэр</FormLabel>
                              <FormControl>
                                <Input className="h-12" placeholder="Нэвтрэх нэр" {...field} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={registerForm.control}
                          name="password"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Нууц үг</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input type={showPassword ? "text" : "password"} className="h-12 pr-10" placeholder="••••••••" {...field} />
                                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                </div>
                              </FormControl>
                              <FormDescription className="text-xs">Хамгийн багадаа 8 тэмдэгт</FormDescription>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={registerForm.control}
                          name="confirmPassword"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Нууц үг давтах</FormLabel>
                              <FormControl>
                                <div className="relative">
                                  <Input type={showConfirmPassword ? "text" : "password"} className="h-12 pr-10" placeholder="••••••••" {...field} />
                                  <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                  </button>
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {registerForm.formState.errors.root && (
                          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm text-center">
                            {registerForm.formState.errors.root.message}
                          </div>
                        )}

                        <Button type="submit" className="w-full h-12 text-base rounded-xl sidebar-gradient mt-4" disabled={isRegistering}>
                          {isRegistering ? "Бүртгэж байна..." : "Бүртгэл үүсгэх"}
                        </Button>

                        <p className="text-center text-sm text-muted-foreground pt-2">
                          Бүртгэлтэй юу?{" "}
                          <button type="button" onClick={() => setViewMode("login")} className="font-semibold text-primary hover:underline">
                            Нэвтрэх
                          </button>
                        </p>
                      </form>
                    </Form>
                  )}
                </>
              )}
            </div>
          )}

          {/* FORGOT PASSWORD FORM */}
          {viewMode === "forgot-password" && (
            <Form {...forgotPasswordForm}>
              <form onSubmit={forgotPasswordForm.handleSubmit(onSubmitForgotPassword)} className="space-y-5">
                <FormField
                  control={forgotPasswordForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Имэйл хаяг</FormLabel>
                      <FormControl>
                        <Input
                          type="email"
                          autoComplete="email"
                          className="h-12"
                          placeholder="example@gmail.com"
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormDescription>Нууц үг сэргээх холбоос таны имэйл рүү очно.</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full h-12 text-base rounded-xl sidebar-gradient" disabled={isRequestingReset}>
                  {isRequestingReset ? "Илгээж байна..." : "Илгээх"}
                </Button>

                <button type="button" onClick={() => setViewMode("login")} className="w-full text-center text-sm font-semibold text-primary hover:underline">
                  Буцах
                </button>
              </form>
            </Form>
          )}

          {/* RESET PASSWORD FORM */}
          {viewMode === "reset-password" && (
            <Form {...resetPasswordForm}>
              <form onSubmit={resetPasswordForm.handleSubmit(onSubmitResetPassword)} className="space-y-5">
                <FormField
                  control={resetPasswordForm.control}
                  name="token"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Сэргээх токен</FormLabel>
                      <FormControl>
                        <Input className="h-12" placeholder="Token" {...field} value={resetToken || field.value} onChange={(e) => { field.onChange(e); setResetToken(e.target.value); }} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={resetPasswordForm.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Шинэ нууц үг</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showPassword ? "text" : "password"} className="h-12 pr-10" {...field} />
                          <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormDescription className="text-xs">Хамгийн багадаа 8 тэмдэгт</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={resetPasswordForm.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Нууц үг давтах</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input type={showConfirmPassword ? "text" : "password"} className="h-12 pr-10" {...field} />
                          <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                            {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full h-12 text-base rounded-xl sidebar-gradient" disabled={isResetting}>
                  {isResetting ? "Шинэчилж байна..." : "Хадгалах"}
                </Button>
              </form>
            </Form>
          )}

          {/* 2FA Verification Form (re-used in split layout) */}
          {viewMode === "login" && requires2FA && (
            <div className="space-y-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Shield className="w-8 h-8 text-blue-600" />
                </div>
                <h3 className="text-lg font-semibold">2FA Баталгаажуулалт</h3>
                <p className="text-sm text-muted-foreground">Google Authenticator апп-аас 6 оронтой код оруулна уу</p>
              </div>

              <Input
                placeholder="000000"
                value={twoFactorToken}
                onChange={(e) => setTwoFactorToken(e.target.value.replace(/\D/g, "").slice(0, 6))}
                className="text-center text-3xl tracking-[1rem] h-16 font-mono"
                autoFocus
                maxLength={6}
              />

              <Button onClick={handle2FAVerify} className="w-full h-12 text-base rounded-xl sidebar-gradient" disabled={twoFactorToken.length !== 6 || isLoggingIn}>
                Баталгаажуулах
              </Button>

              <Button variant="ghost" className="w-full" onClick={() => { setRequires2FA(false); setTwoFactorToken(""); }}>
                Буцах
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
