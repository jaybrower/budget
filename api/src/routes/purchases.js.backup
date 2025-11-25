export async function purchasesRoutes(fastify) {
  // Apply authentication to all routes in this module
  const authenticate = async (request, reply) => fastify.authenticate(request, reply);

  // Create a new purchase
  fastify.post('/', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['amount', 'purchaseDate'],
        properties: {
          amount: { type: 'number' },
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
      description,
      paymentMethod,
      merchant,
      referenceNumber,
      purchaseDate,
      lineItemId
    } = request.body;

    try {
      // If lineItemId is provided, verify it belongs to the user
      if (lineItemId) {
        const lineItemCheck = await fastify.pg.query(
          `SELECT sli.id
           FROM sheet_line_items sli
           JOIN sheet_groups sg ON sg.id = sli.group_id
           JOIN budget_sheets bs ON bs.id = sg.sheet_id
           WHERE sli.id = $1 AND bs.user_id = $2`,
          [lineItemId, userId]
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
          user_id, line_item_id, amount, description, payment_method,
          merchant, reference_number, purchase_date
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING id, line_item_id, amount, description, payment_method, merchant,
                  reference_number, purchase_date, created_at, updated_at`,
        [userId, lineItemId || null, amount, description || null, paymentMethod || null,
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

  // Get all unassociated purchases for the current user
  fastify.get('/unassociated', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const userId = request.user.userId;

    try {
      const result = await fastify.pg.query(
        `SELECT
          id, amount, description, payment_method, merchant,
          reference_number, purchase_date, created_at, updated_at
         FROM purchases
         WHERE user_id = $1 AND line_item_id IS NULL
         ORDER BY purchase_date DESC, created_at DESC`,
        [userId]
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
      // Verify the line item belongs to the user
      const lineItemCheck = await fastify.pg.query(
        `SELECT sli.id
         FROM sheet_line_items sli
         JOIN sheet_groups sg ON sg.id = sli.group_id
         JOIN budget_sheets bs ON bs.id = sg.sheet_id
         WHERE sli.id = $1 AND bs.user_id = $2`,
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
      // Verify the purchase belongs to the user
      const purchaseCheck = await fastify.pg.query(
        `SELECT id FROM purchases WHERE id = $1 AND user_id = $2`,
        [purchaseId, userId]
      );

      if (purchaseCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Purchase not found'
        });
      }

      // Verify the line item belongs to the user
      const lineItemCheck = await fastify.pg.query(
        `SELECT sli.id
         FROM sheet_line_items sli
         JOIN sheet_groups sg ON sg.id = sli.group_id
         JOIN budget_sheets bs ON bs.id = sg.sheet_id
         WHERE sli.id = $1 AND bs.user_id = $2`,
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
      // Verify the purchase belongs to the user
      const purchaseCheck = await fastify.pg.query(
        `SELECT id FROM purchases WHERE id = $1 AND user_id = $2`,
        [purchaseId, userId]
      );

      if (purchaseCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Purchase not found'
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
