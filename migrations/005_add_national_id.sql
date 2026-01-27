-- ==========================================
-- ADD NATIONAL ID COLUMN TO EMPLOYEES
-- Монголын Регистрийн дугаар (РД) нэмэх
-- ==========================================

-- Add national_id column to employees table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_name = 'employees' 
    AND column_name = 'national_id'
  ) THEN
    ALTER TABLE employees
    ADD COLUMN national_id TEXT;
    
    COMMENT ON COLUMN employees.national_id IS 'Монголын Регистрийн дугаар (РД) - 2 кирилл үсэг + 8 оронтой тоо';
  END IF;
END $$;
