/**
 * e-Barimt (Цахим Баримт) Integration Module
 * 
 * Монголын Татварын Ерөнхий Газрын (ТЕГ) e-Barimt системтэй холбогдох модуль.
 * https://ebarimt.mn API-тай ажилладаг.
 * 
 * Шаардлагатай: eBarimt POS API гэрээ байгуулсан байх
 */

import crypto from 'crypto';

// e-Barimt API configuration
export interface EBarimtConfig {
  posNo: string;           // POS дугаар (ТЕГ-ээс авсан)
  merchantId: string;      // Merchant ID
  branchNo: string;        // Салбарын дугаар
  apiUrl: string;          // API URL (production/test)
  apiKey: string;          // API Key
}

// Invoice data for e-Barimt
export interface EBarimtInvoice {
  amount: number;          // Нийт дүн (ХХОАТ-тай)
  vat: number;             // ХХОАТ дүн
  cityTax: number;         // Нийслэлийн татвар (0 эсвэл 1%)
  cashAmount: number;      // Бэлэн мөнгөөр төлсөн дүн
  nonCashAmount: number;   // Бэлэн бус төлсөн дүн (карт, данс)
  billType: 'B2C' | 'B2B'; // B2C = Иргэн, B2B = Байгууллага
  customerTin?: string;    // Харилцагчийн ТТД (B2B үед заавал)
  customerName?: string;   // Харилцагчийн нэр
  invoiceNo: string;       // Дотоод нэхэмжлэхийн дугаар
  items: EBarimtItem[];    // Барааны жагсаалт
}

// Item data for e-Barimt
export interface EBarimtItem {
  name: string;            // Барааны нэр
  measureUnit: string;     // Хэмжих нэгж
  qty: number;             // Тоо ширхэг
  unitPrice: number;       // Нэгж үнэ (ХХОАТ-тай)
  totalAmount: number;     // Нийт дүн
  barcode?: string;        // Бар код (заавал биш)
  sku?: string;            // SKU
}

// e-Barimt response
export interface EBarimtResponse {
  success: boolean;
  billId?: string;         // e-Barimt баримтын дугаар
  lottery?: string;        // Сугалааны дугаар
  qrData?: string;         // QR код өгөгдөл
  date?: string;           // Баримт үүссэн огноо
  errorCode?: string;
  errorMessage?: string;
}

// Lottery check response
export interface LotteryCheckResponse {
  success: boolean;
  winner: boolean;
  prize?: number;
  message?: string;
}

/**
 * e-Barimt Service Class
 * 
 * Жинхэнэ хэрэгжүүлэлтэнд ТЕГ-ийн API-тай холбогдоно.
 * Энэ нь жишээ implementation бөгөөд Production-д ТЕГ-ийн
 * POS API гарын авлагын дагуу тохируулах шаардлагатай.
 */
export class EBarimtService {
  private config: EBarimtConfig;

  constructor(config: EBarimtConfig) {
    this.config = config;
  }

