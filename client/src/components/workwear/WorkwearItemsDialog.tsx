import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Plus, Edit2 } from "lucide-react";

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
    name: "",
    category: "clothing",
    description: "",
    allowancePerYear: 1,
    isActive: true,
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
    onError: (err: any) => {
      toast({ title: "Алдаа гарлаа", description: err.message, variant: "destructive" });
    }
  });

  const resetForm = () => {
    setIsAdding(false);
    setEditingItem(null);
    setFormData({
      name: "",
      category: "clothing",
      description: "",
      allowancePerYear: 1,
      isActive: true,
    });
  };

  const handleEdit = (item: any) => {
    setEditingItem(item);
    setFormData({
      name: item.name,
      category: item.category,
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
    <Dialog open={open} onOpenChange={(val) => {
      onOpenChange(val);
      if (!val) resetForm();
    }}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Хувцасны төрөл ба Норм</DialogTitle>
          <DialogDescription>
            Уурхайн ажилчдад олгох хувцас хэрэгслийн жагсаалт, тэдгээрийн жилийн нормын тохиргоо.
          </DialogDescription>
        </DialogHeader>

        {!isAdding ? (
          <div className="space-y-4 mt-4">
            <div className="flex justify-end">
              <Button onClick={() => setIsAdding(true)} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Шинээр нэмэх
              </Button>
            </div>
            
            <div className="border rounded-md">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Нэр</TableHead>
                    <TableHead>Ангилал</TableHead>
                    <TableHead>Жилийн норм (ш)</TableHead>
                    <TableHead>Төлөв</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-4 text-muted-foreground">Одоогоор бүртгэгдсэн төрөл алга</TableCell>
                    </TableRow>
                  ) : (
                    items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="font-medium">{item.name}</TableCell>
                        <TableCell>{
                          item.category === "clothing" ? "Хувцас" :
                          item.category === "footwear" ? "Гутал" :
                          item.category === "headwear" ? "Малгай" :
                          item.category === "gloves" ? "Бээлий" :
                          item.category === "eyewear" ? "Нүдний шил" : "Бусад"
                        }</TableCell>
                        <TableCell>{item.allowancePerYear}</TableCell>
                        <TableCell>{item.isActive ? "Идэвхтэй" : "Идэвхгүй"}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(item)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mt-4 p-4 border rounded-md bg-muted/30">
            <h3 className="font-medium">{editingItem ? "Төрөл засах" : "Шинэ төрөл нэмэх"}</h3>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Нэр</Label>
                <Input 
                  placeholder="Жинхэнэ нэр (Жишээ: Өвлийн куртка)"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Ангилал</Label>
                <Select value={formData.category} onValueChange={v => setFormData({ ...formData, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="clothing">Хувцас</SelectItem>
                    <SelectItem value="footwear">Гутал</SelectItem>
                    <SelectItem value="headwear">Малгай/Каск</SelectItem>
                    <SelectItem value="gloves">Бээлий</SelectItem>
                    <SelectItem value="eyewear">Нүдний шил</SelectItem>
                    <SelectItem value="other">Бусад хэрэгсэл</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Жилийн норм (Ширхэгээр)</Label>
                <Input 
                  type="number" min={1}
                  value={formData.allowancePerYear}
                  onChange={e => setFormData({ ...formData, allowancePerYear: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div className="space-y-2">
                <Label>Дэлгэрэнгүй (Заавал биш)</Label>
                <Input 
                  value={formData.description}
                  onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={resetForm}>Буцах</Button>
              <Button onClick={handleSave} disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Хадгалж байна..." : "Хадгалах"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
