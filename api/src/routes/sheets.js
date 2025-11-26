export async function sheetsRoutes(fastify) {
  // Apply authentication to all routes in this module
  const authenticate = async (request, reply) => fastify.authenticate(request, reply);

  // Create a budget sheet from a template
  fastify.post('/', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['templateId', 'year', 'month'],
        properties: {
          templateId: { type: 'string', format: 'uuid' },
          year: { type: 'integer', minimum: 2000, maximum: 2100 },
          month: { type: 'integer', minimum: 1, maximum: 12 },
          additionalIncome: { type: 'number', minimum: 0 },
          rolledOverIncome: { type: 'number', minimum: 0 },
          carryOverRollovers: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const { templateId, year, month, additionalIncome, rolledOverIncome, carryOverRollovers } = request.body;
    const userId = request.user.userId;

    try {
      // Verify user has access to template and get budget_id
      const templateCheck = await fastify.pg.query(
        `SELECT bt.id, bt.budget_id, bu.role
         FROM budget_templates bt
         JOIN budget_users bu ON bu.budget_id = bt.budget_id
         WHERE bt.id = $1 AND bu.user_id = $2`,
        [templateId, userId]
      );

      if (templateCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Template not found'
        });
      }

      if (templateCheck.rows[0].role === 'viewer') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Viewers cannot create budget sheets'
        });
      }

      const budgetId = templateCheck.rows[0].budget_id;

      // Check if a sheet already exists for this budget/year/month
      const existingCheck = await fastify.pg.query(
        `SELECT id FROM budget_sheets WHERE budget_id = $1 AND year = $2 AND month = $3`,
        [budgetId, year, month]
      );

      if (existingCheck.rows.length > 0) {
        return reply.status(409).send({
          error: 'Conflict',
          message: `A budget sheet already exists for ${year}/${month}`
        });
      }

      // Create the sheet from template using the database function
      const createResult = await fastify.pg.query(
        `SELECT create_sheet_from_template($1, $2, $3, $4, $5) as sheet_id`,
        [templateId, year, month, additionalIncome || 0, rolledOverIncome || 0]
      );

      const sheetId = createResult.rows[0].sheet_id;

      // Optionally carry over rollover amounts from previous month
      if (carryOverRollovers !== false) {
        await fastify.pg.query(
          `SELECT carry_over_rollover_amounts($1)`,
          [sheetId]
        );
      }

      // Fetch the created sheet with full details
      const sheet = await getSheetWithDetails(fastify, sheetId, userId);

      return reply.status(201).send(sheet);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create budget sheet'
      });
    }
  });

  // Get current month's budget sheet
  fastify.get('/current', {
    preHandler: [authenticate],
    schema: {
      querystring: {
        type: 'object',
        required: ['budgetId'],
        properties: {
          budgetId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const userId = request.user.userId;
    const { budgetId } = request.query;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // JavaScript months are 0-indexed

    try {
      // Verify user has access to budget
      const accessCheck = await fastify.pg.query(
        `SELECT 1 FROM budget_users WHERE budget_id = $1 AND user_id = $2`,
        [budgetId, userId]
      );

      if (accessCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Budget not found'
        });
      }

      const result = await fastify.pg.query(
        `SELECT id FROM budget_sheets WHERE budget_id = $1 AND year = $2 AND month = $3`,
        [budgetId, year, month]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `No budget sheet found for ${year}/${month}`
        });
      }

      const sheet = await getSheetWithDetails(fastify, result.rows[0].id, userId);
      return reply.send(sheet);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch current budget sheet'
      });
    }
  });

  // Get budget sheet by year and month
  fastify.get('/:year/:month', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['year', 'month'],
        properties: {
          year: { type: 'integer', minimum: 2000, maximum: 2100 },
          month: { type: 'integer', minimum: 1, maximum: 12 }
        }
      },
      querystring: {
        type: 'object',
        required: ['budgetId'],
        properties: {
          budgetId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { year, month } = request.params;
    const { budgetId } = request.query;
    const userId = request.user.userId;

    try {
      // Verify user has access to budget
      const accessCheck = await fastify.pg.query(
        `SELECT 1 FROM budget_users WHERE budget_id = $1 AND user_id = $2`,
        [budgetId, userId]
      );

      if (accessCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Budget not found'
        });
      }

      const result = await fastify.pg.query(
        `SELECT id FROM budget_sheets WHERE budget_id = $1 AND year = $2 AND month = $3`,
        [budgetId, year, month]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: `No budget sheet found for ${year}/${month}`
        });
      }

      const sheet = await getSheetWithDetails(fastify, result.rows[0].id, userId);
      return reply.send(sheet);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch budget sheet'
      });
    }
  });

  // Get budget sheet by ID
  fastify.get('/:sheetId', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['sheetId'],
        properties: {
          sheetId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { sheetId } = request.params;
    const userId = request.user.userId;

    try {
      const sheet = await getSheetWithDetails(fastify, sheetId, userId);

      if (!sheet) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Budget sheet not found'
        });
      }

      return reply.send(sheet);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch budget sheet'
      });
    }
  });

  // Update budget sheet
  fastify.patch('/:sheetId', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['sheetId'],
        properties: {
          sheetId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        properties: {
          additionalIncome: { type: 'number', minimum: 0 }
        }
      }
    }
  }, async (request, reply) => {
    const { sheetId } = request.params;
    const { additionalIncome } = request.body;
    const userId = request.user.userId;

    try {
      // Verify user has access and editor/owner role
      const sheetCheck = await fastify.pg.query(
        `SELECT bs.id, bs.is_finalized, bu.role
         FROM budget_sheets bs
         JOIN budget_users bu ON bu.budget_id = bs.budget_id
         WHERE bs.id = $1 AND bu.user_id = $2`,
        [sheetId, userId]
      );

      if (sheetCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Budget sheet not found'
        });
      }

      if (sheetCheck.rows[0].role === 'viewer') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Viewers cannot modify budget sheets'
        });
      }

      if (sheetCheck.rows[0].is_finalized) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Cannot update a finalized budget sheet'
        });
      }

      // Build update query dynamically based on provided fields
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (additionalIncome !== undefined) {
        updates.push(`additional_income = $${paramIndex}`);
        values.push(additionalIncome);
        paramIndex++;
      }

      if (updates.length === 0) {
        // No updates to make, just return the current sheet
        const sheet = await getSheetWithDetails(fastify, sheetId, userId);
        return reply.send(sheet);
      }

      // Add updated_at
      updates.push(`updated_at = NOW()`);

      // Add sheetId to values
      values.push(sheetId);

      await fastify.pg.query(
        `UPDATE budget_sheets SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
        values
      );

      // Fetch the updated sheet with full details
      const sheet = await getSheetWithDetails(fastify, sheetId, userId);
      return reply.send(sheet);
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update budget sheet'
      });
    }
  });

  // List all budget sheets for budgets user has access to
  fastify.get('/', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const userId = request.user.userId;

    try {
      const result = await fastify.pg.query(
        `SELECT
          bs.id, bs.name, bs.description, bs.year, bs.month,
          bs.base_income, bs.additional_income, bs.rolled_over_income,
          bs.is_finalized, bs.created_at, bs.updated_at,
          bst.total_budgeted, bst.total_actual, bst.budgeted_remaining, bst.actual_remaining
         FROM budget_sheets bs
         LEFT JOIN budget_sheet_totals bst ON bst.sheet_id = bs.id
         JOIN budget_users bu ON bu.budget_id = bs.budget_id
         WHERE bu.user_id = $1
         ORDER BY bs.year DESC, bs.month DESC`,
        [userId]
      );

      return reply.send(result.rows.map(sheet => ({
        id: sheet.id,
        name: sheet.name,
        description: sheet.description,
        year: sheet.year,
        month: sheet.month,
        baseIncome: sheet.base_income,
        additionalIncome: sheet.additional_income,
        rolledOverIncome: sheet.rolled_over_income,
        totalIncome: parseFloat(sheet.base_income) + parseFloat(sheet.additional_income) + parseFloat(sheet.rolled_over_income),
        totalBudgeted: sheet.total_budgeted,
        totalActual: sheet.total_actual,
        budgetedRemaining: sheet.budgeted_remaining,
        actualRemaining: sheet.actual_remaining,
        isFinalized: sheet.is_finalized,
        createdAt: sheet.created_at,
        updatedAt: sheet.updated_at
      })));
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch budget sheets'
      });
    }
  });

  // Check if budget sheet is in sync with its template
  fastify.get('/:sheetId/sync-status', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['sheetId'],
        properties: {
          sheetId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { sheetId } = request.params;
    const userId = request.user.userId;

    try {
      const result = await fastify.pg.query(
        `SELECT
          bs.id,
          bs.template_id,
          bs.synced_at as sheet_synced_at,
          bt.updated_at as template_updated_at,
          bs.synced_at >= bt.updated_at as is_synced
         FROM budget_sheets bs
         LEFT JOIN budget_templates bt ON bt.id = bs.template_id
         JOIN budget_users bu ON bu.budget_id = bs.budget_id
         WHERE bs.id = $1 AND bu.user_id = $2`,
        [sheetId, userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Budget sheet not found'
        });
      }

      const row = result.rows[0];

      if (!row.template_id) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Budget sheet has no associated template'
        });
      }

      return reply.send({
        sheetId: row.id,
        templateId: row.template_id,
        sheetSyncedAt: row.sheet_synced_at,
        templateUpdatedAt: row.template_updated_at,
        isSynced: row.is_synced
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to check sync status'
      });
    }
  });

  // Sync budget sheet with its template
  fastify.post('/:sheetId/sync', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['sheetId'],
        properties: {
          sheetId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        properties: {
          updateExisting: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const { sheetId } = request.params;
    const { updateExisting = false } = request.body || {};
    const userId = request.user.userId;

    try {
      // Verify user has access and editor/owner role
      const sheetCheck = await fastify.pg.query(
        `SELECT bs.id, bs.template_id, bs.is_finalized, bu.role
         FROM budget_sheets bs
         JOIN budget_users bu ON bu.budget_id = bs.budget_id
         WHERE bs.id = $1 AND bu.user_id = $2`,
        [sheetId, userId]
      );

      if (sheetCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Budget sheet not found'
        });
      }

      const sheet = sheetCheck.rows[0];

      if (sheet.role === 'viewer') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Viewers cannot sync budget sheets'
        });
      }

      if (!sheet.template_id) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Budget sheet has no associated template to sync with'
        });
      }

      if (sheet.is_finalized) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Cannot sync a finalized budget sheet'
        });
      }

      // Call the sync function
      const syncResult = await fastify.pg.query(
        `SELECT * FROM sync_sheet_with_template($1, $2)`,
        [sheetId, updateExisting]
      );

      const syncStats = syncResult.rows[0];

      // Update synced_at timestamp
      await fastify.pg.query(
        `UPDATE budget_sheets SET synced_at = NOW() WHERE id = $1`,
        [sheetId]
      );

      // Fetch the updated sheet with full details
      const updatedSheet = await getSheetWithDetails(fastify, sheetId, userId);

      return reply.send({
        sheet: updatedSheet,
        syncStats: {
          groupsAdded: syncStats.groups_added,
          itemsAdded: syncStats.items_added,
          groupsUpdated: syncStats.groups_updated,
          itemsUpdated: syncStats.items_updated
        }
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to sync budget sheet with template'
      });
    }
  });
}

// Helper function to get sheet with full details
async function getSheetWithDetails(fastify, sheetId, userId) {
  // Get sheet basic info with totals
  const sheetResult = await fastify.pg.query(
    `SELECT
      bs.id, bs.template_id, bs.name, bs.description, bs.year, bs.month,
      bs.base_income, bs.additional_income, bs.rolled_over_income,
      bs.is_finalized, bs.created_at, bs.updated_at,
      bst.total_income, bst.total_budgeted, bst.total_actual,
      bst.budgeted_remaining, bst.actual_remaining
     FROM budget_sheets bs
     LEFT JOIN budget_sheet_totals bst ON bst.sheet_id = bs.id
     JOIN budget_users bu ON bu.budget_id = bs.budget_id
     WHERE bs.id = $1 AND bu.user_id = $2`,
    [sheetId, userId]
  );

  if (sheetResult.rows.length === 0) {
    return null;
  }

  const sheet = sheetResult.rows[0];

  // Get groups for this sheet
  const groupsResult = await fastify.pg.query(
    `SELECT id, template_group_id, name, description, sort_order, created_at, updated_at
     FROM sheet_groups
     WHERE sheet_id = $1
     ORDER BY sort_order`,
    [sheetId]
  );

  // Get line items for each group
  const groups = await Promise.all(groupsResult.rows.map(async (group) => {
    const itemsResult = await fastify.pg.query(
      `SELECT id, template_line_item_id, name, description,
              budgeted_amount, actual_amount, is_rollover, rolled_over_amount,
              sort_order, created_at, updated_at
       FROM sheet_line_items
       WHERE group_id = $1
       ORDER BY sort_order`,
      [group.id]
    );

    // Calculate group totals
    const groupBudgeted = itemsResult.rows.reduce((sum, item) => sum + parseFloat(item.budgeted_amount), 0);
    const groupActual = itemsResult.rows.reduce((sum, item) => sum + parseFloat(item.actual_amount), 0);

    return {
      id: group.id,
      templateGroupId: group.template_group_id,
      name: group.name,
      description: group.description,
      sortOrder: group.sort_order,
      totalBudgeted: groupBudgeted,
      totalActual: groupActual,
      createdAt: group.created_at,
      updatedAt: group.updated_at,
      lineItems: itemsResult.rows.map(item => ({
        id: item.id,
        templateLineItemId: item.template_line_item_id,
        name: item.name,
        description: item.description,
        budgetedAmount: item.budgeted_amount,
        actualAmount: item.actual_amount,
        isRollover: item.is_rollover,
        rolledOverAmount: item.rolled_over_amount,
        availableBalance: item.is_rollover
          ? parseFloat(item.rolled_over_amount) + parseFloat(item.budgeted_amount) - parseFloat(item.actual_amount)
          : null,
        sortOrder: item.sort_order,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      }))
    };
  }));

  return {
    id: sheet.id,
    templateId: sheet.template_id,
    name: sheet.name,
    description: sheet.description,
    year: sheet.year,
    month: sheet.month,
    baseIncome: sheet.base_income,
    additionalIncome: sheet.additional_income,
    rolledOverIncome: sheet.rolled_over_income,
    totalIncome: sheet.total_income,
    totalBudgeted: sheet.total_budgeted,
    totalActual: sheet.total_actual,
    budgetedRemaining: sheet.budgeted_remaining,
    actualRemaining: sheet.actual_remaining,
    isFinalized: sheet.is_finalized,
    createdAt: sheet.created_at,
    updatedAt: sheet.updated_at,
    groups
  };
}
