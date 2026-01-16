/**
 * VAT Report Module (НӨАТ тайлан)
 * 
 * Монголын НӨАТ (Нэмэгдсэн өртгийн албан татвар) тайлангийн модуль.
 * Татварын ерөнхий газарт илгээх формат үүсгэнэ.
 * 
 * НӨАТ-ын хувь: 10%
 * Тайлангийн үе: Сар бүр
 */

import { db } from "./db";
import { invoices, invoiceLines, contacts, journalEntries, journalLines, taxLines, taxCodes } from "@shared/schema";
import { eq, and, gte, lte, sql } from "drizzle-orm";

// VAT Report types
export type VATReportType = 'monthly' | 'quarterly' | 'annual';

// VAT Report structure
export interface VATReport {
  // Header
  tenantId: string;
  companyName: string;
  companyTIN: string;          // ТТД
  companyRegNo: string;        // РД
  reportPeriod: string;        // Тайлант үе (YYYY-MM)
  reportType: VATReportType;
  generatedAt: string;

  // Sales (Output VAT - НӨАТ нэхэмжлэх)
  sales: {
    total: number;             // Нийт борлуулалт (НӨАТ-гүй)
    vatAmount: number;         // НӨАТ дүн
    totalWithVat: number;      // Нийт (НӨАТ-тай)
    invoiceCount: number;
    details: VATInvoiceDetail[];
  };

  // Purchases (Input VAT - НӨАТ суутгах)
  purchases: {
    total: number;
    vatAmount: number;
    totalWithVat: number;
    invoiceCount: number;
    details: VATInvoiceDetail[];
  };

  // Summary
  summary: {
    outputVat: number;         // Борлуулалтын НӨАТ
    inputVat: number;          // Худалдан авалтын НӨАТ
    netVat: number;            // Цэвэр НӨАТ (төлөх/буцаан авах)
    payable: boolean;          // true = төлөх, false = буцаан авах
  };

  // Validation
  validation: {
    isValid: boolean;
    errors: string[];
    warnings: string[];
  };
}

// Invoice detail for VAT report
export interface VATInvoiceDetail {
  invoiceNumber: string;
  invoiceDate: string;
  customerName: string;
  customerTIN?: string;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  total: number;
  ebarimtBillId?: string;
}

/**
 * Generate VAT Report
 * 
 * @param tenantId - Tenant ID
 * @param startDate - Start date (YYYY-MM-DD)
 * @param endDate - End date (YYYY-MM-DD)
 * @returns VAT Report
 */
