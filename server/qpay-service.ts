/**
 * QPay Service
 * Монголын QPay системтэй интеграци
 * 
 * Uses Provider pattern (similar to E-barimt)
 */

import { createQPayProvider } from "./providers/qpay";
import type { IQPayProvider, QPayInvoiceRequest, QPayPaymentCheckRequest } from "./providers/qpay";

/**
 * QPayService - QPay системтэй холбох service
 * Uses Provider pattern for flexibility
 */
export class QPayService {
  private provider: IQPayProvider | null = null;

  /**
   * Initialize service with provider configuration
   */
  initialize(config: {
    enabled: boolean;
    mode: "sandbox" | "production";
    clientId: string;
    clientSecret: string;
    invoiceCode: string;
    callbackSecret?: string;
  }): void {
    if (!config.enabled) {
      this.provider = null;
      return;
    }

    this.provider = createQPayProvider({
      enabled: config.enabled,
      mode: config.mode,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      invoiceCode: config.invoiceCode,
      callbackSecret: config.callbackSecret,
    });
  }

  /**
   * Check if service is configured
   */
  isConfigured(): boolean {
    return this.provider !== null && this.provider.isConfigured();
  }

  /**
   * Create invoice and get QR code
   */
  async createInvoice(request: QPayInvoiceRequest) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "QPay provider is not configured",
      };
    }

    return await this.provider!.createInvoice(request);
  }

  /**
   * Get invoice details
   */
  async getInvoice(invoiceId: string) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "QPay provider is not configured",
      };
    }

    return await this.provider!.getInvoice(invoiceId);
  }

  /**
   * Cancel invoice
   */
  async cancelInvoice(invoiceId: string) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "QPay provider is not configured",
      };
    }

    return await this.provider!.cancelInvoice(invoiceId);
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(request: QPayPaymentCheckRequest) {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "QPay provider is not configured",
      };
    }

    return await this.provider!.checkPaymentStatus(request);
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(signature: string, payload: string): boolean {
    if (!this.provider) {
      return false;
    }

    return this.provider.verifyWebhookSignature(signature, payload);
  }
}

/**
 * Create QPayService instance from tenant settings
 * Reads from qpay_settings table
 */
export async function createQPayService(tenantId: string, storage: any): Promise<QPayService | null> {
  const settings = await storage.getQPaySettings(tenantId);
  
  if (!settings || !settings.enabled) {
    return null;
  }

  const mode = (settings.mode as "sandbox" | "production") || "sandbox";

  // In production mode, clientId, clientSecret, and invoiceCode are required
  if (mode === "production") {
    if (!settings.clientId || !settings.clientSecret || !settings.invoiceCode) {
      console.warn("QPay settings incomplete for tenant (production mode requires clientId, clientSecret, and invoiceCode):", tenantId);
      return null;
    }
  }

  // For sandbox mode, use default values if not provided
  const clientId = settings.clientId || (mode === "sandbox" ? "test_client_id" : "");
  const clientSecret = settings.clientSecret || (mode === "sandbox" ? "test_client_secret" : "");
  const invoiceCode = settings.invoiceCode || (mode === "sandbox" ? "TEST_INVOICE" : "");

  // If production mode and still missing, return null
  if (mode === "production" && (!clientId || !clientSecret || !invoiceCode)) {
    console.warn("QPay settings incomplete for tenant:", tenantId);
    return null;
  }

  const service = new QPayService();
  service.initialize({
    enabled: settings.enabled,
    mode,
    clientId,
    clientSecret,
    invoiceCode,
    callbackSecret: settings.callbackSecret || undefined,
  });

  return service;
}
