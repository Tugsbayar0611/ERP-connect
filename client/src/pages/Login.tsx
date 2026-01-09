import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, EyeOff, Building2 } from "lucide-react";
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
} from "@/components/ui/form";

const loginSchema = z.object({
  username: z.string().min(3, "Нэвтрэх нэр 3-аас багагүй байх ёстой").max(50, "Нэвтрэх нэр хэт урт байна"),
  password: z.string().min(6, "Нууц үг 6-аас багагүй байх ёстой").max(100, "Нууц үг хэт урт байна"),
});

type LoginFormData = z.infer<typeof loginSchema>;

export default function Login() {
  const { login, isLoggingIn } = useAuth();
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);

  const form = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginFormData) => {
    try {
      await login(data);
      setLocation("/");
    } catch (err: any) {
      form.setError("root", { message: err.message || "Буруу нэвтрэх мэдээлэл" });
      form.setFocus("username");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Gradient Background */}
      <div className="absolute inset-0 sidebar-gradient opacity-90" />

      {/* Animated Background Shapes */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/10 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-white/5 rounded-full blur-3xl" />
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md shadow-2xl border-white/20 bg-white/95 dark:bg-card/95 backdrop-blur-xl relative z-10 animate-scale-in mx-4">
        <CardHeader className="text-center space-y-4 pb-6">
          {/* Logo */}
          <div className="w-16 h-16 sidebar-gradient rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-primary/30 animate-slide-up">
            <Building2 className="w-8 h-8 text-white" />
          </div>

          <div className="space-y-2 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            <CardTitle className="text-3xl font-display font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              MonERP
            </CardTitle>
            <CardDescription className="text-base">
              Бизнесийн удирдлагын систем
            </CardDescription>
          </div>
        </CardHeader>

        <CardContent className="animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80">Нэвтрэх нэр</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="Нэвтрэх нэрээ оруулна уу"
                        {...field}
                        className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-foreground/80">Нууц үг</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                          className="h-12 bg-muted/50 border-border/50 focus:bg-background transition-colors pr-12"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 p-0 hover:bg-muted"
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? (
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

              {/* Global error */}
              {form.formState.errors.root && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-xl text-center animate-scale-in">
                  {form.formState.errors.root.message}
                </div>
              )}

              <Button
                type="submit"
                className="w-full h-12 text-base font-semibold btn-premium rounded-xl"
                disabled={isLoggingIn}
              >
                {isLoggingIn ? (
                  <>
                    <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                    Нэвтэрч байна...
                  </>
                ) : (
                  "Нэвтрэх"
                )}
              </Button>
            </form>
          </Form>

          {/* Demo credentials */}
          <div className="mt-6 pt-6 border-t border-border/50">
            <div className="bg-muted/50 rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground mb-2">Туршилтын нэвтрэх мэдээлэл</p>
              <div className="flex items-center justify-center gap-4 text-sm">
                <span className="font-mono bg-background px-2 py-1 rounded">admin</span>
                <span className="text-muted-foreground">/</span>
                <span className="font-mono bg-background px-2 py-1 rounded">admin123</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="absolute bottom-6 text-center text-white/60 text-sm">
        <p>© 2025 MonERP. Бүх эрх хуулиар хамгаалагдсан.</p>
      </div>
    </div>
  );
}