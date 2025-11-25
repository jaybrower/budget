# Budget Sharing Migration Guide

This document outlines the changes made to implement multi-user budget sharing functionality.

## Overview

The application has been migrated from a single-user ownership model to a multi-user shared budget workspace model. Users can now:
- Create multiple budgets
- Invite other users to their budgets via email
- Accept/decline invitations
- Share budgets even with users who haven't registered yet (pending invitations)
- Have different roles (owner, editor, viewer) with different permissions

## Database Changes

### New Tables

1. **budgets** - Represents shared budget workspaces
   - `id`, `name`, `created_by`, `created_at`, `updated_at`

2. **budget_users** - Links users to budgets with roles
   - `id`, `budget_id`, `user_id`, `role`, `invited_by`, `joined_at`
   - Role: `owner` (full access), `editor` (can modify), `viewer` (read-only)

3. **budget_invitations** - Pending invitations to join budgets
   - `id`, `budget_id`, `email`, `role`, `invited_by`, `token`, `status`, `expires_at`
   - Status: `pending`, `accepted`, `declined`, `expired`

### Modified Tables

All data tables now include a `budget_id` column:
- `budget_templates.budget_id`
- `budget_sheets.budget_id`
- `purchases.budget_id`
- `plaid_items.budget_id`

The `user_id` column is kept for tracking who created each item, but authorization now checks `budget_id` access.

### New Database Functions

- `user_has_budget_access(user_id, budget_id)` - Check if user can access budget
- `user_has_budget_role(user_id, budget_id, required_role)` - Check user's role
- `get_user_budget_ids(user_id)` - Get all budget IDs for a user
- `accept_budget_invitation(token, user_id)` - Accept an invitation
- `auto_accept_pending_invitations(user_id)` - Auto-accept invites on registration

## Migration Strategy

### For Existing Data

When running the migrations on an existing database:

1. A default budget is created for each existing user named "{FirstName}'s Budget"
2. The user is made the owner of their default budget
3. All their existing templates, sheets, purchases, and plaid items are linked to this budget

### For New Users

When a new user registers:
1. They are automatically checked for pending invitations
2. Any matching invitations are accepted automatically
3. They gain access to budgets they were invited to before registration

## API Changes

### New Endpoints

**Budget Management**
- `GET /api/budgets` - Get all budgets user has access to
- `POST /api/budgets` - Create a new budget
- `PATCH /api/budgets/:budgetId` - Update budget name (owner only)

**Members Management**
- `GET /api/budgets/:budgetId/members` - List budget members
- `PATCH /api/budgets/:budgetId/members/:userId/role` - Update member role (owner only)
- `DELETE /api/budgets/:budgetId/members/:userId` - Remove member or leave budget

**Invitations**
- `POST /api/budgets/:budgetId/invitations` - Invite user by email
- `GET /api/budgets/:budgetId/invitations` - List sent invitations for budget
- `DELETE /api/budgets/:budgetId/invitations/:invitationId` - Cancel invitation
- `GET /api/budgets/invitations/received` - Get invitations for current user
- `POST /api/budgets/invitations/:token/accept` - Accept invitation
- `POST /api/budgets/invitations/:token/decline` - Decline invitation

### Modified Endpoints

All existing endpoints for templates, sheets, purchases, and plaid items now:
1. Filter by budgets the user has access to (instead of just `user_id`)
2. Respect role-based permissions where applicable
3. When creating new items, they must specify which budget to add them to

## Role-Based Permissions

### Owner
- Full access to all budget data
- Can invite/remove members
- Can change member roles
- Can update budget settings
- Can delete the budget

### Editor
- Can view all budget data
- Can create/edit/delete templates, sheets, purchases
- Can invite members (but not remove or change roles)
- Cannot delete the budget or change settings

### Viewer
- Can view all budget data
- Cannot create, edit, or delete anything
- Cannot invite members

## Code Changes Required

### Route Files to Update

1. **templates.js** - Update all queries to use `budget_id` instead of `user_id`
   - Change `WHERE user_id = $1` to `WHERE budget_id IN (SELECT budget_id FROM budget_users WHERE user_id = $1)`
   - Add budget_id parameter to CREATE operations
   - Use role checking for editor-only operations

2. **sheets.js** - Similar changes as templates
   - Filter by budget access
   - Add budget_id to new sheets
   - Respect role permissions

3. **purchases.js** - Similar changes
   - Filter by budget access
   - Add budget_id to new purchases

4. **plaid.js** - Similar changes
   - Filter by budget access
   - Link plaid items to budgets

5. **users.js** - Already updated
   - Auto-accept pending invitations on registration

## Migration Steps

### 1. Backup Database
```bash
pg_dump budget > backup_before_sharing.sql
```

### 2. Run Migrations
```bash
psql -d budget -f database/013_create_budgets.sql
psql -d budget -f database/014_create_budget_sharing.sql
psql -d budget -f database/015_add_budget_id_to_tables.sql
psql -d budget -f database/016_create_budget_helper_functions.sql
```

Or run all migrations:
```bash
psql -d budget -f database/000_run_all.sql
```

### 3. Update API Code
- Deploy updated API with new routes and modified queries

### 4. Update Frontend
- Add budget selector UI
- Add budget sharing/invitation UI
- Update existing forms to include budget context

## Testing Checklist

- [ ] Existing users can see their default budget
- [ ] Existing data is accessible under default budget
- [ ] Users can create new budgets
- [ ] Users can invite others to budgets
- [ ] Invited users receive and can accept invitations
- [ ] Pending invitations work for unregistered users
- [ ] Role permissions are enforced correctly
- [ ] Users can only see data for budgets they have access to
- [ ] Budget members can collaborate on shared budgets
- [ ] Users can leave budgets (except last owner)

## Rollback Plan

If issues arise:
1. Restore from backup: `psql -d budget < backup_before_sharing.sql`
2. Or manually drop new tables and columns:
   ```sql
   ALTER TABLE budget_templates DROP COLUMN budget_id;
   ALTER TABLE budget_sheets DROP COLUMN budget_id;
   ALTER TABLE purchases DROP COLUMN budget_id;
   ALTER TABLE plaid_items DROP COLUMN budget_id;
   DROP TABLE budget_invitations;
   DROP TABLE budget_users;
   DROP TABLE budgets;
   ```
