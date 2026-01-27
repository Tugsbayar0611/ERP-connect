import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { type Employee } from "@shared/schema";
import { EmployeeAllowanceForm } from "./EmployeeAllowanceForm";

export function EmployeeAllowancesDialog({ employee }: { employee: Employee }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isAdding, setIsAdding] = useState(false);

  // Fetch allowances
  const { data: allowances = [], isLoading } = useQuery({
    queryKey: ["/api/employee-allowances", employee.id],
    queryFn: async () => {
      const res = await fetch(`/api/employee-allowances?employeeId=${employee.id}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch allowances");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employee-allowances/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete allowance");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/employee-allowances", employee.id] });
      toast({ title: "Амжилттай", description: "Нэмэгдэл устгагдлаа." });
    },
  });

  return (
    <div className="space-y-6">
      <div className="p-3 bg-muted/30 rounded-lg border">
        <div className="flex justify-between items-center">
          <div>
            <p className="font-medium">{employee.firstName} {employee.lastName}</p>
            <p className="text-sm text-muted-foreground">{employee.employeeNo}</p>
          </div>
          {!isAdding && (
            <Button size="sm" onClick={() => setIsAdding(true)}>
              <Plus className="w-4 h-4 mr-2" /> Шинэ нэмэгдэл
            </Button>
          )}
        </div>
      </div>

      {isAdding ? (
        <EmployeeAllowanceForm
          employee={employee}
          onSuccess={() => setIsAdding(false)}
          onCancel={() => setIsAdding(false)}
        />
      ) : (
        <div className="space-y-4">
          <h4 className="font-medium text-sm text-muted-foreground">Бүртгэлтэй нэмэгдлүүд</h4>

          {isLoading ? (
            <div className="text-center py-4">Ачааллаж байна...</div>
          ) : allowances.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground border rounded-lg border-dashed">
              Нэмэгдэл бүртгэгдээгүй байна.
            </div>
          ) : (
            <div className="space-y-2">
              {allowances.map((allowance: any) => (
                <div key={allowance.id} className="flex items-center justify-between p-3 border rounded-lg bg-card hover:bg-muted/50 transition-colors">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{allowance.name}</span>
                      <Badge variant={allowance.isRecurring ? "default" : "secondary"}>
                        {allowance.isRecurring ? "Сар бүр" : "Нэг удаа"}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {Number(allowance.amount).toLocaleString()}₮ • {allowance.code}
                    </div>
                    <div className="flex gap-2 mt-2">
                      {allowance.isTaxable && <Badge variant="outline" className="text-[10px]">Татвартай</Badge>}
                      {allowance.isSHI && <Badge variant="outline" className="text-[10px]">НДШ</Badge>}
                      {allowance.isPIT && <Badge variant="outline" className="text-[10px]">ХХОАТ</Badge>}
                    </div>
                  </div>
                  <div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => deleteMutation.mutate(allowance.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
