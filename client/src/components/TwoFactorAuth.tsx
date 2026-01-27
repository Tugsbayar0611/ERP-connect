import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Shield, QrCode, CheckCircle2, XCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export function TwoFactorAuth() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [verificationToken, setVerificationToken] = useState("");
  const [setupToken, setSetupToken] = useState("");

  // Check 2FA status
  const { data: userData, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: async () => {
      const res = await fetch("/api/auth/me", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch user");
      return res.json();
    },
  });

  const is2FAEnabled = userData?.twoFactorEnabled === true;

  // Generate 2FA secret
  const generateSecret = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/auth/2fa/setup", {
        method: "GET",
        credentials: "include",
      });
      if (!res.ok) {
        let errorMessage = "Failed to generate 2FA secret";
        try {
          const error = await res.json();
          errorMessage = error.message || error.error || errorMessage;
        } catch (e) {
          // If response is not JSON, use status text
          errorMessage = res.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }
      const data = await res.json();
      if (!data.secret || !data.qrCode) {
        throw new Error("Invalid response from server");
      }
      return data;
    },
    onSuccess: (data) => {
      toast({
        title: "2FA Secret үүсгэгдлээ",
        description: "QR кодыг scan хийж, TOTP token оруулна уу",
      });
    },
    onError: (error: any) => {
      console.error("2FA setup error:", error);
      toast({
        title: "Алдаа",
        description: error.message || "2FA secret үүсгэхэд алдаа гарлаа",
        variant: "destructive",
      });
    },
  });

  // Verify and enable 2FA
  const verifyAndEnable = useMutation({
    mutationFn: async (token: string) => {
      const res = await fetch("/api/auth/2fa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to verify token");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Амжилттай",
        description: "2FA идэвхжсэн",
      });
      setVerificationToken("");
      setSetupToken("");
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа",
        description: error.message || "Token баталгаажуулахад алдаа гарлаа",
        variant: "destructive",
      });
    },
  });

  // Disable 2FA
  const disable2FA = useMutation({
    mutationFn: async (token?: string) => {
      const res = await fetch("/api/auth/2fa/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || "Failed to disable 2FA");
      }
      return res.json();
    },
    onSuccess: () => {
      toast({
        title: "Амжилттай",
        description: "2FA идэвхгүй болгосон",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
    onError: (error: any) => {
      toast({
        title: "Алдаа",
        description: error.message || "2FA идэвхгүй болгоход алдаа гарлаа",
        variant: "destructive",
      });
    },
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-primary" />
          Хоёр шатлалт баталгаажуулалт (2FA)
        </CardTitle>
        <CardDescription>
          Нэмэлт аюулгүй байдлын давхарга. Google Authenticator эсвэл ижил төстэй апп ашиглана уу.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Status */}
        <div className="flex items-center justify-between p-4 border rounded-lg">
          <div className="flex items-center gap-3">
            {is2FAEnabled ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-500" />
                <div>
                  <p className="font-medium">2FA идэвхтэй</p>
                  <p className="text-sm text-muted-foreground">Нэвтрэхэд TOTP token шаардлагатай</p>
                </div>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">2FA идэвхгүй</p>
                  <p className="text-sm text-muted-foreground">Нэвтрэхэд зөвхөн нууц үг шаардлагатай</p>
                </div>
              </>
            )}
          </div>
          <Badge variant={is2FAEnabled ? "default" : "secondary"}>
            {is2FAEnabled ? "Идэвхтэй" : "Идэвхгүй"}
          </Badge>
        </div>

        {/* Setup 2FA */}
        {!is2FAEnabled && (
          <div className="space-y-4 p-4 border rounded-lg bg-muted/30">
            <h4 className="font-medium">2FA идэвхжүүлэх</h4>
            <p className="text-sm text-muted-foreground">
              1. "QR код үүсгэх" дарна уу
              <br />
              2. Google Authenticator апп-аар QR кодыг scan хийж, 6 оронтой код аваарай
              <br />
              3. Кодыг доор оруулж баталгаажуулна уу
            </p>

            {generateSecret.data && (
              <div className="space-y-4">
                <div className="flex justify-center">
                  <img
                    src={generateSecret.data.qrCode}
                    alt="2FA QR Code"
                    className="border rounded-lg p-2 bg-white"
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">Эсвэл secret-ийг гараар оруулна уу:</p>
                  <code className="text-xs bg-muted px-2 py-1 rounded">{generateSecret.data.secret}</code>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => generateSecret.mutate()}
                disabled={generateSecret.isPending}
              >
                {generateSecret.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Үүсгэж байна...
                  </>
                ) : (
                  <>
                    <QrCode className="w-4 h-4 mr-2" />
                    QR код үүсгэх
                  </>
                )}
              </Button>

              {generateSecret.data && (
                <>
                  <Input
                    placeholder="6 оронтой код"
                    value={setupToken}
                    onChange={(e) => setSetupToken(e.target.value)}
                    maxLength={6}
                    className="flex-1"
                  />
                  <Button
                    type="button"
                    onClick={() => verifyAndEnable.mutate(setupToken)}
                    disabled={!setupToken || setupToken.length !== 6 || verifyAndEnable.isPending}
                  >
                    {verifyAndEnable.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Баталгаажуулж байна...
                      </>
                    ) : (
                      "Баталгаажуулах"
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Disable 2FA */}
        {is2FAEnabled && (
          <div className="space-y-4 p-4 border rounded-lg bg-destructive/5">
            <h4 className="font-medium text-destructive">2FA идэвхгүй болгох</h4>
            <p className="text-sm text-muted-foreground">
              Аюултай! 2FA идэвхгүй болгох нь таны бүртгэлийн аюулгүй байдлыг бууруулна.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="TOTP token (сонголттой)"
                value={verificationToken}
                onChange={(e) => setVerificationToken(e.target.value)}
                maxLength={6}
                className="flex-1"
              />
              <Button
                type="button"
                variant="destructive"
                onClick={() => disable2FA.mutate(verificationToken || undefined)}
                disabled={disable2FA.isPending}
              >
                {disable2FA.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Идэвхгүй болгож байна...
                  </>
                ) : (
                  "Идэвхгүй болгох"
                )}
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
