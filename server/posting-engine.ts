import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import {
  invoices,
  invoiceLines,
  salesOrders,
  payments,
  paymentAllocations,
  contacts,
  products,
  productCategories,
  accounts,
  journals,
  journalEntries,
  journalLines,
  taxLines,
  taxCodes,
  bankAccounts,
  type DbInsertJournalEntry,
  type DbInsertJournalLine,
  type DbInsertTaxLine,
} from "@shared/schema";

export interface PostingTemplate {
  documentType: string;
  journalType: string;
  lines: PostingTemplateLine[];
}

export interface PostingTemplateLine {
  side: "debit" | "credit";
  accountResolver: string; // 'ar_account', 'revenue_account', 'tax_payable_account', etc.
  amountField: string; // 'total', 'subtotal', 'tax_amount'
  description: string;
  createTaxLine?: boolean; // For VAT lines
}

export interface PostingPreview {
  journalEntry: {
    entryNumber?: string;
    entryDate: string;
    description: string;
    journalId?: string;
    lines: Array<{
      accountCode: string;
      accountName: string;
      debit: number;
      credit: number;
      description: string;
    }>;
    taxLines?: Array<{
      taxCode: string;
      taxBase: number;
      taxAmount: number;
    }>;
  };
  totalDebit: number;
  totalCredit: number;
  isBalanced: boolean;
}

/**
 * Posting Templates Configuration
 * Template-based approach for document posting
 */
const POSTING_TEMPLATES: Record<string, PostingTemplate> = {
  invoice_sales: {
    documentType: "invoice",
    journalType: "sales",
    lines: [
      {
        side: "debit",
        accountResolver: "ar_account", // Customer's AR account or default AR
        amountField: "total", // Invoice total (including tax)
        description: "AR from invoice",
      },
      {
        side: "credit",
        accountResolver: "revenue_account", // Product category revenue account or default
        amountField: "subtotal", // Invoice subtotal (before tax)
        description: "Revenue",
      },
      {
        side: "credit",
        accountResolver: "tax_payable_account", // VAT Payable account
        amountField: "tax_amount", // VAT amount
        description: "VAT Payable",
        createTaxLine: true,
      },
    ],
  },
  invoice_purchase: {
    documentType: "invoice",
    journalType: "purchase",
    lines: [
      {
        side: "debit",
        accountResolver: "expense_account", // Product category expense account or default
        amountField: "subtotal",
        description: "Purchase expense",
      },
      {
        side: "debit",
        accountResolver: "tax_receivable_account", // VAT Receivable account
        amountField: "tax_amount",
        description: "VAT Receivable",
        createTaxLine: true,
      },
      {
        side: "credit",
        accountResolver: "ap_account", // Supplier's AP account or default AP
        amountField: "total",
        description: "AP from invoice",
      },
    ],
  },
  payment_receipt: {
    documentType: "payment",
    journalType: "bank",
    lines: [
      {
        side: "debit",
        accountResolver: "cash_bank_account", // Payment's bank account GL account
        amountField: "amount",
        description: "Cash/Bank received",
      },
      {
        side: "credit",
        accountResolver: "ar_account", // From invoice allocation
        amountField: "allocated_amount",
        description: "AR allocation",
      },
    ],
  },
  payment_payment: {
    documentType: "payment",
    journalType: "bank",
    lines: [
      {
        side: "debit",
        accountResolver: "ap_account", // From invoice allocation
        amountField: "allocated_amount",
        description: "AP allocation",
      },
      {
        side: "credit",
        accountResolver: "cash_bank_account", // Payment's bank account GL account
        amountField: "amount",
        description: "Cash/Bank paid",
      },
    ],
  },
};

/**
 * Account Resolvers
 * Resolve account IDs based on document data
 */
