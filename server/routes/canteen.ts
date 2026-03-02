
import { Router } from "express";
import { storage } from "../storage";
import { requireTenant } from "../middleware/tenant";
import { z } from "zod";
import { insertCanteenMenuSchema } from "@shared/schema";
import { isEmployee, isAdmin, isHR } from "@shared/roles";

const router = Router();

// --- Wallet (Employee) ---

// Get my wallet
router.get("/wallet/me", requireTenant, async (req: any, res) => {
    try {
        const employee = await storage.getEmployeeByUserId(req.user.id);
        if (!employee) return res.status(404).json({ message: "Employee profile not found" });

        const wallet = await storage.getCanteenWallet(req.tenantId, employee.id);
        // Current widget relies on this returning transactions inline for MVP
        // but for full page history we use specialized endpoint. 
        // We keep this for backward compat with widget for now or optimize later.
        const transactions = await storage.getWalletTransactions(wallet.id);

        res.json({ ...wallet, transactions });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to fetch wallet" });
    }
});

router.get("/wallet/me/transactions", requireTenant, async (req: any, res) => {
    try {
        const employee = await storage.getEmployeeByUserId(req.user.id);
        if (!employee) return res.status(404).json({ message: "Employee profile not found" });

        const wallet = await storage.getCanteenWallet(req.tenantId, employee.id);
        // Reuse admin/generic transaction fetcher but for ME
        const transactions = await storage.getWalletTransactions(wallet.id);
        // In future: add limit/offset support to storage.getWalletTransactions

        res.json(transactions);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to fetch transactions" });
    }
});

// --- Employee Pre-order (Self-Service) ---

router.post("/me/orders", requireTenant, async (req: any, res) => {
    try {
        const employee = await storage.getEmployeeByUserId(req.user.id);
        if (!employee) return res.status(404).json({ message: "Employee profile not found" });

        const schema = z.object({
            date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
            mealType: z.enum(["lunch", "dinner"])
        });
        const data = schema.parse(req.body);

        // Check if already served
        const existingServings = await storage.getMealServings(req.tenantId, data.date);
        const alreadyServed = existingServings.find(s => s.employeeId === employee.id && s.mealType === data.mealType && s.status === 'served');
        if (alreadyServed) return res.status(409).json({ message: "Already served this meal" });

        // Create Intent
        const order = await storage.createMealOrder({
            tenantId: req.tenantId,
            employeeId: employee.id,
            date: data.date,
            mealType: data.mealType,
            status: "pending"
        });

        res.json(order);
    } catch (e: any) {
        if (e instanceof z.ZodError) return res.status(400).json(e.errors);
        console.error(e);
        res.status(500).json({ message: "Failed to create order" });
    }
});

router.get("/me/orders", requireTenant, async (req: any, res) => {
    try {
        const employee = await storage.getEmployeeByUserId(req.user.id);
        if (!employee) return res.status(404).json({ message: "Employee profile not found" });

        const orders = await storage.getMealOrders(req.tenantId, employee.id);
        res.json(orders);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to fetch orders" });
    }
});

router.post("/me/orders/:id/cancel", requireTenant, async (req: any, res) => {
    try {
        const employee = await storage.getEmployeeByUserId(req.user.id);
        if (!employee) return res.status(404).json({ message: "Employee profile not found" });

        const order = await storage.cancelMealOrder(req.tenantId, req.params.id, employee.id);
        res.json(order);
    } catch (e: any) {
        if (e.message === "Order not found or not pending") {
            return res.status(400).json({ message: "Order cannot be cancelled" });
        }
        console.error(e);
        res.status(500).json({ message: "Failed to cancel order" });
    }
});

router.post("/wallet/adjust-bulk", requireTenant, async (req: any, res) => {
    try {
        if (!isAdmin(req.user.role) && !isHR(req.user.role)) return res.status(403).json({ message: "Forbidden" });

        const schema = z.object({
            walletIds: z.array(z.string().uuid()),
            amount: z.number().int().refine(val => val !== 0, "Amount cannot be 0"),
            note: z.string().optional()
        });
        const data = schema.parse(req.body);

        const count = await (storage as any).bulkAdjustWallets({
            tenantId: req.tenantId,
            walletIds: data.walletIds,
            amount: data.amount,
            note: data.note,
            actorId: req.user.id
        });

        res.json({ updatedCount: count, message: `${count} wallets updated` });
    } catch (e: any) {
        if (e instanceof z.ZodError) return res.status(400).json(e.errors);
        console.error(e);
        res.status(500).json({ message: "Failed to bulk adjust wallets" });
    }
});

