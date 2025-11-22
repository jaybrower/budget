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
      // Verify template belongs to user
      const templateCheck = await fastify.pg.query(
        `SELECT id FROM budget_templates WHERE id = $1 AND user_id = $2`,
        [templateId, userId]
      );

      if (templateCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Template not found'
        });
      }

      // Check if a sheet already exists for this user/year/month
      const existingCheck = await fastify.pg.query(
        `SELECT id FROM budget_sheets WHERE user_id = $1 AND year = $2 AND month = $3`,
        [userId, year, month]
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
    preHandler: [authenticate]
  }, async (request, reply) => {
    const userId = request.user.userId;
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1; // JavaScript months are 0-indexed

    try {
      const result = await fastify.pg.query(
        `SELECT id FROM budget_sheets WHERE user_id = $1 AND year = $2 AND month = $3`,
        [userId, year, month]
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
      }
    }
  }, async (request, reply) => {
    const { year, month } = request.params;
    const userId = request.user.userId;

    try {
      const result = await fastify.pg.query(
        `SELECT id FROM budget_sheets WHERE user_id = $1 AND year = $2 AND month = $3`,
        [userId, year, month]
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

  // List all budget sheets for user
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
         WHERE bs.user_id = $1
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
     WHERE bs.id = $1 AND bs.user_id = $2`,
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
