import { apiClient } from './api';

export type CasePayload = {
  vk_number: string;
  device_name: string;
  tricia_s: number;
  tricia_p: number;
  tricia_d: number;
  user_s: number;
  user_d?: number;
  validation_status?: string;
};

export async function validateCase(payload: CasePayload) {
  const { data } = await apiClient.post('/cases/validate', payload);
  return data;
}

export async function createCase(payload: CasePayload) {
  const { data } = await apiClient.post('/cases', { ...payload, validation_status: payload.validation_status ?? 'saved' });
  return data;
}

export async function listCases(params?: Record<string, unknown>) {
  const { data } = await apiClient.get('/cases', { params });
  return data;
}

export async function patchCaseReview(caseId: string, payload: Record<string, unknown>) {
  const { data } = await apiClient.patch(`/cases/${caseId}/review`, payload);
  return data;
}
