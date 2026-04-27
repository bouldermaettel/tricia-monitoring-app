import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { isAxiosError } from 'axios';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../app/auth';
import { changePassword } from '../services/auth';
function getDefaultRoute(role) {
    return role === 'admin' ? '/users' : '/input';
}
export function ChangePasswordPage() {
    const navigate = useNavigate();
    const { session, updateSession, signOut } = useAuth();
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState(null);
    const [submitting, setSubmitting] = useState(false);
    async function onSubmit(event) {
        event.preventDefault();
        setError(null);
        if (!session) {
            setError('Session is missing. Please sign in again.');
            return;
        }
        if (!newPassword.trim()) {
            setError('Please enter a new password.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('New password and confirmation do not match.');
            return;
        }
        setSubmitting(true);
        try {
            const next = await changePassword(currentPassword, newPassword);
            updateSession({
                token: next.access_token,
                refreshToken: next.refresh_token,
                tokenType: next.token_type,
                expiresAt: Date.now() + next.expires_in * 1000,
                refreshExpiresAt: Date.now() + next.refresh_expires_in * 1000,
                actorId: next.actor_id,
                externalKey: next.external_key,
                acronym: next.acronym,
                displayName: next.display_name,
                role: next.role,
                mustChangePassword: next.must_change_password,
            });
            navigate(getDefaultRoute(next.role), { replace: true });
        }
        catch (err) {
            if (isAxiosError(err)) {
                const apiMessage = err.response?.data?.error?.message ??
                    err.response?.data?.detail;
                setError(apiMessage || err.message);
            }
            else {
                setError(err instanceof Error ? err.message : 'Password change failed');
            }
        }
        finally {
            setSubmitting(false);
        }
    }
    return (_jsx("div", { className: "min-h-screen bg-stone-50 flex items-center justify-center px-6", children: _jsxs("form", { onSubmit: onSubmit, className: "w-full max-w-md bg-white border border-stone-200 rounded-xl p-6 space-y-4", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-stone-900", children: "Change Your Password" }), _jsx("p", { className: "text-sm text-stone-500", children: "Your account uses a temporary password. Set a new password to continue." })] }), _jsx("input", { value: currentPassword, onChange: (e) => setCurrentPassword(e.target.value), type: "password", placeholder: "Current password", className: "w-full border border-stone-300 rounded-lg px-3 py-2 text-sm", required: true }), _jsx("input", { value: newPassword, onChange: (e) => setNewPassword(e.target.value), type: "password", placeholder: "New password", className: "w-full border border-stone-300 rounded-lg px-3 py-2 text-sm", required: true }), _jsx("input", { value: confirmPassword, onChange: (e) => setConfirmPassword(e.target.value), type: "password", placeholder: "Confirm new password", className: "w-full border border-stone-300 rounded-lg px-3 py-2 text-sm", required: true }), error && _jsx("p", { className: "text-sm text-red-700", children: error }), _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { type: "submit", disabled: submitting, className: "flex-1 bg-stone-900 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-stone-700 disabled:opacity-60", children: submitting ? 'Saving...' : 'Update Password' }), _jsx("button", { type: "button", onClick: signOut, className: "bg-white border border-stone-300 text-stone-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-stone-100", children: "Sign Out" })] })] }) }));
}
