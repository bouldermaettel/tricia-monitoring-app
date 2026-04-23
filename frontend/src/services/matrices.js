import { apiClient } from './api';
export async function getConfusionMatrix(params) {
    const { data } = await apiClient.get('/matrices/confusion', { params });
    return data;
}
