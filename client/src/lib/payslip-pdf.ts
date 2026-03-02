import jsPDF from "jspdf";
import { format } from "date-fns";

export interface PayslipPDFData {
    employeeName: string;
    employeeNo?: string;
    position?: string;
    department?: string;
    periodStart: string;
    periodEnd: string;
    baseSalary: number;
    grossPay: number;
    shi: number; // Social and Health Insurance
    pit: number; // Personal Income Tax
    advances: number;
    otherDeductions?: number;
    allowances?: number;
    totalDeductions: number;
    netPay: number;
    status: string;
    companyName?: string;
    generatedAt?: string;
}

function formatMNT(value: number | string, withoutSymbol = false): string {
    const num = typeof value === "string" ? parseFloat(value) : value;
    const formatted = new Intl.NumberFormat("mn-MN", {
        style: "decimal",
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
    }).format(num);
    return withoutSymbol ? formatted : `${formatted}₮`;
}

async function loadFonts(doc: jsPDF): Promise<boolean> {
    try {
        const fontPath = "/fonts/Roboto-Regular.ttf";
        const response = await fetch(fontPath);
        if (!response.ok) throw new Error("Font file not found");

        const blob = await response.blob();
        if (blob.size < 50000) throw new Error(`Font file too small (${blob.size} bytes)`);

        const reader = new FileReader();

        return new Promise<boolean>((resolve) => {
            reader.onloadend = () => {
                const base64data = reader.result as string;
                if (!base64data || !base64data.includes(",")) {
                    resolve(false);
                    return;
                }
                const base64Content = base64data.split(",")[1];

                try {
                    doc.addFileToVFS("CustomFont.ttf", base64Content);
                    doc.addFont("CustomFont.ttf", "CustomFont", "normal", "Identity-H");
                    resolve(true);
                } catch (e) {
                    console.error("Font register error:", e);
                    resolve(false);
                }
            };
            reader.onerror = () => resolve(false);
            reader.readAsDataURL(blob);
        });
    } catch (e) {
        console.warn("Font load failed:", e);
        return false;
    }
}

