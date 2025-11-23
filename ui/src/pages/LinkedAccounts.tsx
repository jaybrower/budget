import { useState, useEffect, useCallback } from 'react';
import { usePlaidLink } from 'react-plaid-link';
import { Layout } from '../components/Layout';
import {
  createLinkToken,
  exchangePublicToken,
  getPlaidItems,
  updateAccountMapping,
  syncTransactions,
  unlinkItem,
} from '../api/plaid';
import type { PlaidItem, PlaidLinkMetadata, SyncResult } from '../types/plaid';

export function LinkedAccounts() {
  const [items, setItems] = useState<PlaidItem[]>([]);
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [editingAccountId, setEditingAccountId] = useState<string | null>(null);
  const [paymentMethodValue, setPaymentMethodValue] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setIsLoading(true);
      setError(null);

      const [itemsData, tokenData] = await Promise.all([
        getPlaidItems(),
        createLinkToken(),
      ]);

      setItems(itemsData);
      setLinkToken(tokenData.linkToken);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }

  const onSuccess = useCallback(
    async (publicToken: string, metadata: PlaidLinkMetadata) => {
      try {
        setError(null);
        await exchangePublicToken(publicToken, metadata);
        await loadData();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to link account');
      }
    },
    []
  );

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
  });

  async function handleSync() {
    try {
      setIsSyncing(true);
      setError(null);
      setSyncResult(null);

      const result = await syncTransactions();
      setSyncResult(result);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync transactions');
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleUnlink(itemId: string, institutionName: string | null) {
    if (!confirm(`Are you sure you want to unlink ${institutionName || 'this account'}?`)) {
      return;
    }

    try {
      setError(null);
      await unlinkItem(itemId);
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink account');
    }
  }

  async function handleUpdatePaymentMethod(accountId: string) {
    if (!paymentMethodValue.trim()) {
      setError('Please enter a payment method');
      return;
    }

    try {
      setError(null);
      await updateAccountMapping(accountId, paymentMethodValue.trim());
      setEditingAccountId(null);
      setPaymentMethodValue('');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account');
    }
  }

  function formatDate(dateString: string | null): string {
    if (!dateString) return 'Never';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
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

      {syncResult && (
        <div className="mb-4 bg-green-50 border border-green-200 rounded-md p-4">
          <p className="text-sm text-green-600">
            Sync complete: {syncResult.added} added, {syncResult.modified} modified, {syncResult.removed} removed
          </p>
          <button
            onClick={() => setSyncResult(null)}
            className="text-sm text-green-500 underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-medium text-gray-900">Linked Accounts</h2>
          <div className="flex space-x-3">
            <button
              onClick={handleSync}
              disabled={isSyncing || items.length === 0}
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync Transactions'}
            </button>
            <button
              onClick={() => open()}
              disabled={!ready}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              Link Bank Account
            </button>
          </div>
        </div>
      </div>

      {/* Linked Institutions */}
      {items.length === 0 ? (
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-500 text-center py-8">
            No linked accounts. Click "Link Bank Account" to connect your first bank or credit card.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {items.map((item) => (
            <div key={item.id} className="bg-white shadow rounded-lg p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">
                    {item.institutionName || 'Unknown Institution'}
                  </h3>
                  <p className="text-sm text-gray-500">
                    Last synced: {formatDate(item.lastSyncedAt)}
                  </p>
                </div>
                <button
                  onClick={() => handleUnlink(item.id, item.institutionName)}
                  className="text-sm text-red-600 hover:text-red-900"
                >
                  Unlink
                </button>
              </div>

              {item.accounts && item.accounts.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Account
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Last 4
                        </th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Payment Method
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {item.accounts.map((account) => (
                        <tr key={account.id}>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900">
                            {account.name}
                            {account.officialName && account.officialName !== account.name && (
                              <span className="text-gray-500 text-xs block">
                                {account.officialName}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                            {account.type}
                            {account.subtype && ` / ${account.subtype}`}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">
                            {account.mask || '-'}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm">
                            {editingAccountId === account.id ? (
                              <div className="flex items-center space-x-2">
                                <select
                                  value={paymentMethodValue}
                                  onChange={(e) => setPaymentMethodValue(e.target.value)}
                                  className="block w-40 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                                >
                                  <option value="">Select...</option>
                                  <option value="southwest_visa">Southwest Visa</option>
                                  <option value="amex_ach">Amex ACH</option>
                                  <option value="delta_amex">Delta Amex</option>
                                  <option value="venmo_visa">Venmo Visa</option>
                                </select>
                                <button
                                  onClick={() => handleUpdatePaymentMethod(account.id)}
                                  className="text-indigo-600 hover:text-indigo-900"
                                >
                                  Save
                                </button>
                                <button
                                  onClick={() => {
                                    setEditingAccountId(null);
                                    setPaymentMethodValue('');
                                  }}
                                  className="text-gray-500 hover:text-gray-700"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center space-x-2">
                                <span className={account.paymentMethod ? 'text-gray-900' : 'text-gray-400'}>
                                  {account.paymentMethod || 'Not mapped'}
                                </span>
                                <button
                                  onClick={() => {
                                    setEditingAccountId(account.id);
                                    setPaymentMethodValue(account.paymentMethod || '');
                                  }}
                                  className="text-indigo-600 hover:text-indigo-900 text-xs"
                                >
                                  Edit
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-500">No accounts found for this institution.</p>
              )}
            </div>
          ))}
        </div>
      )}
    </Layout>
  );
}
