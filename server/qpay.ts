/**
 * QPay Payment Integration Module
 * 
 * Монголын QPay QR төлбөрийн системтэй холбогдох модуль.
 * https://qpay.mn API-тай ажилладаг.
 * 
 * Дэмжигдэх банкууд:
 * - Хаан банк
 * - Голомт банк
 * - Худалдаа хөгжлийн банк
 * - Төрийн банк
 * - Хас банк
 * - Богд банк
 * - Капитрон банк
 * - гэх мэт...
 */

import crypto from 'crypto';

// QPay API configuration
export interface QPayConfig {
  username: string;        // QPay username
  password: string;        // QPay password
  invoiceCode: string;     // Invoice code (QPay-ээс олгосон)
  callbackUrl: string;     // Callback URL for payment notifications
  apiUrl: string;          // API URL
}

// QPay invoice request
export interface QPayInvoiceRequest {
  invoiceNo: string;       // Дотоод нэхэмжлэхийн дугаар
  senderInvoiceNo: string; // Sender invoice number
  invoiceDescription: string; // Тайлбар
  amount: number;          // Төлбөрийн дүн
  callbackUrl?: string;    // Callback URL
  // Line items for detailed invoice
  lines?: QPayInvoiceLine[];
}

export interface QPayInvoiceLine {
  lineDescription: string;
  lineQuantity: string;
  lineUnitPrice: string;
  taxProductCode?: string; // eBarimt tax code
}

// QPay invoice response
export interface QPayInvoiceResponse {
  success: boolean;
  invoiceId?: string;
  qrText?: string;         // QR code text
  qrImage?: string;        // QR code image (base64)
  qPayShortUrl?: string;   // Short URL for QR
  urls?: QPayDeepLink[];   // Deep links for mobile apps
  errorCode?: string;
  errorMessage?: string;
}

// Deep link for bank apps
export interface QPayDeepLink {
  name: string;            // Bank name
  description: string;     // Bank description
  logo: string;            // Logo URL
  link: string;            // Deep link URL
}

// Payment callback data
export interface QPayCallback {
  paymentId: string;
  paymentStatus: 'PAID' | 'FAILED' | 'PENDING';
  paymentDate?: string;
  paymentAmount?: number;
  paymentFee?: number;
  paymentBankCode?: string;
  paymentBankName?: string;
}

// Payment check response
export interface QPayPaymentCheckResponse {
  success: boolean;
  paid: boolean;
  paymentInfo?: {
    id: string;
    status: string;
    amount: number;
    paidDate: string;
    bankName: string;
  };
  errorMessage?: string;
}

/**
 * QPay Service Class
 */
