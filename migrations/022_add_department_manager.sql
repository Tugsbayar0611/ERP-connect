-- ==========================================
-- ADD DEPARTMENT MANAGER FIELD
-- Хэлтэсийн даргын талбар нэмэх
-- ==========================================

-- Add manager_id to departments table (references employees table)
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES employees(id) ON DELETE SET NULL;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS departments_manager_id_idx ON departments(manager_id);

-- Add comment for documentation
COMMENT ON COLUMN departments.manager_id IS 'Хэлтэсийн дарга (ажилтны ID)';
