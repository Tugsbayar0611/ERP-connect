import { pool } from "./db";

/**
 * Get next document number (concurrency-safe)
 * Uses PostgreSQL function with SELECT FOR UPDATE for row-level locking
 */
export async function getNextNumber(
  tenantId: string,
  documentType: string,
  branchId?: string | null,
  year?: number | null
): Promise<string> {
  // Call the PostgreSQL function using raw SQL
  const result = await pool.query(
    `SELECT get_next_number($1::uuid, $2, $3::uuid, $4::integer) as number`,
    [tenantId, documentType, branchId || null, year || null]
  );

  const number = result.rows[0]?.number;
  if (!number) {
    throw new Error(`Failed to generate next number for ${documentType}`);
  }

  return number as string;
}

/**
 * Helper functions for common document types
 */
export async function getNextInvoiceNumber(
  tenantId: string,
  branchId?: string | null,
  year?: number | null
): Promise<string> {
  return getNextNumber(tenantId, "invoice", branchId, year);
}

export async function getNextSalesOrderNumber(
  tenantId: string,
  branchId?: string | null,
  year?: number | null
): Promise<string> {
  return getNextNumber(tenantId, "sales_order", branchId, year);
}

export async function getNextPurchaseOrderNumber(
  tenantId: string,
  branchId?: string | null,
  year?: number | null
): Promise<string> {
  return getNextNumber(tenantId, "purchase_order", branchId, year);
}

export async function getNextJournalEntryNumber(
  tenantId: string,
  branchId?: string | null,
  year?: number | null
): Promise<string> {
  return getNextNumber(tenantId, "journal_entry", branchId, year);
}

export async function getNextReversalNumber(
  tenantId: string,
  branchId?: string | null,
  year?: number | null
): Promise<string> {
  return getNextNumber(tenantId, "reversal", branchId, year);
}

export async function getNextPaymentNumber(
  tenantId: string,
  branchId?: string | null,
  year?: number | null
): Promise<string> {
  return getNextNumber(tenantId, "payment", branchId, year);
}
