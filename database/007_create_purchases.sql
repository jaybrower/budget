-- Individual purchases/transactions for budget line items
CREATE TABLE purchases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    line_item_id UUID REFERENCES sheet_line_items(id) ON DELETE CASCADE, -- NULL for unassociated imports
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE, -- Owner of the purchase

    -- Purchase details
    amount DECIMAL(12, 2) NOT NULL,
    description TEXT,

    -- Payment method tracking
    payment_method VARCHAR(50), -- e.g., 'credit_card', 'debit_card', 'cash', 'check', 'transfer'

    -- Optional reference info
    merchant VARCHAR(255),
    reference_number VARCHAR(100), -- receipt number, transaction ID, etc.

    -- When the purchase occurred
    purchase_date DATE NOT NULL DEFAULT CURRENT_DATE,

    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for line item lookups (most common query)
CREATE INDEX idx_purchases_line_item_id ON purchases(line_item_id);

-- Index for user lookups (for unassociated purchases)
CREATE INDEX idx_purchases_user_id ON purchases(user_id);

-- Index for date-based queries
CREATE INDEX idx_purchases_purchase_date ON purchases(purchase_date);

-- Trigger for updated_at
CREATE TRIGGER update_purchases_updated_at
    BEFORE UPDATE ON purchases
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Function to update actual_amount when purchases change
CREATE OR REPLACE FUNCTION update_line_item_actual_amount()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- Only update if the purchase was associated with a line item
        IF OLD.line_item_id IS NOT NULL THEN
            UPDATE sheet_line_items
            SET actual_amount = COALESCE((
                SELECT SUM(amount)
                FROM purchases
                WHERE line_item_id = OLD.line_item_id
            ), 0)
            WHERE id = OLD.line_item_id;
        END IF;
        RETURN OLD;
    ELSIF TG_OP = 'UPDATE' THEN
        -- Handle reassignment: update old line item if it had one
        IF OLD.line_item_id IS NOT NULL AND (NEW.line_item_id IS NULL OR OLD.line_item_id != NEW.line_item_id) THEN
            UPDATE sheet_line_items
            SET actual_amount = COALESCE((
                SELECT SUM(amount)
                FROM purchases
                WHERE line_item_id = OLD.line_item_id
            ), 0)
            WHERE id = OLD.line_item_id;
        END IF;
        -- Update new line item if it has one
        IF NEW.line_item_id IS NOT NULL THEN
            UPDATE sheet_line_items
            SET actual_amount = COALESCE((
                SELECT SUM(amount)
                FROM purchases
                WHERE line_item_id = NEW.line_item_id
            ), 0)
            WHERE id = NEW.line_item_id;
        END IF;
        RETURN NEW;
    ELSE -- INSERT
        -- Only update if associating with a line item
        IF NEW.line_item_id IS NOT NULL THEN
            UPDATE sheet_line_items
            SET actual_amount = COALESCE((
                SELECT SUM(amount)
                FROM purchases
                WHERE line_item_id = NEW.line_item_id
            ), 0)
            WHERE id = NEW.line_item_id;
        END IF;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Triggers to automatically update actual_amount
CREATE TRIGGER update_actual_on_purchase_insert
    AFTER INSERT ON purchases
    FOR EACH ROW
    EXECUTE FUNCTION update_line_item_actual_amount();

CREATE TRIGGER update_actual_on_purchase_update
    AFTER UPDATE ON purchases
    FOR EACH ROW
    EXECUTE FUNCTION update_line_item_actual_amount();

CREATE TRIGGER update_actual_on_purchase_delete
    AFTER DELETE ON purchases
    FOR EACH ROW
    EXECUTE FUNCTION update_line_item_actual_amount();

-- View to see purchases with their line item and budget context
CREATE VIEW purchase_details AS
SELECT
    p.id AS purchase_id,
    p.amount,
    p.description AS purchase_description,
    p.payment_method,
    p.merchant,
    p.reference_number,
    p.purchase_date,
    p.created_at,
    sli.id AS line_item_id,
    sli.name AS line_item_name,
    sli.budgeted_amount,
    sli.actual_amount,
    sg.id AS group_id,
    sg.name AS group_name,
    bs.id AS sheet_id,
    bs.year,
    bs.month,
    bs.user_id
FROM purchases p
JOIN sheet_line_items sli ON sli.id = p.line_item_id
JOIN sheet_groups sg ON sg.id = sli.group_id
JOIN budget_sheets bs ON bs.id = sg.sheet_id;

-- View to summarize purchases by payment method for a line item
CREATE VIEW line_item_purchase_summary AS
SELECT
    sli.id AS line_item_id,
    sli.name AS line_item_name,
    sli.budgeted_amount,
    sli.actual_amount,
    COUNT(p.id) AS purchase_count,
    p.payment_method,
    COALESCE(SUM(p.amount), 0) AS method_total
FROM sheet_line_items sli
LEFT JOIN purchases p ON p.line_item_id = sli.id
GROUP BY sli.id, sli.name, sli.budgeted_amount, sli.actual_amount, p.payment_method;

-- View to show all unassociated purchases (imported but not yet categorized)
CREATE VIEW unassociated_purchases AS
SELECT
    p.id AS purchase_id,
    p.user_id,
    p.amount,
    p.description,
    p.payment_method,
    p.merchant,
    p.reference_number,
    p.purchase_date,
    p.created_at,
    p.updated_at
FROM purchases p
WHERE p.line_item_id IS NULL
ORDER BY p.purchase_date DESC, p.created_at DESC;
