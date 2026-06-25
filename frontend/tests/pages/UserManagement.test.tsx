import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { UserManagement } from '../../src/pages/UserManagement';

const createMutateAsync = vi.fn().mockResolvedValue({});
const updateMutateAsync = vi.fn().mockResolvedValue({});
const deleteMutateAsync = vi.fn().mockResolvedValue({});

vi.mock('../../src/app/auth', () => ({
  useAuth: () => ({
    session: {
      actorId: 'bootstrap-admin',
      externalKey: 'bootstrap-admin',
      displayName: 'Bootstrap Admin',
      role: 'admin',
    },
    signOut: vi.fn(),
  }),
}));

vi.mock('../../src/hooks/useUsers', () => ({
  useUsers: () => ({
    data: {
      items: [
        {
          id: 'u-1',
          external_key: 'matrix.user.1',
          display_name: 'Matrix User',
          role: 'user',
          is_active: true,
        },
        {
          id: 'bootstrap-admin',
          external_key: 'bootstrap-admin',
          display_name: 'Bootstrap Admin',
          role: 'admin',
          is_active: true,
        },
      ],
    },
    isLoading: false,
    isError: false,
  }),
  useCreateUser: () => ({ mutateAsync: createMutateAsync, isPending: false, isError: false }),
  useUpdateUser: () => ({ mutateAsync: updateMutateAsync, isPending: false, isError: false }),
  useDeleteUser: () => ({ mutateAsync: deleteMutateAsync, isPending: false, isError: false }),
}));

describe('UserManagement', () => {
  beforeEach(() => {
    createMutateAsync.mockClear();
    updateMutateAsync.mockClear();
    deleteMutateAsync.mockClear();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
  });

  it('renders users table and add form', () => {
    render(
      <MemoryRouter>
        <UserManagement />
      </MemoryRouter>
    );

    expect(screen.getByText('User Management')).toBeInTheDocument();
    expect(screen.getByText(/set temporary passwords/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('Matrix User')).toBeInTheDocument();
    expect(screen.getByText('Add User')).toBeInTheDocument();
  });

  it('creates a user from form input', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UserManagement />
      </MemoryRouter>
    );

    await user.type(screen.getByPlaceholderText('Username'), 'new.user.1');
    await user.type(screen.getByPlaceholderText('Display name'), 'New User 1');
    await user.type(screen.getByPlaceholderText('Acronym (e.g. mam)'), 'nu1');
    await user.type(screen.getByPlaceholderText('Password'), 'new-user-password');
    await user.selectOptions(screen.getAllByRole('combobox')[0], 'user');
    await user.click(screen.getByText('Add User'));

    expect(createMutateAsync).toHaveBeenCalledWith({
      external_key: 'new.user.1',
      acronym: 'nu1',
      password: 'new-user-password',
      display_name: 'New User 1',
      role: 'user',
      is_active: true,
    });
  });

  it('updates and deletes an existing user', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UserManagement />
      </MemoryRouter>
    );

    await user.selectOptions(screen.getAllByRole('combobox')[1], 'admin');
    await user.click(screen.getByLabelText('active-u-1'));
    await user.click(screen.getAllByRole('button', { name: 'Save' })[0]);

    expect(updateMutateAsync).toHaveBeenCalledWith({
      userId: 'u-1',
      payload: { role: 'admin', is_active: false },
    });

    await user.click(screen.getAllByRole('button', { name: 'Delete' })[0]);
    expect(deleteMutateAsync).toHaveBeenCalledWith('u-1');
  });

  it('resets a user password with an explicit action', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <UserManagement />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('password-u-1'), 'temporary-reset-pass');
    await user.click(screen.getAllByRole('button', { name: 'Reset Password' })[0]);

    expect(updateMutateAsync).toHaveBeenCalledWith({
      userId: 'u-1',
      payload: { password: 'temporary-reset-pass' },
    });
  });

  it('does not allow the signed-in admin to reset or delete their own user', () => {
    render(
      <MemoryRouter>
        <UserManagement />
      </MemoryRouter>
    );

    expect(screen.getByLabelText('password-bootstrap-admin')).toBeInTheDocument();
    expect(screen.getAllByRole('combobox')[2]).toBeDisabled();
    expect(screen.getByLabelText('active-bootstrap-admin')).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Reset Password' })[1]).toBeDisabled();
    expect(screen.getAllByRole('button', { name: 'Delete' })[1]).toBeDisabled();
  });
});
