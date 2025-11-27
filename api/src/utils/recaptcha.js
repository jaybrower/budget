import axios from 'axios';
import { decrypt } from './encrypt.js';

/**
 * Verifies a reCAPTCHA token with Google's reCAPTCHA API
 * @param {string} token - The reCAPTCHA token from the client
 * @returns {Promise<{success: boolean, errorCodes?: string[]}>}
 */
export async function verifyRecaptcha(token) {
  try {
    // Decrypt the reCAPTCHA secret key
    const encryptedSecret = process.env.RECAPTCHA_SECRET_KEY;
    if (!encryptedSecret) {
      throw new Error('RECAPTCHA_SECRET_KEY not configured');
    }

    const secretKey = decrypt(encryptedSecret);

    // Make request to Google's reCAPTCHA verification endpoint
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: secretKey,
          response: token,
        },
      }
    );

    const { success, 'error-codes': errorCodes } = response.data;

    if (!success) {
      return {
        success: false,
        errorCodes: errorCodes || ['unknown-error'],
      };
    }

    return { success: true };
  } catch (error) {
    console.error('reCAPTCHA verification error:', error.message);
    return {
      success: false,
      errorCodes: ['verification-failed'],
    };
  }
}
