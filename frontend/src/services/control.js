import { apiClient } from './api';
export async function getControlQueue(params) {
    const { data } = await apiClient.get('/control/queue', { params });
    return data;
}
