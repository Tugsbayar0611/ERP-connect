
import {
    canteenWallets, walletTransactions, canteenMenu, mealServings, mealOrders,
    type CanteenWallet, type InsertCanteenWallet,
    type WalletTransaction, type InsertWalletTransaction,
    type CanteenMenu, type InsertCanteenMenu,
    type MealServing, type InsertMealServing,
    type MealOrder, type InsertMealOrder,
    payrollStagingLines, type PayrollStagingLine, type InsertPayrollStagingLine,
    employees, departments
} from "@shared/schema";
import { db } from "../db";
import { eq, and, desc, sql, or, ilike, getTableColumns } from "drizzle-orm";
import { TransportStorage } from "./transport";

export class CanteenStorage extends TransportStorage {
    // --- Wallets ---
    async getCanteenWallet(tenantId: string, employeeId: string): Promise<CanteenWallet> {
        const [wallet] = await db.select().from(canteenWallets)
            .where(and(eq(canteenWallets.tenantId, tenantId), eq(canteenWallets.employeeId, employeeId)));

        if (wallet) return wallet;

        // Auto-create wallet if not exists
        const [newWallet] = await db.insert(canteenWallets).values({
            tenantId,
            employeeId,
            balance: 0
        }).returning();
        return newWallet;
    }

    async getCanteenWallets(tenantId: string): Promise<CanteenWallet[]> {
        return await db.select().from(canteenWallets).where(eq(canteenWallets.tenantId, tenantId));
    }

    // --- Transactions ---
    async topUpWallet(data: {
        tenantId: string,
        walletId: string,
        amount: number,
        type: string, // credit
        referenceType: string,
        referenceId?: string,
        description?: string,
        actorId: string
    }): Promise<WalletTransaction> {
        return await db.transaction(async (tx) => {
            // 1. Create Transaction Record
            const [transaction] = await tx.insert(walletTransactions).values({
                walletId: data.walletId,
                amount: data.amount,
                type: data.type,
                referenceType: data.referenceType,
                referenceId: data.referenceId,
                description: data.description,
                createdBy: data.actorId
            }).returning();

            // 2. Update Wallet Balance
            await tx.update(canteenWallets)
                .set({
                    balance: sql`${canteenWallets.balance} + ${data.amount}`,
                    updatedAt: new Date()
                })
                .where(eq(canteenWallets.id, data.walletId));

            return transaction;
        });
    }

    async getWalletTransactions(walletId: string, limit = 50): Promise<WalletTransaction[]> {
        return await db.select().from(walletTransactions)
            .where(eq(walletTransactions.walletId, walletId))
            .orderBy(desc(walletTransactions.createdAt))
            .limit(limit);
    }








    // --- Pre-order (MVP) ---

    async createMealOrder(data: InsertMealOrder): Promise<MealOrder> {
        // Upsert: If exists conflict on (tenant, emp, date, type) -> update status to pending (if was cancelled)
        // If it was already fulfilled, we might want to block logic layer, but here standard upsert is fine for MVP "Intent" 
        // Real logic check should be in route or here.

        return await db.insert(mealOrders).values(data)
            .onConflictDoUpdate({
                target: [mealOrders.tenantId, mealOrders.employeeId, mealOrders.date, mealOrders.mealType],
                set: {
                    status: "pending",
                    cancelledAt: null,
                    createdAt: new Date() // Renew timestamp
                }
            })
            .returning().then(res => res[0]);
    }

    async getMealOrders(tenantId: string, employeeId: string, dateFrom?: string, dateTo?: string): Promise<MealOrder[]> {
        const conditions = [
            eq(mealOrders.tenantId, tenantId),
            eq(mealOrders.employeeId, employeeId)
        ];

        if (dateFrom) conditions.push(sql`${mealOrders.date} >= ${dateFrom}`);
        if (dateTo) conditions.push(sql`${mealOrders.date} <= ${dateTo}`);

        return await db.select().from(mealOrders)
            .where(and(...conditions))
            .orderBy(desc(mealOrders.date), desc(mealOrders.createdAt));
    }

    async getPendingMealOrder(tenantId: string, employeeId: string, date: string, mealType: string): Promise<MealOrder | undefined> {
        const [order] = await db.select().from(mealOrders)
            .where(and(
                eq(mealOrders.tenantId, tenantId),
                eq(mealOrders.employeeId, employeeId),
                eq(mealOrders.date, date),
                eq(mealOrders.mealType, mealType),
                eq(mealOrders.status, 'pending')
            ));
        return order;
    }

