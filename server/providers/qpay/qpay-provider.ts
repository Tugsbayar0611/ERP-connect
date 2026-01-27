/**
 * QPay Provider Implementation
 * Монголын QPay системтэй интеграци
 * 
 * API Documentation: https://developer.qpay.mn
 * API Version: v2
 */

import type {
  IQPayProvider,
  QPayConfig,
  QPayInvoiceRequest,
  QPayInvoiceResponse,
  QPayPaymentCheckRequest,
  QPayPaymentCheckResponse,
  QPayResponse,
} from "./interface";
import crypto from "crypto";

export class QPayProvider implements IQPayProvider {
  private config: QPayConfig | null = null;
  private baseUrl: string = "";
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  /**
   * Initialize provider with configuration
   */
  initialize(config: QPayConfig): void {
    this.config = config;
    
    // Set base URL based on mode
    this.baseUrl = config.mode === "production"
      ? "https://merchant.qpay.mn"
      : "https://merchant-sandbox.qpay.mn";
  }

  /**
   * Check if provider is configured
   */
  isConfigured(): boolean {
    return !!(
      this.config &&
      this.config.enabled &&
      this.config.clientId &&
      this.config.clientSecret &&
      this.config.invoiceCode &&
      this.baseUrl
    );
  }

  /**
   * Get access token (OAuth 2.0)
   * Token is cached until expiration
   */
  async getAccessToken(): Promise<string> {
    // Return cached token if still valid
    if (this.accessToken && Date.now() < this.tokenExpiresAt) {
      return this.accessToken;
    }

    if (!this.isConfigured()) {
      throw new Error("QPay provider is not configured");
    }

    try {
      // OAuth 2.0 token request
      const response = await fetch(`${this.baseUrl}/v2/auth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: this.config!.clientId,
          password: this.config!.clientSecret,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      this.accessToken = result.access_token;
      // Token expires in 1 hour (3600 seconds), refresh 5 minutes early
      this.tokenExpiresAt = Date.now() + (result.expires_in - 300) * 1000;

      return this.accessToken!;
    } catch (error: any) {
      console.error("QPay token error:", error);
      throw new Error(`Failed to get QPay access token: ${error.message}`);
    }
  }

  /**
   * Create invoice and get QR code
   */
  async createInvoice(request: QPayInvoiceRequest): Promise<QPayResponse<QPayInvoiceResponse>> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "QPay provider is not configured",
      };
    }

    // Mock mode for sandbox/testing
    if (this.config!.mode === "sandbox" && !this.config!.clientId) {
      console.log("🔧 QPay Mock Mode: Returning mock response for testing");
      
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      const invoiceId = `qpay-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      const qrText = `00020101021238570010A00000072701270006${this.config!.invoiceCode}0104${request.amount}5303764540${request.amount}5802MN5906QPay${invoiceId}62070703***6304`;
      
      // Generate QR code image (using QR Server API for mock)
      const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrText)}`;
      
      return {
        success: true,
        data: {
          invoiceId,
          qrText,
          qrImage: qrImageUrl,
        },
      };
    }

    // Production mode: Make actual API call
    try {
      const token = await this.getAccessToken();

      const payload = {
        invoice_code: this.config!.invoiceCode,
        sender_invoice_no: request.senderInvoiceNo,
        invoice_receiver_code: request.invoiceReceiverCode || "terminal",
        invoice_description: request.invoiceDescription,
        amount: request.amount,
        callback_url: request.callbackUrl,
        ...(request.allowPartial !== undefined && { allow_partial: request.allowPartial }),
        ...(request.allowExceed !== undefined && { allow_exceed: request.allowExceed }),
        ...(request.minimumAmount !== undefined && { minimum_amount: request.minimumAmount }),
        ...(request.maximumAmount !== undefined && { maximum_amount: request.maximumAmount }),
      };

      const response = await fetch(`${this.baseUrl}/v2/invoice`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          error: errorData.message || `HTTP ${response.status}: ${response.statusText}`,
          errorCode: errorData.code || String(response.status),
        };
      }

      const result = await response.json();
      
      return {
        success: true,
        data: {
          invoiceId: result.invoice_id,
          qrText: result.qr_text,
          qrImage: result.qr_image,
          urls: result.urls,
        },
      };
    } catch (error: any) {
      console.error("QPay create invoice error:", error);
      return {
        success: false,
        error: error.message || "Failed to create QPay invoice",
      };
    }
  }

  /**
   * Get invoice details
   */
  async getInvoice(invoiceId: string): Promise<QPayResponse<QPayInvoiceResponse>> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "QPay provider is not configured",
      };
    }

    try {
      const token = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/v2/invoice/${invoiceId}`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
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
        data: {
          invoiceId: result.invoice_id,
          qrText: result.qr_text,
          qrImage: result.qr_image,
          urls: result.urls,
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to get QPay invoice",
      };
    }
  }

  /**
   * Cancel invoice
   */
  async cancelInvoice(invoiceId: string): Promise<QPayResponse> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "QPay provider is not configured",
      };
    }

    try {
      const token = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/v2/invoice/${invoiceId}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${token}`,
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

      return {
        success: true,
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to cancel QPay invoice",
      };
    }
  }

  /**
   * Check payment status
   */
  async checkPaymentStatus(request: QPayPaymentCheckRequest): Promise<QPayResponse<QPayPaymentCheckResponse>> {
    if (!this.isConfigured()) {
      return {
        success: false,
        error: "QPay provider is not configured",
      };
    }

    try {
      const token = await this.getAccessToken();

      const payload = {
        object_type: request.objectType,
        object_id: request.objectId,
        offset: request.offset || { page_number: 1, page_limit: 100 },
      };

      const response = await fetch(`${this.baseUrl}/v2/payment/check`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
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
        data: {
          count: result.count,
          paidAmount: result.paid_amount,
          rows: result.rows.map((row: any) => ({
            paymentId: row.payment_id,
            paymentStatus: row.payment_status,
            paymentDate: row.payment_date,
            paymentFee: row.payment_fee,
            paymentAmount: row.payment_amount,
            paymentCurrency: row.payment_currency,
            paymentWallet: row.payment_wallet,
            transactionType: row.transaction_type,
          })),
        },
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || "Failed to check QPay payment status",
      };
    }
  }

  /**
   * Verify webhook signature
   * QPay may send signature in headers or query params
   */
  verifyWebhookSignature(signature: string, payload: string): boolean {
    if (!this.config?.callbackSecret) {
      // If no secret configured, skip verification (not recommended for production)
      console.warn("QPay webhook secret not configured, skipping signature verification");
      return true;
    }

    try {
      // QPay typically uses HMAC-SHA256
      const expectedSignature = crypto
        .createHmac("sha256", this.config.callbackSecret)
        .update(payload)
        .digest("hex");

      // Compare signatures (constant-time comparison)
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error("QPay signature verification error:", error);
      return false;
    }
  }
}

/**
 * Create QPay provider instance
 */
export function createQPayProvider(config: QPayConfig): IQPayProvider {
  const provider = new QPayProvider();
  provider.initialize(config);
  return provider;
}
