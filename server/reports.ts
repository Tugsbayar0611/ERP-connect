import { db } from "./db";
import { eq, and, sql, gte, lte, inArray } from "drizzle-orm";
import {
  accounts,
  journalEntries,
  journalLines,
  type Account,
} from "@shared/schema";

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

  // Include posted + reversed entries so reversals net to zero
  const conditions = [
    eq(journalEntries.tenantId, tenantId),
    inArray(journalEntries.status, ["posted", "reversed"]),
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
    .where(and(...conditions))
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
