-- Create budget_users table to link users to budgets they can access
CREATE TYPE budget_role AS ENUM ('owner', 'editor', 'viewer');

CREATE TABLE budget_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role budget_role NOT NULL DEFAULT 'editor',
    invited_by UUID REFERENCES users(id) ON DELETE SET NULL,
    joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(budget_id, user_id)
);

-- Indexes for efficient queries
CREATE INDEX idx_budget_users_budget_id ON budget_users(budget_id);
CREATE INDEX idx_budget_users_user_id ON budget_users(user_id);
CREATE INDEX idx_budget_users_role ON budget_users(role);

-- Create budget_invitations table for pending invites
CREATE TYPE invitation_status AS ENUM ('pending', 'accepted', 'declined', 'expired');

CREATE TABLE budget_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    budget_id UUID NOT NULL REFERENCES budgets(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role budget_role NOT NULL DEFAULT 'editor',
    invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
    status invitation_status NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    responded_at TIMESTAMP WITH TIME ZONE
);

-- Indexes for efficient queries
CREATE INDEX idx_budget_invitations_budget_id ON budget_invitations(budget_id);
CREATE INDEX idx_budget_invitations_email ON budget_invitations(email);
CREATE INDEX idx_budget_invitations_token ON budget_invitations(token);
CREATE INDEX idx_budget_invitations_status ON budget_invitations(status);

-- Add comments
COMMENT ON TABLE budget_users IS 'Links users to budgets they can access with their role';
COMMENT ON COLUMN budget_users.role IS 'User role: owner (full access), editor (can modify), viewer (read-only)';
COMMENT ON COLUMN budget_users.invited_by IS 'User who invited this member (NULL for budget creator)';

COMMENT ON TABLE budget_invitations IS 'Pending invitations to join budgets';
COMMENT ON COLUMN budget_invitations.email IS 'Email address of invited user (may not exist yet)';
COMMENT ON COLUMN budget_invitations.token IS 'Unique token for accepting invitation';
COMMENT ON COLUMN budget_invitations.status IS 'Invitation status: pending, accepted, declined, or expired';
COMMENT ON COLUMN budget_invitations.expires_at IS 'When this invitation expires (default 7 days)';
