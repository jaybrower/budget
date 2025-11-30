import readline from 'readline';
import { encrypt } from './encrypt.js';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Secret Encryption Utility');
console.log('========================\n');

const askForSecret = (key) => {
  rl.question('\nEnter the secret to encrypt (or "stop" to exit): ', (secret) => {
    if (secret.toLowerCase() === 'stop') {
      console.log('\nExiting encryption utility.');
      rl.close();
      return;
    }

    const encrypted = encrypt(secret, key);
    console.log('\nEncrypted value:');
    console.log(encrypted);

    askForSecret(key);
  });
};

rl.question('Enter your encryption key (use same key in ENCRYPTION_KEY env var): ', (key) => {
  askForSecret(key);
});
