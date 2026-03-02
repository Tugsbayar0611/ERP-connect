import React, { useState } from "react";
import { useJobTitles } from "@/hooks/use-employees";
import { useDepartments } from "@/hooks/use-departments";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Plus, Briefcase, Search, Filter } from "lucide-react";
import { AddJobTitleDialog } from "@/components/employees/AddJobTitleDialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";

export function JobTitlesSettings() {
    const { data: jobTitles = [], isLoading, toggleStatus } = useJobTitles();
    const { departments = [] } = useDepartments();
    const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    const getDepartmentName = (id?: string) => {
        if (!id) return "-";
        return departments.find(d => d.id === id)?.name || "-";
    };

    const filteredTitles = jobTitles.filter(t =>
        t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (t.code || "").toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleToggle = async (id: string, currentStatus: boolean) => {
        try {
            await toggleStatus.mutateAsync({ id, isActive: !currentStatus });
        } catch (error) {
            console.error("Failed to toggle job title status:", error);
        }
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <div className="space-y-1">
                        <CardTitle className="text-2xl flex items-center gap-2">
                            <Briefcase className="w-6 h-6 text-primary" />
                            Албан тушаалын удирдлага
                        </CardTitle>
                        <CardDescription>
                            Байгууллагын албан тушаалын жагсаалтыг удирдах, идэвхгүй болгох
                        </CardDescription>
                    </div>
                    <Button onClick={() => setIsAddDialogOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Шинэ албан тушаал
                    </Button>
                </CardHeader>
                <CardContent>
                    <div className="flex items-center gap-4 mb-6">
                        <div className="relative flex-1">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                            <Input
                                placeholder="Нэр эсвэл кодоор хайх..."
                                className="pl-9"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="border rounded-md">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Албан тушаалын нэр</TableHead>
                                    <TableHead>Код</TableHead>
                                    <TableHead>Хэлтэс</TableHead>
                                    <TableHead>Төлөв</TableHead>
                                    <TableHead className="text-right">Үйлдэл</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoading ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                            Ачааллаж байна...
                                        </TableCell>
                                    </TableRow>
                                ) : filteredTitles.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="h-24 text-center text-muted-foreground">
                                            Албан тушаал олдсонгүй.
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredTitles.map((title) => (
                                        <TableRow key={title.id}>
                                            <TableCell className="font-medium">
                                                {title.name}
                                            </TableCell>
                                            <TableCell>
                                                <code className="px-1 py-0.5 bg-muted rounded text-xs">
                                                    {title.code}
                                                </code>
                                            </TableCell>
                                            <TableCell>
                                                {getDepartmentName(title.departmentId || undefined)}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant={title.isActive ? "default" : "secondary"}>
                                                    {title.isActive ? "Идэвхтэй" : "Идэвхгүй"}
                                                </Badge>
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <span className="text-xs text-muted-foreground">
                                                        {title.isActive ? "Идэвхгүй болгох" : "Идэвхжүүлэх"}
                                                    </span>
                                                    <Switch
                                                        checked={title.isActive}
                                                        onCheckedChange={() => handleToggle(title.id, title.isActive)}
                                                        disabled={toggleStatus.isPending}
                                                    />
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>
                </CardContent>
            </Card>

            <AddJobTitleDialog
                open={isAddDialogOpen}
                onOpenChange={setIsAddDialogOpen}
            />
        </div>
    );
}
