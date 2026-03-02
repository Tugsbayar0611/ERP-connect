import { Router } from "express";
import { storage } from "../storage";
import { db } from "../db";
import { sql, eq, and, desc } from "drizzle-orm";
import { z } from "zod";
import { format } from "date-fns";
import {
  insertInvoiceSchema, insertInvoiceLineSchema,
  insertCurrencySchema, insertAccountSchema, insertJournalSchema, insertJournalEntrySchema, insertJournalLineSchema,
  insertTaxCodeSchema, insertPaymentSchema,
  type DbInsertInvoice, type DbInsertInvoiceLine,
  type DbInsertCurrency, type DbInsertAccount, type DbInsertJournal, type DbInsertJournalEntry, type DbInsertJournalLine,
  type DbInsertTaxCode, type DbInsertPayment,
  accounts, journalLines, taxCodes, bankAccounts,
  insertContactSchema, type DbInsertContact
} from "@shared/schema";
import { createAuditLog, getAuditContext } from "../audit-log";
import { requirePermission } from "../permissions";
import { logRBACEvent } from "../rbac-audit";
import { requireTenant, requireTenantAndPermission, getCurrentUserContext } from "../middleware";

const router = Router();
const app = router; // Alias for code compatibility

// --- QPay Webhook ---
app.post("/api/payments/qpay/webhook", async (req: any, res) => {
  try {
    const { t: tenantKey, inv: invoiceId } = req.query;
    if (!tenantKey || !invoiceId) {
      return res.status(400).json({ message: "Missing tenant or invoice parameter" });
    }

    const qpayInvoice = await storage.getQPayInvoiceByInvoiceId(invoiceId as string);
    if (!qpayInvoice) {
      return res.status(404).json({ message: "QPay invoice link not found" });
    }

    const settings = await storage.getQPaySettings(qpayInvoice.tenantId);
    if (!settings || !settings.enabled) {
      return res.status(400).json({ message: "QPay is not enabled for this tenant" });
    }

    // Create QPay service
    const { createQPayService } = await import("../qpay-service");
    const qpayService = await createQPayService(qpayInvoice.tenantId, storage);

    if (!qpayService || !qpayService.isConfigured()) {
      return res.status(400).json({ message: "QPay service is not properly configured" });
    }

    // Verify webhook signature if callbackSecret is configured
    if (settings.callbackSecret) {
      const signature = req.headers["x-qpay-signature"] || req.query.signature;
      const payload = JSON.stringify(req.body);

      if (signature && !qpayService.verifyWebhookSignature(signature, payload)) {
        console.warn("QPay webhook signature verification failed");
        return res.status(401).json({ message: "Invalid signature" });
      }
    }

    // Idempotency check
    if (qpayInvoice.paymentId) {
      return res.json({ status: "OK", message: "Already processed" });
    }

    // Check payment status from QPay
    if (!qpayInvoice.qpayInvoiceId) {
      return res.status(400).json({ message: "QPay invoice ID not found" });
    }

    const paymentCheckResult = await qpayService.checkPaymentStatus({
      objectType: "INVOICE",
      objectId: qpayInvoice.qpayInvoiceId,
    });

    if (!paymentCheckResult.success || !paymentCheckResult.data) {
      return res.status(500).json({
        message: paymentCheckResult.error || "Failed to check payment status"
      });
    }

    // Find paid payment
    const paidPayment = paymentCheckResult.data.rows.find(
      (p) => p.paymentStatus === "PAID"
    );

    if (!paidPayment) {
      return res.json({ status: "NOT_PAID" });
    }

    // Payment is confirmed, create payment record
    const invoice = await storage.getInvoice(invoiceId as string);
    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Create payment
    const payment = await storage.createPayment({
      tenantId: qpayInvoice.tenantId,
      invoiceId: invoiceId as string,
      paymentDate: new Date(paidPayment.paymentDate).toISOString().split("T")[0],
      amount: paidPayment.paymentAmount.toString(),
      currencyCode: paidPayment.paymentCurrency || "MNT",
      paymentMethod: "qr_code",
      reference: paidPayment.paymentId,
      status: "completed",
    } as any);

    // Attach payment to QPay invoice
    await storage.attachPaymentToQPayInvoice(qpayInvoice.id, payment.id);

    // Allocate payment to invoice
    await storage.createPaymentAllocation(
      payment.id,
      invoiceId as string,
      paidPayment.paymentAmount,
      new Date(paidPayment.paymentDate).toISOString().split("T")[0]
    );

    // Update invoice status if fully paid
    const totalPaid = parseFloat(invoice.paidAmount?.toString() || "0") + paidPayment.paymentAmount;
    if (totalPaid >= parseFloat(invoice.totalAmount.toString())) {
      await storage.updateInvoiceStatus(invoiceId as string, "paid", totalPaid);
    } else {
      await storage.updateInvoiceStatus(invoiceId as string, invoice.status, totalPaid);
    }

    // Auto-posting if enabled
    if (settings.autoPosting) {
      const { postDocument } = await import("../posting-engine");
      try {
        await postDocument(qpayInvoice.tenantId, "payment", payment.id);
      } catch (postError) {
        console.error("Auto-posting failed:", postError);
        // Don't fail the webhook if posting fails
      }
    }

    res.json({
      status: "OK",
      message: "Payment processed successfully",
      paymentId: payment.id
    });
  } catch (err: any) {
    console.error("QPay webhook error:", err);
    res.status(500).json({ message: err.message || "Error processing webhook" });
  }
});


// --- Invoices ---
app.get("/api/invoices", requireTenant, async (req: any, res) => {
  const type = req.query.type as string | undefined;
  const invoices = await storage.getInvoices(req.tenantId, type);
  res.json(invoices);
});

// Get unpaid invoices (for reconciliation matching) - MUST be before /:id route
app.get("/api/invoices/unpaid", requireTenant, async (req: any, res) => {
  try {
    const type = req.query.type as string | undefined; // 'sales' or 'purchase'
    const invoices = await storage.getUnpaidInvoices(req.tenantId, type);
    res.json(invoices);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error fetching unpaid invoices" });
  }
});

app.get("/api/invoices/:id", requireTenant, async (req: any, res) => {
  const invoice = await storage.getInvoice(req.params.id);
  if (!invoice || invoice.tenantId !== req.tenantId) {
    return res.status(404).json({ message: "Invoice not found" });
  }
  res.json(invoice);
});

const invoiceSchema = z.object({
  contactId: z.string(),
  salesOrderId: z.string().optional(),
  branchId: z.string().optional(),
  invoiceDate: z.string(),
  dueDate: z.string(),
  type: z.enum(["sales", "purchase"]).default("sales"),
  paymentMethod: z.string().optional(),
  notes: z.string().optional(),
  lines: z.array(z.object({
    productId: z.string().optional(),
    description: z.string(),
    quantity: z.number().or(z.string()),
    unitPrice: z.number().or(z.string()),
    taxRate: z.number().or(z.string()).optional()
  }))
});

