
import sys

code_to_append = '''

// ---------------------------------------------------------------------------
// Workwear Entitlement Management System
// ---------------------------------------------------------------------------

export const workwearItems = pgTable("workwear_items", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(),
  category: text("category").notNull(), // clothing, footwear, headwear, gloves, eyewear, other
  description: text("description"),
  allowancePerYear: integer("allowance_per_year").notNull().default(1),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  idxWorkwearItemsTenant: index("workwear_items_tenant_idx").on(t.tenantId),
}));

export const insertWorkwearItemSchema = createInsertSchema(workwearItems);
export const selectWorkwearItemSchema = createSelectSchema(workwearItems);
export type WorkwearItem = typeof workwearItems.$inferSelect;
export type InsertWorkwearItem = z.infer<typeof insertWorkwearItemSchema>;

export const workwearIssuances = pgTable("workwear_issuances", {
  id: uuid("id").primaryKey().defaultRandom(),
  tenantId: uuid("tenant_id").references(() => tenants.id, { onDelete: "cascade" }).notNull(),
  employeeId: uuid("employee_id").references(() => employees.id, { onDelete: "cascade" }).notNull(),
  workwearItemId: uuid("workwear_item_id").references(() => workwearItems.id, { onDelete: "cascade" }).notNull(),
  issuedByUserId: uuid("issued_by_user_id").references(() => users.id).notNull(),
  issuedAt: timestamp("issued_at").defaultNow().notNull(),
  quantity: integer("quantity").notNull().default(1),
  size: text("size"),
  notes: text("notes"),
  year: integer("year").notNull(), // Хэдэн оны нормоор олгосон
}, (t) => ({
  idxWorkwearIssuancesEmployee: index("workwear_issuances_emp_idx").on(t.tenantId, t.employeeId, t.year),
}));

export const insertWorkwearIssuanceSchema = createInsertSchema(workwearIssuances);
export const selectWorkwearIssuanceSchema = createSelectSchema(workwearIssuances);
export type WorkwearIssuance = typeof workwearIssuances.$inferSelect;
export type InsertWorkwearIssuance = z.infer<typeof insertWorkwearIssuanceSchema>;
'''

with open(r'a:\файл шилжүүлэв\projects\ERP-connect\shared\schema.ts', 'a', encoding='utf-8') as f:
    f.write(code_to_append)

print('Successfully appended Workwear schemas to shared/schema.ts')
