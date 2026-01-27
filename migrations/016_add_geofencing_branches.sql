-- Migration: Add Geofencing Fields to Branches
-- Description: Add latitude, longitude, and geofence_radius to branches table for GPS-based check-in

ALTER TABLE branches ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8);
ALTER TABLE branches ADD COLUMN IF NOT EXISTS geofence_radius INTEGER DEFAULT 100; -- meters

COMMENT ON COLUMN branches.latitude IS 'Office latitude for geofencing check-in';
COMMENT ON COLUMN branches.longitude IS 'Office longitude for geofencing check-in';
COMMENT ON COLUMN branches.geofence_radius IS 'Geofence radius in meters (default: 100m)';
