
import { format, differenceInDays } from "date-fns";
import { Calendar as CalendarIcon, FileText, CheckCircle2, ListFilter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { RequestItem, REQUEST_LABELS, STATUS_LABELS } from "@/types/requests";

interface RequestsListProps {
    requests: RequestItem[];
    isLoading: boolean;
    onView?: (request: RequestItem) => void;
    showRequester?: boolean;
    activeTab?: "my" | "approvals";
    onCancel?: (request: RequestItem) => void;
    onCreateNew?: () => void;
}

const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 hover:bg-amber-100/80 border-amber-200 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-800",
    approved: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100/80 border-emerald-200 dark:bg-emerald-900/40 dark:text-emerald-300 dark:border-emerald-800",
    rejected: "bg-rose-100 text-rose-700 hover:bg-rose-100/80 border-rose-200 dark:bg-rose-900/40 dark:text-rose-300 dark:border-rose-800",
    cancelled: "bg-slate-100 text-slate-700 hover:bg-slate-100/80 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

export function RequestsList({ requests, isLoading, onView, showRequester, activeTab = "my", onCancel, onCreateNew }: RequestsListProps) {
    if (isLoading) {
        return (
            <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted/40 animate-pulse rounded-lg" />
                ))}
            </div>
        );
    }

    if (requests.length === 0) {
        if (activeTab === "my") {
            return (
                <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl shadow-sm border text-center animate-fade-in">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <FileText className="w-8 h-8 text-muted-foreground opacity-50" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground">Та одоогоор хүсэлт илгээгээгүй байна</h3>
                    <p className="text-muted-foreground mt-2 max-w-sm mb-4">
                        Шинэ хүсэлт үүсгэхийн тулд доорх товчийг дарна уу.
                    </p>
                    {onCreateNew && (
                        <Button onClick={onCreateNew}>
                            + Шинэ хүсэлт үүсгэх
                        </Button>
                    )}
                </div>
            );
        } else if (activeTab === "approvals") {
            return (
                <div className="text-center py-12 text-muted-foreground border rounded-lg bg-muted/5 border-dashed">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>Танд одоогоор зөвшөөрөх хүсэлт алга байна.</p>
                </div>
            );
        } else {
            // Fallback for when "All" filters return nothing
            return (
                <div className="flex flex-col items-center justify-center p-12 bg-card rounded-xl shadow-sm border text-center animate-fade-in">
                    <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                        <ListFilter className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-medium text-foreground">Хүсэлт олдсонгүй</h3>
                    <p className="text-muted-foreground mt-2 max-w-sm">
                        Таны хайсан шүүлтүүрт тохирох хүсэлт байхгүй байна.
                    </p>
                </div>
            );
        }
    }

    return (
        <div className="border rounded-lg overflow-hidden">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>Төрөл</TableHead>
                        {showRequester && <TableHead>Ажилтан</TableHead>}
                        <TableHead>Хугацаа</TableHead>
                        <TableHead>Хоног</TableHead>
                        <TableHead>Шалтгаан/Тайлбар</TableHead>
                        <TableHead>Төлөв</TableHead>
                        <TableHead className="text-right">Огноо / Үйлдэл</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {requests.map((req) => (
                        <TableRow key={req.id} className="cursor-pointer hover:bg-muted/50 group" onClick={() => onView?.(req)}>
                            <TableCell>
                                <div className="font-medium">{REQUEST_LABELS[req.type] || req.type}</div>
                            </TableCell>
                            {showRequester && (
                                <TableCell>
                                    <div className="font-medium text-sm">{req.requestedBy?.fullName}</div>
                                    <div className="text-xs text-muted-foreground">{req.requestedBy?.department}</div>
                                </TableCell>
                            )}
                            <TableCell>
                                {req.startDate && req.endDate ? (
                                    <div className="flex items-center text-sm">
                                        <CalendarIcon className="w-3 h-3 mr-2 opacity-70" />
                                        {format(new Date(req.startDate), "yyyy.MM.dd")}
                                        {req.startDate !== req.endDate && ` - ${format(new Date(req.endDate), "yyyy.MM.dd")}`}
                                    </div>
                                ) : (
                                    <span className="text-muted-foreground">-</span>
                                )}
                            </TableCell>
                            <TableCell>
                                {req.startDate && req.endDate ? (
                                    differenceInDays(new Date(req.endDate), new Date(req.startDate)) + 1
                                ) : "-"}
                            </TableCell>
                            <TableCell className="max-w-[200px] truncate text-muted-foreground" title={req.details || req.title}>
                                {req.details || req.title}
                            </TableCell>
                            <TableCell>
                                <Badge variant="outline" className={statusColors[req.status]}>
                                    {STATUS_LABELS[req.status] || req.status}
                                </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                                <div className="flex items-center justify-end gap-2">
                                    <span className="text-xs text-muted-foreground group-hover:hidden">
                                        {format(new Date(req.createdAt), "yyyy.MM.dd")}
                                    </span>
                                    {/* Action Buttons visible on hover */}
                                    <div className="hidden group-hover:flex items-center gap-2">
                                        {activeTab === "my" && req.status === "pending" && onCancel && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-7 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={(e) => { e.stopPropagation(); onCancel(req); }}
                                            >
                                                Цуцлах
                                            </Button>
                                        )}
                                        {/* Placeholder for Approvals - handled by parent onClick (drawer) */}
                                    </div>
                                </div>
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    );
}
