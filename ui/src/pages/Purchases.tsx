import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useBudget } from '../contexts/BudgetContext';
import { getSheetByDate } from '../api/sheets';
import {
  createPurchase,
  getUnassociatedPurchases,
  linkPurchase,
  deletePurchase,
  importPurchases,
  type ImportPurchasesResult,
} from '../api/purchases';
import type { Purchase, CreatePurchaseRequest } from '../types/purchase';

interface LineItemOption {
  id: string;
  name: string;
  groupName: string;
}

export function Purchases() {
  const { currentBudget } = useBudget();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [unassociatedPurchases, setUnassociatedPurchases] = useState<Purchase[]>([]);
  const [lineItemOptions, setLineItemOptions] = useState<LineItemOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('southwest_visa');
  const [merchant, setMerchant] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [selectedLineItemId, setSelectedLineItemId] = useState('');

  // Link purchase state
  const [linkingPurchaseId, setLinkingPurchaseId] = useState<string | null>(null);
  const [linkLineItemId, setLinkLineItemId] = useState('');

  // CSV import state
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPaymentMethod, setImportPaymentMethod] = useState('southwest_visa');
  const [isImporting, setIsImporting] = useState(false);
  const [importResult, setImportResult] = useState<ImportPurchasesResult | null>(null);

  useEffect(() => {
    if (currentBudget) {
      loadData();
    }
  }, [selectedYear, selectedMonth, currentBudget]);

  async function loadData() {
    if (!currentBudget) return;

    try {
      setIsLoading(true);
      setError(null);

      // Load unassociated purchases
      const purchases = await getUnassociatedPurchases(currentBudget.id);
      setUnassociatedPurchases(purchases);

      // Try to load budget sheet for selected month/year for line items
      try {
        const sheet = await getSheetByDate(selectedYear, selectedMonth, currentBudget.id);

        // Extract line items from the sheet
        const options: LineItemOption[] = [];
        for (const group of sheet.groups) {
          for (const item of group.lineItems) {
            options.push({
              id: item.id,
              name: item.name,
              groupName: group.name,
            });
          }
        }
        setLineItemOptions(options);
      } catch {
        // No budget sheet for this month/year - that's okay
        setLineItemOptions([]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!amount || !purchaseDate) {
      setError('Amount and purchase date are required');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const request: CreatePurchaseRequest = {
        amount: parsedAmount,
        budgetId: currentBudget!.id,
        purchaseDate,
      };

      if (description.trim()) {
        request.description = description.trim();
      }
      if (paymentMethod.trim()) {
        request.paymentMethod = paymentMethod.trim();
      }
      if (merchant.trim()) {
        request.merchant = merchant.trim();
      }
      if (referenceNumber.trim()) {
        request.referenceNumber = referenceNumber.trim();
      }
      if (selectedLineItemId) {
        request.lineItemId = selectedLineItemId;
      }

      await createPurchase(request);

      // Reset form
      setAmount('');
      setDescription('');
      setPaymentMethod('southwest_visa');
      setMerchant('');
      setReferenceNumber('');
      setPurchaseDate(new Date().toISOString().split('T')[0]);
      setSelectedLineItemId('');

      // Reload data
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create purchase');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleLinkPurchase(purchaseId: string) {
    if (!linkLineItemId) {
      setError('Please select a line item to link');
      return;
    }

    try {
      setError(null);
      await linkPurchase(purchaseId, { lineItemId: linkLineItemId });
      setLinkingPurchaseId(null);
      setLinkLineItemId('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to link purchase');
    }
  }

  async function handleDeletePurchase(purchase: Purchase) {
    const confirmMessage = `Are you sure you want to delete this purchase?\n\n` +
      `Date: ${formatDate(purchase.purchaseDate, false)}\n` +
      `Amount: ${formatCurrency(purchase.amount)}\n` +
      `Merchant: ${purchase.merchant || 'N/A'}\n` +
      `Description: ${purchase.description || 'N/A'}`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      setError(null);
      await deletePurchase(purchase.id);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete purchase');
    }
  }

  async function handleImportCSV(e: React.FormEvent) {
    e.preventDefault();

    if (!importFile) {
      setError('Please select a CSV file');
      return;
    }

    if (!currentBudget) {
      setError('No budget selected');
      return;
    }

    try {
      setIsImporting(true);
      setError(null);
      setImportResult(null);

      const result = await importPurchases(
        importFile,
        currentBudget.id,
        importPaymentMethod
      );

      setImportResult(result);
      setImportFile(null);

      // Reload data to show newly imported purchases
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to import purchases');
    } finally {
      setIsImporting(false);
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      setImportFile(file);
      setImportResult(null);
    }
  }

  function formatCurrency(value: string | number): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  }

  function formatDate(dateString: string, includeTime: boolean = true): string {
    let date: Date;

    if (includeTime) {
      // Parse with time, which respects timezone
      date = new Date(dateString);
    } else {
      // Parse only the date parts, ignoring time and timezone
      const [year, month, day] = dateString.split('T')[0].split('-').map(Number);
      date = new Date(year, month - 1, day);
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = [];
  for (let y = now.getFullYear() - 5; y <= now.getFullYear() + 1; y++) {
    years.push(y);
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-500">Loading...</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-sm text-red-500 underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Month/Year selector */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">Link to Budget:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {months.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          {lineItemOptions.length === 0 && (
            <p className="text-sm text-gray-500 italic">
              No budget sheet for {months[selectedMonth - 1]} {selectedYear}
            </p>
          )}
        </div>
      </div>

      {/* Create Purchase Form */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Create New Purchase
        </h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="amount"
                className="block text-sm font-medium text-gray-700"
              >
                Amount *
              </label>
              <input
                type="number"
                id="amount"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="0.00"
                required
              />
            </div>

            <div>
              <label
                htmlFor="purchaseDate"
                className="block text-sm font-medium text-gray-700"
              >
                Purchase Date *
              </label>
              <input
                type="date"
                id="purchaseDate"
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                required
              />
            </div>

            <div>
              <label
                htmlFor="merchant"
                className="block text-sm font-medium text-gray-700"
              >
                Merchant
              </label>
              <input
                type="text"
                id="merchant"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Store name"
              />
            </div>

            <div>
              <label
                htmlFor="paymentMethod"
                className="block text-sm font-medium text-gray-700"
              >
                Payment Method
              </label>
              <select
                id="paymentMethod"
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="southwest_visa">Southwest Visa</option>
                <option value="amex_ach">Amex ACH</option>
                <option value="delta_amex">Delta Amex</option>
                <option value="venmo_visa">Venmo Visa</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label
                htmlFor="description"
                className="block text-sm font-medium text-gray-700"
              >
                Description
              </label>
              <input
                type="text"
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="What was this purchase for?"
              />
            </div>

            <div>
              <label
                htmlFor="referenceNumber"
                className="block text-sm font-medium text-gray-700"
              >
                Reference Number
              </label>
              <input
                type="text"
                id="referenceNumber"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                placeholder="Transaction ID, receipt number, etc."
              />
            </div>

            <div>
              <label
                htmlFor="lineItem"
                className="block text-sm font-medium text-gray-700"
              >
                Budget Line Item
              </label>
              {lineItemOptions.length > 0 ? (
                <select
                  id="lineItem"
                  value={selectedLineItemId}
                  onChange={(e) => setSelectedLineItemId(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">-- None (Unassociated) --</option>
                  {lineItemOptions.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.groupName} - {option.name}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="mt-1 text-sm text-gray-500">
                  No budget sheet for {months[selectedMonth - 1]} {selectedYear}
                </p>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isSubmitting}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSubmitting ? 'Creating...' : 'Create Purchase'}
            </button>
          </div>
        </form>
      </div>

      {/* CSV Import Section */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Import Purchases from CSV
        </h2>

        <form onSubmit={handleImportCSV} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="csvFile"
                className="block text-sm font-medium text-gray-700"
              >
                CSV File *
              </label>
              <input
                type="file"
                id="csvFile"
                accept=".csv"
                onChange={handleFileChange}
                className="mt-1 block w-full text-sm text-gray-500
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-indigo-50 file:text-indigo-700
                  hover:file:bg-indigo-100"
                required
              />
              <p className="mt-1 text-xs text-gray-500">
                CSV format: Transaction Date, Description, Category, Amount
              </p>
            </div>

            <div>
              <label
                htmlFor="importPaymentMethod"
                className="block text-sm font-medium text-gray-700"
              >
                Payment Method *
              </label>
              <select
                id="importPaymentMethod"
                value={importPaymentMethod}
                onChange={(e) => setImportPaymentMethod(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              >
                <option value="southwest_visa">Southwest Visa</option>
                <option value="amex_ach">Amex ACH</option>
                <option value="delta_amex">Delta Amex</option>
                <option value="venmo_visa">Venmo Visa</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={isImporting || !importFile}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isImporting ? 'Importing...' : 'Import CSV'}
            </button>
          </div>
        </form>

        {/* Import Results */}
        {importResult && (
          <div className="mt-6 space-y-4">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">
                Import Summary
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
                <div>
                  <p className="text-blue-600 font-medium">Total Rows</p>
                  <p className="text-blue-900 text-lg">{importResult.summary.total}</p>
                </div>
                <div>
                  <p className="text-green-600 font-medium">Imported</p>
                  <p className="text-green-900 text-lg">{importResult.summary.imported}</p>
                </div>
                <div>
                  <p className="text-yellow-600 font-medium">Duplicates</p>
                  <p className="text-yellow-900 text-lg">{importResult.summary.duplicates}</p>
                </div>
                <div>
                  <p className="text-red-600 font-medium">Failed</p>
                  <p className="text-red-900 text-lg">{importResult.summary.failed}</p>
                </div>
                <div>
                  <p className="text-red-600 font-medium">Parse Errors</p>
                  <p className="text-red-900 text-lg">{importResult.summary.parseErrors}</p>
                </div>
              </div>
            </div>

            {importResult.duplicates.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-yellow-900 mb-2">
                  Duplicates Skipped ({importResult.duplicates.length})
                </h3>
                <div className="max-h-40 overflow-y-auto">
                  <ul className="text-xs text-yellow-800 space-y-1">
                    {importResult.duplicates.slice(0, 10).map((dup, idx) => (
                      <li key={idx}>
                        {dup.purchase_date} - {dup.merchant} - {formatCurrency(dup.amount)} - {dup.reason}
                      </li>
                    ))}
                    {importResult.duplicates.length > 10 && (
                      <li className="italic">
                        ... and {importResult.duplicates.length - 10} more
                      </li>
                    )}
                  </ul>
                </div>
              </div>
            )}

            {importResult.failed.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-red-900 mb-2">
                  Failed Imports ({importResult.failed.length})
                </h3>
                <div className="max-h-40 overflow-y-auto">
                  <ul className="text-xs text-red-800 space-y-1">
                    {importResult.failed.map((fail, idx) => (
                      <li key={idx}>
                        {fail.purchase_date} - {fail.merchant} - {formatCurrency(fail.amount)} - {fail.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {importResult.parseErrors.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <h3 className="text-sm font-medium text-red-900 mb-2">
                  Parse Errors ({importResult.parseErrors.length})
                </h3>
                <div className="max-h-40 overflow-y-auto">
                  <ul className="text-xs text-red-800 space-y-1">
                    {importResult.parseErrors.map((err, idx) => (
                      <li key={idx}>
                        Row {err.row}: {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Unassociated Purchases List */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">
          Unassociated Purchases
        </h2>

        {unassociatedPurchases.length === 0 ? (
          <p className="text-gray-500 text-sm">
            No unassociated purchases. All purchases are linked to budget line
            items.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Merchant
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Method
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {unassociatedPurchases.map((purchase) => (
                  <tr key={purchase.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(purchase.purchaseDate, false)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatCurrency(purchase.amount)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {purchase.merchant || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {purchase.paymentMethod || '-'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {purchase.description || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {linkingPurchaseId === purchase.id ? (
                        <div className="flex items-center space-x-2">
                          <select
                            value={linkLineItemId}
                            onChange={(e) => setLinkLineItemId(e.target.value)}
                            className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                          >
                            <option value="">Select...</option>
                            {lineItemOptions.map((option) => (
                              <option key={option.id} value={option.id}>
                                {option.groupName} - {option.name}
                              </option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleLinkPurchase(purchase.id)}
                            className="text-indigo-600 hover:text-indigo-900"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => {
                              setLinkingPurchaseId(null);
                              setLinkLineItemId('');
                            }}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => setLinkingPurchaseId(purchase.id)}
                            disabled={lineItemOptions.length === 0}
                            className="text-indigo-600 hover:text-indigo-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                          >
                            Link to Budget
                          </button>
                          <button
                            onClick={() => handleDeletePurchase(purchase)}
                            className="text-red-600 hover:text-red-900"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  );
}
