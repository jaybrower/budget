export async function purchasesRoutes(fastify) {
  // Apply authentication to all routes in this module
  const authenticate = async (request, reply) => fastify.authenticate(request, reply);

  // Create a new purchase
  fastify.post('/', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['amount', 'purchaseDate', 'budgetId'],
        properties: {
          amount: { type: 'number' },
          budgetId: { type: 'string', format: 'uuid' },
          description: { type: 'string' },
          paymentMethod: { type: 'string' },
          merchant: { type: 'string' },
          referenceNumber: { type: 'string' },
          purchaseDate: { type: 'string', format: 'date' },
          lineItemId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const userId = request.user.userId;
    const {
      amount,
      budgetId,
      description,
      paymentMethod,
      merchant,
      referenceNumber,
      purchaseDate,
      lineItemId
    } = request.body;

    try {
      // Verify user has access to budget and editor/owner role
      const budgetCheck = await fastify.pg.query(
        `SELECT role FROM budget_users WHERE budget_id = $1 AND user_id = $2`,
        [budgetId, userId]
      );

      if (budgetCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Budget not found'
        });
      }

      if (budgetCheck.rows[0].role === 'viewer') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Viewers cannot create purchases'
        });
      }

      // If lineItemId is provided, verify it belongs to the same budget
      if (lineItemId) {
        const lineItemCheck = await fastify.pg.query(
          `SELECT sli.id
           FROM sheet_line_items sli
           JOIN sheet_groups sg ON sg.id = sli.group_id
           JOIN budget_sheets bs ON bs.id = sg.sheet_id
           WHERE sli.id = $1 AND bs.budget_id = $2`,
          [lineItemId, budgetId]
        );

        if (lineItemCheck.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Line item not found'
          });
        }
      }

      // Insert the new purchase
      const result = await fastify.pg.query(
        `INSERT INTO purchases (
          user_id, budget_id, line_item_id, amount, description, payment_method,
          merchant, reference_number, purchase_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id, line_item_id, amount, description, payment_method, merchant,
                  reference_number, purchase_date, created_at, updated_at`,
        [userId, budgetId, lineItemId || null, amount, description || null, paymentMethod || null,
         merchant || null, referenceNumber || null, purchaseDate]
      );

      const purchase = result.rows[0];
      return reply.status(201).send({
        id: purchase.id,
        lineItemId: purchase.line_item_id,
        amount: purchase.amount,
        description: purchase.description,
        paymentMethod: purchase.payment_method,
        merchant: purchase.merchant,
        referenceNumber: purchase.reference_number,
        purchaseDate: purchase.purchase_date,
        createdAt: purchase.created_at,
        updatedAt: purchase.updated_at
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create purchase'
      });
    }
  });

  // Get all unassociated purchases for budgets user has access to
  fastify.get('/unassociated', {
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

    try {
      // Verify user has access to the budget
      const budgetCheck = await fastify.pg.query(
        `SELECT role FROM budget_users WHERE budget_id = $1 AND user_id = $2`,
        [budgetId, userId]
      );

      if (budgetCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Budget not found'
        });
      }

      const result = await fastify.pg.query(
        `SELECT
          p.id, p.amount, p.description, p.payment_method, p.merchant,
          p.reference_number, p.purchase_date, p.created_at, p.updated_at
         FROM purchases p
         WHERE p.budget_id = $1 AND p.line_item_id IS NULL
         ORDER BY p.purchase_date DESC, p.created_at DESC`,
        [budgetId]
      );

      return reply.send(result.rows.map(purchase => ({
        id: purchase.id,
        amount: purchase.amount,
        description: purchase.description,
        paymentMethod: purchase.payment_method,
        merchant: purchase.merchant,
        referenceNumber: purchase.reference_number,
        purchaseDate: purchase.purchase_date,
        createdAt: purchase.created_at,
        updatedAt: purchase.updated_at
      })));
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch unassociated purchases'
      });
    }
  });

  // Get all purchases for a specific line item
  fastify.get('/line-item/:lineItemId', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['lineItemId'],
        properties: {
          lineItemId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { lineItemId } = request.params;
    const userId = request.user.userId;

    try {
      // Verify user has access to the line item
      const lineItemCheck = await fastify.pg.query(
        `SELECT sli.id
         FROM sheet_line_items sli
         JOIN sheet_groups sg ON sg.id = sli.group_id
         JOIN budget_sheets bs ON bs.id = sg.sheet_id
         JOIN budget_users bu ON bu.budget_id = bs.budget_id
         WHERE sli.id = $1 AND bu.user_id = $2`,
        [lineItemId, userId]
      );

      if (lineItemCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Line item not found'
        });
      }

      const result = await fastify.pg.query(
        `SELECT
          id, amount, description, payment_method, merchant,
          reference_number, purchase_date, created_at, updated_at
         FROM purchases
         WHERE line_item_id = $1
         ORDER BY purchase_date DESC, created_at DESC`,
        [lineItemId]
      );

      return reply.send(result.rows.map(purchase => ({
        id: purchase.id,
        amount: purchase.amount,
        description: purchase.description,
        paymentMethod: purchase.payment_method,
        merchant: purchase.merchant,
        referenceNumber: purchase.reference_number,
        purchaseDate: purchase.purchase_date,
        createdAt: purchase.created_at,
        updatedAt: purchase.updated_at
      })));
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch purchases for line item'
      });
    }
  });

  // Link a purchase to a line item
  fastify.patch('/:purchaseId/link', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['purchaseId'],
        properties: {
          purchaseId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['lineItemId'],
        properties: {
          lineItemId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { purchaseId } = request.params;
    const { lineItemId } = request.body;
    const userId = request.user.userId;

    try {
      // Verify user has access to purchase and editor/owner role
      const purchaseCheck = await fastify.pg.query(
        `SELECT p.id, bu.role
         FROM purchases p
         JOIN budget_users bu ON bu.budget_id = p.budget_id
         WHERE p.id = $1 AND bu.user_id = $2`,
        [purchaseId, userId]
      );

      if (purchaseCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Purchase not found'
        });
      }

      if (purchaseCheck.rows[0].role === 'viewer') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Viewers cannot modify purchases'
        });
      }

      // Verify user has access to the line item
      const lineItemCheck = await fastify.pg.query(
        `SELECT sli.id
         FROM sheet_line_items sli
         JOIN sheet_groups sg ON sg.id = sli.group_id
         JOIN budget_sheets bs ON bs.id = sg.sheet_id
         JOIN budget_users bu ON bu.budget_id = bs.budget_id
         WHERE sli.id = $1 AND bu.user_id = $2`,
        [lineItemId, userId]
      );

      if (lineItemCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Line item not found'
        });
      }

      // Update the purchase to link it to the line item
      const result = await fastify.pg.query(
        `UPDATE purchases
         SET line_item_id = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, line_item_id, amount, description, payment_method, merchant,
                   reference_number, purchase_date, created_at, updated_at`,
        [lineItemId, purchaseId]
      );

      const purchase = result.rows[0];
      return reply.send({
        id: purchase.id,
        lineItemId: purchase.line_item_id,
        amount: purchase.amount,
        description: purchase.description,
        paymentMethod: purchase.payment_method,
        merchant: purchase.merchant,
        referenceNumber: purchase.reference_number,
        purchaseDate: purchase.purchase_date,
        createdAt: purchase.created_at,
        updatedAt: purchase.updated_at
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to link purchase to line item'
      });
    }
  });

  // Unlink a purchase from a line item
  fastify.patch('/:purchaseId/unlink', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['purchaseId'],
        properties: {
          purchaseId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { purchaseId } = request.params;
    const userId = request.user.userId;

    try {
      // Verify user has access to purchase and editor/owner role
      const purchaseCheck = await fastify.pg.query(
        `SELECT p.id, bu.role
         FROM purchases p
         JOIN budget_users bu ON bu.budget_id = p.budget_id
         WHERE p.id = $1 AND bu.user_id = $2`,
        [purchaseId, userId]
      );

      if (purchaseCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Purchase not found'
        });
      }

      if (purchaseCheck.rows[0].role === 'viewer') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Viewers cannot modify purchases'
        });
      }

      // Update the purchase to unlink it from any line item
      const result = await fastify.pg.query(
        `UPDATE purchases
         SET line_item_id = NULL, updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
         RETURNING id, line_item_id, amount, description, payment_method, merchant,
                   reference_number, purchase_date, created_at, updated_at`,
        [purchaseId]
      );

      const purchase = result.rows[0];
      return reply.send({
        id: purchase.id,
        lineItemId: purchase.line_item_id,
        amount: purchase.amount,
        description: purchase.description,
        paymentMethod: purchase.payment_method,
        merchant: purchase.merchant,
        referenceNumber: purchase.reference_number,
        purchaseDate: purchase.purchase_date,
        createdAt: purchase.created_at,
        updatedAt: purchase.updated_at
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to unlink purchase from line item'
      });
    }
  });
}
