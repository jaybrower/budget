import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import { useBudget } from '../contexts/BudgetContext';
import { useAuth } from '../contexts/AuthContext';
import {
  getBudgetMembers,
  getBudgetInvitations,
  inviteUser,
  cancelInvitation,
  updateMemberRole,
  removeMember,
  updateBudget,
} from '../api/budgets';
import type { BudgetMember, BudgetInvitation, BudgetRole } from '../types/budget';

export function BudgetSettings() {
  const { currentBudget, refreshBudgets } = useBudget();
  const { user } = useAuth();
  const [members, setMembers] = useState<BudgetMember[]>([]);
  const [invitations, setInvitations] = useState<BudgetInvitation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<BudgetRole>('editor');
  const [isInviting, setIsInviting] = useState(false);

  // Budget name edit state
  const [isEditingName, setIsEditingName] = useState(false);
  const [budgetName, setBudgetName] = useState('');

  const isOwner = currentBudget?.role === 'owner';
  const canInvite = currentBudget?.role === 'owner' || currentBudget?.role === 'editor';

  useEffect(() => {
    if (currentBudget) {
      setBudgetName(currentBudget.name);
      loadData();
    }
  }, [currentBudget?.id]);

  const loadData = async () => {
    if (!currentBudget) return;

    try {
      setIsLoading(true);
      setError(null);
      const [membersData, invitationsData] = await Promise.all([
        getBudgetMembers(currentBudget.id),
        getBudgetInvitations(currentBudget.id),
      ]);
      setMembers(membersData.members);
      setInvitations(invitationsData.invitations);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBudget || !inviteEmail.trim()) return;

    try {
      setError(null);
      setSuccess(null);
      setIsInviting(true);
      await inviteUser(currentBudget.id, {
        email: inviteEmail,
        role: inviteRole,
      });
      setSuccess('Invitation sent successfully!');
      setInviteEmail('');
      setInviteRole('editor');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invitation');
    } finally {
      setIsInviting(false);
    }
  };

  const handleCancelInvitation = async (invitationId: string) => {
    if (!currentBudget) return;

    try {
      setError(null);
      setSuccess(null);
      await cancelInvitation(currentBudget.id, invitationId);
      setSuccess('Invitation cancelled');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invitation');
    }
  };

  const handleUpdateRole = async (userId: string, newRole: BudgetRole) => {
    if (!currentBudget) return;

    try {
      setError(null);
      setSuccess(null);
      await updateMemberRole(currentBudget.id, userId, { role: newRole });
      setSuccess('Member role updated');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update role');
    }
  };

  const handleRemoveMember = async (userId: string) => {
    if (!currentBudget) return;
    if (!confirm('Are you sure you want to remove this member?')) return;

    try {
      setError(null);
      setSuccess(null);
      await removeMember(currentBudget.id, userId);
      setSuccess('Member removed');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove member');
    }
  };

  const handleLeaveBudget = async () => {
    if (!currentBudget || !user) return;
    if (!confirm('Are you sure you want to leave this budget?')) return;

    try {
      setError(null);
      await removeMember(currentBudget.id, user.id);
      await refreshBudgets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave budget');
    }
  };

  const handleUpdateBudgetName = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentBudget || !budgetName.trim()) return;

    try {
      setError(null);
      setSuccess(null);
      await updateBudget(currentBudget.id, { name: budgetName });
      setSuccess('Budget name updated');
      setIsEditingName(false);
      await refreshBudgets();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update budget name');
    }
  };

  if (!currentBudget) {
    return (
      <Layout>
        <div className="text-center py-12">
          <p className="text-gray-500">No budget selected</p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto space-y-6">
      {/* Budget Name */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Budget Settings</h2>
        {isEditingName ? (
          <form onSubmit={handleUpdateBudgetName} className="flex items-center space-x-3">
            <input
              type="text"
              value={budgetName}
              onChange={(e) => setBudgetName(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Save
            </button>
            <button
              type="button"
              onClick={() => {
                setBudgetName(currentBudget.name);
                setIsEditingName(false);
              }}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded"
            >
              Cancel
            </button>
          </form>
        ) : (
          <div className="flex items-center justify-between">
            <div>
              <p className="text-lg font-medium">{currentBudget.name}</p>
              <p className="text-sm text-gray-500">Your role: {currentBudget.role}</p>
            </div>
            {isOwner && (
              <button
                onClick={() => setIsEditingName(true)}
                className="px-3 py-1 text-sm text-blue-600 hover:bg-blue-50 rounded"
              >
                Edit Name
              </button>
            )}
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded">
          {success}
        </div>
      )}

      {/* Invite Form */}
      {canInvite && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Invite Members</h3>
          <form onSubmit={handleInvite} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="user@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as BudgetRole)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="editor">Editor - Can view and edit</option>
                <option value="viewer">Viewer - Can only view</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={isInviting}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {isInviting ? 'Sending...' : 'Send Invitation'}
            </button>
          </form>
        </div>
      )}

      {/* Members List */}
      <div className="bg-white rounded-lg shadow p-6">
        <h3 className="text-lg font-semibold mb-4">Members ({members.length})</h3>
        {isLoading ? (
          <p className="text-gray-500">Loading...</p>
        ) : members.length === 0 ? (
          <p className="text-gray-500">No members yet</p>
        ) : (
          <div className="space-y-3">
            {members.map((member) => (
              <div
                key={member.userId}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="font-medium">
                    {member.firstName || member.lastName
                      ? `${member.firstName || ''} ${member.lastName || ''}`.trim()
                      : member.email}
                  </p>
                  {(member.firstName || member.lastName) && (
                    <p className="text-sm text-gray-500">{member.email}</p>
                  )}
                  {member.invitedBy && (
                    <p className="text-xs text-gray-400 mt-1">
                      Invited by {member.invitedBy.email}
                    </p>
                  )}
                </div>
                <div className="flex items-center space-x-3">
                  {isOwner && member.userId !== user?.id ? (
                    <>
                      <select
                        value={member.role}
                        onChange={(e) =>
                          handleUpdateRole(member.userId, e.target.value as BudgetRole)
                        }
                        className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="owner">Owner</option>
                        <option value="editor">Editor</option>
                        <option value="viewer">Viewer</option>
                      </select>
                      <button
                        onClick={() => handleRemoveMember(member.userId)}
                        className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                      >
                        Remove
                      </button>
                    </>
                  ) : (
                    <span className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded">
                      {member.role}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pending Invitations */}
      {canInvite && invitations.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-4">Pending Invitations ({invitations.length})</h3>
          <div className="space-y-3">
            {invitations.map((invitation) => (
              <div
                key={invitation.id}
                className="flex items-center justify-between p-3 border border-gray-200 rounded-lg"
              >
                <div>
                  <p className="font-medium">{invitation.email}</p>
                  <p className="text-sm text-gray-500">
                    Role: {invitation.role} • Expires:{' '}
                    {new Date(invitation.expiresAt).toLocaleDateString()}
                  </p>
                </div>
                <button
                  onClick={() => handleCancelInvitation(invitation.id)}
                  className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 rounded"
                >
                  Cancel
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Leave Budget */}
      {!isOwner && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold mb-2">Leave Budget</h3>
          <p className="text-sm text-gray-600 mb-4">
            You will no longer have access to this budget and its data.
          </p>
          <button
            onClick={handleLeaveBudget}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Leave Budget
          </button>
        </div>
      )}
      </div>
    </Layout>
  );
}
