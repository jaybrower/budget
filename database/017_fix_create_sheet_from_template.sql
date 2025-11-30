-- Fix create_sheet_from_template function to include budget_id
-- This function was created before budget_id was added to budget_sheets

CREATE OR REPLACE FUNCTION create_sheet_from_template(
    p_template_id UUID,
    p_year INTEGER,
    p_month INTEGER,
    p_additional_income DECIMAL DEFAULT 0.00,
    p_rolled_over_income DECIMAL DEFAULT 0.00
) RETURNS UUID AS $$
DECLARE
    v_sheet_id UUID;
    v_user_id UUID;
    v_budget_id UUID;
    v_template_name VARCHAR(255);
    v_base_income DECIMAL(12, 2);
    v_group_record RECORD;
    v_new_group_id UUID;
    v_item_record RECORD;
BEGIN
    -- Get template info (now including budget_id)
    SELECT user_id, budget_id, name, base_income
    INTO v_user_id, v_budget_id, v_template_name, v_base_income
    FROM budget_templates
    WHERE id = p_template_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Template not found: %', p_template_id;
    END IF;

    -- Create the budget sheet (now including budget_id)
    INSERT INTO budget_sheets (
        user_id,
        budget_id,
        template_id,
        name,
        year,
        month,
        base_income,
        additional_income,
        rolled_over_income
    ) VALUES (
        v_user_id,
        v_budget_id,
        p_template_id,
        v_template_name || ' - ' || p_year || '/' || LPAD(p_month::TEXT, 2, '0'),
        p_year,
        p_month,
        v_base_income,
        p_additional_income,
        p_rolled_over_income
    ) RETURNING id INTO v_sheet_id;

    -- Copy groups from template
    FOR v_group_record IN
        SELECT id, name, description, sort_order
        FROM template_groups
        WHERE template_id = p_template_id
        ORDER BY sort_order
    LOOP
        INSERT INTO sheet_groups (
            sheet_id,
            template_group_id,
            name,
            description,
            sort_order
        ) VALUES (
            v_sheet_id,
            v_group_record.id,
            v_group_record.name,
            v_group_record.description,
            v_group_record.sort_order
        ) RETURNING id INTO v_new_group_id;

        -- Copy line items for this group
        FOR v_item_record IN
            SELECT id, name, description, budgeted_amount, is_rollover, sort_order
            FROM template_line_items
            WHERE group_id = v_group_record.id
            ORDER BY sort_order
        LOOP
            INSERT INTO sheet_line_items (
                group_id,
                template_line_item_id,
                name,
                description,
                budgeted_amount,
                actual_amount,
                is_rollover,
                rolled_over_amount,
                sort_order
            ) VALUES (
                v_new_group_id,
                v_item_record.id,
                v_item_record.name,
                v_item_record.description,
                v_item_record.budgeted_amount,
                0.00,
                v_item_record.is_rollover,
                0.00, -- Will be updated separately with rollover amounts
                v_item_record.sort_order
            );
        END LOOP;
    END LOOP;

    RETURN v_sheet_id;
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION create_sheet_from_template IS 'Creates a new budget sheet from a template, including all groups and line items';
