export async function templatesRoutes(fastify) {
  // Apply authentication to all routes in this module
  const authenticate = async (request, reply) => fastify.authenticate(request, reply);

  // Get current user's budget templates (or a specific one)
  fastify.get('/', {
    preHandler: [authenticate],
    schema: {
      querystring: {
        type: 'object',
        properties: {
          id: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { id } = request.query;
    const userId = request.user.userId;

    try {
      let result;

      if (id) {
        // Get specific template with groups and line items
        result = await fastify.pg.query(
          `SELECT id, name, description, base_income, is_default, created_at, updated_at
           FROM budget_templates
           WHERE id = $1 AND user_id = $2`,
          [id, userId]
        );

        if (result.rows.length === 0) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Template not found'
          });
        }

        const template = result.rows[0];

        // Get groups for this template
        const groupsResult = await fastify.pg.query(
          `SELECT id, name, description, sort_order, created_at, updated_at
           FROM template_groups
           WHERE template_id = $1
           ORDER BY sort_order`,
          [id]
        );

        // Get line items for each group
        const groups = await Promise.all(groupsResult.rows.map(async (group) => {
          const itemsResult = await fastify.pg.query(
            `SELECT id, name, description, budgeted_amount, is_rollover, sort_order, created_at, updated_at
             FROM template_line_items
             WHERE group_id = $1
             ORDER BY sort_order`,
            [group.id]
          );

          return {
            id: group.id,
            name: group.name,
            description: group.description,
            sortOrder: group.sort_order,
            createdAt: group.created_at,
            updatedAt: group.updated_at,
            lineItems: itemsResult.rows.map(item => ({
              id: item.id,
              name: item.name,
              description: item.description,
              budgetedAmount: item.budgeted_amount,
              isRollover: item.is_rollover,
              sortOrder: item.sort_order,
              createdAt: item.created_at,
              updatedAt: item.updated_at
            }))
          };
        }));

        return reply.send({
          id: template.id,
          name: template.name,
          description: template.description,
          baseIncome: template.base_income,
          isDefault: template.is_default,
          createdAt: template.created_at,
          updatedAt: template.updated_at,
          groups
        });
      } else {
        // Get all templates for user (without nested data)
        result = await fastify.pg.query(
          `SELECT id, name, description, base_income, is_default, created_at, updated_at
           FROM budget_templates
           WHERE user_id = $1
           ORDER BY is_default DESC, name`,
          [userId]
        );

        return reply.send(result.rows.map(template => ({
          id: template.id,
          name: template.name,
          description: template.description,
          baseIncome: template.base_income,
          isDefault: template.is_default,
          createdAt: template.created_at,
          updatedAt: template.updated_at
        })));
      }
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch templates'
      });
    }
  });

  // Get current user's default template
  fastify.get('/default', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const userId = request.user.userId;

    try {
      // Get the default template for this user
      const result = await fastify.pg.query(
        `SELECT id, name, description, base_income, is_default, created_at, updated_at
         FROM budget_templates
         WHERE user_id = $1 AND is_default = true`,
        [userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'No default template found'
        });
      }

      const template = result.rows[0];

      // Get groups for this template
      const groupsResult = await fastify.pg.query(
        `SELECT id, name, description, sort_order, created_at, updated_at
         FROM template_groups
         WHERE template_id = $1
         ORDER BY sort_order`,
        [template.id]
      );

      // Get line items for each group
      const groups = await Promise.all(groupsResult.rows.map(async (group) => {
        const itemsResult = await fastify.pg.query(
          `SELECT id, name, description, budgeted_amount, is_rollover, sort_order, created_at, updated_at
           FROM template_line_items
           WHERE group_id = $1
           ORDER BY sort_order`,
          [group.id]
        );

        return {
          id: group.id,
          name: group.name,
          description: group.description,
          sortOrder: group.sort_order,
          createdAt: group.created_at,
          updatedAt: group.updated_at,
          lineItems: itemsResult.rows.map(item => ({
            id: item.id,
            name: item.name,
            description: item.description,
            budgetedAmount: item.budgeted_amount,
            isRollover: item.is_rollover,
            sortOrder: item.sort_order,
            createdAt: item.created_at,
            updatedAt: item.updated_at
          }))
        };
      }));

      return reply.send({
        id: template.id,
        name: template.name,
        description: template.description,
        baseIncome: template.base_income,
        isDefault: template.is_default,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        groups
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch default template'
      });
    }
  });

  // Create new budget template
  fastify.post('/', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
          baseIncome: { type: 'number', minimum: 0 },
          isDefault: { type: 'boolean' }
        }
      }
    }
  }, async (request, reply) => {
    const { name, description, baseIncome, isDefault } = request.body;
    const userId = request.user.userId;

    try {
      // If setting as default, unset other defaults first
      if (isDefault) {
        await fastify.pg.query(
          `UPDATE budget_templates SET is_default = false WHERE user_id = $1`,
          [userId]
        );
      }

      const result = await fastify.pg.query(
        `INSERT INTO budget_templates (user_id, name, description, base_income, is_default)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, name, description, base_income, is_default, created_at, updated_at`,
        [userId, name, description || null, baseIncome || 0, isDefault || false]
      );

      const template = result.rows[0];

      return reply.status(201).send({
        id: template.id,
        name: template.name,
        description: template.description,
        baseIncome: template.base_income,
        isDefault: template.is_default,
        createdAt: template.created_at,
        updatedAt: template.updated_at
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create template'
      });
    }
  });

  // Add group to template
  fastify.post('/:templateId/groups', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['templateId'],
        properties: {
          templateId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
          sortOrder: { type: 'integer', minimum: 0 }
        }
      }
    }
  }, async (request, reply) => {
    const { templateId } = request.params;
    const { name, description, sortOrder } = request.body;
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

      // Get next sort order if not provided
      let finalSortOrder = sortOrder;
      if (finalSortOrder === undefined) {
        const maxOrder = await fastify.pg.query(
          `SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order
           FROM template_groups WHERE template_id = $1`,
          [templateId]
        );
        finalSortOrder = maxOrder.rows[0].next_order;
      }

      const result = await fastify.pg.query(
        `INSERT INTO template_groups (template_id, name, description, sort_order)
         VALUES ($1, $2, $3, $4)
         RETURNING id, name, description, sort_order, created_at, updated_at`,
        [templateId, name, description || null, finalSortOrder]
      );

      const group = result.rows[0];

      return reply.status(201).send({
        id: group.id,
        name: group.name,
        description: group.description,
        sortOrder: group.sort_order,
        createdAt: group.created_at,
        updatedAt: group.updated_at
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to add group'
      });
    }
  });

  // Add line item to group
  fastify.post('/:templateId/groups/:groupId/items', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['templateId', 'groupId'],
        properties: {
          templateId: { type: 'string', format: 'uuid' },
          groupId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
          budgetedAmount: { type: 'number', minimum: 0 },
          isRollover: { type: 'boolean' },
          sortOrder: { type: 'integer', minimum: 0 }
        }
      }
    }
  }, async (request, reply) => {
    const { templateId, groupId } = request.params;
    const { name, description, budgetedAmount, isRollover, sortOrder } = request.body;
    const userId = request.user.userId;

    try {
      // Verify template and group belong to user
      const groupCheck = await fastify.pg.query(
        `SELECT tg.id
         FROM template_groups tg
         JOIN budget_templates bt ON tg.template_id = bt.id
         WHERE tg.id = $1 AND tg.template_id = $2 AND bt.user_id = $3`,
        [groupId, templateId, userId]
      );

      if (groupCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Group not found'
        });
      }

      // Get next sort order if not provided
      let finalSortOrder = sortOrder;
      if (finalSortOrder === undefined) {
        const maxOrder = await fastify.pg.query(
          `SELECT COALESCE(MAX(sort_order), -1) + 1 as next_order
           FROM template_line_items WHERE group_id = $1`,
          [groupId]
        );
        finalSortOrder = maxOrder.rows[0].next_order;
      }

      const result = await fastify.pg.query(
        `INSERT INTO template_line_items (group_id, name, description, budgeted_amount, is_rollover, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, name, description, budgeted_amount, is_rollover, sort_order, created_at, updated_at`,
        [groupId, name, description || null, budgetedAmount || 0, isRollover || false, finalSortOrder]
      );

      const item = result.rows[0];

      return reply.status(201).send({
        id: item.id,
        name: item.name,
        description: item.description,
        budgetedAmount: item.budgeted_amount,
        isRollover: item.is_rollover,
        sortOrder: item.sort_order,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to add line item'
      });
    }
  });

  // Update line item in group
  fastify.put('/:templateId/groups/:groupId/items/:itemId', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['templateId', 'groupId', 'itemId'],
        properties: {
          templateId: { type: 'string', format: 'uuid' },
          groupId: { type: 'string', format: 'uuid' },
          itemId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          description: { type: 'string' },
          budgetedAmount: { type: 'number', minimum: 0 },
          isRollover: { type: 'boolean' },
          sortOrder: { type: 'integer', minimum: 0 }
        }
      }
    }
  }, async (request, reply) => {
    const { templateId, groupId, itemId } = request.params;
    const { name, description, budgetedAmount, isRollover, sortOrder } = request.body;
    const userId = request.user.userId;

    try {
      // Verify ownership of the item
      const itemCheck = await fastify.pg.query(
        `SELECT tli.id
         FROM template_line_items tli
         JOIN template_groups tg ON tli.group_id = tg.id
         JOIN budget_templates bt ON tg.template_id = bt.id
         WHERE tli.id = $1 AND tli.group_id = $2 AND tg.template_id = $3 AND bt.user_id = $4`,
        [itemId, groupId, templateId, userId]
      );

      if (itemCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Line item not found'
        });
      }

      // Build dynamic update query based on provided fields
      const updates = [];
      const values = [];
      let paramIndex = 1;

      if (name !== undefined) {
        updates.push(`name = $${paramIndex++}`);
        values.push(name);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramIndex++}`);
        values.push(description);
      }
      if (budgetedAmount !== undefined) {
        updates.push(`budgeted_amount = $${paramIndex++}`);
        values.push(budgetedAmount);
      }
      if (isRollover !== undefined) {
        updates.push(`is_rollover = $${paramIndex++}`);
        values.push(isRollover);
      }
      if (sortOrder !== undefined) {
        updates.push(`sort_order = $${paramIndex++}`);
        values.push(sortOrder);
      }

      if (updates.length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No fields to update'
        });
      }

      updates.push(`updated_at = NOW()`);
      values.push(itemId);

      const result = await fastify.pg.query(
        `UPDATE template_line_items
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING id, name, description, budgeted_amount, is_rollover, sort_order, created_at, updated_at`,
        values
      );

      const item = result.rows[0];

      return reply.send({
        id: item.id,
        name: item.name,
        description: item.description,
        budgetedAmount: item.budgeted_amount,
        isRollover: item.is_rollover,
        sortOrder: item.sort_order,
        createdAt: item.created_at,
        updatedAt: item.updated_at
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update line item'
      });
    }
  });

  // Remove line item from group
  fastify.delete('/:templateId/groups/:groupId/items/:itemId', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['templateId', 'groupId', 'itemId'],
        properties: {
          templateId: { type: 'string', format: 'uuid' },
          groupId: { type: 'string', format: 'uuid' },
          itemId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { templateId, groupId, itemId } = request.params;
    const userId = request.user.userId;

    try {
      // Verify ownership and delete in one query
      const result = await fastify.pg.query(
        `DELETE FROM template_line_items tli
         USING template_groups tg, budget_templates bt
         WHERE tli.id = $1
           AND tli.group_id = $2
           AND tg.id = tli.group_id
           AND tg.template_id = $3
           AND bt.id = tg.template_id
           AND bt.user_id = $4
         RETURNING tli.id`,
        [itemId, groupId, templateId, userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Line item not found'
        });
      }

      return reply.status(204).send();
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to remove line item'
      });
    }
  });

  // Remove group from template (also removes all line items in the group)
  fastify.delete('/:templateId/groups/:groupId', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['templateId', 'groupId'],
        properties: {
          templateId: { type: 'string', format: 'uuid' },
          groupId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { templateId, groupId } = request.params;
    const userId = request.user.userId;

    try {
      // Verify ownership and delete (CASCADE will handle line items)
      const result = await fastify.pg.query(
        `DELETE FROM template_groups tg
         USING budget_templates bt
         WHERE tg.id = $1
           AND tg.template_id = $2
           AND bt.id = tg.template_id
           AND bt.user_id = $3
         RETURNING tg.id`,
        [groupId, templateId, userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Group not found'
        });
      }

      return reply.status(204).send();
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to remove group'
      });
    }
  });

  // Delete template (also removes all groups and line items)
  fastify.delete('/:templateId', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['templateId'],
        properties: {
          templateId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { templateId } = request.params;
    const userId = request.user.userId;

    try {
      // Delete template (CASCADE will handle groups and line items)
      const result = await fastify.pg.query(
        `DELETE FROM budget_templates
         WHERE id = $1 AND user_id = $2
         RETURNING id`,
        [templateId, userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Template not found'
        });
      }

      return reply.status(204).send();
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to delete template'
      });
    }
  });
}
