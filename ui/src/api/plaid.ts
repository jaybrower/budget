import { apiClient } from './client';
import type {
  PlaidItem,
  PlaidAccount,
  LinkTokenResponse,
  ExchangeTokenResponse,
  SyncResult,
  PlaidLinkMetadata,
} from '../types/plaid';

export async function createLinkToken(): Promise<LinkTokenResponse> {
  return apiClient<LinkTokenResponse>('/plaid/link-token', {
    method: 'POST',
    body: {},
  });
}

export async function exchangePublicToken(
  publicToken: string,
  metadata: PlaidLinkMetadata
): Promise<ExchangeTokenResponse> {
  return apiClient<ExchangeTokenResponse>('/plaid/exchange-token', {
    method: 'POST',
    body: { publicToken, metadata },
  });
}

export async function getPlaidItems(): Promise<PlaidItem[]> {
  return apiClient<PlaidItem[]>('/plaid/items');
}

export async function getPlaidAccounts(): Promise<PlaidAccount[]> {
  return apiClient<PlaidAccount[]>('/plaid/accounts');
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

export async function syncTransactions(): Promise<SyncResult> {
  return apiClient<SyncResult>('/plaid/sync', {
    method: 'POST',
    body: {},
  });
}

export async function unlinkItem(itemId: string): Promise<{ message: string }> {
  return apiClient<{ message: string }>(`/plaid/items/${itemId}`, {
    method: 'DELETE',
  });
}
