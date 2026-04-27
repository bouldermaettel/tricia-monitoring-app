import { FormEvent, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '../app/auth';

function getDefaultRoute(session: { role: string; mustChangePassword: boolean }): string {
  if (session.mustChangePassword) return '/change-password';
  return session.role === 'admin' ? '/users' : '/input';
}

export function LoginPage() {
  const navigate = useNavigate();
  const { session, signIn } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (session) {
    return <Navigate to={getDefaultRoute(session)} replace />;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const nextSession = await signIn(username, password);
      navigate(getDefaultRoute(nextSession), { replace: true });
    } catch (err) {
      if (isAxiosError(err)) {
        const apiMessage =
          (err.response?.data as { error?: { message?: string }; detail?: string } | undefined)?.error?.message ??
          (err.response?.data as { detail?: string } | undefined)?.detail;

        if (apiMessage) {
          setError(apiMessage);
        } else if (err.response?.status === 500) {
          setError('Server error during sign in. Please ensure the backend API is running on port 8000.');
        } else if (err.code === 'ERR_NETWORK') {
          setError('Cannot reach backend API. Please start the backend service and try again.');
        } else {
          setError(err.message);
        }
      } else {
        setError(err instanceof Error ? err.message : 'Login failed');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-stone-50 flex items-center justify-center px-6">
      <form onSubmit={onSubmit} className="w-full max-w-md bg-white border border-stone-200 rounded-xl p-6 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Sign In</h1>
          <p className="text-sm text-stone-500">Sign in with your external key.</p>
        </div>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm"
          required
        />
        <input
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          type="password"
          placeholder="Password"
          className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm"
          required
        />
        {error && <p className="text-sm text-red-700">{error}</p>}
        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-stone-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-stone-700 disabled:opacity-60"
        >
          {submitting ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}