app.post("/api/invoices", requireTenantAndPermission, async (req: any, res) => {
  try {
    const data = invoiceSchema.parse(req.body);

    // Use concurrency-safe numbering
    const { getNextInvoiceNumber } = await import("../numbering");
    const invoiceDate = new Date(data.invoiceDate);
    const invoiceNumber = await getNextInvoiceNumber(
      req.tenantId,
      data.branchId || null,
      invoiceDate.getFullYear()
    );

    let subtotal = 0;
    const lines: Omit<DbInsertInvoiceLine, 'invoiceId'>[] = data.lines.map((line: any) => {
      const qty = Number(line.quantity);
      const price = Number(line.unitPrice);
      const taxRate = Number(line.taxRate || 10);

      const lineSubtotal = qty * price;
      const lineTax = lineSubtotal * (taxRate / 100);
      const lineTotal = lineSubtotal + lineTax;

      subtotal += lineSubtotal;

      return {
        tenantId: req.tenantId,
        productId: line.productId,
        description: line.description,
        quantity: qty.toString(),
        unitPrice: price.toString(),
        taxRate: taxRate.toString(),
        subtotal: lineSubtotal.toString(),
        taxAmount: lineTax.toString(),
        total: lineTotal.toString()
      };
    });

    const taxAmount = subtotal * 0.1;
    const totalAmount = subtotal + taxAmount;

    const invoice = await storage.createInvoice({
      tenantId: req.tenantId,
      branchId: data.branchId,
      contactId: data.contactId,
      salesOrderId: data.salesOrderId,
      invoiceNumber,
      invoiceDate: data.invoiceDate,
      dueDate: data.dueDate,
      type: data.type,
      status: "draft",
      subtotal: subtotal.toString(),
      taxAmount: taxAmount.toString(),
      totalAmount: totalAmount.toString(),
      paidAmount: "0",
      paymentMethod: data.paymentMethod,
      notes: data.notes,
      createdBy: req.user.id
    } as DbInsertInvoice, lines);

    // Audit log
    await createAuditLog(
      getAuditContext(req),
      "invoice",
      invoice.id,
      "create",
      undefined,
      invoice,
      `Invoice ${invoiceNumber} created`
    );

    res.status(201).json(invoice);
  } catch (err) {
    console.error("Invoice Error:", err);
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: "Validation Error", details: err.errors });
    } else {
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
});

