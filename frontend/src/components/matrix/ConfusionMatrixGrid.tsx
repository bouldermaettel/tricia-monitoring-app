type Cell = {
  expected_value: number;
  observed_value: number;
  case_count: number;
  within_threshold: boolean;
};

type Props = {
  cells: Cell[];
  onCellClick: (expected: number, observed: number) => void;
};

export function ConfusionMatrixGrid({ cells, onCellClick }: Props) {
  return (
    <div>
      {cells.map((cell) => (
        <button
          key={`${cell.expected_value}-${cell.observed_value}`}
          onClick={() => onCellClick(cell.expected_value, cell.observed_value)}
        >
          {cell.expected_value}:{cell.observed_value} ({cell.case_count})
        </button>
      ))}
    </div>
  );
}
