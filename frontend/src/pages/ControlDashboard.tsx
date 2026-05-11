import { useState, useMemo } from 'react';
import { AppShell } from '../components/common/AppShell';
import { ExportButton } from '../components/common/ExportButton';
import { DelaySummary } from '../components/control/DelaySummary';
import { ControlQueueTable } from '../components/control/ControlQueueTable';
import { useControlQueue } from '../hooks/useControlQueue';
import { useImportOverride } from '../state/importOverride';

const EMPTY_ITEMS: never[] = [];

type DateWindow = '1W' | 'ALL' | 'CUSTOM';
type DateBasis = 'reported' | 'input';

const DATE_WINDOWS: { value: DateWindow; label: string }[] = [
  { value: '1W', label: '1 Week' },
  { value: 'CUSTOM', label: 'Custom' },
];

function getDateParams(window: DateWindow, dateFrom?: string, dateTo?: string) {
  if (window === 'ALL') return {};
  if (window === 'CUSTOM') {
    return { start_date: dateFrom, end_date: dateTo };
  }
  const days = window === '1W' ? 7 : 0;
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - days);
  return {
    start_date: from.toISOString().slice(0, 10),
    end_date: to.toISOString().slice(0, 10),
  };
}

export function ControlDashboard() {
  const [dateWindow, setDateWindow] = useState<DateWindow>('1W');
  const [dateBasis, setDateBasis] = useState<DateBasis>('reported');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const dateParams = getDateParams(dateWindow, dateFrom || undefined, dateTo || undefined);
  const queueParams = { ...dateParams, date_basis: dateBasis };
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
            const dateValue =
              dateBasis === 'input'
                ? (item.input_timestamp ?? '').slice(0, 10) || item.date_reported || item.analysis_date || ''
                : item.date_reported || item.analysis_date || '';
            if (dateParams.start_date && dateValue < String(dateParams.start_date)) return false;
            if (dateParams.end_date && dateValue > String(dateParams.end_date)) return false;
            return true;
          })
        : queue.data?.items ?? EMPTY_ITEMS,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dateBasis, isOverrideActive, overrideControlItems, dateParams.start_date, dateParams.end_date, queue.data]
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
          <div className="flex items-end gap-5">
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-stone-500 uppercase tracking-wide">Date Selector</span>
              <div className="inline-flex rounded-lg border border-stone-200 bg-stone-50 p-0.5">
                <button
                  type="button"
                  onClick={() => setDateBasis('reported')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    dateBasis === 'reported'
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  Reported Date
                </button>
                <button
                  type="button"
                  onClick={() => setDateBasis('input')}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    dateBasis === 'input'
                      ? 'bg-stone-900 text-white'
                      : 'text-stone-600 hover:bg-stone-100'
                  }`}
                >
                  Input Date
                </button>
              </div>
            </div>
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
              </div>
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

        <DelaySummary items={activeItems} />
        <ControlQueueTable items={activeItems} onExportStateChange={setExportState} />
      </div>
    </AppShell>
  );
}
