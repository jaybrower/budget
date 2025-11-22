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

\echo 'Database schema created successfully!'
