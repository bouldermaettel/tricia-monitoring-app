import axios from 'axios';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const SESSION_KEY = 'monitoring.session';
let refreshInFlight: Promise<boolean> | null = null;

function getAuthStorage(): Storage {
  return window.sessionStorage;
}

type RefreshResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  refresh_expires_in: number;
  must_change_password: boolean;
};

type StoredSession = {
  token?: string;
  refreshToken?: string;
  tokenType?: string;
  expiresAt?: number;
  refreshExpiresAt?: number;
  mustChangePassword?: boolean;
};

function readSession(): StoredSession | null {
  const raw = getAuthStorage().getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredSession;
  } catch {
    getAuthStorage().removeItem(SESSION_KEY);
    return null;
  }
}

function writeSessionPatch(patch: Partial<StoredSession>) {
  const current = readSession();
  if (!current) return;
  getAuthStorage().setItem(SESSION_KEY, JSON.stringify({ ...current, ...patch }));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  // Session is now tab-scoped; clear current runtime token state.
  getAuthStorage().removeItem(SESSION_KEY);
}

async function refreshAccessTokenIfPossible(): Promise<boolean> {
  const session = readSession();
  if (!session?.refreshToken || !session?.refreshExpiresAt || Date.now() >= session.refreshExpiresAt) {
    clearSession();
    return false;
  }

  try {
    const { data: refreshed } = await axios.post<RefreshResponse>(`${API_BASE_URL}/auth/refresh`, {
      refresh_token: session.refreshToken,
    });
    writeSessionPatch({
      token: refreshed.access_token,
      refreshToken: refreshed.refresh_token,
      tokenType: refreshed.token_type,
      expiresAt: Date.now() + refreshed.expires_in * 1000,
      refreshExpiresAt: Date.now() + refreshed.refresh_expires_in * 1000,
      mustChangePassword: refreshed.must_change_password,
    });
    return true;
  } catch {
    clearSession();
    return false;
  }
}

async function ensureFreshAccessToken(): Promise<boolean> {
  const session = readSession();
  if (!session) return false;
  if (session.expiresAt && Date.now() < session.expiresAt) return true;

  if (!refreshInFlight) {
    refreshInFlight = refreshAccessTokenIfPossible().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config) => {
  return Promise.resolve().then(async () => {
    await ensureFreshAccessToken();
    const session = readSession();
    if (!session?.token) return config;

    const tokenType = session.tokenType || 'bearer';
    config.headers.Authorization = `${tokenType} ${session.token}`;
    return config;
  });
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config as { _retry?: boolean; url?: string } | undefined;
    const isAuthEndpoint = (originalRequest?.url || '').includes('/auth/session') || (originalRequest?.url || '').includes('/auth/refresh');

    if (status !== 401 || !originalRequest || originalRequest._retry || isAuthEndpoint) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;
    const refreshed = await ensureFreshAccessToken();
    if (!refreshed) {
      return Promise.reject(error);
    }

    return apiClient(originalRequest);
  }
);
