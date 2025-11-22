-- Actual monthly budget sheets created from templates
CREATE TABLE budget_sheets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    template_id UUID REFERENCES budget_templates(id) ON DELETE SET NULL, -- Keep sheet if template deleted
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Budget period
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),

    -- Income fields
    base_income DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    additional_income DECIMAL(12, 2) NOT NULL DEFAULT 0.00, -- Extra income for this month
    rolled_over_income DECIMAL(12, 2) NOT NULL DEFAULT 0.00, -- Leftover from previous months

    -- Status tracking
    is_finalized BOOLEAN NOT NULL DEFAULT false,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX idx_budget_sheets_user_id ON budget_sheets(user_id);
CREATE INDEX idx_budget_sheets_year_month ON budget_sheets(year, month);
CREATE UNIQUE INDEX idx_budget_sheets_user_year_month ON budget_sheets(user_id, year, month);

-- Trigger for updated_at
CREATE TRIGGER update_budget_sheets_updated_at
    BEFORE UPDATE ON budget_sheets
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
