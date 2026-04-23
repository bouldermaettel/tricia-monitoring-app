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
  useAddCaseComment: () => ({ mutate: vi.fn() }),
}));
vi.mock('../../src/hooks/useThresholds', () => ({
  useThresholds: () => ({ data: { acceptance_threshold: 1 } }),
  useUpdateThresholds: () => ({ mutate: vi.fn() }),
}));

describe('DataOps and Config', () => {
  it('renders export and threshold controls', () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <MatrixDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('CSV')).toBeInTheDocument();
    expect(screen.getByText('XLSX')).toBeInTheDocument();
    expect(screen.getByText('Threshold Configuration')).toBeInTheDocument();
  });
});
