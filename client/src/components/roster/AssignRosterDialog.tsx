
import React, { useState } from "react";
import { useEmployees } from "@/hooks/use-employees";
import { useRosters, useRosterAssignments, useAssignRoster } from "@/hooks/use-roster";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface AssignRosterDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function AssignRosterDialog({ open, onOpenChange }: AssignRosterDialogProps) {
    const { employees } = useEmployees(); // Fetch employees
    const { rostersQuery } = useRosters(); // Fetch rosters
    const { bulkAssignMutation } = useAssignRoster(); // Mutation

    const [employeeId, setEmployeeId] = useState<string>("");
    const [rosterId, setRosterId] = useState<string>("");
    const [startDate, setStartDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));

    const { toast } = useToast();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!employeeId || !rosterId || !startDate) {
            toast({
                title: "Алдаа",
                description: "Бүх талбарыг бөглөнө үү",
                variant: "destructive"
            });
            return;
        }

        try {
            await bulkAssignMutation.mutateAsync([
                {
                    employeeId,
                    rosterId,
                    startDate,
                    endDate: null // Indefinite assignment
                }
            ]);

            toast({
                title: "Амжилттай",
                description: "Ээлж амжилттай оноогдлоо",
            });
            onOpenChange(false);

            // Reset form
            setEmployeeId("");
            setRosterId("");
        } catch (error) {
            // Error is handled by global query client or hook usually, 
            // but we can catch specific ones here
            console.error(error);
        }
    };

    const rosters = rostersQuery.data || [];
    const empList = employees || [];

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Ээлж оноох</DialogTitle>
                    <DialogDescription>
                        Ажилтанд ээлжийн хуваарь оноох.
                    </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="space-y-2">
                        <Label>Ажилтан сонгох</Label>
                        <Select value={employeeId} onValueChange={setEmployeeId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Ажилтан..." />
                            </SelectTrigger>
                            <SelectContent>
                                {empList.map((emp: any) => (
                                    <SelectItem key={emp.id} value={emp.id}>
                                        {emp.firstName} {emp.lastName} ({emp.position?.title || 'Unknown'})
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Ээлж сонгох (Roster)</Label>
                        <Select value={rosterId} onValueChange={setRosterId}>
                            <SelectTrigger>
                                <SelectValue placeholder="Хуваарь..." />
                            </SelectTrigger>
                            <SelectContent>
                                {rosters.length === 0 && <div className="p-2 text-xs text-muted-foreground">Хуваарь байхгүй байна</div>}
                                {rosters.map((r: any) => (
                                    <SelectItem key={r.id} value={r.id}>
                                        {r.name} ({r.cycleDays} хоног)
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>Эхлэх огноо</Label>
                        <Input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                        />
                    </div>

                    <DialogFooter>
                        <Button type="submit" disabled={bulkAssignMutation.isPending}>
                            {bulkAssignMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Оноох
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
