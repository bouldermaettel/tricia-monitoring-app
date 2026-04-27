import { jsx as _jsx } from "react/jsx-runtime";
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ControlDashboard } from '../../src/pages/ControlDashboard';
vi.mock('../../src/hooks/useControlQueue', () => {
    const _queueResult = {
        data: {
            items: [
                {
                    vk_number: 'VK-1',
                    analysis_date: '2021-11-23',
                    delay_bucket: 'on_time',
                    validation_status: 'saved',
                },
            ],
        },
    };
    return { useControlQueue: () => _queueResult };
});
describe('ControlDashboard', () => {
    it('renders control queue', () => {
        const client = new QueryClient();
        render(_jsx(QueryClientProvider, { client: client, children: _jsx(MemoryRouter, { children: _jsx(ControlDashboard, {}) }) }));
        expect(screen.getByText('Control Dashboard')).toBeInTheDocument();
        expect(screen.getByText('VK-1')).toBeInTheDocument();
        expect(screen.getByText('23.11.2021')).toBeInTheDocument();
        expect(screen.getByLabelText('Review SLA (days)')).toHaveValue(28);
    });
});
