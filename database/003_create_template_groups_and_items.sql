-- Groups within a budget template (e.g., Housing, Utilities, Savings)
CREATE TABLE template_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    template_id UUID NOT NULL REFERENCES budget_templates(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for template lookups
CREATE INDEX idx_template_groups_template_id ON template_groups(template_id);

-- Trigger for updated_at
CREATE TRIGGER update_template_groups_updated_at
    BEFORE UPDATE ON template_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Line items within a template group (e.g., Rent, Electric Bill, Emergency Fund)
CREATE TABLE template_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES template_groups(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    budgeted_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00,
    is_rollover BOOLEAN NOT NULL DEFAULT false, -- Whether unused funds roll over to next month
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for group lookups
CREATE INDEX idx_template_line_items_group_id ON template_line_items(group_id);

-- Trigger for updated_at
CREATE TRIGGER update_template_line_items_updated_at
    BEFORE UPDATE ON template_line_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
