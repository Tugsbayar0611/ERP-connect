/**
 * Bank Statement Import Module
 * 
 * Монголын банкуудын хуулга импортлох модуль.
 * Excel/CSV форматаар импортлох боломжтой.
 * 
 * Дэмжигдэх банкууд:
 * - Хаан банк
 * - Голомт банк
 * - Худалдаа хөгжлийн банк
 * - Төрийн банк
 * - Хас банк
 * - гэх мэт...
 */

// Supported bank formats
export type BankCode = 
  | 'KHANBANK' 
  | 'GOLOMT' 
  | 'TDB' 
  | 'STATEBANK' 
  | 'XACBANK' 
  | 'BOGDBANK' 
  | 'CAPITRON'
  | 'GENERIC';

// Bank format configuration
export interface BankFormatConfig {
  code: BankCode;
  name: string;
  nameMn: string;
  dateFormat: string;           // Date format in import file
  dateColumn: number | string;  // Column index or name
  descriptionColumn: number | string;
  debitColumn: number | string;
  creditColumn: number | string;
  balanceColumn?: number | string;
  referenceColumn?: number | string;
  skipRows: number;             // Rows to skip (headers)
  encoding?: string;            // File encoding
}

// Bank format configurations for Mongolian banks
export const BANK_FORMATS: Record<BankCode, BankFormatConfig> = {
  KHANBANK: {
    code: 'KHANBANK',
    name: 'Khan Bank',
    nameMn: 'Хаан банк',
    dateFormat: 'YYYY-MM-DD',
    dateColumn: 0,
    descriptionColumn: 2,
    debitColumn: 3,
    creditColumn: 4,
    balanceColumn: 5,
    referenceColumn: 1,
    skipRows: 1,
    encoding: 'utf-8',
  },
  GOLOMT: {
    code: 'GOLOMT',
    name: 'Golomt Bank',
    nameMn: 'Голомт банк',
    dateFormat: 'DD.MM.YYYY',
    dateColumn: 'Огноо',
    descriptionColumn: 'Гүйлгээний утга',
    debitColumn: 'Зарлага',
    creditColumn: 'Орлого',
    balanceColumn: 'Үлдэгдэл',
    referenceColumn: 'Лавлах',
    skipRows: 2,
    encoding: 'utf-8',
  },
  TDB: {
    code: 'TDB',
    name: 'Trade and Development Bank',
    nameMn: 'Худалдаа хөгжлийн банк',
    dateFormat: 'YYYY/MM/DD',
    dateColumn: 0,
    descriptionColumn: 3,
    debitColumn: 4,
    creditColumn: 5,
    balanceColumn: 6,
    referenceColumn: 1,
    skipRows: 1,
    encoding: 'utf-8',
  },
  STATEBANK: {
    code: 'STATEBANK',
    name: 'State Bank',
    nameMn: 'Төрийн банк',
    dateFormat: 'DD/MM/YYYY',
    dateColumn: 0,
    descriptionColumn: 2,
    debitColumn: 3,
    creditColumn: 4,
    balanceColumn: 5,
    skipRows: 1,
    encoding: 'utf-8',
  },
  XACBANK: {
    code: 'XACBANK',
    name: 'XAC Bank',
    nameMn: 'Хас банк',
    dateFormat: 'YYYY-MM-DD',
    dateColumn: 'Date',
    descriptionColumn: 'Description',
    debitColumn: 'Debit',
    creditColumn: 'Credit',
    balanceColumn: 'Balance',
    skipRows: 1,
    encoding: 'utf-8',
  },
  BOGDBANK: {
    code: 'BOGDBANK',
    name: 'Bogd Bank',
    nameMn: 'Богд банк',
    dateFormat: 'DD.MM.YYYY',
    dateColumn: 0,
    descriptionColumn: 2,
    debitColumn: 3,
    creditColumn: 4,
    balanceColumn: 5,
    skipRows: 1,
    encoding: 'utf-8',
  },
  CAPITRON: {
    code: 'CAPITRON',
    name: 'Capitron Bank',
    nameMn: 'Капитрон банк',
    dateFormat: 'YYYY-MM-DD',
    dateColumn: 0,
    descriptionColumn: 2,
    debitColumn: 3,
    creditColumn: 4,
    balanceColumn: 5,
    skipRows: 1,
    encoding: 'utf-8',
  },
  GENERIC: {
    code: 'GENERIC',
    name: 'Generic Format',
    nameMn: 'Ерөнхий формат',
    dateFormat: 'YYYY-MM-DD',
    dateColumn: 0,
    descriptionColumn: 1,
    debitColumn: 2,
    creditColumn: 3,
    balanceColumn: 4,
    skipRows: 1,
    encoding: 'utf-8',
  },
};

