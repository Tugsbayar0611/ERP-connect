/**
 * Import utilities for bank statements (Excel/CSV)
 * Supports Mongolian banks: Khan Bank, Golomt Bank, TDB Bank
 */

import * as XLSX from "xlsx";

export interface BankStatementLineData {
  date: string; // YYYY-MM-DD
  description?: string;
  debit?: number;
  credit?: number;
  balance: number;
  reference?: string;
}

export interface ParsedBankStatement {
  statementDate: string;
  openingBalance: number;
  closingBalance: number;
  lines: BankStatementLineData[];
}

/**
 * Parse Excel file for bank statement
 * Expected format:
 * - First row: Headers (Date, Description, Debit, Credit, Balance, Reference)
 * - Data rows: Transaction data
 */
export function parseBankStatementExcel(buffer: Buffer): ParsedBankStatement {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  // Convert to JSON array
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

  if (data.length < 2) {
    throw new Error("Excel файл хоосон эсвэл буруу форматтай байна");
  }

  // Find header row (usually first row)
  const headerRow = data[0];
  const headerMap: Record<string, number> = {};
  
  headerRow.forEach((header, index) => {
    if (header) {
      const headerStr = String(header).toLowerCase().trim();
      // Support multiple language headers
      if (headerStr.includes("date") || headerStr.includes("огноо") || headerStr.includes("дата")) {
        headerMap.date = index;
      } else if (headerStr.includes("description") || headerStr.includes("тайлбар") || headerStr.includes("описание")) {
        headerMap.description = index;
      } else if (headerStr.includes("debit") || headerStr.includes("дебет") || headerStr.includes("орлого")) {
        headerMap.debit = index;
      } else if (headerStr.includes("credit") || headerStr.includes("кредит") || headerStr.includes("зарлага")) {
        headerMap.credit = index;
      } else if (headerStr.includes("balance") || headerStr.includes("үлдэгдэл") || headerStr.includes("остаток")) {
        headerMap.balance = index;
      } else if (headerStr.includes("reference") || headerStr.includes("дугаар") || headerStr.includes("номер")) {
        headerMap.reference = index;
      }
    }
  });

  if (!headerMap.date || !headerMap.balance) {
    throw new Error("Excel файлд 'Огноо' болон 'Үлдэгдэл' багана заавал байх ёстой");
  }

  // Parse data rows
  const lines: BankStatementLineData[] = [];
  let openingBalance: number | null = null;
  let closingBalance: number | null = null;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    // Parse date
    let dateStr: string | null = null;
    const dateValue = row[headerMap.date];
    if (dateValue) {
      if (dateValue instanceof Date) {
        dateStr = dateValue.toISOString().split("T")[0];
      } else if (typeof dateValue === "number") {
        // Excel date serial number
        const excelDate = XLSX.SSF.parse_date_code(dateValue);
        if (excelDate) {
          dateStr = `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
        }
      } else {
        dateStr = String(dateValue).trim();
        // Try to parse common date formats
        const dateMatch = dateStr.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
        if (dateMatch) {
          dateStr = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
        }
      }
    }

    if (!dateStr) continue;

    // Parse amounts
    const parseAmount = (val: any): number => {
      if (val === null || val === undefined || val === "") return 0;
      if (typeof val === "number") return val;
      const str = String(val).replace(/[,\s]/g, "");
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    };

    const debit = headerMap.debit !== undefined ? parseAmount(row[headerMap.debit]) : 0;
    const credit = headerMap.credit !== undefined ? parseAmount(row[headerMap.credit]) : 0;
    const balance = parseAmount(row[headerMap.balance]);
    const description = headerMap.description !== undefined ? String(row[headerMap.description] || "").trim() : undefined;
    const reference = headerMap.reference !== undefined ? String(row[headerMap.reference] || "").trim() : undefined;

    // Set opening balance from first row
    if (openingBalance === null) {
      openingBalance = balance - credit + debit; // Calculate opening balance
    }

    lines.push({
      date: dateStr,
      description,
      debit: debit > 0 ? debit : undefined,
      credit: credit > 0 ? credit : undefined,
      balance,
      reference,
    });

    // Update closing balance
    closingBalance = balance;
  }

  if (openingBalance === null || closingBalance === null) {
    throw new Error("Банкны тайлбар хоосон байна");
  }

  // Use the last date as statement date, or today if not available
  const statementDate = lines.length > 0 ? lines[lines.length - 1].date : new Date().toISOString().split("T")[0];

  return {
    statementDate,
    openingBalance,
    closingBalance,
    lines,
  };
}

/**
 * Parse CSV file for bank statement
 */
export function parseBankStatementCSV(csvText: string): ParsedBankStatement {
  const lines = csvText.split("\n").filter((line) => line.trim());
  if (lines.length < 2) {
    throw new Error("CSV файл хоосон эсвэл буруу форматтай байна");
  }

  // Parse header
  const headerRow = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const headerMap: Record<string, number> = {};

  headerRow.forEach((header, index) => {
    if (header.includes("date") || header.includes("огноо")) headerMap.date = index;
    if (header.includes("description") || header.includes("тайлбар")) headerMap.description = index;
    if (header.includes("debit") || header.includes("дебет")) headerMap.debit = index;
    if (header.includes("credit") || header.includes("кредит")) headerMap.credit = index;
    if (header.includes("balance") || header.includes("үлдэгдэл")) headerMap.balance = index;
    if (header.includes("reference") || header.includes("дугаар")) headerMap.reference = index;
  });

  if (!headerMap.date || !headerMap.balance) {
    throw new Error("CSV файлд 'Огноо' болон 'Үлдэгдэл' багана заавал байх ёстой");
  }

  // Parse data rows
  const parsedLines: BankStatementLineData[] = [];
  let openingBalance: number | null = null;
  let closingBalance: number | null = null;

  for (let i = 1; i < lines.length; i++) {
    const row = lines[i].split(",").map((cell) => cell.trim());
    if (row.length === 0) continue;

    const dateStr = row[headerMap.date];
    if (!dateStr) continue;

    const parseAmount = (val: string): number => {
      const num = parseFloat(val.replace(/[,\s]/g, ""));
      return isNaN(num) ? 0 : num;
    };

    const debit = headerMap.debit !== undefined ? parseAmount(row[headerMap.debit]) : 0;
    const credit = headerMap.credit !== undefined ? parseAmount(row[headerMap.credit]) : 0;
    const balance = parseAmount(row[headerMap.balance]);
    const description = headerMap.description !== undefined ? row[headerMap.description] : undefined;
    const reference = headerMap.reference !== undefined ? row[headerMap.reference] : undefined;

    if (openingBalance === null) {
      openingBalance = balance - credit + debit;
    }

    parsedLines.push({
      date: dateStr,
      description,
      debit: debit > 0 ? debit : undefined,
      credit: credit > 0 ? credit : undefined,
      balance,
      reference,
    });

    closingBalance = balance;
  }

  if (openingBalance === null || closingBalance === null) {
    throw new Error("Банкны тайлбар хоосон байна");
  }

  const statementDate = parsedLines.length > 0 ? parsedLines[parsedLines.length - 1].date : new Date().toISOString().split("T")[0];

  return {
    statementDate,
    openingBalance,
    closingBalance,
    lines: parsedLines,
  };
}

/**
 * Detect bank format from Excel file
 * Returns: 'khan' | 'golomt' | 'tdb' | 'generic'
 */
export function detectBankFormat(buffer: Buffer): string {
  try {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

    if (data.length < 2) {
      return "generic";
    }

    // Check for bank-specific patterns
    const firstFewRows = data.slice(0, 5).flat().join(" ").toLowerCase();

    // Khan Bank patterns
    if (
      firstFewRows.includes("хаан банк") ||
      firstFewRows.includes("khan bank") ||
      firstFewRows.includes("хаан") ||
      (firstFewRows.includes("огноо") && firstFewRows.includes("тайлбар") && firstFewRows.includes("дүн"))
    ) {
      return "khan";
    }

    // Golomt Bank patterns
    if (
      firstFewRows.includes("голомт банк") ||
      firstFewRows.includes("golomt bank") ||
      firstFewRows.includes("голомт")
    ) {
      return "golomt";
    }

    // TDB Bank patterns
    if (
      firstFewRows.includes("тдб банк") ||
      firstFewRows.includes("tdb bank") ||
      firstFewRows.includes("trade development bank")
    ) {
      return "tdb";
    }

    return "generic";
  } catch (error) {
    return "generic";
  }
}

/**
 * Parse Khan Bank Excel format
 * Typical format:
 * - Column A: Огноо (Date)
 * - Column B: Тайлбар (Description)
 * - Column C: Дүн (Amount) - positive for credit, negative for debit
 * - Column D: Үлдэгдэл (Balance)
 */
export function parseKhanBankExcel(buffer: Buffer): ParsedBankStatement {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

  if (data.length < 2) {
    throw new Error("Хаан банкны Excel файл хоосон эсвэл буруу форматтай байна");
  }

  // Find header row (usually contains "Огноо", "Тайлбар", "Дүн", "Үлдэгдэл")
  let headerRowIndex = -1;
  let dateCol = -1;
  let descCol = -1;
  let amountCol = -1;
  let balanceCol = -1;

  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    if (!row) continue;

    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || "").toLowerCase().trim();
      if (cell.includes("огноо") || cell.includes("date")) {
        dateCol = j;
        headerRowIndex = i;
      } else if (cell.includes("тайлбар") || cell.includes("description") || cell.includes("описание")) {
        descCol = j;
      } else if (cell.includes("дүн") || cell.includes("amount") || cell.includes("сумма")) {
        amountCol = j;
      } else if (cell.includes("үлдэгдэл") || cell.includes("balance") || cell.includes("остаток")) {
        balanceCol = j;
      }
    }

    if (dateCol >= 0 && balanceCol >= 0) {
      break;
    }
  }

  if (dateCol < 0 || balanceCol < 0) {
    throw new Error("Хаан банкны Excel файлд 'Огноо' болон 'Үлдэгдэл' багана олдсонгүй");
  }

  const lines: BankStatementLineData[] = [];
  let openingBalance: number | null = null;
  let closingBalance: number | null = null;

  // Parse data rows (start after header row)
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    // Parse date
    const dateValue = row[dateCol];
    if (!dateValue) continue;

    let dateStr: string | null = null;
    if (dateValue instanceof Date) {
      dateStr = dateValue.toISOString().split("T")[0];
    } else if (typeof dateValue === "number") {
      const excelDate = XLSX.SSF.parse_date_code(dateValue);
      if (excelDate) {
        dateStr = `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
      }
    } else {
      dateStr = String(dateValue).trim();
      const dateMatch = dateStr.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
      if (dateMatch) {
        dateStr = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
      }
    }

    if (!dateStr) continue;

    // Parse amount (Khan Bank: positive = credit, negative = debit)
    const parseAmount = (val: any): number => {
      if (val === null || val === undefined || val === "") return 0;
      if (typeof val === "number") return val;
      const str = String(val).replace(/[,\s₮]/g, "");
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    };

    const amount = amountCol >= 0 ? parseAmount(row[amountCol]) : 0;
    const balance = parseAmount(row[balanceCol]);
    const description = descCol >= 0 ? String(row[descCol] || "").trim() : undefined;

    // Determine debit/credit based on amount sign
    const debit = amount < 0 ? Math.abs(amount) : undefined;
    const credit = amount > 0 ? amount : undefined;

    // Set opening balance from first row
    if (openingBalance === null) {
      openingBalance = balance - (credit || 0) + (debit || 0);
    }

    lines.push({
      date: dateStr,
      description,
      debit,
      credit,
      balance,
    });

    closingBalance = balance;
  }

  if (openingBalance === null || closingBalance === null || lines.length === 0) {
    throw new Error("Хаан банкны тайлбар хоосон байна");
  }

  const statementDate = lines[lines.length - 1].date;

  return {
    statementDate,
    openingBalance,
    closingBalance,
    lines,
  };
}

