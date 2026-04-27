import { apiClient } from './api';

export type AuthSession = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
  actor_id: string;
  external_key: string;
  acronym?: string;
  display_name: string;
  role: string;
  must_change_password: boolean;
  is_active: boolean;
};

export async function createSession(username: string, password: string) {
  const { data } = await apiClient.post<AuthSession>('/auth/session', {
    username,
    password,
  });
  return data;
}

export async function refreshSession(refreshToken: string) {
  const { data } = await apiClient.post<AuthSession>('/auth/refresh', {
    refresh_token: refreshToken,
  });
  return data;
}

export async function changePassword(currentPassword: string, newPassword: string) {
  const { data } = await apiClient.post<AuthSession>('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return data;
}