export async function generateVATReport(
  tenantId: string,
  startDate: string,
  endDate: string,
  reportType: VATReportType = 'monthly'
): Promise<VATReport> {
  // Get tenant info
  const tenantResult = await db.query.tenants.findFirst({
    where: (t, { eq }) => eq(t.id, tenantId),
  });

  if (!tenantResult) {
    throw new Error('Tenant not found');
  }

  // Get sales invoices
  const salesInvoices = await db.query.invoices.findMany({
    where: and(
      eq(invoices.tenantId, tenantId),
      eq(invoices.type, 'sales'),
      gte(invoices.invoiceDate, startDate),
      lte(invoices.invoiceDate, endDate)
    ),
    with: {
      contact: true,
      lines: true,
    },
  });

  // Get purchase invoices
  const purchaseInvoices = await db.query.invoices.findMany({
    where: and(
      eq(invoices.tenantId, tenantId),
      eq(invoices.type, 'purchase'),
      gte(invoices.invoiceDate, startDate),
      lte(invoices.invoiceDate, endDate)
    ),
    with: {
      contact: true,
      lines: true,
    },
  });

  // Process sales
  const salesDetails: VATInvoiceDetail[] = salesInvoices.map(inv => ({
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    customerName: inv.contact?.companyName || `${inv.contact?.firstName || ''} ${inv.contact?.lastName || ''}`,
    customerTIN: inv.contact?.regNo || undefined,
    subtotal: parseFloat(inv.subtotal || '0'),
    vatRate: 10,
    vatAmount: parseFloat(inv.taxAmount || '0'),
    total: parseFloat(inv.totalAmount || '0'),
    ebarimtBillId: inv.qrCode || undefined,
  }));

  const salesTotal = salesDetails.reduce((sum, d) => sum + d.subtotal, 0);
  const salesVat = salesDetails.reduce((sum, d) => sum + d.vatAmount, 0);

  // Process purchases
  const purchaseDetails: VATInvoiceDetail[] = purchaseInvoices.map(inv => ({
    invoiceNumber: inv.invoiceNumber,
    invoiceDate: inv.invoiceDate,
    customerName: inv.contact?.companyName || `${inv.contact?.firstName || ''} ${inv.contact?.lastName || ''}`,
    customerTIN: inv.contact?.regNo || undefined,
    subtotal: parseFloat(inv.subtotal || '0'),
    vatRate: 10,
    vatAmount: parseFloat(inv.taxAmount || '0'),
    total: parseFloat(inv.totalAmount || '0'),
  }));

  const purchaseTotal = purchaseDetails.reduce((sum, d) => sum + d.subtotal, 0);
  const purchaseVat = purchaseDetails.reduce((sum, d) => sum + d.vatAmount, 0);

  // Calculate net VAT
  const netVat = salesVat - purchaseVat;

  // Validation
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check for invoices without TIN (B2B should have TIN)
  const b2bWithoutTIN = salesDetails.filter(d => d.total > 1000000 && !d.customerTIN);
  if (b2bWithoutTIN.length > 0) {
    warnings.push(`${b2bWithoutTIN.length} нэхэмжлэх 1,000,000₮-ээс дээш боловч харилцагчийн ТТД байхгүй`);
  }

  // Check for invoices without e-Barimt
  const withoutEbarimt = salesDetails.filter(d => !d.ebarimtBillId);
  if (withoutEbarimt.length > 0) {
    warnings.push(`${withoutEbarimt.length} нэхэмжлэх e-Barimt баримтгүй`);
  }

  // Validate VAT calculations (10%)
  for (const detail of [...salesDetails, ...purchaseDetails]) {
    const expectedVat = Math.round(detail.subtotal * 0.1);
    if (Math.abs(detail.vatAmount - expectedVat) > 10) {
      errors.push(`${detail.invoiceNumber}: НӨАТ тооцоолол зөрүүтэй (${detail.vatAmount} ≠ ${expectedVat})`);
    }
  }

  const report: VATReport = {
    tenantId,
    companyName: tenantResult.name,
    companyTIN: tenantResult.vatNo || '',
    companyRegNo: tenantResult.regNo || '',
    reportPeriod: `${startDate.substring(0, 7)}`,
    reportType,
    generatedAt: new Date().toISOString(),

    sales: {
      total: salesTotal,
      vatAmount: salesVat,
      totalWithVat: salesTotal + salesVat,
      invoiceCount: salesDetails.length,
      details: salesDetails,
    },

    purchases: {
      total: purchaseTotal,
      vatAmount: purchaseVat,
      totalWithVat: purchaseTotal + purchaseVat,
      invoiceCount: purchaseDetails.length,
      details: purchaseDetails,
    },

    summary: {
      outputVat: salesVat,
      inputVat: purchaseVat,
      netVat: Math.abs(netVat),
      payable: netVat > 0,
    },

    validation: {
      isValid: errors.length === 0,
      errors,
      warnings,
    },
  };

  return report;
}

/**
 * Export VAT Report to Excel format
 * Returns data structure for Excel export
 */
export function exportVATReportToExcel(report: VATReport): {
  summary: any[];
  sales: any[];
  purchases: any[];
} {
  return {
    summary: [
      ['НӨАТ ТАЙЛАН', '', '', ''],
      ['Байгууллагын нэр:', report.companyName, '', ''],
      ['ТТД:', report.companyTIN, '', ''],
      ['Тайлант үе:', report.reportPeriod, '', ''],
      ['', '', '', ''],
      ['БОРЛУУЛАЛТ', '', '', ''],
      ['Нийт борлуулалт (НӨАТ-гүй):', report.sales.total, '', ''],
      ['НӨАТ дүн:', report.sales.vatAmount, '', ''],
      ['Нийт (НӨАТ-тай):', report.sales.totalWithVat, '', ''],
      ['Нэхэмжлэхийн тоо:', report.sales.invoiceCount, '', ''],
      ['', '', '', ''],
      ['ХУДАЛДАН АВАЛТ', '', '', ''],
      ['Нийт худалдан авалт (НӨАТ-гүй):', report.purchases.total, '', ''],
      ['НӨАТ дүн:', report.purchases.vatAmount, '', ''],
      ['Нийт (НӨАТ-тай):', report.purchases.totalWithVat, '', ''],
      ['Нэхэмжлэхийн тоо:', report.purchases.invoiceCount, '', ''],
      ['', '', '', ''],
      ['ДҮГНЭЛТ', '', '', ''],
      ['Борлуулалтын НӨАТ:', report.summary.outputVat, '', ''],
      ['Худалдан авалтын НӨАТ:', report.summary.inputVat, '', ''],
      [report.summary.payable ? 'Төлөх НӨАТ:' : 'Буцаан авах НӨАТ:', report.summary.netVat, '', ''],
    ],
    sales: [
      ['№', 'Нэхэмжлэхийн дугаар', 'Огноо', 'Харилцагч', 'ТТД', 'Дүн', 'НӨАТ', 'Нийт', 'e-Barimt'],
      ...report.sales.details.map((d, i) => [
        i + 1,
        d.invoiceNumber,
        d.invoiceDate,
        d.customerName,
        d.customerTIN || '',
        d.subtotal,
        d.vatAmount,
        d.total,
        d.ebarimtBillId || '',
      ]),
    ],
    purchases: [
      ['№', 'Нэхэмжлэхийн дугаар', 'Огноо', 'Харилцагч', 'ТТД', 'Дүн', 'НӨАТ', 'Нийт'],
      ...report.purchases.details.map((d, i) => [
        i + 1,
        d.invoiceNumber,
        d.invoiceDate,
        d.customerName,
        d.customerTIN || '',
        d.subtotal,
        d.vatAmount,
        d.total,
      ]),
    ],
  };
}

