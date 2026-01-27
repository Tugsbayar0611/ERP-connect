/**
 * ITCV3 Provider (PosAPI 3.0)
 * Монголын татварын албаны PosAPI 3.0 протокол дээр суурилсан E-barimt provider
 * 
 * Reference: Odoo Mongolian EBarimt PosAPI3 module
 * API Version: PosAPI 3.0
 */

import type {
  IEBarimtProvider,
  EBarimtConfig,
  EBarimtInvoiceData,
  EBarimtResponse,
} from "./interface";

export class ITCV3Provider implements IEBarimtProvider {
  private config: EBarimtConfig | null = null;
  private baseUrl: string = "";

  /**
   * Initialize provider with configuration
   */
  initialize(config: EBarimtConfig): void {
    this.config = config;
    
    // Set base URL based on mode
    if (config.posEndpoint) {
      this.baseUrl = config.posEndpoint;
    } else {
      // Default endpoints (update with actual E-barimt API URLs)
      this.baseUrl = config.mode === "production"
        ? "https://api.ebarimt.mn/api/v3"
        : "https://sandbox.ebarimt.mn/api/v3";
    }
  }

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    return !!(
      this.config &&
      this.config.enabled &&
      this.config.apiKey &&
      this.baseUrl
    );
  }

  /**
   * Send invoice to E-barimt system (PosAPI 3.0)
   * In sandbox mode, returns mock data for testing
   */
  async sendInvoice(invoiceData: EBarimtInvoiceData): Promise<EBarimtResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "E-barimt provider is not configured",
      };
    }

    // Mock mode for sandbox/testing
    if (this.config!.mode === "sandbox") {
      console.log("🔧 E-barimt Mock Mode: Returning mock response for testing");
      
      // Simulate API delay (800ms)
      await new Promise(resolve => setTimeout(resolve, 800));

      // Generate unique document ID
      const documentId = `EB-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Generate QR code URL (using QR Server API for mock)
      const qrData = `EBARIMT:${documentId}:${invoiceData.documentNumber}:${invoiceData.totals.totalAmount}`;
      const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(qrData)}`;
      
      // Generate receipt number
      const receiptNumber = `RE-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;
      
      // Generate lottery number (8 digits)
      const lotteryNumber = Math.floor(10000000 + Math.random() * 90000000).toString();

      return {
        success: true,
        documentId,
        qrCode: qrCodeUrl,
        receiptNumber,
        rawResponse: {
          mode: "mock",
          documentId,
          qrCode: qrCodeUrl,
          receiptNumber,
          lotteryNumber,
          timestamp: new Date().toISOString(),
        },
      };
    }

    // Production mode: Make actual API call
    try {
      // Prepare request payload according to PosAPI 3.0 format
      const payload = this.preparePayload(invoiceData);

      // Make HTTP request to E-barimt API
      const response = await fetch(`${this.baseUrl}/invoices`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config!.apiKey}`,
          ...(this.config!.apiSecret && {
            "X-API-Secret": this.config!.apiSecret,
          }),
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          errorCode: errorData.code || String(response.status),
          rawResponse: errorData,
        };
      }

      const result = await response.json();

      // Parse response according to PosAPI 3.0 format
      return {
        success: true,
        documentId: result.documentId || result.id,
        qrCode: result.qrCode || result.qr_code,
        receiptNumber: result.receiptNumber || result.receipt_number,
        lotteryNumber: result.lotteryNumber || result.lottery_number || result.lottery,
        rawResponse: result,
      };
    } catch (error: any) {
      console.error("E-barimt API error:", error);
      return {
        success: false,
        error: error.message || "Failed to send invoice to E-barimt",
        rawResponse: error,
      };
    }
  }

  /**
   * Verify invoice status in E-barimt system
   */
  async verifyInvoice(documentId: string): Promise<EBarimtResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "E-barimt provider is not configured",
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/invoices/${documentId}/verify`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${this.config!.apiKey}`,
          ...(this.config!.apiSecret && {
            "X-API-Secret": this.config!.apiSecret,
          }),
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}`,
          errorCode: errorData.code,
        };
      }

      const result = await response.json();
      return {
        success: true,
        documentId: result.documentId || documentId,
        qrCode: result.qrCode,
        rawResponse: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to verify invoice",
      };
    }
  }

  /**
   * Cancel/void invoice in E-barimt system
   */
  async cancelInvoice(documentId: string, reason?: string): Promise<EBarimtResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "E-barimt provider is not configured",
      };
    }

    try {
      const response = await fetch(`${this.baseUrl}/invoices/${documentId}/cancel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.config!.apiKey}`,
          ...(this.config!.apiSecret && {
            "X-API-Secret": this.config!.apiSecret,
          }),
        },
        body: JSON.stringify({ reason: reason || "Cancelled by user" }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}`,
          errorCode: errorData.code,
        };
      }

      const result = await response.json();
      return {
        success: true,
        documentId: result.documentId || documentId,
        rawResponse: result,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to cancel invoice",
      };
    }
  }

  /**
   * Prepare request payload according to PosAPI 3.0 format
   * This format may need adjustment based on actual E-barimt API documentation
   */
  private preparePayload(invoiceData: EBarimtInvoiceData): any {
    return {
      // Document header
      documentType: invoiceData.documentType,
      issueDate: invoiceData.issueDate,
      issueTime: invoiceData.issueTime,
      documentNumber: invoiceData.documentNumber,

      // Seller information
      seller: {
        tin: invoiceData.seller.tin,
        name: invoiceData.seller.name,
        address: invoiceData.seller.address,
        district: invoiceData.seller.district,
        city: invoiceData.seller.city,
        bankAccount: invoiceData.seller.bankAccount,
        bankName: invoiceData.seller.bankName,
      },

      // Buyer information
      buyer: {
        tin: invoiceData.buyer.tin,
        name: invoiceData.buyer.name,
        address: invoiceData.buyer.address,
        district: invoiceData.buyer.district,
        city: invoiceData.buyer.city,
        regNo: invoiceData.buyer.regNo,
      },

      // Line items
      items: invoiceData.items.map((item) => ({
        productCode: item.productCode,
        productName: item.productName,
        productSpecCode: item.productSpecCode,
        unit: item.unit,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount || 0,
        taxRate: item.taxRate,
        taxAmount: item.taxAmount,
        subtotal: item.subtotal,
        total: item.total,
      })),

      // Totals
      totals: {
        subtotal: invoiceData.totals.subtotal,
        taxAmount: invoiceData.totals.taxAmount,
        totalAmount: invoiceData.totals.totalAmount,
        discount: invoiceData.totals.discount || 0,
      },

      // Payment information
      payment: {
        method: invoiceData.payment.method,
        amount: invoiceData.payment.amount,
        change: invoiceData.payment.change || 0,
      },

      // Location (optional)
      ...(invoiceData.location && {
        location: invoiceData.location,
      }),
    };
  }
}
