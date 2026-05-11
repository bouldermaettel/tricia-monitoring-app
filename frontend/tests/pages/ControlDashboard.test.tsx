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
          date_reported: '2026-05-10',
          analysis_date: '2026-05-10',
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
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ControlDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Control Dashboard')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '1 Week' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Custom' })).toBeInTheDocument();
    expect(screen.getByText('VK-1')).toBeInTheDocument();
    expect(screen.getByText('10.05.2026')).toBeInTheDocument();
    expect(screen.getByLabelText('Review SLA (days)')).toHaveValue(28);
  });
});