app.put("/api/invoices/:id/status", requireTenantAndPermission, async (req: any, res) => {
  try {
    const { status, paidAmount } = req.body;
    const invoiceId = req.params.id;

    // Get invoice before update to check if it's becoming "paid"
    const invoiceBefore = await storage.getInvoice(invoiceId);
    const wasPaid = invoiceBefore?.status === "paid";

    await storage.updateInvoiceStatus(invoiceId, status, paidAmount);

    // Auto-send to E-barimt if status changed to "paid" and auto_send is enabled
    if (status === "paid" && !wasPaid) {
      try {
        const ebarimtSettings = await storage.getEBarimtSettings(req.tenantId);

        if (ebarimtSettings?.enabled && ebarimtSettings?.autoSend) {
          // Create E-barimt service and send invoice
          const { createEBarimtService } = await import("../ebarimt-service");
          const ebarimtService = await createEBarimtService(req.tenantId, storage);

          if (ebarimtService && ebarimtService.isConfigured()) {
            // Check if already sent
            const invoiceForEbarimt = await storage.getInvoice(invoiceId);
            if (!invoiceForEbarimt?.ebarimtDocumentId) {
              const invoiceData = await ebarimtService.prepareInvoiceData(invoiceId, req.tenantId);
              const result = await ebarimtService.sendInvoice(invoiceData);

              if (result.success) {
                await storage.updateInvoiceEBarimt(
                  invoiceId,
                  result.documentId || "",
                  result.qrCode,
                  result.receiptNumber,
                  result.lotteryNumber
                );
                console.log(`✅ Auto-sent invoice ${invoiceId} to E-barimt`);
              } else {
                console.warn(`⚠️  Failed to auto-send invoice ${invoiceId} to E-barimt:`, result.error);
              }
            }
          }
        }
      } catch (ebarimtError: any) {
        // Don't fail the status update if E-barimt fails
        console.error("E-barimt auto-send error:", ebarimtError);
      }
    }

    // Audit log (after all updates)
    const invoiceAfterUpdate = await storage.getInvoice(invoiceId);
    await createAuditLog(
      getAuditContext(req),
      "invoice",
      invoiceId,
      "update",
      invoiceBefore,
      invoiceAfterUpdate,
      `Invoice status changed to ${status}`
    );

    res.json({ message: "Invoice status updated" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating invoice status" });
  }
});

app.delete("/api/invoices/:id", requireTenantAndPermission, async (req: any, res) => {
  try {
    const invoiceId = req.params.id;
    const invoice = await storage.getInvoice(invoiceId);

    if (!invoice || invoice.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.status !== "draft") {
      return res.status(400).json({ message: "Only draft invoices can be deleted. Use Void for active invoices." });
    }

    await storage.deleteInvoice(invoiceId);

    // Audit log
    await createAuditLog(
      getAuditContext(req),
      "invoice",
      invoiceId,
      "delete",
      invoice,
      null,
      `Invoice ${invoice.invoiceNumber} deleted`
    );

    res.status(204).send();
  } catch (err: any) {
    console.error("Delete invoice error:", err);
    res.status(500).json({ message: err.message || "Error deleting invoice" });
  }
});

// ==========================================
// E-BARIMT INTEGRATION (QPay-тэй ижил загвар)
// ==========================================

// --- E-barimt Settings ---
app.get("/api/ebarimt/settings", requireTenant, async (req: any, res) => {
  try {
    const settings = await storage.getEBarimtSettings(req.tenantId);
    if (!settings) {
      return res.json({
        enabled: false,
        mode: "sandbox",
        posEndpoint: null,
        apiKey: null,
        apiSecret: null,
        autoSend: false,
      });
    }
    // Mask secrets in response
    const response = { ...settings };
    if (response.apiSecret) response.apiSecret = "********";
    res.json(response);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error fetching E-barimt settings" });
  }
});

app.put("/api/ebarimt/settings", requireTenantAndPermission, async (req: any, res) => {
  try {
    const { apiSecret, ...rest } = req.body;
    const existing = await storage.getEBarimtSettings(req.tenantId);

    // Only update secret if provided (not masked)
    const updateData: any = { ...rest };
    if (apiSecret && apiSecret !== "********") {
      updateData.apiSecret = apiSecret;
    } else if (existing && apiSecret === "********") {
      updateData.apiSecret = existing.apiSecret;
    }

    const settings = await storage.updateEBarimtSettings(req.tenantId, updateData);
    const response = { ...settings };
    if (response.apiSecret) response.apiSecret = "********";
    res.json(response);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error updating E-barimt settings" });
  }
});

// --- E-barimt Send Invoice ---
app.post("/api/invoices/:id/ebarimt", requireTenantAndPermission, async (req: any, res) => {
  try {
    const invoice = await storage.getInvoice(req.params.id);
    if (!invoice || invoice.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    // Get E-barimt settings
    const settings = await storage.getEBarimtSettings(req.tenantId);
    if (!settings || !settings.enabled) {
      return res.status(400).json({ message: "E-barimt is not enabled" });
    }

    // Create E-barimt service with provider
    const { createEBarimtService, EBarimtService } = await import("../ebarimt-service");
    const ebarimtService = await createEBarimtService(req.tenantId, storage);

    if (!ebarimtService || !ebarimtService.isConfigured()) {
      return res.status(400).json({
        message: "E-barimt service is not configured. Please configure in Settings."
      });
    }

    // Prepare invoice data
    const invoiceData = await ebarimtService.prepareInvoiceData(req.params.id, req.tenantId);

    // Send to E-barimt using provider
    const result = await ebarimtService.sendInvoice(invoiceData);

    if (!result.success) {
      return res.status(500).json({
        message: result.error || "Failed to send invoice to E-barimt",
        errorCode: result.errorCode
      });
    }

    // Store E-barimt document ID in invoice table
    await storage.updateInvoiceEBarimt(
      req.params.id,
      result.documentId || "",
      result.qrCode,
      result.receiptNumber,
      result.lotteryNumber
    );

    res.json({
      success: true,
      documentId: result.documentId,
      qrCode: result.qrCode,
      receiptNumber: result.receiptNumber,
      lotteryNumber: result.lotteryNumber,
      message: "Invoice successfully sent to E-barimt",
    });
  } catch (err: any) {
    console.error("E-barimt error:", err);
    res.status(500).json({ message: err.message || "Error sending invoice to E-barimt" });
  }
});

// E-barimt Verify
app.get("/api/invoices/:id/ebarimt/verify", requireTenant, async (req: any, res) => {
  try {
    const invoice = await storage.getInvoice(req.params.id);
    if (!invoice || invoice.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const { createEBarimtService } = await import("../ebarimt-service");
    const ebarimtService = await createEBarimtService(req.tenantId, storage);

    if (!ebarimtService || !ebarimtService.isConfigured()) {
      return res.status(400).json({ message: "E-barimt service is not configured" });
    }

    // Get document ID from invoice
    const documentId = invoice.ebarimtDocumentId || (req.query.documentId as string);
    if (!documentId) {
      return res.status(400).json({ message: "Document ID is required. Invoice has not been sent to E-barimt." });
    }

    const result = await ebarimtService.verifyInvoice(documentId);
    res.json(result);
  } catch (err: any) {
    console.error("E-barimt verify error:", err);
    res.status(500).json({ message: err.message || "Error verifying invoice" });
  }
});

// --- Padan PDF Endpoints ---
// Generate Dispatch Padan PDF (Зарлагын Падан) for Sales Invoice
// RBAC: Invoice read/view permission required (Sales, Accounting, Warehouse, Admin roles)
// Note: For read operations, we allow if user has invoice.read OR invoice.view OR is Admin/Sales/Accounting/Warehouse role
app.get("/api/invoices/:id/padan/dispatch",
  requireTenant,
  requirePermission("invoice", "read"),
  async (req: any, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice || invoice.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (invoice.type !== "sales") {
        return res.status(400).json({ message: "Dispatch Padan can only be generated for sales invoices" });
      }

      // Invoice state check: Allow padan generation for any status (including draft)
      // Policy: User can generate padan anytime, but can mark as "draft" in padan if needed

      // Get tenant info
      const tenant = await storage.getTenant(req.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      // Get contact info
      const contact = await storage.getContact(invoice.contactId);

      // Get warehouse and branch info (if available)
      let warehouseName: string | undefined;
      let branchName: string | undefined;

      // Get warehouse from sales order (if invoice is from sales order)
      if (invoice.salesOrderId) {
        const salesOrder = await storage.getSalesOrder(invoice.salesOrderId);
        if (salesOrder?.warehouseId) {
          const warehouses = await storage.getWarehouses(req.tenantId);
          const warehouse = warehouses.find((w: any) => w.id === salesOrder.warehouseId);
          warehouseName = warehouse?.name;
        }
      }

      if (invoice.branchId) {
        const branches = await storage.getBranches(req.tenantId);
        const branch = branches.find((b: any) => b.id === invoice.branchId);
        branchName = branch?.name;
      }

      // Get products for unit info
      const { products } = await import("@shared/schema");
      const { db } = await import("../db");
      const { eq, and, inArray } = await import("drizzle-orm");

      // Fetch product units for invoice lines
      const productIds = (invoice.lines || [])
        .map((line: any) => line.productId)
        .filter((id: string | null) => id !== null);

      const productUnits: Record<string, string> = {};
      if (productIds.length > 0) {
        const productRows = await db
          .select({ id: products.id, unit: products.unit })
          .from(products)
          .where(inArray(products.id, productIds));
        productRows.forEach((p: any) => {
          productUnits[p.id] = p.unit || "Ширхэг";
        });
      }

      // Get or generate Padan number (idempotent)
      const { getOrGeneratePadanNumber } = await import("../padan-numbering");
      const padanNumber = await getOrGeneratePadanNumber(
        req.tenantId,
        invoice.id,
        "sales",
        "DISPATCH"
      );

      // Prepare Padan PDF data
      // Handle missing address fields gracefully (for backwards compatibility)
      const tenantAddress = (tenant as any).address;
      const tenantDistrict = (tenant as any).district;
      const tenantCity = (tenant as any).city;
      const companyAddress = tenantAddress
        ? `${tenantCity || "Улаанбаатар"}, ${tenantDistrict || ""} дүүрэг, ${tenantAddress}`
        : undefined;

      const padanData = {
        padanNumber: padanNumber,
        padanDate: invoice.invoiceDate || new Date().toISOString().split("T")[0],
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate || "",
        companyName: tenant.legalName || tenant.name,
        companyAddress: companyAddress,
        companyRegNo: tenant.regNo || undefined,
        companyVatNo: tenant.vatNo || undefined,
        contactName: invoice.contactName || contact?.companyName || `${contact?.firstName || ""} ${contact?.lastName || ""}`.trim(),
        contactAddress: contact?.address || undefined,
        contactRegNo: contact?.regNo || undefined,
        contactVatNo: contact?.vatNo || undefined,
        lines: (invoice.lines || []).map((line: any) => {
          const unit = line.productId && productUnits[line.productId] ? productUnits[line.productId] : "Ширхэг";
          return {
            description: line.description || "",
            quantity: parseFloat(line.quantity?.toString() || "0"),
            unit: unit,
            unitPrice: parseFloat(line.unitPrice?.toString() || "0"),
            total: parseFloat(line.total?.toString() || "0"),
          };
        }),
        totalAmount: parseFloat(invoice.totalAmount?.toString() || "0"),
        warehouseName: warehouseName,
        branchName: branchName,
        notes: invoice.notes || undefined,
      };

      // Audit log: Padan generated
      await createAuditLog(
        getAuditContext(req),
        "padan",
        req.params.id,
        "create",
        null,
        {
          type: "dispatch",
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          padanNumber: padanData.padanNumber,
        },
        `Dispatch Padan generated for invoice ${invoice.invoiceNumber}`
      );

      // Return Padan data for client-side PDF generation
      res.json({
        success: true,
        padanData,
        type: "dispatch",
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error generating Padan data" });
    }
  });

// Generate Receipt Padan PDF (Орлогын Падан) for Purchase Invoice
// RBAC: Invoice read/view permission required (Sales, Accounting, Warehouse, Admin roles)
app.get("/api/invoices/:id/padan/receipt",
  requireTenant,
  requirePermission("invoice", "read"),
  async (req: any, res) => {
    try {
      const invoice = await storage.getInvoice(req.params.id);
      if (!invoice || invoice.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Invoice not found" });
      }

      if (invoice.type !== "purchase") {
        return res.status(400).json({ message: "Receipt Padan can only be generated for purchase invoices" });
      }

      // Get tenant info
      const tenant = await storage.getTenant(req.tenantId);
      if (!tenant) {
        return res.status(404).json({ message: "Tenant not found" });
      }

      // Get contact info
      const contact = await storage.getContact(invoice.contactId);

      // Get warehouse and branch info (if available)
      let warehouseName: string | undefined;
      let branchName: string | undefined;

      // Get warehouse from sales order (if invoice is from sales order)
      if (invoice.salesOrderId) {
        const salesOrder = await storage.getSalesOrder(invoice.salesOrderId);
        if (salesOrder?.warehouseId) {
          const warehouses = await storage.getWarehouses(req.tenantId);
          const warehouse = warehouses.find((w: any) => w.id === salesOrder.warehouseId);
          warehouseName = warehouse?.name;
        }
      }

      if (invoice.branchId) {
        const branches = await storage.getBranches(req.tenantId);
        const branch = branches.find((b: any) => b.id === invoice.branchId);
        branchName = branch?.name;
      }

      // Get products for unit info
      const { products } = await import("@shared/schema");
      const { db } = await import("../db");
      const { inArray } = await import("drizzle-orm");

      // Fetch product units for invoice lines
      const productIds = (invoice.lines || [])
        .map((line: any) => line.productId)
        .filter((id: string | null) => id !== null);

      const productUnits: Record<string, string> = {};
      if (productIds.length > 0) {
        const productRows = await db
          .select({ id: products.id, unit: products.unit })
          .from(products)
          .where(inArray(products.id, productIds));
        productRows.forEach((p: any) => {
          productUnits[p.id] = p.unit || "Ширхэг";
        });
      }

      // Get or generate Padan number (idempotent)
      const { getOrGeneratePadanNumber } = await import("../padan-numbering");
      const padanNumber = await getOrGeneratePadanNumber(
        req.tenantId,
        invoice.id,
        "purchase",
        "RECEIPT"
      );

      // Prepare Padan PDF data
      // Handle missing address fields gracefully (for backwards compatibility)
      const tenantAddress = (tenant as any).address;
      const tenantDistrict = (tenant as any).district;
      const tenantCity = (tenant as any).city;
      const companyAddress = tenantAddress
        ? `${tenantCity || "Улаанбаатар"}, ${tenantDistrict || ""} дүүрэг, ${tenantAddress}`
        : undefined;

      const padanData = {
        padanNumber: padanNumber,
        padanDate: invoice.invoiceDate || new Date().toISOString().split("T")[0],
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.invoiceDate || "",
        companyName: tenant.legalName || tenant.name,
        companyAddress: companyAddress,
        companyRegNo: tenant.regNo || undefined,
        companyVatNo: tenant.vatNo || undefined,
        contactName: invoice.contactName || contact?.companyName || `${contact?.firstName || ""} ${contact?.lastName || ""}`.trim(),
        contactAddress: contact?.address || undefined,
        contactRegNo: contact?.regNo || undefined,
        contactVatNo: contact?.vatNo || undefined,
        lines: (invoice.lines || []).map((line: any) => {
          const unit = line.productId && productUnits[line.productId] ? productUnits[line.productId] : "Ширхэг";
          return {
            description: line.description || "",
            quantity: parseFloat(line.quantity?.toString() || "0"),
            unit: unit,
            unitPrice: parseFloat(line.unitPrice?.toString() || "0"),
            total: parseFloat(line.total?.toString() || "0"),
          };
        }),
        totalAmount: parseFloat(invoice.totalAmount?.toString() || "0"),
        warehouseName: warehouseName,
        branchName: branchName,
        notes: invoice.notes || undefined,
      };

      // Audit log: Padan generated
      await createAuditLog(
        getAuditContext(req),
        "padan",
        req.params.id,
        "create",
        null,
        {
          type: "receipt",
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber,
          padanNumber: padanData.padanNumber,
        },
        `Receipt Padan generated for invoice ${invoice.invoiceNumber}`
      );

      // Return Padan data for client-side PDF generation
      res.json({
        success: true,
        padanData,
        type: "receipt",
      });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error generating Padan data" });
    }
  });


// ACCOUNTING API ENDPOINTS
// ==========================================

// --- Currencies ---
app.get("/api/currencies", requireTenant, async (req: any, res) => {
  const currencies = await storage.getCurrencies(req.tenantId);
  res.json(currencies);
});

app.post("/api/currencies", requireTenant, async (req: any, res) => {
  try {
    const input = { ...insertCurrencySchema.parse(req.body), tenantId: req.tenantId } as DbInsertCurrency;
    const currency = await storage.createCurrency(input);
    res.status(201).json(currency);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: "Validation Error", details: err.errors });
    } else {
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
});

// --- Accounts (Chart of Accounts) ---
app.get("/api/accounts", requireTenant, async (req: any, res) => {
  const accounts = await storage.getAccounts(req.tenantId);
  res.json(accounts);
});

app.get("/api/accounts/:id", requireTenant, async (req: any, res) => {
  const account = await storage.getAccount(req.params.id);
  if (!account || account.tenantId !== req.tenantId) {
    return res.status(404).json({ message: "Account not found" });
  }
  res.json(account);
});

app.post("/api/accounts", requireTenantAndPermission, async (req: any, res) => {
  try {
    const input = { ...insertAccountSchema.parse(req.body), tenantId: req.tenantId } as DbInsertAccount;
    const account = await storage.createAccount(input);
    res.status(201).json(account);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: "Validation Error", details: err.errors });
    } else {
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
});

app.put("/api/accounts/:id", requireTenantAndPermission, async (req: any, res) => {
  try {
    const existing = await storage.getAccount(req.params.id);
    if (!existing || existing.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Account not found" });
    }
    const input = insertAccountSchema.partial().parse(req.body);
    const account = await storage.updateAccount(req.params.id, input);
    res.json(account);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error updating account" });
  }
});

// Delete account (with safety check)
app.delete("/api/accounts/:id", requireTenantAndPermission, async (req: any, res) => {
  try {
    const existing = await storage.getAccount(req.params.id);
    if (!existing || existing.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Account not found" });
    }

    // Safety check: Check if account is used in journal_lines
    const journalUsage = await db
      .select({ count: sql<number>`count(*)` })
      .from(journalLines)
      .where(eq(journalLines.accountId, req.params.id));

    if (journalUsage[0]?.count > 0) {
      return res.status(400).json({
        message: "Гүйлгээ хийгдсэн дансыг устгах боломжгүй. Түүний оронд идэвхгүй болгоно уу."
      });
    }

    // Safety check: Check if account is used in bank_accounts
    const bankUsage = await db
      .select({ count: sql<number>`count(*)` })
      .from(bankAccounts)
      .where(eq(bankAccounts.accountId, req.params.id));

    if (bankUsage[0]?.count > 0) {
      return res.status(400).json({
        message: "Банкны данстай холбогдсон дансыг устгах боломжгүй. Түүний оронд идэвхгүй болгоно уу."
      });
    }

    // Safe to delete
    await db.delete(accounts).where(eq(accounts.id, req.params.id));
    res.json({ message: "Account deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error deleting account" });
  }
});

// --- Journals ---

app.get("/api/journals", requireTenant, async (req: any, res) => {
  const journals = await storage.getJournals(req.tenantId);
  res.json(journals);
});

app.get("/api/journals/:id", requireTenant, async (req: any, res) => {
  const journal = await storage.getJournal(req.params.id);
  if (!journal || journal.tenantId !== req.tenantId) {
    return res.status(404).json({ message: "Journal not found" });
  }
  res.json(journal);
});

app.post("/api/journals", requireTenant, async (req: any, res) => {
  try {
    const input = { ...insertJournalSchema.parse(req.body), tenantId: req.tenantId } as DbInsertJournal;
    const journal = await storage.createJournal(input);
    res.status(201).json(journal);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: "Validation Error", details: err.errors });
    } else {
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
});

// --- Journal Entries ---
app.get("/api/journal-entries", requireTenant, async (req: any, res) => {
  const filters = {
    journalId: req.query.journalId as string | undefined,
    status: req.query.status as string | undefined,
    startDate: req.query.startDate as string | undefined,
    endDate: req.query.endDate as string | undefined,
  };
  const entries = await storage.getJournalEntries(req.tenantId, filters);
  res.json(entries);
});

app.get("/api/journal-entries/:id", requireTenant, async (req: any, res) => {
  const entry = await storage.getJournalEntry(req.params.id);
  if (!entry || entry.tenantId !== req.tenantId) {
    return res.status(404).json({ message: "Journal entry not found" });
  }
  res.json(entry);
});

const journalEntrySchema = z.object({
  journalId: z.string().optional(),
  entryDate: z.string(),
  description: z.string().optional(),
  reference: z.string().optional(),
  currencyId: z.string().optional(),
  exchangeRate: z.number().optional(),
  lines: z.array(z.object({
    accountId: z.string(),
    debit: z.number().or(z.string()),
    credit: z.number().or(z.string()),
    amountCurrency: z.number().or(z.string()).optional(),
    currencyId: z.string().optional(),
    currencyRate: z.number().optional(),
    partnerId: z.string().optional(),
    description: z.string().optional(),
    reference: z.string().optional(),
  })).min(1),
});

app.post("/api/journal-entries", requireTenantAndPermission, async (req: any, res) => {
  try {
    const data = journalEntrySchema.parse(req.body);

    // Generate entry number (concurrency-safe)
    const { getNextJournalEntryNumber } = await import("../numbering");
    const entryDateObj = new Date(data.entryDate);
    const entryNumber = await getNextJournalEntryNumber(
      req.tenantId,
      null, // branchId
      entryDateObj.getFullYear()
    );

    const entry = await storage.createJournalEntry(
      {
        tenantId: req.tenantId,
        journalId: data.journalId || null,
        entryNumber,
        entryDate: data.entryDate,
        description: data.description || null,
        reference: data.reference || null,
        currencyId: data.currencyId || null,
        exchangeRate: data.exchangeRate?.toString() || "1.0000",
        status: "draft",
        createdBy: req.user?.id || null,
      } as DbInsertJournalEntry,
      data.lines.map((line: any) => ({
        accountId: line.accountId,
        debit: line.debit.toString(),
        credit: line.credit.toString(),
        amountCurrency: line.amountCurrency?.toString() || null,
        currencyId: line.currencyId || null,
        currencyRate: line.currencyRate?.toString() || "1.0000",
        partnerId: line.partnerId || null,
        description: line.description || null,
        reference: line.reference || null,
      })) as DbInsertJournalLine[]
    );

    res.status(201).json(entry);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: "Validation Error", details: err.errors });
    } else {
      console.error(err);
      res.status(500).json({ message: "Error creating journal entry" });
    }
  }
});

