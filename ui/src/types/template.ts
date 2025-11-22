export interface LineItem {
  id: string;
  name: string;
  description: string | null;
  budgetedAmount: string;
  isRollover: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  lineItems: LineItem[];
}

export interface Template {
  id: string;
  name: string;
  description: string | null;
  baseIncome: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  groups?: Group[];
}

export interface TemplateListItem {
  id: string;
  name: string;
  description: string | null;
  baseIncome: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CreateTemplateRequest {
  name: string;
  description?: string;
  baseIncome: number;
  isDefault?: boolean;
}

export interface CreateGroupRequest {
  name: string;
  description?: string;
}

export interface CreateLineItemRequest {
  name: string;
  budgetedAmount: number;
  isRollover: boolean;
}
