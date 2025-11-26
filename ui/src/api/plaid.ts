import { apiClient } from './client';
import type {
  PlaidItem,
  PlaidAccount,
  LinkTokenResponse,
  ExchangeTokenResponse,
  SyncResult,
  PlaidLinkMetadata,
} from '../types/plaid';

export async function createLinkToken(budgetId: string): Promise<LinkTokenResponse> {
  return apiClient<LinkTokenResponse>('/plaid/link-token', {
    method: 'POST',
    body: { budgetId },
  });
}

export async function exchangePublicToken(
  publicToken: string,
  metadata: PlaidLinkMetadata,
  budgetId: string
): Promise<ExchangeTokenResponse> {
  return apiClient<ExchangeTokenResponse>('/plaid/exchange-token', {
    method: 'POST',
    body: { publicToken, metadata, budgetId },
  });
}

export async function getPlaidItems(budgetId: string): Promise<PlaidItem[]> {
  return apiClient<PlaidItem[]>(`/plaid/items?budgetId=${budgetId}`);
}

export async function getPlaidAccounts(budgetId: string): Promise<PlaidAccount[]> {
  return apiClient<PlaidAccount[]>(`/plaid/accounts?budgetId=${budgetId}`);
}

export async function updateAccountMapping(
  accountId: string,
  paymentMethod: string
): Promise<{ message: string }> {
  return apiClient<{ message: string }>(`/plaid/accounts/${accountId}`, {
    method: 'PATCH',
    body: { paymentMethod },
  });
}

export async function syncTransactions(budgetId: string): Promise<SyncResult> {
  return apiClient<SyncResult>('/plaid/sync', {
    method: 'POST',
    body: { budgetId },
  });
}

export async function unlinkItem(itemId: string): Promise<{ message: string }> {
  return apiClient<{ message: string }>(`/plaid/items/${itemId}`, {
    method: 'DELETE',
  });
}
