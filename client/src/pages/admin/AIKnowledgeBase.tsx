import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Brain, Plus, Trash2, Pencil, RefreshCw, Loader2, Search } from "lucide-react";
import { format } from "date-fns";

type KnowledgeBase = {
    id: string;
    title: string;
    category: string;
    content: string;
    keywords: string | null;
    isActive: boolean;
    updatedAt: string;
};

const CATEGORIES: Record<string, string> = {
    general: "Ерөнхий",
    hr: "Хүний нөөц",
    operation: "Үйл ажиллагаа (Агуулах, Борлуулалт)",
    transport: "Унаа, Тээвэр",
};

export default function AIKnowledgeBaseAdmin() {
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [search, setSearch] = useState("");
    
    // Modal state
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        title: "",
        category: "operation",
        content: "",
        keywords: "",
    });

    const { data: kbs = [], isLoading } = useQuery<KnowledgeBase[]>({
        queryKey: ["/api/ai/kb"],
    });

    const saveMutation = useMutation({
        mutationFn: async () => {
            const method = editingId ? "PATCH" : "POST";
            const url = editingId ? `/api/ai/kb/${editingId}` : "/api/ai/kb";
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(formData),
            });
            if (!res.ok) throw new Error(await res.text());
            return res.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/ai/kb"] });
            closeForm();
            toast({ title: "Амжилттай", description: "Заавар амжилттай хадгалагдлаа." });
        },
        onError: (e: any) => toast({ title: "Алдаа", description: e.message, variant: "destructive" }),
    });

    const deleteMutation = useMutation({
        mutationFn: async (id: string) => {
            const res = await fetch(`/api/ai/kb/${id}`, { method: "DELETE" });
            if (!res.ok && res.status !== 204) throw new Error("Delete failed");
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/ai/kb"] });
            toast({ title: "Устгагдлаа", description: "Мэдлэгийн сангаас устгагдлаа." });
        },
    });

    // Helper functions
    const openForm = (kb?: KnowledgeBase) => {
        if (kb) {
            setEditingId(kb.id);
            setFormData({
                title: kb.title,
                category: kb.category,
                content: kb.content,
                keywords: kb.keywords || "",
            });
        } else {
            setEditingId(null);
            setFormData({ title: "", category: "operation", content: "", keywords: "" });
        }
        setShowForm(true);
    };

    const closeForm = () => {
        setShowForm(false);
        setEditingId(null);
    };

    // Auto-seed Operation data logic
    const seedMutation = useMutation({
        mutationFn: async () => {
            const seedData = [
                {
                    title: "Бараа материал хэрхэн бүртгэх вэ? (Inventory)",
                    category: "operation",
                    content: "Бараа материал бүртгэхийн тулд:\n1. Зүүн цэсний 'Operation > Бараа' руу орно.\n2. 'Бараа нэмэх' товчийг дарж барааны нэр, төрөл, хэмжих нэгж, нөөцийн доод хязгаар зэргийг оруулж хадгална.\n3. Бараагаа 'Operation > Агуулах' цэсээр орж орлого авах үед тоо ширхэг нь нэмэгдэнэ.",
                    keywords: "агуулах, бараа, бүтээгдэхүүн, орлого"
                },
                {
                    title: "Борлуулалт хэрхэн хийх вэ? (Sales)",
                    category: "operation",
                    content: "Борлуулалт хийх заавар:\n1. Зүүн цэсний 'Operation > Борлуулалт' хэсэг рүү орно.\n2. 'Шинэ борлуулалт' дарж харилцагч сонгоод зарах бараануудаа нэмнэ.\n3. Төлөвийг 'confirmed' болгох үед агуулахаас бараа хасагдах үйлдэл давхар хийгдэнэ.\n4. Дараа нь 'Нэхэмжлэх үүсгэх' товч дарж санхүү рүү шилжүүлнэ.",
                    keywords: "борлуулалт, зарах, нэхэмжлэх, sales"
                },
                {
                    title: "Худалдан авалт (Purchase) яаж хийх вэ?",
                    category: "operation",
                    content: "Худалдан авалтын процесс:\n1. Зүүн цэсний 'Operation > Худалдан авалт' руу орно.\n2. Нийлүүлэгч (Contact) сонгож авах бараануудаа жагсаана.\n3. Захиалга баталгаажиж, бараагаа хүлээж авах үед 'Агуулах руу орлого авах' товчийг дарна.",
                    keywords: "худалдан авалт, нийлүүлэгч, орлого, татан авалт"
                }
            ];

            for (const item of seedData) {
                await fetch("/api/ai/kb", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(item),
                });
            }
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["/api/ai/kb"] });
            toast({ title: "Сургалт дууслаа", description: "Үйл ажиллагааны (Operation) үндсэн зааврууд амжилттай орлоо." });
        }
    });

    const filteredKbs = kbs.filter(kb => 
        kb.title.toLowerCase().includes(search.toLowerCase()) || 
        kb.content.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-3xl font-bold tracking-tight flex items-center gap-2">
                        <Brain className="h-8 w-8 text-primary" />
                        AI Сургалтын Бааз
                    </h2>
                    <p className="text-muted-foreground mt-1">
                        AI туслах энэхүү мэдлэгийн санг уншиж ажилчдын асуултад хариулах болно.
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="secondary" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
                        {seedMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
                        Үндсэн заавар оруулах
                    </Button>
                    <Button onClick={() => openForm()}>
                        <Plus className="w-4 h-4 mr-2" />
                        Шинэ заавар
                    </Button>
                </div>
            </div>

            <div className="relative w-full md:w-96">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                    placeholder="Заавар хайх..."
                    className="pl-8"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {isLoading ? (
                <div className="flex justify-center p-12"><Loader2 className="animate-spin" /></div>
            ) : filteredKbs.length === 0 ? (
                <Card>
                    <CardContent className="text-center py-16 text-muted-foreground">
                        <Brain className="w-12 h-12 mx-auto mb-4 opacity-30" />
                        <p>AI-д зааж өгсөн мэдээлэл алга байна.</p>
                        <p className="text-sm mt-1">Та "Үндсэн заавар оруулах" товчийг дарж бэлэн заавруудыг оруулж болно.</p>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredKbs.map(kb => (
                        <Card key={kb.id} className="flex flex-col">
                            <CardHeader className="pb-3">
                                <div className="flex justify-between items-start gap-2">
                                    <CardTitle className="text-base leading-tight">{kb.title}</CardTitle>
                                    <Badge variant="outline" className="text-[10px] whitespace-nowrap bg-muted">
                                        {CATEGORIES[kb.category] || kb.category}
                                    </Badge>
                                </div>
                                <CardDescription className="text-xs">
                                    Сүүлд: {format(new Date(kb.updatedAt), "yyyy/MM/dd HH:mm")}
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col justify-between">
                                <p className="text-sm text-muted-foreground line-clamp-4 whitespace-pre-wrap">
                                    {kb.content}
                                </p>
                                
                                <div className="mt-4 pt-4 border-t flex justify-between items-center">
                                    <div className="text-xs text-muted-foreground truncate w-2/3" title={kb.keywords || ""}>
                                        {kb.keywords ? `Түлхүүр: ${kb.keywords}` : "Түлхүүр үггүй"}
                                    </div>
                                    <div className="flex gap-1">
                                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openForm(kb)}>
                                            <Pencil className="w-3.5 h-3.5" />
                                        </Button>
                                        <Button 
                                            variant="ghost" 
                                            size="icon" 
                                            className="h-7 w-7 text-destructive hover:text-destructive"
                                            onClick={() => {
                                                if (confirm("Устгах уу?")) deleteMutation.mutate(kb.id);
                                            }}
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </Button>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>
            )}

            {/* FORM DIALOG */}
            <Dialog open={showForm} onOpenChange={setShowForm}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>{editingId ? "Заавар засах" : "AI-д шинэ мэдлэг нэмэх"}</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="space-y-2">
                            <Label>Гарчиг (Асуулт хэлбэрээр байвал зүгээр)</Label>
                            <Input 
                                placeholder="Ж/нь: Автобус хэрхэн захиалах вэ?" 
                                value={formData.title}
                                onChange={e => setFormData(p => ({ ...p, title: e.target.value }))}
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>Ангилал</Label>
                                <Select value={formData.category} onValueChange={v => setFormData(p => ({ ...p, category: v }))}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {Object.entries(CATEGORIES).map(([key, label]) => (
                                            <SelectItem key={key} value={key}>{label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Түлхүүр үгс (Таслалаар тусгаарлах)</Label>
                                <Input 
                                    placeholder="Ж/нь: автобус, унаа, аялал" 
                                    value={formData.keywords}
                                    onChange={e => setFormData(p => ({ ...p, keywords: e.target.value }))}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label>Дэлгэрэнгүй зааварчилгаа (Алхам алхмаар бичвэл сайн)</Label>
                            <Textarea 
                                className="min-h-[200px]"
                                placeholder="1. Эхлээд ... руу орно.&#10;2. Дараа нь ... товчийг дарна."
                                value={formData.content}
                                onChange={e => setFormData(p => ({ ...p, content: e.target.value }))}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeForm}>Болих</Button>
                        <Button onClick={() => saveMutation.mutate()} disabled={!formData.title || !formData.content || saveMutation.isPending}>
                            {saveMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Хадгалах
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
