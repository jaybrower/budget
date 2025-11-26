-- Helper function to check if a user has access to a budget
CREATE OR REPLACE FUNCTION user_has_budget_access(p_user_id UUID, p_budget_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM budget_users
        WHERE user_id = p_user_id
        AND budget_id = p_budget_id
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to check if a user has a specific role or higher
CREATE OR REPLACE FUNCTION user_has_budget_role(
    p_user_id UUID,
    p_budget_id UUID,
    p_required_role budget_role
)
RETURNS BOOLEAN AS $$
DECLARE
    v_user_role budget_role;
    v_role_hierarchy INT;
    v_required_hierarchy INT;
BEGIN
    -- Get user's role
    SELECT role INTO v_user_role
    FROM budget_users
    WHERE user_id = p_user_id
    AND budget_id = p_budget_id;

    -- If user not found, return false
    IF v_user_role IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Define role hierarchy (higher number = more permissions)
    v_role_hierarchy := CASE v_user_role
        WHEN 'owner' THEN 3
        WHEN 'editor' THEN 2
        WHEN 'viewer' THEN 1
    END;

    v_required_hierarchy := CASE p_required_role
        WHEN 'owner' THEN 3
        WHEN 'editor' THEN 2
        WHEN 'viewer' THEN 1
    END;

    RETURN v_role_hierarchy >= v_required_hierarchy;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to get user's budget IDs
CREATE OR REPLACE FUNCTION get_user_budget_ids(p_user_id UUID)
RETURNS TABLE(budget_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT bu.budget_id
    FROM budget_users bu
    WHERE bu.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function to accept a pending invitation
CREATE OR REPLACE FUNCTION accept_budget_invitation(
    p_token UUID,
    p_user_id UUID
)
RETURNS TABLE(
    budget_id UUID,
    budget_name VARCHAR(255),
    role budget_role
) AS $$
DECLARE
    v_invitation RECORD;
    v_user_email VARCHAR(255);
BEGIN
    -- Get the invitation
    SELECT * INTO v_invitation
    FROM budget_invitations
    WHERE token = p_token
    AND status = 'pending'
    AND expires_at > CURRENT_TIMESTAMP;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Invalid or expired invitation token';
    END IF;

    -- Verify email matches
    SELECT email INTO STRICT v_user_email
    FROM users
    WHERE id = p_user_id;

    IF LOWER(v_user_email) != LOWER(v_invitation.email) THEN
        RAISE EXCEPTION 'This invitation was sent to a different email address';
    END IF;

    -- Check if user is already a member
    IF EXISTS (
        SELECT 1 FROM budget_users
        WHERE budget_users.budget_id = v_invitation.budget_id
        AND budget_users.user_id = p_user_id
    ) THEN
        -- Update invitation status but don't add duplicate
        UPDATE budget_invitations
        SET status = 'accepted',
            responded_at = CURRENT_TIMESTAMP
        WHERE id = v_invitation.id;

        RAISE EXCEPTION 'You are already a member of this budget';
    END IF;

    -- Add user to budget
    INSERT INTO budget_users (budget_id, user_id, role, invited_by)
    VALUES (v_invitation.budget_id, p_user_id, v_invitation.role, v_invitation.invited_by);

    -- Update invitation status
    UPDATE budget_invitations
    SET status = 'accepted',
        responded_at = CURRENT_TIMESTAMP
    WHERE id = v_invitation.id;

    -- Return budget info
    RETURN QUERY
    SELECT b.id, b.name, v_invitation.role
    FROM budgets b
    WHERE b.id = v_invitation.budget_id;
END;
$$ LANGUAGE plpgsql;

-- Helper function to auto-accept invitations when a new user registers
CREATE OR REPLACE FUNCTION auto_accept_pending_invitations(p_user_id UUID)
RETURNS TABLE(
    budget_id UUID,
    budget_name VARCHAR(255),
    role budget_role
) AS $$
DECLARE
    v_user_email VARCHAR(255);
    v_invitation RECORD;
BEGIN
    -- Get user email
    SELECT email INTO v_user_email
    FROM users
    WHERE id = p_user_id;

    -- Find all pending invitations for this email
    FOR v_invitation IN
        SELECT bi.*
        FROM budget_invitations bi
        WHERE LOWER(bi.email) = LOWER(v_user_email)
        AND bi.status = 'pending'
        AND bi.expires_at > CURRENT_TIMESTAMP
    LOOP
        -- Add user to budget (skip if already exists)
        INSERT INTO budget_users (budget_id, user_id, role, invited_by)
        VALUES (v_invitation.budget_id, p_user_id, v_invitation.role, v_invitation.invited_by)
        ON CONFLICT (budget_id, user_id) DO NOTHING;

        -- Update invitation status
        UPDATE budget_invitations
        SET status = 'accepted',
            responded_at = CURRENT_TIMESTAMP
        WHERE id = v_invitation.id;
    END LOOP;

    -- Return all budgets the user now has access to from invitations
    RETURN QUERY
    SELECT b.id, b.name, bu.role
    FROM budget_users bu
    JOIN budgets b ON b.id = bu.budget_id
    WHERE bu.user_id = p_user_id
    AND bu.invited_by IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON FUNCTION user_has_budget_access IS 'Check if a user has any access to a budget';
COMMENT ON FUNCTION user_has_budget_role IS 'Check if a user has a specific role or higher for a budget';
COMMENT ON FUNCTION get_user_budget_ids IS 'Get all budget IDs a user has access to';
COMMENT ON FUNCTION accept_budget_invitation IS 'Accept a pending budget invitation using the token';
COMMENT ON FUNCTION auto_accept_pending_invitations IS 'Auto-accept all pending invitations for a newly registered user';