export class QPayService {
  private config: QPayConfig;
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: QPayConfig) {
    this.config = config;
  }

  /**
   * Get access token (with caching)
   */
  private async getAccessToken(): Promise<string> {
    // Check if token is still valid
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return this.accessToken;
    }

    try {
      // In production, call QPay auth API
      // POST https://merchant.qpay.mn/v2/auth/token
      // Headers: Authorization: Basic base64(username:password)

      // Simulated token for development
      this.accessToken = `test-token-${Date.now()}`;
      this.tokenExpiry = new Date(Date.now() + 3600 * 1000); // 1 hour

      return this.accessToken;
    } catch (error: any) {
      console.error('[QPay] Auth error:', error);
      throw new Error('QPay холболт амжилтгүй');
    }
  }

  /**
   * Create QPay invoice
   * 
   * @param request - Invoice request data
   * @returns QPay invoice response with QR code
   */
  async createInvoice(request: QPayInvoiceRequest): Promise<QPayInvoiceResponse> {
    try {
      await this.getAccessToken();

      // Validate request
      if (request.amount <= 0) {
        return {
          success: false,
          errorCode: 'INVALID_AMOUNT',
          errorMessage: 'Төлбөрийн дүн 0-ээс их байх ёстой',
        };
      }

      // In production, call QPay create invoice API
      // POST https://merchant.qpay.mn/v2/invoice
      // Headers: Authorization: Bearer {accessToken}
      // Body: { invoice_code, sender_invoice_no, invoice_receiver_code, ... }

      // Generate simulated QR for development
      const invoiceId = `QPAY-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
      
      const qrData = {
        invoiceId,
        amount: request.amount,
        description: request.invoiceDescription,
        date: new Date().toISOString(),
      };
      
      const qrText = `QPay:${invoiceId}:${request.amount}`;
      
      // Simulated deep links for Mongolian banks
      const urls: QPayDeepLink[] = [
        {
          name: 'Khan Bank',
          description: 'Хаан банк',
          logo: 'https://qpay.mn/q/logo/khanbank.png',
          link: `khanbank://qpay?invoice=${invoiceId}`,
        },
        {
          name: 'Golomt Bank',
          description: 'Голомт банк',
          logo: 'https://qpay.mn/q/logo/golomt.png',
          link: `golomt://qpay?invoice=${invoiceId}`,
        },
        {
          name: 'TDB',
          description: 'Худалдаа хөгжлийн банк',
          logo: 'https://qpay.mn/q/logo/tdb.png',
          link: `tdb://qpay?invoice=${invoiceId}`,
        },
        {
          name: 'State Bank',
          description: 'Төрийн банк',
          logo: 'https://qpay.mn/q/logo/statebank.png',
          link: `statebank://qpay?invoice=${invoiceId}`,
        },
        {
          name: 'Xac Bank',
          description: 'Хас банк',
          logo: 'https://qpay.mn/q/logo/xacbank.png',
          link: `xacbank://qpay?invoice=${invoiceId}`,
        },
      ];

      console.log(`[QPay] Created invoice: ${request.invoiceNo} -> ${invoiceId}`);

      return {
        success: true,
        invoiceId,
        qrText,
        qrImage: Buffer.from(JSON.stringify(qrData)).toString('base64'), // Simulated QR image
        qPayShortUrl: `https://qpay.mn/q/${invoiceId}`,
        urls,
      };
    } catch (error: any) {
      console.error('[QPay] Error:', error);
      return {
        success: false,
        errorCode: 'API_ERROR',
        errorMessage: error.message || 'QPay системд алдаа гарлаа',
      };
    }
  }

  /**
   * Check payment status
   * 
   * @param invoiceId - QPay invoice ID
   * @returns Payment status
   */
  async checkPayment(invoiceId: string): Promise<QPayPaymentCheckResponse> {
    try {
      await this.getAccessToken();

      // In production, call QPay check payment API
      // POST https://merchant.qpay.mn/v2/payment/check
      // Headers: Authorization: Bearer {accessToken}
      // Body: { object_type: 'INVOICE', object_id: invoiceId }

      // Simulated response
      return {
        success: true,
        paid: false, // Will be true when payment is received
        paymentInfo: undefined,
      };
    } catch (error: any) {
      console.error('[QPay] Check error:', error);
      return {
        success: false,
        paid: false,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Cancel QPay invoice
   * 
   * @param invoiceId - QPay invoice ID
   * @returns Success status
   */
  async cancelInvoice(invoiceId: string): Promise<{ success: boolean; errorMessage?: string }> {
    try {
      await this.getAccessToken();

      // In production, call QPay cancel API
      // DELETE https://merchant.qpay.mn/v2/invoice/{invoiceId}

      console.log(`[QPay] Cancelled invoice: ${invoiceId}`);

      return { success: true };
    } catch (error: any) {
      console.error('[QPay] Cancel error:', error);
      return {
        success: false,
        errorMessage: error.message,
      };
    }
  }

  /**
   * Handle payment callback from QPay
   * 
   * @param callback - Callback data from QPay webhook
   * @returns Processing result
   */
  async handleCallback(callback: QPayCallback): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`[QPay] Callback received: ${JSON.stringify(callback)}`);

      if (callback.paymentStatus === 'PAID') {
        // Update invoice status in database
        // await updateInvoicePayment(callback.paymentId, callback);
        
        return {
          success: true,
          message: 'Төлбөр амжилттай хүлээн авлаа',
        };
      }

      return {
        success: true,
        message: `Төлбөрийн статус: ${callback.paymentStatus}`,
      };
    } catch (error: any) {
      console.error('[QPay] Callback error:', error);
      return {
        success: false,
        message: error.message,
      };
    }
  }
}

