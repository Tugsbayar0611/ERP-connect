-- Migration: Add WiFi SSID to Branches
-- Description: Add office_wifi_ssid field for WiFi-based check-in validation

ALTER TABLE branches ADD COLUMN IF NOT EXISTS office_wifi_ssid TEXT[];

COMMENT ON COLUMN branches.office_wifi_ssid IS 'Office WiFi SSID list for check-in validation (e.g., ["Office-WiFi-5G", "Office-Guest"])';
