import { apiClient } from './api';

export type UserRecord = {
    id: string;
    external_key: string;
    acronym: string;
    display_name: string;
    role: string;
    is_active: boolean;
};

export type UserCreatePayload = {
    external_key: string;
    acronym: string;
    password: string;
    display_name: string;
    role: string;
    is_active: boolean;
};

export type UserUpdatePayload = {
    acronym?: string;
    display_name?: string;
    password?: string;
    role?: string;
    is_active?: boolean;
};

export async function listUsers() {
    const { data } = await apiClient.get<{ items: UserRecord[] }>('/users');
    return data;
}

export async function createUser(payload: UserCreatePayload) {
    const { data } = await apiClient.post<UserRecord>('/users', payload);
    return data;
}

export async function updateUser(userId: string, payload: UserUpdatePayload) {
    const { data } = await apiClient.patch<UserRecord>(`/users/${userId}`, payload);
    return data;
}

export async function deleteUser(userId: string) {
    await apiClient.delete(`/users/${userId}`);
}
