import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatrixDashboard } from '../../src/pages/MatrixDashboard';

const useAuthMock = vi.fn();
const mockCases = [
  {
    id: 'case-1',
    vk_number: 'VK-1',
    wimi_shortcut: 'abc',
    date_reported: '2026-05-01',
    device_name: 'Device A',
    tricia_s: 1,
    user_s: 1,
    tricia_d: 2,
    user_d: 2,
    category_code: 'monitor',
    is_excluded: false,
    is_reviewed: false,
    comment_text: '',
  },
];

vi.mock('../../src/app/auth', () => ({
  useAuth: () => useAuthMock(),
}));

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
  useCases: () => ({ data: { items: mockCases } }),
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

function renderMatrixDashboard() {
  const client = new QueryClient();
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MatrixDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('MatrixDashboard', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    useAuthMock.mockReturnValue({
      session: {
        actorId: 'user-1',
        externalKey: 'user-1',
        displayName: 'Matrix User',
        role: 'user',
      },
    });
  });

  it('renders matrix view widgets', () => {
    renderMatrixDashboard();

    expect(screen.getByText('Matrix Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Risk Class, Severity and Detectability Matrices - P: 0 selected, S: 0 selected, D: 0 selected ▲')).toBeInTheDocument();
    expect(screen.getByText('Severity Matrix')).toBeInTheDocument();
    expect(screen.getByText('Detectability Matrix')).toBeInTheDocument();
    expect(screen.getByText('Risk Class Matrix')).toBeInTheDocument();
  });

  it('shows delete controls only to admins', () => {
    renderMatrixDashboard();
    expect(screen.queryByLabelText('select-all-visible-cases')).not.toBeInTheDocument();

    useAuthMock.mockReturnValue({
      session: {
        actorId: 'admin-1',
        externalKey: 'admin-1',
        displayName: 'Matrix Admin',
        role: 'admin',
      },
    });

    renderMatrixDashboard();
    expect(screen.getByLabelText('select-all-visible-cases')).toBeInTheDocument();
  });
});