    async cancelMealOrder(tenantId: string, orderId: string, employeeId: string): Promise<MealOrder> {
        const [order] = await db.update(mealOrders)
            .set({
                status: "cancelled",
                cancelledAt: new Date()
            })
            .where(and(
                eq(mealOrders.id, orderId),
                eq(mealOrders.tenantId, tenantId),
                eq(mealOrders.employeeId, employeeId),
                eq(mealOrders.status, 'pending') // Only cancel pending
            ))
            .returning();

        if (!order) throw new Error("Order not found or not pending");
        return order;
    }

    async getPendingOrderStats(tenantId: string, date: string): Promise<{ lunch: number, dinner: number }> {
        const orders = await db.select().from(mealOrders)
            .where(and(
                eq(mealOrders.tenantId, tenantId),
                eq(mealOrders.date, date),
                eq(mealOrders.status, 'pending')
            ));

        return {
            lunch: orders.filter(o => o.mealType === 'lunch').length,
            dinner: orders.filter(o => o.mealType === 'dinner').length
        };
    }

    // --- Servings (The Core Logic) ---
    async serveMeal(data: {
        tenantId: string,
        employeeId: string,
        date: string, // YYYY-MM-DD
        mealType: string,
        price: number,
        actorId: string,
        description?: string // Added for Manual Manual Badge
    }): Promise<MealServing> {
        return await db.transaction(async (tx) => {
            // 1. Get Wallet (Locking would be ideal but PG default isolation is usually Read Committed. 
            // We use update with check for balance to be safe or just atomic update check)

            // To be strictly safe against race conditions (double spend):
            const [wallet] = await tx.select().from(canteenWallets)
                .where(and(eq(canteenWallets.tenantId, data.tenantId), eq(canteenWallets.employeeId, data.employeeId)));

            if (!wallet) throw new Error("Wallet not found");
            if (wallet.balance < data.price) {
                // We throw error to rollback
                throw new Error("Insufficient balance");
            }

            // 2. Insert Transaction (Debit)
            const [transaction] = await tx.insert(walletTransactions).values({
                walletId: wallet.id,
                amount: -data.price, // Negative for debit
                type: "debit",
                referenceType: "meal_serving",
                description: data.description || `${data.mealType} served`,
                createdBy: data.actorId
            }).returning();

            // 3. Update Wallet
            await tx.update(canteenWallets)
                .set({
                    balance: sql`${canteenWallets.balance} - ${data.price}`,
                    updatedAt: new Date()
                })
                .where(eq(canteenWallets.id, wallet.id));

            // 4. Create Serving Record
            const [serving] = await tx.insert(mealServings).values({
                tenantId: data.tenantId,
                employeeId: data.employeeId,
                date: data.date,
                mealType: data.mealType,
                price: data.price,
                status: "served"
            }).returning();

            // 5. Fulfill Pending Order (if any)
            await tx.update(mealOrders)
                .set({
                    status: "fulfilled",
                    fulfilledAt: new Date(),
                    fulfilledBy: data.actorId,
                    servingId: serving.id
                })
                .where(and(
                    eq(mealOrders.tenantId, data.tenantId),
                    eq(mealOrders.employeeId, data.employeeId),
                    eq(mealOrders.date, data.date),
                    eq(mealOrders.mealType, data.mealType),
                    eq(mealOrders.status, "pending")
                ));

            // Update transaction referenceId to servingId
            await tx.update(walletTransactions)
                .set({ referenceId: serving.id })
                .where(eq(walletTransactions.id, transaction.id));

            return serving;
        });
    }

    async getMealServings(tenantId: string, date: string): Promise<MealServing[]> {
        return await db.select().from(mealServings)
            .where(and(eq(mealServings.tenantId, tenantId), eq(mealServings.date, date)));
    }

    // --- Canteen Admin ---

