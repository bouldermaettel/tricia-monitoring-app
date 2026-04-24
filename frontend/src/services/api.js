import axios from 'axios';
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';
const SESSION_KEY = 'monitoring.session';
let refreshInFlight = null;
function getAuthStorage() {
    return window.sessionStorage;
}
function readSession() {
    const raw = getAuthStorage().getItem(SESSION_KEY);
    if (!raw)
        return null;
    try {
        return JSON.parse(raw);
    }
    catch {
        getAuthStorage().removeItem(SESSION_KEY);
        return null;
    }
}
function writeSessionPatch(patch) {
    const current = readSession();
    if (!current)
        return;
    getAuthStorage().setItem(SESSION_KEY, JSON.stringify({ ...current, ...patch }));
}
function clearSession() {
    localStorage.removeItem(SESSION_KEY);
    // Session is now tab-scoped; clear current runtime token state.
    getAuthStorage().removeItem(SESSION_KEY);
}
async function refreshAccessTokenIfPossible() {
    const session = readSession();
    if (!session?.refreshToken || !session?.refreshExpiresAt || Date.now() >= session.refreshExpiresAt) {
        clearSession();
        return false;
    }
    try {
        const { data: refreshed } = await axios.post(`${API_BASE_URL}/auth/refresh`, {
            refresh_token: session.refreshToken,
        });
        writeSessionPatch({
            token: refreshed.access_token,
            refreshToken: refreshed.refresh_token,
            tokenType: refreshed.token_type,
            expiresAt: Date.now() + refreshed.expires_in * 1000,
            refreshExpiresAt: Date.now() + refreshed.refresh_expires_in * 1000,
        });
        return true;
    }
    catch {
        clearSession();
        return false;
    }
}
async function ensureFreshAccessToken() {
    const session = readSession();
    if (!session)
        return false;
    if (session.expiresAt && Date.now() < session.expiresAt)
        return true;
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
        if (!session?.token)
            return config;
        const tokenType = session.tokenType || 'bearer';
        config.headers.Authorization = `${tokenType} ${session.token}`;
        return config;
    });
});
apiClient.interceptors.response.use((response) => response, async (error) => {
    const status = error?.response?.status;
    const originalRequest = error?.config;
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
});
