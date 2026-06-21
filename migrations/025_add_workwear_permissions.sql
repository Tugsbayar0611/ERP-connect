INSERT INTO "permissions" ("resource", "action", "description")
VALUES
  ('workwear', 'read', 'View workwear entitlements and items'),
  ('workwear', 'write', 'Fulfill collected workwear items'),
  ('workwear', 'approve', 'Manage workwear norms and grant entitlements'),
  ('workwear', 'export', 'View and export workwear reports'),
  ('workwear', 'delete', 'Delete workwear configuration or records')
ON CONFLICT ("resource", "action") DO NOTHING;
