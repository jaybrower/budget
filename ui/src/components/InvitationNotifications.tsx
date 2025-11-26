import { useState, useEffect } from 'react';
import { getReceivedInvitations, acceptInvitation, declineInvitation } from '../api/budgets';
import { useBudget } from '../contexts/BudgetContext';
import type { BudgetInvitation } from '../types/budget';

export function InvitationNotifications() {
  const { refreshBudgets } = useBudget();
  const [invitations, setInvitations] = useState<BudgetInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadInvitations();
  }, []);

  const loadInvitations = async () => {
    try {
      setIsLoading(true);
      const response = await getReceivedInvitations();
      setInvitations(response.invitations);
    } catch (err) {
      console.error('Failed to load invitations:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAccept = async (token: string) => {
    try {
      setError(null);
      await acceptInvitation(token);
      await refreshBudgets();
      await loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invitation');
    }
  };

  const handleDecline = async (token: string) => {
    try {
      setError(null);
      await declineInvitation(token);
      await loadInvitations();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to decline invitation');
    }
  };

  if (isLoading || invitations.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
          {error}
        </div>
      )}
      {invitations.map((invitation) => (
        <div
          key={invitation.id}
          className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-3"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="font-medium text-blue-900">
                You've been invited to join "{invitation.budgetName}"
              </p>
              <p className="text-sm text-blue-700 mt-1">
                Invited by {invitation.invitedBy.email} as {invitation.role}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Expires: {new Date(invitation.expiresAt).toLocaleDateString()}
              </p>
            </div>
            <div className="flex space-x-2 ml-4">
              <button
                onClick={() => handleAccept(invitation.token)}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Accept
              </button>
              <button
                onClick={() => handleDecline(invitation.token)}
                className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-100 rounded"
              >
                Decline
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
