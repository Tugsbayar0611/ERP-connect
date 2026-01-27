import jsPDF from "jspdf";
import { format } from "date-fns";
import { amountInWordsMNT } from "@shared/mongolian-number-words";

export interface InvoicePDFData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  type: "sales" | "purchase";
  status: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyRegNo?: string;
  companyVatNo?: string;
  contactName?: string;
  contactAddress?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactRegNo?: string;
  contactVatNo?: string;
  lines: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    subtotal: number;
    taxAmount: number;
    total: number;
  }>;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  notes?: string;
  ebarimtQrCode?: string;
  ebarimtReceiptNumber?: string;
  ebarimtDocumentId?: string;
  warehouseName?: string;
  branchName?: string;
  title?: string;
}

export interface PadanPDFData {
  padanNumber: string;
  padanDate: string;
  invoiceNumber: string;
  invoiceDate: string;
  companyName?: string;
  companyAddress?: string;
  companyPhone?: string;
  companyEmail?: string;
  companyRegNo?: string;
  companyVatNo?: string;
  contactName?: string;
  contactAddress?: string;
  contactPhone?: string;
  contactEmail?: string;
  contactRegNo?: string;
  contactVatNo?: string;
  contactVat?: string;
  lines: Array<{
    description: string;
    quantity: number;
    unit: string;
    unitPrice: number;
    total: number;
  }>;
  totalAmount: number;
  warehouseName?: string;
  branchName?: string;
  notes?: string;
}

