import { useCallback, useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/common/AppShell';
import { ExportButton } from '../components/common/ExportButton';
import { ThresholdConfigPanel } from '../components/common/ThresholdConfigPanel';
import { CaseTable, type CaseTableServerFilters } from '../components/matrix/CaseTable';
import { ConfusionMatrixGrid } from '../components/matrix/ConfusionMatrixGrid';
import { FilterPanel } from '../components/matrix/FilterPanel';
import { MatrixReportExportButton } from '../components/matrix/MatrixReportExportButton';
import { useAuth } from '../app/auth';
import { usePatchCaseReview, useCases, useAddCaseComment, useUpdateCase, useDeleteCase } from '../hooks/useCases';
import { useMatrix } from '../hooks/useMatrix';
import { MatrixDimension, RiskFilter, useFilters } from '../state/filters';
import { useImportOverride } from '../state/importOverride';
import { listCases, getCaseAuditTrail } from '../services/cases';
import { useThresholds } from '../hooks/useThresholds';

function getDateParams(window: string, dateFrom?: string, dateTo?: string) {
  if (window === 'ALL') return {};
  if (window === 'CUSTOM') {
    return { start_date: dateFrom, end_date: dateTo };
  }
  const months = window === '3M' ? 3 : window === '6M' ? 6 : 12;
  const to = new Date();
  const from = new Date();
  from.setMonth(from.getMonth() - months);
  return {
    start_date: from.toISOString().slice(0, 10),
    end_date: to.toISOString().slice(0, 10),
  };
}

const PERIOD_WINDOWS: Array<'3M' | '6M' | '12M'> = ['3M', '6M', '12M'];
const SEVERITY_AXIS_VALUES = [1, 3, 5, 8, 10];
const DETECTABILITY_AXIS_VALUES = [1, 5, 10];
const CASES_PAGE_SIZE = 50;

type MatrixCell = {
  expected_value: number;
  observed_value: number;
  case_count: number;
  within_threshold: boolean;
};

type RiskCategory = {
  label: string;
  min_value: number;
  max_value: number;
};

type ProblematicCaseThresholds = {
  '3M': number;
  '6M': number;
  '12M': number;
};

const DEFAULT_RISK_CATEGORIES: RiskCategory[] = [
  { label: '0-10', min_value: 0, max_value: 10 },
  { label: '11-250', min_value: 11, max_value: 250 },
  { label: '251-500', min_value: 251, max_value: 500 },
  { label: '501-1000', min_value: 501, max_value: 1000 },
];

function normalizeRiskCategories(input: unknown): RiskCategory[] {
  if (!Array.isArray(input) || input.length === 0) return DEFAULT_RISK_CATEGORIES;

  const normalized = input
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null;
      const candidate = item as Partial<RiskCategory>;
      const minValue = Number(candidate.min_value);
      const maxValue = Number(candidate.max_value);
      if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) return null;
      return {
        label: (candidate.label ?? `Category ${index + 1}`).toString(),
        min_value: Math.max(0, Math.trunc(minValue)),
        max_value: Math.max(0, Math.trunc(maxValue)),
      };
    })
    .filter((item): item is RiskCategory => item !== null)
    .sort((a, b) => a.min_value - b.min_value);

  return normalized.length > 0 ? normalized : DEFAULT_RISK_CATEGORIES;
}

function normalizeProblematicCaseThresholds(input: unknown): ProblematicCaseThresholds {
  if (!input || typeof input !== 'object') {
    return { '3M': 10, '6M': 20, '12M': 40 };
  }

  const candidate = input as Partial<Record<'3M' | '6M' | '12M', unknown>>;
  return {
    '3M': Number.isFinite(Number(candidate['3M'])) ? Math.max(0, Math.trunc(Number(candidate['3M']))) : 10,
    '6M': Number.isFinite(Number(candidate['6M'])) ? Math.max(0, Math.trunc(Number(candidate['6M']))) : 20,
    '12M': Number.isFinite(Number(candidate['12M'])) ? Math.max(0, Math.trunc(Number(candidate['12M']))) : 40,
  };
}

function resolveRiskCategoryIndex(value: number, categories: RiskCategory[]): number | null {
  const categoryIndex = categories.findIndex((category) => value >= category.min_value && value <= category.max_value);
  return categoryIndex >= 0 ? categoryIndex + 1 : null;
}

