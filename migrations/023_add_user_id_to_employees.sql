-- ==========================================
-- ADD USER_ID TO EMPLOYEES TABLE
-- Link employees to users for RBAC
-- ==========================================

-- Add user_id column to employees table
ALTER TABLE employees
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES users(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS employees_user_id_idx ON employees(user_id);

-- Add comment
COMMENT ON COLUMN employees.user_id IS 'Reference to users table for RBAC and authentication';
