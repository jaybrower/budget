import { apiClient } from './client';
import type {
  Budget,
  BudgetMember,
  BudgetInvitation,
  CreateBudgetRequest,
  UpdateBudgetRequest,
  InviteUserRequest,
  UpdateMemberRoleRequest,
} from '../types/budget';

// Budget management
export async function getBudgets(): Promise<{ budgets: Budget[] }> {
  return apiClient('/budgets');
}

export async function createBudget(data: CreateBudgetRequest): Promise<Budget> {
  return apiClient('/budgets', {
    method: 'POST',
    body: data,
  });
}

export async function updateBudget(
  budgetId: string,
  data: UpdateBudgetRequest
): Promise<Budget> {
  return apiClient(`/budgets/${budgetId}`, {
    method: 'PATCH',
    body: data,
  });
}

// Members management
export async function getBudgetMembers(
  budgetId: string
): Promise<{ members: BudgetMember[] }> {
  return apiClient(`/budgets/${budgetId}/members`);
}

export async function updateMemberRole(
  budgetId: string,
  userId: string,
  data: UpdateMemberRoleRequest
): Promise<BudgetMember> {
  return apiClient(`/budgets/${budgetId}/members/${userId}/role`, {
    method: 'PATCH',
    body: data,
  });
}

export async function removeMember(budgetId: string, userId: string): Promise<void> {
  return apiClient(`/budgets/${budgetId}/members/${userId}`, {
    method: 'DELETE',
  });
}

// Invitations
export async function inviteUser(
  budgetId: string,
  data: InviteUserRequest
): Promise<BudgetInvitation> {
  return apiClient(`/budgets/${budgetId}/invitations`, {
    method: 'POST',
    body: data,
  });
}

export async function getBudgetInvitations(
  budgetId: string
): Promise<{ invitations: BudgetInvitation[] }> {
  return apiClient(`/budgets/${budgetId}/invitations`);
}

export async function cancelInvitation(
  budgetId: string,
  invitationId: string
): Promise<void> {
  return apiClient(`/budgets/${budgetId}/invitations/${invitationId}`, {
    method: 'DELETE',
  });
}

export async function getReceivedInvitations(): Promise<{
  invitations: BudgetInvitation[];
}> {
  return apiClient('/budgets/invitations/received');
}

export async function acceptInvitation(
  token: string
): Promise<{ budgetId: string; budgetName: string; role: string; message: string }> {
  return apiClient(`/budgets/invitations/${token}/accept`, {
    method: 'POST',
    body: {},
  });
}

export async function declineInvitation(
  token: string
): Promise<{ message: string }> {
  return apiClient(`/budgets/invitations/${token}/decline`, {
    method: 'POST',
    body: {},
  });
}
