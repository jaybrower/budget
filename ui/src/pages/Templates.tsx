import { useState, useEffect } from 'react';
import { Layout } from '../components/Layout';
import {
  getTemplates,
  getTemplate,
  createTemplate,
  deleteTemplate,
  addGroup,
  updateGroup,
  deleteGroup,
  addLineItem,
  updateLineItem,
  deleteLineItem,
} from '../api/templates';
import type {
  Template,
  TemplateListItem,
  Group,
  LineItem,
} from '../types/template';

export function Templates() {
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [currentTemplate, setCurrentTemplate] = useState<Template | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  // Form states for creating new template
  const [newTemplateName, setNewTemplateName] = useState('');
  const [newTemplateBaseIncome, setNewTemplateBaseIncome] = useState('');
  const [newTemplateDescription, setNewTemplateDescription] = useState('');
  const [newTemplateIsDefault, setNewTemplateIsDefault] = useState(false);

  // Form states for adding new group
  const [newGroupName, setNewGroupName] = useState('');
  const [addingGroupToTemplate, setAddingGroupToTemplate] = useState(false);

  // Form states for adding new line item
  const [addingItemToGroup, setAddingItemToGroup] = useState<string | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [newItemAmount, setNewItemAmount] = useState('');
  const [newItemIsRollover, setNewItemIsRollover] = useState(false);

  // Load templates on mount
  useEffect(() => {
    loadTemplates();
  }, []);

  // Load selected template when selection changes
  useEffect(() => {
    if (selectedTemplateId) {
      loadTemplate(selectedTemplateId);
    } else {
      setCurrentTemplate(null);
    }
  }, [selectedTemplateId]);

  async function loadTemplates() {
    try {
      setIsLoading(true);
      const data = await getTemplates();
      setTemplates(data);

      // Select default template if exists
      const defaultTemplate = data.find(t => t.isDefault);
      if (defaultTemplate) {
        setSelectedTemplateId(defaultTemplate.id);
      } else if (data.length > 0) {
        setSelectedTemplateId(data[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load templates');
    } finally {
      setIsLoading(false);
    }
  }

  async function loadTemplate(id: string) {
    try {
      const data = await getTemplate(id);
      setCurrentTemplate(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load template');
    }
  }

  async function handleCreateTemplate(e: React.FormEvent) {
    e.preventDefault();
    try {
      const template = await createTemplate({
        name: newTemplateName,
        baseIncome: parseFloat(newTemplateBaseIncome),
        description: newTemplateDescription || undefined,
        isDefault: newTemplateIsDefault,
      });

      setTemplates([...templates, template]);
      setSelectedTemplateId(template.id);
      setIsCreating(false);
      setNewTemplateName('');
      setNewTemplateBaseIncome('');
      setNewTemplateDescription('');
      setNewTemplateIsDefault(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create template');
    }
  }

  async function handleDeleteTemplate() {
    if (!currentTemplate) return;

    if (!confirm('Are you sure you want to delete this template?')) return;

    try {
      await deleteTemplate(currentTemplate.id);
      const newTemplates = templates.filter(t => t.id !== currentTemplate.id);
      setTemplates(newTemplates);
      setSelectedTemplateId(newTemplates[0]?.id || '');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete template');
    }
  }

  async function handleAddGroup(e: React.FormEvent) {
    e.preventDefault();
    if (!currentTemplate) return;

    try {
      await addGroup(currentTemplate.id, { name: newGroupName });
      await loadTemplate(currentTemplate.id);
      setNewGroupName('');
      setAddingGroupToTemplate(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add group');
    }
  }

  async function handleDeleteGroup(groupId: string) {
    if (!currentTemplate) return;

    if (!confirm('Are you sure you want to delete this group?')) return;

    try {
      await deleteGroup(currentTemplate.id, groupId);
      await loadTemplate(currentTemplate.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete group');
    }
  }

  async function handleAddLineItem(e: React.FormEvent, groupId: string) {
    e.preventDefault();
    if (!currentTemplate) return;

    try {
      await addLineItem(currentTemplate.id, groupId, {
        name: newItemName,
        budgetedAmount: parseFloat(newItemAmount),
        isRollover: newItemIsRollover,
      });
      await loadTemplate(currentTemplate.id);
      setNewItemName('');
      setNewItemAmount('');
      setNewItemIsRollover(false);
      setAddingItemToGroup(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add line item');
    }
  }

  async function handleDeleteLineItem(groupId: string, itemId: string) {
    if (!currentTemplate) return;

    try {
      await deleteLineItem(currentTemplate.id, groupId, itemId);
      await loadTemplate(currentTemplate.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete line item');
    }
  }

  async function handleUpdateGroup(groupId: string, name: string) {
    if (!currentTemplate) return;

    try {
      await updateGroup(currentTemplate.id, groupId, { name });
      await loadTemplate(currentTemplate.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update group');
    }
  }

  async function handleUpdateLineItem(
    groupId: string,
    itemId: string,
    data: { name?: string; budgetedAmount?: number; isRollover?: boolean }
  ) {
    if (!currentTemplate) return;

    try {
      await updateLineItem(currentTemplate.id, groupId, itemId, data);
      await loadTemplate(currentTemplate.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update line item');
    }
  }

  if (isLoading) {
    return (
      <Layout>
        <div className="bg-white shadow rounded-lg p-6">
          <p className="text-gray-500">Loading templates...</p>
        </div>
      </Layout>
    );
  }

  // No templates - show create button
  if (templates.length === 0 && !isCreating) {
    return (
      <Layout>
        <div className="bg-white shadow rounded-lg p-6 text-center">
          <h2 className="text-lg font-medium text-gray-900 mb-4">No Templates</h2>
          <p className="text-gray-500 mb-4">Create your first budget template to get started.</p>
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Create Template
          </button>
        </div>
      </Layout>
    );
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

      {/* Template selector and create button */}
      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <label htmlFor="template-select" className="text-sm font-medium text-gray-700">
              Select Template:
            </label>
            <select
              id="template-select"
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
          </div>
          <button
            onClick={() => setIsCreating(true)}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
          >
            New Template
          </button>
        </div>
      </div>

      {/* Create template form */}
      {isCreating && (
        <div className="bg-white shadow rounded-lg p-6 mb-6">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Template</h3>
          <form onSubmit={handleCreateTemplate} className="space-y-4">
            <div>
              <label htmlFor="template-name" className="block text-sm font-medium text-gray-700">
                Name
              </label>
              <input
                type="text"
                id="template-name"
                value={newTemplateName}
                onChange={(e) => setNewTemplateName(e.target.value)}
                required
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="template-income" className="block text-sm font-medium text-gray-700">
                Base Income
              </label>
              <input
                type="number"
                id="template-income"
                value={newTemplateBaseIncome}
                onChange={(e) => setNewTemplateBaseIncome(e.target.value)}
                required
                min="0"
                step="0.01"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div>
              <label htmlFor="template-description" className="block text-sm font-medium text-gray-700">
                Description (optional)
              </label>
              <input
                type="text"
                id="template-description"
                value={newTemplateDescription}
                onChange={(e) => setNewTemplateDescription(e.target.value)}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div className="flex items-center">
              <input
                type="checkbox"
                id="template-default"
                checked={newTemplateIsDefault}
                onChange={(e) => setNewTemplateIsDefault(e.target.checked)}
                className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
              />
              <label htmlFor="template-default" className="ml-2 block text-sm text-gray-900">
                Set as default template
              </label>
            </div>
            <div className="flex space-x-3">
              <button
                type="submit"
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
              >
                Create
              </button>
              <button
                type="button"
                onClick={() => setIsCreating(false)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Current template editor */}
      {currentTemplate && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-medium text-gray-900">{currentTemplate.name}</h2>
              {currentTemplate.description && (
                <p className="text-sm text-gray-500">{currentTemplate.description}</p>
              )}
              <p className="text-sm text-gray-600 mt-1">
                Base Income: ${parseFloat(currentTemplate.baseIncome).toLocaleString()}
                {currentTemplate.isDefault && (
                  <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                    Default
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={handleDeleteTemplate}
              className="inline-flex items-center px-3 py-1.5 border border-red-300 text-sm font-medium rounded-md text-red-700 bg-white hover:bg-red-50"
            >
              Delete Template
            </button>
          </div>

          {/* Groups */}
          <div className="space-y-6">
            {currentTemplate.groups?.map((group) => (
              <GroupEditor
                key={group.id}
                group={group}
                onDeleteGroup={() => handleDeleteGroup(group.id)}
                onUpdateGroup={(name) => handleUpdateGroup(group.id, name)}
                onAddItem={(e) => handleAddLineItem(e, group.id)}
                onDeleteItem={(itemId) => handleDeleteLineItem(group.id, itemId)}
                onUpdateItem={(itemId, data) => handleUpdateLineItem(group.id, itemId, data)}
                isAddingItem={addingItemToGroup === group.id}
                setIsAddingItem={(val) => setAddingItemToGroup(val ? group.id : null)}
                newItemName={newItemName}
                setNewItemName={setNewItemName}
                newItemAmount={newItemAmount}
                setNewItemAmount={setNewItemAmount}
                newItemIsRollover={newItemIsRollover}
                setNewItemIsRollover={setNewItemIsRollover}
              />
            ))}

            {/* Add group form */}
            {addingGroupToTemplate ? (
              <form onSubmit={handleAddGroup} className="border-2 border-dashed border-gray-300 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <input
                    type="text"
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    placeholder="Group name"
                    required
                    className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                  />
                  <button
                    type="submit"
                    className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                  >
                    Add
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAddingGroupToTemplate(false);
                      setNewGroupName('');
                    }}
                    className="inline-flex items-center px-3 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button
                onClick={() => setAddingGroupToTemplate(true)}
                className="w-full border-2 border-dashed border-gray-300 rounded-lg p-4 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700"
              >
                + Add Group
              </button>
            )}

            {/* Template totals */}
            {currentTemplate.groups && currentTemplate.groups.length > 0 && (
              <div className="border-t-2 border-gray-300 pt-4 mt-6">
                {(() => {
                  const totalBudgeted = currentTemplate.groups.reduce(
                    (total, group) =>
                      total +
                      group.lineItems.reduce(
                        (groupTotal, item) => groupTotal + parseFloat(item.budgetedAmount),
                        0
                      ),
                    0
                  );
                  const baseIncome = parseFloat(currentTemplate.baseIncome);
                  const remaining = baseIncome - totalBudgeted;

                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">Total Budgeted</span>
                        <span className="text-sm font-medium text-gray-900">
                          ${totalBudgeted.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-900">Base Income</span>
                        <span className="text-sm font-medium text-gray-900">
                          ${baseIncome.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-gray-200">
                        <span className="text-sm font-semibold text-gray-900">Remaining</span>
                        <span
                          className={`text-sm font-semibold ${
                            remaining >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          ${remaining.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

interface GroupEditorProps {
  group: Group;
  onDeleteGroup: () => void;
  onUpdateGroup: (name: string) => void;
  onAddItem: (e: React.FormEvent) => void;
  onDeleteItem: (itemId: string) => void;
  onUpdateItem: (itemId: string, data: { name?: string; budgetedAmount?: number; isRollover?: boolean }) => void;
  isAddingItem: boolean;
  setIsAddingItem: (val: boolean) => void;
  newItemName: string;
  setNewItemName: (val: string) => void;
  newItemAmount: string;
  setNewItemAmount: (val: string) => void;
  newItemIsRollover: boolean;
  setNewItemIsRollover: (val: boolean) => void;
}

function GroupEditor({
  group,
  onDeleteGroup,
  onUpdateGroup,
  onAddItem,
  onDeleteItem,
  onUpdateItem,
  isAddingItem,
  setIsAddingItem,
  newItemName,
  setNewItemName,
  newItemAmount,
  setNewItemAmount,
  newItemIsRollover,
  setNewItemIsRollover,
}: GroupEditorProps) {
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(group.name);

  const handleSaveName = () => {
    if (editName.trim() && editName !== group.name) {
      onUpdateGroup(editName.trim());
    }
    setIsEditingName(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveName();
    } else if (e.key === 'Escape') {
      setEditName(group.name);
      setIsEditingName(false);
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg">
      <div className="bg-gray-50 px-4 py-3 flex items-center justify-between rounded-t-lg">
        {isEditingName ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveName}
            onKeyDown={handleKeyDown}
            autoFocus
            className="text-sm font-medium text-gray-900 rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        ) : (
          <h3
            className="text-sm font-medium text-gray-900 cursor-pointer hover:text-indigo-600"
            onClick={() => setIsEditingName(true)}
            title="Click to edit"
          >
            {group.name}
          </h3>
        )}
        <button
          onClick={onDeleteGroup}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Delete
        </button>
      </div>
      <div className="p-4 space-y-3">
        {group.lineItems.map((item) => (
          <LineItemRow
            key={item.id}
            item={item}
            onDelete={() => onDeleteItem(item.id)}
            onUpdate={(data) => onUpdateItem(item.id, data)}
          />
        ))}

        {/* Group total */}
        {group.lineItems.length > 0 && (
          <div className="flex items-center justify-between py-2 border-t border-gray-200 mt-2 pt-3">
            <span className="text-sm font-medium text-gray-900">Group Total</span>
            <span className="text-sm font-medium text-gray-900">
              ${group.lineItems
                .reduce((sum, item) => sum + parseFloat(item.budgetedAmount), 0)
                .toLocaleString()}
            </span>
          </div>
        )}

        {/* Add line item form */}
        {isAddingItem ? (
          <form onSubmit={onAddItem} className="space-y-3 pt-3 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                value={newItemName}
                onChange={(e) => setNewItemName(e.target.value)}
                placeholder="Item name"
                required
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
              <input
                type="number"
                value={newItemAmount}
                onChange={(e) => setNewItemAmount(e.target.value)}
                placeholder="Amount"
                required
                min="0"
                step="0.01"
                className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
              />
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  id={`rollover-${group.id}`}
                  checked={newItemIsRollover}
                  onChange={(e) => setNewItemIsRollover(e.target.checked)}
                  className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                />
                <label htmlFor={`rollover-${group.id}`} className="ml-2 block text-sm text-gray-900">
                  Rollover
                </label>
              </div>
              <div className="flex space-x-2">
                <button
                  type="submit"
                  className="inline-flex items-center px-3 py-1.5 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingItem(false);
                    setNewItemName('');
                    setNewItemAmount('');
                    setNewItemIsRollover(false);
                  }}
                  className="inline-flex items-center px-3 py-1.5 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setIsAddingItem(true)}
            className="w-full text-left text-sm text-indigo-600 hover:text-indigo-800 pt-2"
          >
            + Add Line Item
          </button>
        )}
      </div>
    </div>
  );
}

interface LineItemRowProps {
  item: LineItem;
  onDelete: () => void;
  onUpdate: (data: { name?: string; budgetedAmount?: number; isRollover?: boolean }) => void;
}

function LineItemRow({ item, onDelete, onUpdate }: LineItemRowProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(item.name);
  const [editAmount, setEditAmount] = useState(item.budgetedAmount);
  const [editIsRollover, setEditIsRollover] = useState(item.isRollover);

  const handleSave = () => {
    const updates: { name?: string; budgetedAmount?: number; isRollover?: boolean } = {};

    if (editName.trim() !== item.name) {
      updates.name = editName.trim();
    }
    if (parseFloat(editAmount) !== parseFloat(item.budgetedAmount)) {
      updates.budgetedAmount = parseFloat(editAmount);
    }
    if (editIsRollover !== item.isRollover) {
      updates.isRollover = editIsRollover;
    }

    if (Object.keys(updates).length > 0) {
      onUpdate(updates);
    }
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditName(item.name);
    setEditAmount(item.budgetedAmount);
    setEditIsRollover(item.isRollover);
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      handleCancel();
    }
  };

  if (isEditing) {
    return (
      <div className="py-2 border-b border-gray-100 last:border-b-0 space-y-2">
        <div className="grid grid-cols-2 gap-3">
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
          <input
            type="number"
            value={editAmount}
            onChange={(e) => setEditAmount(e.target.value)}
            onKeyDown={handleKeyDown}
            min="0"
            step="0.01"
            className="rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
          />
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <input
              type="checkbox"
              id={`edit-rollover-${item.id}`}
              checked={editIsRollover}
              onChange={(e) => setEditIsRollover(e.target.checked)}
              className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
            />
            <label htmlFor={`edit-rollover-${item.id}`} className="ml-2 block text-sm text-gray-900">
              Rollover
            </label>
          </div>
          <div className="flex space-x-2">
            <button
              onClick={handleSave}
              className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded shadow-sm text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Save
            </button>
            <button
              onClick={handleCancel}
              className="inline-flex items-center px-2 py-1 border border-gray-300 text-xs font-medium rounded shadow-sm text-gray-700 bg-white hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-b-0">
      <div className="flex-1">
        <span
          className="text-sm text-gray-900 cursor-pointer hover:text-indigo-600"
          onClick={() => setIsEditing(true)}
          title="Click to edit"
        >
          {item.name}
        </span>
        {item.isRollover && (
          <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
            Rollover
          </span>
        )}
      </div>
      <div className="flex items-center space-x-4">
        <span
          className="text-sm text-gray-600 cursor-pointer hover:text-indigo-600"
          onClick={() => setIsEditing(true)}
          title="Click to edit"
        >
          ${parseFloat(item.budgetedAmount).toLocaleString()}
        </span>
        <button
          onClick={onDelete}
          className="text-sm text-red-600 hover:text-red-800"
        >
          Remove
        </button>
      </div>
    </div>
  );
}
