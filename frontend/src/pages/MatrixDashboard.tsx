import { AppShell } from '../components/common/AppShell';
import { ExportButton } from '../components/common/ExportButton';
import { ThresholdConfigPanel } from '../components/common/ThresholdConfigPanel';
import { CaseTable } from '../components/matrix/CaseTable';
import { ConfusionMatrixGrid } from '../components/matrix/ConfusionMatrixGrid';
import { FilterPanel } from '../components/matrix/FilterPanel';
import { MatrixLegend } from '../components/matrix/MatrixLegend';
import { usePatchCaseReview, useCases } from '../hooks/useCases';
import { useMatrix } from '../hooks/useMatrix';
import { useFilters } from '../state/filters';

export function MatrixDashboard() {
  const includeExcluded = useFilters((s) => s.includeExcluded);
  const problematicOnly = useFilters((s) => s.problematicOnly);
  const setIncludeExcluded = useFilters((s) => s.setIncludeExcluded);
  const setProblematicOnly = useFilters((s) => s.setProblematicOnly);
  const setSelectedCell = useFilters((s) => s.setSelectedCell);

  const matrix = useMatrix({ include_excluded: includeExcluded });
  const cases = useCases({ include_excluded: includeExcluded, problematic_only: problematicOnly });
  const patchReview = usePatchCaseReview();

  return (
    <AppShell>
      <h1>Matrix Dashboard</h1>
      <FilterPanel
        includeExcluded={includeExcluded}
        problematicOnly={problematicOnly}
        onIncludeExcludedChange={setIncludeExcluded}
        onProblematicOnlyChange={setProblematicOnly}
      />
      <MatrixLegend />
      <ConfusionMatrixGrid
        cells={matrix.data?.cells ?? []}
        onCellClick={(expected, observed) => setSelectedCell(expected, observed)}
      />
      <CaseTable
        items={cases.data?.items ?? []}
        onMarkReviewed={(id) => patchReview.mutate({ caseId: id, payload: { is_reviewed: true, risk_level: 'false_low' } })}
      />
      <ExportButton />
      <ThresholdConfigPanel />
    </AppShell>
  );
}
