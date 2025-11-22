export interface Purchase {
  id: string;
  lineItemId: string | null;
  amount: string;
  description: string | null;
  paymentMethod: string | null;
  merchant: string | null;
  referenceNumber: string | null;
  purchaseDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreatePurchaseRequest {
  amount: number;
  purchaseDate: string;
  description?: string;
  paymentMethod?: string;
  merchant?: string;
  referenceNumber?: string;
  lineItemId?: string;
}

export interface LinkPurchaseRequest {
  lineItemId: string;
}
