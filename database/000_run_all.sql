-- Master script to run all database migrations in order
-- Run this script to set up the complete database schema

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

\echo 'Running 001_create_users.sql...'
\i 001_create_users.sql

\echo 'Running 002_create_budget_templates.sql...'
\i 002_create_budget_templates.sql

\echo 'Running 003_create_template_groups_and_items.sql...'
\i 003_create_template_groups_and_items.sql

\echo 'Running 004_create_budget_sheets.sql...'
\i 004_create_budget_sheets.sql

\echo 'Running 005_create_sheet_groups_and_items.sql...'
\i 005_create_sheet_groups_and_items.sql

\echo 'Running 006_create_views_and_functions.sql...'
\i 006_create_views_and_functions.sql

\echo 'Running 007_create_purchases.sql...'
\i 007_create_purchases.sql

\echo 'Running 008_sync_sheet_with_template.sql...'
\i 008_sync_sheet_with_template.sql

\echo 'Running 009_template_updated_at_triggers.sql...'
\i 009_template_updated_at_triggers.sql

\echo 'Running 010_add_sheet_synced_at.sql...'
\i 010_add_sheet_synced_at.sql

\echo 'Running 011_create_plaid_tables.sql...'
\i 011_create_plaid_tables.sql

\echo 'Running 012_create_allowed_emails.sql...'
\i 012_create_allowed_emails.sql

\echo 'Running 013_create_budgets.sql...'
\i 013_create_budgets.sql

\echo 'Running 014_create_budget_sharing.sql...'
\i 014_create_budget_sharing.sql

\echo 'Running 015_add_budget_id_to_tables.sql...'
\i 015_add_budget_id_to_tables.sql

\echo 'Running 016_create_budget_helper_functions.sql...'
\i 016_create_budget_helper_functions.sql

\echo 'Database schema created successfully!'
