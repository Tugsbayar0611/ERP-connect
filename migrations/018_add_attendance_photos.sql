-- Migration: Add Selfie Check to Attendance
-- Description: Add check_in_photo and check_out_photo fields for selfie verification

ALTER TABLE attendance_days ADD COLUMN IF NOT EXISTS check_in_photo TEXT; -- Base64 or URL
ALTER TABLE attendance_days ADD COLUMN IF NOT EXISTS check_out_photo TEXT; -- Base64 or URL

COMMENT ON COLUMN attendance_days.check_in_photo IS 'Selfie photo captured during check-in (Base64 or URL)';
COMMENT ON COLUMN attendance_days.check_out_photo IS 'Selfie photo captured during check-out (Base64 or URL)';