// Admin: Get any wallet ?? (Maybe later)

// Admin: Top-up check
const topUpSchema = z.object({
    employeeId: z.string().uuid(),
    amount: z.number().int().positive(), // Only positive credits via this endpoint
    description: z.string().optional()
});

router.post("/wallet/topup", requireTenant, async (req: any, res) => {
    try {
        // Permission check: Admin or HR
        if (!isAdmin(req.user.role) && !isHR(req.user.role)) {
            return res.status(403).json({ message: "Forbidden" });
        }

        const data = topUpSchema.parse(req.body);

        const wallet = await storage.getCanteenWallet(req.tenantId, data.employeeId);
        const transaction = await storage.topUpWallet({
            tenantId: req.tenantId,
            walletId: wallet.id,
            amount: data.amount,
            type: "credit",
            referenceType: "manual_topup",
            description: data.description || "Manual Top-up",
            actorId: req.user.id
        });

        res.json(transaction);
    } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json(e.errors);
        console.error(e);
        res.status(500).json({ message: "Failed to top-up wallet" });
    }
});


// --- Employee Search (for Terminal) ---

router.get("/employees/search", requireTenant, async (req: any, res) => {
    try {
        if (!isAdmin(req.user.role) && !isHR(req.user.role)) return res.status(403).json({ message: "Forbidden" });

        const query = (req.query.q as string || "").toLowerCase();
        if (!query || query.length < 2) return res.json([]);

        // Get all employees (inefficient but works for now, optimization later)
        const employees = await storage.getEmployees(req.tenantId);

        // Filter by code, name, phone
        const matches = employees.filter(e =>
            (e.employeeNo && e.employeeNo.toLowerCase().includes(query)) ||
            (e.firstName && e.firstName.toLowerCase().includes(query)) ||
            (e.lastName && e.lastName.toLowerCase().includes(query)) ||
            (e.phone && e.phone.includes(query))
        );

        // Map with balance
        const results = await Promise.all(matches.slice(0, 10).map(async e => {
            const wallet = await storage.getCanteenWallet(req.tenantId, e.id);
            return {
                id: e.id,
                employeeNo: e.employeeNo,
                firstName: e.firstName,
                lastName: e.lastName,
                departmentId: e.departmentId,
                wallet
            };
        }));

        res.json(results);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to search employees" });
    }
});


// --- Menu ---

router.get("/menu", requireTenant, async (req: any, res) => {
    try {
        // Query: date (default today), type (optional)
        const dateStr = req.query.date ? String(req.query.date) : new Date().toISOString().split('T')[0];
        const type = req.query.type ? String(req.query.type) : undefined;
        // Logic to get menu. Storage `getCanteenMenu` only gets single. 
        // Admin might want list? For serving we usually need specific meal for today.
        // Let's implement getting specific meal.
        if (!type) return res.status(400).json({ message: "Meal type required" });

        const menu = await storage.getCanteenMenu(req.tenantId, dateStr, type);
        res.json(menu || null);
    } catch (e) {
        res.status(500).json({ message: "Failed to fetch menu" });
    }
});

router.post("/menu", requireTenant, async (req: any, res) => {
    try {
        if (!isAdmin(req.user.role) && !isHR(req.user.role)) return res.status(403).json({ message: "Forbidden" });

        const data = insertCanteenMenuSchema.parse({
            ...req.body,
            tenantId: req.tenantId
        });

        const menu = await storage.upsertCanteenMenu(data);
        res.json(menu);
    } catch (e) {
        if (e instanceof z.ZodError) return res.status(400).json(e.errors);
        res.status(500).json({ message: "Failed to save menu" });
    }
});


// --- Serve (Kitchen) ---

const serveSchema = z.object({
    employeeId: z.string().uuid(),
    mealType: z.enum(["lunch", "dinner", "breakfast"]),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    price: z.number().int().nonnegative() // Price can be 0 (subsidy)
});

