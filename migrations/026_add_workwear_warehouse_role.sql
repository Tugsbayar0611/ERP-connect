INSERT INTO "roles" ("tenant_id", "name", "description", "is_system")
SELECT
  t."id",
  'Нярав',
  'Агуулах болон нормын хувцас олгох эрх',
  true
FROM "tenants" t
ON CONFLICT ("tenant_id", "name") DO NOTHING;

WITH target_roles AS (
  SELECT r."id"
  FROM "roles" r
  WHERE r."name" IN ('Нярав', 'Warehouse', 'warehouse', 'Агуулахын ажилтан')
),
target_permissions AS (
  SELECT p."id"
  FROM "permissions" p
  WHERE (p."resource" = 'workwear' AND p."action" IN ('read', 'write'))
     OR (p."resource" = 'inventory' AND p."action" IN ('view', 'adjust'))
     OR (p."resource" = 'product' AND p."action" = 'view')
     OR (p."resource" = 'dashboard' AND p."action" = 'view')
)
INSERT INTO "role_permissions" ("role_id", "permission_id")
SELECT tr."id", tp."id"
FROM target_roles tr
CROSS JOIN target_permissions tp
ON CONFLICT ("role_id", "permission_id") DO NOTHING;
