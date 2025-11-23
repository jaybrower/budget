-- Triggers to update budget_templates.updated_at when child records change
-- This ensures the sync status check works correctly

-- Function to update template updated_at from template_groups
CREATE OR REPLACE FUNCTION update_template_timestamp_from_group()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'DELETE' THEN
        UPDATE budget_templates
        SET updated_at = NOW()
        WHERE id = OLD.template_id;
        RETURN OLD;
    ELSE
        UPDATE budget_templates
        SET updated_at = NOW()
        WHERE id = NEW.template_id;
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to update template updated_at from template_line_items
CREATE OR REPLACE FUNCTION update_template_timestamp_from_line_item()
RETURNS TRIGGER AS $$
DECLARE
    v_template_id UUID;
BEGIN
    IF TG_OP = 'DELETE' THEN
        -- Get template_id from the group
        SELECT template_id INTO v_template_id
        FROM template_groups
        WHERE id = OLD.group_id;
    ELSE
        -- Get template_id from the group
        SELECT template_id INTO v_template_id
        FROM template_groups
        WHERE id = NEW.group_id;
    END IF;

    IF v_template_id IS NOT NULL THEN
        UPDATE budget_templates
        SET updated_at = NOW()
        WHERE id = v_template_id;
    END IF;

    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Trigger for template_groups changes
DROP TRIGGER IF EXISTS trigger_update_template_on_group_change ON template_groups;
CREATE TRIGGER trigger_update_template_on_group_change
    AFTER INSERT OR UPDATE OR DELETE ON template_groups
    FOR EACH ROW
    EXECUTE FUNCTION update_template_timestamp_from_group();

-- Trigger for template_line_items changes
DROP TRIGGER IF EXISTS trigger_update_template_on_line_item_change ON template_line_items;
CREATE TRIGGER trigger_update_template_on_line_item_change
    AFTER INSERT OR UPDATE OR DELETE ON template_line_items
    FOR EACH ROW
    EXECUTE FUNCTION update_template_timestamp_from_line_item();
