/**
 * Export utilities for CSV/Excel export
 */

/**
 * Convert array of objects to CSV string
 */
export function convertToCSV<T extends Record<string, any>>(
  data: T[],
  headers: Array<{ key: keyof T; label: string }>
): string {
  // CSV header row
  const headerRow = headers.map(h => escapeCSVField(h.label)).join(",");
  
  // CSV data rows
  const dataRows = data.map(row => {
    return headers.map(header => {
      const value = row[header.key];
      return escapeCSVField(value != null ? String(value) : "");
    }).join(",");
  });
  
  // Combine header and data rows
  return [headerRow, ...dataRows].join("\n");
}

/**
 * Escape CSV field value
 */
function escapeCSVField(field: string): string {
  if (field == null) return "";
  
  const str = String(field);
  
  // If field contains comma, quote, or newline, wrap in quotes and escape quotes
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  
  return str;
}

/**
 * Download CSV file
 */
export function downloadCSV(content: string, filename: string): void {
  // Add BOM for proper UTF-8 encoding (especially for Cyrillic characters)
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
  
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";
  
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Export data to CSV file
 */
export function exportToCSV<T extends Record<string, any>>(
  data: T[],
  headers: Array<{ key: keyof T; label: string }>,
  filename: string
): void {
  const csvContent = convertToCSV(data, headers);
  downloadCSV(csvContent, filename);
}

/**
 * Format date for CSV export
 */
export function formatDateForCSV(date: string | Date | null | undefined): string {
  if (!date) return "";
  
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0]; // YYYY-MM-DD format
  } catch {
    return "";
  }
}

/**
 * Format number for CSV export
 */
export function formatNumberForCSV(value: number | string | null | undefined): string {
  if (value == null) return "";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "";
  return String(num);
}