export async function generatePayslipPDF(data: PayslipPDFData): Promise<string> {
    const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
        compress: true,
    });

    const isFontLoaded = await loadFonts(doc);

    const renderText = (
        text: string,
        x: number,
        y: number,
        fontSize: number,
        options: { isBold?: boolean; align?: "left" | "right" | "center" } = {}
    ): number => {
        doc.setFontSize(fontSize);
        if (isFontLoaded) {
            doc.setFont("CustomFont", "normal");
        } else {
            doc.setFont("helvetica", options.isBold ? "bold" : "normal");
        }
        const align = options.align || "left";
        try {
            doc.text(text, x, y, { align });
        } catch {
            doc.setFont("helvetica");
            doc.text(text, x, y, { align });
        }
        return fontSize * 0.3527 + 1;
    };

    const margin = 15;
    const pageWidth = doc.internal.pageSize.getWidth();
    const contentWidth = pageWidth - margin * 2;
    let yPos = margin;

    // Header - Company
    renderText(data.companyName || "Компани", margin, yPos, 14, { isBold: true });
    yPos += 10;

    // Title
    const periodLabel = `${format(new Date(data.periodStart), "yyyy оны MM сар")}`;
    renderText("ЦАЛИНГИЙН ХУУДАС", pageWidth / 2, yPos, 16, { align: "center", isBold: true });
    yPos += 8;
    renderText(periodLabel, pageWidth / 2, yPos, 11, { align: "center" });
    yPos += 12;

    // Employee Info Box
    doc.setFillColor(248, 250, 252);
    doc.rect(margin, yPos - 2, contentWidth, 28, "F");
    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, yPos - 2, contentWidth, 28, "S");

    const infoCol1 = margin + 5;
    const infoCol2 = margin + 50;
    const infoCol3 = pageWidth / 2 + 5;
    const infoCol4 = pageWidth / 2 + 45;

    renderText("Ажилтны нэр:", infoCol1, yPos + 3, 9);
    renderText(data.employeeName, infoCol2, yPos + 3, 10, { isBold: true });
    renderText("Ажилтны дугаар:", infoCol3, yPos + 3, 9);
    renderText(data.employeeNo || "-", infoCol4, yPos + 3, 10, { isBold: true });

    renderText("Албан тушаал:", infoCol1, yPos + 11, 9);
    renderText(data.position || "-", infoCol2, yPos + 11, 10);
    renderText("Хэлтэс:", infoCol3, yPos + 11, 9);
    renderText(data.department || "-", infoCol4, yPos + 11, 10);

    renderText("Үндсэн цалин:", infoCol1, yPos + 19, 9);
    renderText(formatMNT(data.baseSalary), infoCol2, yPos + 19, 10, { isBold: true });

    yPos += 35;

    // Earnings Section
    renderText("ОРЛОГО", margin, yPos, 11, { isBold: true });
    yPos += 6;

    const drawRow = (label: string, value: number, isTotal = false) => {
        if (isTotal) {
            doc.setFillColor(241, 245, 249);
            doc.rect(margin, yPos - 2, contentWidth, 8, "F");
        }
        renderText(label, margin + 5, yPos + 2, isTotal ? 10 : 9, { isBold: isTotal });
        renderText(formatMNT(value), pageWidth - margin - 5, yPos + 2, isTotal ? 10 : 9, {
            align: "right",
            isBold: isTotal,
        });
        yPos += 8;
    };

    drawRow("Үндсэн цалин", data.baseSalary);
    if (data.allowances && data.allowances > 0) {
        drawRow("Нэмэгдэл/Урамшуулал", data.allowances);
    }
    drawRow("НИЙТ ОРЛОГО", data.grossPay, true);

    yPos += 5;

    // Deductions Section
    renderText("СУУТГАЛ", margin, yPos, 11, { isBold: true });
    yPos += 6;

    drawRow("НДШ (11%)", data.shi);
    drawRow("ХХОАТ (10%)", data.pit);
    if (data.advances > 0) {
        drawRow("Урьдчилгаа", data.advances);
    }
    if (data.otherDeductions && data.otherDeductions > 0) {
        drawRow("Бусад суутгал", data.otherDeductions);
    }
    drawRow("НИЙТ СУУТГАЛ", data.totalDeductions, true);

    yPos += 10;

    // Net Pay Box
    doc.setFillColor(34, 197, 94); // Green
    doc.rect(margin, yPos - 2, contentWidth, 14, "F");
    doc.setTextColor(255, 255, 255);
    renderText("ГАРТ ОЛГОХ ЦАЛИН", margin + 5, yPos + 4, 12, { isBold: true });
    renderText(formatMNT(data.netPay), pageWidth - margin - 5, yPos + 4, 14, {
        align: "right",
        isBold: true,
    });
    doc.setTextColor(0, 0, 0);

    yPos += 20;

    // Status Badge
    const statusText =
        data.status === "paid"
            ? "ТӨЛӨГДСӨН"
            : data.status === "approved"
                ? "БАТЛАГДСАН"
                : "ТООЦООЛСОН";
    const statusColor =
        data.status === "paid" ? [34, 197, 94] : data.status === "approved" ? [59, 130, 246] : [234, 179, 8];
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(pageWidth - margin - 35, yPos, 35, 8, 2, 2, "F");
    doc.setTextColor(255, 255, 255);
    renderText(statusText, pageWidth - margin - 17.5, yPos + 5, 8, { align: "center", isBold: true });
    doc.setTextColor(0, 0, 0);

    yPos += 15;

    // Footer
    doc.setTextColor(156, 163, 175);
    renderText(
        `Үүсгэсэн огноо: ${format(new Date(), "yyyy-MM-dd HH:mm")}`,
        margin,
        yPos,
        8
    );

    // Generate output
    try {
        const arrayBuffer = doc.output("arraybuffer");
        const bytes = new Uint8Array(arrayBuffer);
        let binary = "";
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64 = window.btoa(binary);
        return `data:application/pdf;base64,${base64}`;
    } catch (err) {
        console.error("PDF Generation failed:", err);
        return doc.output("datauristring");
    }
}

export function downloadPayslipPDF(dataUri: string, filename: string) {
    const link = document.createElement("a");
    link.href = dataUri;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
