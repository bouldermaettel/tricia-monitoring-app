import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InputDashboard } from '../../src/pages/InputDashboard';

vi.mock('../../src/hooks/useCases', () => ({
  useValidateCase: () => ({ mutateAsync: vi.fn().mockResolvedValue({ duplicate: false }) }),
  useCreateCase: () => ({ mutateAsync: vi.fn().mockResolvedValue({ id: '1' }) }),
}));

describe('InputDashboard', () => {
  it('renders validate/save flow controls', () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InputDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Input Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Validate')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });
});