// Parsed bank statement line
export interface ParsedBankStatementLine {
  date: string;              // YYYY-MM-DD format
  description: string;
  debit: number;             // Money out
  credit: number;            // Money in
  balance: number;
  reference?: string;
  rawData?: Record<string, any>;
}

// Import result
export interface BankImportResult {
  success: boolean;
  bankCode: BankCode;
  accountNumber?: string;
  statementDate: string;
  openingBalance: number;
  closingBalance: number;
  lines: ParsedBankStatementLine[];
  totalDebit: number;
  totalCredit: number;
  lineCount: number;
  errors: string[];
  warnings: string[];
}

/**
 * Parse date string to ISO format
 */
function parseDate(dateStr: string, format: string): string {
  if (!dateStr) return '';
  
  const cleaned = dateStr.trim();
  
  try {
    let year: string, month: string, day: string;
    
    switch (format) {
      case 'YYYY-MM-DD':
        [year, month, day] = cleaned.split('-');
        break;
      case 'DD.MM.YYYY':
        [day, month, year] = cleaned.split('.');
        break;
      case 'DD/MM/YYYY':
        [day, month, year] = cleaned.split('/');
        break;
      case 'YYYY/MM/DD':
        [year, month, day] = cleaned.split('/');
        break;
      default:
        // Try ISO format
        const date = new Date(cleaned);
        if (!isNaN(date.getTime())) {
          return date.toISOString().split('T')[0];
        }
        return '';
    }
    
    // Validate and format
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    const dayNum = parseInt(day);
    
    if (yearNum < 2000 || yearNum > 2100) return '';
    if (monthNum < 1 || monthNum > 12) return '';
    if (dayNum < 1 || dayNum > 31) return '';
    
    return `${yearNum}-${String(monthNum).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
  } catch {
    return '';
  }
}

/**
 * Parse amount string to number
 */
function parseAmount(amountStr: string | number | undefined): number {
  if (amountStr === undefined || amountStr === null || amountStr === '') {
    return 0;
  }
  
  if (typeof amountStr === 'number') {
    return amountStr;
  }
  
  // Remove currency symbols, spaces, and thousands separators
  const cleaned = amountStr
    .replace(/[₮$€¥]/g, '')
    .replace(/\s/g, '')
    .replace(/,/g, '')
    .replace(/'/g, '')
    .trim();
  
  const amount = parseFloat(cleaned);
  return isNaN(amount) ? 0 : Math.abs(amount);
}

/**
 * Get column value from row
 */
function getColumnValue(row: any[], headers: string[] | null, column: number | string): string {
  if (typeof column === 'number') {
    return String(row[column] ?? '');
  }
  
  // Column is a header name
  if (headers) {
    const index = headers.findIndex(h => 
      h.toLowerCase().includes(column.toLowerCase()) ||
      column.toLowerCase().includes(h.toLowerCase())
    );
    if (index !== -1) {
      return String(row[index] ?? '');
    }
  }
  
  return '';
}

/**
 * Parse bank statement from CSV/Excel data
 */
export function parseBankStatement(
  data: any[][], // 2D array of rows and columns
  bankCode: BankCode,
  customFormat?: Partial<BankFormatConfig>
): BankImportResult {
  const format = { ...BANK_FORMATS[bankCode], ...customFormat };
  const result: BankImportResult = {
    success: false,
    bankCode,
    statementDate: new Date().toISOString().split('T')[0],
    openingBalance: 0,
    closingBalance: 0,
    lines: [],
    totalDebit: 0,
    totalCredit: 0,
    lineCount: 0,
    errors: [],
    warnings: [],
  };
  
  try {
    if (!data || data.length === 0) {
      result.errors.push('Өгөгдөл хоосон байна');
      return result;
    }
    
    // Get headers if columns are named
    let headers: string[] | null = null;
    const dataStartRow = format.skipRows;
    
    if (typeof format.dateColumn === 'string') {
      // First row is headers
      headers = data[0]?.map(h => String(h || '')) || null;
    }
    
    // Parse lines
    for (let i = dataStartRow; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;
      
      // Skip empty rows
      if (row.every(cell => !cell || String(cell).trim() === '')) {
        continue;
      }
      
      const dateStr = getColumnValue(row, headers, format.dateColumn);
      const date = parseDate(dateStr, format.dateFormat);
      
      if (!date) {
        result.warnings.push(`Мөр ${i + 1}: Огноо танигдсангүй (${dateStr})`);
        continue;
      }
      
      const description = getColumnValue(row, headers, format.descriptionColumn);
      const debit = parseAmount(getColumnValue(row, headers, format.debitColumn));
      const credit = parseAmount(getColumnValue(row, headers, format.creditColumn));
      const balance = format.balanceColumn 
        ? parseAmount(getColumnValue(row, headers, format.balanceColumn))
        : 0;
      const reference = format.referenceColumn
        ? getColumnValue(row, headers, format.referenceColumn)
        : undefined;
      
      // Skip lines with no transactions
      if (debit === 0 && credit === 0) {
        continue;
      }
      
      const line: ParsedBankStatementLine = {
        date,
        description: description.trim(),
        debit,
        credit,
        balance,
        reference: reference?.trim(),
        rawData: Object.fromEntries(row.map((cell, idx) => [headers?.[idx] || idx, cell])),
      };
      
      result.lines.push(line);
      result.totalDebit += debit;
      result.totalCredit += credit;
    }
    
    result.lineCount = result.lines.length;
    
    if (result.lines.length > 0) {
      // Sort by date
      result.lines.sort((a, b) => a.date.localeCompare(b.date));
      
      // Get opening and closing balance
      const firstLine = result.lines[0];
      const lastLine = result.lines[result.lines.length - 1];
      
      result.openingBalance = firstLine.balance - firstLine.credit + firstLine.debit;
      result.closingBalance = lastLine.balance;
      result.statementDate = lastLine.date;
      result.success = true;
    } else {
      result.errors.push('Гүйлгээ олдсонгүй');
    }
    
  } catch (error: any) {
    result.errors.push(`Алдаа: ${error.message}`);
  }
  
  return result;
}

/**
 * Auto-detect bank format from data
 */
export function detectBankFormat(data: any[][]): BankCode {
  if (!data || data.length === 0) {
    return 'GENERIC';
  }
  
  const headers = data[0]?.map(h => String(h || '').toLowerCase()) || [];
  const sampleText = headers.join(' ') + ' ' + data.slice(0, 5).flat().join(' ').toLowerCase();
  
  // Check for bank-specific keywords
  if (sampleText.includes('хаан банк') || sampleText.includes('khan bank')) {
    return 'KHANBANK';
  }
  if (sampleText.includes('голомт') || sampleText.includes('golomt')) {
    return 'GOLOMT';
  }
  if (sampleText.includes('худалдаа хөгжлийн') || sampleText.includes('tdb')) {
    return 'TDB';
  }
  if (sampleText.includes('төрийн банк') || sampleText.includes('state bank')) {
    return 'STATEBANK';
  }
  if (sampleText.includes('хас банк') || sampleText.includes('xac bank')) {
    return 'XACBANK';
  }
  
  // Check header patterns
  if (headers.includes('гүйлгээний утга') || headers.includes('transaction')) {
    return 'GOLOMT';
  }
  
  return 'GENERIC';
}

/**
 * Match bank statement lines with existing invoices/payments
 * For auto-reconciliation
 */
export interface ReconciliationSuggestion {
  statementLineIndex: number;
  matchType: 'invoice' | 'payment' | 'unknown';
  matchId?: string;
  matchReference?: string;
  matchAmount?: number;
  confidence: number; // 0-100
  reason: string;
}

export function suggestReconciliations(
  lines: ParsedBankStatementLine[],
  invoices: Array<{ id: string; invoiceNumber: string; totalAmount: string; contactName: string }>,
  payments: Array<{ id: string; paymentNumber: string; amount: string; reference?: string }>
): ReconciliationSuggestion[] {
  const suggestions: ReconciliationSuggestion[] = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const amount = line.credit || line.debit;
    const desc = line.description.toLowerCase();
    const ref = line.reference?.toLowerCase() || '';
    
    let bestMatch: ReconciliationSuggestion = {
      statementLineIndex: i,
      matchType: 'unknown',
      confidence: 0,
      reason: 'Тааруулах зүйл олдсонгүй',
    };
    
    // Check invoices
    for (const inv of invoices) {
      const invAmount = parseFloat(inv.totalAmount);
      const invNum = inv.invoiceNumber.toLowerCase();
      
      // Exact amount match
      if (Math.abs(amount - invAmount) < 1) {
        const confidence = desc.includes(invNum) || ref.includes(invNum) ? 90 : 70;
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            statementLineIndex: i,
            matchType: 'invoice',
            matchId: inv.id,
            matchReference: inv.invoiceNumber,
            matchAmount: invAmount,
            confidence,
            reason: `Нэхэмжлэх ${inv.invoiceNumber} дүнтэй таарч байна`,
          };
        }
      }
      
      // Reference match
      if (desc.includes(invNum) || ref.includes(invNum)) {
        const confidence = 85;
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            statementLineIndex: i,
            matchType: 'invoice',
            matchId: inv.id,
            matchReference: inv.invoiceNumber,
            matchAmount: invAmount,
            confidence,
            reason: `Нэхэмжлэхийн дугаар олдлоо: ${inv.invoiceNumber}`,
          };
        }
      }
    }
    
    // Check payments
    for (const pay of payments) {
      const payAmount = parseFloat(pay.amount);
      const payNum = pay.paymentNumber.toLowerCase();
      const payRef = pay.reference?.toLowerCase() || '';
      
      if (Math.abs(amount - payAmount) < 1) {
        const confidence = desc.includes(payNum) || ref.includes(payRef) ? 90 : 70;
        if (confidence > bestMatch.confidence) {
          bestMatch = {
            statementLineIndex: i,
            matchType: 'payment',
            matchId: pay.id,
            matchReference: pay.paymentNumber,
            matchAmount: payAmount,
            confidence,
            reason: `Төлбөр ${pay.paymentNumber} дүнтэй таарч байна`,
          };
        }
      }
    }
    
    suggestions.push(bestMatch);
  }
  
  return suggestions;
}

/**
 * CSV Parser helper
 */
export function parseCSV(text: string): any[][] {
  const lines = text.split(/\r?\n/);
  const result: any[][] = [];
  
  for (const line of lines) {
    if (!line.trim()) continue;
    
    const cells: string[] = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((char === ',' || char === ';' || char === '\t') && !inQuotes) {
        cells.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    cells.push(current.trim());
    result.push(cells);
  }
  
  return result;
}
