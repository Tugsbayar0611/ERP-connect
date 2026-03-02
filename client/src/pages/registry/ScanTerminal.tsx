import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
    Scan, CheckCircle, XCircle, Loader2, User, Building2, Briefcase, RefreshCcw
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface VerifyResult {
    valid: boolean;
    employee?: {
        name: string;
        employeeCode: string;
        department: string;
        photoUrl?: string;
        status: string;
    };
    message?: string;
}

export default function ScanTerminal() {
    const { toast } = useToast();
    const [scanInput, setScanInput] = useState("");
    const [lastResult, setLastResult] = useState<VerifyResult | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input on mount and keep focusing
    useEffect(() => {
        const focusInput = () => inputRef.current?.focus();
        focusInput();

        // Refocus when clicking anywhere on the page (simulating kiosk mode)
        const handleClick = () => focusInput();
        document.addEventListener("click", handleClick);

        return () => document.removeEventListener("click", handleClick);
    }, []);

    const verifyMutation = useMutation({
        mutationFn: async (qrString: string) => {
            const res = await apiRequest("POST", "/api/digital-id/verify", { qrString });
            return res.json();
        },
        onSuccess: (data: VerifyResult) => {
            setLastResult(data);
            if (data.valid) {
                toast({
                    title: "Амжилттай",
                    description: `${data.employee?.name} - Нэвтрэх зөвшөөрөгдсөн`,
                    className: "bg-green-500 text-white border-none",
                });
            } else {
                toast({
                    title: "Алдаа",
                    description: data.message || "Буруу код",
                    variant: "destructive",
                });
            }
            setScanInput(""); // Clear input for next scan
        },
        onError: (err: Error) => {
            setLastResult({ valid: false, message: err.message });
            setScanInput("");
            toast({
                title: "Алдаа",
                description: "QR код шалгахад алдаа гарлаа",
                variant: "destructive",
            });
        }
    });

    const handleScan = (e: React.FormEvent) => {
        e.preventDefault();
        if (!scanInput.trim()) return;
        verifyMutation.mutate(scanInput);
    };

    const handleReset = () => {
        setLastResult(null);
        setScanInput("");
        inputRef.current?.focus();
    };

    return (
        <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4">
            <div className="w-full max-w-2xl grid gap-8">
                {/* Scanner Interface */}
                <Card className="border-neutral-800 bg-neutral-900 text-neutral-50 shadow-2xl">
                    <CardHeader className="text-center pb-2">
                        <div className="mx-auto bg-primary/20 p-4 rounded-full w-fit mb-4">
                            <Scan className="w-12 h-12 text-primary animate-pulse" />
                        </div>
                        <CardTitle className="text-3xl font-bold tracking-tight">QR Terminal</CardTitle>
                        <CardDescription className="text-neutral-400">
                            Ажилтны QR кодыг уншуулна уу
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleScan} className="relative">
                            <Input
                                ref={inputRef}
                                value={scanInput}
                                onChange={(e) => setScanInput(e.target.value)}
                                placeholder="Scanning..."
                                className="bg-neutral-950 border-neutral-800 text-center text-lg h-14 focus-visible:ring-primary/50"
                                autoComplete="off"
                            />
                            {verifyMutation.isPending && (
                                <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                </div>
                            )}
                        </form>
                        <p className="text-center text-sm text-neutral-500 mt-4">
                            Scanner is ready. Supports USB barcode scanners and keyboard input.
                        </p>
                    </CardContent>
                </Card>

                {/* Result Display */}
                {lastResult && (
                    <Card className={`border-none shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300 ${lastResult.valid ? "bg-green-500" : "bg-red-500"
                        }`}>
                        <CardContent className="p-8 text-white">
                            <div className="flex flex-col items-center text-center gap-6">
                                {lastResult.valid ? (
                                    <>
                                        <div className="bg-white/20 p-4 rounded-full">
                                            <CheckCircle className="w-16 h-16 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-3xl font-bold mb-2">Зөвшөөрөгдсөн</h2>
                                            <p className="text-green-100 opacity-90">QR код баталгаажлаа</p>
                                        </div>

                                        {lastResult.employee && (
                                            <div className="bg-white/10 rounded-xl p-6 w-full max-w-md backdrop-blur-sm">
                                                <div className="flex items-center gap-4 mb-4">
                                                    <div className="h-16 w-16 rounded-full bg-white/20 flex items-center justify-center text-2xl font-bold">
                                                        {lastResult.employee.name[0]}
                                                    </div>
                                                    <div className="text-left">
                                                        <h3 className="text-2xl font-bold">{lastResult.employee.name}</h3>
                                                        <p className="text-white/80">{lastResult.employee.employeeCode}</p>
                                                    </div>
                                                </div>

                                                <div className="grid gap-3 text-left">
                                                    <div className="flex items-center gap-2">
                                                        <Building2 className="w-5 h-5 opacity-70" />
                                                        <span>{lastResult.employee.department}</span>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Briefcase className="w-5 h-5 opacity-70" />
                                                        <Badge variant="secondary" className="bg-white/20 text-white hover:bg-white/30 border-none">
                                                            {lastResult.employee.status}
                                                        </Badge>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <>
                                        <div className="bg-white/20 p-4 rounded-full">
                                            <XCircle className="w-16 h-16 text-white" />
                                        </div>
                                        <div>
                                            <h2 className="text-3xl font-bold mb-2">Татгалзсан</h2>
                                            <p className="text-red-100 opacity-90">{lastResult.message || "QR код хүчингүй"}</p>
                                        </div>
                                    </>
                                )}

                                <Button
                                    onClick={handleReset}
                                    variant="secondary"
                                    size="lg"
                                    className="mt-4 bg-white/90 text-black hover:bg-white w-full max-w-xs"
                                >
                                    <RefreshCcw className="w-4 h-4 mr-2" />
                                    Шинэ хайлт
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
