/**
 * E-barimt (И-баримт) Service
 * Монголын татварын албаны И-баримт системтэй интеграци
 * 
 * Uses Provider pattern (similar to QPay)
 * Provider: ITCV3Provider (PosAPI 3.0)
 */

import { db } from "./db";
import { eq, and } from "drizzle-orm";
import { invoices, invoiceLines, contacts, tenants, products, taxCodes, bankAccounts } from "@shared/schema";
import type { Invoice, InvoiceLine, Contact, Tenant } from "@shared/schema";
import { createEBarimtProvider } from "./providers/ebarimt";
import type { EBarimtInvoiceData } from "./providers/ebarimt";

// Re-export types from provider
export type { EBarimtInvoiceData, EBarimtResponse } from "./providers/ebarimt";

/**
 * EBarimtService - И-баримт системтэй холбох service
 * Uses Provider pattern for flexibility
 */
export class EBarimtService {
  private provider: ReturnType<typeof createEBarimtProvider> | null = null;

  /**
   * Prepare E-barimt invoice data from MonERP Invoice
   */
  async prepareInvoiceData(
    invoiceId: string,
    tenantId: string
  ): Promise<EBarimtInvoiceData> {
    // Fetch invoice with lines
    const [invoice] = await db
      .select()
      .from(invoices)
      .where(and(eq(invoices.id, invoiceId), eq(invoices.tenantId, tenantId)))
      .limit(1);

    if (!invoice) {
      throw new Error("Invoice not found");
    }

    // Fetch invoice lines
    const lines = await db
      .select()
      .from(invoiceLines)
      .where(eq(invoiceLines.invoiceId, invoiceId))
      .orderBy(invoiceLines.id);

    // Fetch contact (buyer)
    const [contact] = await db
      .select()
      .from(contacts)
      .where(eq(contacts.id, invoice.contactId))
      .limit(1);

    if (!contact) {
      throw new Error("Contact not found");
    }

    // Fetch tenant (seller)
    const [tenant] = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .limit(1);

    if (!tenant) {
      throw new Error("Tenant not found");
    }

    // Determine document type
    const isCompany = !!(contact.regNo || contact.vatNo);
    const documentType: EBarimtInvoiceData["documentType"] = isCompany
      ? "Invoice-Company"
      : "Invoice-Individual";

    // Prepare line items
    const items = await Promise.all(
      lines.map(async (line) => {
        // Fetch product if available
        let productCode = "";
        let productSpecCode = "";
        let unit = "ш"; // Default unit

        if (line.productId) {
          const [product] = await db
            .select()
            .from(products)
            .where(eq(products.id, line.productId))
            .limit(1);

          if (product) {
            productCode = product.sku || "";
            // Product specification code should be set in product category or product
            // For now, we'll use a default or leave empty
            unit = product.unit || "ш";
          }
        }

        // Fetch tax code info
        let taxRate = parseFloat(line.taxRate.toString());
        if (line.taxCodeId) {
          const [taxCode] = await db
            .select()
            .from(taxCodes)
            .where(eq(taxCodes.id, line.taxCodeId))
            .limit(1);

          if (taxCode) {
            taxRate = parseFloat(taxCode.rate.toString());
          }
        }

        return {
          productCode: productCode || undefined,
          productName: line.description,
          productSpecCode: productSpecCode || undefined,
          unit: unit,
          quantity: parseFloat(line.quantity.toString()),
          unitPrice: parseFloat(line.unitPrice.toString()),
          discount: 0, // TODO: Add discount support
          taxRate: taxRate,
          taxAmount: parseFloat(line.taxAmount.toString()),
          subtotal: parseFloat(line.subtotal.toString()),
          total: parseFloat(line.total.toString()),
        };
      })
    );

    // Parse invoice date
    const invoiceDate = new Date(invoice.invoiceDate);
    const issueDate = invoiceDate.toISOString().split("T")[0]; // YYYY-MM-DD
    const issueTime = invoiceDate.toTimeString().split(" ")[0]; // HH:mm:ss

    // Prepare seller info (tenant)
    // Get primary bank account if available
    const [primaryBankAccount] = await db
      .select()
      .from(bankAccounts)
      .where(and(eq(bankAccounts.tenantId, tenantId), eq(bankAccounts.isActive, true)))
      .limit(1);

    const seller = {
      tin: tenant.vatNo || "",
      name: tenant.legalName || tenant.name,
      address: tenant.address || undefined,
      district: tenant.district || undefined,
      city: tenant.city || undefined,
      bankAccount: primaryBankAccount?.accountNumber || undefined,
      bankName: primaryBankAccount?.bankName || undefined,
    };

    // Prepare buyer info (contact)
    const buyer = {
      tin: contact.vatNo || undefined,
      name: contact.companyName || `${contact.firstName || ""} ${contact.lastName || ""}`.trim() || "Хувь хүн",
      address: contact.address || undefined,
      district: contact.district || undefined,
      city: contact.city || undefined,
      regNo: contact.regNo || undefined,
    };

    // Prepare totals
    const totals = {
      subtotal: parseFloat(invoice.subtotal.toString()),
      taxAmount: parseFloat(invoice.taxAmount.toString()),
      totalAmount: parseFloat(invoice.totalAmount.toString()),
    };

    // Determine payment method
    const paymentMethodMap: Record<string, "cash" | "bank_transfer" | "card" | "qr_code" | "other"> = {
      cash: "cash",
      bank_transfer: "bank_transfer",
      qpay: "qr_code",
      qr_code: "qr_code",
      card: "card",
    };

    const payment = {
      method: paymentMethodMap[invoice.paymentMethod || ""] || "other",
      amount: parseFloat(invoice.totalAmount.toString()),
    };

    return {
      documentType,
      issueDate,
      issueTime,
      documentNumber: invoice.invoiceNumber,
      seller,
      buyer,
      items,
      totals,
      payment,
    };
  }

