import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InputDashboard } from '../../src/pages/InputDashboard';
const createMutateAsync = vi.fn().mockResolvedValue({ id: '1' });
vi.mock('../../src/hooks/useCases', () => ({
    useCreateCase: () => ({ mutateAsync: createMutateAsync, isPending: false, isError: false }),
}));
describe('InputDashboard', () => {
    beforeEach(() => {
        createMutateAsync.mockClear();
    });
    it('renders a single save control', () => {
        const client = new QueryClient();
        render(_jsx(QueryClientProvider, { client: client, children: _jsx(MemoryRouter, { children: _jsx(InputDashboard, {}) }) }));
        expect(screen.getByText('Input Dashboard')).toBeInTheDocument();
        expect(screen.getByText('Save')).toBeInTheDocument();
    });
    it('saves directly when the save button is pressed', async () => {
        const user = userEvent.setup();
        const client = new QueryClient();
        render(_jsx(QueryClientProvider, { client: client, children: _jsx(MemoryRouter, { children: _jsx(InputDashboard, {}) }) }));
        await user.type(screen.getByLabelText('vk-number'), 'Vk_20211123_23');
        await user.type(screen.getByLabelText('device-name'), 'Device-1');
        await user.click(screen.getByText('Save'));
        expect(createMutateAsync).toHaveBeenCalledWith({
            vk_number: 'Vk_20211123_23',
            device_name: 'Device-1',
            tricia_s: 1,
            tricia_p: 1,
            tricia_d: 1,
            user_s: 1,
            user_p: 1,
            user_d: 1,
            validation_status: 'saved',
        });
        expect(screen.getByText('Case saved. Form cleared — ready for next entry.')).toBeInTheDocument();
    });
    it('allows only discrete category selections for S, D, and P', async () => {
        const user = userEvent.setup();
        const client = new QueryClient();
        render(_jsx(QueryClientProvider, { client: client, children: _jsx(MemoryRouter, { children: _jsx(InputDashboard, {}) }) }));
        const selects = screen.getAllByRole('combobox');
        await user.type(screen.getByLabelText('vk-number'), 'Vk_20211123_23');
        await user.type(screen.getByLabelText('device-name'), 'Device-1');
        await user.selectOptions(selects[0], '8');
        await user.selectOptions(selects[1], '5');
        await user.selectOptions(selects[2], '10');
        await user.selectOptions(selects[3], '10');
        await user.selectOptions(selects[4], '5');
        await user.click(screen.getByText('Save'));
        expect(createMutateAsync).toHaveBeenCalledWith({
            vk_number: 'Vk_20211123_23',
            device_name: 'Device-1',
            tricia_s: 8,
            tricia_p: 5,
            tricia_d: 10,
            user_s: 10,
            user_p: 5,
            user_d: 10,
            validation_status: 'saved',
        });
    });
    it('shows duplicate dialog when backend returns wrapped duplicate error message', async () => {
        const user = userEvent.setup();
        const client = new QueryClient();
        createMutateAsync.mockRejectedValueOnce({
            response: {
                data: {
                    error: { message: 'Duplicate vk_number' },
                },
            },
        });
        render(_jsx(QueryClientProvider, { client: client, children: _jsx(MemoryRouter, { children: _jsx(InputDashboard, {}) }) }));
        await user.type(screen.getByLabelText('vk-number'), 'Vk_20211115');
        await user.type(screen.getByLabelText('device-name'), 'Device-1');
        await user.click(screen.getByText('Save'));
        expect(screen.getByRole('dialog', { name: 'duplicate-dialog' })).toBeInTheDocument();
        expect(screen.queryByText('Save failed. Check the VK number format and required fields.')).not.toBeInTheDocument();
    });
    it('shows duplicate dialog on HTTP 409 even without explicit message payload', async () => {
        const user = userEvent.setup();
        const client = new QueryClient();
        createMutateAsync.mockRejectedValueOnce({
            response: {
                status: 409,
                data: {},
            },
        });
        render(_jsx(QueryClientProvider, { client: client, children: _jsx(MemoryRouter, { children: _jsx(InputDashboard, {}) }) }));
        await user.type(screen.getByLabelText('vk-number'), 'Vk_20211115');
        await user.type(screen.getByLabelText('device-name'), 'Device-1');
        await user.click(screen.getByText('Save'));
        expect(screen.getByRole('dialog', { name: 'duplicate-dialog' })).toBeInTheDocument();
        expect(screen.queryByText('Save failed. Check the VK number format and required fields.')).not.toBeInTheDocument();
    });
});