class AccountResolver {
  async resolveARAccount(tenantId: string, contactId?: string): Promise<string> {
    // Try to get from contact's AR account (if exists in future)
    // For now, get default AR account
    const [arAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.tenantId, tenantId), eq(accounts.code, "1100"))) // Default AR account
      .limit(1);

    if (!arAccount) {
      throw new Error("AR account (1100) not found. Please create it first.");
    }

    return arAccount.id;
  }

  async resolveAPAccount(tenantId: string, contactId?: string): Promise<string> {
    // Try to get from contact's AP account (if exists)
    // For now, get default AP account
    const [apAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.tenantId, tenantId), eq(accounts.code, "2100"))) // Default AP account (can create separate)
      .limit(1);

    if (!apAccount) {
      throw new Error("AP account not found. Please create it first.");
    }

    return apAccount.id;
  }

  async resolveRevenueAccount(tenantId: string, productId?: string, categoryId?: string): Promise<string> {
    // Try to get from product category
    if (categoryId) {
      // In future: Get from productCategory.revenueAccountId
    }

    // Default revenue account
    const [revenueAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.tenantId, tenantId), eq(accounts.code, "4000"))) // Default Revenue account
      .limit(1);

    if (!revenueAccount) {
      throw new Error("Revenue account (4000) not found. Please create it first.");
    }

    return revenueAccount.id;
  }

  async resolveTaxPayableAccount(tenantId: string, taxCodeId?: string): Promise<string> {
    if (taxCodeId) {
      const [taxCode] = await db.select().from(taxCodes).where(eq(taxCodes.id, taxCodeId)).limit(1);
      if (taxCode?.taxAccountPayableId) {
        return taxCode.taxAccountPayableId;
      }
    }

    // Default VAT Payable account
    const [vatAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.tenantId, tenantId), eq(accounts.code, "2100"))) // VAT Payable (can be separate)
      .limit(1);

    if (!vatAccount) {
      throw new Error("VAT Payable account not found. Please create it first.");
    }

    return vatAccount.id;
  }

  async resolveTaxReceivableAccount(tenantId: string, taxCodeId?: string): Promise<string> {
    if (taxCodeId) {
      const [taxCode] = await db.select().from(taxCodes).where(eq(taxCodes.id, taxCodeId)).limit(1);
      if (taxCode?.taxAccountReceivableId) {
        return taxCode.taxAccountReceivableId;
      }
    }

    // Default VAT Receivable account
    const [vatAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.tenantId, tenantId), eq(accounts.code, "1100"))) // VAT Receivable (can be separate)
      .limit(1);

    if (!vatAccount) {
      throw new Error("VAT Receivable account not found. Please create it first.");
    }

    return vatAccount.id;
  }

  async resolveCashBankAccount(tenantId: string, bankAccountId?: string): Promise<string> {
    if (bankAccountId) {
      // Get GL account from bank_accounts table
      const [bankAccount] = await db
        .select()
        .from(bankAccounts)
        .where(eq(bankAccounts.id, bankAccountId))
        .limit(1);

      if (bankAccount?.accountId) {
        // Return the GL account linked to this bank account
        return bankAccount.accountId;
      }

      // If no GL account linked, use default cash account
    }

    // Default Cash account
    const [cashAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.tenantId, tenantId), eq(accounts.code, "1000"))) // Cash account
      .limit(1);

    if (!cashAccount) {
      throw new Error("Cash account (1000) not found. Please create it first.");
    }

    return cashAccount.id;
  }

  async resolveExpenseAccount(tenantId: string, productId?: string, categoryId?: string): Promise<string> {
    // Default expense account (can be from product category in future)
    const [expenseAccount] = await db
      .select()
      .from(accounts)
      .where(and(eq(accounts.tenantId, tenantId), eq(accounts.code, "5000"))) // Expense account
      .limit(1);

    if (!expenseAccount) {
      throw new Error("Expense account not found. Please create it first.");
    }

    return expenseAccount.id;
  }

  async resolve(tenantId: string, resolverKey: string, context: any): Promise<string> {
    switch (resolverKey) {
      case "ar_account":
        return this.resolveARAccount(tenantId, context.contactId);
      case "ap_account":
        return this.resolveAPAccount(tenantId, context.contactId);
      case "revenue_account":
        return this.resolveRevenueAccount(tenantId, context.productId, context.categoryId);
      case "tax_payable_account":
        return this.resolveTaxPayableAccount(tenantId, context.taxCodeId);
      case "tax_receivable_account":
        return this.resolveTaxReceivableAccount(tenantId, context.taxCodeId);
      case "cash_bank_account":
        return this.resolveCashBankAccount(tenantId, context.bankAccountId);
      case "expense_account":
        return this.resolveExpenseAccount(tenantId, context.productId, context.categoryId);
      default:
        throw new Error(`Unknown account resolver: ${resolverKey}`);
    }
  }
}

const accountResolver = new AccountResolver();

/**
 * Preview Posting
 * Shows what journal entry will be created without actually posting
 */
