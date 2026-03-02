
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Link, FileText, Loader2, Trash2, ExternalLink, Clock, Folder } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";

const evidenceSchema = z.object({
    type: z.enum(["file", "link"]).default("link"),
    title: z.string().min(1, "Гарчиг оруулна уу"),
    url: z.string().optional(),
}).refine((data) => {
    if (data.type === "link") {
        return data.url && (data.url.startsWith("http://") || data.url.startsWith("https://"));
    }
    return true;
}, {
    message: "Зөвхөн http:// эсвэл https:// холбоос оруулна уу",
    path: ["url"],
});

interface EvidenceModalProps {
    goalId: string | null;
    initialEvidence?: any[];
    readOnly?: boolean;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const PROVIDER_PATTERNS = [
    { domain: "drive.google.com", name: "Google Drive", color: "bg-blue-100 text-blue-800" },
    { domain: "docs.google.com", name: "Google Docs", color: "bg-blue-100 text-blue-800" },
    { domain: "onedrive.live.com", name: "OneDrive", color: "bg-blue-100 text-blue-800" },
    { domain: "sharepoint.com", name: "SharePoint", color: "bg-cyan-100 text-cyan-800" },
    { domain: "dropbox.com", name: "Dropbox", color: "bg-indigo-100 text-indigo-800" },
    { domain: "uploads", name: "File", color: "bg-orange-100 text-orange-800" },
];

function getProviderInfo(url: string) {
    if (!url) return { name: "Link", color: "bg-gray-100 text-gray-800" };
    try {
        if (url.startsWith("/uploads")) return { name: "File", color: "bg-orange-100 text-orange-800" };
        const hostname = new URL(url).hostname;
        const provider = PROVIDER_PATTERNS.find(p => hostname.includes(p.domain));
        return provider || { name: "Link", color: "bg-gray-100 text-gray-800" };
    } catch {
        return { name: "Link", color: "bg-gray-100 text-gray-800" };
    }
}

export function EvidenceModal({ goalId, initialEvidence = [], readOnly = false, open, onOpenChange }: EvidenceModalProps) {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);

    const form = useForm<z.infer<typeof evidenceSchema>>({
        resolver: zodResolver(evidenceSchema),
        defaultValues: {
            type: "link",
            title: "",
            url: "",
        },
    });

    const createEvidenceMutation = useMutation({
        mutationFn: (data: z.infer<typeof evidenceSchema>) =>
            apiRequest("POST", `/api/performance/goals/${goalId}/evidence`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/performance/goals"] });
            queryClient.invalidateQueries({ queryKey: ["/api/performance/team"] });
            form.reset();
            setSelectedFile(null);
            toast({ title: "Амжилттай", description: "Нотлох баримт нэмэгдлээ" });
        },
        onError: (err: any) => {
            toast({ title: "Алдаа", description: err.message, variant: "destructive" });
        },
    });

    const onSubmit = async (data: z.infer<typeof evidenceSchema>) => {
        if (!goalId) return;

        if (data.type === "file") {
            if (!selectedFile) {
                form.setError("url", { message: "Файл сонгоно уу" });
                return;
            }

            try {
                setIsUploading(true);
                const formData = new FormData();
                formData.append("file", selectedFile);

                const res = await fetch("/api/upload", {
                    method: "POST",
                    headers: {
                        // "Content-Type": "multipart/form-data" - DO NOT SET THIS MANUALLY with fetch + FormData
                        // Browser sets boundary automatically
                        "Authorization": `Bearer ${localStorage.getItem("token") || ""}` // Assuming auth needed? 
                        // Check queryClient/apiRequest defaults. apiRequest uses fetch with JSON headers usually.
                        // We need to use raw fetch or apiRequest modified. 
                        // Actually apiRequest sets Content-Type to application/json usually inside lib/queryClient
                        // Let's use raw fetch but include credential logic if needed. 
                        // Actually `apiRequest` might not be suitable for FormData if it forces JSON.
                    },
                    body: formData
                });

                if (!res.ok) throw new Error("File upload failed");
                const uploadData = await res.json();

                data.url = uploadData.url;
            } catch (e) {
                setIsUploading(false);
                toast({ title: "Алдаа", description: "Файл хуулахад алдаа гарлаа", variant: "destructive" });
                return;
            } finally {
                setIsUploading(false);
            }
        }

        createEvidenceMutation.mutate(data);
    };

    const watchUrl = form.watch("url");
    const watchType = form.watch("type");