function buildRiskClassMatrix(
  cells: MatrixCell[],
  categories: RiskCategory[],
  acceptanceThreshold: number
): {
  cells: MatrixCell[];
  groupedToRawCellMap: Map<string, Array<{ expected: number; observed: number }>>;
} {
  const groupedMap = new Map<string, MatrixCell>();
  const groupedToRawCellMap = new Map<string, Array<{ expected: number; observed: number }>>();
  const classCount = categories.length;

  cells.forEach((cell) => {
    const expectedCategory = resolveRiskCategoryIndex(cell.expected_value, categories);
    const observedCategory = resolveRiskCategoryIndex(cell.observed_value, categories);
    if (expectedCategory === null || observedCategory === null || cell.case_count <= 0) return;

    const key = `${expectedCategory}-${observedCategory}`;
    const withinThreshold = Math.abs(expectedCategory - observedCategory) <= acceptanceThreshold;
    const existing = groupedMap.get(key);
    if (existing) {
      existing.case_count += cell.case_count;
      existing.within_threshold = withinThreshold;
    } else {
      groupedMap.set(key, {
        expected_value: expectedCategory,
        observed_value: observedCategory,
        case_count: cell.case_count,
        within_threshold: withinThreshold,
      });
    }

    const rawPairs = groupedToRawCellMap.get(key) ?? [];
    rawPairs.push({ expected: cell.expected_value, observed: cell.observed_value });
    groupedToRawCellMap.set(key, rawPairs);
  });

  // Force a complete matrix so every configured class combination is visible.
  for (let expectedClass = 1; expectedClass <= classCount; expectedClass += 1) {
    for (let observedClass = 1; observedClass <= classCount; observedClass += 1) {
      const key = `${expectedClass}-${observedClass}`;
      if (!groupedMap.has(key)) {
        groupedMap.set(key, {
          expected_value: expectedClass,
          observed_value: observedClass,
          case_count: 0,
          within_threshold: Math.abs(expectedClass - observedClass) <= acceptanceThreshold,
        });
      }
    }
  }

  return {
    cells: Array.from(groupedMap.values()).sort((a, b) => {
      if (a.expected_value !== b.expected_value) return a.expected_value - b.expected_value;
      return a.observed_value - b.observed_value;
    }),
    groupedToRawCellMap,
  };
}

function isOverrideCaseProblematic(
  item: {
    tricia_s: number;
    tricia_p: number;
    tricia_d: number;
    user_s: number;
    user_d: number;
  },
  categories: RiskCategory[],
  acceptanceThreshold: number
): boolean {
  const expectedClass = resolveRiskCategoryIndex(item.user_s * item.user_d * item.tricia_p, categories);
  const observedClass = resolveRiskCategoryIndex(item.tricia_s * item.tricia_d * item.tricia_p, categories);
  if (expectedClass === null || observedClass === null) return false;
  return Math.abs(expectedClass - observedClass) > acceptanceThreshold;
}

function matchesRiskDirection(expectedClass: number, observedClass: number, riskFilter: RiskFilter): boolean {
  if (riskFilter === 'all') return true;
  if (riskFilter === 'false_low') return expectedClass > observedClass;
  return expectedClass < observedClass;
}

function getProductRiskSelection(cells: MatrixCell[], riskFilter: RiskFilter): Array<{ expected: number; observed: number }> {
  if (riskFilter === 'all') return [];
  return cells
    .filter((cell) => cell.case_count > 0)
    .filter((cell) => matchesRiskDirection(cell.expected_value, cell.observed_value, riskFilter))
    .map((cell) => ({ expected: cell.expected_value, observed: cell.observed_value }));
}

function buildLocalMatrixCells(
  items: Array<{ expected: number; observed: number }>,
  acceptanceThreshold: number
) {
  const map = new Map<string, { expected_value: number; observed_value: number; case_count: number; within_threshold: boolean }>();
  items.forEach(({ expected, observed }) => {
    const key = `${expected}-${observed}`;
    const existing = map.get(key);
    if (existing) {
      existing.case_count += 1;
      return;
    }
    map.set(key, {
      expected_value: expected,
      observed_value: observed,
      case_count: 1,
      within_threshold: Math.abs(expected - observed) <= acceptanceThreshold,
    });
  });
  return Array.from(map.values());
}

