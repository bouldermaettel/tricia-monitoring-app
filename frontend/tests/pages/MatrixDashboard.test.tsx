// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MatrixDashboard } from '../../src/pages/MatrixDashboard';
import { useFilters } from '../../src/state/filters';
import { useImportOverride } from '../../src/state/importOverride';

const useAuthMock = vi.fn();
const matrixRequests = vi.hoisted(() => [] as Array<Record<string, unknown>>);
type MockCase = {
  id: string;
  vk_number: string;
  wimi_shortcut?: string;
  date_reported?: string;
  device_name: string;
  tricia_s: number;
  tricia_p: number;
  user_s: number;
  tricia_d: number;
  user_d: number;
  category_code?: string;
  is_excluded: boolean;
  is_reviewed: boolean;
  comment_text?: string;
  analysis_date: string;
  validation_status?: string;
  expected_class?: number;
  observed_class?: number;
  problem_flag?: boolean;
};

const baseMockCases: MockCase[] = [
  {
    id: 'case-1',
    vk_number: 'VK-1',
    wimi_shortcut: 'abc',
    date_reported: '2026-05-01',
    device_name: 'Device A',
    tricia_s: 1,
    tricia_p: 5,
    user_s: 1,
    tricia_d: 2,
    user_d: 2,
    category_code: 'monitor',
    is_excluded: false,
    is_reviewed: false,
    comment_text: '',
    analysis_date: '2026-05-01',
  },
  {
    id: 'case-2',
    vk_number: 'VK-2',
    wimi_shortcut: 'def',
    date_reported: '2026-04-15',
    device_name: 'Device B',
    tricia_s: 1,
    tricia_p: 5,
    user_s: 8,
    tricia_d: 5,
    user_d: 10,
    category_code: 'problem',
    is_excluded: false,
    is_reviewed: false,
    comment_text: '',
    analysis_date: '2026-04-15',
  },
];
let currentCases: MockCase[] = [...baseMockCases];
let lastUseCasesParams: Record<string, unknown> | undefined;
const activeClients: QueryClient[] = [];
const activeUnmounts: Array<() => void> = [];

function mockSession(role: 'admin' | 'user') {
  useAuthMock.mockReturnValue({
    session: {
      actorId: `${role}-1`,
      externalKey: `${role}-1`,
      displayName: role === 'admin' ? 'Matrix Admin' : 'Matrix User',
      role,
    },
  });
}

function filterMockCases(params?: Record<string, unknown>) {
  let items = currentCases;

  if (!params?.include_excluded) {
    items = items.filter((item) => !item.is_excluded);
  }

  if (typeof params?.wimi_shortcut === 'string' && params.wimi_shortcut.trim()) {
    const needle = params.wimi_shortcut.trim().toLowerCase();
    items = items.filter((item) => (item.wimi_shortcut ?? '').toLowerCase().includes(needle));
  }

  if (typeof params?.start_date === 'string' && params.start_date) {
    const startDate = params.start_date;
    items = items.filter((item) => (item.analysis_date ?? '') >= startDate);
  }

  if (typeof params?.end_date === 'string' && params.end_date) {
    const endDate = params.end_date;
    items = items.filter((item) => (item.analysis_date ?? '') <= endDate);
  }

  if (params?.risk_direction === 'false_low') {
    items = items.filter((item) => item.user_s * item.user_d * item.tricia_p > item.tricia_s * item.tricia_d * item.tricia_p);
  } else if (params?.risk_direction === 'false_high') {
    items = items.filter((item) => item.user_s * item.user_d * item.tricia_p < item.tricia_s * item.tricia_d * item.tricia_p);
  }

  if (params?.problematic_only) {
    items = items.filter((item) => ('problem_flag' in item ? Boolean(item.problem_flag) : item.id === 'case-2'));
  }

  if (params?.matrix_dimension === 'product') {
    const expected = Number(params?.expected_value);
    const observed = Number(params?.observed_value);
    items = items.filter(
      (item) => item.user_s * item.user_d * item.tricia_p === expected && item.tricia_s * item.tricia_d * item.tricia_p === observed
    );
  }

  if (params?.matrix_dimension === 'severity') {
    const expected = Number(params?.expected_value);
    const observed = Number(params?.observed_value);
    items = items.filter((item) => item.user_s === expected && item.tricia_s === observed);
  }

  if (params?.matrix_dimension === 'detectability') {
    const expected = Number(params?.expected_value);
    const observed = Number(params?.observed_value);
    items = items.filter((item) => item.user_d === expected && item.tricia_d === observed);
  }

  return items;
}