    async getAdminMealServings(tenantId: string, filters: { fromDate?: string, toDate?: string, employeeId?: string, voided?: boolean }): Promise<any[]> {
        const conditions = [eq(mealServings.tenantId, tenantId)];

        if (filters.fromDate && filters.toDate) {
            conditions.push(and(sql`${mealServings.date} >= ${filters.fromDate}`, sql`${mealServings.date} <= ${filters.toDate}`) as any);
        } else if (filters.fromDate) {
            conditions.push(sql`${mealServings.date} >= ${filters.fromDate}`);
        }

        if (filters.employeeId) {
            conditions.push(eq(mealServings.employeeId, filters.employeeId));
        }

        if (filters.voided !== undefined) {
            if (filters.voided) {
                conditions.push(eq(mealServings.status, "voided"));
            } else {
                conditions.push(sql`${mealServings.status} != 'voided'`);
            }
        }

        // Return serving + note (from transaction description)
        // We join transaction on referenceId = serving.id
        return await db.select({
            ...getTableColumns(mealServings),
            note: walletTransactions.description // Alias description to note
        })
            .from(mealServings)
            .leftJoin(walletTransactions, and(
                sql`${walletTransactions.referenceId} = ${mealServings.id}::text`,
                eq(walletTransactions.referenceType, 'meal_serving')
            ))
            .where(and(...conditions))
            .orderBy(desc(mealServings.date), desc(mealServings.servedAt));
    }

    async voidMealServing(servingId: string, reason: string, actorId: string): Promise<MealServing> {
        return await db.transaction(async (tx) => {
            const [serving] = await tx.select().from(mealServings).where(eq(mealServings.id, servingId));
            if (!serving) throw new Error("Serving not found");
            if (serving.status === "voided") throw new Error("Already voided");

            // 1. Mark as Voided
            const [updatedServing] = await tx.update(mealServings)
                .set({
                    status: "voided",
                    voidedAt: new Date(),
                    voidedReason: reason,
                    voidedBy: actorId
                })
                .where(eq(mealServings.id, servingId))
                .returning();

            // 2. Refund if price > 0
            if (serving.price > 0) {
                const [wallet] = await tx.select().from(canteenWallets)
                    .where(and(eq(canteenWallets.tenantId, serving.tenantId), eq(canteenWallets.employeeId, serving.employeeId)));

                if (wallet) {
                    await tx.insert(walletTransactions).values({
                        walletId: wallet.id,
                        amount: serving.price, // Refund = Add back
                        type: "credit",
                        referenceType: "meal_void_refund",
                        referenceId: serving.id,
                        description: `Refund for voided meal (${serving.date})`,
                        createdBy: actorId
                    });

                    await tx.update(canteenWallets)
                        .set({
                            balance: sql`${canteenWallets.balance} + ${serving.price}`,
                            updatedAt: new Date()
                        })
                        .where(eq(canteenWallets.id, wallet.id));
                }
            }

            return updatedServing;
        });
    }

    // --- Menu Management ---

    async getCanteenMenu(tenantId: string, date: string, mealType: string): Promise<CanteenMenu | undefined> {
        const [menu] = await db.select().from(canteenMenu)
            .where(and(
                eq(canteenMenu.tenantId, tenantId),
                eq(canteenMenu.date, date),
                eq(canteenMenu.mealType, mealType)
            ));
        return menu;
    }

    async upsertCanteenMenu(data: InsertCanteenMenu): Promise<CanteenMenu> {
        // Check if exists
        const existing = await this.getCanteenMenu(data.tenantId, data.date, data.mealType);

        if (existing) {
            const [updated] = await db.update(canteenMenu)
                .set({
                    price: data.price,
                    items: data.items,
                    // mealType and date are same
                })
                .where(eq(canteenMenu.id, existing.id))
                .returning();
            return updated;
        } else {
            const [inserted] = await db.insert(canteenMenu)
                .values(data)
                .returning();
            return inserted;
        }
    }

    // --- Menu Management End ---

    // --- Payroll Staging ---

    async upsertPayrollStagingLines(lines: any[]): Promise<any[]> {
        if (!lines || lines.length === 0) return [];

        // Drizzle multi-upsert
        return await db.insert(payrollStagingLines).values(lines)
            .onConflictDoUpdate({
                target: [payrollStagingLines.tenantId, payrollStagingLines.period, payrollStagingLines.employeeId, payrollStagingLines.sourceType],
                set: {
                    amount: sql`excluded.amount`,
                    createdAt: new Date() // Refresh timestamp on conflict
                }
            })
            .returning();
    }

    async getPayrollStagingLines(tenantId: string, period: string): Promise<any[]> {
        return await db.select({
            ...getTableColumns(payrollStagingLines),
            firstName: employees.firstName,
            lastName: employees.lastName
        })
            .from(payrollStagingLines)
            .leftJoin(employees, eq(payrollStagingLines.employeeId, employees.id))
            .where(and(eq(payrollStagingLines.tenantId, tenantId), eq(payrollStagingLines.period, period)));
    }

