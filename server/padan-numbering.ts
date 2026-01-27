/**
 * Padan Number Generation Service
 * 
 * Idempotent Padan numbering system for Mongolian dispatch/receipt vouchers
 * Format: PD-YYYYMM-000123 (Dispatch) / PR-YYYYMM-000045 (Receipt)
 * 
 * Guarantees:
 * - Same invoice → same padan number (idempotent)
 * - Thread-safe (transaction + row lock)
 * - Unique per tenant, type, period
 */

import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";
import { padanNumberSequences, invoices } from "@shared/schema";

export type PadanType = "DISPATCH" | "RECEIPT";

/**
 * Get or generate Padan number for invoice (idempotent)
 * 
 * Algorithm:
 * 1. Check if invoice already has padan number → return it
 * 2. If not, start transaction with row lock:
 *    a. SELECT ... FOR UPDATE on padan_number_sequences
 *    b. Increment last_number
 *    c. Generate padan number
 *    d. Save to invoice
 *    e. Save sequence
 * 3. Return padan number
 */
export async function getOrGeneratePadanNumber(
  tenantId: string,
  invoiceId: string,
  invoiceType: "sales" | "purchase",
  padanType: PadanType
): Promise<string> {
  // Validate: sales invoice → DISPATCH, purchase invoice → RECEIPT
  if (invoiceType === "sales" && padanType !== "DISPATCH") {
    throw new Error("Sales invoice can only generate DISPATCH padan");
  }
  if (invoiceType === "purchase" && padanType !== "RECEIPT") {
    throw new Error("Purchase invoice can only generate RECEIPT padan");
  }

  // Step 1: Check if invoice already has padan number
  const [invoice] = await db
    .select({
      dispatchPadanNumber: invoices.dispatchPadanNumber,
      receiptPadanNumber: invoices.receiptPadanNumber,
      invoiceDate: invoices.invoiceDate,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))
    .limit(1);

  if (!invoice) {
    throw new Error("Invoice not found");
  }

  // Check existing padan number
  const existingPadanNumber = padanType === "DISPATCH" 
    ? invoice.dispatchPadanNumber 
    : invoice.receiptPadanNumber;

  if (existingPadanNumber) {
    // Idempotent: return existing number
    return existingPadanNumber;
  }

  // Step 2: Generate new padan number (with transaction + lock)
  const padanNumber = await db.transaction(async (tx) => {
    // Get period (YYYYMM) from invoice date
    const invoiceDate = invoice.invoiceDate ? new Date(invoice.invoiceDate) : new Date();
    const period = `${invoiceDate.getFullYear()}${String(invoiceDate.getMonth() + 1).padStart(2, "0")}`;

    // SELECT ... FOR UPDATE (row lock) - ensures no race condition
    // Use raw SQL for row-level locking (Drizzle doesn't have built-in FOR UPDATE)
    const sequenceResult = await tx.execute(sql`
      SELECT id, tenant_id, type, period, last_number, created_at, updated_at
      FROM padan_number_sequences
      WHERE tenant_id = ${tenantId}::uuid 
        AND type = ${padanType}
        AND period = ${period}
      FOR UPDATE
      LIMIT 1
    `);
    
    const sequence = sequenceResult.rows[0] as {
      id: string;
      tenant_id: string;
      type: string;
      period: string;
      last_number: number;
      created_at: Date;
      updated_at: Date;
    } | undefined;

    let lastNumber: number;
    let sequenceId: string;

    if (sequence) {
      // Existing sequence: increment
      lastNumber = sequence.last_number + 1;
      sequenceId = sequence.id;

      // Update sequence
      await tx
        .update(padanNumberSequences)
        .set({
          lastNumber,
          updatedAt: new Date(),
        })
        .where(eq(padanNumberSequences.id, sequenceId));
    } else {
      // New sequence: create with lastNumber = 1
      lastNumber = 1;
      const [newSequence] = await tx
        .insert(padanNumberSequences)
        .values({
          tenantId,
          type: padanType,
          period,
          lastNumber: 1,
        })
        .returning();
      sequenceId = newSequence.id;
    }

    // Generate padan number: PD-YYYYMM-000123 or PR-YYYYMM-000045
    const prefix = padanType === "DISPATCH" ? "PD" : "PR";
    const numberPart = String(lastNumber).padStart(6, "0");
    const padanNumber = `${prefix}-${period}-${numberPart}`;

    // Update invoice with padan number
    const updateField = padanType === "DISPATCH" 
      ? { dispatchPadanNumber: padanNumber }
      : { receiptPadanNumber: padanNumber };

    await tx
      .update(invoices)
      .set(updateField)
      .where(eq(invoices.id, invoiceId));

    return padanNumber;
  });

  return padanNumber;
}

/**
 * Format padan number for display (already formatted, but helper for consistency)
 */
export function formatPadanNumber(padanNumber: string): string {
  // Already in format PD-YYYYMM-000123 or PR-YYYYMM-000045
  return padanNumber;
}