/**
 * Tax Authority submission format (ТЕГ-д илгээх формат)
 * This is a simplified example - actual format depends on ТЕГ requirements
 */
export interface TaxAuthorityVATSubmission {
  header: {
    tin: string;              // ТТД
    reportPeriod: string;     // YYYYMM
    reportType: string;       // "monthly"
    submissionDate: string;   // YYYY-MM-DD
  };
  outputVat: {
    totalSales: number;
    vatAmount: number;
    invoices: Array<{
      invoiceNo: string;
      date: string;
      customerTin: string;
      amount: number;
      vat: number;
    }>;
  };
  inputVat: {
    totalPurchases: number;
    vatAmount: number;
    invoices: Array<{
      invoiceNo: string;
      date: string;
      supplierTin: string;
      amount: number;
      vat: number;
    }>;
  };
  declaration: {
    outputVat: number;
    inputVat: number;
    netVat: number;
    paymentAmount: number;
  };
}

export function formatForTaxAuthority(report: VATReport): TaxAuthorityVATSubmission {
  return {
    header: {
      tin: report.companyTIN,
      reportPeriod: report.reportPeriod.replace('-', ''),
      reportType: report.reportType,
      submissionDate: new Date().toISOString().split('T')[0],
    },
    outputVat: {
      totalSales: report.sales.total,
      vatAmount: report.sales.vatAmount,
      invoices: report.sales.details.map(d => ({
        invoiceNo: d.invoiceNumber,
        date: d.invoiceDate,
        customerTin: d.customerTIN || '',
        amount: d.subtotal,
        vat: d.vatAmount,
      })),
    },
    inputVat: {
      totalPurchases: report.purchases.total,
      vatAmount: report.purchases.vatAmount,
      invoices: report.purchases.details.map(d => ({
        invoiceNo: d.invoiceNumber,
        date: d.invoiceDate,
        supplierTin: d.customerTIN || '',
        amount: d.subtotal,
        vat: d.vatAmount,
      })),
    },
    declaration: {
      outputVat: report.summary.outputVat,
      inputVat: report.summary.inputVat,
      netVat: report.summary.netVat,
      paymentAmount: report.summary.payable ? report.summary.netVat : 0,
    },
  };
}

/**
 * Validate journal entries against VAT report
 * Ensures tax_lines match invoice data
 */
export async function validateVATWithJournal(
  tenantId: string,
  startDate: string,
  endDate: string
): Promise<{
  valid: boolean;
  journalVat: number;
  invoiceVat: number;
  difference: number;
  details: string[];
}> {
  // Get VAT from journal lines
  const journalVatResult = await db
    .select({
      totalVat: sql<number>`COALESCE(SUM(CAST(${taxLines.taxAmount} AS DECIMAL)), 0)`,
    })
    .from(taxLines)
    .innerJoin(journalLines, eq(taxLines.journalLineId, journalLines.id))
    .innerJoin(journalEntries, eq(journalLines.entryId, journalEntries.id))
    .where(
      and(
        eq(journalEntries.tenantId, tenantId),
        eq(journalEntries.status, 'posted'),
        gte(journalEntries.entryDate, startDate),
        lte(journalEntries.entryDate, endDate)
      )
    );

  // Get VAT from invoices
  const invoiceVatResult = await db
    .select({
      totalVat: sql<number>`COALESCE(SUM(CAST(${invoices.taxAmount} AS DECIMAL)), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.tenantId, tenantId),
        gte(invoices.invoiceDate, startDate),
        lte(invoices.invoiceDate, endDate)
      )
    );

  const journalVat = journalVatResult[0]?.totalVat || 0;
  const invoiceVat = invoiceVatResult[0]?.totalVat || 0;
  const difference = Math.abs(journalVat - invoiceVat);

  const details: string[] = [];
  if (difference > 0) {
    details.push(`Журналын НӨАТ: ${journalVat.toLocaleString()}₮`);
    details.push(`Нэхэмжлэхийн НӨАТ: ${invoiceVat.toLocaleString()}₮`);
    details.push(`Зөрүү: ${difference.toLocaleString()}₮`);
  }

  return {
    valid: difference < 10, // Allow small rounding differences
    journalVat,
    invoiceVat,
    difference,
    details,
  };
}
