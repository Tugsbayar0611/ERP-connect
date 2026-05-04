import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit2 } from "lucide-react";

const CAT_LABELS: Record<string, string> = {
  clothing: "Хувцас",
  footwear: "Гутал",
  headwear: "Малгай",
  gloves:   "Бээлий",
  eyewear:  "Нүдний шил",
  other:    "Бусад",
};

interface WorkwearItemsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: any[];
}

export default function WorkwearItemsDialog({ open, onOpenChange, items }: WorkwearItemsDialogProps) {
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);

  const [formData, setFormData] = useState({
    name: "", category: "clothing", description: "", allowancePerYear: 1, isActive: true,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/workwear/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error(await res.text());
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workwear/items"] });
      toast({ title: "Амжилттай хадгаллаа" });
      resetForm();
    },
    onError: (err: any) => toast({ title: "Алдаа гарлаа", description: err.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setIsAdding(false);
    setEditingItem(null);
    setFormData({ name: "", category: "clothing", description: "", allowancePerYear: 1, isActive: true });
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      name: item.name, category: item.category,
      description: item.description || "",
      allowancePerYear: item.allowancePerYear,
      isActive: item.isActive,
    });
    setIsAdding(true);
  };

  const handleSave = () => {
    if (!formData.name) return toast({ title: "Нэр оруулна уу", variant: "destructive" });
    saveMutation.mutate(editingItem ? { ...formData, id: editingItem.id } : formData);
  };

  return (
    <Dialog open={open} onOpenChange={(val) => { onOpenChange(val); if (!val) resetForm(); }}>
      <DialogContent className="w-[calc(100vw-2rem)] max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Нормын хувцас</DialogTitle>
        </DialogHeader>

        {!isAdding ? (
          <div className="space-y-3 mt-2">
            {/* Add button */}
            <div className="flex justify-end">
              <Button onClick={() => setIsAdding(true)} size="sm">
                <Plus className="w-4 h-4 mr-1.5" />
                Нэмэх
              </Button>
            </div>

            {/* Card list — no table, no wide headers */}
            {items.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                Бүртгэгдсэн төрөл алга байна
              </p>
            ) : (
              <div className="divide-y border rounded-xl overflow-hidden">
                {items.map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 px-4 py-3 bg-card">
                    {/* Active indicator dot */}
                    <div className={`w-2 h-2 rounded-full shrink-0 ${item.isActive ? "bg-green-500" : "bg-muted-foreground/30"}`} />
                    {/* Name + meta */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold leading-tight truncate">{item.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {CAT_LABELS[item.category] ?? "Бусад"} · <b>{item.allowancePerYear}ш</b>/жил
                      </p>
                    </div>
                    {/* Edit */}
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => handleEdit(item)}>
                      <Edit2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          // Add / Edit form
          <div className="space-y-4 mt-2 p-4 border rounded-xl bg-muted/30">
            <h3 className="text-sm font-semibold">{editingItem ? "Засах" : "Шинэ төрөл"}</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Нэр *</Label>
                <Input
                  placeholder="Жишээ: Өвлийн куртка"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Ангилал</Label>
                <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clothing">Хувцас</SelectItem>
                    <SelectItem value="footwear">Гутал</SelectItem>
                    <SelectItem value="headwear">Малгай/Каск</SelectItem>
                    <SelectItem value="gloves">Бээлий</SelectItem>
                    <SelectItem value="eyewear">Нүдний шил</SelectItem>
                    <SelectItem value="other">Бусад</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Норм (ш/жил)</Label>
                <Input
                  type="number" min={1}
                  value={formData.allowancePerYear}
                  onChange={e => setFormData({ ...formData, allowancePerYear: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs">Тэмдэглэл (заавал биш)</Label>
                <Input
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="outline" size="sm" onClick={resetForm}>Болих</Button>
              <Button size="sm" onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Хадгалж байна..." : "Хадгалах"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
