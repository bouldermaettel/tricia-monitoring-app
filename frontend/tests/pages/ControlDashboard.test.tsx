import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ControlDashboard } from '../../src/pages/ControlDashboard';

vi.mock('../../src/hooks/useControlQueue', () => ({
  useControlQueue: () => ({ data: { items: [{ vk_number: 'VK-1', delay_bucket: 'on_time', validation_status: 'saved' }] } }),
}));

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
    expect(screen.getByText('VK-1')).toBeInTheDocument();
  });
});
