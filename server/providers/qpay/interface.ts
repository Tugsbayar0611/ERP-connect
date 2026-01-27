/**
 * QPay Provider Interface
 * Монголын QPay системтэй интеграци хийх interface
 */

export interface QPayConfig {
  enabled: boolean;
  mode: "sandbox" | "production";
  clientId: string; // OAuth 2.0 client_id
  clientSecret: string; // OAuth 2.0 client_secret
  invoiceCode: string; // Invoice code provided by QPay
  callbackSecret?: string; // Secret for webhook signature verification
}

export interface QPayInvoiceRequest {
  senderInvoiceNo: string; // Your unique invoice number
  invoiceReceiverCode?: string; // Default: "terminal"
  invoiceDescription: string;
  amount: number;
  callbackUrl: string;
  allowPartial?: boolean;
  allowExceed?: boolean;
  minimumAmount?: number;
  maximumAmount?: number;
}

export interface QPayInvoiceResponse {
  invoiceId: string; // QPay invoice ID (UUID)
  qrText: string; // EMVCo QR code text
  qrImage: string; // Base64 QR code image
  urls?: Array<{
    name: string;
    description: string;
    link: string;
  }>;
}

export interface QPayPaymentCheckRequest {
  objectType: "INVOICE" | "QR" | "ITEM";
  objectId: string; // invoice_id, QR code, or item ID
  offset?: {
    pageNumber: number;
    pageLimit: number;
  };
}

export interface QPayPayment {
  paymentId: string;
  paymentStatus: "NEW" | "FAILED" | "PAID" | "REFUNDED";
  paymentDate: string;
  paymentFee?: number;
  paymentAmount: number;
  paymentCurrency: string;
  paymentWallet?: string;
  transactionType?: "P2P" | "CARD";
}

export interface QPayPaymentCheckResponse {
  count: number;
  paidAmount: number;
  rows: QPayPayment[];
}

export interface QPayResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  errorCode?: string;
}

/**
 * QPay Provider Interface
 * Provider implementations must implement this interface
 */
export interface IQPayProvider {
  /**
   * Initialize provider with configuration
   */
  initialize(config: QPayConfig): void;

  /**
   * Get access token (OAuth 2.0)
   */
  getAccessToken(): Promise<string>;

  /**
   * Create invoice and get QR code
   */
  createInvoice(request: QPayInvoiceRequest): Promise<QPayResponse<QPayInvoiceResponse>>;

  /**
   * Get invoice details
   */
  getInvoice(invoiceId: string): Promise<QPayResponse<QPayInvoiceResponse>>;

  /**
   * Cancel invoice
   */
  cancelInvoice(invoiceId: string): Promise<QPayResponse>;

  /**
   * Check payment status
   */
  checkPaymentStatus(request: QPayPaymentCheckRequest): Promise<QPayResponse<QPayPaymentCheckResponse>>;

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(signature: string, payload: string): boolean;

  /**
   * Check if provider is configured and ready
   */
  isConfigured(): boolean;
}
