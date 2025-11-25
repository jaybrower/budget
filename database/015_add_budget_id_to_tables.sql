-- Add budget_id to existing tables and migrate data

-- Step 1: Add budget_id columns (nullable initially for migration)
ALTER TABLE budget_templates ADD COLUMN budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE;
ALTER TABLE budget_sheets ADD COLUMN budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE;
ALTER TABLE purchases ADD COLUMN budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE;
ALTER TABLE plaid_items ADD COLUMN budget_id UUID REFERENCES budgets(id) ON DELETE CASCADE;

-- Step 2: Create a default budget for each existing user
-- This migration assumes users already exist
INSERT INTO budgets (name, created_by)
SELECT
    COALESCE(first_name || '''s Budget', 'My Budget'),
    id
FROM users
WHERE is_active = true;

-- Step 3: Link each user to their default budget as owner
INSERT INTO budget_users (budget_id, user_id, role, invited_by)
SELECT
    b.id,
    b.created_by,
    'owner',
    NULL
FROM budgets b;

-- Step 4: Migrate existing data to link to user's default budget
UPDATE budget_templates bt
SET budget_id = b.id
FROM budgets b
WHERE bt.user_id = b.created_by;

UPDATE budget_sheets bs
SET budget_id = b.id
FROM budgets b
WHERE bs.user_id = b.created_by;

UPDATE purchases p
SET budget_id = b.id
FROM budgets b
WHERE p.user_id = b.created_by;

UPDATE plaid_items pi
SET budget_id = b.id
FROM budgets b
WHERE pi.user_id = b.created_by;

-- Step 5: Make budget_id NOT NULL now that data is migrated
ALTER TABLE budget_templates ALTER COLUMN budget_id SET NOT NULL;
ALTER TABLE budget_sheets ALTER COLUMN budget_id SET NOT NULL;
ALTER TABLE purchases ALTER COLUMN budget_id SET NOT NULL;
ALTER TABLE plaid_items ALTER COLUMN budget_id SET NOT NULL;

-- Step 6: Create indexes for efficient queries
CREATE INDEX idx_budget_templates_budget_id ON budget_templates(budget_id);
CREATE INDEX idx_budget_sheets_budget_id ON budget_sheets(budget_id);
CREATE INDEX idx_purchases_budget_id ON purchases(budget_id);
CREATE INDEX idx_plaid_items_budget_id ON plaid_items(budget_id);

-- Step 7: Update unique constraint on budget_sheets to be per-budget instead of per-user
DROP INDEX idx_budget_sheets_user_year_month;
CREATE UNIQUE INDEX idx_budget_sheets_budget_year_month ON budget_sheets(budget_id, year, month);

-- Add comments
COMMENT ON COLUMN budget_templates.budget_id IS 'Budget workspace this template belongs to';
COMMENT ON COLUMN budget_sheets.budget_id IS 'Budget workspace this sheet belongs to';
COMMENT ON COLUMN purchases.budget_id IS 'Budget workspace this purchase belongs to';
COMMENT ON COLUMN plaid_items.budget_id IS 'Budget workspace this linked account belongs to';