export function MatrixDashboard() {
  const { session } = useAuth();
  const canDeleteCases = session?.role === 'admin';
  const [searchParams, setSearchParams] = useSearchParams();
  const [collapsedProduct, setCollapsedProduct] = useState(false);
  const [casePage, setCasePage] = useState(1);
  const [tableServerFilters, setTableServerFilters] = useState<CaseTableServerFilters>({});
  const [exportState, setExportState] = useState<{ columns: string[]; rows: Array<Record<string, unknown>> }>({
    columns: [],
    rows: [],
  });
  const overrideCases = useImportOverride((s) => s.cases);
  const overrideSourceFile = useImportOverride((s) => s.sourceFileName);
  const clearPreviewData = useImportOverride((s) => s.clearPreviewData);
  const isOverrideActive = Boolean(overrideSourceFile);
  const [selectedCellsByDimension, setSelectedCellsByDimension] = useState<
    Record<MatrixDimension, Array<{ expected: number; observed: number }>>
  >({
    severity: [],
    detectability: [],
    product: [],
  });

  const includeExcluded = useFilters((s) => s.includeExcluded);
  const problematicOnly = useFilters((s) => s.problematicOnly);
  const dateWindow = useFilters((s) => s.dateWindow);
  const dateFrom = useFilters((s) => s.dateFrom);
  const dateTo = useFilters((s) => s.dateTo);
  const riskFilter = useFilters((s) => s.riskFilter);
  const setIncludeExcluded = useFilters((s) => s.setIncludeExcluded);
  const setProblematicOnly = useFilters((s) => s.setProblematicOnly);
  const setDateWindow = useFilters((s) => s.setDateWindow);
  const setCustomDateRange = useFilters((s) => s.setCustomDateRange);
  const setRiskFilter = useFilters((s) => s.setRiskFilter);
  const requestedVkNumber = (searchParams.get('vk_number') ?? '').trim();

  useEffect(() => {
    if (!requestedVkNumber) return;
    setDateWindow('ALL');
  }, [requestedVkNumber, setDateWindow]);

  const dateParams = useMemo(() => getDateParams(dateWindow, dateFrom, dateTo), [dateWindow, dateFrom, dateTo]);

  const matrix = useMatrix({
    include_excluded: includeExcluded,
    problematic_only: problematicOnly,
    ...dateParams,
  });
  const thresholds = useThresholds();
  const acceptanceThreshold = thresholds.data?.acceptance_threshold ?? 1;
  const riskCategories = useMemo(() => normalizeRiskCategories(thresholds.data?.risk_categories), [thresholds.data?.risk_categories]);
  const problematicCaseThresholds = useMemo(
    () => normalizeProblematicCaseThresholds(thresholds.data?.problematic_case_thresholds),
    [thresholds.data?.problematic_case_thresholds]
  );
  const riskDirectionParam = riskFilter === 'all' ? undefined : riskFilter;

  const sharedCaseParams = {
    include_excluded: includeExcluded,
    vk_number: requestedVkNumber || undefined,
    risk_direction: riskDirectionParam,
    ...dateParams,
  };

  const caseParams = {
    ...sharedCaseParams,
    problematic_only: problematicOnly,
  };

  const baseCases = useCases({ ...caseParams, ...tableServerFilters, page: casePage, page_size: CASES_PAGE_SIZE }, { enabled: !isOverrideActive });
  const filteredOverrideCases = useMemo(() => {
    if (!isOverrideActive) return [];
    return overrideCases.filter((item) => {
      if (!includeExcluded && item.is_excluded) return false;
      const expectedClass = resolveRiskCategoryIndex(item.user_s * item.user_d * item.tricia_p, riskCategories);
      const observedClass = resolveRiskCategoryIndex(item.tricia_s * item.tricia_d * item.tricia_p, riskCategories);
      if (expectedClass === null || observedClass === null) return false;
      if (!matchesRiskDirection(expectedClass, observedClass, riskFilter)) return false;
      if (
        problematicOnly &&
        Math.abs(expectedClass - observedClass) <= acceptanceThreshold
      ) {
        return false;
      }
      if (requestedVkNumber && item.vk_number !== requestedVkNumber) return false;
      if (dateParams.start_date && item.analysis_date < String(dateParams.start_date)) return false;
      if (dateParams.end_date && item.analysis_date > String(dateParams.end_date)) return false;
      return true;
    });
  }, [acceptanceThreshold, dateParams.end_date, dateParams.start_date, includeExcluded, isOverrideActive, overrideCases, problematicOnly, requestedVkNumber, riskCategories, riskFilter]);

  const problematicCasesQuery = useCases(
    {
      ...sharedCaseParams,
      problematic_only: true,
      page_size: 1,
    },
    { enabled: !isOverrideActive }
  );

  const problematicPeriodQueries = useQueries({
    queries: isOverrideActive
      ? []
      : PERIOD_WINDOWS.map((window) => ({
          queryKey: ['cases', { ...sharedCaseParams, problematic_only: true, ...getDateParams(window), page_size: 1 }, 'problematic-period', window],
          queryFn: () =>
            listCases({
              ...sharedCaseParams,
              problematic_only: true,
              ...getDateParams(window),
              page_size: 1,
            }),
        })),
  });

  const problematicCaseCount = useMemo(() => {
    if (!isOverrideActive) {
      return problematicCasesQuery.data?.total ?? 0;
    }
    return filteredOverrideCases.length;
  }, [filteredOverrideCases.length, isOverrideActive, problematicCasesQuery.data?.total]);

  const problematicCountsByPeriod = useMemo(() => {
    if (!isOverrideActive) {
      return {
        '3M': problematicPeriodQueries[0]?.data?.total ?? 0,
        '6M': problematicPeriodQueries[1]?.data?.total ?? 0,
        '12M': problematicPeriodQueries[2]?.data?.total ?? 0,
      };
    }

    const countForWindow = (window: '3M' | '6M' | '12M') => {
      const params = getDateParams(window);
      return filteredOverrideCases.filter((item) => {
        if (params.start_date && item.analysis_date < String(params.start_date)) return false;
        if (params.end_date && item.analysis_date > String(params.end_date)) return false;
        return true;
      }).length;
    };

    return {
      '3M': countForWindow('3M'),
      '6M': countForWindow('6M'),
      '12M': countForWindow('12M'),
    };
  }, [filteredOverrideCases, isOverrideActive, problematicPeriodQueries]);

  const problematicCaseTarget =
    dateWindow === '3M' || dateWindow === '6M' || dateWindow === '12M'
      ? problematicCaseThresholds[dateWindow]
      : undefined;
  const triggeredPeriods =
    dateWindow === 'ALL'
      ? PERIOD_WINDOWS.filter((window) => problematicCountsByPeriod[window] > problematicCaseThresholds[window])
      : [];
  const problemAlarmActive = dateWindow === 'ALL'
    ? triggeredPeriods.length > 0
    : problematicCaseTarget !== undefined && problematicCaseCount > problematicCaseTarget;
  const problemAlarmLabel = dateWindow === 'ALL' && triggeredPeriods.length > 0
    ? `Triggered: ${triggeredPeriods.join(', ')}`
    : undefined;

  const overrideMatrices = useMemo(() => {
    if (!isOverrideActive) return { severity: [], detectability: [], product: [] };
    return {
      severity: buildLocalMatrixCells(filteredOverrideCases.map((item) => ({ expected: item.user_s, observed: item.tricia_s })), acceptanceThreshold),
      detectability: buildLocalMatrixCells(filteredOverrideCases.map((item) => ({ expected: item.user_d, observed: item.tricia_d })), acceptanceThreshold),
      product: buildLocalMatrixCells(
        filteredOverrideCases.map((item) => ({
          expected: item.user_s * item.user_d * item.tricia_p,
          observed: item.tricia_s * item.tricia_d * item.tricia_p,
        })),
        acceptanceThreshold
      ),
    };
  }, [acceptanceThreshold, filteredOverrideCases, isOverrideActive]);
  const productCells = isOverrideActive ? overrideMatrices.product : (matrix.data?.matrices?.product ?? []);
  const riskClassMatrix = useMemo(
    () => buildRiskClassMatrix(productCells, riskCategories, acceptanceThreshold),
    [acceptanceThreshold, productCells, riskCategories]
  );

  useEffect(() => {
    if (riskFilter === 'all') {
      setSelectedCellsByDimension((previous) => {
        if (previous.product.length === 0) {
          return previous;
        }
        return {
          ...previous,
          product: [],
        };
      });
      return;
    }
    const target = getProductRiskSelection(riskClassMatrix.cells, riskFilter);
    const targetSet = new Set(target.map((cell) => `${cell.expected}-${cell.observed}`));
    setSelectedCellsByDimension((previous) => {
      const currentSet = new Set(previous.product.map((cell) => `${cell.expected}-${cell.observed}`));
      const productUnchanged = targetSet.size === currentSet.size && [...targetSet].every((value) => currentSet.has(value));
      const noDimensionSelections = previous.severity.length === 0 && previous.detectability.length === 0;
      if (productUnchanged && noDimensionSelections) {
        return previous;
      }
      return {
        severity: [],
        detectability: [],
        product: target,
      };
    });
  }, [riskClassMatrix.cells, riskFilter]);

  const selectedProductRawCells = useMemo(
    () =>
      Array.from(
        new Map(
          selectedCellsByDimension.product
            .flatMap((groupedCell) => riskClassMatrix.groupedToRawCellMap.get(`${groupedCell.expected}-${groupedCell.observed}`) ?? [])
            .map((cell) => [`${cell.expected}-${cell.observed}`, cell])
        ).values()
      ),
    [riskClassMatrix.groupedToRawCellMap, selectedCellsByDimension.product]
  );

  const severityCellsParam = useMemo(
    () => selectedCellsByDimension.severity.map((c) => `${c.expected}:${c.observed}`).join(','),
    [selectedCellsByDimension.severity]
  );
  const detectabilityCellsParam = useMemo(
    () => selectedCellsByDimension.detectability.map((c) => `${c.expected}:${c.observed}`).join(','),
    [selectedCellsByDimension.detectability]
  );

  // Severity matrix display: filtered by product + detectability (everything except severity itself).
  const filteredSeverityMatrix = useMatrix(
    {
      include_excluded: includeExcluded,
      problematic_only: problematicOnly,
      ...dateParams,
      ...(selectedProductRawCells.length > 0
        ? { product_cells: selectedProductRawCells.map((c) => `${c.expected}:${c.observed}`).join(',') }
        : {}),
      ...(detectabilityCellsParam ? { detectability_cells: detectabilityCellsParam } : {}),
    },
    { enabled: !isOverrideActive && (selectedProductRawCells.length > 0 || detectabilityCellsParam.length > 0) }
  );

  // Detectability matrix display: filtered by product + severity (everything except detectability itself).
  const filteredDetectabilityMatrix = useMatrix(
    {
      include_excluded: includeExcluded,
      problematic_only: problematicOnly,
      ...dateParams,
      ...(selectedProductRawCells.length > 0
        ? { product_cells: selectedProductRawCells.map((c) => `${c.expected}:${c.observed}`).join(',') }
        : {}),
      ...(severityCellsParam ? { severity_cells: severityCellsParam } : {}),
    },
    { enabled: !isOverrideActive && (selectedProductRawCells.length > 0 || severityCellsParam.length > 0) }
  );

  // Override mode: build per-display filtered matrices using the same intersection logic.
  const filteredOverrideMatrices = useMemo(() => {
    if (!isOverrideActive) return null;
    const productSet = selectedProductRawCells.length > 0
      ? new Set(selectedProductRawCells.map((c) => `${c.expected}-${c.observed}`))
      : null;
    const severitySet = selectedCellsByDimension.severity.length > 0
      ? new Set(selectedCellsByDimension.severity.map((c) => `${c.expected}-${c.observed}`))
      : null;
    const detectabilitySet = selectedCellsByDimension.detectability.length > 0
      ? new Set(selectedCellsByDimension.detectability.map((c) => `${c.expected}-${c.observed}`))
      : null;
    if (!productSet && !severitySet && !detectabilitySet) return null;

    // For S matrix: filter by product + detectability (not severity itself).
    const casesForSeverityDisplay = filteredOverrideCases.filter((item) => {
      if (productSet && !productSet.has(`${item.user_s * item.user_d * item.tricia_p}-${item.tricia_s * item.tricia_d * item.tricia_p}`)) return false;
      if (detectabilitySet && !detectabilitySet.has(`${item.user_d}-${item.tricia_d}`)) return false;
      return true;
    });
    // For D matrix: filter by product + severity (not detectability itself).
    const casesForDetectabilityDisplay = filteredOverrideCases.filter((item) => {
      if (productSet && !productSet.has(`${item.user_s * item.user_d * item.tricia_p}-${item.tricia_s * item.tricia_d * item.tricia_p}`)) return false;
      if (severitySet && !severitySet.has(`${item.user_s}-${item.tricia_s}`)) return false;
      return true;
    });

    return {
      severity: buildLocalMatrixCells(
        casesForSeverityDisplay.map((item) => ({ expected: item.user_s, observed: item.tricia_s })),
        acceptanceThreshold
      ),
      detectability: buildLocalMatrixCells(
        casesForDetectabilityDisplay.map((item) => ({ expected: item.user_d, observed: item.tricia_d })),
        acceptanceThreshold
      ),
    };
  }, [acceptanceThreshold, filteredOverrideCases, isOverrideActive, selectedCellsByDimension.detectability, selectedCellsByDimension.severity, selectedProductRawCells]);

  const patchReview = usePatchCaseReview();
  const addComment = useAddCaseComment();
  const updateCase = useUpdateCase();
  const deleteCase = useDeleteCase();

  const selectedRequests = useMemo(
    () => {
      const uniqueProductRawCells = selectedProductRawCells;

      return [
        ...selectedCellsByDimension.severity.map((cell) => ({ dimension: 'severity' as const, ...cell })),
        ...selectedCellsByDimension.detectability.map((cell) => ({ dimension: 'detectability' as const, ...cell })),
        ...uniqueProductRawCells.map((cell) => ({ dimension: 'product' as const, ...cell })),
      ];
    },
    [selectedCellsByDimension.detectability, selectedCellsByDimension.severity, selectedProductRawCells]
  );

  const selectedCaseQueries = useQueries({
    queries: (isOverrideActive ? [] : selectedRequests).map((request) => ({
      queryKey: ['cases', caseParams, request.dimension, request.expected, request.observed],
      queryFn: () =>
        listCases({
          ...caseParams,
          matrix_dimension: request.dimension,
          expected_value: request.expected,
          observed_value: request.observed,
        }),
    })),
  });

  const selectedCases = useMemo(() => {
    if (isOverrideActive) {
      if (selectedRequests.length === 0) return filteredOverrideCases;
      // AND across dimensions, OR within each dimension.
      const activeDimensions = [...new Set(selectedRequests.map((r) => r.dimension))];
      return filteredOverrideCases.filter((item) =>
        activeDimensions.every((dimension) => {
          const cellsForDim = selectedRequests.filter((r) => r.dimension === dimension);
          return cellsForDim.some((request) => {
            if (request.dimension === 'severity') {
              return item.user_s === request.expected && item.tricia_s === request.observed;
            }
            if (request.dimension === 'product') {
              return (
                item.user_s * item.user_d * item.tricia_p === request.expected &&
                item.tricia_s * item.tricia_d * item.tricia_p === request.observed
              );
            }
            return item.user_d === request.expected && item.tricia_d === request.observed;
          });
        })
      );
    }

    if (selectedRequests.length === 0) return [];

    const activeDimensions = [...new Set(selectedRequests.map((r) => r.dimension))];

    if (activeDimensions.length === 1) {
      // Single active dimension: simple union (original behaviour).
      const byId = new Map<string, { id: string }>();
      selectedCaseQueries.forEach((query) => {
        (query.data?.items ?? []).forEach((item: { id: string }) => {
          byId.set(item.id, item);
        });
      });
      return Array.from(byId.values());
    }

    // Multiple active dimensions: union within each dimension, intersect across dimensions.
    const caseIdsByDimension = new Map<string, Set<string>>();
    const caseById = new Map<string, { id: string }>();
    selectedRequests.forEach((request, index) => {
      const dim = request.dimension;
      if (!caseIdsByDimension.has(dim)) caseIdsByDimension.set(dim, new Set<string>());
      const query = selectedCaseQueries[index];
      (query.data?.items ?? []).forEach((item: { id: string }) => {
        caseIdsByDimension.get(dim)!.add(item.id);
        caseById.set(item.id, item);
      });
    });

    let intersectedIds: Set<string> | null = null;
    for (const [, ids] of caseIdsByDimension) {
      intersectedIds = intersectedIds === null
        ? new Set(ids)
        : new Set(Array.from(intersectedIds!).filter((id: any) => ids.has(id)));
    }

    return Array.from((intersectedIds ?? new Set<string>()).values())
      .map((id) => caseById.get(id))
      .filter((item): item is { id: string } => item !== undefined);
  }, [filteredOverrideCases, isOverrideActive, selectedCaseQueries, selectedRequests]);

  const displayedCases = isOverrideActive
    ? selectedCases
    : (selectedRequests.length > 0 ? selectedCases : baseCases.data?.items ?? []);
  // Severity matrix: use filtered query when product or detectability selection is active.
  const severityCells = isOverrideActive
    ? (filteredOverrideMatrices?.severity ?? overrideMatrices.severity)
    : (filteredSeverityMatrix.data?.matrices?.severity ?? matrix.data?.matrices?.severity ?? []);
  // Detectability matrix: use filtered query when product or severity selection is active.
  const detectabilityCells = isOverrideActive
    ? (filteredOverrideMatrices?.detectability ?? overrideMatrices.detectability)
    : (filteredDetectabilityMatrix.data?.matrices?.detectability
        ?? filteredDetectabilityMatrix.data?.cells
        ?? matrix.data?.matrices?.detectability
        ?? matrix.data?.cells
        ?? []);
  const hasSelection =
    selectedCellsByDimension.severity.length > 0 ||
    selectedCellsByDimension.detectability.length > 0 ||
    selectedCellsByDimension.product.length > 0;

  const handleTableServerFilterChange = useCallback((next: CaseTableServerFilters) => {
    setTableServerFilters((previous) => {
      const previousJson = JSON.stringify(previous);
      const nextJson = JSON.stringify(next);
      return previousJson === nextJson ? previous : next;
    });
  }, []);

  const handleExportStateChange = useCallback((next: { columns: string[]; rows: Array<Record<string, unknown>> }) => {
    setExportState((previous) => {
      const previousJson = JSON.stringify(previous);
      const nextJson = JSON.stringify(next);
      return previousJson === nextJson ? previous : next;
    });
  }, []);

  useEffect(() => {
    setCasePage(1);
  }, [dateFrom, dateTo, dateWindow, includeExcluded, isOverrideActive, problematicOnly, requestedVkNumber, riskFilter, hasSelection]);

  useEffect(() => {
    setCasePage(1);
  }, [tableServerFilters]);

  useEffect(() => {
    const total = baseCases.data?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / CASES_PAGE_SIZE));
    if (!isOverrideActive && !hasSelection && casePage > totalPages) {
      setCasePage(totalPages);
    }
  }, [baseCases.data?.total, casePage, hasSelection, isOverrideActive]);

  function toggleMatrixCell(dimension: MatrixDimension, expected: number, observed: number) {
    setSelectedCellsByDimension((previous) => {
      const existing = previous[dimension];
      const found = existing.some((cell) => cell.expected === expected && cell.observed === observed);
      const nextDimensionSelection = found
        ? existing.filter((cell) => !(cell.expected === expected && cell.observed === observed))
        : [...existing, { expected, observed }];

      // Only clear S/D when product transitions from empty → non-empty (first activation).
      // Adding further product cells while S/D are also selected leaves the intersection intact.
      if (dimension === 'product' && previous.product.length === 0 && nextDimensionSelection.length > 0) {
        return {
          severity: [],
          detectability: [],
          product: nextDimensionSelection,
        };
      }

      return {
        ...previous,
        [dimension]: nextDimensionSelection,
      };
    });
  }

  function clearAllSelection() {
    setSelectedCellsByDimension({
      severity: [],
      detectability: [],
      product: [],
    });
  }

  function clearVkFilter() {
    const next = new URLSearchParams(searchParams);
    next.delete('vk_number');
    setSearchParams(next, { replace: true });
  }

  async function handleEnrichExport(
    cols: string[],
    rows: Array<Record<string, unknown>>
  ): Promise<{ columns: string[]; rows: Array<Record<string, unknown>> }> {
    const FIELD_LABELS: Record<string, string> = {
      tricia_s: 'TRI-S', tricia_p: 'TRI-P', tricia_d: 'TRI-D',
      user_s: 'WIMI-S', user_d: 'WIMI-D', category_code: 'Category',
      is_excluded: 'Excluded', is_reviewed: 'Reviewed', risk_level: 'Risk Level',
      device_name: 'Device Name', analysis_date: 'Analysis Date',
      validation_status: 'Validation Status', comment_text: 'Comment', vk_number: 'VK Number',
    };

    function formatAudit(items: Array<{ created_at: string; action: string; changes?: Record<string, { from?: unknown; to?: unknown }> }>): string {
      if (!items.length) return '';
      const lines: string[] = [];
      const ordered = [...items].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      ordered.forEach((event) => {
        const ts = new Date(event.created_at).toLocaleString('de-DE');
        const entries = Object.entries(event.changes ?? {});
        if (entries.length === 0) { lines.push(`${ts} | ${event.action}`); return; }
        entries.forEach(([field, delta]) => {
          lines.push(`${ts} | ${FIELD_LABELS[field] ?? field}: ${String(delta?.from ?? '—')} -> ${String(delta?.to ?? '—')}`);
        });
      });
      return lines.join('\n');
    }

    const enrichedRows = await Promise.all(
      rows.map(async (row) => {
        const caseId = row._case_id as string | undefined;
        if (!caseId) return { ...row };
        try {
          const data = await getCaseAuditTrail(caseId, 500);
          const { _case_id: _removed, ...rest } = row;
          void _removed;
          return { ...rest, audit_trail: formatAudit((data.items ?? []) as Parameters<typeof formatAudit>[0]) };
        } catch {
          const { _case_id: _removed, ...rest } = row;
          void _removed;
          return { ...rest, audit_trail: '' };
        }
      })
    );

    const enrichedCols = [...cols, 'audit_trail'];
    return { columns: enrichedCols, rows: enrichedRows };
  }

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Matrix Dashboard</h1>
        <div className="flex gap-2">
          <ExportButton columns={exportState.columns} rows={exportState.rows} fileNamePrefix="matrix-table" onBeforeExport={handleEnrichExport} />
          <MatrixReportExportButton
            fileNamePrefix="matrix-report"
            generatedAt={new Date().toLocaleString('de-DE')}
            filters={{
              include_excluded: includeExcluded,
              problematic_only: problematicOnly,
              date_window: dateWindow,
              date_from: dateFrom,
              date_to: dateTo,
              risk_filter: riskFilter,
              selected_vk_number: requestedVkNumber || undefined,
              selected_matrix_cells: selectedRequests.length > 0 ? selectedRequests.map((cell) => `${cell.dimension}:${cell.expected}->${cell.observed}`).join(', ') : 'none',
            }}
            matrixSections={[
              {
                title: 'Severity Matrix',
                rowAxisLabel: 'WIMI-S',
                columnAxisLabel: 'TRI-S',
                cells: severityCells,
              },
              {
                title: 'Detectability Matrix',
                rowAxisLabel: 'WIMI-D',
                columnAxisLabel: 'TRI-D',
                cells: detectabilityCells,
              },
              {
                title: 'Risk Class Matrix (SxDxP)',
                rowAxisLabel: 'WIMI Risk Class',
                columnAxisLabel: 'TRI Risk Class',
                cells: riskClassMatrix.cells,
              },
            ]}
            tableColumns={exportState.columns}
            tableRows={exportState.rows}
          />
        </div>
      </div>

      {requestedVkNumber && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center justify-between">
          <span>Filtered to existing case: {requestedVkNumber}</span>
          <button className="underline" onClick={clearVkFilter}>Clear</button>
        </div>
      )}
      {isOverrideActive && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center justify-between gap-3">
          <span>Using uploaded dataset from {overrideSourceFile}. Matrix analysis is running on file data only.</span>
          <button className="underline" onClick={clearPreviewData}>Clear</button>
        </div>
      )}

      <div className="flex flex-col gap-6">
        {hasSelection && (
          <div className="flex items-center">
            <button
              onClick={clearAllSelection}
              className="ml-auto text-sm text-stone-500 hover:text-stone-800 underline"
            >
              Deselect all
            </button>
          </div>
        )}

        <section className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <button
            className="w-full px-4 py-3 text-left text-sm font-semibold text-stone-700 bg-stone-50 hover:bg-stone-100"
            onClick={() => setCollapsedProduct((previous) => !previous)}
          >
            Risk Class, Severity and Detectability Matrices - P: {selectedCellsByDimension.product.length} selected, S: {selectedCellsByDimension.severity.length} selected, D: {selectedCellsByDimension.detectability.length} selected {collapsedProduct ? '▼' : '▲'}
          </button>
          {!collapsedProduct && (
            <div className="p-2">
              <div className="grid gap-4 xl:grid-cols-3">
                <ConfusionMatrixGrid
                  title="Risk Class Matrix"
                  cells={riskClassMatrix.cells}
                  onCellToggle={(expected, observed) => toggleMatrixCell('product', expected, observed)}
                  selectedCells={selectedCellsByDimension.product}
                  rowAxisLabel="WIMI Risk Class"
                  columnAxisLabel="TRI Risk Class"
                />
                <ConfusionMatrixGrid
                  title="Severity Matrix"
                  cells={severityCells}
                  fixedAxisValues={SEVERITY_AXIS_VALUES}
                  onCellToggle={(expected, observed) => toggleMatrixCell('severity', expected, observed)}
                  selectedCells={selectedCellsByDimension.severity}
                  rowAxisLabel="WIMI-S"
                  columnAxisLabel="TRI-S"
                />
                <ConfusionMatrixGrid
                  title="Detectability Matrix"
                  cells={detectabilityCells}
                  fixedAxisValues={DETECTABILITY_AXIS_VALUES}
                  onCellToggle={(expected, observed) => toggleMatrixCell('detectability', expected, observed)}
                  selectedCells={selectedCellsByDimension.detectability}
                  rowAxisLabel="WIMI-D"
                  columnAxisLabel="TRI-D"
                />
              </div>
              <div className="px-4 pb-2 pt-1 text-xs text-stone-500 flex flex-wrap gap-3">
                {riskCategories.map((category, index) => (
                  <span key={`${category.label}-${index}`}>
                    Class {index + 1}: {category.label} ({category.min_value}-{category.max_value})
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        <FilterPanel
          includeExcluded={includeExcluded}
          problematicOnly={problematicOnly}
          problematicCount={problematicCaseCount}
          problematicCaseThreshold={problematicCaseTarget}
          problemAlarmActive={problemAlarmActive}
          problemAlarmLabel={problemAlarmLabel}
          dateWindow={dateWindow}
          dateFrom={dateFrom}
          dateTo={dateTo}
          riskFilter={riskFilter}
          onIncludeExcludedChange={setIncludeExcluded}
          onProblematicOnlyChange={setProblematicOnly}
          onDateWindowChange={setDateWindow}
          onCustomDateRangeChange={setCustomDateRange}
          onRiskFilterChange={setRiskFilter}
        />

        <CaseTable
          items={displayedCases}
          totalCount={!isOverrideActive && !hasSelection ? (baseCases.data?.total ?? displayedCases.length) : displayedCases.length}
          page={!isOverrideActive && !hasSelection ? casePage : 1}
          pageSize={!isOverrideActive && !hasSelection ? (baseCases.data?.page_size ?? CASES_PAGE_SIZE) : undefined}
          onPageChange={!isOverrideActive && !hasSelection ? setCasePage : undefined}
          riskCategories={riskCategories}
          acceptanceThreshold={acceptanceThreshold}
          onMarkReviewed={isOverrideActive ? undefined : ((id, isReviewed) => patchReview.mutate({ caseId: id, payload: { is_reviewed: !isReviewed } }))}
          onToggleExcluded={isOverrideActive ? undefined : ((id, current) => patchReview.mutate({ caseId: id, payload: { is_excluded: !current } }))}
          onSetCategory={isOverrideActive ? undefined : ((id, category) => patchReview.mutate({ caseId: id, payload: { category_code: category } }))}
          onAddComment={isOverrideActive ? undefined : ((id, text) => addComment.mutate({ caseId: id, text }))}
          onEditCase={isOverrideActive ? undefined : ((id, payload) => updateCase.mutateAsync({ caseId: id, payload }))}
          onDeleteCase={isOverrideActive || !canDeleteCases ? undefined : ((id) => deleteCase.mutate(id))}
          onExportStateChange={handleExportStateChange}
          onServerFilterChange={!isOverrideActive && !hasSelection ? handleTableServerFilterChange : undefined}
        />

        <ThresholdConfigPanel />
      </div>
    </AppShell>
  );
}