app.put("/api/journal-entries/:id/post", requireTenantAndPermission, async (req: any, res) => {
  try {
    const entryId = req.params.id;
    const entryBefore = await storage.getJournalEntry(entryId);

    await storage.updateJournalEntryStatus(entryId, "posted", req.user?.id);

    // Audit log
    const entryAfter = await storage.getJournalEntry(entryId);
    await createAuditLog(
      getAuditContext(req),
      "journal_entry",
      entryId,
      "post",
      entryBefore,
      entryAfter,
      `Journal entry ${entryAfter?.entryNumber || entryId} posted`
    );

    res.json({ message: "Journal entry posted" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Error posting journal entry" });
  }
});

app.post("/api/journal-entries/:id/reverse", requireTenantAndPermission, async (req: any, res) => {
  try {
    const entryId = req.params.id;
    const entryBefore = await storage.getJournalEntry(entryId);
    const { entryDate, description } = req.body;

    const reversal = await storage.reverseJournalEntry(
      entryId,
      entryDate || new Date().toISOString().split("T")[0],
      description,
      req.user?.id || ""
    );

    // Audit log
    await createAuditLog(
      getAuditContext(req),
      "journal_entry",
      entryId,
      "reverse",
      entryBefore,
      { ...entryBefore, reversedByEntryId: reversal.id },
      `Journal entry ${entryBefore?.entryNumber || entryId} reversed`
    );

    res.status(201).json(reversal);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error reversing journal entry" });
  }
});

// --- Tax Codes ---
app.get("/api/tax-codes", requireTenant, async (req: any, res) => {
  const taxCodes = await storage.getTaxCodes(req.tenantId);
  res.json(taxCodes);
});

app.post("/api/tax-codes", requireTenantAndPermission, async (req: any, res) => {
  try {
    const input = { ...insertTaxCodeSchema.parse(req.body), tenantId: req.tenantId } as DbInsertTaxCode;
    const taxCode = await storage.createTaxCode(input);
    res.status(201).json(taxCode);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: "Validation Error", details: err.errors });
    } else {
      console.error(err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  }
});

// --- Payments ---
app.get("/api/payments", requireTenant, async (req: any, res) => {
  const type = req.query.type as string | undefined;
  const payments = await storage.getPayments(req.tenantId, type);
  res.json(payments);
});

app.get("/api/payments/:id", requireTenant, async (req: any, res) => {
  const payment = await storage.getPayment(req.params.id);
  if (!payment || payment.tenantId !== req.tenantId) {
    return res.status(404).json({ message: "Payment not found" });
  }
  res.json(payment);
});

const paymentSchema = z.object({
  paymentDate: z.string(),
  type: z.enum(["payment", "receipt"]),
  amount: z.number().or(z.string()),
  currencyId: z.string().optional(),
  bankAccountId: z.string().optional(),
  paymentMethod: z.string().optional(),
  reference: z.string().optional(),
});

app.post("/api/payments", requireTenantAndPermission, async (req: any, res) => {
  try {
    const data = paymentSchema.parse(req.body);

    // Generate payment number
    const paymentCount = (await storage.getPayments(req.tenantId)).length;
    const paymentNumber = `PAY-${new Date().getFullYear()}-${String(paymentCount + 1).padStart(4, '0')}`;

    const payment = await storage.createPayment({
      tenantId: req.tenantId,
      paymentNumber,
      paymentDate: data.paymentDate,
      type: data.type,
      amount: data.amount.toString(),
      currencyId: data.currencyId || null,
      bankAccountId: data.bankAccountId || null,
      paymentMethod: data.paymentMethod || null,
      status: "draft",
      reference: data.reference || null,
      createdBy: req.user?.id || null,
    } as DbInsertPayment);

    // Audit log
    await createAuditLog(
      getAuditContext(req),
      "payment",
      payment.id,
      "create",
      undefined,
      payment,
      `Payment ${paymentNumber} created`
    );

    res.status(201).json(payment);
  } catch (err) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: "Validation Error", details: err.errors });
    } else {
      console.error(err);
      res.status(500).json({ message: "Error creating payment" });
    }
  }
});

