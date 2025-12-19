import { useAttendance } from "@/hooks/use-attendance";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function Attendance() {
  const { attendance, isLoading } = useAttendance();

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold tracking-tight font-display">Attendance</h2>
        <p className="text-muted-foreground mt-1">Track employee check-ins and work hours.</p>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Date</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead>Check In</TableHead>
              <TableHead>Check Out</TableHead>
              <TableHead>Work Hours</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : attendance?.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No records found.</TableCell></TableRow>
            ) : (
              attendance?.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    {format(new Date(record.date), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell>EMP-{record.employeeId}</TableCell>
                  <TableCell>
                    {record.checkIn ? format(new Date(record.checkIn), "h:mm a") : "—"}
                  </TableCell>
                  <TableCell>
                    {record.checkOut ? format(new Date(record.checkOut), "h:mm a") : "—"}
                  </TableCell>
                  <TableCell>{record.workHours?.toFixed(1) || "0"} hrs</TableCell>
                  <TableCell>
                    <Badge variant={record.status === "Present" ? "default" : "secondary"}>
                      {record.status}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
