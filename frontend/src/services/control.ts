import { apiClient } from './api';

export async function getControlQueue(params?: Record<string, unknown>) {
  const { data } = await apiClient.get('/control/queue', { params });
  return data;
}
