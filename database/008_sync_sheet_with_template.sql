-- Function to sync a budget sheet with changes made to its template
-- This adds new groups and line items from the template that don't exist in the sheet
-- Existing items are preserved (actual_amount, rolled_over_amount remain unchanged)
CREATE OR REPLACE FUNCTION sync_sheet_with_template(
    p_sheet_id UUID,
    p_update_existing BOOLEAN DEFAULT false
) RETURNS TABLE (
    groups_added INTEGER,
    items_added INTEGER,
    groups_updated INTEGER,
    items_updated INTEGER
) AS $$
DECLARE
    v_template_id UUID;
    v_user_id UUID;
    v_groups_added INTEGER := 0;
    v_items_added INTEGER := 0;
    v_groups_updated INTEGER := 0;
    v_items_updated INTEGER := 0;
    v_group_record RECORD;
    v_item_record RECORD;
    v_existing_group_id UUID;
    v_new_group_id UUID;
BEGIN
    -- Get sheet info and verify it has a template
    SELECT bs.template_id, bs.user_id
    INTO v_template_id, v_user_id
    FROM budget_sheets bs
    WHERE bs.id = p_sheet_id;

    IF v_template_id IS NULL THEN
        RAISE EXCEPTION 'Sheet not found or has no associated template: %', p_sheet_id;
    END IF;

    -- Loop through all template groups
    FOR v_group_record IN
        SELECT id, name, description, sort_order
        FROM template_groups
        WHERE template_id = v_template_id
        ORDER BY sort_order
    LOOP
        -- Check if this group already exists in the sheet
        SELECT id INTO v_existing_group_id
        FROM sheet_groups
        WHERE sheet_id = p_sheet_id
          AND template_group_id = v_group_record.id;

        IF v_existing_group_id IS NULL THEN
            -- Group doesn't exist, create it
            INSERT INTO sheet_groups (
                sheet_id,
                template_group_id,
                name,
                description,
                sort_order
            ) VALUES (
                p_sheet_id,
                v_group_record.id,
                v_group_record.name,
                v_group_record.description,
                v_group_record.sort_order
            ) RETURNING id INTO v_new_group_id;

            v_groups_added := v_groups_added + 1;

            -- Add all line items for this new group
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
                    0.00,
                    v_item_record.sort_order
                );

                v_items_added := v_items_added + 1;
            END LOOP;
        ELSE
            -- Group exists, check for new line items and optionally update existing
            IF p_update_existing THEN
                -- Update existing group metadata
                UPDATE sheet_groups
                SET name = v_group_record.name,
                    description = v_group_record.description,
                    sort_order = v_group_record.sort_order,
                    updated_at = NOW()
                WHERE id = v_existing_group_id
                  AND (name != v_group_record.name
                       OR COALESCE(description, '') != COALESCE(v_group_record.description, '')
                       OR sort_order != v_group_record.sort_order);

                IF FOUND THEN
                    v_groups_updated := v_groups_updated + 1;
                END IF;
            END IF;

            -- Check for new or updated line items in this existing group
            FOR v_item_record IN
                SELECT id, name, description, budgeted_amount, is_rollover, sort_order
                FROM template_line_items
                WHERE group_id = v_group_record.id
                ORDER BY sort_order
            LOOP
                -- Check if this line item exists in the sheet
                IF NOT EXISTS (
                    SELECT 1 FROM sheet_line_items
                    WHERE group_id = v_existing_group_id
                      AND template_line_item_id = v_item_record.id
                ) THEN
                    -- Line item doesn't exist, create it
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
                        v_existing_group_id,
                        v_item_record.id,
                        v_item_record.name,
                        v_item_record.description,
                        v_item_record.budgeted_amount,
                        0.00,
                        v_item_record.is_rollover,
                        0.00,
                        v_item_record.sort_order
                    );

                    v_items_added := v_items_added + 1;
                ELSIF p_update_existing THEN
                    -- Update existing line item metadata (preserve actual_amount and rolled_over_amount)
                    UPDATE sheet_line_items
                    SET name = v_item_record.name,
                        description = v_item_record.description,
                        budgeted_amount = v_item_record.budgeted_amount,
                        is_rollover = v_item_record.is_rollover,
                        sort_order = v_item_record.sort_order,
                        updated_at = NOW()
                    WHERE group_id = v_existing_group_id
                      AND template_line_item_id = v_item_record.id
                      AND (name != v_item_record.name
                           OR COALESCE(description, '') != COALESCE(v_item_record.description, '')
                           OR budgeted_amount != v_item_record.budgeted_amount
                           OR is_rollover != v_item_record.is_rollover
                           OR sort_order != v_item_record.sort_order);

                    IF FOUND THEN
                        v_items_updated := v_items_updated + 1;
                    END IF;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    RETURN QUERY SELECT v_groups_added, v_items_added, v_groups_updated, v_items_updated;
END;
$$ LANGUAGE plpgsql;
