import { apiClient } from './api';
export async function createSession(username, password) {
    const { data } = await apiClient.post('/auth/session', {
        username,
        password,
    });
    return data;
}
export async function refreshSession(refreshToken) {
    const { data } = await apiClient.post('/auth/refresh', {
        refresh_token: refreshToken,
    });
    return data;
}
