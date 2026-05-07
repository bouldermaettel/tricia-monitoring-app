import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatrixDashboard } from '../../src/pages/MatrixDashboard';

vi.mock('../../src/hooks/useMatrix', () => ({
  useMatrix: () => ({
    data: {
      cells: [{ expected_value: 1, observed_value: 1, case_count: 1, within_threshold: true }],
      matrices: {
        severity: [{ expected_value: 1, observed_value: 1, case_count: 1, within_threshold: true }],
        detectability: [{ expected_value: 2, observed_value: 2, case_count: 1, within_threshold: true }],
        product: [{ expected_value: 4, observed_value: 4, case_count: 1, within_threshold: true }],
      },
    },
  }),
}));
vi.mock('../../src/hooks/useCases', () => ({
  useCases: () => ({ data: { items: [] } }),
  usePatchCaseReview: () => ({ mutate: vi.fn() }),
  useAddCaseComment: () => ({ mutate: vi.fn() }),
  useUpdateCase: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useDeleteCase: () => ({ mutate: vi.fn() }),
  useCaseAuditTrail: () => ({ data: { items: [] }, isLoading: false }),
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
    expect(screen.getByText('Risk Class, Severity and Detectability Matrices - P: 0 selected, S: 0 selected, D: 0 selected ▲')).toBeInTheDocument();
    expect(screen.getByText('Severity Matrix')).toBeInTheDocument();
    expect(screen.getByText('Detectability Matrix')).toBeInTheDocument();
    expect(screen.getByText('Risk Class Matrix')).toBeInTheDocument();
  });
});
