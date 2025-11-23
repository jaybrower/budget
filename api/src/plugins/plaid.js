import { Configuration, PlaidApi, PlaidEnvironments } from 'plaid';
import fp from 'fastify-plugin';
import { config } from '../config.js';

async function plaidPlugin(fastify) {
  const configuration = new Configuration({
    basePath: PlaidEnvironments[config.plaid.env],
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': config.plaid.clientId,
        'PLAID-SECRET': config.plaid.secret,
      },
    },
  });

  const plaidClient = new PlaidApi(configuration);

  // Decorate fastify with plaid client and config
  fastify.decorate('plaid', plaidClient);
  fastify.decorate('plaidConfig', {
    products: config.plaid.products,
    countryCodes: config.plaid.countryCodes,
    env: config.plaid.env
  });
}

export default fp(plaidPlugin);
