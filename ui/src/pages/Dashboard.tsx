import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Layout } from '../components/Layout';
import { getSheetByDate, createSheet, getSyncStatus, syncSheet, updateSheet } from '../api/sheets';
import { getTemplates } from '../api/templates';
import type { BudgetSheet, SyncStatusResponse } from '../types/sheet';
import type { TemplateListItem } from '../types/template';

export function Dashboard() {
  const navigate = useNavigate();
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [sheet, setSheet] = useState<BudgetSheet | null>(null);
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatusResponse | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const isCurrentMonth = selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1;

  useEffect(() => {
    loadData();
  }, [selectedYear, selectedMonth]);

  async function loadData() {
    setIsLoading(true);
    setError(null);
    setNotFound(false);
    setSheet(null);
    setSyncStatus(null);

    try {
      const sheetData = await getSheetByDate(selectedYear, selectedMonth);
      setSheet(sheetData);

      // Check sync status if sheet has a template
      if (sheetData.templateId) {
        try {
          const status = await getSyncStatus(sheetData.id);
          setSyncStatus(status);
        } catch {
          // Ignore sync status errors
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('No budget sheet found')) {
        setNotFound(true);
        // Load templates for creation option (only for current month)
        if (isCurrentMonth) {
          try {
            const templatesData = await getTemplates();
            setTemplates(templatesData);
            const defaultTemplate = templatesData.find(t => t.isDefault);
            setSelectedTemplateId(defaultTemplate?.id || templatesData[0]?.id || '');
          } catch {
            // Ignore template load errors
          }
        }
      } else {
        setError(err instanceof Error ? err.message : 'Failed to load budget');
      }
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSync() {
    if (!sheet) return;

    try {
      setIsSyncing(true);
      const result = await syncSheet(sheet.id);
      setSheet(result.sheet);
      setSyncStatus(null); // Clear sync status after successful sync

      // Show success message with stats
      const { groupsAdded, itemsAdded } = result.syncStats;
      if (groupsAdded > 0 || itemsAdded > 0) {
        // Could add a toast notification here
        console.log(`Synced: ${groupsAdded} groups and ${itemsAdded} items added`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to sync with template');
    } finally {
      setIsSyncing(false);
    }
  }

  async function handleCreateBudget() {
    if (!selectedTemplateId) return;

    try {
      setIsLoading(true);
      const newSheet = await createSheet({
        templateId: selectedTemplateId,
        year: selectedYear,
        month: selectedMonth,
        carryOverRollovers: true,
      });
      setSheet(newSheet);
      setNotFound(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create budget');
    } finally {
      setIsLoading(false);
    }
  }

  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const years = [];
  for (let y = now.getFullYear() - 5; y <= now.getFullYear() + 1; y++) {
    years.push(y);
  }

  return (
    <Layout>
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
          <p className="text-sm text-red-600">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-sm text-red-500 underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Month/Year selector */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex items-center space-x-4">
          <label className="text-sm font-medium text-gray-700">View Budget:</label>
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {months.map((month, index) => (
              <option key={month} value={index + 1}>
                {month}
              </option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          >
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-500">Loading...</p>
        </div>
      ) : notFound ? (
        <div className="bg-white shadow rounded-lg p-6">
          {isCurrentMonth ? (
            templates.length > 0 ? (
              <div className="text-center">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  No Budget for {months[selectedMonth - 1]} {selectedYear}
                </h2>
                <p className="text-gray-500 mb-6">
                  Create a budget from a template to get started.
                </p>
                <div className="flex items-center justify-center space-x-4">
                  <select
                    value={selectedTemplateId}
                    onChange={(e) => setSelectedTemplateId(e.target.value)}
                    className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  >
                    {templates.map((template) => (
                      <option key={template.id} value={template.id}>
                        {template.name} {template.isDefault ? '(Default)' : ''}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleCreateBudget}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Create Budget
                  </button>
                </div>
              </div>
            ) : (
              <div className="text-center">
                <h2 className="text-lg font-medium text-gray-900 mb-4">
                  No Templates Available
                </h2>
                <p className="text-gray-500 mb-6">
                  You need to create a template before you can create a budget.
                </p>
                <button
                  onClick={() => navigate('/templates')}
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Go to Templates
                </button>
              </div>
            )
          ) : (
            <div className="text-center">
              <h2 className="text-lg font-medium text-gray-900 mb-4">
                No Budget Found
              </h2>
              <p className="text-gray-500">
                No budget exists for {months[selectedMonth - 1]} {selectedYear}.
              </p>
            </div>
          )}
        </div>
      ) : sheet ? (
        <BudgetDisplay
          sheet={sheet}
          syncStatus={syncStatus}
          isSyncing={isSyncing}
          onSync={handleSync}
          onSheetUpdate={setSheet}
        />
      ) : null}
    </Layout>
  );
}

interface BudgetDisplayProps {
  sheet: BudgetSheet;
  syncStatus: SyncStatusResponse | null;
  isSyncing: boolean;
  onSync: () => void;
  onSheetUpdate: (sheet: BudgetSheet) => void;
}

function BudgetDisplay({ sheet, syncStatus, isSyncing, onSync, onSheetUpdate }: BudgetDisplayProps) {
  const [isEditingIncome, setIsEditingIncome] = useState(false);
  const [additionalIncomeValue, setAdditionalIncomeValue] = useState(parseFloat(sheet.additionalIncome).toString());
  const [isSaving, setIsSaving] = useState(false);

  const totalIncome = typeof sheet.totalIncome === 'string'
    ? parseFloat(sheet.totalIncome)
    : sheet.totalIncome;

  const baseIncome = parseFloat(sheet.baseIncome);
  const additionalIncome = parseFloat(sheet.additionalIncome);
  const rolledOverIncome = parseFloat(sheet.rolledOverIncome);

  async function handleSaveAdditionalIncome() {
    const newValue = parseFloat(additionalIncomeValue);
    if (isNaN(newValue) || newValue < 0) {
      return;
    }

    try {
      setIsSaving(true);
      const updatedSheet = await updateSheet(sheet.id, { additionalIncome: newValue });
      onSheetUpdate(updatedSheet);
      setIsEditingIncome(false);
    } catch (err) {
      console.error('Failed to update additional income:', err);
    } finally {
      setIsSaving(false);
    }
  }

  function handleCancelEdit() {
    setAdditionalIncomeValue(parseFloat(sheet.additionalIncome).toString());
    setIsEditingIncome(false);
  }

  return (
    <div className="space-y-6">
      {/* Sync Warning */}
      {syncStatus && !syncStatus.isSynced && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <svg className="h-5 w-5 text-yellow-400 mr-3" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              <div>
                <p className="text-sm font-medium text-yellow-800">
                  Template has been updated
                </p>
                <p className="text-sm text-yellow-700">
                  The template was modified after this budget was created. Sync to add new groups or items.
                </p>
              </div>
            </div>
            <button
              onClick={onSync}
              disabled={isSyncing}
              className="ml-4 inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md text-yellow-800 bg-yellow-100 hover:bg-yellow-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500 disabled:opacity-50"
            >
              {isSyncing ? 'Syncing...' : 'Sync Now'}
            </button>
          </div>
        </div>
      )}

      {/* Summary */}
      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">{sheet.name}</h2>

        {/* Income Breakdown */}
        <div className="mb-6 p-4 bg-blue-50 rounded-lg">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Income Breakdown</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Base Income (from template)</span>
              <span className="font-medium">${baseIncome.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Additional Income</span>
              {isEditingIncome ? (
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">$</span>
                  <input
                    type="number"
                    value={additionalIncomeValue}
                    onChange={(e) => setAdditionalIncomeValue(e.target.value)}
                    className="w-24 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    min="0"
                    step="0.01"
                  />
                  <button
                    onClick={handleSaveAdditionalIncome}
                    disabled={isSaving}
                    className="px-2 py-1 text-xs font-medium text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {isSaving ? '...' : 'Save'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    disabled={isSaving}
                    className="px-2 py-1 text-xs font-medium text-gray-600 bg-gray-200 rounded hover:bg-gray-300 disabled:opacity-50"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2">
                  <span className="font-medium">${additionalIncome.toLocaleString()}</span>
                  <button
                    onClick={() => setIsEditingIncome(true)}
                    className="text-indigo-600 hover:text-indigo-800 text-xs"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>
            {rolledOverIncome > 0 && (
              <div className="flex justify-between">
                <span className="text-gray-600">Rolled Over Income</span>
                <span className="font-medium">${rolledOverIncome.toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-blue-200">
              <span className="font-medium text-gray-700">Total Income</span>
              <span className="font-semibold text-gray-900">${totalIncome.toLocaleString()}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <dt className="text-sm font-medium text-gray-500">Total Income</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">
              ${totalIncome.toLocaleString()}
            </dd>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <dt className="text-sm font-medium text-gray-500">Total Budgeted</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">
              ${parseFloat(sheet.totalBudgeted).toLocaleString()}
            </dd>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <dt className="text-sm font-medium text-gray-500">Total Actual</dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900">
              ${parseFloat(sheet.totalActual).toLocaleString()}
            </dd>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <dt className="text-sm font-medium text-gray-500">Remaining</dt>
            <dd className={`mt-1 text-lg font-semibold ${
              parseFloat(sheet.actualRemaining) >= 0 ? 'text-green-600' : 'text-red-600'
            }`}>
              ${parseFloat(sheet.actualRemaining).toLocaleString()}
            </dd>
          </div>
        </div>
      </div>

      {/* Groups */}
      {sheet.groups.map((group) => (
        <div key={group.id} className="bg-white shadow rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-gray-900">{group.name}</h3>
              <div className="text-sm text-gray-500">
                ${group.totalActual.toLocaleString()} / ${group.totalBudgeted.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="divide-y divide-gray-200">
            {group.lineItems.map((item) => (
              <div key={item.id} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <span className="text-sm font-medium text-gray-900">{item.name}</span>
                    {item.isRollover && (
                      <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                        Rollover
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-8 text-sm">
                    <div className="text-gray-500">
                      Budgeted: ${parseFloat(item.budgetedAmount).toLocaleString()}
                    </div>
                    <div className={`font-medium ${
                      parseFloat(item.actualAmount) <= parseFloat(item.budgetedAmount)
                        ? 'text-gray-900'
                        : 'text-red-600'
                    }`}>
                      Actual: ${parseFloat(item.actualAmount).toLocaleString()}
                    </div>
                  </div>
                </div>
                {item.isRollover && parseFloat(item.rolledOverAmount) !== 0 && (
                  <div className="mt-1 text-xs text-gray-500">
                    Rolled over: ${parseFloat(item.rolledOverAmount).toLocaleString()}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
