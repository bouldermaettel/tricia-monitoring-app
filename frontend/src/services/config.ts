import { apiClient } from './api';

export async function getThresholds() {
  const { data } = await apiClient.get('/config/thresholds');
  return data;
}

export async function updateThresholds(payload: Record<string, unknown>) {
  const { data } = await apiClient.put('/config/thresholds', payload);
  return data;
}