function formatMNT(value: number | string, withoutSymbol = false): string {
  const num = typeof value === "string" ? parseFloat(value) : value;
  const formatted = new Intl.NumberFormat('mn-MN', {
    style: 'decimal',
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(num);
  return withoutSymbol ? formatted : `${formatted}₮`;
}

// 1. FONT LOADING FUNCTION
async function loadFonts(doc: jsPDF): Promise<boolean> {
  try {
    // Attempting to load Roboto-Regular.ttf
    // User can replace this file with NotoSans if preferred and update name here
    const fontPath = '/fonts/Roboto-Regular.ttf';

    const response = await fetch(fontPath);
    if (!response.ok) throw new Error("Font file not found");

    const blob = await response.blob();
    // Validate blob size (Roboto Regular is ~168KB, so < 50KB is definitely wrong)
    if (blob.size < 50000) throw new Error(`Font file too small (${blob.size} bytes)`);

    const reader = new FileReader();

    return new Promise<boolean>((resolve) => {
      reader.onloadend = () => {
        const base64data = reader.result as string;
        if (!base64data || !base64data.includes(',')) {
          console.error("Font read failed: invalid base64 result");
          resolve(false);
          return;
        }
        const base64Content = base64data.split(',')[1];

        try {
          // Identity-H is CRITICAL for Cyrillic support
          doc.addFileToVFS("CustomFont.ttf", base64Content);
          doc.addFont("CustomFont.ttf", "CustomFont", "normal", "Identity-H");
          resolve(true);
        } catch (e) {
          console.error("Font register error:", e);
          resolve(false);
        }
      };
      reader.onerror = () => {
        console.error("FileReader error");
        resolve(false);
      };
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("Font load failed:", e);
    return false;
  }
}

export async function generateInvoicePDF(data: InvoicePDFData): Promise<string> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true, // Compress output to reduce size
  });

  // Load fonts
  const isFontLoaded = await loadFonts(doc);
  const fontName = isFontLoaded ? "CustomFont" : "helvetica";

  // 2. TEXT RENDER WRAPPER (Prevents 'widths' error)
  const renderText = (text: string, x: number, y: number, fontSize: number, options: { isBold?: boolean, align?: "left" | "right" | "center", maxWidth?: number, baseline?: "top" | "alphabetic" } = {}): number => {
    doc.setFontSize(fontSize);

    if (isFontLoaded) {
      doc.setFont("CustomFont", "normal");
    } else {
      doc.setFont("helvetica", options.isBold ? "bold" : "normal");
    }

    const align = options.align || "left";
    const baseline = options.baseline || "top";

    try {
      if (options.maxWidth) {
        // splitTextToSize causes the 'widths' error if font maps are bad
        const lines = doc.splitTextToSize(text, options.maxWidth);
        doc.text(lines, x, y, { align, baseline });
        return (lines.length * fontSize * 0.3527) + 1; // approx height
      } else {
        doc.text(text, x, y, { align, baseline });
        return (fontSize * 0.3527) + 1;
      }
    } catch (e) {
      console.error("Render text error (likely encoding):", text);
      // Fallback to standard font to prevent crash
      doc.setFont("helvetica");
      try {
        doc.text(text, x, y, { align, baseline });
      } catch (e2) {
        doc.text("ERR", x, y); // Ultimate fallback
      }
      return (fontSize * 0.3527) + 1;
    }
  };

  // --- PDF STRUCTURE ---
  const margin = 15;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;

  let yPos = margin;

  // HEADER
  let headerHeight = 0;
  headerHeight += renderText(data.companyName || "Байгууллага", margin, yPos, 14, { isBold: true }) + 2;

  if (data.companyAddress) headerHeight += renderText(data.companyAddress, margin, yPos + headerHeight, 9) + 1;
  const contactInfo = [data.companyPhone, data.companyEmail].filter(Boolean).join(" | ");
  if (contactInfo) headerHeight += renderText(contactInfo, margin, yPos + headerHeight, 9) + 1;
  if (data.companyRegNo) headerHeight += renderText(`РД: ${data.companyRegNo}`, margin, yPos + headerHeight, 9) + 1;

  // Invoice Details (Right)
  const infoX = pageWidth - margin;
  let infoY = yPos;
  renderText("Нэхэмжлэх №:", infoX - 45, infoY, 9);
  renderText(data.invoiceNumber, infoX, infoY, 9, { align: "right", isBold: true });
  infoY += 5;
  renderText("Огноо:", infoX - 45, infoY, 9);
  renderText(format(new Date(data.invoiceDate), "yyyy-MM-dd"), infoX, infoY, 9, { align: "right" });
  infoY += 5;
  renderText("Төлөх хугацаа:", infoX - 45, infoY, 9);
  renderText(format(new Date(data.dueDate), "yyyy-MM-dd"), infoX, infoY, 9, { align: "right" });

  yPos = Math.max(yPos + headerHeight + 5, infoY + 10);

  // Title
  const title = data.title || (data.type === "sales" ? "НЭХЭМЖЛЭХ (БОРЛУУЛАЛТ)" : "НЭХЭМЖЛЭХ (ХУДАЛДАН АВАЛТ)");
  renderText(title, pageWidth / 2, yPos, 14, { align: "center", isBold: true });
  yPos += 10;

  // Client
  renderText(data.type === "sales" ? "Харилцагч:" : "Нийлүүлэгч:", margin, yPos, 10, { isBold: true });
  yPos += 5;
  if (data.contactName) yPos += renderText(data.contactName, margin + 5, yPos, 9) + 1;
  if (data.contactRegNo) yPos += renderText(`РД: ${data.contactRegNo}`, margin + 5, yPos, 9) + 1;
  yPos += 5;

  // TABLE HEADER
  const colWidths = { no: 10, desc: 60, qty: 18, price: 24, tax: 12, sub: 24, total: 24 };
  let cX = margin;

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 1, contentWidth, 7, 'F');

  renderText("№", cX, yPos, 8, { isBold: true }); cX += colWidths.no;
  renderText("Тайлбар", cX, yPos, 8, { isBold: true }); cX += colWidths.desc;
  renderText("Тоо", cX + colWidths.qty, yPos, 8, { isBold: true, align: "right" }); cX += colWidths.qty;
  renderText("Үнэ", cX + colWidths.price, yPos, 8, { isBold: true, align: "right" }); cX += colWidths.price;
  renderText("Татвар", cX + colWidths.tax, yPos, 8, { isBold: true, align: "right" }); cX += colWidths.tax;
  renderText("Дэд дүн", cX + colWidths.sub, yPos, 8, { isBold: true, align: "right" }); cX += colWidths.sub;
  renderText("Нийт", cX + colWidths.total, yPos, 8, { isBold: true, align: "right" });

  yPos += 8;

  // TABLE ROWS
  data.lines.forEach((line, idx) => {
    if (yPos > pageHeight - 40) { doc.addPage(); yPos = margin; }

    const rowY = yPos;
    let maxH = 5;

    // Description wrap
    const descH = renderText(line.description, margin + colWidths.no, rowY, 8, { maxWidth: colWidths.desc - 2 });
    maxH = Math.max(maxH, descH + 2);

    let rcX = margin;
    renderText((idx + 1).toString(), rcX, rowY, 8); rcX += colWidths.no + colWidths.desc;
    renderText(line.quantity.toString(), rcX + colWidths.qty, rowY, 8, { align: "right" }); rcX += colWidths.qty;
    renderText(formatMNT(line.unitPrice, true), rcX + colWidths.price, rowY, 8, { align: "right" }); rcX += colWidths.price;
    renderText(`${line.taxRate}%`, rcX + colWidths.tax, rowY, 8, { align: "right" }); rcX += colWidths.tax;
    renderText(formatMNT(line.subtotal, true), rcX + colWidths.sub, rowY, 8, { align: "right" }); rcX += colWidths.sub;
    renderText(formatMNT(line.total, true), rcX + colWidths.total, rowY, 8, { align: "right" });

    doc.setDrawColor(230);
    doc.line(margin, rowY + maxH - 1, pageWidth - margin, rowY + maxH - 1);
    yPos += maxH;
  });

  yPos += 5;

  // TOTALS
  const tX = pageWidth - margin;
  renderText("Дэд дүн:", tX - 40, yPos, 9);
  renderText(formatMNT(data.subtotal, true), tX, yPos, 9, { align: "right" }); yPos += 5;
  renderText("Татвар:", tX - 40, yPos, 9);
  renderText(formatMNT(data.taxAmount, true), tX, yPos, 9, { align: "right" }); yPos += 5;
  renderText("НИЙТ ДҮН:", tX - 40, yPos, 10, { isBold: true });
  renderText(formatMNT(data.totalAmount, true), tX, yPos, 10, { align: "right", isBold: true }); yPos += 8;

  if (data.paidAmount > 0) {
    renderText("Төлсөн:", tX - 40, yPos, 9);
    renderText(formatMNT(data.paidAmount, true), tX, yPos, 9, { align: "right" }); yPos += 5;
    renderText("Үлдэгдэл:", tX - 40, yPos, 9);
    renderText(formatMNT(data.remainingAmount, true), tX, yPos, 9, { align: "right" }); yPos += 8;
  }

  // Amount in words
  renderText("Үсгээр:", margin, yPos, 9, { isBold: true });
  renderText(amountInWordsMNT(data.totalAmount), margin + 18, yPos, 9);
  yPos += 10;

  // Notes
  if (data.notes) {
    if (yPos > pageHeight - 30) { doc.addPage(); yPos = margin; }
    renderText("Тэмдэглэл:", margin, yPos, 9, { isBold: true }); yPos += 5;
    yPos += renderText(data.notes, margin, yPos, 8, { maxWidth: contentWidth }) + 5;
  }

  // Footer
  if (isFontLoaded === false) {
    doc.setTextColor(255, 0, 0);
    doc.setFontSize(8);
    doc.text("Warning: Custom font not loaded. Text may be garbled.", margin, pageHeight - 10);
  }

  // Generate output safely using ArrayBuffer to avoid stack overflow or string limits
  try {
    const arrayBuffer = doc.output('arraybuffer');
    const bytes = new Uint8Array(arrayBuffer);

    // Efficient buffer to base64 conversion for large files
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const base64 = typeof window !== 'undefined' ? window.btoa(binary) : Buffer.from(binary, 'binary').toString('base64');

    return `data:application/pdf;base64,${base64}`;
  } catch (err) {
    console.error("PDF Generation failed:", err);
    // Fallback to simpler method if buffer conversion fails
    return doc.output('datauristring');
  }
}

