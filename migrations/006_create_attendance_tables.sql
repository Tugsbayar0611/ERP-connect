-- ==========================================
-- CREATE ATTENDANCE TABLES
-- Ирцийн хүснэгтүүд үүсгэх
-- ==========================================

-- Create attendance_days table if it doesn't exist
CREATE TABLE IF NOT EXISTS attendance_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid REFERENCES tenants(id) ON DELETE CASCADE NOT NULL,
  employee_id uuid REFERENCES employees(id) ON DELETE CASCADE NOT NULL,
  
  work_date date NOT NULL,
  check_in timestamp,
  check_out timestamp,
  minutes_worked integer,
  status text NOT NULL DEFAULT 'present',
  note text,
  
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  
  -- Unique constraint: one record per employee per day per tenant
  CONSTRAINT emp_date_idx UNIQUE (tenant_id, employee_id, work_date)
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS attendance_days_tenant_date_idx 
  ON attendance_days(tenant_id, work_date);

CREATE INDEX IF NOT EXISTS attendance_days_employee_idx 
  ON attendance_days(employee_id);

COMMENT ON TABLE attendance_days IS 'Ажилчдын ирцийн бүртгэл';
COMMENT ON COLUMN attendance_days.work_date IS 'Ажилласан өдөр';
COMMENT ON COLUMN attendance_days.check_in IS 'Ирсэн цаг';
COMMENT ON COLUMN attendance_days.check_out IS 'Явсан цаг';
COMMENT ON COLUMN attendance_days.minutes_worked IS 'Ажилласан минут';
COMMENT ON COLUMN attendance_days.status IS 'Төлөв: present, absent, late, sick';
