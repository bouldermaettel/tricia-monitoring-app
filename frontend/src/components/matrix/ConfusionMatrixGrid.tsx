type Cell = {
  expected_value: number;
  observed_value: number;
  case_count: number;
  within_threshold: boolean;
};

type Props = {
  title?: string;
  cells: Cell[];
  onCellToggle: (expected: number, observed: number) => void;
  selectedCells?: Array<{ expected: number; observed: number }>;
};

export function ConfusionMatrixGrid({
  title = 'Confusion Matrix — WiMi ground truth (rows) vs. Tricia prediction (cols)',
  cells,
  onCellToggle,
  selectedCells = [],
}: Props) {
  const allValues = [...new Set(cells.flatMap((c) => [c.expected_value, c.observed_value]))].sort((a, b) => a - b);
  const cellMap = new Map<string, Cell>();
  cells.forEach((c) => cellMap.set(`${c.expected_value}-${c.observed_value}`, c));
  const selectedSet = new Set(selectedCells.map((cell) => `${cell.expected}-${cell.observed}`));

  if (allValues.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-12 text-center text-stone-400 text-sm">
        No matrix data for the selected period.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white p-6">
      <h2 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4">
        {title}
      </h2>
      <div className="overflow-x-auto">
        <table className="border-collapse">
          <thead>
            <tr>
              <th className="p-2 text-xs text-stone-400 font-medium w-12" />
              {allValues.map((v) => (
                <th key={v} className="p-2 text-xs text-stone-500 font-semibold text-center w-20">
                  {v}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allValues.map((expected) => (
              <tr key={expected}>
                <th className="p-2 text-xs text-stone-500 font-semibold text-right pr-4">{expected}</th>
                {allValues.map((observed) => {
                  const cell = cellMap.get(`${expected}-${observed}`);
                  const isSelected = selectedSet.has(`${expected}-${observed}`);
                  const isDiag = expected === observed;
                  const hasData = cell && cell.case_count > 0;

                  let colorClass: string;
                  if (!hasData) {
                    colorClass = 'bg-stone-50 text-stone-300 border-stone-100';
                  } else if (isDiag || cell.within_threshold) {
                    colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
                  } else {
                    colorClass = 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';
                  }

                  return (
                    <td key={observed} className="p-1">
                      <button
                        onClick={() => hasData && onCellToggle(expected, observed)}
                        disabled={!hasData}
                        className={`w-16 h-14 rounded-lg border font-mono text-sm font-semibold transition-all ${colorClass} ${
                          isSelected ? 'ring-2 ring-amber-400 ring-offset-1 scale-105 shadow-md' : 'hover:scale-105'
                        } disabled:cursor-default`}
                      >
                        {cell?.case_count ?? '—'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
