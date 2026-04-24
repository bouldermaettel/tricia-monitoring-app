import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useAuth } from '../app/auth';
export function LoginPage() {
    const navigate = useNavigate();
    const { session, signIn } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    if (session) {
        return _jsx(Navigate, { to: "/users", replace: true });
    }
    async function onSubmit(event) {
        event.preventDefault();
        setError(null);
        setSubmitting(true);
        try {
            await signIn(username, password);
            navigate('/users', { replace: true });
        }
        catch (err) {
            if (isAxiosError(err)) {
                const apiMessage = err.response?.data?.error?.message ??
                    err.response?.data?.detail;
                if (apiMessage) {
                    setError(apiMessage);
                }
                else if (err.response?.status === 500) {
                    setError('Server error during sign in. Please ensure the backend API is running on port 8000.');
                }
                else if (err.code === 'ERR_NETWORK') {
                    setError('Cannot reach backend API. Please start the backend service and try again.');
                }
                else {
                    setError(err.message);
                }
            }
            else {
                setError(err instanceof Error ? err.message : 'Login failed');
            }
        }
        finally {
            setSubmitting(false);
        }
    }
    return (_jsx("div", { className: "min-h-screen bg-stone-50 flex items-center justify-center px-6", children: _jsxs("form", { onSubmit: onSubmit, className: "w-full max-w-md bg-white border border-stone-200 rounded-xl p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-stone-900", children: "Admin Sign In" }), _jsx("p", { className: "text-sm text-stone-500", children: "Sign in with your external key to manage users." })] }), _jsx("input", { value: username, onChange: (e) => setUsername(e.target.value), placeholder: "Username", className: "w-full border border-stone-300 rounded-lg px-3 py-2 text-sm", required: true }), _jsx("input", { value: password, onChange: (e) => setPassword(e.target.value), type: "password", placeholder: "Password", className: "w-full border border-stone-300 rounded-lg px-3 py-2 text-sm", required: true }), error && _jsx("p", { className: "text-sm text-red-700", children: error }), _jsx("button", { type: "submit", disabled: submitting, className: "w-full bg-stone-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-stone-700 disabled:opacity-60", children: submitting ? 'Signing in...' : 'Sign In' })] }) }));
}
