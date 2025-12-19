import { usePayroll } from "@/hooks/use-payroll";
import { format } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function Payroll() {
  const { payroll, isLoading } = usePayroll();

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight font-display">Payroll</h2>
          <p className="text-muted-foreground mt-1">Salary processing and history.</p>
        </div>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Process Payroll
        </Button>
      </div>

      <div className="bg-card rounded-xl border shadow-sm overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Period</TableHead>
              <TableHead>Employee ID</TableHead>
              <TableHead className="text-right">Base Salary</TableHead>
              <TableHead className="text-right">Bonus/Allowances</TableHead>
              <TableHead className="text-right">Deductions</TableHead>
              <TableHead className="text-right font-bold">Net Salary</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8">Loading...</TableCell></TableRow>
            ) : payroll?.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No payroll records found.</TableCell></TableRow>
            ) : (
              payroll?.map((record) => (
                <TableRow key={record.id}>
                  <TableCell className="font-medium">
                    {format(new Date(record.periodStart), "MMM yyyy")}
                  </TableCell>
                  <TableCell>EMP-{record.employeeId}</TableCell>
                  <TableCell className="text-right">${(record.baseSalary || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right text-green-600">
                    +${((record.bonus || 0) + (record.allowances || 0)).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-red-600">
                    -${((record.tax || 0) + (record.socialInsurance || 0)).toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    ${(record.netSalary || 0).toLocaleString()}
                  </TableCell>
                  <TableCell>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      {record.status}
                    </span>
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
