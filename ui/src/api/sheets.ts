import { apiClient } from './client';
import type {
  BudgetSheet,
  BudgetSheetListItem,
  CreateSheetRequest,
} from '../types/sheet';

export async function getSheets(): Promise<BudgetSheetListItem[]> {
  return apiClient<BudgetSheetListItem[]>('/sheets');
}

export async function getCurrentSheet(): Promise<BudgetSheet> {
  return apiClient<BudgetSheet>('/sheets/current');
}

export async function getSheetByDate(year: number, month: number): Promise<BudgetSheet> {
  return apiClient<BudgetSheet>(`/sheets/${year}/${month}`);
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
