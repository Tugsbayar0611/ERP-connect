
import { Router } from "express";
import { storage } from "../storage";
import { z } from "zod";
import { 
  insertProductSchema, 
  insertProductCategorySchema, 
  insertWarehouseSchema, 
  type DbInsertProduct, 
  type DbInsertWarehouse,
  type DbInsertSalesOrder,
  type DbInsertSalesOrderLine,
  type DbInsertPurchaseOrder,
  type DbInsertPurchaseOrderLine
} from "@shared/schema";
import { requireTenant, requireTenantAndPermission } from "../middleware";
import { createAuditLog, getAuditContext } from "../audit-log";

const router = Router();
  // --- Products ---
  router.get("/api/products", requireTenant, async (req: any, res) => {
    const products = await storage.getProducts(req.tenantId);
    res.json(products);
  });

  router.get("/api/products/:id", requireTenant, async (req: any, res) => {
    const product = await storage.getProduct(req.params.id);
    if (!product || product.tenantId !== req.tenantId) {
      return res.status(404).json({ message: "Product not found" });
    }
    res.json(product);
  });

  router.post("/api/products", requireTenant, async (req: any, res) => {
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

  router.put("/api/products/:id", requireTenant, async (req: any, res) => {
    try {
      const existing = await storage.getProduct(req.params.id);
      if (!existing || existing.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Product not found" });
      }
      const productBefore = existing;
      const input = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(req.params.id, input);

      // Audit log
      await createAuditLog(
        getAuditContext(req),
        "product",
        req.params.id,
        "update",
        productBefore,
        product,
        `Product ${product.sku || product.name} updated`
      );

      res.json(product);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error updating product" });
    }
  });

  // --- Product Categories ---
  router.get("/api/product-categories", requireTenant, async (req: any, res) => {
    const categories = await storage.getProductCategories(req.tenantId);
    res.json(categories);
  });

  router.post("/api/product-categories", requireTenant, async (req: any, res) => {
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


  // --- Warehouses ---
  router.get("/api/warehouses", requireTenant, async (req: any, res) => {
    const warehouses = await storage.getWarehouses(req.tenantId);
    res.json(warehouses);
  });

  router.post("/api/warehouses", requireTenant, async (req: any, res) => {
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
  router.get("/api/stock-levels", requireTenant, async (req: any, res) => {
    const warehouseId = req.query.warehouseId as string | undefined;
    const levels = await storage.getStockLevels(req.tenantId, warehouseId);
    res.json(levels);
  });

  // --- Stock Movements ---
  router.get("/api/stock/movements", requireTenant, async (req: any, res) => {
    try {
      const movements = await storage.getStockMovements(
        req.tenantId,
        req.query.warehouseId,
        req.query.productId
      );
      res.json(movements);
    } catch (err: any) {
      console.error("Stock movements error:", err);
      res.status(500).json({ message: err.message || "Error fetching stock movements" });
    }
  });

  router.post("/api/stock/movements", requireTenantAndPermission, async (req: any, res) => {
    try {
      const { warehouseId, productId, quantity, type, batchNumber, expiryDate, reference, referenceId, note } = req.body;

      if (!warehouseId || !productId || !quantity || !type) {
        return res.status(400).json({ message: "warehouseId, productId, quantity, and type are required" });
      }

      // Validate product trackExpiry
      const product = await storage.getProduct(productId);
      if (!product || product.tenantId !== req.tenantId) {
        return res.status(404).json({ message: "Product not found" });
      }

      if (type === "out" && (product as any).trackExpiry) {
        if (!batchNumber) {
          return res.status(400).json({ message: "Batch number is required for products with expiry tracking" });
        }
        if (!expiryDate) {
          return res.status(400).json({ message: "Expiry date is required for products with expiry tracking" });
        }
      }

      // Validate expiry date is not in the future
      if (expiryDate) {
        const expiry = new Date(expiryDate);
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        if (expiry > today) {
          return res.status(400).json({ message: "Expiry date cannot be in the future" });
        }
      }

      await storage.updateStock(
        req.tenantId,
        warehouseId,
        productId,
        Number(quantity),
        type,
        reference,
        referenceId,
        batchNumber || null,
        expiryDate || null
      );

      res.status(201).json({ message: "Stock movement created successfully" });
    } catch (err: any) {
      console.error("Stock movement creation error:", err);
      if (err.message.includes("required")) {
        res.status(400).json({ message: err.message });
      } else {
        res.status(500).json({ message: err.message || "Error creating stock movement" });
      }
    }
  });

  // --- Expiry Alerts ---
  router.get("/api/stock/expiry-alerts", requireTenant, async (req: any, res) => {
    try {
      const days = req.query.days ? parseInt(req.query.days) : 30;
      const warehouseId = req.query.warehouseId;

      const alerts = await storage.getExpiryAlerts(req.tenantId, days, warehouseId);
      res.json(alerts);
    } catch (err: any) {
      console.error("Expiry alerts error:", err);
      res.status(500).json({ message: err.message || "Error fetching expiry alerts" });
    }
  });

  // FEFO Auto-Suggest API
  router.get("/api/stock/fefo-suggest", requireTenant, async (req: any, res) => {
    try {
      const { productId, warehouseId, quantity } = req.query;

      if (!productId || !warehouseId) {
        return res.status(400).json({ message: "productId and warehouseId are required" });
      }

      const suggestions = await storage.getFEFOSuggest(
        req.tenantId,
        productId,
        warehouseId,
        Number(quantity) || 0
      );
      res.json(suggestions);
    } catch (err: any) {
      console.error("FEFO suggest error:", err);
      res.status(500).json({ message: err.message || "Error fetching FEFO suggestions" });
    }
  });

  router.get("/api/inventory/stats", requireTenant, async (req: any, res) => {
    try {
      const stats = await storage.getInventoryStats(req.tenantId);
      res.json(stats);
    } catch (err: any) {
      console.error("Inventory Stats error:", err);
      res.status(500).json({ message: err.message || "Error calculating inventory stats" });
    }
  });

  router.post("/api/inventory/bulk-actions", requireTenant, async (req: any, res) => {
    try {
      const { action, ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs required" });
      }

      if (action === "delete") {
        await storage.bulkDeleteStockLevels(req.tenantId, ids);
      } else if (action === "reset") {
        await storage.bulkResetStockLevels(req.tenantId, ids);
      } else {
        return res.status(400).json({ message: "Invalid action" });
      }

      res.json({ success: true, count: ids.length });
    } catch (err: any) {
      console.error("Inventory Bulk Action error:", err);
      res.status(500).json({ message: err.message || "Bulk action failed" });
    }
  });

  // --- Sales Orders ---
  router.get("/api/sales-orders", requireTenant, async (req: any, res) => {
    const orders = await storage.getSalesOrders(req.tenantId);
    res.json(orders);
  });

  router.get("/api/sales-orders/:id", requireTenant, async (req: any, res) => {
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
    deliveryDate: z.string().optional().transform(val => val === "" ? undefined : val), // Empty string → undefined for optional date
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

  router.post("/api/sales-orders", requireTenant, async (req: any, res) => {
    try {
      const data = salesOrderSchema.parse(req.body);

      // Generate order number
      const orderCount = (await storage.getSalesOrders(req.tenantId)).length;
      const orderNumber = `SO-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`;

      // Calculate totals
      let subtotal = 0;
      const lines: Omit<DbInsertSalesOrderLine, 'salesOrderId'>[] = data.lines.map((line: any) => {
        const qty = Number(line.quantity);
        const price = Number(line.unitPrice);
        const discount = Number(line.discount || 0);
        const taxRate = Number(line.taxRate || 10);

        const lineSubtotal = qty * price * (1 - discount / 100);
        const lineTax = lineSubtotal * (taxRate / 100);
        const lineTotal = lineSubtotal + lineTax;

        subtotal += lineSubtotal;

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

      const taxAmount = subtotal * 0.1; // 10% ХХОАТ
      const totalAmount = subtotal + taxAmount;

      const order = await storage.createSalesOrder({
        tenantId: req.tenantId,
        branchId: data.branchId || undefined,
        warehouseId: data.warehouseId || undefined,
        customerId: data.customerId,
        orderNumber,
        orderDate: data.orderDate,
        deliveryDate: data.deliveryDate || undefined, // Convert empty string to undefined for optional date field
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

  // Get single sales order with details (for drawer view)
  router.get("/api/sales-orders/:id", requireTenant, async (req: any, res) => {
    try {
      const order = await storage.getSalesOrder(req.params.id);
      if (!order) {
        return res.status(404).json({ message: "Sales order not found" });
      }
      // Verify tenant access
      if (order.tenantId !== req.tenantId) {
        return res.status(403).json({ message: "Forbidden" });
      }
      res.json(order);
    } catch (err) {
      console.error("Get Sales Order Error:", err);
      res.status(500).json({ message: "Internal Server Error" });
    }
  });


  // --- Sales Stats (for KPI cards) ---
  router.get("/api/sales/stats", requireTenant, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;

      // Calculate this month's date range
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // Get all sales orders
      const orders = await storage.getSalesOrders(req.tenantId);

      // Calculate this month's confirmed sales
      const thisMonthSales = orders
        .filter(o =>
          o.status === 'confirmed' &&
          o.orderDate >= thisMonthStart &&
          o.orderDate <= thisMonthEnd
        )
        .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

      // Get AR outstanding from sales invoices
      const invoices = await storage.getInvoices(req.tenantId, 'sales');
      const arOutstanding = invoices
        .filter(inv => inv.status !== 'paid')
        .reduce((sum, inv) => {
          const total = Number(inv.totalAmount || 0);
          const paid = Number(inv.paidAmount || 0);
          return sum + (total - paid);
        }, 0);

      // Filter orders by date range if provided
      const filteredOrders = startDate && endDate
        ? orders.filter(o => o.orderDate >= startDate && o.orderDate <= endDate)
        : orders;

      res.json({
        thisMonthSales: Math.max(0, thisMonthSales),
        arOutstanding: Math.max(0, arOutstanding),
        totalOrders: filteredOrders.length,
      });
    } catch (err: any) {
      console.error("Sales stats error:", err);
      res.status(500).json({ message: err.message || "Error fetching sales stats" });
    }
  });

  // Bulk cancel orders
  router.post("/api/sales-orders/bulk-cancel", requireTenant, async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const result = await storage.bulkCancelOrders(ids, req.tenantId);
      res.json({
        success: true,
        updated: result.updated,
        errors: result.errors,
        message: `${result.updated} захиалга цуцлагдлаа`
      });
    } catch (err: any) {
      console.error("Bulk cancel error:", err);
      res.status(500).json({ message: err.message || "Bulk cancel failed" });
    }
  });

  // Bulk delete draft orders
  router.post("/api/sales-orders/bulk-delete", requireTenant, async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const result = await storage.bulkDeleteDraftOrders(ids, req.tenantId);
      if (result.errors.length > 0 && result.deleted === 0) {
        return res.status(400).json({ message: "Алдаа гарлаа", errors: result.errors });
      }
      res.json({
        success: true,
        deleted: result.deleted,
        errors: result.errors,
        message: `${result.deleted} ноорог захиалга устгагдлаа`
      });
    } catch (err: any) {
      console.error("Bulk delete error:", err);
      res.status(500).json({ message: err.message || "Bulk delete failed" });
    }
  });

  // --- Purchase Stats (for KPI cards) ---
  router.get("/api/purchase/stats", requireTenant, async (req: any, res) => {
    try {
      const { startDate, endDate } = req.query;

      // Calculate this month's date range
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const thisMonthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];

      // Get all purchase orders
      const orders = await storage.getPurchaseOrders(req.tenantId);

      // Calculate this month's spend (confirmed orders)
      const thisMonthSpend = orders
        .filter(o =>
          (o.status === 'confirmed' || o.status === 'received') &&
          o.orderDate >= thisMonthStart &&
          o.orderDate <= thisMonthEnd
        )
        .reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);

      // Calculate pending deliveries (confirmed but not fully received)
      // For now, we count 'confirmed' status as pending delivery
      const pendingDelivery = orders
        .filter(o => o.status === 'confirmed')
        .length;

      // Get overdue bills (unpaid invoices)
      // We look at purchase invoices that are not paid
      const invoices = await storage.getInvoices(req.tenantId, 'purchase');
      const overdueBills = invoices
        .filter(inv => inv.status !== 'paid')
        .reduce((sum, inv) => {
          const total = Number(inv.totalAmount || 0);
          const paid = Number(inv.paidAmount || 0);
          return sum + (total - paid);
        }, 0);

      res.json({
        thisMonthSpend: Math.max(0, thisMonthSpend),
        pendingDelivery: Math.max(0, pendingDelivery),
        overdueBills: Math.max(0, overdueBills),
      });
    } catch (err: any) {
      console.error("Purchase stats error:", err);
      res.status(500).json({ message: err.message || "Error fetching purchase stats" });
    }
  });

  // --- Purchase Orders ---
  router.get("/api/purchase-orders", requireTenant, async (req: any, res) => {
    const orders = await storage.getPurchaseOrders(req.tenantId);
    res.json(orders);
  });

  router.get("/api/purchase-orders/:id", requireTenant, async (req: any, res) => {
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
    expectedDate: z.string().optional().transform(val => val === "" ? undefined : val),
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

  router.post("/api/purchase-orders", requireTenant, async (req: any, res) => {
    try {
      const data = purchaseOrderSchema.parse(req.body);

      const orderCount = (await storage.getPurchaseOrders(req.tenantId)).length;
      const orderNumber = `PO-${new Date().getFullYear()}-${String(orderCount + 1).padStart(4, '0')}`;

      let subtotal = 0;
      const lines: Omit<DbInsertPurchaseOrderLine, 'purchaseOrderId'>[] = data.lines.map((line: any) => {
        const qty = Number(line.quantity);
        const price = Number(line.unitPrice);
        const discount = Number(line.discount || 0);
        const taxRate = Number(line.taxRate || 10);

        const lineSubtotal = qty * price * (1 - discount / 100);
        const lineTax = lineSubtotal * (taxRate / 100);
        const lineTotal = lineSubtotal + lineTax;

        subtotal += lineSubtotal;

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

      const taxAmount = subtotal * 0.1;
      const totalAmount = subtotal + taxAmount;

      const order = await storage.createPurchaseOrder({
        tenantId: req.tenantId,
        branchId: data.branchId,
        warehouseId: data.warehouseId,
        supplierId: data.supplierId,
        orderNumber,
        orderDate: data.orderDate,
        expectedDate: data.expectedDate || undefined,
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

  router.post("/api/purchase-orders/bulk-delete", requireTenant, async (req: any, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ message: "IDs array is required" });
      }
      const result = await storage.bulkDeleteDraftPurchaseOrders(ids, req.tenantId);
      if (result.errors.length > 0 && result.deleted === 0) {
        return res.status(400).json({ message: "Алдаа гарлаа", errors: result.errors });
      }
      res.json({
        success: true,
        deleted: result.deleted,
        errors: result.errors,
        message: `${result.deleted} ноорог захиалга устгагдлаа`
      });
    } catch (err: any) {
      console.error("Bulk delete error:", err);
      res.status(500).json({ message: err.message || "Bulk delete failed" });
    }
  });

  // Odoo-style workflow endpoints
  router.put("/api/sales-orders/:id/confirm", requireTenant, async (req: any, res) => {
    try {
      await storage.updateSalesOrderStatus(req.params.id, "confirmed");
      res.json({ message: "Sales order confirmed" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error confirming sales order" });
    }
  });

  router.put("/api/sales-orders/:id/send", requireTenant, async (req: any, res) => {
    try {
      await storage.updateSalesOrderStatus(req.params.id, "sent");
      res.json({ message: "Sales order sent" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error sending sales order" });
    }
  });

  router.post("/api/sales-orders/:id/create-invoice", requireTenant, async (req: any, res) => {
    try {
      const invoice = await storage.createInvoiceFromSalesOrder(req.params.id);
      res.status(201).json(invoice);
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error creating invoice from sales order" });
    }
  });

  router.put("/api/purchase-orders/:id/confirm", requireTenant, async (req: any, res) => {
    try {
      await storage.updatePurchaseOrderStatus(req.params.id, "confirmed");
      res.json({ message: "Purchase order confirmed" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error confirming purchase order" });
    }
  });

  router.put("/api/purchase-orders/:id/receive", requireTenant, async (req: any, res) => {
    try {
      await storage.updatePurchaseOrderStatus(req.params.id, "received");
      res.json({ message: "Purchase order received, stock updated" });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Error receiving purchase order" });
    }
  });


export default router;
