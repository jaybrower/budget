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

export async function getUnassociatedPurchases(): Promise<Purchase[]> {
  return apiClient<Purchase[]>('/purchases/unassociated');
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
