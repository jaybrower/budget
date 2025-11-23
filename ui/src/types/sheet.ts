export interface SheetLineItem {
  id: string;
  templateLineItemId: string;
  name: string;
  description: string | null;
  budgetedAmount: string;
  actualAmount: string;
  isRollover: boolean;
  rolledOverAmount: string;
  availableBalance: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface SheetGroup {
  id: string;
  templateGroupId: string;
  name: string;
  description: string | null;
  sortOrder: number;
  totalBudgeted: number;
  totalActual: number;
  createdAt: string;
  updatedAt: string;
  lineItems: SheetLineItem[];
}

export interface BudgetSheet {
  id: string;
  templateId: string;
  name: string;
  description: string | null;
  year: number;
  month: number;
  baseIncome: string;
  additionalIncome: string;
  rolledOverIncome: string;
  totalIncome: string | number;
  totalBudgeted: string;
  totalActual: string;
  budgetedRemaining: string;
  actualRemaining: string;
  isFinalized: boolean;
  createdAt: string;
  updatedAt: string;
  groups: SheetGroup[];
}

export interface BudgetSheetListItem {
  id: string;
  name: string;
  description: string | null;
  year: number;
  month: number;
  baseIncome: string;
  additionalIncome: string;
  rolledOverIncome: string;
  totalIncome: number;
  totalBudgeted: string;
  totalActual: string;
  budgetedRemaining: string;
  actualRemaining: string;
  isFinalized: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateSheetRequest {
  templateId: string;
  year: number;
  month: number;
  additionalIncome?: number;
  carryOverRollovers?: boolean;
}

export interface SyncSheetRequest {
  updateExisting?: boolean;
}

export interface SyncStats {
  groupsAdded: number;
  itemsAdded: number;
  groupsUpdated: number;
  itemsUpdated: number;
}

export interface SyncSheetResponse {
  sheet: BudgetSheet;
  syncStats: SyncStats;
}

export interface SyncStatusResponse {
  sheetId: string;
  templateId: string;
  sheetSyncedAt: string;
  templateUpdatedAt: string;
  isSynced: boolean;
}
