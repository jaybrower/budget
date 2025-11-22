-- View to calculate total income for a budget sheet
CREATE VIEW budget_sheet_totals AS
SELECT
    bs.id AS sheet_id,
    bs.user_id,
    bs.year,
    bs.month,
    bs.base_income,
    bs.additional_income,
    bs.rolled_over_income,
    (bs.base_income + bs.additional_income + bs.rolled_over_income) AS total_income,
    COALESCE(SUM(sli.budgeted_amount), 0) AS total_budgeted,
    COALESCE(SUM(sli.actual_amount), 0) AS total_actual,
    (bs.base_income + bs.additional_income + bs.rolled_over_income - COALESCE(SUM(sli.budgeted_amount), 0)) AS budgeted_remaining,
    (bs.base_income + bs.additional_income + bs.rolled_over_income - COALESCE(SUM(sli.actual_amount), 0)) AS actual_remaining
FROM budget_sheets bs
LEFT JOIN sheet_groups sg ON sg.sheet_id = bs.id
LEFT JOIN sheet_line_items sli ON sli.group_id = sg.id
GROUP BY bs.id, bs.user_id, bs.year, bs.month, bs.base_income, bs.additional_income, bs.rolled_over_income;

-- View to get rollover items and their accumulated amounts
CREATE VIEW rollover_item_totals AS
SELECT
    sli.id AS line_item_id,
    sli.name,
    sg.sheet_id,
    bs.user_id,
    bs.year,
    bs.month,
    sli.budgeted_amount,
    sli.actual_amount,
    sli.rolled_over_amount,
    (sli.rolled_over_amount + sli.budgeted_amount - sli.actual_amount) AS available_balance
FROM sheet_line_items sli
JOIN sheet_groups sg ON sg.id = sli.group_id
JOIN budget_sheets bs ON bs.id = sg.sheet_id
WHERE sli.is_rollover = true;

-- Function to create a budget sheet from a template
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
    v_template_name VARCHAR(255);
    v_base_income DECIMAL(12, 2);
    v_group_record RECORD;
    v_new_group_id UUID;
    v_item_record RECORD;
BEGIN
    -- Get template info
    SELECT user_id, name, base_income
    INTO v_user_id, v_template_name, v_base_income
    FROM budget_templates
    WHERE id = p_template_id;

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Template not found: %', p_template_id;
    END IF;

    -- Create the budget sheet
    INSERT INTO budget_sheets (
        user_id,
        template_id,
        name,
        year,
        month,
        base_income,
        additional_income,
        rolled_over_income
    ) VALUES (
        v_user_id,
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

-- Function to carry over rollover amounts from previous month
CREATE OR REPLACE FUNCTION carry_over_rollover_amounts(
    p_sheet_id UUID
) RETURNS VOID AS $$
DECLARE
    v_user_id UUID;
    v_year INTEGER;
    v_month INTEGER;
    v_prev_year INTEGER;
    v_prev_month INTEGER;
    v_prev_sheet_id UUID;
BEGIN
    -- Get current sheet info
    SELECT user_id, year, month
    INTO v_user_id, v_year, v_month
    FROM budget_sheets
    WHERE id = p_sheet_id;

    -- Calculate previous month
    IF v_month = 1 THEN
        v_prev_year := v_year - 1;
        v_prev_month := 12;
    ELSE
        v_prev_year := v_year;
        v_prev_month := v_month - 1;
    END IF;

    -- Find previous month's sheet
    SELECT id INTO v_prev_sheet_id
    FROM budget_sheets
    WHERE user_id = v_user_id
      AND year = v_prev_year
      AND month = v_prev_month;

    IF v_prev_sheet_id IS NULL THEN
        RETURN; -- No previous sheet to carry over from
    END IF;

    -- Update rollover amounts for matching line items
    UPDATE sheet_line_items sli_current
    SET rolled_over_amount = (
        SELECT (sli_prev.rolled_over_amount + sli_prev.budgeted_amount - sli_prev.actual_amount)
        FROM sheet_line_items sli_prev
        JOIN sheet_groups sg_prev ON sg_prev.id = sli_prev.group_id
        WHERE sg_prev.sheet_id = v_prev_sheet_id
          AND sli_prev.template_line_item_id = sli_current.template_line_item_id
          AND sli_prev.is_rollover = true
    )
    WHERE sli_current.group_id IN (
        SELECT id FROM sheet_groups WHERE sheet_id = p_sheet_id
    )
    AND sli_current.is_rollover = true
    AND sli_current.template_line_item_id IS NOT NULL;
END;
$$ LANGUAGE plpgsql;