vi.mock('../../src/app/auth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../src/hooks/useMatrix', () => ({
  useMatrix: (params?: Record<string, unknown>, options?: { enabled?: boolean }) => {
    const enabled = options?.enabled ?? true;
    if (!enabled) return { data: undefined };

    matrixRequests.push(params ?? {});
    const isCrossDimensionFiltered = Boolean(params?.risk_cells || params?.severity_cells || params?.detectability_cells);
    return {
      data: {
        cells: isCrossDimensionFiltered
          ? [{ expected_value: 2, observed_value: 2, case_count: 1, within_threshold: true }]
          : [
              { expected_value: 2, observed_value: 2, case_count: 1, within_threshold: true },
              { expected_value: 5, observed_value: 5, case_count: 1, within_threshold: true },
            ],
        matrices: {
          severity: isCrossDimensionFiltered
            ? [{ expected_value: 1, observed_value: 1, case_count: 1, within_threshold: true }]
            : [
                { expected_value: 1, observed_value: 1, case_count: 1, within_threshold: true },
                { expected_value: 3, observed_value: 3, case_count: 1, within_threshold: true },
              ],
          detectability: isCrossDimensionFiltered
            ? [{ expected_value: 1, observed_value: 1, case_count: 1, within_threshold: true }]
            : [
                { expected_value: 2, observed_value: 2, case_count: 1, within_threshold: true },
                { expected_value: 5, observed_value: 5, case_count: 1, within_threshold: true },
              ],
          product: [
            { expected_value: 400, observed_value: 25, case_count: 1, within_threshold: false },
            { expected_value: 9, observed_value: 9, case_count: 1, within_threshold: true },
          ],
          probability: isCrossDimensionFiltered
            ? [{ expected_value: 1, observed_value: 5, case_count: 1, within_threshold: false }]
            : [
                { expected_value: 1, observed_value: 5, case_count: 1, within_threshold: false },
                { expected_value: 10, observed_value: 10, case_count: 1, within_threshold: true },
              ],
        },
      },
    };
  },
}));
vi.mock('../../src/hooks/useCases', () => ({
  useCases: (params?: Record<string, unknown>) => {
    lastUseCasesParams = params;
    const items = filterMockCases(params);

    const total = items.length;
    const pageSize = params?.all ? total : Number(params?.page_size ?? total ?? 1);
    const page = Number(params?.page ?? 1);
    const paginatedItems = items.slice((page - 1) * pageSize, page * pageSize);

    return { data: { items: paginatedItems, total, page, page_size: pageSize } };
  },
  usePatchCaseReview: () => ({ mutate: vi.fn() }),
  useAddCaseComment: () => ({ mutate: vi.fn() }),
  useUpdateCase: () => ({ mutate: vi.fn(), mutateAsync: vi.fn() }),
  useDeleteCase: () => ({ mutate: vi.fn() }),
  useCaseAuditTrail: () => ({ data: { items: [] }, isLoading: false }),
}));
const updateThresholdsMock = vi.fn();

vi.mock('../../src/hooks/useThresholds', () => ({
  useThresholds: () => ({
    data: {
      acceptance_threshold: 1,
      risk_categories: [
        { label: 'Very Low', min_value: 0, max_value: 10 },
        { label: 'Moderate', min_value: 11, max_value: 250 },
        { label: 'Elevated', min_value: 251, max_value: 500 },
        { label: 'Critical', min_value: 501, max_value: 1000 },
      ],
    },
  }),
  useUpdateThresholds: () => ({ mutate: updateThresholdsMock, isPending: false }),
}));
vi.mock('../../src/components/matrix/MatrixReportExportButton', () => ({
  MatrixReportExportButton: () => null,
}));
vi.mock('../../src/components/common/ExportButton', () => ({
  ExportButton: () => null,
}));
vi.mock('../../src/services/cases', () => ({
  listCases: vi.fn(async (params?: Record<string, unknown>) => {
    const items = filterMockCases(params);

    const total = items.length;
    const pageSize = params?.all ? total : Number(params?.page_size ?? total ?? 1);
    const page = Number(params?.page ?? 1);
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total, page, page_size: pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
  }),
  getCaseAuditTrail: vi.fn(async () => ({ items: [] })),
}));

