import readline from 'readline';
import { encrypt } from './encrypt.js';

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
    console.log('\nHere is your encrypted value:');
    console.log(`${encrypted}`);
    rl.close();
  });
});
