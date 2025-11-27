import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useBudget } from '../contexts/BudgetContext';
import { getCurrentSheet } from '../api/sheets';
import {
  createPurchase,
  getUnassociatedPurchases,
  linkPurchase,
} from '../api/purchases';
import type { Purchase, CreatePurchaseRequest } from '../types/purchase';

interface LineItemOption {
  id: string;
  name: string;
  groupName: string;
}

export function Purchases() {
  const { currentBudget } = useBudget();
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

  useEffect(() => {
    if (currentBudget) {
      loadData();
    }
  }, [currentBudget]);

  async function loadData() {
    if (!currentBudget) return;

    try {
      setIsLoading(true);
      setError(null);

      // Load unassociated purchases
      const purchases = await getUnassociatedPurchases(currentBudget.id);
      setUnassociatedPurchases(purchases);

      // Try to load current budget sheet for line items
      try {
        const sheet = await getCurrentSheet(currentBudget.id);

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
        // No current budget sheet - that's okay
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

  function formatCurrency(value: string | number): string {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(num);
  }

  function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
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
                  No budget sheet for current month. Create a budget sheet to
                  associate purchases with line items.
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
                      {formatDate(purchase.purchaseDate)}
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
                        <button
                          onClick={() => setLinkingPurchaseId(purchase.id)}
                          disabled={lineItemOptions.length === 0}
                          className="text-indigo-600 hover:text-indigo-900 disabled:text-gray-400 disabled:cursor-not-allowed"
                        >
                          Link to Budget
                        </button>
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
