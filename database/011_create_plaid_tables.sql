-- Plaid Integration Tables
-- Creates tables for storing Plaid items (linked institutions) and accounts

-- Table for storing linked Plaid items (institutions)
CREATE TABLE plaid_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    access_token TEXT NOT NULL,  -- Encrypted Plaid access token
    item_id VARCHAR(255) NOT NULL,  -- Plaid's item identifier
    institution_id VARCHAR(255),
    institution_name VARCHAR(255),
    cursor TEXT,  -- For transaction sync pagination
    last_synced_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, item_id)
);

-- Table for individual accounts within a Plaid item
CREATE TABLE plaid_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plaid_item_id UUID NOT NULL REFERENCES plaid_items(id) ON DELETE CASCADE,
    account_id VARCHAR(255) NOT NULL,  -- Plaid's account ID
    name VARCHAR(255),
    official_name VARCHAR(255),
    type VARCHAR(50),  -- credit, depository, etc.
    subtype VARCHAR(50),  -- credit card, checking, etc.
    mask VARCHAR(10),  -- Last 4 digits
    payment_method VARCHAR(50),  -- Maps to existing payment_method field in purchases
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(plaid_item_id, account_id)
);

-- Add Plaid tracking columns to purchases table
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS plaid_transaction_id VARCHAR(255);
ALTER TABLE purchases ADD COLUMN IF NOT EXISTS plaid_account_id UUID REFERENCES plaid_accounts(id);

-- Create unique index for Plaid transaction deduplication
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchases_plaid_transaction_id
ON purchases(plaid_transaction_id)
WHERE plaid_transaction_id IS NOT NULL;

-- Create indexes for common queries
CREATE INDEX idx_plaid_items_user_id ON plaid_items(user_id);
CREATE INDEX idx_plaid_items_item_id ON plaid_items(item_id);
CREATE INDEX idx_plaid_accounts_plaid_item_id ON plaid_accounts(plaid_item_id);
CREATE INDEX idx_plaid_accounts_account_id ON plaid_accounts(account_id);
CREATE INDEX idx_purchases_plaid_account_id ON purchases(plaid_account_id) WHERE plaid_account_id IS NOT NULL;

-- Add updated_at triggers
CREATE TRIGGER update_plaid_items_updated_at
    BEFORE UPDATE ON plaid_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_plaid_accounts_updated_at
    BEFORE UPDATE ON plaid_accounts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
