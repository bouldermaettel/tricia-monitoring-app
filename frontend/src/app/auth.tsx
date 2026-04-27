import { createContext, PropsWithChildren, useContext, useMemo, useState } from 'react';
import { createSession } from '../services/auth';

export type AppSession = {
  token: string;
  refreshToken: string;
  tokenType: string;
  expiresAt: number;
  refreshExpiresAt: number;
  actorId: string;
  externalKey: string;
  acronym?: string;
  displayName: string;
  role: string;
  mustChangePassword: boolean;
};

const SESSION_KEY = 'monitoring.session';

function getAuthStorage(): Storage {
  return window.sessionStorage;
}

function readStoredSession(): AppSession | null {
  // Remove legacy persisted sessions so a fresh browser session requires login.
  localStorage.removeItem(SESSION_KEY);

  const raw = getAuthStorage().getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AppSession;
    if (!parsed.actorId || !parsed.role || !parsed.token || !parsed.expiresAt || !parsed.refreshToken || !parsed.refreshExpiresAt) {
      return null;
    }
    if (Date.now() >= parsed.refreshExpiresAt) {
      getAuthStorage().removeItem(SESSION_KEY);
      return null;
    }
    return {
      ...parsed,
      mustChangePassword: Boolean(parsed.mustChangePassword),
    };
  } catch {
    return null;
  }
}

type AuthContextValue = {
  session: AppSession | null;
  signIn: (username: string, password: string) => Promise<AppSession>;
  updateSession: (nextSession: AppSession) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AppSession | null>(() => readStoredSession());

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      signIn: async (username: string, password: string) => {
        const actor = await createSession(username.trim(), password);
        const nextSession: AppSession = {
          token: actor.access_token,
          refreshToken: actor.refresh_token,
          tokenType: actor.token_type,
          expiresAt: Date.now() + actor.expires_in * 1000,
          refreshExpiresAt: Date.now() + actor.refresh_expires_in * 1000,
          actorId: actor.actor_id,
          externalKey: actor.external_key,
          acronym: actor.acronym,
          displayName: actor.display_name,
          role: actor.role,
          mustChangePassword: actor.must_change_password,
        };
        getAuthStorage().setItem(SESSION_KEY, JSON.stringify(nextSession));
        setSession(nextSession);
        return nextSession;
      },
      updateSession: (nextSession: AppSession) => {
        getAuthStorage().setItem(SESSION_KEY, JSON.stringify(nextSession));
        setSession(nextSession);
      },
      signOut: () => {
        localStorage.removeItem(SESSION_KEY);
        getAuthStorage().removeItem(SESSION_KEY);
        setSession(null);
      },
    }),
    [session]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    return {
      session: null,
      signIn: async (): Promise<AppSession> => {
        throw new Error('Authentication provider missing');
      },
      updateSession: () => {
        return;
      },
      signOut: () => {
        return;
      },
    };
  }
  return context;
}
