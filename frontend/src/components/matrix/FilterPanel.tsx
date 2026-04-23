type Props = {
  includeExcluded: boolean;
  problematicOnly: boolean;
  onIncludeExcludedChange: (value: boolean) => void;
  onProblematicOnlyChange: (value: boolean) => void;
};

export function FilterPanel({ includeExcluded, problematicOnly, onIncludeExcludedChange, onProblematicOnlyChange }: Props) {
  return (
    <section>
      <label>
        <input type="checkbox" checked={includeExcluded} onChange={(e) => onIncludeExcludedChange(e.target.checked)} />
        Include Excluded
      </label>
      <label>
        <input type="checkbox" checked={problematicOnly} onChange={(e) => onProblematicOnlyChange(e.target.checked)} />
        Problematic Only
      </label>
    </section>
  );
}
