import React, { useRef, useState, useEffect } from "react";
import SignatureCanvas from "react-signature-canvas";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
    PenTool,
    Upload,
    Trash2,
    RotateCcw,
    FileSignature,
    CheckCircle,
    Info,
    Loader2,
} from "lucide-react";

interface SignatureSettingsProps {
    onDirtyChange?: (isDirty: boolean) => void;
    onSave?: () => Promise<void>;
}

export function SignatureSettings({ onDirtyChange, onSave }: SignatureSettingsProps) {
    const { user } = useAuth();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const sigCanvasRef = useRef<SignatureCanvas>(null);

    const [isLoading, setIsLoading] = useState(false);
    const [preview, setPreview] = useState<string | null>(user?.signatureUrl || null);

    // Initialize signatureTitle with fallback to jobTitle if empty
    const [signatureTitle, setSignatureTitle] = useState(user?.signatureTitle ?? user?.jobTitle ?? "");

    const [activeTab, setActiveTab] = useState<"upload" | "draw">("upload");
    const [isDirty, setIsDirty] = useState(false);

    // Sync with user data
    useEffect(() => {
        if (user) {
            setPreview(user.signatureUrl || null);
            setSignatureTitle(user.signatureTitle ?? user.jobTitle ?? "");
        }
    }, [user]);

    // Track dirty state
    useEffect(() => {
        const currentSig = user?.signatureUrl || null;
        const currentTitle = user?.signatureTitle ?? user?.jobTitle ?? "";

        const hasChanges =
            preview !== currentSig ||
            signatureTitle !== currentTitle;

        setIsDirty(hasChanges);
        onDirtyChange?.(hasChanges);
    }, [preview, signatureTitle, user, onDirtyChange]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validate PNG only
        if (!file.type.includes("png")) {
            toast({
                title: "Зөвхөн PNG",
                description: "Тунгалаг дэвсгэртэй PNG зураг оруулна уу.",
                variant: "destructive",
            });
            return;
        }

        if (file.size > 2 * 1024 * 1024) {
            toast({
                title: "Файл хэт том",
                description: "2MB-аас бага хэмжээтэй зураг оруулна уу.",
                variant: "destructive",
            });
            return;
        }

        const reader = new FileReader();
        reader.onloadend = () => {
            setPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
    };



    const handleClearCanvas = () => {
        if (sigCanvasRef.current) {
            sigCanvasRef.current.clear();
        }
    };

    const handleRemoveSignature = () => {
        setPreview(null);
        if (sigCanvasRef.current) {
            sigCanvasRef.current.clear();
        }
    };

    const handleSave = async () => {
        try {
            setIsLoading(true);

            // Logic: If signatureTitle is empty or matches jobTitle, we can save as empty string
            // Backend will treat empty string as NULL, restoring fallback behavior
            const normalizedTitle = signatureTitle.trim();
            const jobTitle = (user?.jobTitle || "").trim();

            // If user cleared it or set it same as job title, send empty string => gets saved as NULL
            const titleToSend = (normalizedTitle === "" || normalizedTitle === jobTitle)
                ? ""
                : normalizedTitle;

            const res = await fetch("/api/users/me/signature", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    signatureUrl: preview,
                    signatureTitle: titleToSend,
                }),
            });

            if (!res.ok) throw new Error("Хадгалахад алдаа гарлаа");

            const updatedUser = await res.json();
            queryClient.setQueryData(["/api/auth/me"], updatedUser);

            toast({
                title: "Амжилттай",
                description: "Гарын үсгийн тохиргоо хадгалагдлаа.",
            });

            setIsDirty(false);
            await onSave?.();
        } catch (error) {
            toast({
                title: "Алдаа",
                description: "Хадгалахад алдаа гарлаа.",
                variant: "destructive",
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
                    <PenTool className="w-6 h-6 text-primary" />
                    Гарын үсэг
                </h2>
                <p className="text-muted-foreground mt-1">
                    Баримт бичигт ашиглагдах цахим гарын үсэг болон албан тушаал
                </p>
            </div>

            {/* Signing Rights Badge */}
            {user?.canSignDocuments && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm text-emerald-700 dark:text-emerald-300">
                        Та баримт бичигт гарын үсэг зурах эрхтэй
                    </span>
                </div>
            )}

            {/* Official Job Title (Read-Only) */}
            <Card className="bg-muted/30">
                <CardHeader className="pb-3">
                    <CardTitle className="text-base font-medium text-muted-foreground uppercase tracking-wide">
                        Албан тушаал (HR БҮРТГЭЛТЭЙ)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-lg font-semibold">{user?.jobTitle || "—"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                        Энэ мэдээллийг зөвхөн HR админ өөрчлөх боломжтой.
                    </p>
                </CardContent>
            </Card>

            {/* Signature Title */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg">Гарын үсгийн нэр</CardTitle>
                    <CardDescription>
                        Гарын үсгийн доор харагдах нэр (Хоосон орхивол албан тушаал автоматаар гарна)
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Input
                        value={signatureTitle}
                        onChange={(e) => setSignatureTitle(e.target.value)}
                        placeholder="Албан тушаалаас автоматаар авна"
                        className="max-w-md"
                    />
                </CardContent>
            </Card>

            {/* Signature Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Current Signature */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Одоогийн гарын үсэг</CardTitle>
                        <CardDescription>
                            PDF баримт дээр харагдах гарын үсэг
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div
                            className={cn(
                                "flex items-center justify-center",
                                "min-h-[160px] rounded-lg border-2 border-dashed",
                                "bg-muted/30 transition-colors",
                                "bg-[url('/grid-pattern.svg')] bg-center", // Optional texture
                                preview ? "border-primary/30" : "border-muted-foreground/20"
                            )}
                        >
                            {preview ? (
                                <div className="relative group p-4 w-full h-full flex items-center justify-center">
                                    <img
                                        src={preview}
                                        alt="Гарын үсэг"
                                        className="max-h-32 max-w-full object-contain"
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded">
                                        <Button
                                            variant="destructive"
                                            size="sm"
                                            onClick={handleRemoveSignature}
                                        >
                                            <Trash2 className="w-4 h-4 mr-2" />
                                            Устгах
                                        </Button>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-muted-foreground p-8">
                                    <PenTool className="w-12 h-12 mx-auto mb-3 opacity-20" />
                                    <p>Гарын үсэг оруулаагүй байна</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Upload / Draw */}
                <Card>
                    <CardHeader>
                        <CardTitle className="text-lg">Гарын үсэг оруулах</CardTitle>
                        <CardDescription>
                            Зураг оруулах эсвэл хулганаар зурах
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
                            <TabsList className="grid w-full grid-cols-2 mb-4">
                                <TabsTrigger value="upload" className="gap-2">
                                    <Upload className="w-4 h-4" />
                                    Зураг оруулах
                                </TabsTrigger>
                                <TabsTrigger value="draw" className="gap-2">
                                    <PenTool className="w-4 h-4" />
                                    Зурах
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="upload" className="space-y-4">
                                <div className="space-y-2">
                                    <Label>PNG зураг сонгох</Label>
                                    <Input
                                        type="file"
                                        accept="image/png"
                                        onChange={handleFileChange}
                                    />
                                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Info className="w-3 h-3" />
                                        Тунгалаг дэвсгэртэй PNG зураг ашиглахыг зөвлөж байна
                                    </p>
                                </div>
                            </TabsContent>

                            <TabsContent value="draw" className="space-y-4">
                                <div className="rounded-lg border bg-white overflow-hidden">
                                    <SignatureCanvas
                                        ref={sigCanvasRef}
                                        penColor="black"
                                        minWidth={2}
                                        maxWidth={4}
                                        velocityFilterWeight={0.7}
                                        canvasProps={{
                                            width: 600,
                                            height: 300,
                                            className: "w-full h-[150px] object-contain",
                                            style: { width: '100%', height: '150px' }
                                        }}
                                        onEnd={() => {
                                            if (sigCanvasRef.current && !sigCanvasRef.current.isEmpty()) {
                                                const dataUrl = sigCanvasRef.current.toDataURL("image/png");
                                                setPreview(dataUrl);
                                            }
                                        }}
                                    />
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={handleClearCanvas}
                                    className="w-full"
                                >
                                    <RotateCcw className="w-4 h-4 mr-2" />
                                    Canvas цэвэрлэх
                                </Button>
                            </TabsContent>
                        </Tabs>
                    </CardContent>
                </Card>
            </div>

            {/* Live Preview */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                        <FileSignature className="w-5 h-5 text-primary" />
                        Баримтын Preview
                    </CardTitle>
                    <CardDescription>
                        Гарын үсэг PDF баримт дээр ингэж харагдана
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <div
                        className={cn(
                            "bg-white border rounded-lg shadow-sm graph-paper",
                            "aspect-[210/297] max-w-md mx-auto p-8",
                            "relative"
                        )}
                        style={{
                            backgroundImage: 'radial-gradient(#e5e7eb 1px, transparent 1px)',
                            backgroundSize: '20px 20px'
                        }}
                    >
                        {/* Mock document content */}
                        <div className="space-y-4 opacity-50">
                            <div className="h-4 bg-gray-200 rounded w-1/3" />
                            <div className="h-3 bg-gray-100 rounded w-full" />
                            <div className="h-3 bg-gray-100 rounded w-5/6" />
                            <div className="h-3 bg-gray-100 rounded w-3/4" />
                            <div className="h-8" />
                            <div className="h-3 bg-gray-100 rounded w-full" />
                            <div className="h-3 bg-gray-100 rounded w-4/5" />
                            <div className="h-3 bg-gray-100 rounded w-2/3" />
                        </div>

                        {/* Signature block at bottom right */}
                        <div className="absolute bottom-8 right-8 text-right space-y-2">
                            {preview ? (
                                <img
                                    src={preview}
                                    alt="Signature"
                                    className="h-12 ml-auto object-contain"
                                />
                            ) : (
                                <div className="h-12 w-24 border-b-2 border-gray-400 border-dashed ml-auto" />
                            )}
                            <p className="text-xs font-semibold text-gray-800">
                                {signatureTitle || user?.jobTitle || "Албан тушаал"}
                            </p>
                            {user?.fullName && (
                                <p className="text-xs text-gray-600">{user.fullName}</p>
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Save Button */}
            <div className="flex justify-end">
                <Button
                    onClick={handleSave}
                    disabled={isLoading || !isDirty}
                    className="min-w-[140px]"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Хадгалж байна...
                        </>
                    ) : (
                        "Хадгалах"
                    )}
                </Button>
            </div>
        </div>
    );
}
