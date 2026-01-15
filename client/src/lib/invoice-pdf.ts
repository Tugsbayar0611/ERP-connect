import jsPDF from "jspdf";

export type InvoicePDFLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
};

export type InvoicePDFData = {
  invoiceNumber: string;
  invoiceDate?: string | null;
  dueDate?: string | null;
  type?: string | null;
  status?: string | null;
  companyName: string;
  companyAddress?: string | null;
  companyPhone?: string | null;
  companyEmail?: string | null;
  companyRegNo?: string | null;
  companyVatNo?: string | null;
  contactName: string;
  contactAddress?: string | null;
  contactPhone?: string | null;
  contactEmail?: string | null;
  contactRegNo?: string | null;
  contactVatNo?: string | null;
  lines: InvoicePDFLine[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  remainingAmount: number;
  notes?: string | null;
  ebarimtQrCode?: string | null;
  ebarimtReceiptNumber?: string | null;
  ebarimtDocumentId?: string | null;
};

const formatNumber = (value: number) => {
  const num = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat("mn-MN", { maximumFractionDigits: 2 }).format(num);
};

const safeText = (value?: string | null) => {
  if (!value) return "-";
  return String(value);
};

export async function generateInvoicePDF(data: InvoicePDFData) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  const lineHeight = 4.5;

  const renderTextBlock = (
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    height: number,
  ) => {
    const lines = doc.splitTextToSize(text, maxWidth);
    doc.text(lines, x, y);
    return y + lines.length * height;
  };

  const renderKeyValue = (
    label: string,
    value: string,
    xLabel: number,
    xValue: number,
    y: number,
    valueWidth: number,
  ) => {
    doc.setFont("helvetica", "bold");
    doc.text(label, xLabel, y);
    doc.setFont("helvetica", "normal");
    return renderTextBlock(value, xValue, y, valueWidth, lineHeight);
  };

  const ensureSpace = (neededHeight: number, currentY: number, drawHeader?: () => number) => {
    if (currentY + neededHeight <= pageHeight - margin) {
      return currentY;
    }
    doc.addPage();
    const newY = margin;
    return drawHeader ? drawHeader() : newY;
  };

  let y = margin;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text("Invoice", margin, y);
  y += 8;

  const columnGap = 10;
  const columnWidth = (contentWidth - columnGap) / 2;
  const leftX = margin;
  const rightX = margin + columnWidth + columnGap;
  let leftY = y;
  let rightY = y;

  doc.setFontSize(11);
  doc.text(safeText(data.companyName), leftX, leftY);
  leftY += 6;
  doc.setFontSize(9);
  if (data.companyAddress) {
    leftY = renderTextBlock(safeText(data.companyAddress), leftX, leftY, columnWidth, lineHeight);
  }
  if (data.companyPhone) {
    leftY = renderTextBlock(`Phone: ${safeText(data.companyPhone)}`, leftX, leftY, columnWidth, lineHeight);
  }
  if (data.companyEmail) {
    leftY = renderTextBlock(`Email: ${safeText(data.companyEmail)}`, leftX, leftY, columnWidth, lineHeight);
  }
  if (data.companyRegNo) {
    leftY = renderTextBlock(`Reg No: ${safeText(data.companyRegNo)}`, leftX, leftY, columnWidth, lineHeight);
  }
  if (data.companyVatNo) {
    leftY = renderTextBlock(`VAT No: ${safeText(data.companyVatNo)}`, leftX, leftY, columnWidth, lineHeight);
  }

  doc.setFontSize(9);
  const infoLabelWidth = 26;
  const infoValueWidth = columnWidth - infoLabelWidth;
  rightY = renderKeyValue("Invoice No:", safeText(data.invoiceNumber), rightX, rightX + infoLabelWidth, rightY, infoValueWidth);
  rightY = renderKeyValue("Date:", safeText(data.invoiceDate), rightX, rightX + infoLabelWidth, rightY, infoValueWidth);
  rightY = renderKeyValue("Due Date:", safeText(data.dueDate), rightX, rightX + infoLabelWidth, rightY, infoValueWidth);
  rightY = renderKeyValue("Status:", safeText(data.status), rightX, rightX + infoLabelWidth, rightY, infoValueWidth);

  y = Math.max(leftY, rightY) + 6;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("Customer", margin, y);
  y += 6;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  y = renderTextBlock(safeText(data.contactName), margin, y, contentWidth, lineHeight);
  if (data.contactAddress) {
    y = renderTextBlock(`Address: ${safeText(data.contactAddress)}`, margin, y, contentWidth, lineHeight);
  }
  if (data.contactPhone) {
    y = renderTextBlock(`Phone: ${safeText(data.contactPhone)}`, margin, y, contentWidth, lineHeight);
  }
  if (data.contactEmail) {
    y = renderTextBlock(`Email: ${safeText(data.contactEmail)}`, margin, y, contentWidth, lineHeight);
  }
  if (data.contactRegNo) {
    y = renderTextBlock(`Reg No: ${safeText(data.contactRegNo)}`, margin, y, contentWidth, lineHeight);
  }
  if (data.contactVatNo) {
    y = renderTextBlock(`VAT No: ${safeText(data.contactVatNo)}`, margin, y, contentWidth, lineHeight);
  }

  y += 6;

  const columns = [
    { label: "No", width: 8 },
    { label: "Description", width: 60 },
    { label: "Qty", width: 12 },
    { label: "Unit", width: 20 },
    { label: "Tax %", width: 12 },
    { label: "Subtotal", width: 24 },
    { label: "Tax", width: 20 },
    { label: "Total", width: 24 },
  ];

  const drawTableHeader = () => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    let x = margin;
    columns.forEach((column) => {
      doc.text(column.label, x + 1, y);
      x += column.width;
    });
    const lineY = y + 2;
    doc.setLineWidth(0.2);
    doc.line(margin, lineY, pageWidth - margin, lineY);
    y = lineY + 4;
    return y;
  };

  drawTableHeader();

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);

  const rowGap = 2;
  data.lines.forEach((line, index) => {
    const descLines = doc.splitTextToSize(line.description || "-", columns[1].width - 2);
    const rowHeight = Math.max(descLines.length * lineHeight, lineHeight) + rowGap;

    y = ensureSpace(rowHeight + 6, y, () => {
      y = margin;
      return drawTableHeader();
    });

    let x = margin;
    doc.text(String(index + 1), x + 1, y);
    x += columns[0].width;
    doc.text(descLines, x + 1, y);
    x += columns[1].width;
    doc.text(formatNumber(line.quantity), x + columns[2].width - 1, y, { align: "right" });
    x += columns[2].width;
    doc.text(formatNumber(line.unitPrice), x + columns[3].width - 1, y, { align: "right" });
    x += columns[3].width;
    doc.text(formatNumber(line.taxRate), x + columns[4].width - 1, y, { align: "right" });
    x += columns[4].width;
    doc.text(formatNumber(line.subtotal), x + columns[5].width - 1, y, { align: "right" });
    x += columns[5].width;
    doc.text(formatNumber(line.taxAmount), x + columns[6].width - 1, y, { align: "right" });
    x += columns[6].width;
    doc.text(formatNumber(line.total), x + columns[7].width - 1, y, { align: "right" });

    y += rowHeight;
  });

  y += 6;

  const totalsLabelX = pageWidth - margin - 55;
  const totalsValueX = pageWidth - margin;
  const totalsLineGap = 7;

  const renderTotalLine = (label: string, value: number, isEmphasis = false) => {
    doc.setFont("helvetica", isEmphasis ? "bold" : "normal");
    doc.text(label, totalsLabelX, y);
    doc.text(formatNumber(value), totalsValueX, y, { align: "right" });
    y += totalsLineGap;
  };

  y = ensureSpace(totalsLineGap * 4, y);
  renderTotalLine("Subtotal:", data.subtotal);
  renderTotalLine("Tax:", data.taxAmount);
  renderTotalLine("Total:", data.totalAmount, true);
  renderTotalLine("Paid:", data.paidAmount);
  renderTotalLine("Remaining:", data.remainingAmount);

  if (data.notes) {
    y += 4;
    doc.setFont("helvetica", "bold");
    doc.text("Notes", margin, y);
    y += 6;
    doc.setFont("helvetica", "normal");
    y = renderTextBlock(safeText(data.notes), margin, y, contentWidth, lineHeight);
  }

  const hasEbarimt = data.ebarimtQrCode || data.ebarimtReceiptNumber || data.ebarimtDocumentId;
  if (hasEbarimt) {
    y += 8;
    const boxHeight = data.ebarimtQrCode ? 40 : 28;
    y = ensureSpace(boxHeight + 4, y);

    doc.setDrawColor(0, 160, 0);
    doc.setLineWidth(0.4);
    doc.rect(margin, y, contentWidth, boxHeight);

    const padding = 8;
    let boxTextY = y + padding;
    const boxTextX = margin + padding;
    const qrSize = 28;

    doc.setFont("helvetica", "bold");
    doc.text("E-barimt info", boxTextX, boxTextY);
    boxTextY += 6;
    doc.setFont("helvetica", "normal");

    if (data.ebarimtReceiptNumber) {
      boxTextY = renderTextBlock(
        `Receipt: ${safeText(data.ebarimtReceiptNumber)}`,
        boxTextX,
        boxTextY,
        contentWidth - padding * 2 - qrSize,
        lineHeight,
      );
    }

    if (data.ebarimtDocumentId) {
      boxTextY = renderTextBlock(
        `Document ID: ${safeText(data.ebarimtDocumentId)}`,
        boxTextX,
        boxTextY,
        contentWidth - padding * 2 - qrSize,
        lineHeight,
      );
    }

    if (data.ebarimtQrCode && data.ebarimtQrCode.startsWith("data:image")) {
      const qrX = margin + contentWidth - padding - qrSize;
      const qrY = y + padding;
      doc.addImage(data.ebarimtQrCode, "PNG", qrX, qrY, qrSize, qrSize);
    }

    y += boxHeight + 5;
  }

  const safeInvoiceNumber = data.invoiceNumber.replace(/[^a-zA-Z0-9_-]/g, "_");
  doc.save(`invoice-${safeInvoiceNumber}.pdf`);
}
