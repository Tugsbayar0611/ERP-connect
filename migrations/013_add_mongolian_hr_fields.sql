-- ==========================================
-- ADD MONGOLIAN HR FIELDS TO EMPLOYEES TABLE
-- Ажилтны хүснэгтэд Монголын онцлог талбарууд нэмэх
-- ==========================================

-- Add new fields to employees table
ALTER TABLE employees
  -- Монголын онцлог талбарууд
  ADD COLUMN IF NOT EXISTS register_number text,
  ADD COLUMN IF NOT EXISTS social_insurance_no text,
  ADD COLUMN IF NOT EXISTS position text,
  
  -- Гэрээний мэдээлэл
  ADD COLUMN IF NOT EXISTS contract_type text DEFAULT 'permanent',
  ADD COLUMN IF NOT EXISTS contract_start_date date,
  ADD COLUMN IF NOT EXISTS contract_end_date date,
  ADD COLUMN IF NOT EXISTS probation_end_date date,
  
  -- Хаяг
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS district text,
  
  -- Нэмэлт мэдээлэл
  ADD COLUMN IF NOT EXISTS marital_status text,
  ADD COLUMN IF NOT EXISTS education text,
  
  -- Яаралтай үед холбогдох хүн
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS emergency_contact_relation text,
  
  -- Банкны мэдээлэл
  ADD COLUMN IF NOT EXISTS bank_name text,
  
  -- Тайлбар
  ADD COLUMN IF NOT EXISTS notes text;

-- Create unique index for register_number (per tenant)
CREATE UNIQUE INDEX IF NOT EXISTS emp_tenant_regno_idx 
  ON employees(tenant_id, register_number) 
  WHERE register_number IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN employees.register_number IS 'Регистрийн дугаар (2 үсэг + 8 тоо, жишээ: УБ12345678)';
COMMENT ON COLUMN employees.social_insurance_no IS 'НДШ-ийн дугаар (Нийгмийн даатгалын дугаар)';
COMMENT ON COLUMN employees.position IS 'Албан тушаал';
COMMENT ON COLUMN employees.contract_type IS 'Гэрээний төрөл: permanent, temporary, probation, contract';
COMMENT ON COLUMN employees.contract_start_date IS 'Гэрээ эхэлсэн огноо';
COMMENT ON COLUMN employees.contract_end_date IS 'Гэрээ дуусах огноо (Түр гэрээний хувьд)';
COMMENT ON COLUMN employees.probation_end_date IS 'Туршилтын хугацаа дуусах огноо';
COMMENT ON COLUMN employees.address IS 'Гэрийн хаяг';
COMMENT ON COLUMN employees.city IS 'Хот/Аймаг';
COMMENT ON COLUMN employees.district IS 'Дүүрэг/Сум';
COMMENT ON COLUMN employees.marital_status IS 'Гэрлэлтийн байдал: single, married, divorced, widowed';
COMMENT ON COLUMN employees.education IS 'Боловсрол: primary, secondary, vocational, bachelor, master, phd';
COMMENT ON COLUMN employees.emergency_contact_name IS 'Яаралтай үед холбогдох хүний нэр';
COMMENT ON COLUMN employees.emergency_contact_phone IS 'Яаралтай үед холбогдох хүний утас';
COMMENT ON COLUMN employees.emergency_contact_relation IS 'Хамаатан: spouse, parent, sibling, child, other';
COMMENT ON COLUMN employees.bank_name IS 'Банкны нэр (Монголын банкууд)';
COMMENT ON COLUMN employees.notes IS 'Нэмэлт тэмдэглэл';

-- Update attendance_days status to support new statuses
-- Note: The status column already exists, we just need to ensure it can accept new values
-- PostgreSQL text type already supports any string, so no ALTER needed
-- But we can add a comment to document the new statuses
COMMENT ON COLUMN attendance_days.status IS 'Төлөв: present, absent, late, sick, vacation, business_trip, remote, half_day';

-- Add index for faster queries on new fields
CREATE INDEX IF NOT EXISTS employees_position_idx ON employees(position);
CREATE INDEX IF NOT EXISTS employees_contract_type_idx ON employees(contract_type);
CREATE INDEX IF NOT EXISTS employees_status_idx ON employees(status);
