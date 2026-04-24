export function MatrixLegend() {
  return (
    <div className="flex flex-wrap items-center gap-4 text-sm text-stone-600">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-emerald-50 border border-emerald-200" />
        <span>Same value (WIMI = TRICIA)</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-red-50 border border-red-200" />
        <span>TRICIA lower than WIMI</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-yellow-50 border border-yellow-200" />
        <span>TRICIA higher than WIMI</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded bg-stone-50 border border-stone-100" />
        <span>No cases</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded ring-2 ring-amber-400 ring-offset-1 bg-white" />
        <span>Selected cell</span>
      </div>
    </div>
  );
}