  /**
   * Generate bill ID for reference
   */
  private generateBillId(): string {
    return `EB-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  }

  /**
   * Generate lottery number
   * Format: XXXXXX (6 digit)
   */
  private generateLotteryNumber(): string {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  /**
   * Generate QR code data
   * Real implementation should use ТЕГ's QR format
   */
  private generateQRData(billId: string, lottery: string, amount: number): string {
    // Production QR format from ТЕГ
    // This is a simplified example
    const data = {
      billId,
      lottery,
      amount,
      posNo: this.config.posNo,
      date: new Date().toISOString(),
    };
    return Buffer.from(JSON.stringify(data)).toString('base64');
  }

  /**
   * Register invoice with e-Barimt
   * 
   * @param invoice - Invoice data
   * @returns e-Barimt response with bill ID and lottery number
   */
  async registerInvoice(invoice: EBarimtInvoice): Promise<EBarimtResponse> {
    try {
      // Validate invoice data
      if (invoice.amount <= 0) {
        return {
          success: false,
          errorCode: 'INVALID_AMOUNT',
          errorMessage: 'Нэхэмжлэхийн дүн 0-ээс их байх ёстой',
        };
      }

      if (invoice.billType === 'B2B' && !invoice.customerTin) {
        return {
          success: false,
          errorCode: 'MISSING_TIN',
          errorMessage: 'Байгууллагын ТТД оруулна уу',
        };
      }

      // Validate VAT calculation (10%)
      const expectedVat = Math.round(invoice.amount * 10 / 110);
      if (Math.abs(invoice.vat - expectedVat) > 1) {
        console.warn(`VAT mismatch: expected ${expectedVat}, got ${invoice.vat}`);
      }

      // In production, this would call ТЕГ's API
      // POST https://ebarimt.mn/api/v1/bill
      // Headers: Authorization: Bearer {API_KEY}
      // Body: { posNo, merchantId, branchNo, ...invoice }

      // Simulated response for development
      const billId = this.generateBillId();
      const lottery = this.generateLotteryNumber();
      const qrData = this.generateQRData(billId, lottery, invoice.amount);

      // Log for debugging
      console.log(`[e-Barimt] Registered invoice: ${invoice.invoiceNo} -> ${billId}`);

      return {
        success: true,
        billId,
        lottery,
        qrData,
        date: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('[e-Barimt] Error:', error);
      return {
        success: false,
        errorCode: 'API_ERROR',
        errorMessage: error.message || 'e-Barimt системд алдаа гарлаа',
      };
    }
  }

  /**
   * Cancel/Return a previously registered invoice
   * 
   * @param billId - Original bill ID from e-Barimt
   * @param returnAmount - Amount to return
   * @returns e-Barimt response
   */
  async cancelInvoice(billId: string, returnAmount: number): Promise<EBarimtResponse> {
    try {
      // In production, call ТЕГ's return API
      // POST https://ebarimt.mn/api/v1/bill/return
      
      console.log(`[e-Barimt] Cancelled invoice: ${billId}, amount: ${returnAmount}`);

      return {
        success: true,
        billId: `RET-${billId}`,
        date: new Date().toISOString(),
      };
    } catch (error: any) {
      console.error('[e-Barimt] Cancel error:', error);
      return {
        success: false,
        errorCode: 'CANCEL_ERROR',
        errorMessage: error.message || 'Баримт цуцлахад алдаа гарлаа',
      };
    }
  }

  /**
   * Check lottery result
   * 
   * @param lottery - Lottery number from bill
   * @returns Lottery check result
   */
  async checkLottery(lottery: string): Promise<LotteryCheckResponse> {
    try {
      // In production, call ТЕГ's lottery check API
      // GET https://ebarimt.mn/api/v1/lottery/check/{lottery}

      // Simulated response
      return {
        success: true,
        winner: false,
        message: 'Сугалаа шалгах боломжтой',
      };
    } catch (error: any) {
      return {
        success: false,
        winner: false,
        message: error.message,
      };
    }
  }

  /**
   * Get organization info by TIN (ТТД)
   * 
   * @param tin - Tax Identification Number (ТТД)
   * @returns Organization info
   */
  async getOrganizationByTin(tin: string): Promise<{
    success: boolean;
    name?: string;
    tin?: string;
    vatPayer?: boolean;
    errorMessage?: string;
  }> {
    try {
      // In production, call ТЕГ's organization lookup API
      // GET https://ebarimt.mn/api/v1/organization/{tin}

      // Simulated response
      if (tin.length >= 7) {
        return {
          success: true,
          name: `Байгууллага ${tin}`,
          tin,
          vatPayer: true,
        };
      }

      return {
        success: false,
        errorMessage: 'ТТД олдсонгүй',
      };
    } catch (error: any) {
      return {
        success: false,
        errorMessage: error.message,
      };
    }
  }
}

/**
 * Default e-Barimt service instance
 * Configure with environment variables in production
 */
export function createEBarimtService(): EBarimtService {
  const config: EBarimtConfig = {
    posNo: process.env.EBARIMT_POS_NO || 'TEST-POS-001',
    merchantId: process.env.EBARIMT_MERCHANT_ID || 'TEST-MERCHANT',
    branchNo: process.env.EBARIMT_BRANCH_NO || '001',
    apiUrl: process.env.EBARIMT_API_URL || 'https://test-ebarimt.mn/api/v1',
    apiKey: process.env.EBARIMT_API_KEY || 'test-api-key',
  };

  return new EBarimtService(config);
}

// Export singleton for convenience
export const ebarimt = createEBarimtService();

/**
 * Helper function to convert invoice to e-Barimt format
 */
export function convertToEBarimtInvoice(invoice: any, lines: any[]): EBarimtInvoice {
  const totalAmount = parseFloat(invoice.totalAmount);
  const taxAmount = parseFloat(invoice.taxAmount);
  
  return {
    amount: totalAmount,
    vat: taxAmount,
    cityTax: 0, // Нийслэлийн татвар (тохиргоогоор)
    cashAmount: invoice.paymentMethod === 'cash' ? totalAmount : 0,
    nonCashAmount: invoice.paymentMethod !== 'cash' ? totalAmount : 0,
    billType: invoice.contact?.regNo ? 'B2B' : 'B2C',
    customerTin: invoice.contact?.regNo,
    customerName: invoice.contact?.companyName || `${invoice.contact?.firstName} ${invoice.contact?.lastName}`,
    invoiceNo: invoice.invoiceNumber,
    items: lines.map((line: any) => ({
      name: line.description || line.product?.name || 'Бараа',
      measureUnit: line.product?.unit || 'ш',
      qty: parseFloat(line.quantity),
      unitPrice: parseFloat(line.unitPrice) * (1 + parseFloat(line.taxRate || 10) / 100),
      totalAmount: parseFloat(line.total),
      barcode: line.product?.barcode,
      sku: line.product?.sku,
    })),
  };
}
