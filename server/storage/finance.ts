import {
    products, productCategories, contacts, warehouses, stockLevels, stockMovements,
    salesOrders, salesOrderLines, purchaseOrders, purchaseOrderLines,
    invoices, invoiceLines,
    currencies, accounts, journals, journalEntries, journalLines, taxCodes, taxLines,
    payments, paymentAllocations,
    bankAccounts, bankStatements, bankStatementLines, reconciliations, reconciliationMatches,
    qpaySettings, qpayInvoices,
    ebarimtSettings,
    auditLogs,
    type Product, type InsertProduct, type DbInsertProduct,
    type ProductCategory, type DbInsertProductCategory,
    type Contact, type InsertContact, type DbInsertContact,
    type Warehouse, type DbInsertWarehouse,
    type SalesOrder, type DbInsertSalesOrder, type DbInsertSalesOrderLine,
    type PurchaseOrder, type DbInsertPurchaseOrder, type DbInsertPurchaseOrderLine,
    type Invoice, type DbInsertInvoice, type DbInsertInvoiceLine,
    type Currency, type DbInsertCurrency,
    type Account, type InsertAccount, type DbInsertAccount,
    type Journal, type DbInsertJournal,
    type JournalEntry, type DbInsertJournalEntry, type DbInsertJournalLine,
    type TaxCode, type DbInsertTaxCode, type InsertTaxLine,
    type Payment, type DbInsertPayment,
    type QPaySettings, type DbInsertQPaySettings, type QPayInvoice, type DbInsertQPayInvoice,
    type EBarimtSettings, type DbInsertEBarimtSettings,
    type AuditLog, type DbInsertAuditLog,
} from "@shared/schema";
import { db } from "../db";
import { eq, and, desc, asc, sql, inArray, or } from "drizzle-orm";
import { CommunicationStorage } from "./communication";
import { getTrialBalance, getBalanceSheet, getProfitAndLoss, getVATReport } from "../reports";
import { previewPosting, postDocument } from "../posting-engine";

export class FinanceStorage extends CommunicationStorage {
    // --- Products ---
    async getProducts(tenantId: string): Promise<Product[]> {
        return await db.select().from(products).where(eq(products.tenantId, tenantId)).orderBy(desc(products.createdAt));
    }

    async getProduct(id: string): Promise<Product | undefined> {
        const [product] = await db.select().from(products).where(eq(products.id, id));
        return product;
    }

    async createProduct(insertProduct: DbInsertProduct): Promise<Product> {
        const [product] = await db.insert(products).values(insertProduct).returning();
        return product;
    }

    async updateProduct(id: string, update: Partial<InsertProduct>): Promise<Product> {
        const [product] = await db.update(products).set(update).where(eq(products.id, id)).returning();
        return product;
    }

    // --- Product Categories ---
    async getProductCategories(tenantId: string): Promise<ProductCategory[]> {
        return await db.select().from(productCategories).where(eq(productCategories.tenantId, tenantId));
    }

    async createProductCategory(category: DbInsertProductCategory): Promise<ProductCategory> {
        const [cat] = await db.insert(productCategories).values(category).returning();
        return cat;
    }

    // --- Contacts ---
    async getContacts(tenantId: string, type?: string): Promise<Contact[]> {
        if (type) {
            return await db.select().from(contacts).where(and(eq(contacts.tenantId, tenantId), eq(contacts.type, type))).orderBy(desc(contacts.createdAt));
        }
        return await db.select().from(contacts).where(eq(contacts.tenantId, tenantId)).orderBy(desc(contacts.createdAt));
    }

    async getContact(id: string): Promise<Contact | undefined> {
        const [contact] = await db.select().from(contacts).where(eq(contacts.id, id));
        return contact;
    }

    async createContact(insertContact: DbInsertContact): Promise<Contact> {
        const [contact] = await db.insert(contacts).values(insertContact).returning();
        return contact;
    }

    async updateContact(id: string, update: Partial<InsertContact>): Promise<Contact> {
        const [contact] = await db.update(contacts).set(update).where(eq(contacts.id, id)).returning();
        return contact;
    }

    // --- Warehouses ---
    async getWarehouses(tenantId: string): Promise<Warehouse[]> {
        return await db.select().from(warehouses).where(eq(warehouses.tenantId, tenantId));
    }

    async createWarehouse(warehouse: DbInsertWarehouse): Promise<Warehouse> {
        const [w] = await db.insert(warehouses).values(warehouse).returning();
        return w;
    }

    // --- Stock ---
    async getStockLevels(tenantId: string, warehouseId?: string): Promise<any[]> {
        const baseCondition = warehouseId
            ? and(eq(stockLevels.tenantId, tenantId), eq(stockLevels.warehouseId, warehouseId))
            : eq(stockLevels.tenantId, tenantId);

        return await db.select({
            id: stockLevels.id,
            warehouseId: stockLevels.warehouseId,
            productId: stockLevels.productId,
            quantity: stockLevels.quantity,
            reservedQuantity: stockLevels.reservedQuantity,
            warehouseName: warehouses.name,
            productName: products.name,
            productSku: products.sku
        })
            .from(stockLevels)
            .leftJoin(warehouses, eq(stockLevels.warehouseId, warehouses.id))
            .leftJoin(products, eq(stockLevels.productId, products.id))
            .where(baseCondition);
    }

    async bulkDeleteStockLevels(tenantId: string, ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        await db.delete(stockLevels)
            .where(
                and(
                    eq(stockLevels.tenantId, tenantId),
                    inArray(stockLevels.id, ids)
                )
            );
    }

    async bulkResetStockLevels(tenantId: string, ids: string[]): Promise<void> {
        if (ids.length === 0) return;
        await db.update(stockLevels)
            .set({ quantity: "0", updatedAt: new Date() })
            .where(
                and(
                    eq(stockLevels.tenantId, tenantId),
                    inArray(stockLevels.id, ids)
                )
            );
    }

    async updateStock(
        tenantId: string,
        warehouseId: string,
        productId: string,
        quantity: number,
        type: string,
        reference?: string,
        referenceId?: string,
        batchNumber?: string | null,
        expiryDate?: string | null
    ): Promise<void> {
        // Validate batch/expiry for trackExpiry products
        if (type === "out") {
            const product = await this.getProduct(productId);
            if (product && (product as any).trackExpiry) {
                if (!batchNumber) {
                    throw new Error("Batch number is required for products with expiry tracking");
                }
                if (!expiryDate) {
                    throw new Error("Expiry date is required for products with expiry tracking");
                }
                // Validate expiry date is not in the future
                const expiry = new Date(expiryDate);
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                if (expiry > today) {
                    console.warn(`Expiry date ${expiryDate} is in the future for OUT movement`);
                }
            }
        }

        // Update or create stock level
        const existing = await db.select().from(stockLevels).where(
            and(
                eq(stockLevels.warehouseId, warehouseId),
                eq(stockLevels.productId, productId)
            )
        );

        if (existing.length > 0) {
            const currentQty = Number(existing[0].quantity);
            const newQty = type === "in" ? currentQty + quantity : currentQty - quantity;
            await db.update(stockLevels).set({ quantity: newQty.toString(), updatedAt: new Date() }).where(eq(stockLevels.id, existing[0].id));
        } else if (type === "in") {
            await db.insert(stockLevels).values({
                tenantId,
                warehouseId,
                productId,
                quantity: quantity.toString(),
                reservedQuantity: "0"
            });
        }

        // Log stock movement with batch/expiry
        await db.insert(stockMovements).values({
            tenantId,
            warehouseId,
            productId,
            type,
            quantity: quantity.toString(),
            reference,
            referenceId,
            batchNumber: batchNumber || null,
            expiryDate: expiryDate || null
        });
    }

