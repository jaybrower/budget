-- Budget templates that can be reused to create monthly budget sheets
CREATE TABLE budget_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    base_income DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    is_default BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for user lookups
CREATE INDEX idx_budget_templates_user_id ON budget_templates(user_id);

-- Trigger for updated_at
CREATE TRIGGER update_budget_templates_updated_at
    BEFORE UPDATE ON budget_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
