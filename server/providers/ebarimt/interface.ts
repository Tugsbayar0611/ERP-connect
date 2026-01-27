/**
 * E-barimt Provider Interface
 * Монголын татварын албаны И-баримт системтэй интеграци хийх interface
 */

export interface EBarimtConfig {
  enabled: boolean;
  mode: "sandbox" | "production";
  posEndpoint: string; // POS API endpoint URL
  apiKey: string; // API authentication key
  apiSecret?: string; // API secret (optional, depends on API)
  autoSend?: boolean; // Automatically send invoice when paid
}

export interface EBarimtInvoiceData {
  // Document Info
  documentType: "Invoice-Company" | "Invoice-Individual" | "Receipt-Company" | "Receipt-Individual";
  issueDate: string; // YYYY-MM-DD
  issueTime: string; // HH:mm:ss
  documentNumber: string; // Invoice number
  
  // Seller (Issuer) - Tenant info
  seller: {
    tin: string; // Tax Identification Number (ХХОАТ-ын дугаар)
    name: string; // Company legal name
    address?: string;
    district?: string;
    city?: string;
    bankAccount?: string;
    bankName?: string;
  };
  
  // Buyer (Customer) - Contact info
  buyer: {
    tin?: string; // For companies
    name: string;
    address?: string;
    district?: string;
    city?: string;
    regNo?: string; // Registration number (РД)
  };
  
  // Line Items
  items: Array<{
    productCode?: string;
    productName: string;
    productSpecCode?: string; // Product Specification Code
    unit: string; // Unit of measure
    quantity: number;
    unitPrice: number;
    discount?: number;
    taxRate: number;
    taxAmount: number;
    subtotal: number;
    total: number;
  }>;
  
  // Totals
  totals: {
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    discount?: number;
  };
  
  // Payment Info
  payment: {
    method: "cash" | "bank_transfer" | "card" | "qr_code" | "other";
    amount: number;
    change?: number;
  };
  
  // Location Info (optional)
  location?: {
    aimag?: string;
    district?: string;
    soum?: string;
    posNumber?: string;
  };
}

export interface EBarimtResponse {
  success: boolean;
  documentId?: string; // E-barimt system document ID
  qrCode?: string; // QR code for verification
  receiptNumber?: string; // Receipt number from e-barimt
  lotteryNumber?: string; // Сугалааны дугаар (8 орон)
  error?: string;
  errorCode?: string;
  rawResponse?: any; // Raw API response for debugging
}

/**
 * E-barimt Provider Interface
 * Provider implementations must implement this interface
 */
export interface IEBarimtProvider {
  /**
   * Initialize provider with configuration
   */
  initialize(config: EBarimtConfig): void;

  /**
   * Send invoice to E-barimt system
   * @param invoiceData - Invoice data in E-barimt format
   * @returns E-barimt response with document ID and QR code
   */
  sendInvoice(invoiceData: EBarimtInvoiceData): Promise<EBarimtResponse>;

  /**
   * Verify invoice status in E-barimt system
   * @param documentId - E-barimt document ID
   * @returns Verification response
   */
  verifyInvoice(documentId: string): Promise<EBarimtResponse>;

  /**
   * Cancel/void invoice in E-barimt system
   * @param documentId - E-barimt document ID
   * @param reason - Cancellation reason
   * @returns Cancellation response
   */
  cancelInvoice(documentId: string, reason?: string): Promise<EBarimtResponse>;

  /**
   * Check if provider is configured and ready
   */
  isConfigured(): boolean;
}
