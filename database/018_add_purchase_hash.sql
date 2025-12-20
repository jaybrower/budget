-- Migration: Add hash column to purchases table for duplicate detection
-- This hash is computed from purchase_date, merchant, description, and amount
-- to prevent importing duplicate transactions

ALTER TABLE purchases
ADD COLUMN hash VARCHAR(64);

-- Create unique index on user_id and hash to prevent duplicate purchases per user
CREATE UNIQUE INDEX idx_purchases_user_hash ON purchases(user_id, hash)
WHERE hash IS NOT NULL;

-- Add index for faster hash lookups
CREATE INDEX idx_purchases_hash ON purchases(hash)
WHERE hash IS NOT NULL;

COMMENT ON COLUMN purchases.hash IS 'SHA-256 hash of purchase_date, merchant, description, and amount for duplicate detection';
