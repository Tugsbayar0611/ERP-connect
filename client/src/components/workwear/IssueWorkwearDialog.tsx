import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { Loader2, PackageCheck, AlertCircle } from "lucide-react";

interface FulfillWorkwearDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  items: any[];
}

export default function IssueWorkwearDialog({ open, onOpenChange, items }: FulfillWorkwearDialogProps) {
  const queryClient = useQueryClient();
  const [employeeId, setEmployeeId] = useState("");
  const [issuanceId, setIssuanceId] = useState("");
  const [size, setSize] = useState("");

  // Fetch employees
  const { data: employeesData = [] } = useQuery({
    queryKey: ["/api/employees"],
    enabled: open,
  });
  const employees = employeesData as any[];

  // Fetch specific employee's workwear info (pending vs history)
  const { data: employeeWorkwear, isFetching: isLoadingEligibility } = useQuery({
    // Using a different query just for this? No, we can use the /my endpoint but we need it for a specific employee!
    // Wait, the API only has /my for the CURRENT user. 
    // We need an endpoint for HR/Warehouse to get specific employee's pending!
    queryKey: ["/api/workwear/employee", employeeId],
    queryFn: async () => {
      const res = await fetch(`/api/workwear/employee/${employeeId}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!employeeId && open,
  });

  const pendingItems = employeeWorkwear?.pending || [];

  const fulfillMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/workwear/fulfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Алдаа гарлаа");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/workwear/issuances"] });
      queryClient.invalidateQueries({ queryKey: ["/api/workwear/employee"] });
      toast({
        title: "Амжилттай!",
        description: "Хувцсыг хүлээлгэн өглөө.",
      });
      handleClose();
    },
    onError: (err: any) => {
      toast({ title: "Алдаа", description: err.message, variant: "destructive" });
    },
  });

  const handleClose = () => {
    onOpenChange(false);
    setEmployeeId("");
    setIssuanceId("");
    setSize("");
  };

  const handleFulfill = () => {
    if (!issuanceId) return;
    fulfillMutation.mutate({
      issuanceId,
      size,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-primary" />
            Агуулахаас олгох (Хүлээлгэн өгөх)
          </DialogTitle>
          <DialogDescription>
            Эрх нь нээгдсэн ажилтанд хувцсыг биечлэн өгч бүртгэх
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Ажилтан сонгох</Label>
            <Select value={employeeId} onValueChange={(val) => {
              setEmployeeId(val);
              setIssuanceId("");
              setSize("");
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Ажилтан хайх..." />
              </SelectTrigger>
              <SelectContent>
                {employees.map((emp: any) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.lastName?.[0]}. {emp.firstName} {emp.employeeNo ? `(№${emp.employeeNo})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoadingEligibility ? (
            <div className="flex items-center justify-center p-4">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : employeeId ? (
            pendingItems.length === 0 ? (
              <div className="p-4 rounded-lg bg-orange-50 dark:bg-orange-950/30 border border-orange-200 dark:border-orange-900 text-sm text-orange-800 dark:text-orange-300 flex items-center gap-2">
                <AlertCircle className="w-4 h-4" />
                Энэ ажилтанд олгох (эрх нээгдсэн) хувцас байхгүй байна.
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Олгох хувцас (Эрх нээгдсэн)</Label>
                  <Select value={issuanceId} onValueChange={setIssuanceId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Хувцас сонгоно уу" />
                    </SelectTrigger>
                    <SelectContent>
                      {pendingItems.map((iss: any) => (
                        <SelectItem key={iss.id} value={iss.id}>
                          {iss.item?.name} ({iss.quantity}ш)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Хэмжээ бичих (Заавал биш)</Label>
                  <Input
                    placeholder="Жишээ нь: 42, XL..."
                    value={size}
                    onChange={(e) => setSize(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    Олгож буй яг бодит хэмжээг энд бичиж үлдээнэ.
                  </p>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={handleClose}>Цуцлах</Button>
                  <Button
                    onClick={handleFulfill}
                    disabled={!issuanceId || fulfillMutation.isPending}
                  >
                    {fulfillMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                    Хүлээлгэн өгсөн
                  </Button>
                </div>
              </>
            )
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
