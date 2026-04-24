import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { AppShell } from '../components/common/AppShell';
import { useAuth } from '../app/auth';
import { useCreateUser, useDeleteUser, useUpdateUser, useUsers } from '../hooks/useUsers';
export function UserManagement() {
    const { session } = useAuth();
    const usersQuery = useUsers();
    const createUser = useCreateUser();
    const updateUser = useUpdateUser();
    const deleteUser = useDeleteUser();
    const [externalKey, setExternalKey] = useState('');
    const [acronym, setAcronym] = useState('');
    const [password, setPassword] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [role, setRole] = useState('operator');
    const [isActive, setIsActive] = useState(true);
    const [editing, setEditing] = useState({});
    const hasError = usersQuery.isError || createUser.isError;
    async function onSubmit(event) {
        event.preventDefault();
        if (!externalKey.trim() || !displayName.trim() || !acronym.trim()) {
            return;
        }
        await createUser.mutateAsync({
            external_key: externalKey.trim(),
            acronym: acronym.trim(),
            password,
            display_name: displayName.trim(),
            role,
            is_active: isActive,
        });
        setExternalKey('');
        setAcronym('');
        setPassword('');
        setDisplayName('');
        setRole('operator');
        setIsActive(true);
    }
    function onEditAcronymChange(userId, currentAcronym, currentRole, currentActive, value) {
        const previous = editing[userId];
        setEditing((prev) => ({
            ...prev,
            [userId]: {
                acronym: value || previous?.acronym || currentAcronym,
                role: previous?.role ?? currentRole,
                is_active: previous?.is_active ?? currentActive,
                password: previous?.password ?? '',
            },
        }));
    }
    function onEditRoleChange(userId, currentRole, value, currentActive) {
        const previous = editing[userId];
        setEditing((prev) => ({
            ...prev,
            [userId]: {
                acronym: previous?.acronym ?? '',
                role: value || previous?.role || currentRole,
                is_active: previous?.is_active ?? currentActive,
                password: previous?.password ?? '',
            },
        }));
    }
    function onEditActiveChange(userId, currentRole, checked, currentActive) {
        const previous = editing[userId];
        setEditing((prev) => ({
            ...prev,
            [userId]: {
                acronym: previous?.acronym ?? '',
                role: previous?.role ?? currentRole,
                is_active: checked,
                password: previous?.password ?? '',
            },
        }));
    }
    function onEditPasswordChange(userId, currentRole, currentActive, value) {
        const previous = editing[userId];
        setEditing((prev) => ({
            ...prev,
            [userId]: {
                acronym: previous?.acronym ?? '',
                role: previous?.role ?? currentRole,
                is_active: previous?.is_active ?? currentActive,
                password: value,
            },
        }));
    }
    async function onSaveUser(userId, originalAcronym, originalRole, originalActive) {
        const draft = editing[userId];
        const payload = {};
        const password = draft?.password?.trim() ?? '';
        const acronym = draft?.acronym?.trim() ?? '';
        if (acronym && acronym !== originalAcronym)
            payload.acronym = acronym;
        if (draft?.role !== undefined && draft.role !== originalRole)
            payload.role = draft.role;
        if (draft?.is_active !== undefined && draft.is_active !== originalActive)
            payload.is_active = draft.is_active;
        if (password) {
            payload.password = password;
        }
        if (!payload.acronym && !payload.role && payload.is_active === undefined && !payload.password)
            return;
        await updateUser.mutateAsync({ userId, payload });
        setEditing((prev) => {
            const copy = { ...prev };
            delete copy[userId];
            return copy;
        });
    }
    async function onDeleteUser(userId) {
        await deleteUser.mutateAsync(userId);
    }
    return (_jsx(AppShell, { children: _jsxs("div", { className: "max-w-4xl space-y-6", children: [_jsxs("div", { children: [_jsx("h1", { className: "text-2xl font-bold text-stone-900", children: "User Management" }), _jsx("p", { className: "text-stone-500 text-sm", children: "Admins can add, edit, deactivate, and delete users." }), _jsxs("p", { className: "text-stone-500 text-xs mt-1", children: ["Signed in as: ", session?.displayName, " (", session?.externalKey, ")"] })] }), _jsxs("form", { onSubmit: onSubmit, className: "bg-white border border-stone-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-5 gap-3", children: [_jsx("input", { value: externalKey, onChange: (e) => setExternalKey(e.target.value), placeholder: "External key", className: "border border-stone-300 rounded-lg px-3 py-2 text-sm md:col-span-2", required: true }), _jsx("input", { value: displayName, onChange: (e) => setDisplayName(e.target.value), placeholder: "Display name", className: "border border-stone-300 rounded-lg px-3 py-2 text-sm md:col-span-2", required: true }), _jsx("input", { value: acronym, onChange: (e) => setAcronym(e.target.value), placeholder: "Acronym (e.g. mam)", className: "border border-stone-300 rounded-lg px-3 py-2 text-sm", required: true }), _jsx("input", { value: password, onChange: (e) => setPassword(e.target.value), type: "password", placeholder: "Password", className: "border border-stone-300 rounded-lg px-3 py-2 text-sm md:col-span-2", required: true }), _jsxs("select", { value: role, onChange: (e) => setRole(e.target.value), className: "border border-stone-300 rounded-lg px-3 py-2 text-sm", children: [_jsx("option", { value: "operator", children: "operator" }), _jsx("option", { value: "analyst", children: "analyst" }), _jsx("option", { value: "controller", children: "controller" }), _jsx("option", { value: "admin", children: "admin" })] }), _jsxs("label", { className: "md:col-span-2 text-sm text-stone-600 flex items-center gap-2", children: [_jsx("input", { type: "checkbox", checked: isActive, onChange: (e) => setIsActive(e.target.checked) }), "Active user"] }), _jsx("button", { type: "submit", disabled: createUser.isPending, className: "md:col-span-1 bg-stone-900 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-stone-700 disabled:opacity-60", children: createUser.isPending ? 'Adding...' : 'Add User' })] }), hasError && (_jsx("div", { className: "text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2", children: usersQuery.error instanceof Error
                        ? usersQuery.error.message
                        : createUser.error instanceof Error
                            ? createUser.error.message
                            : 'Request failed' })), _jsxs("div", { className: "bg-white border border-stone-200 rounded-xl overflow-hidden", children: [_jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-stone-50 text-stone-600", children: _jsxs("tr", { children: [_jsx("th", { className: "text-left px-4 py-3", children: "Display Name" }), _jsx("th", { className: "text-left px-4 py-3", children: "External Key" }), _jsx("th", { className: "text-left px-4 py-3", children: "Acronym" }), _jsx("th", { className: "text-left px-4 py-3", children: "Role" }), _jsx("th", { className: "text-left px-4 py-3", children: "Active" }), _jsx("th", { className: "text-left px-4 py-3", children: "Reset Password" }), _jsx("th", { className: "text-left px-4 py-3", children: "Actions" })] }) }), _jsx("tbody", { children: (usersQuery.data?.items ?? []).map((user) => (_jsxs("tr", { className: "border-t border-stone-100", children: [_jsx("td", { className: "px-4 py-3", children: user.display_name }), _jsx("td", { className: "px-4 py-3 font-mono text-xs text-stone-600", children: user.external_key }), _jsx("td", { className: "px-4 py-3", children: _jsx("input", { value: editing[user.id]?.acronym ?? user.acronym, onChange: (e) => onEditAcronymChange(user.id, user.acronym, user.role, user.is_active, e.target.value), className: "border border-stone-300 rounded px-2 py-1 text-xs w-24" }) }), _jsx("td", { className: "px-4 py-3", children: _jsxs("select", { value: editing[user.id]?.role ?? user.role, onChange: (e) => onEditRoleChange(user.id, user.role, e.target.value, user.is_active), className: "border border-stone-300 rounded px-2 py-1", children: [_jsx("option", { value: "operator", children: "operator" }), _jsx("option", { value: "analyst", children: "analyst" }), _jsx("option", { value: "controller", children: "controller" }), _jsx("option", { value: "admin", children: "admin" })] }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("input", { "aria-label": `active-${user.id}`, type: "checkbox", checked: editing[user.id]?.is_active ?? user.is_active, onChange: (e) => onEditActiveChange(user.id, user.role, e.target.checked, user.is_active) }) }), _jsx("td", { className: "px-4 py-3", children: _jsx("input", { "aria-label": `password-${user.id}`, type: "password", value: editing[user.id]?.password ?? '', onChange: (e) => onEditPasswordChange(user.id, user.role, user.is_active, e.target.value), placeholder: "Leave blank", className: "border border-stone-300 rounded px-2 py-1 text-xs" }) }), _jsx("td", { className: "px-4 py-3", children: _jsxs("div", { className: "flex gap-2", children: [_jsx("button", { onClick: () => onSaveUser(user.id, user.acronym, user.role, user.is_active), disabled: updateUser.isPending, className: "bg-stone-900 text-white rounded px-3 py-1 text-xs hover:bg-stone-700 disabled:opacity-60", children: "Save" }), _jsx("button", { onClick: () => onDeleteUser(user.id), disabled: deleteUser.isPending, className: "bg-red-600 text-white rounded px-3 py-1 text-xs hover:bg-red-500 disabled:opacity-60", children: "Delete" })] }) })] }, user.id))) })] }), usersQuery.isLoading && _jsx("p", { className: "px-4 py-3 text-stone-500", children: "Loading users..." })] })] }) }));
}