router.post("/serve", requireTenant, async (req: any, res) => {
    try {
        // Permission: Admin, HR, or Kitchen (if we had it). For now Admin/HR.
        // Or any employee? NO.
        if (!isAdmin(req.user.role) && !isHR(req.user.role)) {
            // Check if specifically authorized user?
            // For MVP, Admin/HR is fine.
            return res.status(403).json({ message: "Forbidden" });
        }

        const data = serveSchema.parse(req.body);
        const source = req.body.source || "terminal";
        const note = req.body.note || "";

        let description = `${data.mealType} served`;
        if (source === "admin_manual") {
            description = `[MANUAL] ${note || 'Manual serving'}`;
        }

        // Check duplicate serving (handled by DB unique constraint, but good to catch friendly)
        const existing = await storage.getMealServings(req.tenantId, data.date);
        const dup = existing.find(s => s.employeeId === data.employeeId && s.mealType === data.mealType && s.status === 'served');
        if (dup) return res.status(409).json({ message: "Employee already served this meal" });

        const serving = await storage.serveMeal({
            tenantId: req.tenantId,
            employeeId: data.employeeId,
            date: data.date,
            mealType: data.mealType,
            price: data.price,
            actorId: req.user.id,
            description
        });

        res.json(serving);
    } catch (e: any) {
        if (e.message === "Insufficient balance") return res.status(400).json({ message: "Insufficient wallet balance" });
        if (e.message === "Wallet not found") return res.status(404).json({ message: "Employee wallet not found" });
        if (e instanceof z.ZodError) return res.status(400).json(e.errors);
        console.error(e);
        res.status(500).json({ message: "Failed to serve meal" });
    }
});

// Stats
router.get("/stats", requireTenant, async (req: any, res) => {
    try {
        const dateStr = req.query.date ? String(req.query.date) : new Date().toISOString().split('T')[0];
        const servings = await storage.getMealServings(req.tenantId, dateStr);

        // Aggregate
        const stats = {
            total: servings.length,
            lunch: servings.filter(s => s.mealType === 'lunch').length,
            dinner: servings.filter(s => s.mealType === 'dinner').length,
            totalRevenue: servings.reduce((sum, s) => sum + s.price, 0)
        };

        res.json(stats);
    } catch (e) {
        res.status(500).json({ message: "Failed to fetch stats" });
    }
});

router.get("/admin/pending-stats", requireTenant, async (req: any, res) => {
    try {
        const dateStr = req.query.date ? String(req.query.date) : new Date().toISOString().split('T')[0];
        const stats = await storage.getPendingOrderStats(req.tenantId, dateStr);
        res.json(stats);
    } catch (e) {
        res.status(500).json({ message: "Failed to fetch pending stats" });
    }
});

// --- Admin: Menu & Manual Serving ---

// Search employees for autocomplete
router.get("/admin/employees", requireTenant, async (req: any, res) => {
    try {
        // Allow operator to see simplified list
        if (!isAdmin(req.user.role) && !isHR(req.user.role)) { // Add operator check if role exists
            // For now assume restricted to Admin/HR as per auth middleware, 
            // but user requested Operator too. 
            // If manual role check needed:
            // if (!hasRole(req.user, 'operator')) ...
        }

        const query = (req.query.query as string || "").toLowerCase();
        if (!query || query.length < 2) return res.json([]);

        // Retrieve all employees for tenant and filter in memory (for now)
        // Ideally should be storage.searchEmployees(query)
        const allEmployees = await storage.getEmployees(req.tenantId);
        const matches = allEmployees.filter(e =>
            (e.firstName?.toLowerCase().includes(query)) ||
            (e.lastName?.toLowerCase().includes(query)) ||
            (e.employeeNo?.toLowerCase().includes(query))
        ).slice(0, 20);

        res.json(matches.map(e => ({
            id: e.id,
            employeeCode: e.employeeNo,
            firstName: e.firstName,
            lastName: e.lastName,
            departmentId: e.departmentId
        })));
    } catch (e) {
        console.error("Employee search error", e);
        res.status(500).json({ message: "Search failed" });
    }
});

// Menu Management
router.get("/admin/menu", requireTenant, async (req: any, res) => {
    try {
        const { date, mealType } = req.query;
        if (!date) return res.status(400).json({ message: "Date required" });

        // If mealType provided, return single menu item
        if (mealType) {
            const menu = await storage.getCanteenMenu(req.tenantId, String(date), String(mealType));
            return res.json(menu || null);
        }

        // Otherwise return object with both lunch and dinner
        const lunch = await storage.getCanteenMenu(req.tenantId, String(date), "lunch");
        const dinner = await storage.getCanteenMenu(req.tenantId, String(date), "dinner");

        res.json({ lunch, dinner });
    } catch (e) {
        res.status(500).json({ message: "Failed to fetch menu" });
    }
});