app.post("/api/payments/:id/allocate", requireTenantAndPermission, async (req: any, res) => {
  try {
    const { invoiceId, amount, allocationDate } = req.body;
    await storage.createPaymentAllocation(req.params.id, invoiceId, parseFloat(amount), allocationDate);
    res.json({ message: "Payment allocated" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error allocating payment" });
  }
});

// ==========================================
// POSTING ENGINE API
// ==========================================

// Preview posting (before actually posting)
app.post("/api/posting/preview", requireTenant, async (req: any, res) => {
  try {
    const { modelType, modelId } = req.body;
    if (!modelType || !modelId) {
      return res.status(400).json({ message: "modelType and modelId are required" });
    }

    const preview = await storage.previewPosting(modelType, modelId);
    res.json(preview);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error previewing posting" });
  }
});

// Post document (create journal entry)
app.post("/api/posting/post", requireTenantAndPermission, async (req: any, res) => {
  try {
    const { modelType, modelId, journalId, entryDate } = req.body;
    if (!modelType || !modelId) {
      return res.status(400).json({ message: "modelType and modelId are required" });
    }

    const journalEntry = await storage.postDocument(
      modelType,
      modelId,
      journalId,
      entryDate,
      req.user?.id
    );

    // Audit log
    await createAuditLog(
      getAuditContext(req),
      modelType,
      modelId,
      "post",
      undefined,
      { journalEntryId: journalEntry.id, entryNumber: journalEntry.entryNumber },
      `${modelType} ${modelId} posted as journal entry ${journalEntry.entryNumber}`
    );

    res.status(201).json(journalEntry);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error posting document" });
  }
});

// ==========================================
// REPORTS API
// ==========================================

// Trial Balance
app.get("/api/reports/trial-balance", requireTenant, async (req: any, res) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await storage.getTrialBalance(
      req.tenantId,
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.json(report);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error generating trial balance" });
  }
});

// Balance Sheet
app.get("/api/reports/balance-sheet", requireTenant, async (req: any, res) => {
  try {
    const { asOfDate } = req.query;
    const report = await storage.getBalanceSheet(
      req.tenantId,
      asOfDate as string | undefined
    );
    res.json(report);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error generating balance sheet" });
  }
});

// Profit & Loss
app.get("/api/reports/profit-and-loss", requireTenant, async (req: any, res) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await storage.getProfitAndLoss(
      req.tenantId,
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.json(report);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error generating profit and loss" });
  }
});

