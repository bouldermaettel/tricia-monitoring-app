import { jsx as _jsx } from "react/jsx-runtime";
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
                    role: 'operator',
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
    });
    it('renders users table and add form', () => {
        render(_jsx(MemoryRouter, { children: _jsx(UserManagement, {}) }));
        expect(screen.getByText('User Management')).toBeInTheDocument();
        expect(screen.getByText('Matrix User')).toBeInTheDocument();
        expect(screen.getByText('Add User')).toBeInTheDocument();
    });
    it('creates a user from form input', async () => {
        const user = userEvent.setup();
        render(_jsx(MemoryRouter, { children: _jsx(UserManagement, {}) }));
        await user.type(screen.getByPlaceholderText('External key'), 'new.user.1');
        await user.type(screen.getByPlaceholderText('Display name'), 'New User 1');
        await user.type(screen.getByPlaceholderText('Password'), 'new-user-password');
        await user.selectOptions(screen.getAllByRole('combobox')[0], 'analyst');
        await user.click(screen.getByText('Add User'));
        expect(createMutateAsync).toHaveBeenCalledWith({
            external_key: 'new.user.1',
            password: 'new-user-password',
            display_name: 'New User 1',
            role: 'analyst',
            is_active: true,
        });
    });
    it('updates and deletes an existing user', async () => {
        const user = userEvent.setup();
        render(_jsx(MemoryRouter, { children: _jsx(UserManagement, {}) }));
        await user.selectOptions(screen.getAllByRole('combobox')[1], 'controller');
        await user.click(screen.getByLabelText('active-u-1'));
        await user.click(screen.getByText('Save'));
        expect(updateMutateAsync).toHaveBeenCalledWith({
            userId: 'u-1',
            payload: { role: 'controller', is_active: false },
        });
        await user.click(screen.getByText('Delete'));
        expect(deleteMutateAsync).toHaveBeenCalledWith('u-1');
    });
});
