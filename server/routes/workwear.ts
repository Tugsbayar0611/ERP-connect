import type { Express } from "express";
import { db } from "../db";
import {
  workwearItems, workwearIssuances, workwearTemplates, workwearTemplateItems,
  users, employees
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";

export function registerWorkwearRoutes(app: Express) {
  // ─────────────────────────────────────────────────────
  // WORKWEAR ITEMS
  // ─────────────────────────────────────────────────────

  app.get("/api/workwear/items", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
      const items = await db.select().from(workwearItems)
        .where(eq(workwearItems.tenantId, tenantId))
        .orderBy(workwearItems.createdAt);
      res.json(items);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/workwear/items", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(401).json({ error: "Unauthorized" });
      const { id, name, category, description, allowancePerYear, unitPrice, isActive } = req.body;
      if (id) {
        const [updated] = await db.update(workwearItems)
          .set({ name, category, description, allowancePerYear, unitPrice, isActive })
          .where(and(eq(workwearItems.id, id), eq(workwearItems.tenantId, tenantId)))
          .returning();
        return res.json(updated);
      }
      const [inserted] = await db.insert(workwearItems).values({
        tenantId, name, category, description,
        allowancePerYear: allowancePerYear || 1,
        unitPrice: unitPrice || null,
        isActive: isActive !== undefined ? isActive : true,
      }).returning();
      res.status(201).json(inserted);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─────────────────────────────────────────────────────
  // WORKWEAR TEMPLATES (Position-based Norm Templates)
  // ─────────────────────────────────────────────────────

  app.get("/api/workwear/templates", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

      const templates = await db.select().from(workwearTemplates)
        .where(eq(workwearTemplates.tenantId, tenantId))
        .orderBy(workwearTemplates.createdAt);

      // Attach items for each template
      const result = await Promise.all(templates.map(async (tpl: any) => {
        const items = await db
          .select({
            id: workwearTemplateItems.id,
            quantity: workwearTemplateItems.quantity,
            allowancePerYear: workwearTemplateItems.allowancePerYear,
            item: {
              id: workwearItems.id,
              name: workwearItems.name,
              category: workwearItems.category,
              unitPrice: workwearItems.unitPrice,
            }
          })
          .from(workwearTemplateItems)
          .where(eq(workwearTemplateItems.templateId, tpl.id))
          .innerJoin(workwearItems, eq(workwearTemplateItems.workwearItemId, workwearItems.id));
        return { ...tpl, items };
      }));

      res.json(result);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/workwear/templates", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      const { id, name, description, jobTitleId, isActive, items } = req.body;

      if (id) {
        // Update existing template
        const [updated] = await db.update(workwearTemplates)
          .set({ name, description, jobTitleId: jobTitleId || null, isActive, updatedAt: new Date() })
          .where(and(eq(workwearTemplates.id, id), eq(workwearTemplates.tenantId, tenantId)))
          .returning();

        // Replace items
        if (Array.isArray(items)) {
          await db.delete(workwearTemplateItems).where(eq(workwearTemplateItems.templateId, id));
          if (items.length > 0) {
            await db.insert(workwearTemplateItems).values(
              items.map((item: any) => ({
                tenantId,
                templateId: id,
                workwearItemId: item.workwearItemId,
                quantity: item.quantity || 1,
                allowancePerYear: item.allowancePerYear || 1,
              }))
            );
          }
        }
        return res.json(updated);
      }

      // Create new template
      const [inserted] = await db.insert(workwearTemplates).values({
        tenantId, name, description, jobTitleId: jobTitleId || null,
        isActive: isActive !== undefined ? isActive : true,
        createdByUserId: userId,
      }).returning();

      if (Array.isArray(items) && items.length > 0) {
        await db.insert(workwearTemplateItems).values(
          items.map((item: any) => ({
            tenantId,
            templateId: inserted.id,
            workwearItemId: item.workwearItemId,
            quantity: item.quantity || 1,
            allowancePerYear: item.allowancePerYear || 1,
          }))
        );
      }

      res.status(201).json(inserted);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Apply template to employees in bulk
  app.post("/api/workwear/templates/:id/apply", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      const templateId = req.params.id;
      const { employeeIds, expiresAt } = req.body;

      if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
        return res.status(400).json({ error: "employeeIds шаардлагатай" });
      }

      // Get template items
      const templateItemRows = await db
        .select({
          workwearItemId: workwearTemplateItems.workwearItemId,
          quantity: workwearTemplateItems.quantity,
          allowancePerYear: workwearTemplateItems.allowancePerYear,
          item: {
            unitPrice: workwearItems.unitPrice,
            allowancePerYear: workwearItems.allowancePerYear,
          }
        })
        .from(workwearTemplateItems)
        .where(eq(workwearTemplateItems.templateId, templateId))
        .innerJoin(workwearItems, eq(workwearTemplateItems.workwearItemId, workwearItems.id));

      if (templateItemRows.length === 0) {
        return res.status(400).json({ error: "Загварт хувцасны мэдээлэл байхгүй байна" });
      }

      const issuanceYear = new Date().getFullYear();
      const expiry = expiresAt ? new Date(expiresAt) : new Date(`${issuanceYear}-12-31`);

      let successCount = 0;
      let skippedCount = 0;

      for (const employeeId of employeeIds) {
        for (const row of templateItemRows) {
          // Check existing grants this year
          const [existing] = await db
            .select({ totalIssued: sql<number>`coalesce(sum(${workwearIssuances.quantity}), 0)` })
            .from(workwearIssuances)
            .where(and(
              eq(workwearIssuances.tenantId, tenantId),
              eq(workwearIssuances.employeeId, employeeId),
              eq(workwearIssuances.workwearItemId, row.workwearItemId),
              eq(workwearIssuances.year, issuanceYear)
            ));

          const totalIssued = Number(existing?.totalIssued || 0);
          const allowance = row.allowancePerYear ?? (row.item as any)?.allowancePerYear ?? 1;

          if (totalIssued + row.quantity > allowance) {
            skippedCount++;
            continue;
          }

          await db.insert(workwearIssuances).values({
            tenantId,
            employeeId,
            workwearItemId: row.workwearItemId,
            issuedByUserId: userId,
            quantity: row.quantity,
            year: issuanceYear,
            status: "granted",
            priceAtTime: (row.item as any)?.unitPrice || null,
            expiresAt: expiry,
          });
          successCount++;
        }
      }

      res.json({
        successCount,
        skippedCount,
        message: `${employeeIds.length} ажилтанд загваруудыг ${successCount} ширхэг эрх нээж олголоо.`,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─────────────────────────────────────────────────────
  // ISSUANCES (Grant Entitlements)
  // ─────────────────────────────────────────────────────

  // Bulk grant
  app.post("/api/workwear/issuances/bulk", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      const { employeeIds, workwearItemId, quantity, size, notes, year, expiresAt } = req.body;

      if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
        return res.status(400).json({ error: "employeeIds шаардлагатай" });
      }

      const [item] = await db.select().from(workwearItems)
        .where(and(eq(workwearItems.id, workwearItemId), eq(workwearItems.tenantId, tenantId)));
      if (!item) return res.status(404).json({ error: "Workwear item not found" });

      const issuanceYear = year || new Date().getFullYear();
      const requestedQty = Number(quantity || 1);
      const expiry = expiresAt ? new Date(expiresAt) : new Date(`${issuanceYear}-12-31`);

      let successCount = 0;
      let skippedCount = 0;
      const errors: string[] = [];

      for (const employeeId of employeeIds) {
        try {
          const result = await db
            .select({ totalIssued: sql<number>`coalesce(sum(${workwearIssuances.quantity}), 0)` })
            .from(workwearIssuances)
            .where(and(
              eq(workwearIssuances.tenantId, tenantId),
              eq(workwearIssuances.employeeId, employeeId),
              eq(workwearIssuances.workwearItemId, workwearItemId),
              eq(workwearIssuances.year, issuanceYear)
            ));

          const totalIssued = Number(result[0]?.totalIssued || 0);
          if (totalIssued + requestedQty > item.allowancePerYear) {
            skippedCount++;
            continue;
          }

          await db.insert(workwearIssuances).values({
            tenantId, employeeId, workwearItemId,
            issuedByUserId: userId,
            quantity: requestedQty,
            size: size || null,
            notes: notes || null,
            year: issuanceYear,
            status: "granted",
            priceAtTime: item.unitPrice || null,
            expiresAt: expiry,
          });
          successCount++;
        } catch (err: any) {
          errors.push(`${employeeId}: ${err.message}`);
        }
      }

      res.json({
        successCount, skippedCount, errorCount: errors.length,
        message: `${successCount} ажилтанд олгогдлоо. ${skippedCount} норм дууссан учир алгасагдлаа.`,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Get all issuances (HR/Admin view)
  app.get("/api/workwear/issuances", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

      const issuances = await db.select({
        id: workwearIssuances.id,
        issuedAt: workwearIssuances.issuedAt,
        quantity: workwearIssuances.quantity,
        size: workwearIssuances.size,
        notes: workwearIssuances.notes,
        year: workwearIssuances.year,
        status: workwearIssuances.status,
        priceAtTime: workwearIssuances.priceAtTime,
        expiresAt: workwearIssuances.expiresAt,
        collectedAt: workwearIssuances.collectedAt,
        employee: {
          id: employees.id,
          firstName: employees.firstName,
          lastName: employees.lastName,
          position: employees.position
        },
        item: { id: workwearItems.id, name: workwearItems.name, category: workwearItems.category },
        issuedBy: { id: users.id, fullName: users.fullName, email: users.email }
      })
        .from(workwearIssuances)
        .where(eq(workwearIssuances.tenantId, tenantId))
        .innerJoin(employees, eq(workwearIssuances.employeeId, employees.id))
        .innerJoin(workwearItems, eq(workwearIssuances.workwearItemId, workwearItems.id))
        .innerJoin(users, eq(workwearIssuances.issuedByUserId, users.id))
        .orderBy(desc(workwearIssuances.issuedAt));

      res.json(issuances);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─────────────────────────────────────────────────────
  // EMPLOYEE VIEWS
  // ─────────────────────────────────────────────────────

  // My workwear (employee self-view)
  app.get("/api/workwear/my", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      const [employee] = await db.select().from(employees)
        .where(and(eq(employees.userId, userId), eq(employees.tenantId, tenantId)));
      if (!employee) return res.json({ pending: [], history: [] });

      const issuances = await db.select({
        id: workwearIssuances.id,
        issuedAt: workwearIssuances.issuedAt,
        quantity: workwearIssuances.quantity,
        size: workwearIssuances.size,
        year: workwearIssuances.year,
        status: workwearIssuances.status,
        expiresAt: workwearIssuances.expiresAt,
        collectedAt: workwearIssuances.collectedAt,
        item: {
          id: workwearItems.id,
          name: workwearItems.name,
          category: workwearItems.category,
          allowancePerYear: workwearItems.allowancePerYear
        }
      })
        .from(workwearIssuances)
        .where(and(eq(workwearIssuances.tenantId, tenantId), eq(workwearIssuances.employeeId, employee.id)))
        .innerJoin(workwearItems, eq(workwearIssuances.workwearItemId, workwearItems.id))
        .orderBy(desc(workwearIssuances.issuedAt));

      const pending = issuances.filter((i: any) => i.status === "granted");
      const history = issuances.filter((i: any) => i.status === "collected" || i.status === "expired");

      res.json({ pending, history });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Specific employee's workwear (HR/Warehouse view)
  app.get("/api/workwear/employee/:id", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

      const issuances = await db.select({
        id: workwearIssuances.id,
        issuedAt: workwearIssuances.issuedAt,
        quantity: workwearIssuances.quantity,
        size: workwearIssuances.size,
        year: workwearIssuances.year,
        status: workwearIssuances.status,
        expiresAt: workwearIssuances.expiresAt,
        collectedAt: workwearIssuances.collectedAt,
        item: {
          id: workwearItems.id,
          name: workwearItems.name,
          category: workwearItems.category,
          allowancePerYear: workwearItems.allowancePerYear
        }
      })
        .from(workwearIssuances)
        .where(and(eq(workwearIssuances.tenantId, tenantId), eq(workwearIssuances.employeeId, req.params.id)))
        .innerJoin(workwearItems, eq(workwearIssuances.workwearItemId, workwearItems.id))
        .orderBy(desc(workwearIssuances.issuedAt));

      const pending = issuances.filter((i: any) => i.status === "granted");
      const history = issuances.filter((i: any) => i.status !== "granted");

      res.json({ pending, history });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─────────────────────────────────────────────────────
  // WAREHOUSE: Fulfill (hand out item physically)
  // ─────────────────────────────────────────────────────

  app.post("/api/workwear/fulfill", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      const userId = req.user?.id;
      if (!tenantId || !userId) return res.status(401).json({ error: "Unauthorized" });

      // Only warehouse, admin, or hr can physically hand out items
      const userRole = (req.user?.role || "").toLowerCase();
      const userRoles: string[] = (req.user?.userRoles || []).map((r: any) => r.name.toLowerCase());
      const allRoles = [userRole, ...userRoles];
      const canFulfill = allRoles.some((r: string) => ["warehouse", "admin", "hr"].includes(r));
      if (!canFulfill) {
        return res.status(403).json({ error: "Зөвхөн нярав (warehouse), HR эсвэл админ хувцас олгох боломжтой" });
      }

      const { issuanceId, size } = req.body;

      const [issuance] = await db.select().from(workwearIssuances)
        .where(and(eq(workwearIssuances.id, issuanceId), eq(workwearIssuances.tenantId, tenantId)));

      if (!issuance) return res.status(404).json({ error: "Бүртгэл олдсонгүй" });
      if (issuance.status === "collected") return res.status(400).json({ error: "Аль хэдийн авсан байна" });
      if (issuance.status === "expired") return res.status(400).json({ error: "Эрхийн хугацаа дууссан байна" });

      const [updated] = await db.update(workwearIssuances)
        .set({
          status: "collected",
          collectedByUserId: userId,
          collectedAt: new Date(),
          size: size || issuance.size
        })
        .where(eq(workwearIssuances.id, issuanceId))
        .returning();

      res.json(updated);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─────────────────────────────────────────────────────
  // REPORTS
  // ─────────────────────────────────────────────────────

  app.get("/api/workwear/reports/summary", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

      const year = Number(req.query.year) || new Date().getFullYear();

      // All issuances for this year
      const all = await db.select({
        id: workwearIssuances.id,
        status: workwearIssuances.status,
        quantity: workwearIssuances.quantity,
        priceAtTime: workwearIssuances.priceAtTime,
        itemName: workwearItems.name,
        itemCategory: workwearItems.category,
        departmentId: employees.departmentId,
      })
        .from(workwearIssuances)
        .where(and(eq(workwearIssuances.tenantId, tenantId), eq(workwearIssuances.year, year)))
        .innerJoin(workwearItems, eq(workwearIssuances.workwearItemId, workwearItems.id))
        .innerJoin(employees, eq(workwearIssuances.employeeId, employees.id));

      const totalGranted = all.length;
      const totalCollected = all.filter((i: any) => i.status === "collected").length;
      const totalPending = all.filter((i: any) => i.status === "granted").length;
      const totalExpired = all.filter((i: any) => i.status === "expired").length;

      // Total budget spent (collected only)
      const totalSpent = all
        .filter((i: any) => i.status === "collected")
        .reduce((sum: number, i: any) => sum + (Number(i.priceAtTime || 0) * Number(i.quantity || 1)), 0);

      // By category
      const byCategory: Record<string, { granted: number; collected: number; spent: number }> = {};
      for (const row of all as any[]) {
        const cat = row.itemCategory || "other";
        if (!byCategory[cat]) byCategory[cat] = { granted: 0, collected: 0, spent: 0 };
        byCategory[cat].granted++;
        if (row.status === "collected") {
          byCategory[cat].collected++;
          byCategory[cat].spent += Number(row.priceAtTime || 0) * Number(row.quantity || 1);
        }
      }

      res.json({
        year,
        totalGranted,
        totalCollected,
        totalPending,
        totalExpired,
        totalSpent,
        byCategory,
      });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ─────────────────────────────────────────────────────
  // EXPIRE CHECK (called server-side or via cron)
  // ─────────────────────────────────────────────────────

  app.post("/api/workwear/expire-check", async (req: any, res) => {
    try {
      const tenantId = req.user?.tenantId;
      if (!tenantId) return res.status(401).json({ error: "Unauthorized" });

      const now = new Date();
      // Mark expired
      await db.update(workwearIssuances)
        .set({ status: "expired" })
        .where(and(
          eq(workwearIssuances.tenantId, tenantId),
          eq(workwearIssuances.status, "granted"),
          sql`${workwearIssuances.expiresAt} < ${now}`
        ));

      res.json({ ok: true, checkedAt: now });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });
}