router.get("/admin/menu/price", requireTenant, async (req: any, res) => {
    try {
        const { date, type } = req.query;
        if (!date || !type) return res.status(400).json({ message: "Date and type required" });

        const menu = await storage.getCanteenMenu(req.tenantId, String(date), String(type));
        res.json({ price: menu ? menu.price : 0 });
    } catch (e) {
        res.status(500).json({ message: "Failed to fetch price" });
    }
});

router.post("/admin/menu", requireTenant, async (req: any, res) => {
    try {
        if (!isAdmin(req.user.role) && !isHR(req.user.role)) return res.status(403).json({ message: "Forbidden" });

        const { date, mealType, price, items } = req.body;

        const menu = await storage.upsertCanteenMenu({
            tenantId: req.tenantId,
            date: date,
            mealType: mealType,
            price: price || 0,
            items: items || []
        });

        res.json(menu);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to save menu" });
    }
});

// Manual Serving (Admin/Operator)
router.post("/serve", requireTenant, async (req: any, res) => {
    try {
        // This endpoint might be used by Terminal (Token auth) OR Admin Manual (Session auth)
        // If session auth (req.user exists), check permissions
        if (req.user && !isAdmin(req.user.role) && !isHR(req.user.role)) {
            // Check for specific 'canteen_operator' role if exists, otherwise restricted
            // For now standard admin/hr check
            return res.status(403).json({ message: "Forbidden" });
        }

        const { employeeId, date, mealType, price, note, source } = req.body;
        const actorId = req.user ? req.user.id : "system"; // or terminal ID

        // Validate
        if (!employeeId || !mealType) return res.status(400).json({ message: "Missing required fields" });

        // Check duplicate if strict mode (optional, leaving flexible for now or could add check)
        const existing = await storage.getMealServings(req.tenantId, date || new Date().toISOString().split('T')[0]);
        const duplicate = existing.find(s => s.employeeId === employeeId && s.mealType === mealType && s.status !== 'voided');

        if (duplicate) {
            return res.status(409).json({ message: "Employee already served for this meal type today" });
        }

        // Serve
        const serving = await storage.serveMeal({
            tenantId: req.tenantId,
            employeeId,
            date: date || new Date().toISOString().split('T')[0],
            mealType,
            price: Number(price), // Use provided price (Manual override or Menu price)
            actorId
        });

        res.json(serving);
    } catch (e: any) {
        if (e.message === "Insufficient balance") return res.status(400).json({ message: "Insufficient wallet balance" });
        if (e.message === "Wallet not found") return res.status(404).json({ message: "Employee wallet not found" });
        console.error("Serve error:", e);
        res.status(500).json({ message: "Failed to serve meal" });
    }
});

// --- Admin: Advanced Serving Management ---

router.get("/admin/servings", requireTenant, async (req: any, res) => {
    try {
        if (!isAdmin(req.user.role) && !isHR(req.user.role)) return res.status(403).json({ message: "Forbidden" });

        const { from, to, employeeId, voided } = req.query;
        const servings = await storage.getAdminMealServings(req.tenantId, {
            fromDate: from as string,
            toDate: to as string,
            employeeId: employeeId as string,
            voided: voided === 'true' ? true : (voided === 'false' ? false : undefined)
        });
        res.json(servings);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to fetch servings" });
    }
});

router.post("/admin/void-serving", requireTenant, async (req: any, res) => {
    try {
        if (!isAdmin(req.user.role) && !isHR(req.user.role)) return res.status(403).json({ message: "Forbidden" });

        const { servingId, reason } = req.body;
        if (!servingId || !reason) return res.status(400).json({ message: "Missing servingId or reason" });

        const result = await storage.voidMealServing(servingId, reason, req.user.id);
        res.json(result);
    } catch (e: any) {
        console.error(e);
        res.status(400).json({ message: e.message || "Failed to void serving" });
    }
});


// --- Admin: Payroll Integration ---

