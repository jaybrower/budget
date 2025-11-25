export type BudgetRole = 'owner' | 'editor' | 'viewer';
export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired';

export interface Budget {
  id: string;
  name: string;
  createdBy: string;
  role: BudgetRole;
  isOwner: boolean;
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetMember {
  userId: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: BudgetRole;
  joinedAt: string;
  invitedBy: {
    userId: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  } | null;
}

export interface BudgetInvitation {
  id: string;
  budgetId: string;
  budgetName?: string;
  email: string;
  role: BudgetRole;
  token: string;
  status: InvitationStatus;
  createdAt: string;
  expiresAt: string;
  respondedAt: string | null;
  invitedBy: {
    userId?: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
  };
}

export interface CreateBudgetRequest {
  name: string;
}

export interface UpdateBudgetRequest {
  name: string;
}

export interface InviteUserRequest {
  email: string;
  role?: BudgetRole;
}

export interface UpdateMemberRoleRequest {
  role: BudgetRole;
}
