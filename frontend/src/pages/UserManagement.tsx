import { FormEvent, useState } from 'react';
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
  const [role, setRole] = useState('user');
  const [isActive, setIsActive] = useState(true);
  const [editing, setEditing] = useState<Record<string, { display_name: string; acronym: string; role: string; is_active: boolean; password: string }>>({});

  const hasError = usersQuery.isError || createUser.isError || updateUser.isError || deleteUser.isError;
  const errorMessage = usersQuery.error instanceof Error
    ? usersQuery.error.message
    : createUser.error instanceof Error
    ? createUser.error.message
    : updateUser.error instanceof Error
    ? updateUser.error.message
    : deleteUser.error instanceof Error
    ? deleteUser.error.message
    : 'Request failed';

  async function onSubmit(event: FormEvent) {
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
    setRole('user');
    setIsActive(true);
  }

  function onEditDisplayNameChange(
    userId: string,
    currentDisplayName: string,
    currentAcronym: string,
    currentRole: string,
    currentActive: boolean,
    value: string
  ) {
    const previous = editing[userId];
    setEditing((prev) => ({
      ...prev,
      [userId]: {
        display_name: value || previous?.display_name || currentDisplayName,
        acronym: previous?.acronym ?? currentAcronym,
        role: previous?.role ?? currentRole,
        is_active: previous?.is_active ?? currentActive,
        password: previous?.password ?? '',
      },
    }));
  }

  function onEditAcronymChange(
    userId: string,
    currentDisplayName: string,
    currentAcronym: string,
    currentRole: string,
    currentActive: boolean,
    value: string
  ) {
    const previous = editing[userId];
    setEditing((prev) => ({
      ...prev,
      [userId]: {
        display_name: previous?.display_name ?? currentDisplayName,
        acronym: value || previous?.acronym || currentAcronym,
        role: previous?.role ?? currentRole,
        is_active: previous?.is_active ?? currentActive,
        password: previous?.password ?? '',
      },
    }));
  }

  function onEditRoleChange(userId: string, currentDisplayName: string, currentAcronym: string, currentRole: string, value: string, currentActive: boolean) {
    const previous = editing[userId];
    setEditing((prev) => ({
      ...prev,
      [userId]: {
        display_name: previous?.display_name ?? currentDisplayName,
        acronym: previous?.acronym ?? currentAcronym,
        role: value || previous?.role || currentRole,
        is_active: previous?.is_active ?? currentActive,
        password: previous?.password ?? '',
      },
    }));
  }

  function onEditActiveChange(userId: string, currentDisplayName: string, currentAcronym: string, currentRole: string, checked: boolean, currentActive: boolean) {
    const previous = editing[userId];
    setEditing((prev) => ({
      ...prev,
      [userId]: {
        display_name: previous?.display_name ?? currentDisplayName,
        acronym: previous?.acronym ?? currentAcronym,
        role: previous?.role ?? currentRole,
        is_active: checked,
        password: previous?.password ?? '',
      },
    }));
  }

  function onEditPasswordChange(
    userId: string,
    currentDisplayName: string,
    currentAcronym: string,
    currentRole: string,
    currentActive: boolean,
    value: string
  ) {
    const previous = editing[userId];
    setEditing((prev) => ({
      ...prev,
      [userId]: {
        display_name: previous?.display_name ?? currentDisplayName,
        acronym: previous?.acronym ?? currentAcronym,
        role: previous?.role ?? currentRole,
        is_active: previous?.is_active ?? currentActive,
        password: value,
      },
    }));
  }

  async function onSaveUser(
    userId: string,
    originalDisplayName: string,
    originalAcronym: string,
    originalRole: string,
    originalActive: boolean
  ) {
    const draft = editing[userId];
    const payload: { display_name?: string; acronym?: string; role?: string; is_active?: boolean; password?: string } = {};
    const password = draft?.password?.trim() ?? '';
    const displayName = draft?.display_name?.trim() ?? '';
    const acronym = draft?.acronym?.trim() ?? '';
    if (displayName && displayName !== originalDisplayName) payload.display_name = displayName;
    if (acronym && acronym !== originalAcronym) payload.acronym = acronym;
    if (draft?.role !== undefined && draft.role !== originalRole) payload.role = draft.role;
    if (draft?.is_active !== undefined && draft.is_active !== originalActive) payload.is_active = draft.is_active;
    if (password) {
      payload.password = password;
    }
    if (!payload.display_name && !payload.acronym && !payload.role && payload.is_active === undefined && !payload.password) return;

    await updateUser.mutateAsync({ userId, payload });
    setEditing((prev) => {
      const copy = { ...prev };
      delete copy[userId];
      return copy;
    });
  }

  async function onDeleteUser(userId: string) {
    if (!window.confirm('Delete this user permanently?')) return;
    await deleteUser.mutateAsync(userId);
  }

  async function onResetPassword(
    userId: string,
    originalDisplayName: string,
    originalAcronym: string,
    originalRole: string,
    originalActive: boolean
  ) {
    const nextPassword = editing[userId]?.password?.trim() ?? '';
    if (!nextPassword) return;

    await updateUser.mutateAsync({
      userId,
      payload: { password: nextPassword },
    });

    setEditing((prev) => ({
      ...prev,
      [userId]: {
        display_name: prev[userId]?.display_name ?? originalDisplayName,
        acronym: prev[userId]?.acronym ?? originalAcronym,
        role: prev[userId]?.role ?? originalRole,
        is_active: prev[userId]?.is_active ?? originalActive,
        password: '',
      },
    }));

  }

  return (
    <AppShell>
      <div className="max-w-4xl space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-900">User Management</h1>
          <p className="text-stone-500 text-sm">Admins can add, edit, deactivate, delete users, and set temporary passwords.</p>
          <p className="text-stone-500 text-xs mt-1">
            Entering a password in a user row and selecting Reset Password will force that user to choose a new password after their next sign-in.
          </p>
          <p className="text-stone-500 text-xs mt-1">Signed in as: {session?.displayName} ({session?.externalKey})</p>
        </div>

        <form onSubmit={onSubmit} className="bg-white border border-stone-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            value={externalKey}
            onChange={(e) => setExternalKey(e.target.value)}
            placeholder="Username"
            autoComplete="username"
            className="border border-stone-300 rounded-lg px-3 py-2 text-sm md:col-span-2"
            required
          />
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display name"
            className="border border-stone-300 rounded-lg px-3 py-2 text-sm md:col-span-2"
            required
          />
          <input
            value={acronym}
            onChange={(e) => setAcronym(e.target.value)}
            placeholder="Acronym (e.g. mam)"
            autoComplete="off"
            className="border border-stone-300 rounded-lg px-3 py-2 text-sm"
            required
          />
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type="password"
            placeholder="Password"
            autoComplete="new-password"
            className="border border-stone-300 rounded-lg px-3 py-2 text-sm md:col-span-2"
            required
          />
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="border border-stone-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="user">user</option>
            <option value="admin">admin</option>
          </select>
          <label className="md:col-span-2 text-sm text-stone-600 flex items-center gap-2">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            Active user
          </label>
          <button
            type="submit"
            disabled={createUser.isPending}
            className="md:col-span-1 bg-stone-900 text-white rounded-lg px-3 py-2 text-sm font-medium hover:bg-stone-700 disabled:opacity-60"
          >
            {createUser.isPending ? 'Adding...' : 'Add User'}
          </button>
        </form>

        {hasError && (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
            {errorMessage}
          </div>
        )}

        <div className="bg-white border border-stone-200 rounded-xl overflow-x-auto">
          <table className="w-full min-w-[980px] text-sm">
            <thead className="bg-stone-50 text-stone-600">
              <tr>
                <th className="text-left px-4 py-3">Display Name</th>
                <th className="text-left px-4 py-3">Username</th>
                <th className="text-left px-4 py-3">Acronym</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Active</th>
                <th className="text-left px-4 py-3">Reset Password</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(usersQuery.data?.items ?? []).map((user) => (
                <tr key={user.id} className="border-t border-stone-100">
                  <td className="px-4 py-3">
                    <input
                      value={editing[user.id]?.display_name ?? user.display_name}
                      onChange={(e) => onEditDisplayNameChange(user.id, user.display_name, user.acronym, user.role, user.is_active, e.target.value)}
                      className="border border-stone-300 rounded px-2 py-1 text-xs w-48"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-600">{user.external_key}</td>
                  <td className="px-4 py-3">
                    <input
                      value={editing[user.id]?.acronym ?? user.acronym}
                      onChange={(e) => onEditAcronymChange(user.id, user.display_name, user.acronym, user.role, user.is_active, e.target.value)}
                      className="border border-stone-300 rounded px-2 py-1 text-xs w-24"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={editing[user.id]?.role ?? user.role}
                      onChange={(e) => onEditRoleChange(user.id, user.display_name, user.acronym, user.role, e.target.value, user.is_active)}
                      className="border border-stone-300 rounded px-2 py-1"
                    >
                      <option value="user">user</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      aria-label={`active-${user.id}`}
                      type="checkbox"
                      checked={editing[user.id]?.is_active ?? user.is_active}
                      onChange={(e) => onEditActiveChange(user.id, user.display_name, user.acronym, user.role, e.target.checked, user.is_active)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <input
                      aria-label={`password-${user.id}`}
                      type="password"
                      value={editing[user.id]?.password ?? ''}
                      onChange={(e) => onEditPasswordChange(user.id, user.display_name, user.acronym, user.role, user.is_active, e.target.value)}
                      placeholder="Temporary password"
                      className="border border-stone-300 rounded px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => onSaveUser(user.id, user.display_name, user.acronym, user.role, user.is_active)}
                        disabled={updateUser.isPending}
                        className="bg-stone-900 text-white rounded px-3 py-1 text-xs hover:bg-stone-700 disabled:opacity-60"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => onResetPassword(user.id, user.display_name, user.acronym, user.role, user.is_active)}
                        disabled={updateUser.isPending || !editing[user.id]?.password?.trim() || user.external_key === session?.externalKey}
                        className="bg-amber-500 text-stone-900 rounded px-3 py-1 text-xs font-medium hover:bg-amber-400 disabled:opacity-60"
                        title={user.external_key === session?.externalKey ? 'Use the Password page to change your own password' : 'Reset password and require a change on next sign-in'}
                      >
                        Reset Password
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteUser(user.id)}
                        disabled={deleteUser.isPending || user.external_key === session?.externalKey}
                        className="bg-red-600 text-white rounded px-3 py-1 text-xs hover:bg-red-500 disabled:opacity-60"
                        title={user.external_key === session?.externalKey ? 'You cannot delete your own active admin account' : 'Delete user'}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {usersQuery.isLoading && <p className="px-4 py-3 text-stone-500">Loading users...</p>}
        </div>
      </div>
    </AppShell>
  );
}
