import Fastify from 'fastify';
import { config } from './config.js';
import postgresPlugin from './plugins/postgres.js';
import jwtPlugin from './plugins/jwt.js';
import { usersRoutes } from './routes/users.js';
import { templatesRoutes } from './routes/templates.js';
import { sheetsRoutes } from './routes/sheets.js';
import { purchasesRoutes } from './routes/purchases.js';

const fastify = Fastify({
  logger: true
});

// Register plugins
await fastify.register(postgresPlugin);
await fastify.register(jwtPlugin);

// Register routes
await fastify.register(usersRoutes, { prefix: '/api/users' });
await fastify.register(templatesRoutes, { prefix: '/api/templates' });
await fastify.register(sheetsRoutes, { prefix: '/api/sheets' });
await fastify.register(purchasesRoutes, { prefix: '/api/purchases' });

// Health check endpoint
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({ port: config.server.port, host: config.server.host });
    console.log(`Server running at http://${config.server.host}:${config.server.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
