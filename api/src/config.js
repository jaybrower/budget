import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const ALGORITHM = 'aes-256-gcm';

function decrypt(encryptedText, encryptionKey) {
  if (!encryptedText) {
    throw new Error('Encrypted text is required for decryption');
  }

  const parts = encryptedText.split(':');
  if (parts.length !== 3) {
    throw new Error(
      `Invalid encrypted value format. Expected format: "iv:authTag:encrypted" (3 parts separated by colons). ` +
      `Received ${parts.length} part(s). This usually means the environment variable was not set correctly. ` +
      `Make sure to wrap the encrypted value in quotes when setting it in your hosting provider.`
    );
  }

  const [ivHex, authTagHex, encrypted] = parts;
  const key = crypto.scryptSync(encryptionKey, 'salt', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function getDatabasePassword() {
  // If plain password is provided (for local dev), use it
  if (process.env.DATABASE_PASSWORD) {
    return process.env.DATABASE_PASSWORD;
  }

  // Otherwise decrypt the encrypted password
  const encryptedPassword = process.env.DATABASE_PASSWORD_ENCRYPTED;
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptedPassword || !encryptionKey) {
    throw new Error('DATABASE_PASSWORD or (DATABASE_PASSWORD_ENCRYPTED and ENCRYPTION_KEY) must be set');
  }

  return decrypt(encryptedPassword, encryptionKey);
}

function getPlaidCredentials() {
  const encryptionKey = process.env.ENCRYPTION_KEY;

  if (!encryptionKey) {
    throw new Error('ENCRYPTION_KEY must be set for Plaid credentials');
  }

  const clientIdEncrypted = process.env.PLAID_CLIENT_ID_ENCRYPTED;
  const secretEncrypted = process.env.PLAID_SECRET_ENCRYPTED;

  if (!clientIdEncrypted || !secretEncrypted) {
    throw new Error('PLAID_CLIENT_ID_ENCRYPTED and PLAID_SECRET_ENCRYPTED must be set');
  }

  return {
    clientId: decrypt(clientIdEncrypted, encryptionKey),
    secret: decrypt(secretEncrypted, encryptionKey)
  };
}

function buildConnectionString() {
  // If full connection string is provided, use it
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
  }

  const host = process.env.DATABASE_HOST || 'localhost';
  const port = process.env.DATABASE_PORT || '5432';
  const name = process.env.DATABASE_NAME || 'budget';
  const user = process.env.DATABASE_USER || 'postgres';
  const password = getDatabasePassword();

  return `postgresql://${user}:${encodeURIComponent(password)}@${host}:${port}/${name}`;
}

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0'
  },
  database: {
    connectionString: buildConnectionString()
  },
  jwt: {
    secret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  plaid: {
    ...getPlaidCredentials(),
    env: process.env.PLAID_ENV || 'sandbox',
    products: (process.env.PLAID_PRODUCTS || 'transactions').split(','),
    countryCodes: (process.env.PLAID_COUNTRY_CODES || 'US').split(',')
  }
};