export async function generateDispatchPadanPDF(data: PadanPDFData): Promise<string> {
  // Proxy to generateInvoicePDF with data mapping
  // This simplifies the implementation as requested, but we can extend distinct layout later
  const invoiceData: InvoicePDFData = {
    ...data as any,
    title: "ЗАРЛАГЫН ПАДАН",
    type: "sales", // Default to sales
    invoiceNumber: data.padanNumber,
    invoiceDate: data.padanDate,
    status: "posted",
    subtotal: data.totalAmount, // Fallback if subtotal missing
    taxAmount: 0, // Fallback
    totalAmount: data.totalAmount,
    paidAmount: 0,
    remainingAmount: 0
  };
  return generateInvoicePDF(invoiceData);
}

export async function generateReceiptPadanPDF(data: PadanPDFData): Promise<string> {
  const invoiceData: InvoicePDFData = {
    ...data as any,
    title: "ОРЛОГЫН ПАДАН",
    type: "purchase",
    invoiceNumber: data.padanNumber,
    invoiceDate: data.padanDate,
    status: "posted",
    subtotal: data.totalAmount,
    taxAmount: 0,
    totalAmount: data.totalAmount,
    paidAmount: 0,
    remainingAmount: 0
  };
  return generateInvoicePDF(invoiceData);
}
