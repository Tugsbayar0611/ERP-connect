import { useState } from "react";
import { useAuditLogs } from "@/hooks/use-audit-logs";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, FileText, Eye, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const actionColors: Record<string, string> = {
  create: "bg-green-500/10 text-green-700 dark:text-green-400",
  update: "bg-blue-500/10 text-blue-700 dark:text-blue-400",
  delete: "bg-red-500/10 text-red-700 dark:text-red-400",
  post: "bg-purple-500/10 text-purple-700 dark:text-purple-400",
  reverse: "bg-orange-500/10 text-orange-700 dark:text-orange-400",
  cancel: "bg-gray-500/10 text-gray-700 dark:text-gray-400",
};

const entityTypeLabels: Record<string, string> = {
  invoice: "Нэхэмжлэх",
  payment: "Төлбөр",
  journal_entry: "Журналын бичилт",
  employee: "Ажилтан",
  product: "Бараа",
};

export default function AuditLogs() {
  const [entityType, setEntityType] = useState<string>("all");
  const [action, setAction] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const filters = {
    entityType: entityType && entityType !== "all" ? entityType : undefined,
    action: action && action !== "all" ? action : undefined,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    limit: 500,
  };

  const { data: logs = [], isLoading } = useAuditLogs(filters);

  const filteredLogs = logs.filter((log) => {
    if (!search) return true;
    const searchLower = search.toLowerCase();
    return (
      log.message?.toLowerCase().includes(searchLower) ||
      log.entityId?.toLowerCase().includes(searchLower) ||
      log.actorUserId?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="space-y-8 animate-in-fade">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight font-display bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            Хяналтын бүртгэл
          </h2>
          <p className="text-muted-foreground">
            Бүх өөрчлөлтийн түүх болон хяналтын бүртгэл
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card p-4 rounded-lg space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Хайх..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>

          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger>
              <SelectValue placeholder="Бүх төрөл" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх төрөл</SelectItem>
              <SelectItem value="invoice">Нэхэмжлэх</SelectItem>
              <SelectItem value="payment">Төлбөр</SelectItem>
              <SelectItem value="journal_entry">Журналын бичилт</SelectItem>
              <SelectItem value="employee">Ажилтан</SelectItem>
              <SelectItem value="product">Бараа</SelectItem>
            </SelectContent>
          </Select>

          <Select value={action} onValueChange={setAction}>
            <SelectTrigger>
              <SelectValue placeholder="Бүх үйлдэл" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Бүх үйлдэл</SelectItem>
              <SelectItem value="create">Үүсгэх</SelectItem>
              <SelectItem value="update">Засах</SelectItem>
              <SelectItem value="delete">Устгах</SelectItem>
              <SelectItem value="post">Бүртгэх</SelectItem>
              <SelectItem value="reverse">Буцаах</SelectItem>
              <SelectItem value="cancel">Цуцлах</SelectItem>
            </SelectContent>
          </Select>

          <Input
            type="date"
            placeholder="Эхлэх огноо"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
          />

          <Input
            type="date"
            placeholder="Дуусах огноо"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="glass-card rounded-lg border overflow-hidden">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="text-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">Хяналтын бүртгэл олдсонгүй</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Огноо</TableHead>
                <TableHead>Төрөл</TableHead>
                <TableHead>Үйлдэл</TableHead>
                <TableHead>Тайлбар</TableHead>
                <TableHead>Хэрэглэгч</TableHead>
                <TableHead>Төлөв</TableHead>
                <TableHead>Дэлгэрэнгүй</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLogs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>
                    {log.eventTime
                      ? format(new Date(log.eventTime), "yyyy-MM-dd HH:mm:ss")
                      : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {entityTypeLabels[log.entityType] || log.entityType}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge
                      className={
                        actionColors[log.action] ||
                        "bg-gray-500/10 text-gray-700 dark:text-gray-400"
                      }
                    >
                      {log.action}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-xs truncate" title={log.message || undefined}>
                    {log.message || "-"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {log.actorUserId ? log.actorUserId.substring(0, 8) + "..." : "-"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={log.status === "success" ? "default" : "destructive"}
                    >
                      {log.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedLog(log)}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!selectedLog} onOpenChange={(open) => !open && setSelectedLog(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Хяналтын бүртгэлийн дэлгэрэнгүй</DialogTitle>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Огноо</p>
                  <p className="font-semibold">
                    {selectedLog.eventTime
                      ? format(new Date(selectedLog.eventTime), "yyyy-MM-dd HH:mm:ss")
                      : "-"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Төрөл</p>
                  <p className="font-semibold">
                    {entityTypeLabels[selectedLog.entityType] || selectedLog.entityType}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Үйлдэл</p>
                  <Badge
                    className={
                      actionColors[selectedLog.action] ||
                      "bg-gray-500/10 text-gray-700 dark:text-gray-400"
                    }
                  >
                    {selectedLog.action}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Төлөв</p>
                  <Badge
                    variant={selectedLog.status === "success" ? "default" : "destructive"}
                  >
                    {selectedLog.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Entity ID</p>
                  <p className="font-mono text-sm">{selectedLog.entityId || "-"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Хэрэглэгч ID</p>
                  <p className="font-mono text-sm">
                    {selectedLog.actorUserId || "-"}
                  </p>
                </div>
              </div>

              {selectedLog.message && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Тайлбар</p>
                  <p className="text-sm">{selectedLog.message}</p>
                </div>
              )}

              {selectedLog.beforeData && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Өмнөх өгөгдөл</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.beforeData, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.afterData && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Шинэ өгөгдөл</p>
                  <pre className="text-xs bg-muted p-3 rounded overflow-auto max-h-40">
                    {JSON.stringify(selectedLog.afterData, null, 2)}
                  </pre>
                </div>
              )}

              {(selectedLog.ip || selectedLog.userAgent) && (
                <div className="grid grid-cols-2 gap-4">
                  {selectedLog.ip && (
                    <div>
                      <p className="text-sm text-muted-foreground">IP хаяг</p>
                      <p className="font-mono text-sm">{selectedLog.ip}</p>
                    </div>
                  )}
                  {selectedLog.userAgent && (
                    <div>
                      <p className="text-sm text-muted-foreground">User Agent</p>
                      <p className="text-xs break-all">{selectedLog.userAgent}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