// VAT Report
app.get("/api/reports/vat", requireTenant, async (req: any, res) => {
  try {
    const { startDate, endDate } = req.query;
    const report = await storage.getVATReport(
      req.tenantId,
      startDate as string | undefined,
      endDate as string | undefined
    );
    res.json(report);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error generating VAT report" });
  }
});

// VAT Report Export (Excel/CSV)
app.get("/api/reports/vat/export", requireTenant, async (req: any, res) => {
  try {
    const { startDate, endDate, format = "excel" } = req.query;
    const report = await storage.getVATReport(
      req.tenantId,
      startDate as string | undefined,
      endDate as string | undefined
    );

    const { exportVATReportToExcel, exportVATReportToCSV } = await import("../export-utils");

    if (format === "csv") {
      const csv = exportVATReportToCSV(report);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="vat-report-${report.startDate}-${report.endDate}.csv"`
      );
      res.send("\ufeff" + csv); // BOM for Excel UTF-8 support
    } else {
      const excelBuffer = exportVATReportToExcel(report);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="vat-report-${report.startDate}-${report.endDate}.xlsx"`
      );
      res.send(excelBuffer);
    }
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error exporting VAT report" });
  }
});

// TT-03 Report Export (Official TT-03 format)
app.get("/api/reports/tt03/export", requireTenant, async (req: any, res) => {
  try {
    const { startDate, endDate } = req.query;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: "startDate and endDate are required" });
    }

    // Get VAT report
    const report = await storage.getVATReport(
      req.tenantId,
      startDate as string,
      endDate as string
    );

    // Get tenant info for header
    const tenant = await storage.getTenant(req.tenantId);
    if (!tenant) {
      return res.status(404).json({ message: "Tenant not found" });
    }

    const { exportTT03ReportToExcel } = await import("../export-utils");
    const excelBuffer = exportTT03ReportToExcel(report, {
      name: tenant.name,
      legalName: tenant.legalName || undefined,
      vatNo: tenant.vatNo || undefined,
      address: (tenant as any).address || undefined,
      district: (tenant as any).district || undefined,
      city: (tenant as any).city || undefined,
    });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="tt03-report-${startDate}-${endDate}.xlsx"`
    );
    res.send(excelBuffer);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error exporting TT-03 report" });
  }
});

// НД-7 Report (Ажилтнуудын мэдээлэл)
app.get("/api/reports/nd7", requireTenant, async (req: any, res) => {
  try {
    const { periodStart, periodEnd } = req.query;
    if (!periodStart || !periodEnd) {
      return res.status(400).json({ message: "periodStart and periodEnd are required" });
    }

    const { getND7Report } = await import("../reports");
    const report = await getND7Report(
      req.tenantId,
      periodStart as string,
      periodEnd as string,
      storage
    );
    res.json(report);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error generating НД-7 report" });
  }
});

// НД-7 Report Export (Excel)
app.get("/api/reports/nd7/export", requireTenant, async (req: any, res) => {
  try {
    const { periodStart, periodEnd } = req.query;
    if (!periodStart || !periodEnd) {
      return res.status(400).json({ message: "periodStart and periodEnd are required" });
    }

    const { getND7Report } = await import("../reports");
    const { exportND7ReportToExcel } = await import("../export-utils");

    const report = await getND7Report(
      req.tenantId,
      periodStart as string,
      periodEnd as string,
      storage
    );

    const excelBuffer = exportND7ReportToExcel(report);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nd7-report-${periodStart}-${periodEnd}.xlsx"`
    );
    res.send(excelBuffer);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error exporting НД-7 report" });
  }
});

