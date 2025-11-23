-- Add synced_at column to budget_sheets to track when it was last synced with its template
-- This is used for accurate sync status comparison instead of created_at

ALTER TABLE budget_sheets
ADD COLUMN synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Initialize synced_at to created_at for existing sheets
UPDATE budget_sheets SET synced_at = created_at;

-- Make it NOT NULL after setting default values
ALTER TABLE budget_sheets
ALTER COLUMN synced_at SET NOT NULL;
