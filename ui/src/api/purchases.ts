import { apiClient } from './client';
import type {
  Purchase,
  CreatePurchaseRequest,
  LinkPurchaseRequest,
} from '../types/purchase';

export async function createPurchase(data: CreatePurchaseRequest): Promise<Purchase> {
  return apiClient<Purchase>('/purchases', {
    method: 'POST',
    body: data,
  });
}

export async function getUnassociatedPurchases(budgetId: string): Promise<Purchase[]> {
  return apiClient<Purchase[]>(`/purchases/unassociated?budgetId=${budgetId}`);
}

export async function getPurchasesForLineItem(lineItemId: string): Promise<Purchase[]> {
  return apiClient<Purchase[]>(`/purchases/line-item/${lineItemId}`);
}

export async function linkPurchase(
  purchaseId: string,
  data: LinkPurchaseRequest
): Promise<Purchase> {
  return apiClient<Purchase>(`/purchases/${purchaseId}/link`, {
    method: 'PATCH',
    body: data,
  });
}

export async function unlinkPurchase(purchaseId: string): Promise<Purchase> {
  return apiClient<Purchase>(`/purchases/${purchaseId}/unlink`, {
    method: 'PATCH',
    body: {},
  });
}

export interface ImportPurchasesResult {
  summary: {
    total: number;
    imported: number;
    duplicates: number;
    failed: number;
    parseErrors: number;
  };
  imported: Purchase[];
  duplicates: Array<{
    purchase_date: string;
    merchant: string;
    description: string;
    amount: number;
    reason: string;
  }>;
  failed: Array<{
    purchase_date: string;
    merchant: string;
    description: string;
    amount: number;
    reason: string;
  }>;
  parseErrors: Array<{
    row: number;
    error: string;
    data: any;
  }>;
}

export async function importPurchases(
  file: File,
  budgetId: string,
  paymentMethod: string
): Promise<ImportPurchasesResult> {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('budgetId', budgetId);
  formData.append('paymentMethod', paymentMethod);

  const token = localStorage.getItem('token');
  const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/purchases/import`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to import purchases');
  }

  return response.json();
}
