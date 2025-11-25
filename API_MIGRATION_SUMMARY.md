# API Migration to Budget-Based Access Control

## Summary of Changes

This document tracks the migration of API routes from user-based to budget-based access control.

## Completed: templates.js

### Key Changes Made:

1. **GET / (list templates)**
   - Changed from: `WHERE user_id = $1`
   - Changed to: `JOIN budget_users ON budget_id WHERE user_id = $1`
   - Now returns templates from all budgets user has access to

2. **GET / (get specific template by id)**
   - Changed from: `WHERE id = $1 AND user_id = $2`
   - Changed to: `JOIN budget_users ON budget_id WHERE id = $1 AND user_id = $2`
   - Verifies user has access through budget membership

3. **GET /default**
   - Added required query parameter: `budgetId`
   - Added budget access verification
   - Changed from: Finding default template for user
   - Changed to: Finding default template for specific budget

4. **POST / (create template)**
   - Added required body parameter: `budgetId`
   - Added role-based permission check (only editor/owner can create)
   - Changed default template logic to be per-budget instead of per-user
   - Now saves template with `budget_id`

5. **POST /:templateId/groups (add group)**
   - Added role verification (only editor/owner can modify)
   - Changed verification query to include budget_users join

6. **PUT /:templateId/groups/:groupId (update group)**
   - Added role verification (only editor/owner can modify)
   - Changed verification query to include budget_users join

7. **POST /:templateId/groups/:groupId/items (add line item)**
   - Added role verification (only editor/owner can modify)
   - Changed verification query to include budget_users join

8. **PUT /:templateId/groups/:groupId/items/:itemId (update line item)**
   - Added role verification (only editor/owner can modify)
   - Changed verification query to include budget_users join

9. **DELETE /:templateId/groups/:groupId/items/:itemId (delete line item)**
   - Added role verification in DELETE query (only editor/owner)
   - Changed verification query to include budget_users join

10. **DELETE /:templateId/groups/:groupId (delete group)**
    - Added role verification in DELETE query (only editor/owner)
    - Changed verification query to include budget_users join

11. **DELETE /:templateId (delete template)**
    - Added role verification in DELETE query (only editor/owner)
    - Changed verification query to include budget_users join

### Permission Model:

- **Viewer**: Can only read templates, cannot create/edit/delete
- **Editor**: Can create, read, update, and delete templates
- **Owner**: Full access (same as editor for templates)

## TODO: sheets.js

Similar changes needed:
- Add `budgetId` parameter to POST requests
- Change all WHERE clauses from `user_id` to budget access checks
- Add role-based permissions for modify operations

## TODO: purchases.js

Similar changes needed:
- Add `budgetId` parameter to POST requests
- Change all WHERE clauses from `user_id` to budget access checks
- Add role-based permissions for modify operations

## TODO: plaid.js

Similar changes needed:
- Link plaid items to budgets
- Change all WHERE clauses from `user_id` to budget access checks
- Sync transactions to the correct budget

## Testing Checklist

After all routes are updated:

- [ ] Users can see templates from all budgets they have access to
- [ ] Viewers can read but not modify
- [ ] Editors can create/modify/delete
- [ ] Users cannot access budgets they don't belong to
- [ ] Proper 404 returned for non-existent budgets
- [ ] Proper 403 returned for insufficient permissions
- [ ] Default templates work per-budget
- [ ] Templates are properly isolated between different budgets
