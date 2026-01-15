import { useEffect, useState } from "react";
import { useRoute } from "wouter";
import { format } from "date-fns";

const formatMNT = (value: number | string) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "0";
  return new Intl.NumberFormat("mn-MN", {
    style: "decimal",
    maximumFractionDigits: 0,
  }).format(num);
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case "draft": return "Ноорог";
    case "sent": return "Илгээсэн";
    case "posted": return "Бүртгэгдсэн";
    case "paid": return "Төлөгдсөн";
    case "cancelled": return "Цуцлагдсан";
    default: return status;
  }
};

interface InvoiceLine {
  id: string;
  description: string;
  quantity: string;
  unitPrice: string;
  taxRate: string;
  subtotal: string;
  taxAmount: string;
  total: string;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  type: string;
  status: string;
  subtotal: string;
  taxAmount: string;
  totalAmount: string;
  paidAmount: string;
  notes?: string;
  contactName?: string;
  contactPhone?: string;
  contactEmail?: string;
  lines?: InvoiceLine[];
}

interface Company {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  taxId?: string;
}

export default function InvoicePrint() {
  const [, params] = useRoute("/invoices/:id/print");
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch invoice with lines
        const invoiceRes = await fetch(`/api/invoices/${params?.id}`);
        if (!invoiceRes.ok) throw new Error("Нэхэмжлэх олдсонгүй");
        const invoiceData = await invoiceRes.json();
        setInvoice(invoiceData);

        // Fetch company info
        const companyRes = await fetch("/api/company");
        if (companyRes.ok) {
          const companyData = await companyRes.json();
          setCompany(companyData);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (params?.id) {
      fetchData();
    }
  }, [params?.id]);

  // Auto print when loaded
  useEffect(() => {
    if (!loading && invoice && !error) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [loading, invoice, error]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Ачааллаж байна...</p>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-red-600">{error || "Нэхэмжлэх олдсонгүй"}</p>
      </div>
    );
  }

  const totalAmount = parseFloat(invoice.totalAmount || "0");
  const paidAmount = parseFloat(invoice.paidAmount || "0");
  const subtotal = parseFloat(invoice.subtotal || "0");
  const taxAmount = parseFloat(invoice.taxAmount || "0");
  const balance = totalAmount - paidAmount;

  return (
    <div className="invoice-print-container">
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .invoice-print-container, .invoice-print-container * {
            visibility: visible;
          }
          .invoice-print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
        
        .invoice-print-container {
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          font-size: 14px;
          color: #333;
          background: white;
        }
        
        .invoice-header {
          text-align: center;
          margin-bottom: 30px;
        }
        
        .company-name {
          font-size: 24px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .invoice-title {
          font-size: 20px;
          font-weight: bold;
          margin-bottom: 20px;
        }
        
        .invoice-details {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
          margin-bottom: 20px;
          text-align: left;
        }
        
        .invoice-details .label {
          color: #666;
        }
        
        .invoice-details .value {
          font-weight: 500;
          text-align: right;
        }
        
        .contact-section {
          margin-bottom: 30px;
          padding: 15px;
          background: #f9f9f9;
          border-radius: 4px;
        }
        
        .contact-section h3 {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 10px;
        }
        
        .invoice-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        
        .invoice-table th {
          background: #f5f5f5;
          padding: 10px 8px;
          text-align: left;
          font-weight: 600;
          border-bottom: 2px solid #ddd;
          font-size: 13px;
        }
        
        .invoice-table th.text-right {
          text-align: right;
        }
        
        .invoice-table th.text-center {
          text-align: center;
        }
        
        .invoice-table td {
          padding: 10px 8px;
          border-bottom: 1px solid #eee;
        }
        
        .invoice-table td.text-right {
          text-align: right;
        }
        
        .invoice-table td.text-center {
          text-align: center;
        }
        
        .summary-section {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 30px;
        }
        
        .summary-table {
          width: 300px;
        }
        
        .summary-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 0;
          border-bottom: 1px solid #eee;
        }
        
        .summary-row.total {
          font-weight: bold;
          font-size: 16px;
          border-bottom: 2px solid #333;
          border-top: 2px solid #333;
          margin-top: 10px;
          padding-top: 10px;
        }
        
        .summary-row .label {
          color: #666;
        }
        
        .summary-row .value {
          font-weight: 500;
        }
        
        .e-receipt-section {
          border: 2px solid #22c55e;
          border-radius: 8px;
          padding: 15px;
          margin-top: 30px;
        }
        
        .e-receipt-section h3 {
          font-size: 14px;
          font-weight: bold;
          margin-bottom: 15px;
          color: #22c55e;
        }
        
        .e-receipt-content {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        
        .e-receipt-info {
          flex: 1;
        }
        
        .e-receipt-info p {
          margin: 5px 0;
        }
        
        .qr-placeholder {
          width: 100px;
          height: 100px;
          background: #f0f0f0;
          display: flex;
          align-items: center;
          justify-content: center;
          border: 1px solid #ddd;
        }
        
        .footer {
          text-align: center;
          margin-top: 40px;
          padding-top: 20px;
          border-top: 1px solid #eee;
          color: #666;
          font-size: 12px;
        }
        
        .print-button {
          position: fixed;
          top: 20px;
          right: 20px;
          padding: 10px 20px;
          background: #2563eb;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        
        .print-button:hover {
          background: #1d4ed8;
        }
      `}</style>

      <button 
        className="print-button no-print" 
        onClick={() => window.print()}
      >
        PDF татах / Хэвлэх
      </button>

      {/* Header */}
      <div className="invoice-header">
        <div className="company-name">{company?.name || "My Organization"}</div>
        <div className="invoice-title">
          НЭХЭМЖЛЭХ ({invoice.type === "sales" ? "БОРЛУУЛАЛТ" : "ХУДАЛДАН АВАЛТ"})
        </div>
      </div>

      {/* Invoice Details */}
      <div className="invoice-details">
        <div>
          <span className="label">Нэхэмжлэхийн дугаар:</span>
        </div>
        <div className="value">{invoice.invoiceNumber}</div>
        
        <div>
          <span className="label">Огноо:</span>
        </div>
        <div className="value">
          {invoice.invoiceDate ? format(new Date(invoice.invoiceDate), "yyyy-MM-dd") : "-"}
        </div>
        
        <div>
          <span className="label">Төлөх хугацаа:</span>
        </div>
        <div className="value">
          {invoice.dueDate ? format(new Date(invoice.dueDate), "yyyy-MM-dd") : "-"}
        </div>
        
        <div>
          <span className="label">Төлөв:</span>
        </div>
        <div className="value">{getStatusLabel(invoice.status)}</div>
      </div>

      {/* Contact Section */}
      <div className="contact-section">
        <h3>Харилцагч:</h3>
        <p><strong>{invoice.contactName || "-"}</strong></p>
        {invoice.contactPhone && <p>{invoice.contactPhone}</p>}
        {invoice.contactEmail && <p>{invoice.contactEmail}</p>}
      </div>

      {/* Items Table */}
      <table className="invoice-table">
        <thead>
          <tr>
            <th style={{ width: "40px" }}>№</th>
            <th>Тайлбар</th>
            <th className="text-center" style={{ width: "60px" }}>Тоо</th>
            <th className="text-right" style={{ width: "100px" }}>Үнэ</th>
            <th className="text-center" style={{ width: "60px" }}>Татвар</th>
            <th className="text-right" style={{ width: "100px" }}>Дүн</th>
            <th className="text-right" style={{ width: "100px" }}>Татварын дүн</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lines && invoice.lines.length > 0 ? (
            invoice.lines.map((line, idx) => (
              <tr key={line.id || idx}>
                <td className="text-center">{idx + 1}</td>
                <td>{line.description}</td>
                <td className="text-center">{formatMNT(line.quantity)}</td>
                <td className="text-right">{formatMNT(line.unitPrice)}</td>
                <td className="text-center">{parseFloat(line.taxRate || "0")}%</td>
                <td className="text-right">{formatMNT(line.subtotal)}</td>
                <td className="text-right">{formatMNT(line.taxAmount)}</td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7} className="text-center" style={{ padding: "20px", color: "#666" }}>
                Мөр байхгүй
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Summary Section */}
      <div className="summary-section">
        <div className="summary-table">
          <div className="summary-row">
            <span className="label">Дэд дүн:</span>
            <span className="value">{formatMNT(subtotal)}</span>
          </div>
          <div className="summary-row">
            <span className="label">ХХОАТ (10%):</span>
            <span className="value">{formatMNT(taxAmount)}</span>
          </div>
          <div className="summary-row total">
            <span className="label">Нийт дүн:</span>
            <span className="value">{formatMNT(totalAmount)}</span>
          </div>
          <div className="summary-row">
            <span className="label">Төлсөн дүн:</span>
            <span className="value">{formatMNT(paidAmount)}</span>
          </div>
          <div className="summary-row">
            <span className="label">Үлдэгдэл:</span>
            <span className="value" style={{ color: balance > 0 ? "#dc2626" : "#16a34a" }}>
              {formatMNT(balance)}
            </span>
          </div>
        </div>
      </div>

      {/* E-Receipt Section */}
      <div className="e-receipt-section">
        <h3>И-баримтын мэдээлэл</h3>
        <div className="e-receipt-content">
          <div className="e-receipt-info">
            <p><strong>QR код:</strong> {invoice.invoiceNumber}</p>
            <p><strong>Сугалааны дугаар:</strong> RE-{new Date().getFullYear()}-{Math.floor(Math.random() * 10000).toString().padStart(4, '0')}</p>
          </div>
          <div className="qr-placeholder">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <rect width="80" height="80" fill="#f0f0f0"/>
              {/* Simple QR-like pattern */}
              <rect x="10" y="10" width="20" height="20" fill="#333"/>
              <rect x="50" y="10" width="20" height="20" fill="#333"/>
              <rect x="10" y="50" width="20" height="20" fill="#333"/>
              <rect x="35" y="35" width="10" height="10" fill="#333"/>
              <rect x="15" y="15" width="10" height="10" fill="white"/>
              <rect x="55" y="15" width="10" height="10" fill="white"/>
              <rect x="15" y="55" width="10" height="10" fill="white"/>
              <rect x="50" y="50" width="5" height="5" fill="#333"/>
              <rect x="60" y="50" width="5" height="5" fill="#333"/>
              <rect x="55" y="55" width="5" height="5" fill="#333"/>
              <rect x="50" y="60" width="5" height="5" fill="#333"/>
              <rect x="60" y="60" width="10" height="10" fill="#333"/>
            </svg>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="footer">
        <p>Энэ нэхэмжлэх MonERP системээр үүсгэгдсэн</p>
        <p>Үүсгэсэн огноо: {format(new Date(), "yyyy-MM-dd HH:mm")}</p>
      </div>
    </div>
  );
}
