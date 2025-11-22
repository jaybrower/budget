import fastifyJwt from '@fastify/jwt';
import fp from 'fastify-plugin';
import { config } from '../config.js';

async function jwtPlugin(fastify) {
  await fastify.register(fastifyJwt, {
    secret: config.jwt.secret,
    sign: {
      expiresIn: config.jwt.expiresIn
    }
  });

  // Decorator to verify JWT on protected routes
  fastify.decorate('authenticate', async function (request, reply) {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized', message: 'Invalid or missing token' });
    }
  });
}

export default fp(jwtPlugin);
