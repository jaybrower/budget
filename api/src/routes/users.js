import bcrypt from 'bcrypt';

const SALT_ROUNDS = 12;

export async function usersRoutes(fastify) {
  // Register new user
  fastify.post('/register', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 8 },
          firstName: { type: 'string' },
          lastName: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { email, password, firstName, lastName } = request.body;

    try {
      // Check if user already exists
      const existingUser = await fastify.pg.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Email already registered'
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user
      const result = await fastify.pg.query(
        `INSERT INTO users (email, password_hash, first_name, last_name)
         VALUES ($1, $2, $3, $4)
         RETURNING id, email, first_name, last_name, created_at`,
        [email.toLowerCase(), passwordHash, firstName || null, lastName || null]
      );

      const user = result.rows[0];

      // Generate JWT
      const token = fastify.jwt.sign({
        userId: user.id,
        email: user.email
      });

      return reply.status(201).send({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          createdAt: user.created_at
        },
        token
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create user'
      });
    }
  });

  // Login
  fastify.post('/login', {
    schema: {
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { email, password } = request.body;

    try {
      // Find user
      const result = await fastify.pg.query(
        `SELECT id, email, password_hash, first_name, last_name, is_active
         FROM users WHERE email = $1`,
        [email.toLowerCase()]
      );

      if (result.rows.length === 0) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid email or password'
        });
      }

      const user = result.rows[0];

      // Check if account is active
      if (!user.is_active) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Account is deactivated'
        });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password_hash);

      if (!validPassword) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid email or password'
        });
      }

      // Generate JWT
      const token = fastify.jwt.sign({
        userId: user.id,
        email: user.email
      });

      return reply.send({
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name
        },
        token
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Login failed'
      });
    }
  });

  // Get current user profile (protected route)
  fastify.get('/me', {
    preHandler: [async (request, reply) => fastify.authenticate(request, reply)]
  }, async (request, reply) => {
    try {
      const result = await fastify.pg.query(
        `SELECT id, email, first_name, last_name, is_active, created_at, updated_at
         FROM users WHERE id = $1`,
        [request.user.userId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'User not found'
        });
      }

      const user = result.rows[0];

      return reply.send({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isActive: user.is_active,
        createdAt: user.created_at,
        updatedAt: user.updated_at
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch user profile'
      });
    }
  });
}