    async approvePayrollStagingLines(tenantId: string, period: string, actorId: string): Promise<number> {
        const result = await db.update(payrollStagingLines)
            .set({
                status: "approved",
                approvedBy: actorId,
                approvedAt: new Date()
            })
            .where(and(
                eq(payrollStagingLines.tenantId, tenantId),
                eq(payrollStagingLines.period, period),
                eq(payrollStagingLines.sourceType, "meal"),
                eq(payrollStagingLines.status, "pending") // Only approve pending lines
            ))
            .returning();

        return result.length;
    }

    // --- Admin Wallets ---

    async getAdminWallets(tenantId: string, query?: string): Promise<any[]> {
        let employeeCondition = undefined;
        if (query) {
            // Simple search by name match
            // Since we don't have joined search easily with Drizzle without explicit joins which are verbose here
            // We will fetch all wallets and filter, or join. 
            // Better: Join with Employees
            return await db.select({
                id: canteenWallets.id,
                employeeId: canteenWallets.employeeId,
                balance: canteenWallets.balance,
                firstName: employees.firstName,
                lastName: employees.lastName,
                departmentId: employees.departmentId
            })
                .from(canteenWallets)
                .leftJoin(employees, eq(canteenWallets.employeeId, employees.id))
                .where(and(
                    eq(canteenWallets.tenantId, tenantId),
                    or(
                        ilike(employees.firstName, `%${query}%`),
                        ilike(employees.lastName, `%${query}%`)
                    )
                ))
                .limit(50);
        }

        // Return top 50
        return await db.select({
            id: canteenWallets.id,
            employeeId: canteenWallets.employeeId,
            balance: canteenWallets.balance,
            firstName: employees.firstName,
            lastName: employees.lastName,
            departmentId: employees.departmentId,
            departmentName: departments.name
        })
            .from(canteenWallets)
            .leftJoin(employees, eq(canteenWallets.employeeId, employees.id))
            .leftJoin(departments, eq(employees.departmentId, departments.id))
            .where(eq(canteenWallets.tenantId, tenantId))
            .limit(50);
    }

    async adjustWallet(walletId: string, amount: number, note: string, actorId: string): Promise<any> {
        return await db.transaction(async (tx) => {
            if (amount === 0) throw new Error("Amount cannot be zero");

            const [wallet] = await tx.select().from(canteenWallets).where(eq(canteenWallets.id, walletId));
            if (!wallet) throw new Error("Wallet not found");

            // Create Transaction
            await tx.insert(walletTransactions).values({
                walletId: wallet.id,
                amount: Math.abs(amount),
                type: amount > 0 ? "credit" : "debit",
                referenceType: "adjustment",
                description: note,
                createdBy: actorId
            });

            // Update Balance
            const [updated] = await tx.update(canteenWallets)
                .set({
                    balance: sql`${canteenWallets.balance} + ${amount}`, // amount can be negative
                    updatedAt: new Date()
                })
                .where(eq(canteenWallets.id, wallet.id))
                .returning();

            return updated;
        });
    }

    async bulkAdjustWallets(data: { tenantId: string, walletIds: string[], amount: number, note?: string, actorId: string }): Promise<number> {
        if (data.walletIds.length === 0) return 0;

        return await db.transaction(async (tx) => {
            let updatedCount = 0;

            for (const walletId of data.walletIds) {
                // 1. Get Wallet
                const [wallet] = await tx.select().from(canteenWallets)
                    .where(and(eq(canteenWallets.id, walletId), eq(canteenWallets.tenantId, data.tenantId)));

                if (!wallet) continue; // Skip if not found/wrong tenant

                // 2. Insert Transaction
                await tx.insert(walletTransactions).values({
                    walletId: wallet.id,
                    amount: data.amount,
                    type: data.amount > 0 ? "credit" : "debit", // or correction
                    referenceType: "admin_bulk_adjust",
                    description: data.note || "Bulk adjustment",
                    createdBy: data.actorId
                });

                // 3. Update Balance
                await tx.update(canteenWallets)
                    .set({
                        balance: wallet.balance + data.amount,
                        updatedAt: new Date()
                    })
                    .where(eq(canteenWallets.id, wallet.id));

                updatedCount++;
            }
            return updatedCount;
        });
    }
}
