-- Allowed emails table for registration whitelist
CREATE TABLE allowed_emails (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL UNIQUE,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID REFERENCES users(id)
);

-- Index for email lookups during registration
CREATE INDEX idx_allowed_emails_email ON allowed_emails(email);

-- Add some initial comments
COMMENT ON TABLE allowed_emails IS 'Whitelist of email addresses allowed to register for the application';
COMMENT ON COLUMN allowed_emails.email IS 'Email address that is allowed to register';
COMMENT ON COLUMN allowed_emails.notes IS 'Optional notes about why this email was added to the whitelist';
COMMENT ON COLUMN allowed_emails.created_by IS 'User ID of the person who added this email to the whitelist';
