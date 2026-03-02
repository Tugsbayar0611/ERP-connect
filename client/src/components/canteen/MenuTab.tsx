
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function MenuTab() {
    const queryClient = useQueryClient();
    const { toast } = useToast();
    const [date, setDate] = useState(new Date().toISOString().split("T")[0]);

    // Fetch Menu for Date
    const { data: menu, isLoading } = useQuery({
        queryKey: ['canteen.menu', date],
        queryFn: async () => {
            const res = await apiRequest("GET", `/api/canteen/admin/menu?date=${date}`);
            return res.json(); // Expected: { lunch: { price: 5000, items: [] }, dinner: { ... } }
        }
    });

    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            await apiRequest("POST", "/api/canteen/admin/menu", data);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['canteen.menu', date] });
            toast({ title: "Амжилттай", description: "Цэс шинэчлэгдлээ" });
        },
        onError: () => {
            toast({ title: "Алдаа", description: "Хадгалж чадсангүй", variant: "destructive" });
        }
    });

    const handleSavePrice = (type: 'lunch' | 'dinner', price: number, items: string[]) => {
        saveMutation.mutate({ date, mealType: type, price, items });
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4 bg-muted/20 p-4 rounded-lg border">
                <span className="font-medium text-sm">Огноо сонгох:</span>
                <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-48 bg-background"
                />
            </div>

            {isLoading ? (
                <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
            ) : (
                <div className="grid md:grid-cols-2 gap-6">
                    {/* LUNCH CARD */}
                    <MenuCard
                        title="Өдрийн хоол (Lunch)"
                        type="lunch"
                        defaultPrice={menu?.lunch?.price || 0}
                        defaultItems={menu?.lunch?.items || []}
                        onSave={handleSavePrice}
                        status={menu?.lunch ? "Бүртгэгдсэн" : "Хоосон"}
                    />

                    {/* DINNER CARD */}
                    <MenuCard
                        title="Оройн хоол (Dinner)"
                        type="dinner"
                        defaultPrice={menu?.dinner?.price || 0}
                        defaultItems={menu?.dinner?.items || []}
                        onSave={handleSavePrice}
                        status={menu?.dinner ? "Бүртгэгдсэн" : "Хоосон"}
                    />
                </div>
            )}

            <div className="text-xs text-muted-foreground p-2">
                * Энд тохируулсан үнэ нь "Гараар хоол нэмэх" хэсэгт автоматаар бөглөгдөнө.
            </div>
        </div>
    );
}

function MenuCard({ title, type, defaultPrice, defaultItems, onSave, status }: any) {
    const [price, setPrice] = useState(defaultPrice);
    const [items, setItems] = useState<string[]>(defaultItems || []);
    const [newItem, setNewItem] = useState("");

    // Sync state when data fetches
    useState(() => {
        setPrice(defaultPrice);
        setItems(defaultItems || []);
    });

    const handleAddItem = () => {
        if (!newItem.trim()) return;
        const updated = [...items, newItem.trim()];
        setItems(updated);
        setNewItem("");
    };

    const handleRemoveItem = (index: number) => {
        const updated = items.filter((_, i) => i !== index);
        setItems(updated);
    };

    const handleSave = () => {
        onSave(type, price, items);
    };

    return (
        <Card className="border-l-4 border-l-primary/50 shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="pt-6 space-y-4">
                <div className="flex justify-between items-start">
                    <h3 className="font-bold text-lg">{title}</h3>
                    <span className={`text-[10px] px-2 py-1 rounded-full ${status === 'Бүртгэгдсэн' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                        {status}
                    </span>
                </div>

                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="text-sm text-muted-foreground font-medium">Стандарт Үнэ ₮</label>
                        <Input
                            type="number"
                            value={price}
                            onChange={(e) => setPrice(Number(e.target.value))}
                            className="font-mono text-lg"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-sm text-muted-foreground font-medium">Хоолны нэрс</label>
                        <div className="flex gap-2">
                            <Input
                                value={newItem}
                                onChange={(e) => setNewItem(e.target.value)}
                                placeholder="Ж: Банштай цай"
                                onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                            />
                            <Button variant="outline" onClick={handleAddItem}>+</Button>
                        </div>
                        <div className="space-y-1 mt-2">
                            {items.map((item, idx) => (
                                <div key={idx} className="flex justify-between items-center bg-muted/50 p-2 rounded text-sm">
                                    <span>{item}</span>
                                    <button onClick={() => handleRemoveItem(idx)} className="text-red-500 hover:text-red-700">×</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    <Button onClick={handleSave} className="w-full">Хадгалах</Button>
                </div>
            </CardContent>
        </Card>
    )
}
