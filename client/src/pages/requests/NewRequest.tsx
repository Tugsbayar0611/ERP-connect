
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon, ArrowLeft, Loader2, Plane, FileText, Package, Bus } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const REQUEST_TYPES = [
    { id: 'leave', label: 'Чөлөө авах', icon: Plane, desc: 'Ээлжийн амралт, өвчтэй, цалингүй чөлөө' },
    { id: 'official_letter', label: 'Тодорхойлолт авах', icon: FileText, desc: 'Ажлын байрны тодорхойлолт, визний дэмжлэг' },
    { id: 'asset_request', label: 'Эд хөрөнгө хүсэх', icon: Package, desc: 'Ноутбук, дэлгэц, тавилга гэх мэт' },
    { id: 'transport_request', label: 'Унаа захиалах', icon: Bus, desc: 'Ажлын хэрэгцээгээр унаа захиалах' },
];

export default function NewRequest() {
    const [location, setLocation] = useLocation();
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [formData, setFormData] = useState<any>({});

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await fetch("/api/requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data)
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.message || "Failed");
            }
            return res.json();
        },
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ["/api/requests"] });
            toast({ title: "Ноорог үүслээ", description: "Хүсэлтийн ноорог амжилттай хадгалагдлаа." });
            setLocation(`/me/requests/${data.id}`); // Go to details to submit
        },
        onError: (e: Error) => toast({ title: "Алдаа", description: e.message, variant: "destructive" })
    });

    const handleSubmit = () => {
        if (!selectedType) return;

        let title = `${REQUEST_TYPES.find(t => t.id === selectedType)?.label}`;
        if (selectedType === 'official_letter') title += ` for ${formData.recipient || 'Unknown'}`;
        if (selectedType === 'leave') title += ` (${formData.leaveType || 'General'})`;

        createMutation.mutate({
            type: selectedType,
            title,
            payload: formData
        });
    };

    const updateField = (key: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [key]: value }));
    };

    if (!selectedType) {
        return (
            <div className="container mx-auto p-4 md:p-8 space-y-6">
                <Button variant="ghost" onClick={() => setLocation("/me/requests")} className="mb-4">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Буцах
                </Button>
                <div>
                    <h1 className="text-3xl font-bold">Шинэ хүсэлт</h1>
                    <p className="text-muted-foreground">Үүсгэх хүсэлтийн төрлөө сонгоно уу.</p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
                    {REQUEST_TYPES.map(type => (
                        <Card
                            key={type.id}
                            className="cursor-pointer hover:border-primary transition-all hover:shadow-md"
                            onClick={() => setSelectedType(type.id)}
                        >
                            <CardHeader>
                                <type.icon className="h-8 w-8 mb-2 text-primary" />
                                <CardTitle>{type.label}</CardTitle>
                                <CardDescription>{type.desc}</CardDescription>
                            </CardHeader>
                        </Card>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4 md:p-8 space-y-6 max-w-2xl">
            <Button variant="ghost" onClick={() => setSelectedType(null)} className="mb-4">
                <ArrowLeft className="mr-2 h-4 w-4" /> Төрөл сонгох руу буцах
            </Button>

            <Card>
                <CardHeader>
                    <CardTitle>{REQUEST_TYPES.find(t => t.id === selectedType)?.label} үүсгэх</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">

                    {/* LEAVE FORM */}
                    {selectedType === 'leave' && (
                        <>
                            <div className="space-y-2">
                                <Label>Чөлөөний төрөл</Label>
                                <Select onValueChange={v => updateField('leaveType', v)}>
                                    <SelectTrigger><SelectValue placeholder="Төрөл сонгох" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="annual">Ээлжийн амралт</SelectItem>
                                        <SelectItem value="sick">Өвчтэй / Эмнэлгийн хуудас</SelectItem>
                                        <SelectItem value="unpaid">Цалингүй чөлөө</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Эхлэх огноо</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !formData.startDate && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {formData.startDate ? format(formData.startDate, "PPP") : <span>Огноо сонгох</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.startDate} onSelect={v => updateField('startDate', v)} initialFocus /></PopoverContent>
                                    </Popover>
                                </div>
                                <div className="space-y-2">
                                    <Label>Дуусах огноо</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !formData.endDate && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {formData.endDate ? format(formData.endDate, "PPP") : <span>Огноо сонгох</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={formData.endDate} onSelect={v => updateField('endDate', v)} initialFocus /></PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label>Шалтгаан</Label>
                                <Textarea onChange={e => updateField('reason', e.target.value)} placeholder="Чөлөө авах шалтгаанаа бичнэ үү..." />
                            </div>
                        </>
                    )}

                    {/* OFFICIAL LETTER FORM */}
                    {selectedType === 'official_letter' && (
                        <>
                            <div className="space-y-2">
                                <Label>Хүлээн авах байгууллагын нэр</Label>
                                <Input onChange={e => updateField('recipient', e.target.value)} placeholder="Жнь: Голомт банк" />
                            </div>
                            <div className="space-y-2">
                                <Label>Хэл</Label>
                                <Select onValueChange={v => updateField('language', v)}>
                                    <SelectTrigger><SelectValue placeholder="Хэл сонгох" /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="mn">Монгол</SelectItem>
                                        <SelectItem value="en">Англи</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Зорилго / Дэлгэрэнгүй</Label>
                                <Textarea onChange={e => updateField('purpose', e.target.value)} placeholder="Визний мэдүүлэгт зориулав..." />
                            </div>
                        </>
                    )}

                    {/* GENERIC FALLBACK */}
                    {!['leave', 'official_letter'].includes(selectedType) && (
                        <div className="space-y-2">
                            <Label>Тайлбар / Дэлгэрэнгүй</Label>
                            <Textarea onChange={e => updateField('description', e.target.value)} placeholder="Хүсэлтийн талаар дэлгэрэнгүй бичнэ үү..." className="h-32" />
                        </div>
                    )}

                    <div className="pt-4 flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setSelectedType(null)}>Цуцлах</Button>
                        <Button onClick={handleSubmit} disabled={createMutation.isPending}>
                            {createMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Ноорог үүсгэх
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
