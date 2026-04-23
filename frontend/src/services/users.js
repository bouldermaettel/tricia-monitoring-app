import { apiClient } from './api';
export async function listUsers() {
    const { data } = await apiClient.get('/users');
    return data;
}
export async function createUser(payload) {
    const { data } = await apiClient.post('/users', payload);
    return data;
}
export async function updateUser(userId, payload) {
    const { data } = await apiClient.patch(`/users/${userId}`, payload);
    return data;
}
export async function deleteUser(userId) {
    await apiClient.delete(`/users/${userId}`);
}