/**
 * Parse Golomt Bank Excel format
 * Typical format:
 * - Column A: Огноо (Date)
 * - Column B: Тайлбар (Description)
 * - Column C: Орлого (Credit)
 * - Column D: Зарлага (Debit)
 * - Column E: Үлдэгдэл (Balance)
 */
export function parseGolomtBankExcel(buffer: Buffer): ParsedBankStatement {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

  if (data.length < 2) {
    throw new Error("Голомт банкны Excel файл хоосон эсвэл буруу форматтай байна");
  }

  // Find header row
  let headerRowIndex = -1;
  let dateCol = -1;
  let descCol = -1;
  let creditCol = -1;
  let debitCol = -1;
  let balanceCol = -1;

  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    if (!row) continue;

    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || "").toLowerCase().trim();
      if (cell.includes("огноо") || cell.includes("date")) {
        dateCol = j;
        headerRowIndex = i;
      } else if (cell.includes("тайлбар") || cell.includes("description")) {
        descCol = j;
      } else if (cell.includes("орлого") || cell.includes("credit") || cell.includes("доход")) {
        creditCol = j;
      } else if (cell.includes("зарлага") || cell.includes("debit") || cell.includes("расход")) {
        debitCol = j;
      } else if (cell.includes("үлдэгдэл") || cell.includes("balance")) {
        balanceCol = j;
      }
    }

    if (dateCol >= 0 && balanceCol >= 0) {
      break;
    }
  }

  if (dateCol < 0 || balanceCol < 0) {
    throw new Error("Голомт банкны Excel файлд 'Огноо' болон 'Үлдэгдэл' багана олдсонгүй");
  }

  const lines: BankStatementLineData[] = [];
  let openingBalance: number | null = null;
  let closingBalance: number | null = null;

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const dateValue = row[dateCol];
    if (!dateValue) continue;

    let dateStr: string | null = null;
    if (dateValue instanceof Date) {
      dateStr = dateValue.toISOString().split("T")[0];
    } else if (typeof dateValue === "number") {
      const excelDate = XLSX.SSF.parse_date_code(dateValue);
      if (excelDate) {
        dateStr = `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
      }
    } else {
      dateStr = String(dateValue).trim();
      const dateMatch = dateStr.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
      if (dateMatch) {
        dateStr = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
      }
    }

    if (!dateStr) continue;

    const parseAmount = (val: any): number => {
      if (val === null || val === undefined || val === "") return 0;
      if (typeof val === "number") return val;
      const str = String(val).replace(/[,\s₮]/g, "");
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    };

    const debit = debitCol >= 0 ? parseAmount(row[debitCol]) : 0;
    const credit = creditCol >= 0 ? parseAmount(row[creditCol]) : 0;
    const balance = parseAmount(row[balanceCol]);
    const description = descCol >= 0 ? String(row[descCol] || "").trim() : undefined;

    if (openingBalance === null) {
      openingBalance = balance - credit + debit;
    }

    lines.push({
      date: dateStr,
      description,
      debit: debit > 0 ? debit : undefined,
      credit: credit > 0 ? credit : undefined,
      balance,
    });

    closingBalance = balance;
  }

  if (openingBalance === null || closingBalance === null || lines.length === 0) {
    throw new Error("Голомт банкны тайлбар хоосон байна");
  }

  const statementDate = lines[lines.length - 1].date;

  return {
    statementDate,
    openingBalance,
    closingBalance,
    lines,
  };
}

/**
 * Parse TDB Bank Excel format
 * Typical format:
 * - Column A: Огноо (Date)
 * - Column B: Тайлбар (Description)
 * - Column C: Дүн (Amount) - can be positive or negative
 * - Column D: Үлдэгдэл (Balance)
 */
export function parseTDBBankExcel(buffer: Buffer): ParsedBankStatement {
  const workbook = XLSX.read(buffer, { type: "buffer" });
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: null }) as any[][];

  if (data.length < 2) {
    throw new Error("ТДБ банкны Excel файл хоосон эсвэл буруу форматтай байна");
  }

  // Find header row
  let headerRowIndex = -1;
  let dateCol = -1;
  let descCol = -1;
  let amountCol = -1;
  let balanceCol = -1;

  for (let i = 0; i < Math.min(5, data.length); i++) {
    const row = data[i];
    if (!row) continue;

    for (let j = 0; j < row.length; j++) {
      const cell = String(row[j] || "").toLowerCase().trim();
      if (cell.includes("огноо") || cell.includes("date")) {
        dateCol = j;
        headerRowIndex = i;
      } else if (cell.includes("тайлбар") || cell.includes("description")) {
        descCol = j;
      } else if (cell.includes("дүн") || cell.includes("amount") || cell.includes("сумма")) {
        amountCol = j;
      } else if (cell.includes("үлдэгдэл") || cell.includes("balance")) {
        balanceCol = j;
      }
    }

    if (dateCol >= 0 && balanceCol >= 0) {
      break;
    }
  }

  if (dateCol < 0 || balanceCol < 0) {
    throw new Error("ТДБ банкны Excel файлд 'Огноо' болон 'Үлдэгдэл' багана олдсонгүй");
  }

  const lines: BankStatementLineData[] = [];
  let openingBalance: number | null = null;
  let closingBalance: number | null = null;

  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length === 0) continue;

    const dateValue = row[dateCol];
    if (!dateValue) continue;

    let dateStr: string | null = null;
    if (dateValue instanceof Date) {
      dateStr = dateValue.toISOString().split("T")[0];
    } else if (typeof dateValue === "number") {
      const excelDate = XLSX.SSF.parse_date_code(dateValue);
      if (excelDate) {
        dateStr = `${excelDate.y}-${String(excelDate.m).padStart(2, "0")}-${String(excelDate.d).padStart(2, "0")}`;
      }
    } else {
      dateStr = String(dateValue).trim();
      const dateMatch = dateStr.match(/(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/);
      if (dateMatch) {
        dateStr = `${dateMatch[1]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[3].padStart(2, "0")}`;
      }
    }

    if (!dateStr) continue;

    const parseAmount = (val: any): number => {
      if (val === null || val === undefined || val === "") return 0;
      if (typeof val === "number") return val;
      const str = String(val).replace(/[,\s₮]/g, "");
      const num = parseFloat(str);
      return isNaN(num) ? 0 : num;
    };

    const amount = amountCol >= 0 ? parseAmount(row[amountCol]) : 0;
    const balance = parseAmount(row[balanceCol]);
    const description = descCol >= 0 ? String(row[descCol] || "").trim() : undefined;

    // TDB Bank: positive = credit, negative = debit (similar to Khan Bank)
    const debit = amount < 0 ? Math.abs(amount) : undefined;
    const credit = amount > 0 ? amount : undefined;

    if (openingBalance === null) {
      openingBalance = balance - (credit || 0) + (debit || 0);
    }

    lines.push({
      date: dateStr,
      description,
      debit,
      credit,
      balance,
    });

    closingBalance = balance;
  }

  if (openingBalance === null || closingBalance === null || lines.length === 0) {
    throw new Error("ТДБ банкны тайлбар хоосон байна");
  }

  const statementDate = lines[lines.length - 1].date;

  return {
    statementDate,
    openingBalance,
    closingBalance,
    lines,
  };
}
