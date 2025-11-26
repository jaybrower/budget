/**
 * Helper utilities for budget access control
 */

/**
 * Check if a user has access to a budget
 * @param {object} pg - Fastify postgres instance
 * @param {string} userId - User ID
 * @param {string} budgetId - Budget ID
 * @returns {Promise<boolean>} True if user has access
 */
export async function userHasBudgetAccess(pg, userId, budgetId) {
  const result = await pg.query(
    `SELECT user_has_budget_access($1, $2) as has_access`,
    [userId, budgetId]
  );
  return result.rows[0].has_access;
}

/**
 * Check if a user has a specific role or higher for a budget
 * @param {object} pg - Fastify postgres instance
 * @param {string} userId - User ID
 * @param {string} budgetId - Budget ID
 * @param {string} requiredRole - Required role (owner, editor, or viewer)
 * @returns {Promise<boolean>} True if user has the required role or higher
 */
export async function userHasBudgetRole(pg, userId, budgetId, requiredRole) {
  const result = await pg.query(
    `SELECT user_has_budget_role($1, $2, $3) as has_role`,
    [userId, budgetId, requiredRole]
  );
  return result.rows[0].has_role;
}

/**
 * Get all budget IDs a user has access to
 * @param {object} pg - Fastify postgres instance
 * @param {string} userId - User ID
 * @returns {Promise<string[]>} Array of budget IDs
 */
export async function getUserBudgetIds(pg, userId) {
  const result = await pg.query(
    `SELECT budget_id FROM get_user_budget_ids($1)`,
    [userId]
  );
  return result.rows.map(row => row.budget_id);
}

/**
 * Get the budget ID for a template, verifying user has access
 * @param {object} pg - Fastify postgres instance
 * @param {string} userId - User ID
 * @param {string} templateId - Template ID
 * @returns {Promise<string|null>} Budget ID if user has access, null otherwise
 */
export async function getTemplateBudgetId(pg, userId, templateId) {
  const result = await pg.query(
    `SELECT bt.budget_id
     FROM budget_templates bt
     JOIN budget_users bu ON bu.budget_id = bt.budget_id
     WHERE bt.id = $1 AND bu.user_id = $2`,
    [templateId, userId]
  );
  return result.rows.length > 0 ? result.rows[0].budget_id : null;
}

/**
 * Get the budget ID for a sheet, verifying user has access
 * @param {object} pg - Fastify postgres instance
 * @param {string} userId - User ID
 * @param {string} sheetId - Sheet ID
 * @returns {Promise<string|null>} Budget ID if user has access, null otherwise
 */
export async function getSheetBudgetId(pg, userId, sheetId) {
  const result = await pg.query(
    `SELECT bs.budget_id
     FROM budget_sheets bs
     JOIN budget_users bu ON bu.budget_id = bs.budget_id
     WHERE bs.id = $1 AND bu.user_id = $2`,
    [sheetId, userId]
  );
  return result.rows.length > 0 ? result.rows[0].budget_id : null;
}

/**
 * Get the budget ID for a purchase, verifying user has access
 * @param {object} pg - Fastify postgres instance
 * @param {string} userId - User ID
 * @param {string} purchaseId - Purchase ID
 * @returns {Promise<string|null>} Budget ID if user has access, null otherwise
 */
export async function getPurchaseBudgetId(pg, userId, purchaseId) {
  const result = await pg.query(
    `SELECT p.budget_id
     FROM purchases p
     JOIN budget_users bu ON bu.budget_id = p.budget_id
     WHERE p.id = $1 AND bu.user_id = $2`,
    [purchaseId, userId]
  );
  return result.rows.length > 0 ? result.rows[0].budget_id : null;
}

/**
 * Get the budget ID for a plaid item, verifying user has access
 * @param {object} pg - Fastify postgres instance
 * @param {string} userId - User ID
 * @param {string} plaidItemId - Plaid item ID
 * @returns {Promise<string|null>} Budget ID if user has access, null otherwise
 */
export async function getPlaidItemBudgetId(pg, userId, plaidItemId) {
  const result = await pg.query(
    `SELECT pi.budget_id
     FROM plaid_items pi
     JOIN budget_users bu ON bu.budget_id = pi.budget_id
     WHERE pi.id = $1 AND bu.user_id = $2`,
    [plaidItemId, userId]
  );
  return result.rows.length > 0 ? result.rows[0].budget_id : null;
}
