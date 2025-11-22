import fastifyPostgres from '@fastify/postgres';
import fp from 'fastify-plugin';
import { config } from '../config.js';

async function postgresPlugin(fastify) {
  await fastify.register(fastifyPostgres, {
    connectionString: config.database.connectionString
  });
}

export default fp(postgresPlugin);
