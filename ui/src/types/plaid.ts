export interface PlaidAccount {
  id: string;
  accountId: string;
  name: string;
  officialName: string | null;
  type: string;
  subtype: string | null;
  mask: string | null;
  paymentMethod: string | null;
  isActive: boolean;
  institutionName?: string;
}

export interface PlaidItem {
  id: string;
  institutionId: string | null;
  institutionName: string | null;
  lastSyncedAt: string | null;
  isActive: boolean;
  createdAt: string;
  accounts: PlaidAccount[];
}

export interface LinkTokenResponse {
  linkToken: string;
}

export interface ExchangeTokenResponse {
  message: string;
  itemId: string;
  accountsLinked: number;
}

export interface SyncResult {
  added: number;
  modified: number;
  removed: number;
}

export interface PlaidLinkMetadata {
  institution?: {
    institution_id: string;
    name: string;
  };
  accounts?: Array<{
    id: string;
    name: string;
    mask: string;
    type: string;
    subtype: string;
  }>;
}
