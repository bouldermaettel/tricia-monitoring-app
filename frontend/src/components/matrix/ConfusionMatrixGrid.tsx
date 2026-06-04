import { useLayoutEffect, useRef, useState } from 'react';

type Cell = {
  expected_value: number;
  observed_value: number;
  case_count: number;
  within_threshold?: boolean;
};

type Props = {
  title?: string;
  cells: Cell[];
  onCellToggle: (expected: number, observed: number) => void;
  selectedCells?: Array<{ expected: number; observed: number }>;
  rowAxisLabel?: string;
  columnAxisLabel?: string;
  fixedAxisValues?: number[];
  axisValueFormatter?: (value: number) => string;
};

export function ConfusionMatrixGrid({
  title = 'Confusion Matrix — WiMi ground truth (rows) vs. Tricia prediction (cols)',
  cells,
  onCellToggle,
  selectedCells = [],
  rowAxisLabel,
  columnAxisLabel,
  fixedAxisValues,
  axisValueFormatter,
}: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | null>(null);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const updateScale = () => {
      const availableWidth = container.clientWidth;
      const naturalWidth = content.scrollWidth;
      const naturalHeight = content.scrollHeight;
      if (availableWidth <= 0 || naturalWidth <= 0 || naturalHeight <= 0) return;

      const nextScale = Math.min(1, availableWidth / naturalWidth);
      setScale(nextScale);
      setScaledHeight(naturalHeight * nextScale);
    };

    updateScale();

    const observer = new ResizeObserver(updateScale);
    observer.observe(container);
    observer.observe(content);

    return () => observer.disconnect();
  }, [cells, fixedAxisValues]);

  const allValues = (fixedAxisValues && fixedAxisValues.length > 0
    ? [...new Set(fixedAxisValues)]
    : [...new Set(cells.flatMap((c) => [c.expected_value, c.observed_value]))]
  ).sort((a, b) => a - b);
  const formatAxisValue = (value: number) => axisValueFormatter?.(value) ?? String(value);
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
      <div ref={containerRef} className="w-full">
        <div className="relative" style={{ height: scaledHeight ? `${scaledHeight}px` : undefined }}>
          <div
            ref={contentRef}
            className="inline-flex items-center gap-3"
            style={{
              width: 'max-content',
              transform: `scale(${scale})`,
              transformOrigin: 'top left',
            }}
          >
            {rowAxisLabel && (
              <div className="text-xs font-semibold text-stone-500 tracking-wide [writing-mode:vertical-rl] rotate-180">
                {rowAxisLabel}
              </div>
            )}
            <div className="inline-flex flex-col items-center">
              <table className="border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 text-xs text-stone-400 font-medium w-12" />
                    {allValues.map((v) => (
                      <th key={v} className="p-2 text-xs text-stone-500 font-semibold text-center w-20">
                        {formatAxisValue(v)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {allValues.map((expected) => (
                    <tr key={expected}>
                      <th className="p-2 text-xs text-stone-500 font-semibold text-right pr-4">{formatAxisValue(expected)}</th>
                      {allValues.map((observed) => {
                        const cell = cellMap.get(`${expected}-${observed}`);
                        const isSelected = selectedSet.has(`${expected}-${observed}`);
                        const isDiag = expected === observed;
                        const isWimiHigherThanTricia = expected > observed;
                        const hasData = cell && cell.case_count > 0;
                        const isWithinThreshold = Boolean(cell?.within_threshold);

                        let colorClass: string;
                        if (!hasData) {
                          colorClass = 'bg-stone-50 text-stone-300 border-stone-100';
                        } else if (isDiag) {
                          colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
                        } else if (isWithinThreshold) {
                          colorClass = 'bg-lime-50 text-lime-700 border-lime-200 hover:bg-lime-100';
                        } else if (isWimiHigherThanTricia) {
                          colorClass = 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';
                        } else {
                          colorClass = 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100';
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
              {columnAxisLabel && (
                <div className="mt-2 text-xs font-semibold text-stone-500 tracking-wide">{columnAxisLabel}</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
