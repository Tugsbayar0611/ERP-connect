import { db } from "./db";
import { eq, and, sql, gte, lte } from "drizzle-orm";
import {
  accounts,
  journalEntries,
  journalLines,
  taxLines,
  taxCodes,
  invoices,
  invoiceLines,
  employees,
  payslips,
  payrollRuns,
  contacts,
  tenants,
  type Account,
  type Employee,
} from "@shared/schema";
import { calculateMongolianSocialInsurance } from "@shared/mongolian-validators";

export interface TrialBalanceLine {
  accountId: string;
  accountCode: string;
  accountName: string;
  accountType: string;
  debit: number;
  credit: number;
  balance: number; // Debit - Credit
}

export interface TrialBalance {
  startDate: string;
  endDate: string;
  lines: TrialBalanceLine[];
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

/**
 * Calculate Trial Balance
 * Shows all account balances (debit - credit) for a date range
 */
export async function getTrialBalance(
  tenantId: string,
  startDate?: string,
  endDate?: string
): Promise<TrialBalance> {
  // Build date filters
  const dateConditions: any[] = [];
  if (startDate) {
    dateConditions.push(sql`${journalEntries.entryDate} >= ${startDate}`);
  }
  if (endDate) {
    dateConditions.push(sql`${journalEntries.entryDate} <= ${endDate}`);
  }

  // Only posted entries (exclude reversed)
  const conditions = [
    eq(journalEntries.tenantId, tenantId),
    eq(journalEntries.status, "posted"),
    ...dateConditions,
  ];

  // Get account balances by summing journal lines
  const balances = await db
    .select({
      accountId: journalLines.accountId,
      accountCode: accounts.code,
      accountName: accounts.name,
      accountType: accounts.type,
      debit: sql<number>`COALESCE(SUM(CAST(${journalLines.debit} AS NUMERIC)), 0)`,
      credit: sql<number>`COALESCE(SUM(CAST(${journalLines.credit} AS NUMERIC)), 0)`,
    })
    .from(journalLines)
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(accounts, eq(journalLines.accountId, accounts.id))
    .where(
      and(
        ...conditions,
        sql`${journalEntries.reversedByEntryId} IS NULL` // Exclude reversed entries
      )
    )
    .groupBy(
      journalLines.accountId,
      accounts.code,
      accounts.name,
      accounts.type
    );

  // Calculate balance (debit - credit) for each account
  const lines: TrialBalanceLine[] = balances.map((b) => {
    const debit = parseFloat(b.debit.toString());
    const credit = parseFloat(b.credit.toString());
    const balance = debit - credit;
    return {
      accountId: b.accountId,
      accountCode: b.accountCode || "",
      accountName: b.accountName || "",
      accountType: b.accountType || "",
      debit,
      credit,
      balance,
    };
  });

  // Sort by account code
  lines.sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  // Calculate totals
  const totalDebit = lines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = lines.reduce((sum, line) => sum + line.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return {
    startDate: startDate || "",
    endDate: endDate || new Date().toISOString().split("T")[0],
    lines,
    totalDebit,
    totalCredit,
    isBalanced,
  };
}

export interface BalanceSheetLine {
  accountCode: string;
  accountName: string;
  balance: number;
}

export interface BalanceSheet {
  asOfDate: string;
  assets: BalanceSheetLine[];
  liabilities: BalanceSheetLine[];
  equity: BalanceSheetLine[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  isBalanced: boolean;
}

/**
 * Calculate Balance Sheet
 * Assets = Liabilities + Equity
 */
export async function getBalanceSheet(
  tenantId: string,
  asOfDate?: string
): Promise<BalanceSheet> {
  const trialBalance = await getTrialBalance(tenantId, undefined, asOfDate);

  // Filter by account type
  const assets = trialBalance.lines
    .filter((line) => line.accountType === "asset")
    .map((line) => ({
      accountCode: line.accountCode,
      accountName: line.accountName,
      balance: line.balance,
    }))
    .filter((line) => Math.abs(line.balance) > 0.01); // Only show non-zero balances

  const liabilities = trialBalance.lines
    .filter((line) => line.accountType === "liability")
    .map((line) => ({
      accountCode: line.accountCode,
      accountName: line.accountName,
      balance: -line.balance, // Liabilities are credit balances (negative in our system)
    }))
    .filter((line) => Math.abs(line.balance) > 0.01);

  const equity = trialBalance.lines
    .filter((line) => line.accountType === "equity")
    .map((line) => ({
      accountCode: line.accountCode,
      accountName: line.accountName,
      balance: -line.balance, // Equity is credit balance (negative in our system)
    }))
    .filter((line) => Math.abs(line.balance) > 0.01);

  // Calculate totals
  const totalAssets = assets.reduce((sum, line) => sum + line.balance, 0);
  const totalLiabilities = liabilities.reduce((sum, line) => sum + line.balance, 0);
  const totalEquity = equity.reduce((sum, line) => sum + line.balance, 0);
  const totalLiabilitiesAndEquity = totalLiabilities + totalEquity;
  const isBalanced = Math.abs(totalAssets - totalLiabilitiesAndEquity) < 0.01;

  return {
    asOfDate: asOfDate || new Date().toISOString().split("T")[0],
    assets,
    liabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity,
    isBalanced,
  };
}

export interface ProfitAndLossLine {
  accountCode: string;
  accountName: string;
  amount: number;
}

export interface ProfitAndLoss {
  startDate: string;
  endDate: string;
  income: ProfitAndLossLine[];
  expenses: ProfitAndLossLine[];
  totalIncome: number;
  totalExpenses: number;
  netProfit: number; // Income - Expenses
}

/**
 * Calculate Profit & Loss Statement
 * Income - Expenses = Net Profit
 */
export async function getProfitAndLoss(
  tenantId: string,
  startDate?: string,
  endDate?: string
): Promise<ProfitAndLoss> {
  const trialBalance = await getTrialBalance(tenantId, startDate, endDate);

  // Income accounts (credit balance is positive)
  const income = trialBalance.lines
    .filter((line) => line.accountType === "income")
    .map((line) => ({
      accountCode: line.accountCode,
      accountName: line.accountName,
      amount: -line.balance, // Income is credit balance
    }))
    .filter((line) => Math.abs(line.amount) > 0.01)
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  // Expense accounts (debit balance is positive)
  const expenses = trialBalance.lines
    .filter((line) => line.accountType === "expense")
    .map((line) => ({
      accountCode: line.accountCode,
      accountName: line.accountName,
      amount: line.balance, // Expenses are debit balance
    }))
    .filter((line) => Math.abs(line.amount) > 0.01)
    .sort((a, b) => a.accountCode.localeCompare(b.accountCode));

  // Calculate totals
  const totalIncome = income.reduce((sum, line) => sum + line.amount, 0);
  const totalExpenses = expenses.reduce((sum, line) => sum + line.amount, 0);
  const netProfit = totalIncome - totalExpenses;

  return {
    startDate: startDate || "",
    endDate: endDate || new Date().toISOString().split("T")[0],
    income,
    expenses,
    totalIncome,
    totalExpenses,
    netProfit,
  };
}

export interface VATReportLine {
  invoiceNumber?: string;
  invoiceDate?: string;
  customerName?: string;
  taxCode: string;
  taxRate: number;
  taxBase: number; // ХХОАТ суурь
  taxAmount: number; // ХХОАТ дүн
  type: "sales" | "purchase"; // Борлуулалт эсвэл худалдан авалт
}

export interface VATReport {
  startDate: string;
  endDate: string;
  sales: VATReportLine[];
  purchases: VATReportLine[];
  totalSalesBase: number;
  totalSalesVAT: number;
  totalPurchaseBase: number;
  totalPurchaseVAT: number;
  netVAT: number; // Төлөх НӨАТ (Sales VAT - Purchase VAT)
}

/**
 * Calculate VAT Report (НӨАТ тайлан)
 * Based on tax_lines from journal entries
 */
export async function getVATReport(
  tenantId: string,
  startDate?: string,
  endDate?: string
): Promise<VATReport> {
  // Build date filters
  const dateConditions: any[] = [];
  if (startDate) {
    dateConditions.push(sql`${journalEntries.entryDate} >= ${startDate}`);
  }
  if (endDate) {
    dateConditions.push(sql`${journalEntries.entryDate} <= ${endDate}`);
  }

  // Only posted entries (exclude reversed)
  const conditions = [
    eq(journalEntries.tenantId, tenantId),
    eq(journalEntries.status, "posted"),
    ...dateConditions,
  ];

  // Get tax lines with invoice and tax code information
  const taxData = await db
    .select({
      taxLineId: taxLines.id,
      taxCodeId: taxCodes.id,
      taxCode: taxCodes.code,
      taxRate: taxCodes.rate,
      taxBase: taxLines.taxBase,
      taxAmount: taxLines.taxAmount,
      invoiceId: taxLines.referenceId,
      invoiceNumber: invoices.invoiceNumber,
      invoiceDate: invoices.invoiceDate,
      contactId: invoices.contactId,
      contactName: sql<string>`COALESCE(
        ${contacts.companyName},
        ${contacts.firstName} || ' ' || COALESCE(${contacts.lastName}, '')
      )`,
      contactVatNo: contacts.vatNo,
      type: sql<string>`CASE 
        WHEN ${journalLines.debit} > 0 AND ${journalLines.credit} = 0 THEN 'purchase'
        WHEN ${journalLines.credit} > 0 AND ${journalLines.debit} = 0 THEN 'sales'
        ELSE 'unknown'
      END`,
    })
    .from(taxLines)
    .innerJoin(journalLines, eq(taxLines.journalLineId, journalLines.id))
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .innerJoin(taxCodes, eq(taxLines.taxCodeId, taxCodes.id))
    .leftJoin(invoices, eq(taxLines.referenceId, invoices.id))
    .leftJoin(contacts, eq(invoices.contactId, contacts.id))
    .where(
      and(
        ...conditions,
        sql`${journalEntries.reversedByEntryId} IS NULL`, // Exclude reversed entries
        eq(taxCodes.type, "vat") // Only VAT tax codes
      )
    );

  // Separate sales and purchases
  const sales: VATReportLine[] = [];
  const purchases: VATReportLine[] = [];

  for (const row of taxData) {
    const line: VATReportLine = {
      invoiceNumber: row.invoiceNumber || undefined,
      invoiceDate: row.invoiceDate ? new Date(row.invoiceDate).toISOString().split("T")[0] : undefined,
      customerName: row.contactName || undefined,
      taxCode: row.taxCode || "",
      taxRate: parseFloat(row.taxRate.toString()),
      taxBase: parseFloat(row.taxBase.toString()),
      taxAmount: parseFloat(row.taxAmount.toString()),
      type: (row.type as "sales" | "purchase") || "sales",
    };

    if (row.type === "sales") {
      sales.push(line);
    } else if (row.type === "purchase") {
      purchases.push(line);
    }
  }

  // Calculate totals
  const totalSalesBase = sales.reduce((sum, line) => sum + line.taxBase, 0);
  const totalSalesVAT = sales.reduce((sum, line) => sum + line.taxAmount, 0);
  const totalPurchaseBase = purchases.reduce((sum, line) => sum + line.taxBase, 0);
  const totalPurchaseVAT = purchases.reduce((sum, line) => sum + line.taxAmount, 0);
  const netVAT = totalSalesVAT - totalPurchaseVAT;

  return {
    startDate: startDate || "",
    endDate: endDate || new Date().toISOString().split("T")[0],
    sales,
    purchases,
    totalSalesBase,
    totalSalesVAT,
    totalPurchaseBase,
    totalPurchaseVAT,
    netVAT,
  };
}

/**
 * НД-7 Тайлан: Ажилтнуудын мэдээлэл (Нийгмийн даатгалын тайлан)
 * Ажилтны мэдээлэл: нэр, РД, огноо, НДШ
 */
export interface ND7ReportLine {
  employeeNo?: string;
  firstName: string;
  lastName?: string;
  fullName: string;
  nationalId?: string; // РД
  hireDate?: string;
  birthDate?: string;
  shiBase: number; // НДШ тооцоолох суурь
  shiEmployee: number; // НДШ (ажилтан) - 11%
  shiEmployer: number; // НДШ (ажил олгогч) - 12.5%
  shiTotal: number; // НДШ нийт
}

export interface ND7Report {
  periodStart: string;
  periodEnd: string;
  lines: ND7ReportLine[];
  totalShiEmployee: number;
  totalShiEmployer: number;
  totalShi: number;
}

/**
 * Generate НД-7 Report (Ажилтнуудын мэдээлэл)
 */
export async function getND7Report(
  tenantId: string,
  periodStart: string,
  periodEnd: string,
  storage: any
): Promise<ND7Report> {
  // Get all employees active in the period
  const allEmployees = await storage.getEmployees(tenantId) as Employee[];

  // Get payslips for the period
  const allPayslips = await storage.getAllPayslips(tenantId);
  const periodPayslips = allPayslips.filter((p: any) => {
    if (!p.periodStart || !p.periodEnd) return false;
    return p.periodStart >= periodStart && p.periodEnd <= periodEnd;
  });

  const lines: ND7ReportLine[] = [];
  let totalShiEmployee = 0;
  let totalShiEmployer = 0;
  let totalShi = 0;

  // Process each employee
  for (const employee of allEmployees) {
    // Find payslips for this employee in the period
    const employeePayslips = periodPayslips.filter(
      (p: any) => p.employeeId === employee.id
    );

    if (employeePayslips.length === 0) continue;

    // Calculate total SHI for the period
    let totalShiBase = 0;
    let totalShiEmp = 0;
    let totalShiEmpr = 0;

    for (const payslip of employeePayslips) {
      const gross = parseFloat(payslip.grossPay?.toString() || "0");
      const shi = calculateMongolianSocialInsurance(gross, 11, 12.5);
      totalShiBase += shi.shiBase;
      totalShiEmp += shi.employee;
      totalShiEmpr += shi.employer;
    }

    if (totalShiBase === 0) continue;

    lines.push({
      employeeNo: employee.employeeNo || undefined,
      firstName: employee.firstName,
      lastName: employee.lastName || undefined,
      fullName: `${employee.firstName} ${employee.lastName || ""}`.trim(),
      nationalId: employee.nationalId || undefined,
      hireDate: employee.hireDate || undefined,
      birthDate: employee.birthDate || undefined,
      shiBase: totalShiBase,
      shiEmployee: totalShiEmp,
      shiEmployer: totalShiEmpr,
      shiTotal: totalShiEmp + totalShiEmpr,
    });

    totalShiEmployee += totalShiEmp;
    totalShiEmployer += totalShiEmpr;
    totalShi += totalShiEmp + totalShiEmpr;
  }

  return {
    periodStart,
    periodEnd,
    lines,
    totalShiEmployee,
    totalShiEmployer,
    totalShi,
  };
}

/**
 * НД-8 Тайлан: Цалингийн мэдээлэл (Нийгмийн даатгалын тайлан)
 * Цалингийн мэдээлэл: Цалин, НДШ (ажилтан), НДШ (ажил олгогч)
 */
export interface ND8ReportLine {
  employeeNo?: string;
  employeeName: string;
  nationalId?: string; // РД
  periodStart: string;
  periodEnd: string;
  grossPay: number; // Нийт цалин
  shiBase: number; // НДШ тооцоолох суурь
  shiEmployee: number; // НДШ (ажилтан) - 11%
  shiEmployer: number; // НДШ (ажил олгогч) - 12.5%
  shiTotal: number; // НДШ нийт
  netPay: number; // Цэвэр цалин
}

export interface ND8Report {
  periodStart: string;
  periodEnd: string;
  lines: ND8ReportLine[];
  totalGrossPay: number;
  totalShiEmployee: number;
  totalShiEmployer: number;
  totalShi: number;
  totalNetPay: number;
}

/**
 * Generate НД-8 Report (Цалингийн мэдээлэл)
 */
export async function getND8Report(
  tenantId: string,
  periodStart: string,
  periodEnd: string,
  storage: any
): Promise<ND8Report> {
  // Get all employees
  const allEmployees = await storage.getEmployees(tenantId) as Employee[];
  const employeesMap = new Map<string, Employee>(allEmployees.map((e) => [e.id, e]));

  // Get payslips for the period
  const allPayslips = await storage.getAllPayslips(tenantId);
  const periodPayslips = allPayslips.filter((p: any) => {
    if (!p.periodStart || !p.periodEnd) return false;
    return p.periodStart >= periodStart && p.periodEnd <= periodEnd;
  });

  const lines: ND8ReportLine[] = [];
  let totalGrossPay = 0;
  let totalShiEmployee = 0;
  let totalShiEmployer = 0;
  let totalShi = 0;
  let totalNetPay = 0;

  // Process each payslip
  for (const payslip of periodPayslips) {
    const employee = employeesMap.get(payslip.employeeId);
    if (!employee) continue;

    const gross = parseFloat(payslip.grossPay?.toString() || "0");
    const net = parseFloat(payslip.netPay?.toString() || "0");

    // Calculate SHI
    const shi = calculateMongolianSocialInsurance(gross, 11, 12.5);

    lines.push({
      employeeNo: employee.employeeNo || undefined,
      employeeName: `${employee.firstName} ${employee.lastName || ""}`.trim(),
      nationalId: employee.nationalId || undefined,
      periodStart: payslip.periodStart || periodStart,
      periodEnd: payslip.periodEnd || periodEnd,
      grossPay: gross,
      shiBase: shi.shiBase,
      shiEmployee: shi.employee,
      shiEmployer: shi.employer,
      shiTotal: shi.total,
      netPay: net,
    });

    totalGrossPay += gross;
    totalShiEmployee += shi.employee;
    totalShiEmployer += shi.employer;
    totalShi += shi.total;
    totalNetPay += net;
  }

  // Sort by employee name
  lines.sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  return {
    periodStart,
    periodEnd,
    lines,
    totalGrossPay,
    totalShiEmployee,
    totalShiEmployer,
    totalShi,
    totalNetPay,
  };
}
