export async function budgetsRoutes(fastify) {
  // Get all budgets the user has access to
  fastify.get('/', {
    preHandler: [async (request, reply) => fastify.authenticate(request, reply)]
  }, async (request, reply) => {
    try {
      const result = await fastify.pg.query(
        `SELECT
          b.id,
          b.name,
          b.created_by,
          b.created_at,
          b.updated_at,
          bu.role,
          bu.joined_at,
          CASE WHEN b.created_by = bu.user_id THEN true ELSE false END as is_owner
        FROM budgets b
        JOIN budget_users bu ON bu.budget_id = b.id
        WHERE bu.user_id = $1
        ORDER BY bu.joined_at ASC`,
        [request.user.userId]
      );

      return reply.send({
        budgets: result.rows.map(row => ({
          id: row.id,
          name: row.name,
          createdBy: row.created_by,
          role: row.role,
          isOwner: row.is_owner,
          joinedAt: row.joined_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at
        }))
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch budgets'
      });
    }
  });

  // Create a new budget
  fastify.post('/', {
    preHandler: [async (request, reply) => fastify.authenticate(request, reply)],
    schema: {
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 }
        }
      }
    }
  }, async (request, reply) => {
    const { name } = request.body;

    try {
      // Start transaction
      const client = await fastify.pg.connect();

      try {
        await client.query('BEGIN');

        // Create budget
        const budgetResult = await client.query(
          `INSERT INTO budgets (name, created_by)
           VALUES ($1, $2)
           RETURNING id, name, created_by, created_at, updated_at`,
          [name, request.user.userId]
        );

        const budget = budgetResult.rows[0];

        // Add creator as owner
        await client.query(
          `INSERT INTO budget_users (budget_id, user_id, role, invited_by)
           VALUES ($1, $2, 'owner', NULL)`,
          [budget.id, request.user.userId]
        );

        await client.query('COMMIT');

        return reply.status(201).send({
          id: budget.id,
          name: budget.name,
          createdBy: budget.created_by,
          role: 'owner',
          isOwner: true,
          createdAt: budget.created_at,
          updatedAt: budget.updated_at
        });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create budget'
      });
    }
  });

  // Update budget name
  fastify.patch('/:budgetId', {
    preHandler: [async (request, reply) => fastify.authenticate(request, reply)],
    schema: {
      params: {
        type: 'object',
        required: ['budgetId'],
        properties: {
          budgetId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 }
        }
      }
    }
  }, async (request, reply) => {
    const { budgetId } = request.params;
    const { name } = request.body;

    try {
      // Check if user has owner role
      const accessCheck = await fastify.pg.query(
        `SELECT role FROM budget_users
         WHERE budget_id = $1 AND user_id = $2`,
        [budgetId, request.user.userId]
      );

      if (accessCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Budget not found'
        });
      }

      if (accessCheck.rows[0].role !== 'owner') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Only budget owners can update the budget name'
        });
      }

      // Update budget
      const result = await fastify.pg.query(
        `UPDATE budgets
         SET name = $1, updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
         RETURNING id, name, created_by, created_at, updated_at`,
        [name, budgetId]
      );

      const budget = result.rows[0];

      return reply.send({
        id: budget.id,
        name: budget.name,
        createdBy: budget.created_by,
        createdAt: budget.created_at,
        updatedAt: budget.updated_at
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update budget'
      });
    }
  });

  // Get budget members
  fastify.get('/:budgetId/members', {
    preHandler: [async (request, reply) => fastify.authenticate(request, reply)],
    schema: {
      params: {
        type: 'object',
        required: ['budgetId'],
        properties: {
          budgetId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { budgetId } = request.params;

    try {
      // Verify user has access to this budget
      const accessCheck = await fastify.pg.query(
        `SELECT 1 FROM budget_users WHERE budget_id = $1 AND user_id = $2`,
        [budgetId, request.user.userId]
      );

      if (accessCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Budget not found'
        });
      }

      // Get all members
      const result = await fastify.pg.query(
        `SELECT
          bu.user_id,
          bu.role,
          bu.joined_at,
          bu.invited_by,
          u.email,
          u.first_name,
          u.last_name,
          inviter.email as invited_by_email,
          inviter.first_name as invited_by_first_name,
          inviter.last_name as invited_by_last_name
        FROM budget_users bu
        JOIN users u ON u.id = bu.user_id
        LEFT JOIN users inviter ON inviter.id = bu.invited_by
        WHERE bu.budget_id = $1
        ORDER BY
          CASE bu.role
            WHEN 'owner' THEN 1
            WHEN 'editor' THEN 2
            WHEN 'viewer' THEN 3
          END,
          bu.joined_at ASC`,
        [budgetId]
      );

      return reply.send({
        members: result.rows.map(row => ({
          userId: row.user_id,
          email: row.email,
          firstName: row.first_name,
          lastName: row.last_name,
          role: row.role,
          joinedAt: row.joined_at,
          invitedBy: row.invited_by ? {
            userId: row.invited_by,
            email: row.invited_by_email,
            firstName: row.invited_by_first_name,
            lastName: row.invited_by_last_name
          } : null
        }))
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch budget members'
      });
    }
  });

  // Update member role
  fastify.patch('/:budgetId/members/:userId/role', {
    preHandler: [async (request, reply) => fastify.authenticate(request, reply)],
    schema: {
      params: {
        type: 'object',
        required: ['budgetId', 'userId'],
        properties: {
          budgetId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['role'],
        properties: {
          role: { type: 'string', enum: ['owner', 'editor', 'viewer'] }
        }
      }
    }
  }, async (request, reply) => {
    const { budgetId, userId } = request.params;
    const { role } = request.body;

    try {
      // Check if current user is owner
      const accessCheck = await fastify.pg.query(
        `SELECT role FROM budget_users
         WHERE budget_id = $1 AND user_id = $2`,
        [budgetId, request.user.userId]
      );

      if (accessCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Budget not found'
        });
      }

      if (accessCheck.rows[0].role !== 'owner') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Only budget owners can update member roles'
        });
      }

      // Check if target user is a member
      const memberCheck = await fastify.pg.query(
        `SELECT role FROM budget_users
         WHERE budget_id = $1 AND user_id = $2`,
        [budgetId, userId]
      );

      if (memberCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User is not a member of this budget'
        });
      }

      // Don't allow changing your own role if you're the only owner
      if (userId === request.user.userId && role !== 'owner') {
        const ownerCount = await fastify.pg.query(
          `SELECT COUNT(*) as count FROM budget_users
           WHERE budget_id = $1 AND role = 'owner'`,
          [budgetId]
        );

        if (parseInt(ownerCount.rows[0].count) <= 1) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Cannot remove owner role when you are the only owner'
          });
        }
      }

      // Update role
      const result = await fastify.pg.query(
        `UPDATE budget_users
         SET role = $1
         WHERE budget_id = $2 AND user_id = $3
         RETURNING user_id, role, joined_at`,
        [role, budgetId, userId]
      );

      return reply.send({
        userId: result.rows[0].user_id,
        role: result.rows[0].role,
        joinedAt: result.rows[0].joined_at
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update member role'
      });
    }
  });

  // Remove member from budget
  fastify.delete('/:budgetId/members/:userId', {
    preHandler: [async (request, reply) => fastify.authenticate(request, reply)],
    schema: {
      params: {
        type: 'object',
        required: ['budgetId', 'userId'],
        properties: {
          budgetId: { type: 'string', format: 'uuid' },
          userId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { budgetId, userId } = request.params;

    try {
      // Check if current user is owner or removing themselves
      const accessCheck = await fastify.pg.query(
        `SELECT role FROM budget_users
         WHERE budget_id = $1 AND user_id = $2`,
        [budgetId, request.user.userId]
      );

      if (accessCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Budget not found'
        });
      }

      const isOwner = accessCheck.rows[0].role === 'owner';
      const isSelf = userId === request.user.userId;

      if (!isOwner && !isSelf) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Only budget owners can remove other members'
        });
      }

      // Don't allow removing yourself if you're the only owner
      if (isSelf && isOwner) {
        const ownerCount = await fastify.pg.query(
          `SELECT COUNT(*) as count FROM budget_users
           WHERE budget_id = $1 AND role = 'owner'`,
          [budgetId]
        );

        if (parseInt(ownerCount.rows[0].count) <= 1) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Cannot leave budget when you are the only owner'
          });
        }
      }

      // Remove member
      await fastify.pg.query(
        `DELETE FROM budget_users
         WHERE budget_id = $1 AND user_id = $2`,
        [budgetId, userId]
      );

      return reply.status(204).send();
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to remove member'
      });
    }
  });

  // Invite user to budget
  fastify.post('/:budgetId/invitations', {
    preHandler: [async (request, reply) => fastify.authenticate(request, reply)],
    schema: {
      params: {
        type: 'object',
        required: ['budgetId'],
        properties: {
          budgetId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', format: 'email' },
          role: { type: 'string', enum: ['editor', 'viewer'], default: 'editor' }
        }
      }
    }
  }, async (request, reply) => {
    const { budgetId } = request.params;
    const { email, role = 'editor' } = request.body;

    try {
      // Check if current user has owner or editor role
      const accessCheck = await fastify.pg.query(
        `SELECT role FROM budget_users
         WHERE budget_id = $1 AND user_id = $2`,
        [budgetId, request.user.userId]
      );

      if (accessCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Budget not found'
        });
      }

      if (accessCheck.rows[0].role === 'viewer') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Viewers cannot invite other users'
        });
      }

      // Check if user with this email already has access
      const existingMember = await fastify.pg.query(
        `SELECT bu.user_id
         FROM budget_users bu
         JOIN users u ON u.id = bu.user_id
         WHERE bu.budget_id = $1 AND LOWER(u.email) = LOWER($2)`,
        [budgetId, email]
      );

      if (existingMember.rows.length > 0) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'User already has access to this budget'
        });
      }

      // Check if there's already a pending invitation
      const existingInvitation = await fastify.pg.query(
        `SELECT id FROM budget_invitations
         WHERE budget_id = $1
         AND LOWER(email) = LOWER($2)
         AND status = 'pending'
         AND expires_at > CURRENT_TIMESTAMP`,
        [budgetId, email]
      );

      if (existingInvitation.rows.length > 0) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'An invitation has already been sent to this email'
        });
      }

      // Create invitation
      const result = await fastify.pg.query(
        `INSERT INTO budget_invitations (budget_id, email, role, invited_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, budget_id, email, role, invited_by, token, status, created_at, expires_at`,
        [budgetId, email.toLowerCase(), role, request.user.userId]
      );

      const invitation = result.rows[0];

      // TODO: Send invitation email with token
      // For now, we'll just return the invitation details

      return reply.status(201).send({
        id: invitation.id,
        budgetId: invitation.budget_id,
        email: invitation.email,
        role: invitation.role,
        invitedBy: invitation.invited_by,
        token: invitation.token,
        status: invitation.status,
        createdAt: invitation.created_at,
        expiresAt: invitation.expires_at
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create invitation'
      });
    }
  });

  // Get sent invitations for a budget
  fastify.get('/:budgetId/invitations', {
    preHandler: [async (request, reply) => fastify.authenticate(request, reply)],
    schema: {
      params: {
        type: 'object',
        required: ['budgetId'],
        properties: {
          budgetId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { budgetId } = request.params;

    try {
      // Verify user has access to this budget
      const accessCheck = await fastify.pg.query(
        `SELECT 1 FROM budget_users WHERE budget_id = $1 AND user_id = $2`,
        [budgetId, request.user.userId]
      );

      if (accessCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Budget not found'
        });
      }

      const result = await fastify.pg.query(
        `SELECT
          bi.id,
          bi.budget_id,
          bi.email,
          bi.role,
          bi.invited_by,
          bi.token,
          bi.status,
          bi.created_at,
          bi.expires_at,
          bi.responded_at,
          u.email as invited_by_email,
          u.first_name as invited_by_first_name,
          u.last_name as invited_by_last_name
        FROM budget_invitations bi
        JOIN users u ON u.id = bi.invited_by
        WHERE bi.budget_id = $1
        ORDER BY bi.created_at DESC`,
        [budgetId]
      );

      return reply.send({
        invitations: result.rows.map(row => ({
          id: row.id,
          budgetId: row.budget_id,
          email: row.email,
          role: row.role,
          token: row.token,
          status: row.status,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          respondedAt: row.responded_at,
          invitedBy: {
            userId: row.invited_by,
            email: row.invited_by_email,
            firstName: row.invited_by_first_name,
            lastName: row.invited_by_last_name
          }
        }))
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch invitations'
      });
    }
  });

  // Cancel/revoke an invitation
  fastify.delete('/:budgetId/invitations/:invitationId', {
    preHandler: [async (request, reply) => fastify.authenticate(request, reply)],
    schema: {
      params: {
        type: 'object',
        required: ['budgetId', 'invitationId'],
        properties: {
          budgetId: { type: 'string', format: 'uuid' },
          invitationId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { budgetId, invitationId } = request.params;

    try {
      // Check if current user has owner or editor role
      const accessCheck = await fastify.pg.query(
        `SELECT role FROM budget_users
         WHERE budget_id = $1 AND user_id = $2`,
        [budgetId, request.user.userId]
      );

      if (accessCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Budget not found'
        });
      }

      if (accessCheck.rows[0].role === 'viewer') {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Viewers cannot cancel invitations'
        });
      }

      // Delete invitation
      const result = await fastify.pg.query(
        `DELETE FROM budget_invitations
         WHERE id = $1 AND budget_id = $2 AND status = 'pending'
         RETURNING id`,
        [invitationId, budgetId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Invitation not found or already responded to'
        });
      }

      return reply.status(204).send();
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to cancel invitation'
      });
    }
  });

  // Get invitations received by current user
  fastify.get('/invitations/received', {
    preHandler: [async (request, reply) => fastify.authenticate(request, reply)]
  }, async (request, reply) => {
    try {
      // Get user email
      const userResult = await fastify.pg.query(
        `SELECT email FROM users WHERE id = $1`,
        [request.user.userId]
      );

      if (userResult.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      const userEmail = userResult.rows[0].email;

      // Get pending invitations for this email
      const result = await fastify.pg.query(
        `SELECT
          bi.id,
          bi.budget_id,
          bi.email,
          bi.role,
          bi.token,
          bi.status,
          bi.created_at,
          bi.expires_at,
          b.name as budget_name,
          u.email as invited_by_email,
          u.first_name as invited_by_first_name,
          u.last_name as invited_by_last_name
        FROM budget_invitations bi
        JOIN budgets b ON b.id = bi.budget_id
        JOIN users u ON u.id = bi.invited_by
        WHERE LOWER(bi.email) = LOWER($1)
        AND bi.status = 'pending'
        AND bi.expires_at > CURRENT_TIMESTAMP
        ORDER BY bi.created_at DESC`,
        [userEmail]
      );

      return reply.send({
        invitations: result.rows.map(row => ({
          id: row.id,
          budgetId: row.budget_id,
          budgetName: row.budget_name,
          email: row.email,
          role: row.role,
          token: row.token,
          status: row.status,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          invitedBy: {
            email: row.invited_by_email,
            firstName: row.invited_by_first_name,
            lastName: row.invited_by_last_name
          }
        }))
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch received invitations'
      });
    }
  });

  // Accept invitation
  fastify.post('/invitations/:token/accept', {
    preHandler: [async (request, reply) => fastify.authenticate(request, reply)],
    schema: {
      params: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { token } = request.params;

    try {
      const result = await fastify.pg.query(
        `SELECT * FROM accept_budget_invitation($1, $2)`,
        [token, request.user.userId]
      );

      if (result.rows.length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Failed to accept invitation'
        });
      }

      const budget = result.rows[0];

      return reply.send({
        budgetId: budget.budget_id,
        budgetName: budget.budget_name,
        role: budget.role,
        message: 'Invitation accepted successfully'
      });
    } catch (err) {
      // Check for specific error messages from the function
      if (err.message.includes('Invalid or expired')) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Invalid or expired invitation token'
        });
      }
      if (err.message.includes('different email')) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'This invitation was sent to a different email address'
        });
      }
      if (err.message.includes('already a member')) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'You are already a member of this budget'
        });
      }

      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to accept invitation'
      });
    }
  });

  // Decline invitation
  fastify.post('/invitations/:token/decline', {
    preHandler: [async (request, reply) => fastify.authenticate(request, reply)],
    schema: {
      params: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { token } = request.params;

    try {
      // Get user email
      const userResult = await fastify.pg.query(
        `SELECT email FROM users WHERE id = $1`,
        [request.user.userId]
      );

      const userEmail = userResult.rows[0].email;

      // Find and update invitation
      const result = await fastify.pg.query(
        `UPDATE budget_invitations
         SET status = 'declined', responded_at = CURRENT_TIMESTAMP
         WHERE token = $1
         AND LOWER(email) = LOWER($2)
         AND status = 'pending'
         AND expires_at > CURRENT_TIMESTAMP
         RETURNING id, budget_id`,
        [token, userEmail]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Invalid or expired invitation token'
        });
      }

      return reply.send({
        message: 'Invitation declined'
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to decline invitation'
      });
    }
  });
}
