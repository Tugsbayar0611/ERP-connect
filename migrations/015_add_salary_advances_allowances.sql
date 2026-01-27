-- Migration: Add Salary Advances and Employee Allowances tables
-- Date: 2026-01-16
-- Description: Монголын HR модулийн цалингийн урьдчилгаа болон нэмэгдлийн хүснэгтүүд

-- ==========================================
-- 1. Salary Advances (Цалингийн урьдчилгаа)
-- ==========================================

CREATE TABLE IF NOT EXISTS salary_advances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  
  request_date DATE NOT NULL DEFAULT CURRENT_DATE,
  amount NUMERIC(14, 2) NOT NULL,
  reason TEXT,
  
  status TEXT NOT NULL DEFAULT 'pending', -- pending/approved/rejected/paid/deducted
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP,
  rejection_reason TEXT,
  
  -- Суутгал мэдээлэл
  deduction_type TEXT DEFAULT 'monthly', -- monthly (сарын тогтмол) / one-time (нэг удаа)
  monthly_deduction_amount NUMERIC(14, 2), -- Сар бүр хэдэн төгрөг хасах
  total_deduction_months INTEGER, -- Хэдэн сар хасах
  deducted_amount NUMERIC(14, 2) NOT NULL DEFAULT 0, -- Одоогоор хэдэн төгрөг хассан
  
  -- Зээлийн мэдээлэл (урт хугацааны зээл)
  is_loan BOOLEAN NOT NULL DEFAULT false, -- Энэ нь зээл эсэх
  loan_interest_rate NUMERIC(5, 2), -- Хүүгийн хувь (жиш: 1.5%)
  
  paid_at TIMESTAMP, -- Төлсөн огноо
  fully_deducted_at TIMESTAMP, -- Бүрэн суутгагдсан огноо
  
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS salary_adv_emp_status_idx ON salary_advances(tenant_id, employee_id, status);

COMMENT ON TABLE salary_advances IS 'Цалингийн урьдчилгаа ба зээлийн хүсэлтүүд';
COMMENT ON COLUMN salary_advances.status IS 'pending/approved/rejected/paid/deducted';
COMMENT ON COLUMN salary_advances.deduction_type IS 'monthly (сарын тогтмол суутгал) / one-time (нэг удаа суутгал)';
COMMENT ON COLUMN salary_advances.is_loan IS 'Энэ нь урт хугацааны зээл эсэх';

-- ==========================================
-- 2. Employee Allowances (Нэмэгдэл)
-- ==========================================

CREATE TABLE IF NOT EXISTS employee_allowances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  
  code TEXT NOT NULL, -- ALLOW-001, TRANSPORT, MEAL, etc.
  name TEXT NOT NULL, -- Унааны мөнгө, Хоолны мөнгө, etc.
  amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
  
  -- Татварын мэдээлэл
  is_taxable BOOLEAN NOT NULL DEFAULT true, -- ХХОАТ тооцох эсэх
  is_shi BOOLEAN NOT NULL DEFAULT true, -- НДШ тооцох эсэх (Нийгмийн даатгалын шимтгэл)
  is_pit BOOLEAN NOT NULL DEFAULT true, -- ХХОАТ тооцох эсэх (Хувь хүний орлогын албан татвар)
  
  -- Тогтмол эсэх
  is_recurring BOOLEAN NOT NULL DEFAULT true, -- Сар бүр автоматаар нэмэх эсэх
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE, -- Хэзээс эхлэх
  effective_to DATE, -- Хэзээ хүртэл (null = хязгааргүй)
  
  note TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  
  CONSTRAINT emp_allow_emp_code_unique UNIQUE (tenant_id, employee_id, code)
);

CREATE INDEX IF NOT EXISTS emp_allow_emp_active_idx ON employee_allowances(tenant_id, employee_id, is_recurring);

COMMENT ON TABLE employee_allowances IS 'Ажилтны нэмэгдлүүд (унаа, хоол, бусад)';
COMMENT ON COLUMN employee_allowances.is_taxable IS 'ХХОАТ тооцох эсэх';
COMMENT ON COLUMN employee_allowances.is_shi IS 'НДШ тооцох эсэх (Нийгмийн даатгалын шимтгэл)';
COMMENT ON COLUMN employee_allowances.is_pit IS 'ХХОАТ тооцох эсэх (Хувь хүний орлогын албан татвар)';
COMMENT ON COLUMN employee_allowances.is_recurring IS 'Сар бүр автоматаар нэмэх эсэх (contract-аас татаж ирнэ)';
