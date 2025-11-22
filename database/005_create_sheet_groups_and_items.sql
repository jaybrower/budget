-- Groups within a budget sheet (copied from template when sheet is created)
CREATE TABLE sheet_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sheet_id UUID NOT NULL REFERENCES budget_sheets(id) ON DELETE CASCADE,
    template_group_id UUID REFERENCES template_groups(id) ON DELETE SET NULL, -- Reference to source
    name VARCHAR(255) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for sheet lookups
CREATE INDEX idx_sheet_groups_sheet_id ON sheet_groups(sheet_id);

-- Trigger for updated_at
CREATE TRIGGER update_sheet_groups_updated_at
    BEFORE UPDATE ON sheet_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Line items within a budget sheet group
CREATE TABLE sheet_line_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    group_id UUID NOT NULL REFERENCES sheet_groups(id) ON DELETE CASCADE,
    template_line_item_id UUID REFERENCES template_line_items(id) ON DELETE SET NULL, -- Reference to source
    name VARCHAR(255) NOT NULL,
    description TEXT,

    -- Budget amounts
    budgeted_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00, -- Planned amount for this month
    actual_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00, -- What was actually spent/saved

    -- Rollover tracking
    is_rollover BOOLEAN NOT NULL DEFAULT false, -- Whether this item rolls over
    rolled_over_amount DECIMAL(12, 2) NOT NULL DEFAULT 0.00, -- Amount carried from previous months

    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for group lookups
CREATE INDEX idx_sheet_line_items_group_id ON sheet_line_items(group_id);

-- Trigger for updated_at
CREATE TRIGGER update_sheet_line_items_updated_at
    BEFORE UPDATE ON sheet_line_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
