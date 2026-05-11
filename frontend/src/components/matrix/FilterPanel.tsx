import type { DateWindow, RiskFilter } from '../../state/filters';

type Props = {
  includeExcluded: boolean;
  problematicOnly: boolean;
  problematicCount: number;
  problematicCaseThreshold?: number;
  problemAlarmActive: boolean;
  problemAlarmLabel?: string;
  dateWindow: DateWindow;
  dateFrom?: string;
  dateTo?: string;
  riskFilter: RiskFilter;
  onIncludeExcludedChange: (value: boolean) => void;
  onProblematicOnlyChange: (value: boolean) => void;
  onDateWindowChange: (window: DateWindow) => void;
  onCustomDateRangeChange: (from: string, to: string) => void;
  onRiskFilterChange: (filter: RiskFilter) => void;
};

const DATE_WINDOWS: { value: DateWindow; label: string }[] = [
  { value: '3M', label: '3 Months' },
  { value: '6M', label: '6 Months' },
  { value: '12M', label: '12 Months' },
  { value: 'ALL', label: 'All Time' },
  { value: 'CUSTOM', label: 'Custom' },
];

export function FilterPanel({
  includeExcluded,
  problematicOnly,
  problematicCount,
  problematicCaseThreshold,
  problemAlarmActive,
  problemAlarmLabel,
  dateWindow,
  dateFrom,
  dateTo,
  riskFilter,
  onIncludeExcludedChange,
  onProblematicOnlyChange,
  onDateWindowChange,
  onCustomDateRangeChange,
  onRiskFilterChange,
}: Props) {
  return (
    <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-wrap items-end gap-6">
      {/* Date window */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Period</span>
        <div className="flex gap-1">
          {DATE_WINDOWS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onDateWindowChange(value)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                dateWindow === value
                  ? 'bg-stone-900 text-white'
                  : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        {dateWindow === 'CUSTOM' && (
          <div className="flex items-center gap-2 mt-1">
            <input
              type="date"
              value={dateFrom ?? ''}
              onChange={(e) => onCustomDateRangeChange(e.target.value, dateTo ?? '')}
              className="text-sm border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400"
            />
            <span className="text-stone-400 text-sm">→</span>
            <input
              type="date"
              value={dateTo ?? ''}
              onChange={(e) => onCustomDateRangeChange(dateFrom ?? '', e.target.value)}
              className="text-sm border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400"
            />
          </div>
        )}
      </div>

      {/* Risk filter */}
      <div className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Risk</span>
        <div className="flex gap-1">
          {(['all', 'false_low', 'false_high'] as RiskFilter[]).map((v) => (
            <button
              key={v}
              onClick={() => onRiskFilterChange(v)}
              className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                riskFilter === v ? 'bg-stone-900 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
              }`}
            >
              {v === 'all' ? 'All' : v === 'false_low' ? 'False Low' : 'False High'}
            </button>
          ))}
        </div>
      </div>

      {/* Toggles */}
      <div className="flex flex-col gap-2">
        <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Filters</span>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={problematicOnly}
            onChange={(e) => onProblematicOnlyChange(e.target.checked)}
            className="w-4 h-4 accent-amber-400 cursor-pointer"
          />
          <span className="text-sm text-stone-700">Problematic only cases</span>
        </label>
        <div className={`text-xs px-2 py-1 rounded border ${problemAlarmActive ? 'border-red-300 bg-red-50 text-red-700 animate-pulse' : 'border-stone-200 bg-stone-50 text-stone-600'}`}>
          #Problematic cases: {problematicCount}
          {problematicCaseThreshold !== undefined ? ` / threshold ${problematicCaseThreshold}` : ''}
          {problemAlarmLabel ? ` (${problemAlarmLabel})` : ''}
        </div>
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={includeExcluded}
            onChange={(e) => onIncludeExcludedChange(e.target.checked)}
            className="w-4 h-4 accent-amber-400 cursor-pointer"
          />
          <span className="text-sm text-stone-700">Include Streichresultate</span>
        </label>
      </div>
    </div>
  );
}
