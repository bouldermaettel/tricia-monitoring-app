import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { AppShell } from '../components/common/AppShell';
import { ExportButton } from '../components/common/ExportButton';
import { ThresholdConfigPanel } from '../components/common/ThresholdConfigPanel';
import { CaseTable } from '../components/matrix/CaseTable';
import { ConfusionMatrixGrid } from '../components/matrix/ConfusionMatrixGrid';
import { FilterPanel } from '../components/matrix/FilterPanel';
import { MatrixLegend } from '../components/matrix/MatrixLegend';
import { usePatchCaseReview, useCases, useAddCaseComment } from '../hooks/useCases';
import { useMatrix } from '../hooks/useMatrix';
import { MatrixDimension, useFilters } from '../state/filters';
import { listCases } from '../services/cases';

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

export function MatrixDashboard() {
  const [collapsedSD, setCollapsedSD] = useState(false);
  const [collapsedProduct, setCollapsedProduct] = useState(false);
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

  const dateParams = useMemo(() => getDateParams(dateWindow, dateFrom, dateTo), [dateWindow, dateFrom, dateTo]);

  const matrix = useMatrix({
    include_excluded: includeExcluded,
    problematic_only: problematicOnly,
    risk_level: riskFilter === 'all' ? undefined : riskFilter,
    ...dateParams,
  });

  const caseParams = {
    include_excluded: includeExcluded,
    problematic_only: problematicOnly,
    risk_level: riskFilter === 'all' ? undefined : riskFilter,
    ...dateParams,
  };

  const baseCases = useCases(caseParams);
  const patchReview = usePatchCaseReview();
  const addComment = useAddCaseComment();

  const selectedRequests = useMemo(
    () => [
      ...selectedCellsByDimension.severity.map((cell) => ({ dimension: 'severity' as const, ...cell })),
      ...selectedCellsByDimension.detectability.map((cell) => ({ dimension: 'detectability' as const, ...cell })),
      ...selectedCellsByDimension.product.map((cell) => ({ dimension: 'product' as const, ...cell })),
    ],
    [selectedCellsByDimension]
  );

  const selectedCaseQueries = useQueries({
    queries: selectedRequests.map((request) => ({
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
    const byId = new Map<string, { id: string }>();
    selectedCaseQueries.forEach((query) => {
      (query.data?.items ?? []).forEach((item: { id: string }) => {
        byId.set(item.id, item);
      });
    });
    return Array.from(byId.values());
  }, [selectedCaseQueries]);

  const displayedCases = selectedRequests.length > 0 ? selectedCases : baseCases.data?.items ?? [];
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

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Matrix Dashboard</h1>
        <ExportButton />
      </div>

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
                title="Severity Matrix — WIMI-S (rows) vs TRI-S (cols)"
                cells={matrix.data?.matrices?.severity ?? []}
                onCellToggle={(expected, observed) => toggleMatrixCell('severity', expected, observed)}
                selectedCells={selectedCellsByDimension.severity}
              />
              <ConfusionMatrixGrid
                title="Detectability Matrix — WIMI-D (rows) vs TRI-D (cols)"
                cells={matrix.data?.matrices?.detectability ?? matrix.data?.cells ?? []}
                onCellToggle={(expected, observed) => toggleMatrixCell('detectability', expected, observed)}
                selectedCells={selectedCellsByDimension.detectability}
              />
            </div>
          )}
        </section>

        <section className="rounded-xl border border-stone-200 bg-white overflow-hidden">
          <button
            className="w-full px-4 py-3 text-left text-sm font-semibold text-stone-700 bg-stone-50 hover:bg-stone-100"
            onClick={() => setCollapsedProduct((previous) => !previous)}
          >
            Product Matrix (SxDxP) - {selectedCellsByDimension.product.length} selected {collapsedProduct ? '▼' : '▲'}
          </button>
          {!collapsedProduct && (
            <div className="p-2">
              <ConfusionMatrixGrid
                title="Product Matrix — WIMI (SxDxP) vs TRI (SxDxP), with WIMI-P = TRI-P"
                cells={matrix.data?.matrices?.product ?? []}
                onCellToggle={(expected, observed) => toggleMatrixCell('product', expected, observed)}
                selectedCells={selectedCellsByDimension.product}
              />
            </div>
          )}
        </section>

        <CaseTable
          items={displayedCases}
          onMarkReviewed={(id, isReviewed) => patchReview.mutate({ caseId: id, payload: { is_reviewed: !isReviewed } })}
          onToggleExcluded={(id, current) => patchReview.mutate({ caseId: id, payload: { is_excluded: !current } })}
          onSetCategory={(id, category) => patchReview.mutate({ caseId: id, payload: { category_code: category } })}
          onAddComment={(id, text) => addComment.mutate({ caseId: id, text })}
        />

        <ThresholdConfigPanel />
      </div>
    </AppShell>
  );
}
