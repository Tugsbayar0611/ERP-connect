import type { Express } from "express";
import { type Server } from "http";
import { storage } from "./storage";
import { setupAuth } from "./auth";
import { z } from "zod";
import { 
  insertEmployeeSchema, insertDepartmentSchema, insertAttendanceDaySchema, insertPayrollRunSchema, insertPayslipSchema, 
  insertProductSchema, insertProductCategorySchema, insertContactSchema, insertWarehouseSchema,
  insertSalesOrderSchema, insertSalesOrderLineSchema, insertPurchaseOrderSchema, insertPurchaseOrderLineSchema,
  insertInvoiceSchema, insertInvoiceLineSchema,
  insertCurrencySchema, insertAccountSchema, insertJournalSchema, insertJournalEntrySchema, insertJournalLineSchema,
  insertTaxCodeSchema, insertPaymentSchema,
  type DbInsertEmployee, type DbInsertDepartment, type DbInsertAttendanceDay, type DbInsertPayrollRun, 
  type DbInsertPayslip, type DbInsertDocument, type DbInsertProduct, type DbInsertProductCategory,
  type DbInsertContact, type DbInsertWarehouse, type DbInsertSalesOrder, type DbInsertSalesOrderLine,
  type DbInsertPurchaseOrder, type DbInsertPurchaseOrderLine, type DbInsertInvoice, type DbInsertInvoiceLine,
  type DbInsertCurrency, type DbInsertAccount, type DbInsertJournal, type DbInsertJournalEntry, type DbInsertJournalLine,
  type DbInsertTaxCode, type DbInsertPayment
} from "@shared/schema";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupAuth(app);

  // Helper to ensure tenant context
  const requireTenant = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const tenantId = req.user.tenantId;
    if (!tenantId) return res.status(403).send("No tenant associated with user");
    req.tenantId = tenantId;
    next();
  };

  // --- Employees ---
  app.get("/api/employees", requireTenant, async (req: any, res) => {
    const employees = await storage.getEmployees(req.tenantId);
    res.json(employees);
  });

  app.get("/api/employees/:id", requireTenant, async (req: any, res) => {
    const employee = await storage.getEmployee(req.params.id);
    if (!employee || employee.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Employee not found" });
    }
    res.json(employee);
  });

  app.post("/api/employees", requireTenant, async (req: any, res) => {
    try {
      const input = { ...insertEmployeeSchema.parse(req.body), tenantId: req.tenantId } as DbInsertEmployee;
      const employee = await storage.createEmployee(input);
      res.status(201).json(employee);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.put("/api/employees/:id", requireTenant, async (req: any, res) => {
    try {
      // Validate ownership
      const existing = await storage.getEmployee(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Employee not found" });
      }

      const input = insertEmployeeSchema.partial().parse(req.body); // Allow partial updates
      const employee = await storage.updateEmployee(req.params.id, input);
      res.json(employee);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error updating employee" });
    }
  });

  // --- Departments ---
  app.get("/api/departments", requireTenant, async (req: any, res) => {
    const depts = await storage.getDepartments(req.tenantId);
    res.json(depts);
  });

  app.post("/api/departments", requireTenant, async (req: any, res) => {
    try {
      const input = { ...insertDepartmentSchema.parse(req.body), tenantId: req.tenantId } as DbInsertDepartment;
      const dept = await storage.createDepartment(input);
      res.status(201).json(dept);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  // --- Attendance ---
  app.get("/api/attendance", requireTenant, async (req: any, res) => {
    const att = await storage.getAttendance(req.tenantId);
    res.json(att);
  });

  app.post("/api/attendance", requireTenant, async (req: any, res) => {
    try {
      const input = { ...insertAttendanceDaySchema.parse(req.body), tenantId: req.tenantId } as DbInsertAttendanceDay;
      const att = await storage.createAttendance(input);
      res.status(201).json(att);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  // --- Payroll ---
  app.get("/api/payroll-runs", requireTenant, async (req: any, res) => {
    // Return Payslips (flat list with Period info)
    const payslips = await storage.getAllPayslips(req.tenantId);
    res.json(payslips);
  });

  const payrollSubmissionSchema = z.object({
    employeeId: z.string(),
    periodStart: z.string(), // YYYY-MM-DD
    periodEnd: z.string(),   // YYYY-MM-DD
    paymentDate: z.string(),
    baseSalary: z.number().or(z.string()),
    netSalary: z.number().or(z.string()),
    tax: z.number().or(z.string()).optional(),
    socialInsurance: z.number().or(z.string()).optional(),
    status: z.enum(["Pending", "Processing", "Paid"]),
  });

  app.post("/api/payroll-runs", requireTenant, async (req: any, res) => {
    try {
      const data = payrollSubmissionSchema.parse(req.body);

      // 1. Find or Create Payroll Run (Period)
      let run = await storage.getPayrollRunByPeriod(req.tenantId, data.periodStart, data.periodEnd);

      if (!run) {
        run = await storage.createPayrollRun({
          tenantId: req.tenantId,
          periodStart: data.periodStart,
          periodEnd: data.periodEnd,
          payDate: data.paymentDate,
          status: "draft"
        } as DbInsertPayrollRun);
      }

      // 2. Create Payslip
      const totalDeductions = (Number(data.tax || 0) + Number(data.socialInsurance || 0)).toString();

      const payslip = await storage.createPayslip({
        tenantId: req.tenantId,
        payrollRunId: run.id,
        employeeId: data.employeeId,
        grossPay: data.baseSalary.toString(),
        netPay: data.netSalary.toString(),
        totalDeductions: totalDeductions,
        status: data.status === "Paid" ? "paid" : "draft",
      } as DbInsertPayslip);

      res.status(201).json(payslip);
    } catch (err) {
      console.error("Payroll Error:", err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  // --- Documents ---
  app.get("/api/documents", requireTenant, async (req: any, res) => {
    const docs = await storage.getDocuments(req.tenantId);
    res.json(docs);
  });

  app.post("/api/documents", requireTenant, async (req: any, res) => {
    try {
      const { uploadedBy, ...body } = req.body;
      const input = {
        ...body,
        tenantId: req.tenantId,
        uploadedBy: req.user.id
      } as DbInsertDocument;
      const doc = await storage.createDocument(input);
      res.status(201).json(doc);
    } catch (err) {
      console.error("Document Error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });

  app.delete("/api/documents/:id", requireTenant, async (req: any, res) => {
    const deleted = await storage.deleteDocument(req.params.id, req.tenantId);
    if (!deleted) {
      return res.status(404).json({ message: "Document not found" });
    }
    res.sendStatus(200);
  });

  // --- Stats ---
  app.get("/api/stats", requireTenant, async (req: any, res) => {
    const stats = await storage.getStats(req.tenantId);
    res.json(stats);
  });

  // --- Company Settings (Tenant) ---
  app.get("/api/company", requireTenant, async (req: any, res) => {
    const tenant = await storage.getTenant(req.tenantId);
    if (!tenant) return res.status(404).json({ message: "Tenant not found" });
    res.json(tenant);
  });

  // --- Products ---
  app.get("/api/products", requireTenant, async (req: any, res) => {
    const products = await storage.getProducts(req.tenantId);
    res.json(products);
  });

  app.get("/api/products/:id", requireTenant, async (req: any, res) => {
    const product = await storage.getProduct(req.params.id);
    if (!product || product.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  });

  app.post("/api/products", requireTenant, async (req: any, res) => {
    try {
      const input = { ...insertProductSchema.parse(req.body), tenantId: req.tenantId } as DbInsertProduct;
      const product = await storage.createProduct(input);
      res.status(201).json(product);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.put("/api/products/:id", requireTenant, async (req: any, res) => {
    try {
      const existing = await storage.getProduct(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Product not found" });
      }
      const input = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, input);
      res.json(product);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error updating product" });
    }
  });

  // --- Product Categories ---
  app.get("/api/product-categories", requireTenant, async (req: any, res) => {
    const categories = await storage.getProductCategories(req.tenantId);
    res.json(categories);
  });

  app.post("/api/product-categories", requireTenant, async (req: any, res) => {
    try {
      const input = { ...insertProductCategorySchema.parse(req.body), tenantId: req.tenantId } as any;
      const category = await storage.createProductCategory(input);
      res.status(201).json(category);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  // --- Contacts (CRM) ---
  app.get("/api/contacts", requireTenant, async (req: any, res) => {
    const type = req.query.type as string | undefined;
    const contacts = await storage.getContacts(req.tenantId, type);
    res.json(contacts);
  });

  app.get("/api/contacts/:id", requireTenant, async (req: any, res) => {
    const contact = await storage.getContact(req.params.id);
    if (!contact || contact.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Contact not found" });
    }
    res.json(contact);
  });

  app.post("/api/contacts", requireTenant, async (req: any, res) => {
    try {
      const input = { ...insertContactSchema.parse(req.body), tenantId: req.tenantId } as DbInsertContact;
      const contact = await storage.createContact(input);
      res.status(201).json(contact);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  app.put("/api/contacts/:id", requireTenant, async (req: any, res) => {
    try {
      const existing = await storage.getContact(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Contact not found" });
      }
      const input = insertContactSchema.partial().parse(req.body);
      const contact = await storage.updateContact(req.params.id, input);
      res.json(contact);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error updating contact" });
    }
  });

  // --- Warehouses ---
  app.get("/api/warehouses", requireTenant, async (req: any, res) => {
    const warehouses = await storage.getWarehouses(req.tenantId);
    res.json(warehouses);
  });

  app.post("/api/warehouses", requireTenant, async (req: any, res) => {
    try {
      const input = { ...insertWarehouseSchema.parse(req.body), tenantId: req.tenantId } as DbInsertWarehouse;
      const warehouse = await storage.createWarehouse(input);
      res.status(201).json(warehouse);
    } catch (err) {
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        console.error(err);
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  // --- Stock Levels ---
  app.get("/api/stock-levels", requireTenant, async (req: any, res) => {
    const warehouseId = req.query.warehouseId as string | undefined;
    const levels = await storage.getStockLevels(req.tenantId, warehouseId);
    res.json(levels);
  });

  // --- Sales Orders ---
  app.get("/api/sales-orders", requireTenant, async (req: any, res) => {
    const orders = await storage.getSalesOrders(req.tenantId);
    res.json(orders);
  });

  app.get("/api/sales-orders/:id", requireTenant, async (req: any, res) => {
    const order = await storage.getSalesOrder(req.params.id);
    if (!order || order.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Sales order not found" });
    }
    res.json(order);
  });

  const salesOrderSchema = z.object({
    customerId: z.string(),
    branchId: z.string().optional(),
    warehouseId: z.string().optional(),
    orderDate: z.string(),
    deliveryDate: z.string().optional(),
    notes: z.string().optional(),
    lines: z.array(z.object({
      productId: z.string(),
      quantity: z.number().or(z.string()),
      unitPrice: z.number().or(z.string()),
      discount: z.number().or(z.string()).optional(),
      taxRate: z.number().or(z.string()).optional(),
      description: z.string().optional()
    }))
  });

  app.post("/api/sales-orders", requireTenant, async (req: any, res) => {
    try {
      const data = salesOrderSchema.parse(req.body);
      
      // Generate order number
      const { getNextSalesOrderNumber } = await import("./numbering");
      const orderDate = new Date(data.orderDate);
      const orderNumber = await getNextSalesOrderNumber(
        req.tenantId,
        data.branchId || null,
        orderDate.getFullYear()
      );

      // Calculate totals
      let subtotal = 0;
      let taxTotal = 0;
      const lines: DbInsertSalesOrderLine[] = data.lines.map((line: any) => {
        const qty = Number(line.quantity);
        const price = Number(line.unitPrice);
        const discount = Number(line.discount || 0);
        const taxRate = Number(line.taxRate || 10);
        
        const lineSubtotal = qty * price * (1 - discount / 100);
        const lineTax = lineSubtotal * (taxRate / 100);
        const lineTotal = lineSubtotal + lineTax;
        
        subtotal += lineSubtotal;
        taxTotal += lineTax;
        
        return {
          tenantId: req.tenantId,
          productId: line.productId,
          quantity: qty.toString(),
          unitPrice: price.toString(),
          discount: discount.toString(),
          taxRate: taxRate.toString(),
          subtotal: lineSubtotal.toString(),
          taxAmount: lineTax.toString(),
          total: lineTotal.toString(),
          description: line.description
        };
      });

      const taxAmount = taxTotal;
      const totalAmount = subtotal + taxAmount;

      const order = await storage.createSalesOrder({
        tenantId: req.tenantId,
        branchId: data.branchId,
        warehouseId: data.warehouseId,
        customerId: data.customerId,
        orderNumber,
        orderDate: data.orderDate,
        deliveryDate: data.deliveryDate,
        status: "draft",
        paymentStatus: "unpaid",
        subtotal: subtotal.toString(),
        taxAmount: taxAmount.toString(),
        discountAmount: "0",
        totalAmount: totalAmount.toString(),
        notes: data.notes,
        createdBy: req.user.id
      } as DbInsertSalesOrder, lines);

      res.status(201).json(order);
    } catch (err) {
      console.error("Sales Order Error:", err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  // --- Purchase Orders ---
  app.get("/api/purchase-orders", requireTenant, async (req: any, res) => {
    const orders = await storage.getPurchaseOrders(req.tenantId);
    res.json(orders);
  });

  app.get("/api/purchase-orders/:id", requireTenant, async (req: any, res) => {
    const order = await storage.getPurchaseOrder(req.params.id);
    if (!order || order.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Purchase order not found" });
    }
    res.json(order);
  });

  const purchaseOrderSchema = z.object({
    supplierId: z.string(),
    branchId: z.string().optional(),
    warehouseId: z.string().optional(),
    orderDate: z.string(),
    expectedDate: z.string().optional(),
    notes: z.string().optional(),
    lines: z.array(z.object({
      productId: z.string(),
      quantity: z.number().or(z.string()),
      unitPrice: z.number().or(z.string()),
      discount: z.number().or(z.string()).optional(),
      taxRate: z.number().or(z.string()).optional(),
      description: z.string().optional()
    }))
  });

  app.post("/api/purchase-orders", requireTenant, async (req: any, res) => {
    try {
      const data = purchaseOrderSchema.parse(req.body);
      
      const { getNextPurchaseOrderNumber } = await import("./numbering");
      const orderDate = new Date(data.orderDate);
      const orderNumber = await getNextPurchaseOrderNumber(
        req.tenantId,
        data.branchId || null,
        orderDate.getFullYear()
      );

      let subtotal = 0;
      let taxTotal = 0;
      const lines: DbInsertPurchaseOrderLine[] = data.lines.map((line: any) => {
        const qty = Number(line.quantity);
        const price = Number(line.unitPrice);
        const discount = Number(line.discount || 0);
        const taxRate = Number(line.taxRate || 10);
        
        const lineSubtotal = qty * price * (1 - discount / 100);
        const lineTax = lineSubtotal * (taxRate / 100);
        const lineTotal = lineSubtotal + lineTax;
        
        subtotal += lineSubtotal;
        taxTotal += lineTax;
        
        return {
          tenantId: req.tenantId,
          productId: line.productId,
          quantity: qty.toString(),
          unitPrice: price.toString(),
          discount: discount.toString(),
          taxRate: taxRate.toString(),
          subtotal: lineSubtotal.toString(),
          taxAmount: lineTax.toString(),
          total: lineTotal.toString(),
          description: line.description
        };
      });

      const taxAmount = taxTotal;
      const totalAmount = subtotal + taxAmount;

      const order = await storage.createPurchaseOrder({
        tenantId: req.tenantId,
        branchId: data.branchId,
        warehouseId: data.warehouseId,
        supplierId: data.supplierId,
        orderNumber,
        orderDate: data.orderDate,
        expectedDate: data.expectedDate,
        status: "draft",
        paymentStatus: "unpaid",
        subtotal: subtotal.toString(),
        taxAmount: taxAmount.toString(),
        discountAmount: "0",
        totalAmount: totalAmount.toString(),
        notes: data.notes,
        createdBy: req.user.id
      } as DbInsertPurchaseOrder, lines);

      res.status(201).json(order);
    } catch (err) {
      console.error("Purchase Order Error:", err);
      if (err instanceof z.ZodError) {
        res.status(400).json({ message: "Validation Error", details: err.errors });
      } else {
        res.status(500).json({ message: "Internal Server Error" });
      }
    }
  });

  // --- Invoices ---
  app.get("/api/invoices", requireTenant, async (req: any, res) => {
    const type = req.query.type as string | undefined;
    const invoices = await storage.getInvoices(req.tenantId, type);
    res.json(invoices);
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

  app.post("/api/invoices", requireTenant, async (req: any, res) => {
    try {
      const data = invoiceSchema.parse(req.body);
      
      // Use concurrency-safe numbering
      const { getNextInvoiceNumber } = await import("./numbering");
      const invoiceDate = new Date(data.invoiceDate);
      const invoiceNumber = await getNextInvoiceNumber(
        req.tenantId,
        data.branchId || null,
        invoiceDate.getFullYear()
      );

      let subtotal = 0;
      let taxTotal = 0;
      const lines: DbInsertInvoiceLine[] = data.lines.map((line: any) => {
        const qty = Number(line.quantity);
        const price = Number(line.unitPrice);
        const taxRate = Number(line.taxRate || 10);
        
        const lineSubtotal = qty * price;
        const lineTax = lineSubtotal * (taxRate / 100);
        const lineTotal = lineSubtotal + lineTax;
        
        subtotal += lineSubtotal;
        taxTotal += lineTax;
        
        return {
          tenantId: req.tenantId,
          productId: line.productId,
          description: line.description,
          quantity: qty.toString(),
          unitPrice: price.toString(),
          taxRate: taxRate.toString(),
          taxBase: lineSubtotal.toString(),
          subtotal: lineSubtotal.toString(),
          taxAmount: lineTax.toString(),
          total: lineTotal.toString()
        };
      });

      const taxAmount = taxTotal;
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

  app.put("/api/invoices/:id/status", requireTenant, async (req: any, res) => {
    try {
      const existing = await storage.getInvoice(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Invoice not found" });
      }
      const { status, paidAmount } = req.body;
      await storage.updateInvoiceStatus(req.params.id, status, paidAmount);
      res.json({ message: "Invoice status updated" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error updating invoice status" });
    }
  });

  // Odoo-style workflow endpoints
  app.put("/api/sales-orders/:id/confirm", requireTenant, async (req: any, res) => {
    try {
      const existing = await storage.getSalesOrder(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Sales order not found" });
      }
      await storage.updateSalesOrderStatus(req.params.id, "confirmed");
      res.json({ message: "Sales order confirmed" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error confirming sales order" });
    }
  });

  app.put("/api/sales-orders/:id/send", requireTenant, async (req: any, res) => {
    try {
      const existing = await storage.getSalesOrder(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Sales order not found" });
      }
      await storage.updateSalesOrderStatus(req.params.id, "sent");
      res.json({ message: "Sales order sent" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error sending sales order" });
    }
  });

  app.post("/api/sales-orders/:id/create-invoice", requireTenant, async (req: any, res) => {
    try {
      const existing = await storage.getSalesOrder(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Sales order not found" });
      }
      const invoice = await storage.createInvoiceFromSalesOrder(req.params.id);
      res.status(201).json(invoice);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error creating invoice from sales order" });
    }
  });

  app.put("/api/purchase-orders/:id/confirm", requireTenant, async (req: any, res) => {
    try {
      const existing = await storage.getPurchaseOrder(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Purchase order not found" });
      }
      await storage.updatePurchaseOrderStatus(req.params.id, "confirmed");
      res.json({ message: "Purchase order confirmed" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error confirming purchase order" });
    }
  });

  app.put("/api/purchase-orders/:id/receive", requireTenant, async (req: any, res) => {
    try {
      const existing = await storage.getPurchaseOrder(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Purchase order not found" });
      }
      await storage.updatePurchaseOrderStatus(req.params.id, "received");
      res.json({ message: "Purchase order received, stock updated" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error receiving purchase order" });
    }
  });

  // ==========================================
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

  app.post("/api/accounts", requireTenant, async (req: any, res) => {
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

  app.put("/api/accounts/:id", requireTenant, async (req: any, res) => {
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

  app.post("/api/journal-entries", requireTenant, async (req: any, res) => {
    try {
      const data = journalEntrySchema.parse(req.body);
      
      // Generate entry number (concurrency-safe)
      const { getNextJournalEntryNumber } = await import("./numbering");
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

  app.put("/api/journal-entries/:id/post", requireTenant, async (req: any, res) => {
    try {
      const existing = await storage.getJournalEntry(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Journal entry not found" });
      }
      await storage.updateJournalEntryStatus(req.params.id, "posted", req.user?.id);
      res.json({ message: "Journal entry posted" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error posting journal entry" });
    }
  });

  app.post("/api/journal-entries/:id/reverse", requireTenant, async (req: any, res) => {
    try {
      const existing = await storage.getJournalEntry(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Journal entry not found" });
      }
      const { entryDate, description } = req.body;
      const reversal = await storage.reverseJournalEntry(
        req.params.id,
        entryDate || new Date().toISOString().split("T")[0],
        description,
        req.user?.id || ""
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

  app.post("/api/tax-codes", requireTenant, async (req: any, res) => {
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

  app.post("/api/payments", requireTenant, async (req: any, res) => {
    try {
      const data = paymentSchema.parse(req.body);
      
      // Generate payment number
      const { getNextPaymentNumber } = await import("./numbering");
      const paymentDate = new Date(data.paymentDate);
      const paymentNumber = await getNextPaymentNumber(
        req.tenantId,
        null,
        paymentDate.getFullYear()
      );

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

  app.post("/api/payments/:id/allocate", requireTenant, async (req: any, res) => {
    try {
      const { invoiceId, amount, allocationDate } = req.body;
      await storage.createPaymentAllocation(req.params.id, invoiceId, parseFloat(amount), allocationDate, req.tenantId);
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

      if (modelType === "invoice") {
        const invoice = await storage.getInvoice(modelId);
        if (!invoice || invoice.tenantId !== req.tenantId) {
          return res.status(404).json({ message: "Invoice not found" });
        }
      } else if (modelType === "payment") {
        const payment = await storage.getPayment(modelId);
        if (!payment || payment.tenantId !== req.tenantId) {
          return res.status(404).json({ message: "Payment not found" });
        }
      }

      const preview = await storage.previewPosting(modelType, modelId);
      res.json(preview);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ message: err.message || "Error previewing posting" });
    }
  });

  // Post document (create journal entry)
  app.post("/api/posting/post", requireTenant, async (req: any, res) => {
    try {
      const { modelType, modelId, journalId, entryDate } = req.body;
      if (!modelType || !modelId) {
        return res.status(400).json({ message: "modelType and modelId are required" });
      }

      if (modelType === "invoice") {
        const invoice = await storage.getInvoice(modelId);
        if (!invoice || invoice.tenantId !== req.tenantId) {
          return res.status(404).json({ message: "Invoice not found" });
        }
      } else if (modelType === "payment") {
        const payment = await storage.getPayment(modelId);
        if (!payment || payment.tenantId !== req.tenantId) {
          return res.status(404).json({ message: "Payment not found" });
        }
      }

      const journalEntry = await storage.postDocument(
        modelType,
        modelId,
        journalId,
        entryDate,
        req.user?.id
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

  return httpServer;
}
