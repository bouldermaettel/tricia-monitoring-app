import { useMemo, useState } from 'react';
import { formatIsoDateToGerman } from '../../utils/date';

type ControlItem = {
  vk_number: string;
  analysis_date?: string;
  input_timestamp?: string;
  wimi_shortcut?: string;
  user_id?: string;
  delay_bucket: string;
  validation_status: string;
};

const DELAY_COLORS: Record<string, string> = {
  on_time: 'bg-emerald-100 text-emerald-700',
  slightly_late: 'bg-amber-100 text-amber-700',
  late: 'bg-orange-100 text-orange-700',
  very_late: 'bg-red-100 text-red-700',
};

type ColumnId = 'vk_number' | 'analysis_date' | 'input_timestamp' | 'user_id' | 'validation_status' | 'delay_bucket';

const COLUMN_LABELS: Record<ColumnId, string> = {
  vk_number: 'VK Number',
  analysis_date: 'Analysis Date',
  input_timestamp: 'Input Timestamp',
  user_id: 'WiMi',
  validation_status: 'Status',
  delay_bucket: 'Delay',
};

export function ControlQueueTable({ items }: { items: ControlItem[] }) {
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnId, boolean>>({
    vk_number: true,
    analysis_date: true,
    input_timestamp: true,
    user_id: true,
    validation_status: true,
    delay_bucket: true,
  });
  const [filters, setFilters] = useState<Record<ColumnId, string>>({
    vk_number: '',
    analysis_date: '',
    input_timestamp: '',
    user_id: '',
    validation_status: '',
    delay_bucket: '',
  });

  const columns = useMemo(
    () => (Object.keys(COLUMN_LABELS) as ColumnId[]).filter((columnId) => visibleColumns[columnId]),
    [visibleColumns]
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.validation_status).filter(Boolean))),
    [items]
  );
  const delayOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.delay_bucket).filter(Boolean))),
    [items]
  );

  const filteredItems = useMemo(() => {
    const normalized = Object.fromEntries(
      (Object.entries(filters) as Array<[ColumnId, string]>).map(([key, value]) => [key, value.trim().toLowerCase()])
    ) as Record<ColumnId, string>;

    return items.filter((item) => {
      if (normalized.vk_number && !item.vk_number.toLowerCase().includes(normalized.vk_number)) return false;
      if (normalized.analysis_date) {
        const isoDate = item.analysis_date ?? '';
        const deDate = formatIsoDateToGerman(item.analysis_date).toLowerCase();
        if (!isoDate.toLowerCase().includes(normalized.analysis_date) && !deDate.includes(normalized.analysis_date)) {
          return false;
        }
      }
      if (normalized.input_timestamp) {
        const text = item.input_timestamp ? new Date(item.input_timestamp).toLocaleString().toLowerCase() : '';
        if (!text.includes(normalized.input_timestamp)) return false;
      }
      const wimiText = (item.wimi_shortcut ?? item.user_id ?? '').toLowerCase();
      if (normalized.user_id && !wimiText.includes(normalized.user_id)) return false;
      if (normalized.validation_status && item.validation_status.toLowerCase() !== normalized.validation_status) return false;
      if (normalized.delay_bucket && item.delay_bucket.toLowerCase() !== normalized.delay_bucket) return false;
      return true;
    });
  }, [filters, items]);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-stone-400 text-sm">
        No entries for the selected period.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
        <span className="text-xs text-stone-500">
          Showing {filteredItems.length} of {items.length} entries
        </span>
        <details className="relative">
          <summary className="list-none cursor-pointer px-3 py-1.5 rounded text-sm font-medium bg-white border border-stone-200 hover:bg-stone-100">
            Columns
          </summary>
          <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-stone-200 bg-white shadow-lg p-3 flex flex-col gap-2">
            {(Object.keys(COLUMN_LABELS) as ColumnId[]).map((columnId) => (
              <label key={columnId} className="flex items-center gap-2 text-sm text-stone-700">
                <input
                  type="checkbox"
                  checked={visibleColumns[columnId]}
                  onChange={(e) =>
                    setVisibleColumns((previous) => ({
                      ...previous,
                      [columnId]: e.target.checked,
                    }))
                  }
                />
                <span>{COLUMN_LABELS[columnId]}</span>
              </label>
            ))}
          </div>
        </details>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              {columns.map((columnId) => (
                <th key={columnId} className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  {COLUMN_LABELS[columnId]}
                </th>
              ))}
            </tr>
            <tr className="border-b border-stone-200 bg-white">
              {columns.map((columnId) => (
                <th key={columnId} className="px-4 py-2">
                  {columnId === 'validation_status' ? (
                    <select
                      value={filters.validation_status}
                      onChange={(e) => setFilters((previous) => ({ ...previous, validation_status: e.target.value }))}
                      className="w-full text-xs border border-stone-200 rounded px-2 py-1 bg-white"
                    >
                      <option value="">All</option>
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  ) : columnId === 'delay_bucket' ? (
                    <select
                      value={filters.delay_bucket}
                      onChange={(e) => setFilters((previous) => ({ ...previous, delay_bucket: e.target.value }))}
                      className="w-full text-xs border border-stone-200 rounded px-2 py-1 bg-white"
                    >
                      <option value="">All</option>
                      {delayOptions.map((delay) => (
                        <option key={delay} value={delay}>
                          {delay.replace(/_/g, ' ')}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={filters[columnId]}
                      onChange={(e) => setFilters((previous) => ({ ...previous, [columnId]: e.target.value }))}
                      placeholder="Filter..."
                      className="w-full text-xs border border-stone-200 rounded px-2 py-1"
                    />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.vk_number} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                {columns.map((columnId) => {
                  if (columnId === 'vk_number') {
                    return (
                      <td key={columnId} className="px-4 py-2.5 font-mono text-xs text-stone-700">
                        {item.vk_number}
                      </td>
                    );
                  }
                  if (columnId === 'analysis_date') {
                    return (
                      <td key={columnId} className="px-4 py-2.5 font-mono text-xs text-stone-600">
                        {formatIsoDateToGerman(item.analysis_date)}
                      </td>
                    );
                  }
                  if (columnId === 'input_timestamp') {
                    return (
                      <td key={columnId} className="px-4 py-2.5 font-mono text-xs text-stone-600">
                        {item.input_timestamp ? new Date(item.input_timestamp).toLocaleString() : '—'}
                      </td>
                    );
                  }
                  if (columnId === 'user_id') {
                    return (
                      <td key={columnId} className="px-4 py-2.5 text-stone-700">
                        {item.wimi_shortcut ?? item.user_id ?? '—'}
                      </td>
                    );
                  }
                  if (columnId === 'validation_status') {
                    return (
                      <td key={columnId} className="px-4 py-2.5">
                        <span className="text-xs text-stone-500">{item.validation_status}</span>
                      </td>
                    );
                  }
                  return (
                    <td key={columnId} className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          DELAY_COLORS[item.delay_bucket] ?? 'bg-stone-100 text-stone-600'
                        }`}
                      >
                        {item.delay_bucket.replace(/_/g, ' ')}
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={Math.max(columns.length, 1)} className="px-4 py-8 text-center text-sm text-stone-400">
                  No entries match the selected filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
