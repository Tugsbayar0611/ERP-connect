-- Migration: Add Weather Widget Tables
-- Description: Weather alerts and notifications for employee care

-- Weather Alerts (Цаг агаарын анхааруулга)
CREATE TABLE IF NOT EXISTS weather_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  alert_type TEXT NOT NULL, -- 'extreme_cold', 'extreme_heat', 'air_pollution', 'traffic_jam'
  temperature_celsius NUMERIC,
  condition_text TEXT,
  message TEXT NOT NULL,
  suggested_action TEXT, -- 'work_from_home', 'dress_warmly', 'avoid_outdoor'
  is_sent BOOLEAN NOT NULL DEFAULT false,
  sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_weather_alerts_tenant ON weather_alerts(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_weather_alerts_sent ON weather_alerts(tenant_id, is_sent, created_at DESC);

COMMENT ON TABLE weather_alerts IS 'Weather alerts for employee care';
COMMENT ON COLUMN weather_alerts.alert_type IS 'Type: extreme_cold, extreme_heat, air_pollution, traffic_jam';
COMMENT ON COLUMN weather_alerts.suggested_action IS 'Suggested action: work_from_home, dress_warmly, avoid_outdoor';

-- Weather Settings (Цаг агаарын тохиргоо)
CREATE TABLE IF NOT EXISTS weather_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  city_name TEXT NOT NULL DEFAULT 'Ulaanbaatar',
  country_code TEXT NOT NULL DEFAULT 'MN',
  latitude NUMERIC,
  longitude NUMERIC,
  api_key TEXT, -- OpenWeatherMap API key
  alert_enabled BOOLEAN NOT NULL DEFAULT true,
  cold_threshold NUMERIC NOT NULL DEFAULT -25, -- Alert if below this temperature
  heat_threshold NUMERIC NOT NULL DEFAULT 35, -- Alert if above this temperature
  check_interval_hours INTEGER NOT NULL DEFAULT 6, -- Check weather every 6 hours
  last_checked_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  UNIQUE(tenant_id)
);

COMMENT ON TABLE weather_settings IS 'Weather widget settings per tenant';
COMMENT ON COLUMN weather_settings.cold_threshold IS 'Temperature threshold for cold alerts (Celsius)';
COMMENT ON COLUMN weather_settings.heat_threshold IS 'Temperature threshold for heat alerts (Celsius)';
