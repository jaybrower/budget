import csv from 'csv-parser';
import { Readable } from 'stream';

/**
 * Parses CSV content and maps columns to purchase fields
 *
 * Column mapping:
 * - "Transaction Date" -> purchase_date
 * - "Description" -> merchant
 * - "Category" -> description
 * - "Amount" -> amount (negated: negative values become positive, positive become negative)
 *
 * @param {Buffer} fileBuffer - The CSV file buffer
 * @returns {Promise<Array>} Array of parsed purchase objects
 */
export async function parseCSV(fileBuffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const errors = [];
    let rowNumber = 0;

    Readable.from(fileBuffer)
      .pipe(csv())
      .on('data', (row) => {
        rowNumber++;

        try {
          // Extract and validate required fields
          const transactionDate = row['Transaction Date'];
          const description = row['Description'];
          const category = row['Category'];
          const amount = row['Amount'];

          // Skip rows with missing required fields
          if (!transactionDate || !amount) {
            errors.push({
              row: rowNumber,
              error: 'Missing required fields (Transaction Date or Amount)',
              data: row
            });
            return;
          }

          // Parse the date (format: MM/DD/YYYY)
          const [month, day, year] = transactionDate.split('/');
          const purchaseDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;

          // Parse amount and negate it (negative -> positive, positive -> negative)
          const parsedAmount = parseFloat(amount);
          if (isNaN(parsedAmount)) {
            errors.push({
              row: rowNumber,
              error: 'Invalid amount value',
              data: row
            });
            return;
          }
          const negatedAmount = -parsedAmount;

          // Create purchase object
          results.push({
            purchase_date: purchaseDate,
            merchant: description?.trim() || null,
            description: category?.trim() || null,
            amount: negatedAmount,
            reference_number: row['Memo']?.trim() || null
          });
        } catch (error) {
          errors.push({
            row: rowNumber,
            error: error.message,
            data: row
          });
        }
      })
      .on('end', () => {
        resolve({ results, errors });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}