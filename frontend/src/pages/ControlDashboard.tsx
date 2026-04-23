import { useState } from 'react';
import { AppShell } from '../components/common/AppShell';
import { ExportButton } from '../components/common/ExportButton';
import { DelaySummary } from '../components/control/DelaySummary';
import { ControlQueueTable } from '../components/control/ControlQueueTable';
import { useControlQueue } from '../hooks/useControlQueue';

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
  const dateParams = getDateParams(dateWindow, dateFrom || undefined, dateTo || undefined);
  const queue = useControlQueue(dateParams);

  return (
    <AppShell>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-900">Control Dashboard</h1>
        <ExportButton />
      </div>

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
        </div>

        <DelaySummary items={queue.data?.items ?? []} />
        <ControlQueueTable items={queue.data?.items ?? []} />
      </div>
    </AppShell>
  );
}
