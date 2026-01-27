/**
 * Export utilities for reports (Excel, CSV, PDF)
 */

import * as XLSX from "xlsx";
import type { VATReport, VATReportLine, ND7Report, ND8Report } from "./reports";

/**
 * Export VAT Report to Excel
 */
export function exportVATReportToExcel(report: VATReport): Buffer {
  const workbook = XLSX.utils.book_new();

  // Sales sheet
  const salesData: any[][] = [
    ["НӨАТ ТАЙЛАН - БОРЛУУЛАЛТ"],
    ["Огноо:", report.startDate, "ээс", report.endDate, "хүртэл"],
    [],
    ["№", "Нэхэмжлэхийн дугаар", "Огноо", "Харилцагч", "Татварын код", "Татварын хувь (%)", "ХХОАТ суурь", "ХХОАТ дүн"],
  ];

  report.sales.forEach((line, index) => {
    salesData.push([
      index + 1,
      line.invoiceNumber || "",
      line.invoiceDate || "",
      line.customerName || "",
      line.taxCode || "",
      String(line.taxRate || 0),
      String(line.taxBase || 0),
      String(line.taxAmount || 0),
    ]);
  });

  salesData.push([]);
  salesData.push(["Нийт ХХОАТ суурь:", String(report.totalSalesBase)]);
  salesData.push(["Нийт ХХОАТ дүн:", String(report.totalSalesVAT)]);

  const salesSheet = XLSX.utils.aoa_to_sheet(salesData);
  XLSX.utils.book_append_sheet(workbook, salesSheet, "Борлуулалт");

  // Purchases sheet
  const purchaseData: any[][] = [
    ["НӨАТ ТАЙЛАН - ХУДАЛДАН АВАЛТ"],
    ["Огноо:", report.startDate, "ээс", report.endDate, "хүртэл"],
    [],
    ["№", "Нэхэмжлэхийн дугаар", "Огноо", "Харилцагч", "Татварын код", "Татварын хувь (%)", "ХХОАТ суурь", "ХХОАТ дүн"],
  ];

  report.purchases.forEach((line, index) => {
    purchaseData.push([
      index + 1,
      line.invoiceNumber || "",
      line.invoiceDate || "",
      line.customerName || "",
      line.taxCode || "",
      String(line.taxRate || 0),
      String(line.taxBase || 0),
      String(line.taxAmount || 0),
    ]);
  });

  purchaseData.push([]);
  purchaseData.push(["Нийт ХХОАТ суурь:", String(report.totalPurchaseBase)]);
  purchaseData.push(["Нийт ХХОАТ дүн:", String(report.totalPurchaseVAT)]);

  const purchaseSheet = XLSX.utils.aoa_to_sheet(purchaseData);
  XLSX.utils.book_append_sheet(workbook, purchaseSheet, "Худалдан авалт");

  // Summary sheet
  const summaryData: any[][] = [
    ["НӨАТ ТАЙЛАН - ХУРААНГУЙ"],
    ["Огноо:", report.startDate, "ээс", report.endDate, "хүртэл"],
    [],
    ["Борлуулалт"],
    ["Нийт ХХОАТ суурь:", report.totalSalesBase],
    ["Нийт ХХОАТ дүн:", report.totalSalesVAT],
    [],
    ["Худалдан авалт"],
    ["Нийт ХХОАТ суурь:", report.totalPurchaseBase],
    ["Нийт ХХОАТ дүн:", report.totalPurchaseVAT],
    [],
    ["Төлөх НӨАТ (Борлуулалт - Худалдан авалт):", report.netVAT],
  ];

  const summarySheet = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(workbook, summarySheet, "Хураангуй");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

/**
 * Export VAT Report to CSV
 */
export function exportVATReportToCSV(report: VATReport): string {
  const lines: string[] = [];

  // Header
  lines.push("НӨАТ ТАЙЛАН");
  lines.push(`Огноо: ${report.startDate} ээс ${report.endDate} хүртэл`);
  lines.push("");

  // Sales section
  lines.push("=== БОРЛУУЛАЛТ ===");
  lines.push("Нэхэмжлэхийн дугаар,Огноо,Татварын код,Татварын хувь (%),ХХОАТ суурь,ХХОАТ дүн");

  report.sales.forEach((line) => {
    lines.push(
      [
        line.invoiceNumber || "",
        line.invoiceDate || "",
        line.taxCode,
        line.taxRate,
        line.taxBase,
        line.taxAmount,
      ].join(",")
    );
  });

  lines.push("");
  lines.push(`Нийт ХХОАТ суурь:,${report.totalSalesBase}`);
  lines.push(`Нийт ХХОАТ дүн:,${report.totalSalesVAT}`);
  lines.push("");

  // Purchases section
  lines.push("=== ХУДАЛДАН АВАЛТ ===");
  lines.push("Нэхэмжлэхийн дугаар,Огноо,Татварын код,Татварын хувь (%),ХХОАТ суурь,ХХОАТ дүн");

  report.purchases.forEach((line) => {
    lines.push(
      [
        line.invoiceNumber || "",
        line.invoiceDate || "",
        line.taxCode,
        line.taxRate,
        line.taxBase,
        line.taxAmount,
      ].join(",")
    );
  });

  lines.push("");
  lines.push(`Нийт ХХОАТ суурь:,${report.totalPurchaseBase}`);
  lines.push(`Нийт ХХОАТ дүн:,${report.totalPurchaseVAT}`);
  lines.push("");

  // Summary
  lines.push("=== ХУРААНГУЙ ===");
  lines.push(`Төлөх НӨАТ (Борлуулалт - Худалдан авалт):,${report.netVAT}`);

  return lines.join("\n");
}

/**
 * Export НД-7 Report to Excel
 * НД-7: Ажилтнуудын мэдээлэл (Нийгмийн даатгалын тайлан)
 */
export function exportND7ReportToExcel(report: ND7Report): Buffer {
  const workbook = XLSX.utils.book_new();

  // Header
  const data: any[][] = [
    ["НД-7 ТАЙЛАН: АЖИЛТНУУДЫН МЭДЭЭЛЭЛ"],
    ["Нийгмийн даатгалын тайлан"],
    ["Хугацаа:", report.periodStart, "ээс", report.periodEnd, "хүртэл"],
    [],
    ["№", "Ажилтны код", "Овог", "Нэр", "РД", "Ажилд орсон огноо", "Төрсөн огноо", "НДШ суурь", "НДШ (ажилтан 11%)", "НДШ (ажил олгогч 12.5%)", "НДШ нийт"],
  ];

  // Data rows
  report.lines.forEach((line, index) => {
    data.push([
      index + 1,
      line.employeeNo || "",
      line.lastName || "",
      line.firstName,
      line.nationalId || "",
      line.hireDate || "",
      line.birthDate || "",
      line.shiBase.toLocaleString("mn-MN"),
      line.shiEmployee.toLocaleString("mn-MN"),
      line.shiEmployer.toLocaleString("mn-MN"),
      line.shiTotal.toLocaleString("mn-MN"),
    ]);
  });

  // Totals
  data.push([]);
  data.push([
    "НИЙТ",
    "",
    "",
    "",
    "",
    "",
    "",
    report.lines.reduce((sum, line) => sum + line.shiBase, 0).toLocaleString("mn-MN"),
    report.totalShiEmployee.toLocaleString("mn-MN"),
    report.totalShiEmployer.toLocaleString("mn-MN"),
    report.totalShi.toLocaleString("mn-MN"),
  ]);

  const sheet = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  sheet["!cols"] = [
    { wch: 5 },  // №
    { wch: 12 }, // Ажилтны код
    { wch: 15 }, // Овог
    { wch: 15 }, // Нэр
    { wch: 12 }, // РД
    { wch: 15 }, // Ажилд орсон огноо
    { wch: 15 }, // Төрсөн огноо
    { wch: 15 }, // НДШ суурь
    { wch: 20 }, // НДШ (ажилтан)
    { wch: 25 }, // НДШ (ажил олгогч)
    { wch: 15 }, // НДШ нийт
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, "НД-7");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

/**
 * Export НД-8 Report to Excel
 * НД-8: Цалингийн мэдээлэл (Нийгмийн даатгалын тайлан)
 */
export function exportND8ReportToExcel(report: ND8Report): Buffer {
  const workbook = XLSX.utils.book_new();

  // Header
  const data: any[][] = [
    ["НД-8 ТАЙЛАН: ЦАЛИНГИЙН МЭДЭЭЛЭЛ"],
    ["Нийгмийн даатгалын тайлан"],
    ["Хугацаа:", report.periodStart, "ээс", report.periodEnd, "хүртэл"],
    [],
    ["№", "Ажилтны код", "Ажилтны нэр", "РД", "Хугацаа", "Нийт цалин", "НДШ суурь", "НДШ (ажилтан 11%)", "НДШ (ажил олгогч 12.5%)", "НДШ нийт", "Цэвэр цалин"],
  ];

  // Data rows
  report.lines.forEach((line, index) => {
    data.push([
      index + 1,
      line.employeeNo || "",
      line.employeeName,
      line.nationalId || "",
      `${line.periodStart} - ${line.periodEnd}`,
      line.grossPay.toLocaleString("mn-MN"),
      line.shiBase.toLocaleString("mn-MN"),
      line.shiEmployee.toLocaleString("mn-MN"),
      line.shiEmployer.toLocaleString("mn-MN"),
      line.shiTotal.toLocaleString("mn-MN"),
      line.netPay.toLocaleString("mn-MN"),
    ]);
  });

  // Totals
  data.push([]);
  data.push([
    "НИЙТ",
    "",
    "",
    "",
    "",
    report.totalGrossPay.toLocaleString("mn-MN"),
    report.lines.reduce((sum, line) => sum + line.shiBase, 0).toLocaleString("mn-MN"),
    report.totalShiEmployee.toLocaleString("mn-MN"),
    report.totalShiEmployer.toLocaleString("mn-MN"),
    report.totalShi.toLocaleString("mn-MN"),
    report.totalNetPay.toLocaleString("mn-MN"),
  ]);

  const sheet = XLSX.utils.aoa_to_sheet(data);
  
  // Set column widths
  sheet["!cols"] = [
    { wch: 5 },  // №
    { wch: 12 }, // Ажилтны код
    { wch: 20 }, // Ажилтны нэр
    { wch: 12 }, // РД
    { wch: 20 }, // Хугацаа
    { wch: 15 }, // Нийт цалин
    { wch: 15 }, // НДШ суурь
    { wch: 20 }, // НДШ (ажилтан)
    { wch: 25 }, // НДШ (ажил олгогч)
    { wch: 15 }, // НДШ нийт
    { wch: 15 }, // Цэвэр цалин
  ];

  XLSX.utils.book_append_sheet(workbook, sheet, "НД-8");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

/**
 * Export TT-03 Report to Excel (Official TT-03 format)
 * ТТ-03а: Нэмэгдсэн өртгийн албан татвар суутган төлөгчийн тайлан
 * 
 * Format according to Mongolian Tax Authority TT-03a template
 */
export function exportTT03ReportToExcel(
  report: VATReport,
  tenant: { name: string; legalName?: string; vatNo?: string; address?: string; district?: string; city?: string }
): Buffer {
  const workbook = XLSX.utils.book_new();

  // Header section (Тайлангийн толгой хэсэг)
  const headerData: any[][] = [
    ["ТТ-03а ТАЙЛАН"],
    ["Нэмэгдсэн өртгийн албан татвар суутган төлөгчийн тайлан"],
    [],
    ["Татвар төлөгчийн мэдээлэл:"],
    ["Байгууллагын нэр:", tenant.legalName || tenant.name],
    ["ТТД/НӨАТ дугаар:", tenant.vatNo || ""],
    ["Хаяг:", `${tenant.city || "Улаанбаатар"}, ${tenant.district || ""} дүүрэг, ${tenant.address || ""}`],
    [],
    ["Тайлангийн хугацаа:", report.startDate, "ээс", report.endDate, "хүртэл"],
    [],
  ];

  // Section A: Борлуулалт / Output VAT
  const sectionA: any[][] = [
    ["А. БОРЛУУЛАЛТ / OUTPUT VAT"],
    [],
    ["№", "Нэхэмжлэхийн дугаар", "Огноо", "Харилцагч", "НӨАТ суурь", "НӨАТ дүн (10%)"],
  ];

  report.sales.forEach((line, index) => {
    sectionA.push([
      index + 1,
      line.invoiceNumber || "",
      line.invoiceDate || "",
      line.customerName || "",
      line.taxBase.toLocaleString("mn-MN"),
      line.taxAmount.toLocaleString("mn-MN"),
    ]);
  });

  sectionA.push([]);
  sectionA.push(["БОРЛУУЛАЛТЫН НИЙТ НӨАТ СУУРЬ:", report.totalSalesBase.toLocaleString("mn-MN")]);
  sectionA.push(["БОРЛУУЛАЛТЫН НИЙТ НӨАТ ДҮН:", report.totalSalesVAT.toLocaleString("mn-MN")]);
  sectionA.push([]);

  // Section B: Худалдан авалт / Input VAT
  const sectionB: any[][] = [
    ["Б. ХУДАЛДАН АВАЛТ / INPUT VAT"],
    [],
    ["№", "Нэхэмжлэхийн дугаар", "Огноо", "Харилцагч", "НӨАТ суурь", "НӨАТ дүн (10%)"],
  ];

  report.purchases.forEach((line, index) => {
    sectionB.push([
      index + 1,
      line.invoiceNumber || "",
      line.invoiceDate || "",
      line.customerName || "",
      line.taxBase.toLocaleString("mn-MN"),
      line.taxAmount.toLocaleString("mn-MN"),
    ]);
  });

  sectionB.push([]);
  sectionB.push(["ХУДАЛДАН АВАЛТЫН НИЙТ НӨАТ СУУРЬ:", report.totalPurchaseBase.toLocaleString("mn-MN")]);
  sectionB.push(["ХУДАЛДАН АВАЛТЫН НИЙТ НӨАТ ДҮН:", report.totalPurchaseVAT.toLocaleString("mn-MN")]);
  sectionB.push([]);

  // Section E: Хураангуй / Summary
  const sectionE: any[][] = [
    ["Е. ХУРААНГУЙ / SUMMARY"],
    [],
    ["Борлуулалтын НӨАТ (Output VAT):", report.totalSalesVAT.toLocaleString("mn-MN")],
    ["Худалдан авалтын НӨАТ (Input VAT):", report.totalPurchaseVAT.toLocaleString("mn-MN")],
    [],
    ["ТӨЛӨХ НӨАТ (Net VAT Payable):", report.netVAT.toLocaleString("mn-MN")],
    ...(report.netVAT < 0 ? [["Буцаах НӨАТ (VAT Refundable):", Math.abs(report.netVAT).toLocaleString("mn-MN")]] : []),
  ];

  // Combine all sections
  const mainData = [
    ...headerData,
    ...sectionA,
    ...sectionB,
    ...sectionE,
  ];

  const mainSheet = XLSX.utils.aoa_to_sheet(mainData);
  
  // Set column widths
  mainSheet["!cols"] = [
    { wch: 5 },  // №
    { wch: 20 }, // Нэхэмжлэхийн дугаар
    { wch: 12 }, // Огноо
    { wch: 25 }, // Харилцагч
    { wch: 15 }, // НӨАТ суурь
    { wch: 15 }, // НӨАТ дүн
  ];

  XLSX.utils.book_append_sheet(workbook, mainSheet, "ТТ-03а");

  // Борлуулалтын дэвтэр (Detailed Sales Register)
  const salesRegisterData: any[][] = [
    ["БОРЛУУЛАЛТЫН ДЭВТЭР"],
    ["Огноо:", report.startDate, "ээс", report.endDate, "хүртэл"],
    [],
    ["№", "Нэхэмжлэхийн дугаар", "Огноо", "Харилцагч", "Татварын код", "Татварын хувь (%)", "НӨАТ суурь", "НӨАТ дүн"],
  ];

  report.sales.forEach((line, index) => {
    salesRegisterData.push([
      index + 1,
      line.invoiceNumber || "",
      line.invoiceDate || "",
      line.customerName || "",
      line.taxCode || "",
      String(line.taxRate || 10),
      line.taxBase.toLocaleString("mn-MN"),
      line.taxAmount.toLocaleString("mn-MN"),
    ]);
  });

  salesRegisterData.push([]);
  salesRegisterData.push(["НИЙТ:", "", "", "", "", "", report.totalSalesBase.toLocaleString("mn-MN"), report.totalSalesVAT.toLocaleString("mn-MN")]);

  const salesSheet = XLSX.utils.aoa_to_sheet(salesRegisterData);
  salesSheet["!cols"] = [
    { wch: 5 },  // №
    { wch: 20 }, // Нэхэмжлэхийн дугаар
    { wch: 12 }, // Огноо
    { wch: 25 }, // Харилцагч
    { wch: 12 }, // Татварын код
    { wch: 15 }, // Татварын хувь
    { wch: 15 }, // НӨАТ суурь
    { wch: 15 }, // НӨАТ дүн
  ];
  XLSX.utils.book_append_sheet(workbook, salesSheet, "Борлуулалт");

  // Худалдан авалтын дэвтэр (Detailed Purchase Register)
  const purchaseRegisterData: any[][] = [
    ["ХУДАЛДАН АВАЛТЫН ДЭВТЭР"],
    ["Огноо:", report.startDate, "ээс", report.endDate, "хүртэл"],
    [],
    ["№", "Нэхэмжлэхийн дугаар", "Огноо", "Харилцагч", "Татварын код", "Татварын хувь (%)", "НӨАТ суурь", "НӨАТ дүн"],
  ];

  report.purchases.forEach((line, index) => {
    purchaseRegisterData.push([
      index + 1,
      line.invoiceNumber || "",
      line.invoiceDate || "",
      line.customerName || "",
      line.taxCode || "",
      String(line.taxRate || 10),
      line.taxBase.toLocaleString("mn-MN"),
      line.taxAmount.toLocaleString("mn-MN"),
    ]);
  });

  purchaseRegisterData.push([]);
  purchaseRegisterData.push(["НИЙТ:", "", "", "", "", "", report.totalPurchaseBase.toLocaleString("mn-MN"), report.totalPurchaseVAT.toLocaleString("mn-MN")]);

  const purchaseSheet = XLSX.utils.aoa_to_sheet(purchaseRegisterData);
  purchaseSheet["!cols"] = [
    { wch: 5 },  // №
    { wch: 20 }, // Нэхэмжлэхийн дугаар
    { wch: 12 }, // Огноо
    { wch: 25 }, // Харилцагч
    { wch: 12 }, // Татварын код
    { wch: 15 }, // Татварын хувь
    { wch: 15 }, // НӨАТ суурь
    { wch: 15 }, // НӨАТ дүн
  ];
  XLSX.utils.book_append_sheet(workbook, purchaseSheet, "Худалдан авалт");

  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
