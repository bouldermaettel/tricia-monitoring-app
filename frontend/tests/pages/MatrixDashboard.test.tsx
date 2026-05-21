import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatrixDashboard } from '../../src/pages/MatrixDashboard';
import { useFilters } from '../../src/state/filters';

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
  useMatrix: (params?: Record<string, unknown>, options?: { enabled?: boolean }) => {
    const enabled = options?.enabled ?? true;
    if (!enabled) return { data: undefined };

    const isRiskClassFiltered = Boolean(params?.product_cells);
    return {
      data: {
        cells: isRiskClassFiltered
          ? [{ expected_value: 2, observed_value: 2, case_count: 1, within_threshold: true }]
          : [
              { expected_value: 2, observed_value: 2, case_count: 1, within_threshold: true },
              { expected_value: 5, observed_value: 5, case_count: 1, within_threshold: true },
            ],
        matrices: {
          severity: isRiskClassFiltered
            ? [{ expected_value: 1, observed_value: 1, case_count: 1, within_threshold: true }]
            : [
                { expected_value: 1, observed_value: 1, case_count: 1, within_threshold: true },
                { expected_value: 3, observed_value: 3, case_count: 1, within_threshold: true },
              ],
          detectability: isRiskClassFiltered
            ? [{ expected_value: 2, observed_value: 2, case_count: 1, within_threshold: true }]
            : [
                { expected_value: 2, observed_value: 2, case_count: 1, within_threshold: true },
                { expected_value: 5, observed_value: 5, case_count: 1, within_threshold: true },
              ],
          product: [
            { expected_value: 4, observed_value: 4, case_count: 1, within_threshold: true },
            { expected_value: 9, observed_value: 9, case_count: 1, within_threshold: true },
          ],
        },
      },
    };
  },
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
vi.mock('../../src/services/cases', () => ({
  listCases: vi.fn(async () => ({ items: mockCases, total: mockCases.length, page: 1, page_size: 100, pages: 1 })),
  getCaseAuditTrail: vi.fn(async () => ({ items: [] })),
}));

function getMatrixDataButton(title: string) {
  const header = screen.getByRole('heading', { name: title });
  const matrixCard = header.closest('div');
  if (!matrixCard) throw new Error(`Matrix card not found for ${title}`);
  return within(matrixCard).getByRole('button', { name: '1' });
}

function expectSelectionSummary(expected: string) {
  expect(
    screen.getByText(`Risk Class, Severity and Detectability Matrices - ${expected} ▲`)
  ).toBeInTheDocument();
}

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
    useFilters.setState({
      includeExcluded: false,
      problematicOnly: false,
      selectedExpected: undefined,
      selectedObserved: undefined,
      selectedDimension: 'detectability',
      dateWindow: '3M',
      dateFrom: undefined,
      dateTo: undefined,
      riskFilter: 'all',
    });
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
    expectSelectionSummary('P: 0 selected, S: 0 selected, D: 0 selected');
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

  it('clears severity selection when selecting a risk class cell', () => {
    renderMatrixDashboard();

    fireEvent.click(getMatrixDataButton('Severity Matrix'));
    expectSelectionSummary('P: 0 selected, S: 1 selected, D: 0 selected');

    fireEvent.click(getMatrixDataButton('Risk Class Matrix'));
    expectSelectionSummary('P: 1 selected, S: 0 selected, D: 0 selected');
  });

  it('allows severity selection after selecting a risk class cell', () => {
    renderMatrixDashboard();

    fireEvent.click(getMatrixDataButton('Risk Class Matrix'));
    expectSelectionSummary('P: 1 selected, S: 0 selected, D: 0 selected');

    fireEvent.click(getMatrixDataButton('Severity Matrix'));
    expectSelectionSummary('P: 1 selected, S: 1 selected, D: 0 selected');
  });

  it('clears severity and detectability selections when risk filter changes', () => {
    renderMatrixDashboard();

    fireEvent.click(getMatrixDataButton('Severity Matrix'));
    fireEvent.click(getMatrixDataButton('Detectability Matrix'));
    fireEvent.click(getMatrixDataButton('Risk Class Matrix'));
    expectSelectionSummary('P: 1 selected, S: 0 selected, D: 0 selected');

    fireEvent.click(screen.getByRole('button', { name: 'False Low' }));
    expectSelectionSummary('P: 0 selected, S: 0 selected, D: 0 selected');
  });

  it('filters severity and detectability matrices when risk class selection is active', () => {
    renderMatrixDashboard();

    expect(screen.getByRole('button', { name: '3' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '5' })).toBeInTheDocument();

    fireEvent.click(getMatrixDataButton('Risk Class Matrix'));

    expect(screen.queryByRole('button', { name: '3' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '5' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '1' }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole('button', { name: '2' }).length).toBeGreaterThan(0);
  });
});
