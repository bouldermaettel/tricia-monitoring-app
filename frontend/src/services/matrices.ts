import { apiClient } from './api';

export async function getConfusionMatrix(params?: Record<string, unknown>) {
    const { data } = await apiClient.get('/matrices/confusion', { params });
    return data;
}
