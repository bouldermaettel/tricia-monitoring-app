import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext, useMemo, useState } from 'react';
import { createSession } from '../services/auth';
const SESSION_KEY = 'monitoring.session';
function readStoredSession() {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw)
        return null;
    try {
        const parsed = JSON.parse(raw);
        if (!parsed.actorId || !parsed.role || !parsed.token || !parsed.expiresAt || !parsed.refreshToken || !parsed.refreshExpiresAt) {
            return null;
        }
        if (Date.now() >= parsed.refreshExpiresAt) {
            localStorage.removeItem(SESSION_KEY);
            return null;
        }
        return parsed;
    }
    catch {
        return null;
    }
}
const AuthContext = createContext(null);
export function AuthProvider({ children }) {
    const [session, setSession] = useState(() => readStoredSession());
    const value = useMemo(() => ({
        session,
        signIn: async (username, password) => {
            const actor = await createSession(username.trim(), password);
            const nextSession = {
                token: actor.access_token,
                refreshToken: actor.refresh_token,
                tokenType: actor.token_type,
                expiresAt: Date.now() + actor.expires_in * 1000,
                refreshExpiresAt: Date.now() + actor.refresh_expires_in * 1000,
                actorId: actor.actor_id,
                externalKey: actor.external_key,
                displayName: actor.display_name,
                role: actor.role,
            };
            localStorage.setItem(SESSION_KEY, JSON.stringify(nextSession));
            setSession(nextSession);
        },
        signOut: () => {
            localStorage.removeItem(SESSION_KEY);
            setSession(null);
        },
    }), [session]);
    return _jsx(AuthContext.Provider, { value: value, children: children });
}
export function useAuth() {
    const context = useContext(AuthContext);
    if (!context) {
        return {
            session: null,
            signIn: async () => {
                throw new Error('Authentication provider missing');
            },
            signOut: () => {
                return;
            },
        };
    }
    return context;
}