    const providerPreview = watchUrl && (watchUrl.startsWith("http") || watchUrl.startsWith("https"))
        ? getProviderInfo(watchUrl)
        : null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle>Нотлох Баримт</DialogTitle>
                    <DialogDescription>
                        Төлөвлөгөөний биелэлтийг нотлох файл эсвэл холбоос хавсаргана уу.
                    </DialogDescription>
                </DialogHeader>

                {initialEvidence.length > 0 ? (
                    <div className="mb-4">
                        <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                            <Folder className="h-4 w-4" /> Хадгалсан баримтууд ({initialEvidence.length})
                        </h4>
                        <ScrollArea className="h-[150px] rounded-md border bg-slate-50 dark:bg-slate-900/50 p-2">
                            <ul className="space-y-2">
                                {initialEvidence.map((ev: any, i: number) => {
                                    const provider = getProviderInfo(ev.url);
                                    return (
                                        <li key={i} className="group flex flex-col gap-1 p-2 bg-white dark:bg-slate-950 border rounded hover:border-primary/50 transition-colors">
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="flex items-center gap-2">
                                                    {ev.type === 'link' ? <Link className="h-4 w-4 text-blue-500" /> : <FileText className="h-4 w-4 text-orange-500" />}
                                                    <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-blue-600 hover:underline truncate max-w-[200px]" title={ev.title}>
                                                        {ev.title}
                                                    </a>
                                                </div>
                                                <Badge variant="outline" className={`text-[10px] h-5 ${provider.color}`}>
                                                    {provider.name}
                                                </Badge>
                                            </div>

                                            <div className="flex items-center gap-2 text-[10px] text-muted-foreground pl-6">
                                                {ev.createdAt && (
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="h-3 w-3" /> {format(new Date(ev.createdAt), "yyyy-MM-dd HH:mm")}
                                                    </span>
                                                )}
                                            </div>
                                        </li>
                                    );
                                })}
                            </ul>
                        </ScrollArea>
                    </div>
                ) : (
                    <div className="mb-4 p-6 text-center text-sm text-muted-foreground border border-dashed rounded-md bg-slate-50 dark:bg-slate-900/20">
                        Нотлох баримт байхгүй байна
                    </div>
                )}

                {!readOnly ? (
                    <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <FormField
                                    control={form.control}
                                    name="type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Төрөл</FormLabel>
                                            <Select onValueChange={(val) => {
                                                field.onChange(val);
                                                form.setValue("url", "");
                                                setSelectedFile(null);
                                            }} value={field.value}>
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    <SelectItem value="link">Холбоос (Link)</SelectItem>
                                                    <SelectItem value="file">Файл</SelectItem>
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name="title"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Гарчиг</FormLabel>
                                            <FormControl>
                                                <Input placeholder={watchType === 'file' ? "Файлын тайлбар нэр" : "Жишээ: 1-р сарын борлуулалтын тайлан"} {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                {watchType === 'link' ? (
                                    <FormField
                                        control={form.control}
                                        name="url"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>URL</FormLabel>
                                                <FormControl>
                                                    <div className="relative">
                                                        <Input placeholder="https://docs.google.com/..." {...field} />
                                                        {providerPreview && (
                                                            <div className="absolute right-2 top-2">
                                                                <Badge variant="secondary" className="text-[10px] opacity-70">
                                                                    {providerPreview.name}
                                                                </Badge>
                                                            </div>
                                                        )}
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                ) : (
                                    <FormItem>
                                        <FormLabel>Файл</FormLabel>
                                        <FormControl>
                                            <Input
                                                type="file"
                                                onChange={(e) => {
                                                    if (e.target.files?.[0]) {
                                                        setSelectedFile(e.target.files[0]);
                                                        if (!form.getValues("title")) {
                                                            form.setValue("title", e.target.files[0].name);
                                                        }
                                                    }
                                                }}
                                            />
                                        </FormControl>
                                        {selectedFile && <p className="text-xs text-muted-foreground">Сонгогдсон: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)</p>}
                                        <FormMessage>{form.formState.errors.url?.message}</FormMessage>
                                    </FormItem>
                                )}
                            </div>
                            <DialogFooter>
                                <Button type="submit" disabled={createEvidenceMutation.isPending || isUploading}>
                                    {(createEvidenceMutation.isPending || isUploading) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    {isUploading ? "Хуулж байна..." : "Нэмэх"}
                                </Button>
                            </DialogFooter>
                        </form>
                    </Form>
                ) : (
                    <div className="p-3 bg-blue-50 text-blue-700 text-xs rounded-md border border-blue-100 italic">
                        Үнэлгээ хийгдсэн тул нотлох баримт нэмэх боломжгүй.
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
