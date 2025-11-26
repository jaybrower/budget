import { apiClient } from './client';
import type {
  BudgetSheet,
  BudgetSheetListItem,
  CreateSheetRequest,
  SyncSheetRequest,
  SyncSheetResponse,
  SyncStatusResponse,
  UpdateSheetRequest,
} from '../types/sheet';

export async function getSheets(): Promise<BudgetSheetListItem[]> {
  return apiClient<BudgetSheetListItem[]>('/sheets');
}

export async function getCurrentSheet(budgetId: string): Promise<BudgetSheet> {
  return apiClient<BudgetSheet>(`/sheets/current?budgetId=${budgetId}`);
}

export async function getSheetByDate(year: number, month: number, budgetId: string): Promise<BudgetSheet> {
  return apiClient<BudgetSheet>(`/sheets/${year}/${month}?budgetId=${budgetId}`);
}

export async function getSheetById(sheetId: string): Promise<BudgetSheet> {
  return apiClient<BudgetSheet>(`/sheets/${sheetId}`);
}

export async function createSheet(data: CreateSheetRequest): Promise<BudgetSheet> {
  return apiClient<BudgetSheet>('/sheets', {
    method: 'POST',
    body: data,
  });
}

export async function getSyncStatus(sheetId: string): Promise<SyncStatusResponse> {
  return apiClient<SyncStatusResponse>(`/sheets/${sheetId}/sync-status`);
}

export async function syncSheet(sheetId: string, data?: SyncSheetRequest): Promise<SyncSheetResponse> {
  return apiClient<SyncSheetResponse>(`/sheets/${sheetId}/sync`, {
    method: 'POST',
    body: data || {},
  });
}

export async function updateSheet(sheetId: string, data: UpdateSheetRequest): Promise<BudgetSheet> {
  return apiClient<BudgetSheet>(`/sheets/${sheetId}`, {
    method: 'PATCH',
    body: data,
  });
}
