-- ==========================================
-- CREATE PASSWORD RESET TOKENS TABLE
-- Нууц үг сэргээх токен хүснэгт үүсгэх
-- ==========================================

-- Create password_reset_tokens table if it doesn't exist
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  token_hash text NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  used boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS password_reset_tokens_user_id_idx 
  ON password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS password_reset_tokens_expires_at_idx 
  ON password_reset_tokens(expires_at);

-- Cleanup function to remove expired tokens (optional, can be run periodically)
COMMENT ON TABLE password_reset_tokens IS 'Нууц үг сэргээх токенууд';
COMMENT ON COLUMN password_reset_tokens.token_hash IS 'Токений hash (security)';
COMMENT ON COLUMN password_reset_tokens.expires_at IS 'Токений хүчинтэй хугацаа';
COMMENT ON COLUMN password_reset_tokens.used IS 'Токен ашиглагдсан эсэх';
