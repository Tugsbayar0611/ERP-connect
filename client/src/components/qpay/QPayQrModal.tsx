import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QrCode, Copy, Check } from "lucide-react";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

interface QPayQrModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  qrData: {
    qrImage: string | null;
    qrText: string;
    callbackUrl: string;
    status: string;
  } | null;
}

export function QPayQrModal({ open, onOpenChange, qrData }: QPayQrModalProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!qrData) return null;

  const handleCopyQR = () => {
    navigator.clipboard.writeText(qrData.qrText);
    setCopied(true);
    toast({ title: "Хуулагдлаа", description: "QR код хуулагдлаа." });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenBankApp = () => {
    // Deep link to bank app (QPay supported banks)
    const bankUrl = `qpay://payment?qr=${encodeURIComponent(qrData.qrText)}`;
    window.open(bankUrl, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            QPay QR код
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* QR Image */}
          {qrData.qrImage ? (
            <div className="flex justify-center p-4 bg-white rounded-lg border">
              <img
                src={`data:image/png;base64,${qrData.qrImage}`}
                alt="QPay QR Code"
                className="w-64 h-64"
              />
            </div>
          ) : (
            <div className="flex justify-center p-8 bg-muted rounded-lg border">
              <QrCode className="w-32 h-32 text-muted-foreground" />
            </div>
          )}

          {/* QR Text */}
          <div className="space-y-2">
            <label className="text-sm font-medium">QR код текст</label>
            <div className="flex gap-2">
              <Input
                value={qrData.qrText}
                readOnly
                className="bg-muted font-mono text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyQR}
              >
                {copied ? (
                  <Check className="w-4 h-4 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>

          {/* Bank Deep Links */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Банкны апп нээх</label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleOpenBankApp}
              >
                QPay нээх
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const url = `https://qpay.mn/pay?qr=${encodeURIComponent(qrData.qrText)}`;
                  window.open(url, "_blank");
                }}
              >
                Вэб сайт
              </Button>
            </div>
          </div>

          {/* Status */}
          <div className="text-sm text-muted-foreground">
            Төлөв: <span className="font-medium">{qrData.status === "pending" ? "Хүлээгдэж байна" : qrData.status}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