export async function previewPosting(
  tenantId: string,
  modelType: string,
  modelId: string
): Promise<PostingPreview> {
  const toNumber = (value: unknown) => {
    if (value === null || value === undefined || value === "") return 0;
    const num = typeof value === "number" ? value : parseFloat(String(value));
    return Number.isFinite(num) ? num : 0;
  };

  let template: PostingTemplate | undefined;
  let document: any;
  let journalType: string;
  let invoiceSubtotal = 0;
  let invoiceTaxAmount = 0;
  let invoiceTotal = 0;

  if (modelType === "invoice") {
    // Get invoice
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(eq(invoices.id, modelId))
      .limit(1);

    if (!invoice || invoice.tenantId !== tenantId) {
      throw new Error("Invoice not found");
    }

    if (invoice.status === "posted") {
      throw new Error("Invoice already posted");
    }

    template = invoice.type === "sales" ? POSTING_TEMPLATES.invoice_sales : POSTING_TEMPLATES.invoice_purchase;
    journalType = invoice.type === "sales" ? "sales" : "purchase";
    document = invoice;

    // Get invoice lines for tax calculation
    const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, modelId));
    document.lines = lines;

    if (lines.length > 0) {
      invoiceSubtotal = lines.reduce((sum, line: any) => {
        const base = line.taxBase ?? line.subtotal ?? 0;
        return sum + toNumber(base);
      }, 0);
      invoiceTaxAmount = lines.reduce((sum, line: any) => sum + toNumber(line.taxAmount), 0);
      invoiceTotal = invoiceSubtotal + invoiceTaxAmount;
    } else {
      invoiceSubtotal = toNumber(invoice.subtotal);
      invoiceTaxAmount = toNumber(invoice.taxAmount);
      invoiceTotal = toNumber(invoice.totalAmount);
    }
  } else if (modelType === "payment") {
    const [payment] = await db
      .select()
      .from(payments)
      .where(eq(payments.id, modelId))
      .limit(1);

    if (!payment || payment.tenantId !== tenantId) {
      throw new Error("Payment not found");
    }

    if (payment.status === "posted") {
      throw new Error("Payment already posted");
    }

    template = payment.type === "receipt" ? POSTING_TEMPLATES.payment_receipt : POSTING_TEMPLATES.payment_payment;
    journalType = "bank";
    document = payment;

    // Get allocations
    const allocations = await db
      .select()
      .from(paymentAllocations)
      .where(eq(paymentAllocations.paymentId, modelId));
    document.allocations = allocations;
  } else {
    throw new Error(`Unsupported document type: ${modelType}`);
  }

  if (!template) {
    throw new Error(`No posting template found for ${modelType}`);
  }

  // Get journal
  const [journal] = await db
    .select()
    .from(journals)
    .where(and(eq(journals.tenantId, tenantId), eq(journals.type, journalType)))
    .limit(1);

  if (!journal) {
    throw new Error(`Journal with type '${journalType}' not found`);
  }

  // Build journal lines
  const previewLines: PostingPreview["journalEntry"]["lines"] = [];
  const taxLinesPreview: PostingPreview["journalEntry"]["taxLines"] = [];

  for (const templateLine of template.lines) {
    // Resolve account
    const accountId = await accountResolver.resolve(tenantId, templateLine.accountResolver, {
      contactId: document.contactId,
      productId: document.productId,
      categoryId: document.categoryId,
      taxCodeId: document.taxCodeId,
      bankAccountId: document.bankAccountId,
    });

    const [account] = await db.select().from(accounts).where(eq(accounts.id, accountId)).limit(1);
    if (!account) continue;

    // Calculate amount
    let amount = 0;
    if (templateLine.amountField === "total") {
      if (modelType === "invoice") {
        amount = invoiceTotal;
      } else {
        amount = toNumber(document.totalAmount || document.amount);
      }
    } else if (templateLine.amountField === "subtotal") {
      if (modelType === "invoice") {
        amount = invoiceSubtotal;
      } else {
        amount = toNumber(document.subtotal);
      }
    } else if (templateLine.amountField === "tax_amount") {
      if (modelType === "invoice") {
        amount = invoiceTaxAmount;
      } else {
        amount = toNumber(document.taxAmount);
      }
    } else if (templateLine.amountField === "amount") {
      amount = toNumber(document.amount);
    } else if (templateLine.amountField === "allocated_amount") {
      // Sum of allocations
      amount = (document.allocations || []).reduce((sum: number, alloc: any) => {
        return sum + toNumber(alloc.allocatedAmount);
      }, 0);
      
      // If no allocations yet, use payment amount
      if (amount === 0 && modelType === "payment") {
        amount = toNumber(document.amount);
      }
    }

    // Skip zero amounts
    if (amount === 0) continue;

    // Create line
    previewLines.push({
      accountCode: account.code,
      accountName: account.name,
      debit: templateLine.side === "debit" ? amount : 0,
      credit: templateLine.side === "credit" ? amount : 0,
      description: templateLine.description,
    });
  }

  // Create tax lines if needed (after all journal lines)
  if (modelType === "invoice" && document.lines && invoiceTaxAmount > 0) {
    // Sum tax from invoice lines
    let totalTaxBase = 0;
    let taxCodeValue = "VAT10"; // Default

    for (const line of document.lines) {
      totalTaxBase += toNumber(line.taxBase ?? line.subtotal);
      
      // Get tax code from line if available
      if (line.taxCodeId) {
        const [taxCode] = await db.select().from(taxCodes).where(eq(taxCodes.id, line.taxCodeId)).limit(1);
        if (taxCode) {
          taxCodeValue = taxCode.code;
        }
      }
    }

    if (totalTaxBase > 0) {
      taxLinesPreview.push({
        taxCode: taxCodeValue,
        taxBase: totalTaxBase,
        taxAmount: invoiceTaxAmount,
      });
    }
  }

  // Calculate totals
  const totalDebit = previewLines.reduce((sum, line) => sum + line.debit, 0);
  const totalCredit = previewLines.reduce((sum, line) => sum + line.credit, 0);
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.01;

  return {
    journalEntry: {
      entryDate: document.invoiceDate || document.paymentDate || new Date().toISOString().split("T")[0],
      description: document.description || `${modelType} ${document.invoiceNumber || document.paymentNumber}`,
      journalId: journal.id,
      lines: previewLines,
      taxLines: taxLinesPreview.length > 0 ? taxLinesPreview : undefined,
    },
    totalDebit,
    totalCredit,
    isBalanced,
  };
}

