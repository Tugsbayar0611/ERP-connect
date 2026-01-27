-- Migration: Add HR Gamification Tables
-- Description: Add employee achievements, points system for gamification

-- Employee Achievements (Биеийн амжилтууд)
CREATE TABLE IF NOT EXISTS employee_achievements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  achievement_type TEXT NOT NULL, -- 'early_bird', 'perfect_month', 'perfect_week', etc.
  achieved_at TIMESTAMP NOT NULL DEFAULT NOW(),
  metadata JSONB, -- Additional data (e.g., streak days, month/year)
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create unique constraint using a function index for date comparison
CREATE UNIQUE INDEX IF NOT EXISTS emp_achievement_idx 
ON employee_achievements(tenant_id, employee_id, achievement_type, DATE(achieved_at));

CREATE INDEX IF NOT EXISTS idx_employee_achievements_employee ON employee_achievements(tenant_id, employee_id, achieved_at DESC);
CREATE INDEX IF NOT EXISTS idx_employee_achievements_type ON employee_achievements(achievement_type);

COMMENT ON TABLE employee_achievements IS 'Employee achievements and badges (e.g., Early Bird badge)';
COMMENT ON COLUMN employee_achievements.achievement_type IS 'Type of achievement: early_bird, perfect_month, perfect_week, etc.';
COMMENT ON COLUMN employee_achievements.metadata IS 'Additional data like streak days, month/year, etc.';

-- Employee Points (Онооны систем)
CREATE TABLE IF NOT EXISTS employee_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  points INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id, employee_id)
);

CREATE INDEX IF NOT EXISTS idx_employee_points_employee ON employee_points(tenant_id, employee_id);
CREATE INDEX IF NOT EXISTS idx_employee_points_points ON employee_points(tenant_id, points DESC);

COMMENT ON TABLE employee_points IS 'Employee points balance for gamification';
COMMENT ON COLUMN employee_points.points IS 'Total points accumulated by employee';

-- Points History (Онооны түүх)
CREATE TABLE IF NOT EXISTS points_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  points INTEGER NOT NULL, -- Can be positive or negative
  reason TEXT NOT NULL, -- 'attendance', 'early_bird_badge', 'kudos_received', etc.
  source_type TEXT, -- 'attendance', 'achievement', 'kudos', 'store_purchase'
  source_id UUID, -- Reference to source record
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_points_history_employee ON points_history(tenant_id, employee_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_points_history_source ON points_history(source_type, source_id);

COMMENT ON TABLE points_history IS 'History of points earned or spent';
COMMENT ON COLUMN points_history.points IS 'Points change (positive for earned, negative for spent)';
COMMENT ON COLUMN points_history.reason IS 'Reason for points change';
COMMENT ON COLUMN points_history.source_type IS 'Source type: attendance, achievement, kudos, store_purchase';
COMMENT ON COLUMN points_history.source_id IS 'Reference to source record ID';
