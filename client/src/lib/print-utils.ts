/**
 * Print utilities for tables and data
 */

/**
 * Print table data as HTML
 */
export function printTable(
  title: string,
  headers: string[],
  rows: string[][],
  additionalInfo?: string
): void {
  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>${title}</title>
        <style>
          @media print {
            @page {
              margin: 1cm;
            }
            body {
              margin: 0;
              padding: 0;
            }
          }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            padding: 20px;
            color: #000;
          }
          .header {
            margin-bottom: 20px;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
          }
          .title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 5px;
          }
          .date {
            font-size: 12px;
            color: #666;
          }
          .info {
            margin-bottom: 15px;
            font-size: 14px;
            color: #333;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 12px;
          }
          th {
            background-color: #f5f5f5;
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
            font-weight: bold;
          }
          td {
            border: 1px solid #ddd;
            padding: 6px 8px;
          }
          tr:nth-child(even) {
            background-color: #f9f9f9;
          }
          .footer {
            margin-top: 30px;
            font-size: 10px;
            color: #666;
            text-align: center;
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${title}</div>
          <div class="date">${new Date().toLocaleString('mn-MN', { dateStyle: 'long', timeStyle: 'short' })}</div>
        </div>
        ${additionalInfo ? `<div class="info">${additionalInfo}</div>` : ''}
        <table>
          <thead>
            <tr>
              ${headers.map(h => `<th>${h}</th>`).join('')}
            </tr>
          </thead>
          <tbody>
            ${rows.map(row => `<tr>${row.map(cell => `<td>${escapeHtml(String(cell || ''))}</td>`).join('')}</tr>`).join('')}
          </tbody>
        </table>
        <div class="footer">
          MonERP System - ${new Date().toLocaleDateString('mn-MN')}
        </div>
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
    </html>
  `;

  printWindow.document.write(htmlContent);
  printWindow.document.close();
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

/**
 * Print current page (simple wrapper)
 */
export function printCurrentPage(): void {
  window.print();
}
