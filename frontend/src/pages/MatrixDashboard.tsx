import { useEffect, useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { AppShell } from '../components/common/AppShell';
import { ExportButton } from '../components/common/ExportButton';
import { ThresholdConfigPanel } from '../components/common/ThresholdConfigPanel';
import { CaseTable } from '../components/matrix/CaseTable';
import { ConfusionMatrixGrid } from '../components/matrix/ConfusionMatrixGrid';
import { FilterPanel } from '../components/matrix/FilterPanel';
import { MatrixLegend } from '../components/matrix/MatrixLegend';
import { MatrixReportExportButton } from '../components/matrix/MatrixReportExportButton';
import { usePatchCaseReview, useCases, useAddCaseComment, useUpdateCase, useDeleteCase } from '../hooks/useCases';
import { useMatrix } from '../hooks/useMatrix';
import { MatrixDimension, RiskFilter, useFilters } from '../state/filters';
import { useImportOverride } from '../state/importOverride';
import { listCases } from '../services/cases';
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

type MatrixCell = {
  expected_value: number;
  observed_value: number;
  case_count: number;
};

function getProductRiskSelection(cells: MatrixCell[], riskFilter: RiskFilter): Array<{ expected: number; observed: number }> {
  if (riskFilter === 'all') return [];
  return cells
    .filter((cell) => cell.case_count > 0)
    .filter((cell) =>
      riskFilter === 'false_low'
        ? cell.expected_value > cell.observed_value
        : cell.expected_value < cell.observed_value
    )
    .map((cell) => ({ expected: cell.expected_value, observed: cell.observed_value }));
}

export function MatrixDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [collapsedSD, setCollapsedSD] = useState(false);
  const [collapsedProduct, setCollapsedProduct] = useState(false);
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

  const caseParams = {
    include_excluded: includeExcluded,
    problematic_only: problematicOnly,
    vk_number: requestedVkNumber || undefined,
    ...dateParams,
  };

  const baseCases = useCases(caseParams, { enabled: !isOverrideActive });
  const filteredOverrideCases = useMemo(() => {
    if (!isOverrideActive) return [];
    return overrideCases.filter((item) => {
      if (!includeExcluded && item.is_excluded) return false;
      if (problematicOnly && Math.abs((item.user_d ?? 0) - (item.tricia_d ?? 0)) <= 2) return false;
      if (requestedVkNumber && item.vk_number !== requestedVkNumber) return false;
      if (dateParams.start_date && item.analysis_date < String(dateParams.start_date)) return false;
      if (dateParams.end_date && item.analysis_date > String(dateParams.end_date)) return false;
      return true;
    });
  }, [dateParams.end_date, dateParams.start_date, includeExcluded, isOverrideActive, overrideCases, problematicOnly, requestedVkNumber]);

  const overrideMatrices = useMemo(() => {
    if (!isOverrideActive) return { severity: [], detectability: [], product: [] };
    const acceptance = thresholds.data?.acceptance_threshold ?? 1;
    const aggregate = (pairs: Array<{ expected: number; observed: number }>) => {
      const map = new Map<string, { expected_value: number; observed_value: number; case_count: number; within_threshold: boolean }>();
      pairs.forEach(({ expected, observed }) => {
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
          within_threshold: Math.abs(expected - observed) <= acceptance,
        });
      });
      return Array.from(map.values());
    };
    return {
      severity: aggregate(filteredOverrideCases.map((item) => ({ expected: item.user_s, observed: item.tricia_s }))),
      detectability: aggregate(filteredOverrideCases.map((item) => ({ expected: item.user_d, observed: item.tricia_d }))),
      product: aggregate(
        filteredOverrideCases.map((item) => ({
          expected: item.user_s * item.user_d * item.tricia_p,
          observed: item.tricia_s * item.tricia_d * item.tricia_p,
        }))
      ),
    };
  }, [filteredOverrideCases, isOverrideActive, thresholds.data?.acceptance_threshold]);
  const productCells = isOverrideActive ? overrideMatrices.product : (matrix.data?.matrices?.product ?? []);

  useEffect(() => {
    if (riskFilter === 'all') {
      setSelectedCellsByDimension((previous) => {
        if (
          previous.severity.length === 0 &&
          previous.detectability.length === 0 &&
          previous.product.length === 0
        ) {
          return previous;
        }
        return {
          severity: [],
          detectability: [],
          product: [],
        };
      });
      return;
    }
    const target = getProductRiskSelection(productCells, riskFilter);
    const targetSet = new Set(target.map((cell) => `${cell.expected}-${cell.observed}`));
    setSelectedCellsByDimension((previous) => {
      const currentSet = new Set(previous.product.map((cell) => `${cell.expected}-${cell.observed}`));
      if (targetSet.size === currentSet.size && [...targetSet].every((value) => currentSet.has(value))) {
        return previous;
      }
      return {
        severity: [],
        detectability: [],
        product: target,
      };
    });
  }, [productCells, riskFilter]);
  const patchReview = usePatchCaseReview();
  const addComment = useAddCaseComment();
  const updateCase = useUpdateCase();
  const deleteCase = useDeleteCase();

  const selectedRequests = useMemo(
    () => [
      ...selectedCellsByDimension.severity.map((cell) => ({ dimension: 'severity' as const, ...cell })),
      ...selectedCellsByDimension.detectability.map((cell) => ({ dimension: 'detectability' as const, ...cell })),
      ...selectedCellsByDimension.product.map((cell) => ({ dimension: 'product' as const, ...cell })),
    ],
    [selectedCellsByDimension]
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
      return selectedRequests.length === 0
        ? filteredOverrideCases
        : filteredOverrideCases.filter((item) =>
            selectedRequests.some((request) => {
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
            })
          );
    }
    const byId = new Map<string, { id: string }>();
    selectedCaseQueries.forEach((query) => {
      (query.data?.items ?? []).forEach((item: { id: string }) => {
        byId.set(item.id, item);
      });
    });
    return Array.from(byId.values());
  }, [filteredOverrideCases, isOverrideActive, selectedCaseQueries, selectedRequests]);

  const displayedCases = isOverrideActive
    ? selectedCases
    : (selectedRequests.length > 0 ? selectedCases : baseCases.data?.items ?? []);
  const severityCells = isOverrideActive ? overrideMatrices.severity : (matrix.data?.matrices?.severity ?? []);
  const detectabilityCells = isOverrideActive ? overrideMatrices.detectability : (matrix.data?.matrices?.detectability ?? matrix.data?.cells ?? []);
  const hasSelection =
    selectedCellsByDimension.severity.length > 0 ||
    selectedCellsByDimension.detectability.length > 0 ||
    selectedCellsByDimension.product.length > 0;

  function toggleMatrixCell(dimension: MatrixDimension, expected: number, observed: number) {
    setSelectedCellsByDimension((previous) => {
      if (dimension === 'product') {
        const existingProduct = previous.product;
        const foundInProduct = existingProduct.some((cell) => cell.expected === expected && cell.observed === observed);
        if (foundInProduct) {
          return {
            ...previous,
            product: existingProduct.filter((cell) => !(cell.expected === expected && cell.observed === observed)),
          };
        }
        return {
          severity: [],
          detectability: [],
          product: [...existingProduct, { expected, observed }],
        };
      }

      const existing = previous[dimension];
      const found = existing.some((cell) => cell.expected === expected && cell.observed === observed);
      if (found) {
        return {
          ...previous,
          [dimension]: existing.filter((cell) => !(cell.expected === expected && cell.observed === observed)),
        };
      }
      return {
        ...previous,
        [dimension]: [...existing, { expected, observed }],
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

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Matrix Dashboard</h1>
        <div className="flex gap-2">
          <ExportButton columns={exportState.columns} rows={exportState.rows} fileNamePrefix="matrix-table" />
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
                title: 'RBC Matrix (SxDxP)',
                rowAxisLabel: 'WIMI (SxDxP)',
                columnAxisLabel: 'TRI (SxDxP)',
                cells: productCells,
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
        <FilterPanel
          includeExcluded={includeExcluded}
          problematicOnly={problematicOnly}
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

        <div className="flex items-center gap-2">
          <MatrixLegend />
          {hasSelection && (
            <button
              onClick={clearAllSelection}
              className="ml-auto text-sm text-stone-500 hover:text-stone-800 underline"
            >
              Deselect all
            </button>
          )}
        </div>

        <section className="rounded-xl border border-stone-200 bg-white p-4">
          <button
            className="w-full px-4 py-3 text-left text-sm font-semibold text-stone-700 bg-stone-50 hover:bg-stone-100 rounded-lg"
            onClick={() => setCollapsedSD((previous) => !previous)}
          >
            Severity and Detectability Matrices - S: {selectedCellsByDimension.severity.length} selected, D: {selectedCellsByDimension.detectability.length} selected {collapsedSD ? '▼' : '▲'}
          </button>
          {!collapsedSD && (
            <div className="grid gap-4 md:grid-cols-2 mt-3">
              <ConfusionMatrixGrid
                title="Severity Matrix"
                cells={severityCells}
                onCellToggle={(expected, observed) => toggleMatrixCell('severity', expected, observed)}
                selectedCells={selectedCellsByDimension.severity}
                rowAxisLabel="WIMI-S"
                columnAxisLabel="TRI-S"
              />
              <ConfusionMatrixGrid
                title="Detectability Matrix"
                cells={detectabilityCells}
                onCellToggle={(expected, observed) => toggleMatrixCell('detectability', expected, observed)}
                selectedCells={selectedCellsByDimension.detectability}
                rowAxisLabel="WIMI-D"
                columnAxisLabel="TRI-D"
              />
            </div>
          )}
        </section>

        <section className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <button
            className="w-full px-4 py-3 text-left text-sm font-semibold text-stone-700 bg-stone-50 hover:bg-stone-100"
            onClick={() => setCollapsedProduct((previous) => !previous)}
          >
            RBC Matrix (SxDxP) - {selectedCellsByDimension.product.length} selected {collapsedProduct ? '▼' : '▲'}
          </button>
          {!collapsedProduct && (
            <div className="p-2">
              <ConfusionMatrixGrid
                title="RBC Matrix"
                cells={productCells}
                onCellToggle={(expected, observed) => toggleMatrixCell('product', expected, observed)}
                selectedCells={selectedCellsByDimension.product}
                rowAxisLabel="WIMI (SxDxP)"
                columnAxisLabel="TRI (SxDxP)"
              />
            </div>
          )}
        </section>

        <CaseTable
          items={displayedCases}
          onMarkReviewed={isOverrideActive ? undefined : ((id, isReviewed) => patchReview.mutate({ caseId: id, payload: { is_reviewed: !isReviewed } }))}
          onToggleExcluded={isOverrideActive ? undefined : ((id, current) => patchReview.mutate({ caseId: id, payload: { is_excluded: !current } }))}
          onSetCategory={isOverrideActive ? undefined : ((id, category) => patchReview.mutate({ caseId: id, payload: { category_code: category } }))}
          onAddComment={isOverrideActive ? undefined : ((id, text) => addComment.mutate({ caseId: id, text }))}
          onEditCase={isOverrideActive ? undefined : ((id, payload) => updateCase.mutateAsync({ caseId: id, payload }))}
          onDeleteCase={isOverrideActive ? undefined : ((id) => deleteCase.mutate(id))}
          onExportStateChange={setExportState}
        />

        <ThresholdConfigPanel />
      </div>
    </AppShell>
  );
}