/**
 * Post Document
 * Actually creates journal entry and posts it
 */
export async function postDocument(
  tenantId: string,
  modelType: string,
  modelId: string,
  journalId?: string,
  entryDate?: string,
  postedBy?: string
): Promise<any> {
  // Get preview first
  const preview = await previewPosting(tenantId, modelType, modelId);

  if (!preview.isBalanced) {
    throw new Error(`Double-entry not balanced: Debit ${preview.totalDebit} != Credit ${preview.totalCredit}`);
  }

  // Generate entry number (concurrency-safe)
  const { getNextJournalEntryNumber } = await import("./numbering");
  const entryDateObj = entryDate ? new Date(entryDate) : new Date();
  const entryNumber = await getNextJournalEntryNumber(
    tenantId,
    null, // branchId
    entryDateObj.getFullYear()
  );

  // Create journal entry
  const [journalEntry] = await db
    .insert(journalEntries)
    .values({
      tenantId,
      journalId: journalId || preview.journalEntry.journalId || null,
      entryNumber,
      entryDate: entryDate || preview.journalEntry.entryDate,
      description: preview.journalEntry.description,
      reference: modelId,
      status: "posted",
      postedBy: postedBy || null,
      postedAt: new Date(),
    } as DbInsertJournalEntry)
    .returning();

    // Create journal lines
    let taxJournalLineId: string | undefined;
    
    for (const line of preview.journalEntry.lines) {
      // Get account ID from code
      const [account] = await db
        .select()
        .from(accounts)
        .where(and(eq(accounts.tenantId, tenantId), eq(accounts.code, line.accountCode)))
        .limit(1);

      if (!account) continue;

      const [journalLine] = await db
        .insert(journalLines)
        .values({
          entryId: journalEntry.id,
          accountId: account.id,
          debit: line.debit.toString(),
          credit: line.credit.toString(),
          description: line.description,
        } as DbInsertJournalLine)
        .returning();

      // Remember tax line's journal line for tax_lines creation
      if (line.description.includes("VAT") || line.description.includes("Tax")) {
        taxJournalLineId = journalLine.id;
      }
    }

    // Create tax lines after all journal lines are created
    if (preview.journalEntry.taxLines && preview.journalEntry.taxLines.length > 0 && taxJournalLineId) {
      for (const taxLine of preview.journalEntry.taxLines) {
        // Find tax code
        const [taxCode] = await db
          .select()
          .from(taxCodes)
          .where(and(eq(taxCodes.tenantId, tenantId), eq(taxCodes.code, taxLine.taxCode)))
          .limit(1);

        if (taxCode) {
          await db.insert(taxLines).values({
            journalLineId: taxJournalLineId,
            taxCodeId: taxCode.id,
            taxBase: taxLine.taxBase.toString(),
            taxAmount: taxLine.taxAmount.toString(),
            sourceType: "invoice_line",
            reference: modelId,
            referenceId: modelId,
          } as DbInsertTaxLine);
        }
      }
    }

  // Update document status and link journal entry
  if (modelType === "invoice") {
    await db.update(invoices).set({ status: "posted", updatedAt: new Date() }).where(eq(invoices.id, modelId));
    // Note: Invoices don't have journalEntryId field currently, but can be added later
  } else if (modelType === "payment") {
    await db.update(payments).set({ 
      status: "posted", 
      postedAt: new Date(),
      journalEntryId: journalEntry.id 
    }).where(eq(payments.id, modelId));
  }

  return journalEntry;
}
