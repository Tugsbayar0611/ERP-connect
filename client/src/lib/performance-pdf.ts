import jsPDF from "jspdf";
import { format } from "date-fns";

// Reusing types from Performance.tsx to avoid circular dependency or duplication issues if possible
// But defining interfaces here for clarity and independence
export interface PerformancePeriod {
  name: string;
  startDate: string;
  endDate: string;
  status: string;
}

export interface PerformanceGoal {
  title: string;
  description?: string;
  weight: number;
  progress: number;
  status: string;
  employeeName?: string; // Optional if we want to show it
}

export interface PerformanceSummary {
  totalWeight: number;
  totalScore: number;
  goalsCount: number;
  completedCount: number;
}

export interface PerformanceReportEmployee {
  name: string;
  position?: string;
  department?: string;
  code?: string;
}

export interface PerformanceReportData {
  period: PerformancePeriod;
  employee: PerformanceReportEmployee;
  goals: PerformanceGoal[];
  summary: PerformanceSummary;
  generatedBy: string;
  generatedAt: Date;
}

// Helper to format MNT (though we might not need MNT for performance, maybe percents)
function formatPercent(value: number): string {
  return `${value}%`;
}

// 1. FONT LOADING FUNCTION (Copied/Adapted from invoice-pdf.ts)
async function loadFonts(doc: jsPDF): Promise<boolean> {
  try {
    const fontPath = '/fonts/Roboto-Regular.ttf';
    const response = await fetch(fontPath);
    if (!response.ok) throw new Error("Font file not found");

    const blob = await response.blob();
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

export async function generatePerformanceReportPDF(data: PerformanceReportData): Promise<string> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  const isFontLoaded = await loadFonts(doc);

  // Text render helper
  const renderText = (text: string, x: number, y: number, fontSize: number, options: { isBold?: boolean, align?: "left" | "right" | "center", maxWidth?: number } = {}): number => {
    doc.setFontSize(fontSize);
    if (isFontLoaded) {
      doc.setFont("CustomFont", "normal");
    } else {
      doc.setFont("helvetica", options.isBold ? "bold" : "normal");
    }

    const align = options.align || "left";
    try {
      if (options.maxWidth) {
        const lines = doc.splitTextToSize(text, options.maxWidth);
        doc.text(lines, x, y, { align });
        return (lines.length * fontSize * 0.3527) + 1;
      } else {
        doc.text(text, x, y, { align });
        return (fontSize * 0.3527) + 1;
      }
    } catch (e) {
      console.error("Render error:", text);
      return (fontSize * 0.3527) + 1;
    }
  };

  const margin = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - margin * 2;
  let yPos = margin;

  // HEADER
  renderText("Гүйцэтгэлийн Тайлан", pageWidth / 2, yPos, 16, { align: "center", isBold: true });
  yPos += 10;

  renderText(`Үе: ${data.period.name}`, pageWidth / 2, yPos, 12, { align: "center" });
  yPos += 6;

  const dateRange = `${format(new Date(data.period.startDate), "yyyy-MM-dd")} — ${format(new Date(data.period.endDate), "yyyy-MM-dd")}`;
  renderText(dateRange, pageWidth / 2, yPos, 10, { align: "center" });
  yPos += 15;

  // EMPLOYEE INFO
  // doc.setThemeColor(245, 245, 245); // Light gray background


  const empBoxHeight = 20;
  doc.setDrawColor(220, 220, 220);
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(margin, yPos, contentWidth, empBoxHeight, 2, 2, "FD");

  const empY = yPos + 7;
  renderText(`Ажилтан: ${data.employee.name}`, margin + 5, empY, 11, { isBold: true });
  if (data.employee.code) {
    renderText(`Код: ${data.employee.code}`, margin + 5, empY + 6, 9, { align: "left" });
  }

  if (data.employee.position || data.employee.department) {
    const posText = [data.employee.position, data.employee.department].filter(Boolean).join(" | ");
    renderText(posText, contentWidth + margin - 5, empY, 10, { align: "right" });
  }

  yPos += empBoxHeight + 10;

  // SUMMARY CARD STYLE
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(245, 247, 250);
  doc.roundedRect(margin, yPos, contentWidth, 25, 3, 3, 'FD');

  let summaryY = yPos + 8;
  const colW = contentWidth / 4;

  // Score
  renderText("Нийт Оноо", margin + colW * 0.5, summaryY, 10, { align: "center" });
  renderText(`${data.summary.totalScore.toFixed(1)}`, margin + colW * 0.5, summaryY + 8, 14, { align: "center", isBold: true });

  // Weight
  renderText("Нийт Жин", margin + colW * 1.5, summaryY, 10, { align: "center" });
  renderText(`${data.summary.totalWeight}%`, margin + colW * 1.5, summaryY + 8, 14, { align: "center", isBold: true });

  // Goal Count
  renderText("Зорилтууд", margin + colW * 2.5, summaryY, 10, { align: "center" });
  renderText(`${data.summary.goalsCount}`, margin + colW * 2.5, summaryY + 8, 14, { align: "center", isBold: true });

  // Completed
  renderText("Дууссан", margin + colW * 3.5, summaryY, 10, { align: "center" });
  renderText(`${data.summary.completedCount}`, margin + colW * 3.5, summaryY + 8, 14, { align: "center", isBold: true });

  yPos += 35;

  // GOALS TABLE HEADER
  const cols = {
    no: 10,
    title: 80,
    weight: 20,
    progress: 25,
    score: 20,
    status: 25
  };

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 5, contentWidth, 8, 'F');

  let x = margin;
  renderText("№", x, yPos, 9, { isBold: true }); x += cols.no;
  renderText("Зорилт", x, yPos, 9, { isBold: true }); x += cols.title;
  renderText("Жин", x + cols.weight, yPos, 9, { isBold: true, align: "right" }); x += cols.weight;
  renderText("Гүйцэтгэл", x + cols.progress, yPos, 9, { isBold: true, align: "right" }); x += cols.progress;
  renderText("Оноо", x + cols.score, yPos, 9, { isBold: true, align: "right" }); x += cols.score;
  renderText("Төлөв", x, yPos, 9, { isBold: true });

  yPos += 6;
  doc.line(margin, yPos - 3, pageWidth - margin, yPos - 3);

  // GOALS LIST
  data.goals.forEach((goal, idx) => {
    if (yPos > pageHeight - 20) {
      doc.addPage();
      yPos = margin;
    }

    // Calculate row height based on title wrap
    const titleLines = doc.splitTextToSize(goal.title, cols.title - 2);
    const rowHeight = Math.max(8, titleLines.length * 5);

    x = margin;
    renderText((idx + 1).toString(), x, yPos, 9); x += cols.no;

    doc.text(titleLines, x, yPos, { align: "left" }); x += cols.title;

    renderText(`${goal.weight}%`, x + cols.weight, yPos, 9, { align: "right" }); x += cols.weight;
    renderText(`${goal.progress}%`, x + cols.progress, yPos, 9, { align: "right" }); x += cols.progress;

    const score = (goal.weight * goal.progress / 100).toFixed(1);
    renderText(score, x + cols.score, yPos, 9, { align: "right" }); x += cols.score;

    // Status badges (simulate)
    let statusText = goal.status === 'completed' ? 'Дууссан' : (goal.status === 'in_progress' ? 'Хийгдэж буй' : 'Төлөвлөсөн');
    renderText(statusText, x, yPos, 8);

    yPos += rowHeight;
    doc.setDrawColor(240, 240, 240);
    doc.line(margin, yPos - rowHeight + 2, pageWidth - margin, yPos - rowHeight + 2); // subtle line
    yPos += 2;
  });

  // COMMENTS SECTION (Dynamic positioning)
  if (yPos > pageHeight - 60) {
    doc.addPage();
    yPos = margin;
  }

  yPos += 10;
  renderText("Удирдлагын үнэлгээ / Сэтгэгдэл:", margin, yPos, 10, { isBold: true });
  yPos += 5;

  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(margin, yPos, contentWidth, 30, 2, 2, 'S');
  yPos += 40;

  // SIGNATURE SECTION
  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = margin + 10;
  }

  const sigY = yPos + 10;
  const sigWidth = contentWidth / 2;

  // Employee Signature
  renderText("Тайлантай танилцсан ажилтан:", margin, sigY, 10);
  doc.line(margin, sigY + 15, margin + 60, sigY + 15);
  renderText("Гарын үсэг", margin, sigY + 20, 8);

  // Manager Signature
  renderText("Үнэлгээ хийсэн удирдлага:", margin + sigWidth, sigY, 10);
  doc.line(margin + sigWidth, sigY + 15, margin + sigWidth + 60, sigY + 15);
  renderText("Гарын үсэг / Тамга", margin + sigWidth, sigY + 20, 8);

  // Date
  renderText(`Огноо: ${format(new Date(), "yyyy-MM-dd")}`, margin, sigY + 35, 10);

  // FOOTER
  yPos = pageHeight - 15;
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  renderText(`Хэвлэсэн: ${data.generatedBy} | Огноо: ${format(data.generatedAt, "yyyy-MM-dd HH:mm")}`, margin, yPos, 8);

  if (!isFontLoaded) {
    doc.setTextColor(255, 0, 0);
    doc.text("Warning: Custom font not loaded.", margin, yPos + 5);
  }

  // OUTPUT
  try {
    const arrayBuffer = doc.output('arraybuffer');
    const bytes = new Uint8Array(arrayBuffer);
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    // Client-side only
    const base64 = window.btoa(binary);
    return `data:application/pdf;base64,${base64}`;
  } catch (err) {
    console.error("PDF Generate error:", err);
    return doc.output('datauristring');
  }
}
