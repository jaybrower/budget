import crypto from 'crypto';
import { config } from '../config.js';

const ALGORITHM = 'aes-256-gcm';

function encrypt(text, encryptionKey) {
  const key = crypto.scryptSync(encryptionKey, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag();

  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
}

function decrypt(encryptedText, encryptionKey) {
  const [ivHex, authTagHex, encrypted] = encryptedText.split(':');
  const key = crypto.scryptSync(encryptionKey, 'salt', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export async function plaidRoutes(fastify) {
  const authenticate = async (request, reply) => fastify.authenticate(request, reply);
  const encryptionKey = process.env.ENCRYPTION_KEY;

  // Create link token for Plaid Link initialization
  fastify.post('/link-token', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const userId = request.user.userId;

    try {
      const response = await fastify.plaid.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: 'Budget App',
        products: fastify.plaidConfig.products,
        country_codes: fastify.plaidConfig.countryCodes,
        language: 'en',
      });

      return reply.send({ linkToken: response.data.link_token });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create link token'
      });
    }
  });

  // Exchange public token for access token after successful Plaid Link
  fastify.post('/exchange-token', {
    preHandler: [authenticate],
    schema: {
      body: {
        type: 'object',
        required: ['publicToken', 'metadata'],
        properties: {
          publicToken: { type: 'string' },
          metadata: { type: 'object' }
        }
      }
    }
  }, async (request, reply) => {
    const userId = request.user.userId;
    const { publicToken, metadata } = request.body;

    try {
      // Exchange public token for access token
      const exchangeResponse = await fastify.plaid.itemPublicTokenExchange({
        public_token: publicToken,
      });

      const accessToken = exchangeResponse.data.access_token;
      const itemId = exchangeResponse.data.item_id;

      // Encrypt access token for storage
      const encryptedAccessToken = encrypt(accessToken, encryptionKey);

      // Get institution info
      const institutionId = metadata.institution?.institution_id || null;
      const institutionName = metadata.institution?.name || null;

      // Insert plaid_item
      const itemResult = await fastify.pg.query(
        `INSERT INTO plaid_items (user_id, access_token, item_id, institution_id, institution_name)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id`,
        [userId, encryptedAccessToken, itemId, institutionId, institutionName]
      );

      const plaidItemId = itemResult.rows[0].id;

      // Get accounts from Plaid
      const accountsResponse = await fastify.plaid.accountsGet({
        access_token: accessToken,
      });

      // Insert accounts
      for (const account of accountsResponse.data.accounts) {
        await fastify.pg.query(
          `INSERT INTO plaid_accounts (plaid_item_id, account_id, name, official_name, type, subtype, mask)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            plaidItemId,
            account.account_id,
            account.name,
            account.official_name,
            account.type,
            account.subtype,
            account.mask
          ]
        );
      }

      return reply.status(201).send({
        message: 'Account linked successfully',
        itemId: plaidItemId,
        accountsLinked: accountsResponse.data.accounts.length
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to exchange token'
      });
    }
  });

  // Get all linked institutions for the user
  fastify.get('/items', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const userId = request.user.userId;

    try {
      const result = await fastify.pg.query(
        `SELECT
          pi.id, pi.institution_id, pi.institution_name, pi.last_synced_at, pi.is_active, pi.created_at,
          json_agg(
            json_build_object(
              'id', pa.id,
              'accountId', pa.account_id,
              'name', pa.name,
              'officialName', pa.official_name,
              'type', pa.type,
              'subtype', pa.subtype,
              'mask', pa.mask,
              'paymentMethod', pa.payment_method,
              'isActive', pa.is_active
            )
          ) FILTER (WHERE pa.id IS NOT NULL) as accounts
         FROM plaid_items pi
         LEFT JOIN plaid_accounts pa ON pa.plaid_item_id = pi.id
         WHERE pi.user_id = $1 AND pi.is_active = true
         GROUP BY pi.id
         ORDER BY pi.created_at DESC`,
        [userId]
      );

      return reply.send(result.rows.map(item => ({
        id: item.id,
        institutionId: item.institution_id,
        institutionName: item.institution_name,
        lastSyncedAt: item.last_synced_at,
        isActive: item.is_active,
        createdAt: item.created_at,
        accounts: item.accounts || []
      })));
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch linked items'
      });
    }
  });

  // Delete/unlink an institution
  fastify.delete('/items/:itemId', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['itemId'],
        properties: {
          itemId: { type: 'string', format: 'uuid' }
        }
      }
    }
  }, async (request, reply) => {
    const { itemId } = request.params;
    const userId = request.user.userId;

    try {
      // Verify item belongs to user and get access token
      const itemResult = await fastify.pg.query(
        `SELECT id, access_token FROM plaid_items WHERE id = $1 AND user_id = $2`,
        [itemId, userId]
      );

      if (itemResult.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Item not found'
        });
      }

      const encryptedAccessToken = itemResult.rows[0].access_token;
      const accessToken = decrypt(encryptedAccessToken, encryptionKey);

      // Remove item from Plaid
      try {
        await fastify.plaid.itemRemove({
          access_token: accessToken,
        });
      } catch (plaidErr) {
        // Log but continue - we still want to remove from our database
        request.log.warn('Failed to remove item from Plaid:', plaidErr);
      }

      // Soft delete by marking as inactive
      await fastify.pg.query(
        `UPDATE plaid_items SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [itemId]
      );

      await fastify.pg.query(
        `UPDATE plaid_accounts SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE plaid_item_id = $1`,
        [itemId]
      );

      return reply.send({ message: 'Item unlinked successfully' });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to unlink item'
      });
    }
  });

  // Get all linked accounts
  fastify.get('/accounts', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const userId = request.user.userId;

    try {
      const result = await fastify.pg.query(
        `SELECT
          pa.id, pa.account_id, pa.name, pa.official_name, pa.type, pa.subtype,
          pa.mask, pa.payment_method, pa.is_active,
          pi.institution_name
         FROM plaid_accounts pa
         JOIN plaid_items pi ON pi.id = pa.plaid_item_id
         WHERE pi.user_id = $1 AND pi.is_active = true AND pa.is_active = true
         ORDER BY pi.institution_name, pa.name`,
        [userId]
      );

      return reply.send(result.rows.map(account => ({
        id: account.id,
        accountId: account.account_id,
        name: account.name,
        officialName: account.official_name,
        type: account.type,
        subtype: account.subtype,
        mask: account.mask,
        paymentMethod: account.payment_method,
        isActive: account.is_active,
        institutionName: account.institution_name
      })));
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch accounts'
      });
    }
  });

  // Update account payment method mapping
  fastify.patch('/accounts/:accountId', {
    preHandler: [authenticate],
    schema: {
      params: {
        type: 'object',
        required: ['accountId'],
        properties: {
          accountId: { type: 'string', format: 'uuid' }
        }
      },
      body: {
        type: 'object',
        required: ['paymentMethod'],
        properties: {
          paymentMethod: { type: 'string' }
        }
      }
    }
  }, async (request, reply) => {
    const { accountId } = request.params;
    const { paymentMethod } = request.body;
    const userId = request.user.userId;

    try {
      // Verify account belongs to user
      const accountCheck = await fastify.pg.query(
        `SELECT pa.id
         FROM plaid_accounts pa
         JOIN plaid_items pi ON pi.id = pa.plaid_item_id
         WHERE pa.id = $1 AND pi.user_id = $2`,
        [accountId, userId]
      );

      if (accountCheck.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Account not found'
        });
      }

      await fastify.pg.query(
        `UPDATE plaid_accounts SET payment_method = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
        [paymentMethod, accountId]
      );

      return reply.send({ message: 'Account updated successfully' });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update account'
      });
    }
  });

  // Sync transactions from all linked accounts
  fastify.post('/sync', {
    preHandler: [authenticate]
  }, async (request, reply) => {
    const userId = request.user.userId;

    try {
      // Get all active items for user
      const itemsResult = await fastify.pg.query(
        `SELECT id, access_token, cursor FROM plaid_items WHERE user_id = $1 AND is_active = true`,
        [userId]
      );

      let totalAdded = 0;
      let totalModified = 0;
      let totalRemoved = 0;

      for (const item of itemsResult.rows) {
        const accessToken = decrypt(item.access_token, encryptionKey);
        let cursor = item.cursor;
        let hasMore = true;

        // Get accounts for this item
        const accountsResult = await fastify.pg.query(
          `SELECT id, account_id, payment_method FROM plaid_accounts WHERE plaid_item_id = $1 AND is_active = true`,
          [item.id]
        );

        const accountMap = {};
        for (const acc of accountsResult.rows) {
          accountMap[acc.account_id] = { id: acc.id, paymentMethod: acc.payment_method };
        }

        while (hasMore) {
          const syncResponse = await fastify.plaid.transactionsSync({
            access_token: accessToken,
            cursor: cursor || undefined,
          });

          const { added, modified, removed, next_cursor, has_more } = syncResponse.data;

          // Process added transactions
          for (const transaction of added) {
            const account = accountMap[transaction.account_id];
            if (!account) continue;

            // Check if transaction already exists
            const existingCheck = await fastify.pg.query(
              `SELECT id FROM purchases WHERE plaid_transaction_id = $1`,
              [transaction.transaction_id]
            );

            if (existingCheck.rows.length === 0) {
              await fastify.pg.query(
                `INSERT INTO purchases (
                  user_id, amount, description, merchant, payment_method,
                  purchase_date, plaid_transaction_id, plaid_account_id, reference_number
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
                [
                  userId,
                  Math.abs(transaction.amount),
                  transaction.name,
                  transaction.merchant_name || transaction.name,
                  account.paymentMethod,
                  transaction.date,
                  transaction.transaction_id,
                  account.id,
                  transaction.transaction_id
                ]
              );
              totalAdded++;
            }
          }

          // Process modified transactions
          for (const transaction of modified) {
            const account = accountMap[transaction.account_id];
            if (!account) continue;

            await fastify.pg.query(
              `UPDATE purchases
               SET amount = $1, description = $2, merchant = $3, purchase_date = $4, updated_at = CURRENT_TIMESTAMP
               WHERE plaid_transaction_id = $5`,
              [
                Math.abs(transaction.amount),
                transaction.name,
                transaction.merchant_name || transaction.name,
                transaction.date,
                transaction.transaction_id
              ]
            );
            totalModified++;
          }

          // Process removed transactions
          for (const removedTx of removed) {
            await fastify.pg.query(
              `DELETE FROM purchases WHERE plaid_transaction_id = $1 AND user_id = $2`,
              [removedTx.transaction_id, userId]
            );
            totalRemoved++;
          }

          cursor = next_cursor;
          hasMore = has_more;
        }

        // Update cursor and last synced timestamp
        await fastify.pg.query(
          `UPDATE plaid_items SET cursor = $1, last_synced_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
          [cursor, item.id]
        );
      }

      return reply.send({
        added: totalAdded,
        modified: totalModified,
        removed: totalRemoved
      });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to sync transactions'
      });
    }
  });

  // Webhook endpoint for Plaid events
  fastify.post('/webhook', async (request, reply) => {
    const { webhook_type, webhook_code, item_id } = request.body;

    try {
      request.log.info(`Plaid webhook: ${webhook_type} - ${webhook_code} for item ${item_id}`);

      // Handle different webhook types
      if (webhook_type === 'TRANSACTIONS') {
        if (webhook_code === 'SYNC_UPDATES_AVAILABLE') {
          // Could trigger background sync here
          request.log.info(`Transactions sync available for item ${item_id}`);
        }
      } else if (webhook_type === 'ITEM') {
        if (webhook_code === 'ERROR' || webhook_code === 'LOGIN_REPAIRED') {
          // Update item status in database
          await fastify.pg.query(
            `UPDATE plaid_items SET updated_at = CURRENT_TIMESTAMP WHERE item_id = $1`,
            [item_id]
          );
        }
      }

      return reply.send({ received: true });
    } catch (err) {
      request.log.error(err);
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to process webhook'
      });
    }
  });
}
