import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatrixDashboard } from '../../src/pages/MatrixDashboard';

vi.mock('../../src/hooks/useMatrix', () => ({
  useMatrix: () => ({ data: { cells: [] } }),
}));
vi.mock('../../src/hooks/useCases', () => ({
  useCases: () => ({ data: { items: [] } }),
  usePatchCaseReview: () => ({ mutate: vi.fn() }),
}));
vi.mock('../../src/hooks/useThresholds', () => ({
  useThresholds: () => ({ data: { acceptance_threshold: 1 } }),
  useUpdateThresholds: () => ({ mutate: vi.fn() }),
}));

describe('MatrixDashboard', () => {
  it('renders matrix view widgets', () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <MatrixDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Matrix Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Legend')).toBeInTheDocument();
  });
});
