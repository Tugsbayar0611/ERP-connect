-- Migration: Add Two-Factor Authentication (2FA) support
-- Date: 2025-01-XX
-- Description: Add 2FA fields to users table

-- Add 2FA columns to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS two_factor_secret TEXT,
ADD COLUMN IF NOT EXISTS two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Add index for faster lookups (optional, but helpful for queries filtering by 2FA status)
CREATE INDEX IF NOT EXISTS idx_users_two_factor_enabled ON users(two_factor_enabled) WHERE two_factor_enabled = TRUE;

-- Add comment
COMMENT ON COLUMN users.two_factor_secret IS 'TOTP secret (base32 encoded). Should be encrypted in production.';
COMMENT ON COLUMN users.two_factor_enabled IS 'Whether 2FA is enabled for this user';
