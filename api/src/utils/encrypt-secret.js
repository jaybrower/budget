import crypto from 'crypto';
import readline from 'readline';

const ALGORITHM = 'aes-256-gcm';

function encrypt(text, encryptionKey) {
  const key = crypto.scryptSync(encryptionKey, 'salt', 32);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');

  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Secret Encryption Utility');
console.log('========================\n');

rl.question('Enter the secret to encrypt: ', (secret) => {
  rl.question('Enter your encryption key (use same key in ENCRYPTION_KEY env var): ', (key) => {
    const encrypted = encrypt(secret, key);
    console.log('\nEncrypted value:');
    console.log(encrypted);
    console.log('\nAdd this to your .env file as:');
    console.log(`DATABASE_PASSWORD_ENCRYPTED=${encrypted}`);
    rl.close();
  });
});
