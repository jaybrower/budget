import { apiClient } from './client';
import type {
  Template,
  TemplateListItem,
  CreateTemplateRequest,
  CreateGroupRequest,
  CreateLineItemRequest,
  Group,
  LineItem,
} from '../types/template';

export async function getTemplates(): Promise<TemplateListItem[]> {
  return apiClient<TemplateListItem[]>('/templates');
}

export async function getTemplate(id: string): Promise<Template> {
  return apiClient<Template>(`/templates?id=${id}`);
}

export async function getDefaultTemplate(): Promise<Template> {
  return apiClient<Template>('/templates/default');
}

export async function createTemplate(data: CreateTemplateRequest): Promise<Template> {
  return apiClient<Template>('/templates', {
    method: 'POST',
    body: data,
  });
}

export async function deleteTemplate(templateId: string): Promise<void> {
  await apiClient<void>(`/templates/${templateId}`, {
    method: 'DELETE',
  });
}

export async function addGroup(
  templateId: string,
  data: CreateGroupRequest
): Promise<Group> {
  return apiClient<Group>(`/templates/${templateId}/groups`, {
    method: 'POST',
    body: data,
  });
}

export async function updateGroup(
  templateId: string,
  groupId: string,
  data: Partial<CreateGroupRequest>
): Promise<Group> {
  return apiClient<Group>(`/templates/${templateId}/groups/${groupId}`, {
    method: 'PUT',
    body: data,
  });
}

export async function deleteGroup(
  templateId: string,
  groupId: string
): Promise<void> {
  await apiClient<void>(`/templates/${templateId}/groups/${groupId}`, {
    method: 'DELETE',
  });
}

export async function addLineItem(
  templateId: string,
  groupId: string,
  data: CreateLineItemRequest
): Promise<LineItem> {
  return apiClient<LineItem>(
    `/templates/${templateId}/groups/${groupId}/items`,
    {
      method: 'POST',
      body: data,
    }
  );
}

export async function updateLineItem(
  templateId: string,
  groupId: string,
  itemId: string,
  data: Partial<CreateLineItemRequest>
): Promise<LineItem> {
  return apiClient<LineItem>(
    `/templates/${templateId}/groups/${groupId}/items/${itemId}`,
    {
      method: 'PUT',
      body: data,
    }
  );
}

export async function deleteLineItem(
  templateId: string,
  groupId: string,
  itemId: string
): Promise<void> {
  await apiClient<void>(
    `/templates/${templateId}/groups/${groupId}/items/${itemId}`,
    {
      method: 'DELETE',
    }
  );
}
