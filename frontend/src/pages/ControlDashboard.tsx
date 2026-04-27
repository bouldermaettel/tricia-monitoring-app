import { useState, useMemo } from 'react';
import { AppShell } from '../components/common/AppShell';
import { ExportButton } from '../components/common/ExportButton';
import { DelaySummary } from '../components/control/DelaySummary';
import { ControlQueueTable } from '../components/control/ControlQueueTable';
import { useControlQueue } from '../hooks/useControlQueue';
import { useImportOverride } from '../state/importOverride';

const EMPTY_ITEMS: never[] = [];

type DateWindow = '3M' | '6M' | '12M' | 'ALL' | 'CUSTOM';

const DATE_WINDOWS: { value: DateWindow; label: string }[] = [
  { value: '3M', label: '3 Months' },
  { value: '6M', label: '6 Months' },
  { value: '12M', label: '12 Months' },
  { value: 'ALL', label: 'All Time' },
  { value: 'CUSTOM', label: 'Custom' },
];

function getDateParams(window: DateWindow, dateFrom?: string, dateTo?: string) {
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

export function ControlDashboard() {
  const [dateWindow, setDateWindow] = useState<DateWindow>('3M');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [reviewWindowDays, setReviewWindowDays] = useState(28);
  const dateParams = getDateParams(dateWindow, dateFrom || undefined, dateTo || undefined);
  const queueParams = { ...dateParams, review_window_days: reviewWindowDays };
  const overrideControlItems = useImportOverride((s) => s.controlItems);
  const overrideSourceFile = useImportOverride((s) => s.sourceFileName);
  const clearPreviewData = useImportOverride((s) => s.clearPreviewData);
  const isOverrideActive = Boolean(overrideSourceFile);
  const queue = useControlQueue(queueParams, { enabled: !isOverrideActive });
  const [exportState, setExportState] = useState<{ columns: string[]; rows: Array<Record<string, unknown>> }>({
    columns: [],
    rows: [],
  });

  const activeItems = useMemo(
    () =>
      isOverrideActive
        ? overrideControlItems.filter((item) => {
            if (dateParams.start_date && item.analysis_date < String(dateParams.start_date)) return false;
            if (dateParams.end_date && item.analysis_date > String(dateParams.end_date)) return false;
            return true;
          }).map((item) => {
            if (!item.input_timestamp) return item;
            const now = new Date();
            const inputTime = new Date(item.input_timestamp);
            const elapsedMs = now.getTime() - inputTime.getTime();
            const delayBucket = elapsedMs <= reviewWindowDays * 24 * 60 * 60 * 1000 ? 'on_time' : 'delayed_72h';
            return { ...item, delay_bucket: delayBucket };
          })
        : queue.data?.items ?? EMPTY_ITEMS,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOverrideActive, overrideControlItems, dateParams.start_date, dateParams.end_date, queue.data, reviewWindowDays]
  );

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Control Dashboard</h1>
        <ExportButton columns={exportState.columns} rows={exportState.rows} fileNamePrefix="control-table" />
      </div>

      {isOverrideActive && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center justify-between gap-3">
          <span>Using uploaded dataset from {overrideSourceFile ?? 'file upload'} for control queue.</span>
          <button className="underline" onClick={clearPreviewData}>Clear</button>
        </div>
      )}

      <div className="flex flex-col gap-6">
        <div className="bg-white border border-stone-200 rounded-xl p-4 flex flex-wrap items-end gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Period</span>
            <div className="flex gap-1">
              {DATE_WINDOWS.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setDateWindow(value)}
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
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="text-sm border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400"
                />
                <span className="text-stone-400 text-sm">→</span>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="text-sm border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400"
                />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="review-window-days" className="text-xs font-semibold text-stone-500 uppercase tracking-wide">
              Review SLA (days)
            </label>
            <input
              id="review-window-days"
              type="number"
              min={1}
              value={reviewWindowDays}
              onChange={(e) => setReviewWindowDays(Math.max(1, Number(e.target.value) || 28))}
              className="w-28 text-sm border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400"
            />
          </div>
        </div>

        <DelaySummary items={activeItems} />
        <ControlQueueTable items={activeItems} onExportStateChange={setExportState} />
      </div>
    </AppShell>
  );
}