  /**
   * Initialize service with provider configuration
   */
  initialize(config: {
    enabled: boolean;
    mode: "sandbox" | "production";
    posEndpoint: string;
    apiKey: string;
    apiSecret?: string;
    autoSend?: boolean;
  }): void {
    if (!config.enabled) {
      this.provider = null;
      return;
    }

    this.provider = createEBarimtProvider({
      enabled: config.enabled,
      mode: config.mode,
      posEndpoint: config.posEndpoint,
      apiKey: config.apiKey,
      apiSecret: config.apiSecret,
      autoSend: config.autoSend,
    });
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return this.provider !== null && this.provider.isConfigured();
  }

  /**
   * Send invoice to E-barimt system
   */
  async sendInvoice(invoiceData: EBarimtInvoiceData): Promise<import("./providers/ebarimt").EBarimtResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "E-barimt provider is not configured",
      };
    }

    return await this.provider!.sendInvoice(invoiceData);
  }

  /**
   * Verify invoice status in E-barimt system
   */
  async verifyInvoice(documentId: string): Promise<import("./providers/ebarimt").EBarimtResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "E-barimt provider is not configured",
      };
    }

    return await this.provider!.verifyInvoice(documentId);
  }

  /**
   * Cancel invoice in E-barimt system
   */
  async cancelInvoice(documentId: string, reason?: string): Promise<import("./providers/ebarimt").EBarimtResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "E-barimt provider is not configured",
      };
    }

    return await this.provider!.cancelInvoice(documentId, reason);
  }
}

/**
 * Create EBarimtService instance from tenant settings
 * Reads from ebarimt_settings table (similar to QPay)
 */
export async function createEBarimtService(tenantId: string, storage: any): Promise<EBarimtService | null> {
  const settings = await storage.getEBarimtSettings(tenantId);
  
  if (!settings || !settings.enabled) {
    return null;
  }

  const mode = (settings.mode as "sandbox" | "production") || "sandbox";

  // In sandbox mode, we can use mock data, so posEndpoint and apiKey are optional
  // In production mode, they are required
  if (mode === "production") {
    if (!settings.posEndpoint || !settings.apiKey) {
      console.warn("E-barimt settings incomplete for tenant (production mode requires posEndpoint and apiKey):", tenantId);
      return null;
    }
  }

  // For sandbox mode, use default values if not provided
  const posEndpoint = settings.posEndpoint || (mode === "sandbox" ? "https://sandbox.ebarimt.mn/api/v3" : "");
  const apiKey = settings.apiKey || (mode === "sandbox" ? "mock-api-key" : "");

  // If production mode and still missing, return null
  if (mode === "production" && (!posEndpoint || !apiKey)) {
    console.warn("E-barimt settings incomplete for tenant:", tenantId);
    return null;
  }

  const service = new EBarimtService();
  service.initialize({
    enabled: settings.enabled,
    mode,
    posEndpoint,
    apiKey,
    apiSecret: settings.apiSecret || undefined,
    autoSend: settings.autoSend || false,
  });

  return service;
}