router.post("/admin/generate-payroll", requireTenant, async (req: any, res) => {
    try {
        if (!isAdmin(req.user.role) && !isHR(req.user.role)) return res.status(403).json({ message: "Forbidden" });

        const { period } = req.body; // YYYY-MM
        if (!period || !/^\d{4}-\d{2}$/.test(period)) return res.status(400).json({ message: "Invalid period format YYYY-MM" });

        // A) Hardening: Idempotency Check
        // If ANY line for this period is "approved" or "posted", block regeneration.
        const existingLines = await storage.getPayrollStagingLines(req.tenantId, period);
        if (existingLines.some((l: any) => l.status === "approved" || l.status === "posted")) {
            return res.status(400).json({ message: "Payroll for this period is already finalized (approved/posted). Cannot regenerate.", code: "ALREADY_FINALIZED" });
        }

        // B) Hardening: Period Boundary & Timezone
        // Since `mealServings.date` is stored as "YYYY-MM-DD", we just need valid start/end strings.
        const [y, m] = period.split('-').map(Number);
        const fromDate = `${period}-01`;

        // Calculate last day correctly (0th day of next month)
        const lastDayDate = new Date(y, m, 0);
        const lastDay = lastDayDate.getDate();
        const toDate = `${period}-${String(lastDay).padStart(2, '0')}`;

        console.log(`Generating payroll for ${period} (${fromDate} to ${toDate})`);

        const servings = await storage.getAdminMealServings(req.tenantId, {
            fromDate: fromDate,
            toDate: toDate,
            voided: false // ONLY valid servings
        });

        // 2. Aggregate by Employee
        const agg: Record<string, number> = {};
        servings.forEach(s => {
            if (!agg[s.employeeId]) agg[s.employeeId] = 0;
            // Standard: Stored as negative in staging line.
            // Price is positive in mealServings.
            agg[s.employeeId] += (Number(s.price) || 0);
        });

        // 3. Prepare Staging Lines
        // sourceId = meal:period:empId
        const lines: any[] = Object.keys(agg).map(empId => ({
            tenantId: req.tenantId,
            period: period,
            employeeId: empId,
            sourceType: 'meal',
            sourceId: `meal:${period}:${empId}`,
            amount: -agg[empId], // NEGATIVE for deduction standard
            currency: 'MNT',
            status: 'pending',
            description: `Meal deduction for ${period}`,
            createdBy: req.user.id
        }));

        // 4. Upsert
        let result: any[] = [];
        if (lines.length > 0) {
            result = await storage.upsertPayrollStagingLines(lines);
        }

        res.json({ message: "Generated", count: result.length, preview: result });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to generate payroll lines" });
    }
});

router.post("/admin/payroll/approve", requireTenant, async (req: any, res) => {
    try {
        // Permission: HR or Admin usually approves
        if (!isAdmin(req.user.role) && !isHR(req.user.role)) return res.status(403).json({ message: "Forbidden" });

        const { period } = req.body;
        if (!period) return res.status(400).json({ message: "Missing period" });

        const approvedCount = await storage.approvePayrollStagingLines(req.tenantId, period, req.user.id);

        res.json({ message: "Approved", approvedCount });
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to approve payroll lines" });
    }
});

router.get("/admin/wallets", requireTenant, async (req: any, res) => {
    try {
        if (!isAdmin(req.user.role) && !isHR(req.user.role)) return res.status(403).json({ message: "Forbidden" });
        const { query } = req.query;
        const wallets = await storage.getAdminWallets(req.tenantId, query as string);
        res.json(wallets);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to fetch wallets" });
    }
});

router.post("/admin/wallet/adjust", requireTenant, async (req: any, res) => {
    try {
        if (!isAdmin(req.user.role) && !isHR(req.user.role)) return res.status(403).json({ message: "Forbidden" });
        const { walletId, amount, note } = req.body;
        if (!walletId || !amount || !note) return res.status(400).json({ message: "Missing required fields" });

        const result = await storage.adjustWallet(walletId, Number(amount), note, req.user.id);
        res.json(result);
    } catch (e: any) {
        console.error(e);
        res.status(400).json({ message: e.message || "Failed to adjust wallet" });
    }
});

router.get("/admin/payroll-staging", requireTenant, async (req: any, res) => {
    try {
        if (!isAdmin(req.user.role) && !isHR(req.user.role)) return res.status(403).json({ message: "Forbidden" });

        const { period } = req.query;
        if (!period) return res.status(400).json({ message: "Period required" });

        const lines = await storage.getPayrollStagingLines(req.tenantId, period as string);
        res.json(lines);
    } catch (e) {
        console.error(e);
        res.status(500).json({ message: "Failed to fetch staging lines" });
    }
});

export default router;