function getMatrixDataButton(title: string) {
  const header = screen.getByRole('heading', { name: title });
  const matrixCard = header.closest('div');
  if (!matrixCard) throw new Error(`Matrix card not found for ${title}`);
  const button = within(matrixCard)
    .getAllByRole('button')
    .find((candidate) => !candidate.hasAttribute('disabled'));
  if (!button) throw new Error(`Enabled matrix cell not found for ${title}`);
  return button;
}

function expectSelectionSummary(expected: string) {
  expect(
    screen.getByText(`Risk Class, Severity and Detectability Matrices - ${expected} ▲`)
  ).toBeInTheDocument();
}

function renderMatrixDashboard() {
  const client = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
      },
      mutations: {
        retry: false,
        gcTime: 0,
      },
    },
  });
  activeClients.push(client);
  const rendered = render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <MatrixDashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
  activeUnmounts.push(rendered.unmount);
}

function getColumnFilterInput(columnLabel: string) {
  const headerLabel = screen.getByText(columnLabel);
  const th = headerLabel.closest('th');
  if (!th) {
    throw new Error(`Column header cell not found for ${columnLabel}`);
  }
  return within(th).getByPlaceholderText('Filter...');
}

describe('MatrixDashboard', () => {
  beforeEach(() => {
    currentCases = [...baseMockCases];
    matrixRequests.length = 0;
    lastUseCasesParams = undefined;
    updateThresholdsMock.mockReset();
    useImportOverride.getState().clearPreviewData();
    if (!('createObjectURL' in URL)) {
      Object.defineProperty(URL, 'createObjectURL', {
        writable: true,
        value: vi.fn(() => 'blob:matrix-export'),
      });
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:matrix-export');
    }
    if (!('revokeObjectURL' in URL)) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        writable: true,
        value: vi.fn(),
      });
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    }
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
    mockSession('user');
  });

  afterEach(() => {
    activeUnmounts.splice(0).forEach((unmount) => unmount());
    activeClients.splice(0).forEach((client) => client.clear());
    useImportOverride.getState().clearPreviewData();
    vi.restoreAllMocks();
  });

  it('renders matrix view widgets', () => {
    renderMatrixDashboard();

    expect(screen.getByText('Matrix Dashboard')).toBeInTheDocument();
    expectSelectionSummary('P: 0 selected, S: 0 selected, D: 0 selected');
    expect(screen.getByText('Severity Matrix')).toBeInTheDocument();
    expect(screen.getByText('Probability Matrix')).toBeInTheDocument();
    expect(screen.getByText('Detectability Matrix')).toBeInTheDocument();
    expect(screen.getByText('Risk Class Matrix')).toBeInTheDocument();
    const riskPanel = screen.getByTestId('risk-class-matrix-panel');
    expect(within(riskPanel).getByText('Very Low (0-10)')).toBeInTheDocument();
    expect(screen.getAllByText('Very Low (0-10)')).toHaveLength(1);
  });

  it('shows settings only to admins', () => {
    renderMatrixDashboard();
    expect(screen.queryByRole('button', { name: 'Settings' })).not.toBeInTheDocument();

    cleanup();

    mockSession('admin');
    renderMatrixDashboard();

    expect(screen.getByRole('button', { name: 'Settings' })).toBeInTheDocument();
  });

  it('preserves custom risk category names in settings and matrix labels', () => {
    mockSession('admin');
    renderMatrixDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }));

    const nameInput = screen.getByLabelText('category-1-label');
    expect(nameInput).toHaveValue('Very Low');

    fireEvent.change(nameInput, { target: { value: 'Field Review' } });
    fireEvent.blur(nameInput);

    expect(screen.getByDisplayValue('Field Review')).toBeInTheDocument();
    expect(within(screen.getByTestId('risk-class-matrix-panel')).getByText('Field Review (0-10)')).toBeInTheDocument();
    expect(screen.getAllByText('Field Review').length).toBeGreaterThan(1);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    expect(updateThresholdsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        risk_categories: expect.arrayContaining([
          expect.objectContaining({
            label: 'Field Review',
            min_value: 0,
            max_value: 10,
          }),
        ]),
      })
    );
  });

  it('shows delete controls only to admins', () => {
    renderMatrixDashboard();
    expect(screen.queryByLabelText('select-all-visible-cases')).not.toBeInTheDocument();

    cleanup();

    mockSession('admin');

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
    expectSelectionSummary('P: 1 selected, S: 0 selected, D: 0 selected');
  });

  it('shows empty table for False High when no matching cases exist', () => {
    renderMatrixDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'False High' }));

    expect(screen.getByText('No cases for the selected filters.')).toBeInTheDocument();
  });

  it('keeps table empty when Problematic only has no matches in active risk filter', () => {
    renderMatrixDashboard();

    fireEvent.click(screen.getByRole('button', { name: 'False High' }));
    fireEvent.click(screen.getByLabelText('Problematic only'));

    expect(screen.getByText('No cases for the selected filters.')).toBeInTheDocument();
  });

  it('uses preview problem flags for override problematic counts', () => {
    useImportOverride.getState().setPreviewData({
      sourceFileName: 'sample.csv',
      sourceFile: new File(['csv'], 'sample.csv', { type: 'text/csv' }),
      cases: [
        {
          id: 'preview-1',
          vk_number: 'VK-1',
          device_name: 'Preview A',
          analysis_date: '2026-05-01',
          validation_status: 'saved',
          tricia_s: 1,
          tricia_p: 5,
          tricia_d: 1,
          user_s: 1,
          user_d: 1,
          is_excluded: false,
          is_reviewed: false,
          problem_flag: false,
        },
        {
          id: 'preview-2',
          vk_number: 'VK-2',
          device_name: 'Preview B',
          analysis_date: '2026-05-02',
          validation_status: 'saved',
          tricia_s: 3,
          tricia_p: 5,
          tricia_d: 1,
          user_s: 1,
          user_d: 1,
          is_excluded: false,
          is_reviewed: false,
          problem_flag: true,
        },
      ],
      controlItems: [],
    });

    renderMatrixDashboard();

    expect(screen.getByText('#Problematic: 1')).toBeInTheDocument();

    fireEvent.click(screen.getByLabelText('Problematic only'));

    expect(screen.getByText('#Problematic: 1')).toBeInTheDocument();
    expect(screen.getByText('VK-2')).toBeInTheDocument();
    expect(screen.queryByText('VK-1')).not.toBeInTheDocument();
  });

  it('keeps problematic count stable across risk filters and includes omitted cases when Include omitted is enabled', () => {
    currentCases = [
      {
        ...baseMockCases[0],
        id: 'problem-false-low',
        vk_number: 'VK-FL',
        tricia_s: 1,
        tricia_p: 5,
        tricia_d: 1,
        user_s: 8,
        user_d: 10,
        is_excluded: false,
        problem_flag: true,
      },
      {
        ...baseMockCases[1],
        id: 'problem-false-high',
        vk_number: 'VK-FH',
        tricia_s: 8,
        tricia_p: 5,
        tricia_d: 10,
        user_s: 1,
        user_d: 1,
        is_excluded: false,
        problem_flag: true,
      },
      {
        ...baseMockCases[1],
        id: 'problem-excluded',
        vk_number: 'VK-EXCLUDED',
        is_excluded: true,
        problem_flag: true,
      },
    ];

    useFilters.setState({
      includeExcluded: true,
      problematicOnly: false,
      selectedExpected: undefined,
      selectedObserved: undefined,
      selectedDimension: 'detectability',
      dateWindow: 'ALL',
      dateFrom: undefined,
      dateTo: undefined,
      riskFilter: 'all',
    });

    renderMatrixDashboard();

    expect(screen.getByText('#Problematic: 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'False Low' }));
    expect(screen.getByText('#Problematic: 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'False High' }));
    expect(screen.getByText('#Problematic: 3')).toBeInTheDocument();
  });

  it('excludes omitted cases from problematic count when Include omitted is disabled', () => {
    currentCases = [
      {
        ...baseMockCases[0],
        id: 'problem-false-low',
        vk_number: 'VK-FL',
        tricia_s: 1,
        tricia_p: 5,
        tricia_d: 1,
        user_s: 8,
        user_d: 10,
        is_excluded: false,
        problem_flag: true,
      },
      {
        ...baseMockCases[1],
        id: 'problem-false-high',
        vk_number: 'VK-FH',
        tricia_s: 8,
        tricia_p: 5,
        tricia_d: 10,
        user_s: 1,
        user_d: 1,
        is_excluded: false,
        problem_flag: true,
      },
      {
        ...baseMockCases[1],
        id: 'problem-excluded',
        vk_number: 'VK-EXCLUDED',
        is_excluded: true,
        problem_flag: true,
      },
    ];

    useFilters.setState({
      includeExcluded: false,
      problematicOnly: false,
      selectedExpected: undefined,
      selectedObserved: undefined,
      selectedDimension: 'detectability',
      dateWindow: 'ALL',
      dateFrom: undefined,
      dateTo: undefined,
      riskFilter: 'all',
    });

    renderMatrixDashboard();

    expect(screen.getByText('#Problematic: 2')).toBeInTheDocument();
  });

  it('shows only the triggered period classes in All Time mode', async () => {
    currentCases = Array.from({ length: 11 }, (_, index) => ({
      ...baseMockCases[1],
      id: `problem-${index + 1}`,
      vk_number: `VK-PROBLEM-${index + 1}`,
      analysis_date: '2026-06-01',
      date_reported: '2026-06-01',
      problem_flag: true,
    }));

    useFilters.setState({
      includeExcluded: false,
      problematicOnly: false,
      selectedExpected: undefined,
      selectedObserved: undefined,
      selectedDimension: 'detectability',
      dateWindow: 'ALL',
      dateFrom: undefined,
      dateTo: undefined,
      riskFilter: 'all',
    });

    renderMatrixDashboard();

    expect(await screen.findByText('#Problematic: 11 (Triggered: 3M)')).toBeInTheDocument();
  });

  it('shows triggered period classes in Custom mode', async () => {
    currentCases = Array.from({ length: 11 }, (_, index) => ({
      ...baseMockCases[1],
      id: `custom-problem-${index + 1}`,
      vk_number: `VK-CUSTOM-${index + 1}`,
      analysis_date: '2026-06-01',
      date_reported: '2026-06-01',
      problem_flag: true,
    }));

    useFilters.setState({
      includeExcluded: false,
      problematicOnly: false,
      selectedExpected: undefined,
      selectedObserved: undefined,
      selectedDimension: 'detectability',
      dateWindow: 'CUSTOM',
      dateFrom: '2026-05-01',
      dateTo: '2026-06-11',
      riskFilter: 'all',
    });

    renderMatrixDashboard();

    expect(await screen.findByText('#Problematic: 11 (Triggered: 3M)')).toBeInTheDocument();
  });

  it('does not show 6M trigger when custom range is under 3 months', async () => {
    const today = new Date().toISOString().slice(0, 10);
    currentCases = Array.from({ length: 25 }, (_, index) => ({
      ...baseMockCases[1],
      id: `custom-short-${index + 1}`,
      vk_number: `VK-CUSTOM-SHORT-${index + 1}`,
      analysis_date: today,
      date_reported: today,
      problem_flag: true,
    }));

    useFilters.setState({
      includeExcluded: false,
      problematicOnly: false,
      selectedExpected: undefined,
      selectedObserved: undefined,
      selectedDimension: 'detectability',
      dateWindow: 'CUSTOM',
      dateFrom: today,
      dateTo: today,
      riskFilter: 'all',
    });

    renderMatrixDashboard();

    expect(await screen.findByText('#Problematic: 25 (Triggered: 3M)')).toBeInTheDocument();
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

  it('requests a cross-filtered probability matrix without using probability as its own filter', async () => {
    renderMatrixDashboard();

    fireEvent.click(getMatrixDataButton('Severity Matrix'));
    await waitFor(() => {
      expect(matrixRequests).toEqual(expect.arrayContaining([
        expect.objectContaining({ severity_cells: expect.any(String) }),
      ]));
    });
    expect(matrixRequests.some((params) => Boolean(params.severity_cells) && !params.probability_cells)).toBe(true);

    fireEvent.click(getMatrixDataButton('Detectability Matrix'));
    await waitFor(() => {
      expect(matrixRequests.some((params) => Boolean(params.detectability_cells) && !params.probability_cells)).toBe(true);
    });

    fireEvent.click(getMatrixDataButton('RISK Matrix'));
    await waitFor(() => {
      expect(matrixRequests.some((params) => Boolean(params.risk_cells) && !params.probability_cells)).toBe(true);
    });
  });

  it('shows the total case count and paginates beyond the first 50 rows', () => {
    currentCases = Array.from({ length: 51 }, (_, index) => ({
      ...baseMockCases[0],
      id: `case-${index + 1}`,
      vk_number: `VK-${index + 1}`,
      device_name: `Device ${index + 1}`,
      date_reported: '2026-05-01',
      analysis_date: '2026-05-01',
    }));

    renderMatrixDashboard();

    expect(screen.getByText('Showing 50 of 50 loaded cases (51 total)')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('VK-50')).toBeInTheDocument();
    expect(screen.queryByText('VK-51')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Showing 1 of 1 loaded cases (51 total)')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    expect(screen.getByText('VK-51')).toBeInTheDocument();
  });

  it('lets matrix-filtered results change page size and switch to All', () => {
    currentCases = Array.from({ length: 51 }, (_, index) => ({
      ...baseMockCases[0],
      id: `case-${index + 1}`,
      vk_number: `VK-${index + 1}`,
      device_name: `Device ${index + 1}`,
      tricia_s: 1,
      tricia_p: 5,
      user_s: 1,
      tricia_d: 2,
      user_d: 2,
      date_reported: '2026-05-01',
      analysis_date: '2026-05-01',
    }));

    renderMatrixDashboard();

    fireEvent.click(getMatrixDataButton('Severity Matrix'));

    expect(screen.getByText('Showing 50 of 50 loaded cases (51 total)')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
    expect(screen.getByText('VK-50')).toBeInTheDocument();
    expect(screen.queryByText('VK-51')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '25' }));

    expect(screen.getByText('Showing 25 of 25 loaded cases (51 total)')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(screen.getByText('VK-26')).toBeInTheDocument();
    expect(screen.queryByText('VK-51')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'All' }));

    expect(screen.queryByText(/Page \d+ of \d+/)).not.toBeInTheDocument();
    expect(screen.getByText('VK-51')).toBeInTheDocument();
    expect(lastUseCasesParams).toMatchObject({
      all: true,
      matrix_dimension: 'severity',
      expected_value: 1,
      observed_value: 1,
    });
  });

  it('applies WIMI filter across all pages, not only loaded rows', () => {
    currentCases = Array.from({ length: 51 }, (_, index) => ({
      ...baseMockCases[0],
      id: `case-${index + 1}`,
      vk_number: `VK-${index + 1}`,
      wimi_shortcut: index === 50 ? 'mam' : 'other',
      device_name: `Device ${index + 1}`,
      date_reported: '2026-05-01',
      analysis_date: '2026-05-01',
    }));

    renderMatrixDashboard();

    expect(screen.queryByText('VK-51')).not.toBeInTheDocument();

    fireEvent.change(getColumnFilterInput('WIMI'), { target: { value: 'mam' } });

    expect(lastUseCasesParams).toMatchObject({
      wimi_shortcut: 'mam',
      page: 1,
      page_size: 50,
    });
  });
});
