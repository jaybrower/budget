-- Create budgets table to represent shared workspaces
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for looking up budgets by creator
CREATE INDEX idx_budgets_created_by ON budgets(created_by);

-- Add comments
COMMENT ON TABLE budgets IS 'Shared budget workspaces that multiple users can access';
COMMENT ON COLUMN budgets.name IS 'Display name for the budget workspace';
COMMENT ON COLUMN budgets.created_by IS 'User who created this budget';