// НД-8 Report (Цалингийн мэдээлэл)
app.get("/api/reports/nd8", requireTenant, async (req: any, res) => {
  try {
    const { periodStart, periodEnd } = req.query;
    if (!periodStart || !periodEnd) {
      return res.status(400).json({ message: "periodStart and periodEnd are required" });
    }

    const { getND8Report } = await import("../reports");
    const report = await getND8Report(
      req.tenantId,
      periodStart as string,
      periodEnd as string,
      storage
    );
    res.json(report);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error generating НД-8 report" });
  }
});

// НД-8 Report Export (Excel)
app.get("/api/reports/nd8/export", requireTenant, async (req: any, res) => {
  try {
    const { periodStart, periodEnd } = req.query;
    if (!periodStart || !periodEnd) {
      return res.status(400).json({ message: "periodStart and periodEnd are required" });
    }

    const { getND8Report } = await import("../reports");
    const { exportND8ReportToExcel } = await import("../export-utils");

    const report = await getND8Report(
      req.tenantId,
      periodStart as string,
      periodEnd as string,
      storage
    );

    const excelBuffer = exportND8ReportToExcel(report);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="nd8-report-${periodStart}-${periodEnd}.xlsx"`
    );
    res.send(excelBuffer);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error exporting НД-8 report" });
  }
});

// ==========================================
// BANK STATEMENTS API
// ==========================================

// Get Bank Accounts
app.get("/api/bank-accounts", requireTenant, async (req: any, res) => {
  try {
    const accounts = await storage.getBankAccounts(req.tenantId);
    res.json(accounts);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error fetching bank accounts" });
  }
});

// Create Bank Account
app.post("/api/bank-accounts", requireTenant, async (req: any, res) => {

  try {
    const { bankName, accountNumber, balance } = req.body;

    if (!bankName || !accountNumber) {
      return res.status(400).json({ message: "Банкны нэр болон дансны дугаар шаардлагатай" });
    }

    const bankAccount = await storage.createBankAccount({
      tenantId: req.tenantId,
      bankName,
      accountNumber,
      balance: balance || "0",
    });

    res.status(201).json(bankAccount);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error creating bank account" });
  }
});

// Get Bank Statements

app.get("/api/bank-statements", requireTenant, async (req: any, res) => {
  try {
    const bankAccountId = req.query.bankAccountId as string | undefined;
    const statements = await storage.getBankStatements(req.tenantId, bankAccountId);
    res.json(statements);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error fetching bank statements" });
  }
});

// Get Bank Statement with Lines
app.get("/api/bank-statements/:id", requireTenant, async (req: any, res) => {
  try {
    const statement = await storage.getBankStatement(req.params.id);
    if (!statement || statement.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Bank statement not found" });
    }
    const lines = await storage.getBankStatementLines(req.params.id);
    res.json({ ...statement, lines });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error fetching bank statement" });
  }
});

// Import Bank Statement from Excel/CSV
app.post("/api/bank-statements/import", requireTenantAndPermission, async (req: any, res) => {
  try {
    const { bankAccountId, fileData, fileName } = req.body;

    if (!bankAccountId) {
      return res.status(400).json({ message: "Bank account ID is required" });
    }

    if (!fileData) {
      return res.status(400).json({ message: "File data is required" });
    }

    // Verify bank account exists and belongs to tenant
    const bankAccount = await storage.getBankAccount(bankAccountId);
    if (!bankAccount || bankAccount.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Bank account not found" });
    }

    // Parse file based on extension
    const {
      parseBankStatementExcel,
      parseBankStatementCSV,
      detectBankFormat,
      parseKhanBankExcel,
      parseGolomtBankExcel,
      parseTDBBankExcel
    } = await import("../import-utils");
    let parsed: any;

    if (fileName?.endsWith(".xlsx") || fileName?.endsWith(".xls")) {
      // Excel file - fileData should be base64
      const buffer = Buffer.from(fileData, "base64");

      // Detect bank format and use appropriate parser
      const bankFormat = detectBankFormat(buffer);

      if (bankFormat === "khan") {
        parsed = parseKhanBankExcel(buffer);
      } else if (bankFormat === "golomt") {
        parsed = parseGolomtBankExcel(buffer);
      } else if (bankFormat === "tdb") {
        parsed = parseTDBBankExcel(buffer);
      } else {
        // Fallback to generic parser
        parsed = parseBankStatementExcel(buffer);
      }
    } else if (fileName?.endsWith(".csv")) {
      // CSV file - fileData should be text
      parsed = parseBankStatementCSV(fileData);
    } else {
      return res.status(400).json({ message: "Unsupported file format. Please use Excel (.xlsx, .xls) or CSV (.csv)" });
    }

    // Create bank statement
    const statement = await storage.createBankStatement(
      {
        tenantId: req.tenantId,
        bankAccountId,
        statementDate: parsed.statementDate,
        openingBalance: parsed.openingBalance.toString(),
        closingBalance: parsed.closingBalance.toString(),
        importedBy: req.user?.id || null,
      },
      parsed.lines
    );

    res.status(201).json({
      ...statement,
      lines: parsed.lines,
      message: `Successfully imported ${parsed.lines.length} transactions`,
    });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error importing bank statement" });
  }
});

// ==========================================
// BANK RECONCILIATION API
// ==========================================

// Get unreconciled bank statement lines
app.get("/api/bank-statement-lines/unreconciled", requireTenant, async (req: any, res) => {
  try {
    const bankAccountId = req.query.bankAccountId as string | undefined;
    const lines = await storage.getUnreconciledBankLines(req.tenantId, bankAccountId);
    res.json(lines);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error fetching unreconciled lines" });
  }
});

// Get all reconciliations

app.get("/api/reconciliations", requireTenant, async (req: any, res) => {
  try {
    const status = req.query.status as string | undefined;
    const recs = await storage.getReconciliations(req.tenantId, status);
    res.json(recs);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error fetching reconciliations" });
  }
});

// Create reconciliation and match with invoice
app.post("/api/reconciliations", requireTenantAndPermission, async (req: any, res) => {
  try {
    const { statementLineId, invoiceId, matchedAmount, notes } = req.body;

    if (!statementLineId) {
      return res.status(400).json({ message: "Statement line ID is required" });
    }
    if (!invoiceId) {
      return res.status(400).json({ message: "Invoice ID is required" });
    }
    if (!matchedAmount || matchedAmount <= 0) {
      return res.status(400).json({ message: "Matched amount must be greater than 0" });
    }

    // Create reconciliation
    const rec = await storage.createReconciliation({
      tenantId: req.tenantId,
      statementLineId,
      status: "draft",
      notes,
    });

    // Add match
    const today = new Date().toISOString().split("T")[0];
    await storage.addReconciliationMatch({
      reconciliationId: rec.id,
      invoiceId,
      matchedAmount,
      matchDate: today,
      notes,
    });

    res.status(201).json(rec);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error creating reconciliation" });
  }
});

// Add match to existing reconciliation
app.post("/api/reconciliations/:id/matches", requireTenantAndPermission, async (req: any, res) => {
  try {
    const { invoiceId, paymentId, journalLineId, matchedAmount, notes } = req.body;

    if (!matchedAmount || matchedAmount <= 0) {
      return res.status(400).json({ message: "Matched amount must be greater than 0" });
    }

    const today = new Date().toISOString().split("T")[0];
    const match = await storage.addReconciliationMatch({
      reconciliationId: req.params.id,
      invoiceId,
      paymentId,
      journalLineId,
      matchedAmount,
      matchDate: today,
      notes,
    });

    res.status(201).json(match);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error adding reconciliation match" });
  }
});

// Get reconciliation matches
app.get("/api/reconciliations/:id/matches", requireTenant, async (req: any, res) => {
  try {
    const matches = await storage.getReconciliationMatches(req.params.id);
    res.json(matches);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error fetching reconciliation matches" });
  }
});

// Confirm/Complete reconciliation
app.put("/api/reconciliations/:id/confirm", requireTenantAndPermission, async (req: any, res) => {
  try {
    const rec = await storage.confirmReconciliation(req.params.id, req.user?.id);
    res.json(rec);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error confirming reconciliation" });
  }
});


// TAX CODES API
// ==========================================

app.get("/api/tax-codes", requireTenant, async (req: any, res) => {
  try {
    const allTaxCodes = await db.select().from(taxCodes).where(eq(taxCodes.tenantId, req.tenantId));
    res.json(allTaxCodes);
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error fetching tax codes" });
  }
});

app.post("/api/tax-codes", requireTenantAndPermission, async (req: any, res) => {
  try {
    const input = { ...insertTaxCodeSchema.parse(req.body), tenantId: req.tenantId };

    if (input.isDefault) {
      await db.update(taxCodes)
        .set({ isDefault: false })
        .where(eq(taxCodes.tenantId, req.tenantId));
    }

    const [taxCode] = await db.insert(taxCodes).values(input).returning();

    // Audit log
    await createAuditLog(
      getAuditContext(req),
      "other",
      taxCode.id,
      "create",
      undefined,
      taxCode,
      `Tax code ${taxCode.code} created`
    );

    res.status(201).json(taxCode);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: "Validation Error", details: err.errors });
    } else {
      console.error(err);
      res.status(500).json({ message: err.message || "Error creating tax code" });
    }
  }
});

app.patch("/api/tax-codes/:id/default", requireTenantAndPermission, async (req: any, res) => {
  try {
    const { id } = req.params;
    const { isDefault } = req.body;

    await db.transaction(async (tx) => {
      if (isDefault) {
        await tx.update(taxCodes)
          .set({ isDefault: false })
          .where(eq(taxCodes.tenantId, req.tenantId));
      }

      await tx.update(taxCodes)
        .set({ isDefault: isDefault })
        .where(and(eq(taxCodes.id, id), eq(taxCodes.tenantId, req.tenantId)));
    });

    res.json({ message: "Default tax code updated" });
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error updating default tax code" });
  }
});

app.put("/api/tax-codes/:id", requireTenantAndPermission, async (req: any, res) => {
  try {
    // Validate ownership
    const existing = await db.select().from(taxCodes).where(and(eq(taxCodes.id, req.params.id), eq(taxCodes.tenantId, req.tenantId))).limit(1);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ message: "Tax code not found" });
    }

    const input = insertTaxCodeSchema.partial().parse(req.body);

    // If setting default, unset others
    if (input.isDefault) {
      await db.update(taxCodes)
        .set({ isDefault: false })
        .where(eq(taxCodes.tenantId, req.tenantId));
    }

    const [updated] = await db.update(taxCodes)
      .set({ ...input })
      .where(and(eq(taxCodes.id, req.params.id), eq(taxCodes.tenantId, req.tenantId)))
      .returning();

    // Audit log
    await createAuditLog(
      getAuditContext(req),
      "other",
      req.params.id,
      "update",
      existing[0],
      updated,
      `Tax code ${updated.code} updated`
    );

    res.json(updated);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ message: "Validation Error", details: err.errors });
    } else {
      console.error(err);
      res.status(500).json({ message: err.message || "Error updating tax code" });
    }
  }
});

app.delete("/api/tax-codes/:id", requireTenantAndPermission, async (req: any, res) => {
  try {
    const existing = await db.select().from(taxCodes).where(and(eq(taxCodes.id, req.params.id), eq(taxCodes.tenantId, req.tenantId))).limit(1);
    if (!existing || existing.length === 0) {
      return res.status(404).json({ message: "Tax code not found" });
    }

    await db.delete(taxCodes)
      .where(and(eq(taxCodes.id, req.params.id), eq(taxCodes.tenantId, req.tenantId)));

    // Audit log
    await createAuditLog(
      getAuditContext(req),
      "other",
      req.params.id,
      "delete",
      existing[0],
      undefined,
      `Tax code ${existing[0].code} deleted`
    );

    res.status(204).send();
  } catch (err: any) {
    console.error(err);
    res.status(500).json({ message: err.message || "Error deleting tax code" });
  }
});

// ==========================================


export default router;