    async getStockMovements(tenantId: string, warehouseId?: string, productId?: string): Promise<any[]> {
        const conditions = [eq(stockMovements.tenantId, tenantId)];
        if (warehouseId) conditions.push(eq(stockMovements.warehouseId, warehouseId));
        if (productId) conditions.push(eq(stockMovements.productId, productId));

        return await db.select({
            id: stockMovements.id,
            warehouseId: stockMovements.warehouseId,
            productId: stockMovements.productId,
            type: stockMovements.type,
            quantity: stockMovements.quantity,
            batchNumber: stockMovements.batchNumber,
            expiryDate: stockMovements.expiryDate,
            reference: stockMovements.reference,
            referenceId: stockMovements.referenceId,
            note: stockMovements.note,
            createdAt: stockMovements.createdAt,
            warehouseName: warehouses.name,
            productName: products.name,
            productSku: products.sku
        })
            .from(stockMovements)
            .leftJoin(warehouses, eq(stockMovements.warehouseId, warehouses.id))
            .leftJoin(products, eq(stockMovements.productId, products.id))
            .where(and(...conditions))
            .orderBy(desc(stockMovements.createdAt));
    }

    async getExpiryAlerts(tenantId: string, days: number = 30, warehouseId?: string): Promise<any[]> {
        const today = new Date();
        const targetDate = new Date(today);
        targetDate.setDate(today.getDate() + days);

        const conditions = [
            eq(stockMovements.tenantId, tenantId),
            sql`${stockMovements.expiryDate} IS NOT NULL`,
            sql`${stockMovements.expiryDate} <= ${targetDate.toISOString().split('T')[0]}`
        ];

        if (warehouseId) {
            conditions.push(eq(stockMovements.warehouseId, warehouseId));
        }

        const movements = await db.select({
            warehouseId: stockMovements.warehouseId,
            productId: stockMovements.productId,
            batchNumber: stockMovements.batchNumber,
            expiryDate: stockMovements.expiryDate,
            type: stockMovements.type,
            quantity: stockMovements.quantity,
            productName: products.name,
            productSku: products.sku,
            warehouseName: warehouses.name
        })
            .from(stockMovements)
            .leftJoin(products, eq(stockMovements.productId, products.id))
            .leftJoin(warehouses, eq(stockMovements.warehouseId, warehouses.id))
            .where(and(...conditions));

        const stockMap = new Map<string, any>();

        for (const mov of movements) {
            const key = `${mov.productId}-${mov.warehouseId}-${mov.batchNumber || 'no-batch'}-${mov.expiryDate}`;
            const current = stockMap.get(key) || {
                productId: mov.productId,
                productName: mov.productName || '',
                productSku: mov.productSku,
                warehouseId: mov.warehouseId,
                warehouseName: mov.warehouseName || '',
                batchNumber: mov.batchNumber,
                expiryDate: mov.expiryDate,
                quantity: 0,
                daysUntilExpiry: 0
            };

            const qty = Number(mov.quantity);
            if (mov.type === 'in') {
                current.quantity += qty;
            } else if (mov.type === 'out') {
                current.quantity -= qty;
            }

            // @ts-ignore
            const expiry = new Date(mov.expiryDate);
            const diffTime = expiry.getTime() - today.getTime();
            current.daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            stockMap.set(key, current);
        }

        return Array.from(stockMap.values())
            .filter(item => item.quantity > 0)
            .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);
    }

    async getFEFOSuggest(tenantId: string, productId: string, warehouseId: string, quantity: number): Promise<any[]> {
        const movements = await db.select({
            batchNumber: stockMovements.batchNumber,
            expiryDate: stockMovements.expiryDate,
            type: stockMovements.type,
            quantity: stockMovements.quantity,
        })
            .from(stockMovements)
            .where(
                and(
                    eq(stockMovements.tenantId, tenantId),
                    eq(stockMovements.productId, productId),
                    eq(stockMovements.warehouseId, warehouseId),
                    sql`${stockMovements.expiryDate} IS NOT NULL`
                )
            )
            .orderBy(asc(stockMovements.expiryDate), asc(stockMovements.createdAt));

        const stockMap = new Map<string, any>();
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        for (const mov of movements) {
            if (!mov.expiryDate) continue;

            const key = `${mov.batchNumber || 'no-batch'}-${mov.expiryDate}`;
            const current = stockMap.get(key) || {
                batchNumber: mov.batchNumber,
                expiryDate: mov.expiryDate,
                quantity: 0,
                daysUntilExpiry: 0
            };

            const qty = Number(mov.quantity);
            if (mov.type === 'in') {
                current.quantity += qty;
            } else if (mov.type === 'out') {
                current.quantity -= qty;
            }

            const expiry = new Date(mov.expiryDate);
            const diffTime = expiry.getTime() - today.getTime();
            current.daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            stockMap.set(key, current);
        }

        return Array.from(stockMap.values())
            .filter(item => item.quantity > 0)
            .sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry)
            .slice(0, 10);
    }

    async getInventoryStats(tenantId: string): Promise<{ totalValue: number; lowStockCount: number; expiringCount: number }> {
        const levels = await this.getStockLevels(tenantId);
        const allProducts = await db.select().from(products).where(eq(products.tenantId, tenantId));
        const productMap = new Map(allProducts.map(p => [p.id, Number(p.costPrice || 0)]));

        let totalValue = 0;
        let lowStockCount = 0;

        for (const level of levels) {
            const qty = Number(level.quantity || 0);
            const cost = productMap.get(level.productId) || 0;

            totalValue += qty * cost;

            if (qty < 10) {
                lowStockCount++;
            }
        }

        const alerts = await this.getExpiryAlerts(tenantId, 30);
        const expiringCount = alerts.length;

        return {
            totalValue,
            lowStockCount,
            expiringCount
        };
    }

    // --- Sales Orders ---
    async getSalesOrders(tenantId: string): Promise<any[]> {
        return await db.select({
            id: salesOrders.id,
            orderNumber: salesOrders.orderNumber,
            orderDate: salesOrders.orderDate,
            deliveryDate: salesOrders.deliveryDate,
            status: salesOrders.status,
            paymentStatus: salesOrders.paymentStatus,
            totalAmount: salesOrders.totalAmount,
            customerName: sql<string>`COALESCE(
        ${contacts.companyName}, 
        NULLIF(TRIM(COALESCE(${contacts.firstName}, '') || ' ' || COALESCE(${contacts.lastName}, '')), ''),
        'Үйлчлүүлэгч сонгоогүй'
      )`,
            customerEmail: contacts.email
        })
            .from(salesOrders)
            .leftJoin(contacts, eq(salesOrders.customerId, contacts.id))
            .where(eq(salesOrders.tenantId, tenantId))
            .orderBy(desc(salesOrders.createdAt));
    }

    async getSalesOrder(id: string): Promise<any | undefined> {
        const [order] = await db.select({
            id: salesOrders.id,
            tenantId: salesOrders.tenantId,
            branchId: salesOrders.branchId,
            warehouseId: salesOrders.warehouseId,
            customerId: salesOrders.customerId,
            orderNumber: salesOrders.orderNumber,
            orderDate: salesOrders.orderDate,
            deliveryDate: salesOrders.deliveryDate,
            status: salesOrders.status,
            paymentStatus: salesOrders.paymentStatus,
            subtotal: salesOrders.subtotal,
            taxAmount: salesOrders.taxAmount,
            discountAmount: salesOrders.discountAmount,
            totalAmount: salesOrders.totalAmount,
            notes: salesOrders.notes,
            createdBy: salesOrders.createdBy,
            createdAt: salesOrders.createdAt,
            updatedAt: salesOrders.updatedAt,
            customerName: sql<string>`COALESCE(
        ${contacts.companyName}, 
        NULLIF(TRIM(COALESCE(${contacts.firstName}, '') || ' ' || COALESCE(${contacts.lastName}, '')), ''),
        'Үйлчлүүлэгч сонгоогүй'
      )`,
            customerEmail: contacts.email,
            customerPhone: contacts.phone
        })
            .from(salesOrders)
            .leftJoin(contacts, eq(salesOrders.customerId, contacts.id))
            .where(eq(salesOrders.id, id));

        if (!order) return undefined;

        const lines = await db.select({
            id: salesOrderLines.id,
            productId: salesOrderLines.productId,
            productName: products.name,
            quantity: salesOrderLines.quantity,
            unitPrice: salesOrderLines.unitPrice,
            discount: salesOrderLines.discount,
            taxRate: salesOrderLines.taxRate,
            subtotal: salesOrderLines.subtotal,
            taxAmount: salesOrderLines.taxAmount,
            total: salesOrderLines.total,
            description: salesOrderLines.description
        })
            .from(salesOrderLines)
            .leftJoin(products, eq(salesOrderLines.productId, products.id))
            .where(eq(salesOrderLines.salesOrderId, id));

        const invoiceData = await db.select({
            paidAmount: invoices.paidAmount
        })
            .from(invoices)
            .where(eq(invoices.salesOrderId, id));

        const paidAmount = invoiceData.reduce((sum, inv) => sum + parseFloat(inv.paidAmount || '0'), 0);
        const totalAmount = parseFloat(order.totalAmount || '0');
        const remainingAmount = Math.max(0, totalAmount - paidAmount);

        return {
            ...order,
            lines,
            paidAmount: paidAmount.toString(),
            remainingAmount: remainingAmount.toString()
        };
    }

    async createSalesOrder(order: DbInsertSalesOrder, lines: Omit<DbInsertSalesOrderLine, 'salesOrderId'>[]): Promise<SalesOrder> {
        const [newOrder] = await db.insert(salesOrders).values(order).returning();

        for (const line of lines) {
            await db.insert(salesOrderLines).values({ ...line, salesOrderId: newOrder.id, tenantId: order.tenantId });
        }

        return newOrder;
    }

    async updateSalesOrderStatus(id: string, status: string): Promise<void> {
        const order = await this.getSalesOrder(id);
        if (!order) throw new Error("Sales order not found");

        if (status === "confirmed" && order.status !== "confirmed") {
            if (order.lines && order.warehouseId) {
                for (const line of order.lines) {
                    await this.updateStock(
                        order.tenantId,
                        order.warehouseId,
                        line.productId,
                        Number(line.quantity),
                        "out",
                        order.orderNumber,
                        id
                    );
                }
            }
        }

        await db.update(salesOrders).set({ status, updatedAt: new Date() }).where(eq(salesOrders.id, id));
    }

    async createInvoiceFromSalesOrder(salesOrderId: string): Promise<Invoice> {
        const order = await this.getSalesOrder(salesOrderId);
        if (!order || !order.lines) throw new Error("Sales order not found or has no lines");

        const { getNextInvoiceNumber } = await import("../numbering");
        const invoiceNumber = await getNextInvoiceNumber(order.tenantId, order.branchId || null);

        const lines: DbInsertInvoiceLine[] = order.lines.map((line: any) => ({
            tenantId: order.tenantId,
            productId: line.productId,
            description: line.description || "",
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            taxRate: line.taxRate || "10.00",
            subtotal: line.subtotal,
            taxAmount: line.taxAmount,
            total: line.total
        }));

        const invoice = await this.createInvoice({
            tenantId: order.tenantId,
            branchId: order.branchId,
            contactId: order.customerId,
            salesOrderId: order.id,
            invoiceNumber,
            invoiceDate: new Date().toISOString().split('T')[0],
            dueDate: order.deliveryDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            type: "sales",
            status: "draft",
            subtotal: order.subtotal,
            taxAmount: order.taxAmount,
            totalAmount: order.totalAmount,
            paidAmount: "0",
            createdBy: order.createdBy
        } as DbInsertInvoice, lines);

        await db.update(salesOrders).set({ status: "invoiced", updatedAt: new Date() }).where(eq(salesOrders.id, salesOrderId));

        return invoice;
    }

    async bulkCancelOrders(ids: string[], tenantId: string): Promise<{ updated: number; errors: string[] }> {
        const errors: string[] = [];
        let updated = 0;

        for (const id of ids) {
            try {
                const order = await this.getSalesOrder(id);
                if (!order) {
                    errors.push(`Order ${id} not found`);
                    continue;
                }
                if (order.tenantId !== tenantId) {
                    errors.push(`Order ${id} access denied`);
                    continue;
                }
                if (order.status === 'cancelled') {
                    errors.push(`Order ${id} already cancelled`);
                    continue;
                }
                await db.update(salesOrders).set({ status: 'cancelled', updatedAt: new Date() }).where(eq(salesOrders.id, id));
                updated++;
            } catch (err: any) {
                errors.push(`Order ${id}: ${err.message}`);
            }
        }

        return { updated, errors };
    }

    async bulkDeleteDraftOrders(ids: string[], tenantId: string): Promise<{ deleted: number; errors: string[] }> {
        const errors: string[] = [];
        let deleted = 0;

        for (const id of ids) {
            try {
                const order = await this.getSalesOrder(id);
                if (!order) {
                    errors.push(`Order ${id} not found`);
                    continue;
                }
                if (order.tenantId !== tenantId) {
                    errors.push(`Order ${id} access denied`);
                    continue;
                }
                if (order.status !== 'draft') {
                    errors.push(`Order ${id} cannot be deleted - status: ${order.status} (only draft can be deleted)`);
                    continue;
                }

                await db.delete(salesOrderLines).where(eq(salesOrderLines.salesOrderId, id));
                await db.delete(salesOrders).where(eq(salesOrders.id, id));
                deleted++;
            } catch (err: any) {
                errors.push(`Order ${id}: ${err.message}`);
            }
        }

        return { deleted, errors };
    }

    // --- Purchase Orders ---
    async getPurchaseOrders(tenantId: string): Promise<any[]> {
        return await db.select({
            id: purchaseOrders.id,
            orderNumber: purchaseOrders.orderNumber,
            orderDate: purchaseOrders.orderDate,
            expectedDate: purchaseOrders.expectedDate,
            status: purchaseOrders.status,
            paymentStatus: purchaseOrders.paymentStatus,
            totalAmount: purchaseOrders.totalAmount,
            supplierName: sql<string>`COALESCE(${contacts.companyName}, ${contacts.firstName} || ' ' || ${contacts.lastName})`
        })
            .from(purchaseOrders)
            .leftJoin(contacts, eq(purchaseOrders.supplierId, contacts.id))
            .where(eq(purchaseOrders.tenantId, tenantId))
            .orderBy(desc(purchaseOrders.createdAt));
    }

    async getPurchaseOrder(id: string): Promise<any | undefined> {
        const [order] = await db.select().from(purchaseOrders).where(eq(purchaseOrders.id, id));
        if (!order) return undefined;

        const lines = await db.select().from(purchaseOrderLines).where(eq(purchaseOrderLines.purchaseOrderId, id));
        return { ...order, lines };
    }

    async createPurchaseOrder(order: DbInsertPurchaseOrder, lines: Omit<DbInsertPurchaseOrderLine, 'purchaseOrderId'>[]): Promise<PurchaseOrder> {
        const [newOrder] = await db.insert(purchaseOrders).values(order).returning();

        for (const line of lines) {
            await db.insert(purchaseOrderLines).values({ ...line, purchaseOrderId: newOrder.id, tenantId: order.tenantId });
        }

        return newOrder;
    }

    async updatePurchaseOrderStatus(id: string, status: string): Promise<void> {
        const order = await this.getPurchaseOrder(id);
        if (!order) throw new Error("Purchase order not found");

        if (status === "received" && order.status !== "received") {
            if (order.lines && order.warehouseId) {
                for (const line of order.lines) {
                    await this.updateStock(
                        order.tenantId,
                        order.warehouseId,
                        line.productId,
                        Number(line.quantity),
                        "in",
                        order.orderNumber,
                        id
                    );
                }
            }
        }

        await db.update(purchaseOrders).set({ status, updatedAt: new Date() }).where(eq(purchaseOrders.id, id));
    }

    async bulkDeleteDraftPurchaseOrders(ids: string[], tenantId: string): Promise<{ deleted: number; errors: string[] }> {
        const results = { deleted: 0, errors: [] as string[] };

        for (const id of ids) {
            try {
                const [order] = await db
                    .select()
                    .from(purchaseOrders)
                    .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.tenantId, tenantId)));

                if (!order) {
                    results.errors.push(`Order ${id} not found`);
                    continue;
                }

                if (order.status !== "draft") {
                    results.errors.push(`Order ${order.orderNumber} is not a draft`);
                    continue;
                }

                await db.delete(purchaseOrderLines).where(eq(purchaseOrderLines.purchaseOrderId, id));
                await db.delete(purchaseOrders).where(eq(purchaseOrders.id, id));

                results.deleted++;
            } catch (error: any) {
                results.errors.push(`Error deleting order ${id}: ${error.message}`);
            }
        }

        return results;
    }

    // --- Invoices ---
    async getInvoices(tenantId: string, type?: string): Promise<any[]> {
        const baseCondition = type
            ? and(eq(invoices.tenantId, tenantId), eq(invoices.type, type))
            : eq(invoices.tenantId, tenantId);

        return await db.select({
            id: invoices.id,
            invoiceNumber: invoices.invoiceNumber,
            invoiceDate: invoices.invoiceDate,
            dueDate: invoices.dueDate,
            type: invoices.type,
            status: invoices.status,
            totalAmount: invoices.totalAmount,
            paidAmount: invoices.paidAmount,
            contactName: sql<string>`COALESCE(${contacts.companyName}, ${contacts.firstName} || ' ' || ${contacts.lastName})`
        })
            .from(invoices)
            .leftJoin(contacts, eq(invoices.contactId, contacts.id))
            .where(baseCondition)
            .orderBy(desc(invoices.createdAt));
    }

    async getInvoice(id: string): Promise<any | undefined> {
        const [invoice] = await db
            .select({
                id: invoices.id,
                tenantId: invoices.tenantId,
                contactId: invoices.contactId,
                salesOrderId: invoices.salesOrderId,
                branchId: invoices.branchId,
                invoiceNumber: invoices.invoiceNumber,
                invoiceDate: invoices.invoiceDate,
                dueDate: invoices.dueDate,
                type: invoices.type,
                status: invoices.status,
                subtotal: invoices.subtotal,
                taxAmount: invoices.taxAmount,
                totalAmount: invoices.totalAmount,
                paidAmount: invoices.paidAmount,
                notes: invoices.notes,
                ebarimtQrCode: invoices.ebarimtQrCode,
                ebarimtReceiptNumber: invoices.ebarimtReceiptNumber,
                ebarimtLotteryNumber: invoices.ebarimtLotteryNumber,
                ebarimtDocumentId: invoices.ebarimtDocumentId,
                createdBy: invoices.createdBy,
                createdAt: invoices.createdAt,
                updatedAt: invoices.updatedAt,
                contactName: sql<string>`COALESCE(${contacts.companyName}, ${contacts.firstName} || ' ' || ${contacts.lastName})`,
            })
            .from(invoices)
            .leftJoin(contacts, eq(invoices.contactId, contacts.id))
            .where(eq(invoices.id, id));
        if (!invoice) return undefined;

        const lines = await db.select().from(invoiceLines).where(eq(invoiceLines.invoiceId, id));
        return { ...invoice, lines };
    }

    async createInvoice(invoice: DbInsertInvoice, lines: Omit<DbInsertInvoiceLine, 'invoiceId'>[]): Promise<Invoice> {
        const [newInvoice] = await db.insert(invoices).values(invoice).returning();

        for (const line of lines) {
            await db.insert(invoiceLines).values({ ...line, invoiceId: newInvoice.id, tenantId: invoice.tenantId });
        }

        return newInvoice;
    }

    async updateInvoiceStatus(id: string, status: string, paidAmount?: number): Promise<void> {
        const update: any = { status, updatedAt: new Date() };
        if (paidAmount !== undefined) {
            update.paidAmount = paidAmount.toString();
        }
        await db.update(invoices).set(update).where(eq(invoices.id, id));
    }

    async updateInvoiceEBarimt(
        id: string,
        documentId: string,
        qrCode?: string,
        receiptNumber?: string,
        lotteryNumber?: string
    ): Promise<void> {
        await db
            .update(invoices)
            .set({
                ebarimtDocumentId: documentId,
                ebarimtQrCode: qrCode || null,
                ebarimtReceiptNumber: receiptNumber || null,
                ebarimtLotteryNumber: lotteryNumber || null,
                ebarimtSentAt: new Date(),
                updatedAt: new Date(),
            })
            .where(eq(invoices.id, id));
    }

    async deleteInvoice(id: string): Promise<void> {
        await db.delete(invoiceLines).where(eq(invoiceLines.invoiceId, id));
        await db.delete(invoices).where(eq(invoices.id, id));
    }

    // --- Accounting: Currencies ---
    async getCurrencies(tenantId: string): Promise<Currency[]> {
        return await db.select().from(currencies).where(eq(currencies.tenantId, tenantId));
    }

    async createCurrency(currency: DbInsertCurrency): Promise<Currency> {
        const [newCurrency] = await db.insert(currencies).values(currency).returning();
        return newCurrency;
    }

    // --- Accounting: Accounts (Chart of Accounts) ---
    async getAccounts(tenantId: string): Promise<Account[]> {
        return await db.select().from(accounts).where(eq(accounts.tenantId, tenantId));
    }

    async getAccount(id: string): Promise<Account | undefined> {
        const [account] = await db.select().from(accounts).where(eq(accounts.id, id));
        return account;
    }

    async createAccount(account: DbInsertAccount): Promise<Account> {
        const [newAccount] = await db.insert(accounts).values(account).returning();
        return newAccount;
    }

    async updateAccount(id: string, account: Partial<InsertAccount>): Promise<Account> {
        const [updated] = await db.update(accounts).set(account).where(eq(accounts.id, id)).returning();
        return updated;
    }

    // --- Accounting: Journals ---
    async getJournals(tenantId: string): Promise<Journal[]> {
        return await db.select().from(journals).where(eq(journals.tenantId, tenantId));
    }

    async getJournal(id: string): Promise<Journal | undefined> {
        const [journal] = await db.select().from(journals).where(eq(journals.id, id));
        return journal;
    }

    async createJournal(journal: DbInsertJournal): Promise<Journal> {
        const [newJournal] = await db.insert(journals).values(journal).returning();
        return newJournal;
    }

    // --- Accounting: Journal Entries ---
    async getJournalEntries(tenantId: string, filters?: { journalId?: string; status?: string; startDate?: string; endDate?: string }): Promise<any[]> {
        const conditions = [eq(journalEntries.tenantId, tenantId)];

        if (filters?.journalId) {
            conditions.push(eq(journalEntries.journalId, filters.journalId));
        }
        if (filters?.status) {
            conditions.push(eq(journalEntries.status, filters.status));
        }
        if (filters?.startDate) {
            conditions.push(sql`${journalEntries.entryDate} >= ${filters.startDate}`);
        }
        if (filters?.endDate) {
            conditions.push(sql`${journalEntries.entryDate} <= ${filters.endDate}`);
        }

        const query = db.select({
            id: journalEntries.id,
            entryNumber: journalEntries.entryNumber,
            entryDate: journalEntries.entryDate,
            description: journalEntries.description,
            status: journalEntries.status,
            reference: journalEntries.reference,
            journalId: journalEntries.journalId,
            journalName: journals.name,
            postedBy: journalEntries.postedBy,
            postedAt: journalEntries.postedAt,
            createdAt: journalEntries.createdAt,
        })
            .from(journalEntries)
            .leftJoin(journals, eq(journalEntries.journalId, journals.id))
            .where(and(...conditions))
            .orderBy(desc(journalEntries.createdAt));

        return await query;
    }

    async getJournalEntry(id: string): Promise<any | undefined> {
        const [entry] = await db.select({
            id: journalEntries.id,
            tenantId: journalEntries.tenantId,
            entryNumber: journalEntries.entryNumber,
            entryDate: journalEntries.entryDate,
            description: journalEntries.description,
            status: journalEntries.status,
            reference: journalEntries.reference,
            journalId: journalEntries.journalId,
            journalName: journals.name,
            postedBy: journalEntries.postedBy,
            postedAt: journalEntries.postedAt,
            reversalEntryId: journalEntries.reversalEntryId,
            reversedByEntryId: journalEntries.reversedByEntryId,
            createdAt: journalEntries.createdAt,
        })
            .from(journalEntries)
            .leftJoin(journals, eq(journalEntries.journalId, journals.id))
            .where(eq(journalEntries.id, id));

        if (!entry) return undefined;

        const lines = await db.select({
            id: journalLines.id,
            entryId: journalLines.entryId,
            accountId: journalLines.accountId,
            accountCode: accounts.code,
            accountName: accounts.name,
            debit: journalLines.debit,
            credit: journalLines.credit,
            description: journalLines.description,
            partnerId: journalLines.partnerId,
            amountCurrency: journalLines.amountCurrency,
            currencyId: journalLines.currencyId,
            currencyRate: journalLines.currencyRate,
            reference: journalLines.reference,
        })
            .from(journalLines)
            .leftJoin(accounts, eq(journalLines.accountId, accounts.id))
            .where(eq(journalLines.entryId, id));

        const linesWithTax = await Promise.all(lines.map(async (line) => {
            const taxLinesData = await db.select({
                id: taxLines.id,
                taxCodeId: taxLines.taxCodeId,
                taxCode: taxCodes.code,
                taxBase: taxLines.taxBase,
                taxAmount: taxLines.taxAmount,
                sourceType: taxLines.sourceType,
                reference: taxLines.reference,
                referenceId: taxLines.referenceId,
            })
                .from(taxLines)
                .leftJoin(taxCodes, eq(taxLines.taxCodeId, taxCodes.id))
                .where(eq(taxLines.journalLineId, line.id));

            return { ...line, taxLines: taxLinesData };
        }));

        return { ...entry, lines: linesWithTax };
    }

    async createJournalEntry(entry: DbInsertJournalEntry, lines: DbInsertJournalLine[]): Promise<JournalEntry> {
        const [newEntry] = await db.insert(journalEntries).values(entry).returning();

        for (const line of lines) {
            await db.insert(journalLines).values({ ...line, entryId: newEntry.id });
        }

        return newEntry;
    }

    async updateJournalEntryStatus(id: string, status: string, postedBy?: string): Promise<void> {
        const update: any = { status };
        if (status === "posted") {
            update.postedAt = new Date();
            if (postedBy) {
                update.postedBy = postedBy;
            }
        }
        await db.update(journalEntries).set(update).where(eq(journalEntries.id, id));
    }

    async reverseJournalEntry(id: string, entryDate: string, description: string, reversedBy: string): Promise<JournalEntry> {
        const originalEntry = await this.getJournalEntry(id);
        if (!originalEntry || originalEntry.status !== "posted") {
            throw new Error("Journal entry not found or not posted");
        }

        if (originalEntry.status === "reversed" || originalEntry.reversedByEntryId) {
            throw new Error("Journal entry already reversed");
        }

        const { getNextReversalNumber } = await import("../numbering");
        const reversalDate = new Date(entryDate);
        const reversalEntryNumber = await getNextReversalNumber(
            originalEntry.tenantId,
            null,
            reversalDate.getFullYear()
        );

        const [reversalEntry] = await db.insert(journalEntries).values({
            tenantId: originalEntry.tenantId,
            journalId: originalEntry.journalId,
            entryNumber: reversalEntryNumber,
            entryDate,
            description: description || `Reversal of ${originalEntry.entryNumber}`,
            status: "posted",
            reference: originalEntry.entryNumber || null,
            reversalEntryId: id,
            postedBy: reversedBy,
            postedAt: new Date(),
        } as DbInsertJournalEntry).returning();

        const originalLines = originalEntry.lines || [];
        if (originalLines.length === 0) {
            throw new Error("Original entry has no lines");
        }

        for (const line of originalLines) {
            const [reversedLine] = await db.insert(journalLines).values({
                entryId: reversalEntry.id,
                accountId: line.accountId,
                debit: line.credit,
                credit: line.debit,
                description: `Reversal: ${line.description || ""}`,
                partnerId: line.partnerId || null,
                amountCurrency: line.amountCurrency || null,
                currencyId: line.currencyId || null,
                currencyRate: line.currencyRate || "1.0000",
                reference: line.reference || null,
            } as DbInsertJournalLine).returning();

            if (line.taxLines && line.taxLines.length > 0) {
                for (const taxLine of line.taxLines) {
                    await db.insert(taxLines).values({
                        journalLineId: reversedLine.id,
                        taxCodeId: taxLine.taxCodeId,
                        taxBase: taxLine.taxBase,
                        taxAmount: taxLine.taxAmount,
                        sourceType: "reversal",
                        reference: taxLine.reference || null,
                        referenceId: taxLine.referenceId || null,
                    } as InsertTaxLine);
                }
            }
        }

        await db.update(journalEntries).set({
            reversedByEntryId: reversalEntry.id,
            status: "reversed",
        }).where(eq(journalEntries.id, id));

        return reversalEntry;
    }

    // --- Accounting: Posting Engine ---
    async previewPosting(modelType: string, modelId: string): Promise<any> {
        let tenantId: string;
        if (modelType === "invoice") {
            const [invoice] = await db.select().from(invoices).where(eq(invoices.id, modelId)).limit(1);
            if (!invoice) throw new Error("Invoice not found");
            tenantId = invoice.tenantId;
        } else if (modelType === "payment") {
            const [payment] = await db.select().from(payments).where(eq(payments.id, modelId)).limit(1);
            if (!payment) throw new Error("Payment not found");
            tenantId = payment.tenantId;
        } else {
            throw new Error(`Unsupported model type: ${modelType}`);
        }

        return await previewPosting(tenantId, modelType, modelId);
    }

    async postDocument(modelType: string, modelId: string, journalId?: string, entryDate?: string, postedBy?: string): Promise<JournalEntry> {
        let tenantId: string;
        if (modelType === "invoice") {
            const [invoice] = await db.select().from(invoices).where(eq(invoices.id, modelId)).limit(1);
            if (!invoice) throw new Error("Invoice not found");
            tenantId = invoice.tenantId;
        } else if (modelType === "payment") {
            const [payment] = await db.select().from(payments).where(eq(payments.id, modelId)).limit(1);
            if (!payment) throw new Error("Payment not found");
            tenantId = payment.tenantId;
        } else {
            throw new Error(`Unsupported model type: ${modelType}`);
        }

        return await postDocument(tenantId, modelType, modelId, journalId, entryDate, postedBy);
    }

    // --- Accounting: Tax Codes ---
    async getTaxCodes(tenantId: string): Promise<TaxCode[]> {
        return await db.select().from(taxCodes).where(eq(taxCodes.tenantId, tenantId));
    }

    async createTaxCode(taxCode: DbInsertTaxCode): Promise<TaxCode> {
        const [newTaxCode] = await db.insert(taxCodes).values(taxCode).returning();
        return newTaxCode;
    }

    // --- Accounting: Payments ---
    async getPayments(tenantId: string, type?: string): Promise<any[]> {
        const baseCondition = type
            ? and(eq(payments.tenantId, tenantId), eq(payments.type, type))
            : eq(payments.tenantId, tenantId);

        return await db.select({
            id: payments.id,
            paymentNumber: payments.paymentNumber,
            paymentDate: payments.paymentDate,
            type: payments.type,
            amount: payments.amount,
            status: payments.status,
            paymentMethod: payments.paymentMethod,
            reference: payments.reference,
            createdAt: payments.createdAt,
        })
            .from(payments)
            .where(baseCondition);
    }

    async getPayment(id: string): Promise<any | undefined> {
        const [payment] = await db.select().from(payments).where(eq(payments.id, id));
        if (!payment) return undefined;

        const allocations = await db.select({
            id: paymentAllocations.id,
            invoiceId: paymentAllocations.invoiceId,
            invoiceNumber: invoices.invoiceNumber,
            allocatedAmount: paymentAllocations.allocatedAmount,
            allocationDate: paymentAllocations.allocationDate,
        })
            .from(paymentAllocations)
            .leftJoin(invoices, eq(paymentAllocations.invoiceId, invoices.id))
            .where(eq(paymentAllocations.paymentId, id));

        return { ...payment, allocations };
    }

    async createPayment(payment: DbInsertPayment): Promise<Payment> {
        const [newPayment] = await db.insert(payments).values(payment).returning();
        return newPayment;
    }

    async createPaymentAllocation(paymentId: string, invoiceId: string, amount: number, allocationDate: string): Promise<void> {
        await db.insert(paymentAllocations).values({
            paymentId,
            invoiceId,
            allocatedAmount: amount.toString(),
            allocationDate,
        } as any);
    }

    // --- Accounting: Reports ---
    async getTrialBalance(tenantId: string, startDate?: string, endDate?: string): Promise<any> {
        return await getTrialBalance(tenantId, startDate, endDate);
    }

    async getBalanceSheet(tenantId: string, asOfDate?: string): Promise<any> {
        return await getBalanceSheet(tenantId, asOfDate);
    }

    async getProfitAndLoss(tenantId: string, startDate?: string, endDate?: string): Promise<any> {
        return await getProfitAndLoss(tenantId, startDate, endDate);
    }

    async getVATReport(tenantId: string, startDate?: string, endDate?: string): Promise<any> {
        return await getVATReport(tenantId, startDate, endDate);
    }

    // --- Bank Accounts ---
    async getBankAccounts(tenantId: string): Promise<any[]> {
        return await db
            .select({
                id: bankAccounts.id,
                accountNumber: bankAccounts.accountNumber,
                bankName: bankAccounts.bankName,
                balance: bankAccounts.balance,
                isActive: bankAccounts.isActive,
            })
            .from(bankAccounts)
            .where(eq(bankAccounts.tenantId, tenantId))
            .orderBy(bankAccounts.bankName, bankAccounts.accountNumber);
    }

    async getBankAccount(id: string): Promise<any | undefined> {
        const [account] = await db.select().from(bankAccounts).where(eq(bankAccounts.id, id)).limit(1);
        return account;
    }

    async createBankAccount(data: {
        tenantId: string;
        accountNumber: string;
        bankName: string;
        currencyId?: string;
        balance?: string;
        accountId?: string;
    }): Promise<any> {
        let glAccountId = data.accountId || null;

        if (!glAccountId) {
            const existingAccounts = await db
                .select({ code: accounts.code })
                .from(accounts)
                .where(
                    and(
                        eq(accounts.tenantId, data.tenantId),
                        sql`${accounts.code} LIKE '10%'`
                    )
                )
                .orderBy(desc(accounts.code))
                .limit(1);

            let nextCode = "1001";
            if (existingAccounts.length > 0 && existingAccounts[0].code) {
                const lastNum = parseInt(existingAccounts[0].code, 10);
                nextCode = (lastNum + 1).toString();
            }

            const accountName = `${data.bankName} - ${data.accountNumber}`;
            // @ts-ignore
            const [glAccount] = await db.insert(accounts).values({
                tenantId: data.tenantId,
                code: nextCode,
                name: accountName,
                type: "asset",
                level: 2,
                isActive: true,
            }).returning();

            glAccountId = glAccount.id;
        }

        const [created] = await db.insert(bankAccounts).values({
            tenantId: data.tenantId,
            accountNumber: data.accountNumber,
            bankName: data.bankName,
            currencyId: data.currencyId || null,
            balance: data.balance || "0",
            accountId: glAccountId,
            isActive: true,
        }).returning();

        return created;
    }

    async updateBankAccount(id: string, data: Partial<{
        accountNumber: string;
        bankName: string;
        balance: string;
        isActive: boolean;
    }>): Promise<any> {
        const [updated] = await db.update(bankAccounts)
            .set(data)
            .where(eq(bankAccounts.id, id))
            .returning();
        return updated;
    }

    // --- Bank Statements ---
    async getBankStatements(tenantId: string, bankAccountId?: string): Promise<any[]> {
        const conditions: any[] = [eq(bankStatements.tenantId, tenantId)];
        if (bankAccountId) {
            conditions.push(eq(bankStatements.bankAccountId, bankAccountId));
        }
        return await db
            .select({
                id: bankStatements.id,
                bankAccountId: bankStatements.bankAccountId,
                statementDate: bankStatements.statementDate,
                openingBalance: bankStatements.openingBalance,
                closingBalance: bankStatements.closingBalance,
                importedAt: bankStatements.importedAt,
            })
            .from(bankStatements)
            .where(and(...conditions))
            .orderBy(desc(bankStatements.statementDate));
    }

    async getBankStatement(id: string): Promise<any | undefined> {
        const [statement] = await db.select().from(bankStatements).where(eq(bankStatements.id, id)).limit(1);
        return statement;
    }

    async createBankStatement(statement: any, lines: any[]): Promise<any> {
        const [created] = await db.insert(bankStatements).values(statement).returning();

        if (lines && lines.length > 0) {
            await db.insert(bankStatementLines).values(
                lines.map((line) => ({
                    statementId: created.id,
                    date: line.date,
                    description: line.description || null,
                    debit: (line.debit || 0).toString(),
                    credit: (line.credit || 0).toString(),
                    balance: line.balance.toString(),
                    reference: line.reference || null,
                    reconciled: false,
                }))
            );
        }

        return created;
    }

    async getBankStatementLines(statementId: string): Promise<any[]> {
        return await db
            .select()
            .from(bankStatementLines)
            .where(eq(bankStatementLines.statementId, statementId))
            .orderBy(bankStatementLines.date);
    }

    // --- Bank Reconciliation ---
    async getUnreconciledBankLines(tenantId: string, bankAccountId?: string): Promise<any[]> {
        const baseQuery = db
            .select({
                id: bankStatementLines.id,
                statementId: bankStatementLines.statementId,
                date: bankStatementLines.date,
                description: bankStatementLines.description,
                debit: bankStatementLines.debit,
                credit: bankStatementLines.credit,
                balance: bankStatementLines.balance,
                reference: bankStatementLines.reference,
                reconciled: bankStatementLines.reconciled,
                bankAccountId: bankStatements.bankAccountId,
                bankName: bankAccounts.bankName,
                accountNumber: bankAccounts.accountNumber,
            })
            .from(bankStatementLines)
            .innerJoin(bankStatements, eq(bankStatementLines.statementId, bankStatements.id))
            .innerJoin(bankAccounts, eq(bankStatements.bankAccountId, bankAccounts.id))
            .where(
                and(
                    eq(bankStatements.tenantId, tenantId),
                    eq(bankStatementLines.reconciled, false),
                    bankAccountId ? eq(bankStatements.bankAccountId, bankAccountId) : undefined
                )
            )
            .orderBy(desc(bankStatementLines.date));

        return await baseQuery;
    }

    async getUnpaidInvoices(tenantId: string, type?: string): Promise<any[]> {
        const conditions: any[] = [
            eq(invoices.tenantId, tenantId),
            or(
                eq(invoices.status, 'sent'),
                eq(invoices.status, 'draft'),
                and(
                    eq(invoices.status, 'paid'),
                    sql`CAST(${invoices.paidAmount} AS NUMERIC) < CAST(${invoices.totalAmount} AS NUMERIC)`
                )
            )
        ];

        if (type) {
            conditions.push(eq(invoices.type, type));
        }

        return await db
            .select({
                id: invoices.id,
                invoiceNumber: invoices.invoiceNumber,
                invoiceDate: invoices.invoiceDate,
                dueDate: invoices.dueDate,
                type: invoices.type,
                status: invoices.status,
                totalAmount: invoices.totalAmount,
                paidAmount: invoices.paidAmount,
                remainingAmount: sql<string>`CAST(${invoices.totalAmount} AS NUMERIC) - CAST(${invoices.paidAmount} AS NUMERIC)`,
                contactId: invoices.contactId,
                contactName: sql<string>`COALESCE(${contacts.companyName}, ${contacts.firstName} || ' ' || ${contacts.lastName})`,
            })
            .from(invoices)
            .leftJoin(contacts, eq(invoices.contactId, contacts.id))
            .where(and(...conditions))
            .orderBy(desc(invoices.dueDate));
    }

    async createReconciliation(data: {
        tenantId: string;
        statementLineId: string;
        status?: string;
        notes?: string;
    }): Promise<any> {
        const [created] = await db.insert(reconciliations).values({
            tenantId: data.tenantId,
            statementLineId: data.statementLineId,
            status: data.status || 'draft',
            totalMatchedAmount: '0',
            notes: data.notes || null,
        }).returning();
        return created;
    }

    async addReconciliationMatch(data: {
        reconciliationId: string;
        invoiceId?: string;
        paymentId?: string;
        journalLineId?: string;
        matchedAmount: number;
        matchDate: string;
        notes?: string;
    }): Promise<any> {
        const [match] = await db.insert(reconciliationMatches).values({
            reconciliationId: data.reconciliationId,
            invoiceId: data.invoiceId || null,
            paymentId: data.paymentId || null,
            journalLineId: data.journalLineId || null,
            matchedAmount: data.matchedAmount.toString(),
            matchDate: data.matchDate,
            notes: data.notes || null,
        }).returning();

        await db.execute(sql`
      UPDATE reconciliations 
      SET total_matched_amount = (
        SELECT COALESCE(SUM(CAST(matched_amount AS NUMERIC)), 0)
        FROM reconciliation_matches 
        WHERE reconciliation_id = ${data.reconciliationId}
      )
      WHERE id = ${data.reconciliationId}
    `);

        return match;
    }

    async confirmReconciliation(reconciliationId: string, userId: string): Promise<any> {
        const [rec] = await db.select().from(reconciliations).where(eq(reconciliations.id, reconciliationId)).limit(1);
        if (!rec) throw new Error('Reconciliation not found');

        await db.update(bankStatementLines)
            .set({ reconciled: true })
            .where(eq(bankStatementLines.id, rec.statementLineId));

        const [updated] = await db.update(reconciliations)
            .set({
                status: 'reconciled',
                reconciledAt: new Date(),
                reconciledBy: userId,
            })
            .where(eq(reconciliations.id, reconciliationId))
            .returning();

        return updated;
    }

    async getReconciliations(tenantId: string, status?: string): Promise<any[]> {
        const conditions: any[] = [eq(reconciliations.tenantId, tenantId)];
        if (status) {
            conditions.push(eq(reconciliations.status, status));
        }

        return await db
            .select({
                id: reconciliations.id,
                statementLineId: reconciliations.statementLineId,
                status: reconciliations.status,
                totalMatchedAmount: reconciliations.totalMatchedAmount,
                reconciledAt: reconciliations.reconciledAt,
                createdAt: reconciliations.createdAt,
                lineDate: bankStatementLines.date,
                lineDescription: bankStatementLines.description,
                lineDebit: bankStatementLines.debit,
                lineCredit: bankStatementLines.credit,
            })
            .from(reconciliations)
            .leftJoin(bankStatementLines, eq(reconciliations.statementLineId, bankStatementLines.id))
            .where(and(...conditions))
            .orderBy(desc(reconciliations.createdAt));
    }

    async getReconciliationMatches(reconciliationId: string): Promise<any[]> {
        return await db
            .select({
                id: reconciliationMatches.id,
                matchedAmount: reconciliationMatches.matchedAmount,
                matchDate: reconciliationMatches.matchDate,
                invoiceId: reconciliationMatches.invoiceId,
                invoiceNumber: invoices.invoiceNumber,
                paymentId: reconciliationMatches.paymentId,
                notes: reconciliationMatches.notes,
            })
            .from(reconciliationMatches)
            .leftJoin(invoices, eq(reconciliationMatches.invoiceId, invoices.id))
            .where(eq(reconciliationMatches.reconciliationId, reconciliationId));
    }

    // --- QPay ---
    async getQPaySettings(tenantId: string): Promise<QPaySettings | undefined> {
        const [settings] = await db.select().from(qpaySettings).where(eq(qpaySettings.tenantId, tenantId)).limit(1);
        return settings;
    }

    async updateQPaySettings(tenantId: string, settings: Partial<QPaySettings>): Promise<QPaySettings> {
        const existing = await this.getQPaySettings(tenantId);

        if (existing) {
            const [updated] = await db
                .update(qpaySettings)
                .set({ ...settings, updatedAt: new Date() })
                .where(eq(qpaySettings.id, existing.id))
                .returning();
            return updated;
        } else {
            const [created] = await db
                .insert(qpaySettings)
                .values({
                    tenantId,
                    ...settings,
                } as DbInsertQPaySettings)
                .returning();
            return created;
        }
    }

    async getQPayInvoiceByInvoiceId(invoiceId: string): Promise<QPayInvoice | undefined> {
        const [invoice] = await db
            .select()
            .from(qpayInvoices)
            .where(eq(qpayInvoices.invoiceId, invoiceId))
            .limit(1);
        return invoice;
    }

    async createQPayInvoice(qpayInvoice: DbInsertQPayInvoice): Promise<QPayInvoice> {
        const [created] = await db.insert(qpayInvoices).values(qpayInvoice).returning();
        return created;
    }

    async updateQPayInvoice(id: string, qpayInvoice: Partial<QPayInvoice>): Promise<QPayInvoice> {
        const [updated] = await db
            .update(qpayInvoices)
            .set({ ...qpayInvoice, updatedAt: new Date() })
            .where(eq(qpayInvoices.id, id))
            .returning();
        return updated;
    }

    async attachPaymentToQPayInvoice(qpayInvoiceId: string, paymentId: string): Promise<void> {
        await db
            .update(qpayInvoices)
            .set({ paymentId, status: "paid", updatedAt: new Date() })
            .where(eq(qpayInvoices.id, qpayInvoiceId));
    }

    // --- E-barimt Settings ---
    async getEBarimtSettings(tenantId: string): Promise<EBarimtSettings | undefined> {
        const [settings] = await db
            .select()
            .from(ebarimtSettings)
            .where(eq(ebarimtSettings.tenantId, tenantId))
            .limit(1);
        return settings;
    }

    async updateEBarimtSettings(
        tenantId: string,
        settings: Partial<EBarimtSettings>
    ): Promise<EBarimtSettings> {
        const existing = await this.getEBarimtSettings(tenantId);

        if (existing) {
            const [updated] = await db
                .update(ebarimtSettings)
                .set({ ...settings, updatedAt: new Date() })
                .where(eq(ebarimtSettings.id, existing.id))
                .returning();
            return updated;
        } else {
            const [created] = await db
                .insert(ebarimtSettings)
                .values({
                    ...settings,
                    tenantId,
                } as DbInsertEBarimtSettings)
                .returning();
            return created;
        }
    }

    // --- Audit Log ---
    async createAuditLog(log: DbInsertAuditLog): Promise<AuditLog> {
        const [created] = await db.insert(auditLogs).values(log).returning();
        return created;
    }

    async getAuditLogs(
        tenantId: string,
        filters?: {
            entityType?: string;
            entityId?: string;
            action?: string;
            startDate?: Date;
            endDate?: Date;
            limit?: number;
        }
    ): Promise<AuditLog[]> {
        const conditions = [eq(auditLogs.tenantId, tenantId)];

        if (filters?.entityType) {
            conditions.push(eq(auditLogs.entity, filters.entityType));
        }
        if (filters?.entityId) {
            conditions.push(eq(auditLogs.entityId, filters.entityId));
        }
        if (filters?.action) {
            conditions.push(eq(auditLogs.action, filters.action));
        }
        if (filters?.startDate) {
            conditions.push(sql`${auditLogs.createdAt} >= ${filters.startDate}`);
        }
        if (filters?.endDate) {
            conditions.push(sql`${auditLogs.createdAt} <= ${filters.endDate}`);
        }

        let query = db
            .select()
            .from(auditLogs)
            .where(and(...conditions))
            .orderBy(desc(auditLogs.createdAt))
            .limit(filters?.limit || 100);

        return await query;
    }
}
