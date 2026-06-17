ALTER TABLE "tenants"
ADD COLUMN IF NOT EXISTS "google_auth_domains" text[] NOT NULL DEFAULT ARRAY[]::text[];

UPDATE "tenants"
SET "google_auth_domains" = ARRAY['mtcone.net']
WHERE "google_auth_domains" = ARRAY[]::text[];

INSERT INTO "employees" (
  "tenant_id",
  "user_id",
  "first_name",
  "last_name",
  "email",
  "hire_date",
  "status"
)
SELECT
  u."tenant_id",
  u."id",
  COALESCE(NULLIF(split_part(COALESCE(u."full_name", ''), ' ', 1), ''), split_part(u."email", '@', 1)),
  NULLIF(trim(regexp_replace(COALESCE(u."full_name", ''), '^\S+\s*', '')), ''),
  u."email",
  CURRENT_DATE,
  'active'
FROM "users" u
JOIN "tenants" t ON t."id" = u."tenant_id"
WHERE u."email" IS NOT NULL
  AND u."is_active" = true
  AND u."status" = 'active'
  AND NOT EXISTS (
    SELECT 1
    FROM "employees" e
    WHERE e."user_id" = u."id"
  )
  AND (
    t."google_auth_domains" @> ARRAY['*']::text[]
    OR lower(split_part(u."email", '@', 2)) = ANY(t."google_auth_domains")
  );