/**
 * SocialPay Integration (Similar to QPay)
 * 
 * Golomt банкны SocialPay системтэй холбогдох
 */
export interface SocialPayConfig {
  merchantId: string;
  terminalId: string;
  apiKey: string;
  apiUrl: string;
}

export class SocialPayService {
  private config: SocialPayConfig;

  constructor(config: SocialPayConfig) {
    this.config = config;
  }

  /**
   * Create SocialPay invoice
   */
  async createInvoice(request: {
    invoiceNo: string;
    amount: number;
    description: string;
  }): Promise<QPayInvoiceResponse> {
    try {
      // In production, call SocialPay API
      // Similar to QPay but with SocialPay specific endpoints

      const invoiceId = `SP-${Date.now()}`;
      
      return {
        success: true,
        invoiceId,
        qrText: `SocialPay:${invoiceId}:${request.amount}`,
        qPayShortUrl: `https://socialpay.golomtbank.com/${invoiceId}`,
        urls: [
          {
            name: 'SocialPay',
            description: 'Голомт банк SocialPay',
            logo: 'https://socialpay.golomtbank.com/logo.png',
            link: `socialpay://pay?invoice=${invoiceId}`,
          },
        ],
      };
    } catch (error: any) {
      return {
        success: false,
        errorCode: 'API_ERROR',
        errorMessage: error.message,
      };
    }
  }
}

/**
 * Create QPay service instance
 */
export function createQPayService(): QPayService {
  const config: QPayConfig = {
    username: process.env.QPAY_USERNAME || 'test-user',
    password: process.env.QPAY_PASSWORD || 'test-pass',
    invoiceCode: process.env.QPAY_INVOICE_CODE || 'TEST_INVOICE',
    callbackUrl: process.env.QPAY_CALLBACK_URL || 'https://example.com/api/qpay/callback',
    apiUrl: process.env.QPAY_API_URL || 'https://merchant.qpay.mn/v2',
  };

  return new QPayService(config);
}

// Export singleton
export const qpay = createQPayService();

/**
 * Unified Payment Service
 * 
 * Олон төлбөрийн системийг нэгтгэх
 */
export class UnifiedPaymentService {
  private qpay: QPayService;
  private socialpay: SocialPayService | null;

  constructor() {
    this.qpay = createQPayService();
    this.socialpay = null; // Initialize when needed
  }

  /**
   * Create payment invoice with preferred method
   */
  async createPaymentInvoice(
    method: 'qpay' | 'socialpay' | 'all',
    invoiceNo: string,
    amount: number,
    description: string
  ): Promise<{
    success: boolean;
    qpay?: QPayInvoiceResponse;
    socialpay?: QPayInvoiceResponse;
    errorMessage?: string;
  }> {
    const result: any = { success: true };

    if (method === 'qpay' || method === 'all') {
      result.qpay = await this.qpay.createInvoice({
        invoiceNo,
        senderInvoiceNo: invoiceNo,
        invoiceDescription: description,
        amount,
      });
    }

    if ((method === 'socialpay' || method === 'all') && this.socialpay) {
      result.socialpay = await this.socialpay.createInvoice({
        invoiceNo,
        amount,
        description,
      });
    }

    return result;
  }
}

export const unifiedPayment = new UnifiedPaymentService();
