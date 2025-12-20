import crypto from 'crypto';

/**
 * Generates a SHA-256 hash for a purchase based on its key attributes
 * This hash is used for duplicate detection during CSV imports
 *
 * @param {Object} purchase - Purchase data
 * @param {string|Date} purchase.purchase_date - The purchase date
 * @param {string} purchase.merchant - The merchant name
 * @param {string} purchase.description - The purchase description
 * @param {number|string} purchase.amount - The purchase amount
 * @returns {string} SHA-256 hash (64 hex characters)
 */
export function generatePurchaseHash({ purchase_date, merchant, description, amount }) {
  // Normalize the data to ensure consistent hashing
  const normalizedDate = purchase_date instanceof Date
    ? purchase_date.toISOString().split('T')[0]
    : String(purchase_date);

  const normalizedMerchant = String(merchant || '').trim().toLowerCase();
  const normalizedDescription = String(description || '').trim().toLowerCase();
  const normalizedAmount = String(amount).trim();

  // Create a deterministic string from the purchase data
  const dataString = `${normalizedDate}|${normalizedMerchant}|${normalizedDescription}|${normalizedAmount}`;

  // Generate SHA-256 hash
  return crypto.createHash('sha256').update(dataString).digest('hex');
}