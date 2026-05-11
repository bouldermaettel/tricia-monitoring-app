import { useEffect, useMemo, useState } from 'react';
import { formatIsoDateToGerman } from '../../utils/date';

type ControlItem = {
  vk_number: string;
  date_reported?: string;
  analysis_date?: string;
  input_timestamp?: string;
  wimi_shortcut?: string;
  user_id?: string;
  validation_status: string;
};

type ColumnId = 'vk_number' | 'date_reported' | 'input_timestamp' | 'user_id' | 'validation_status';
type SortDirection = 'asc' | 'desc';

const COLUMN_LABELS: Record<ColumnId, string> = {
  vk_number: 'VK Number',
  date_reported: 'Date Reported',
  input_timestamp: 'Input Timestamp',
  user_id: 'WiMi',
  validation_status: 'Status',
};

export function ControlQueueTable({
  items,
  onExportStateChange,
}: {
  items: ControlItem[];
  onExportStateChange?: (payload: { columns: string[]; rows: Array<Record<string, unknown>> }) => void;
}) {
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnId, boolean>>({
    vk_number: true,
    date_reported: true,
    input_timestamp: true,
    user_id: true,
    validation_status: true,
  });
  const [filters, setFilters] = useState<Record<ColumnId, string>>({
    vk_number: '',
    date_reported: '',
    input_timestamp: '',
    user_id: '',
    validation_status: '',
  });
  const [dateFilterFrom, setDateFilterFrom] = useState('');
  const [dateFilterTo, setDateFilterTo] = useState('');
  const [inputTimestampFilterFrom, setInputTimestampFilterFrom] = useState('');
  const [inputTimestampFilterTo, setInputTimestampFilterTo] = useState('');
  const [showDateReportedPicker, setShowDateReportedPicker] = useState(false);
  const [showInputTimestampPicker, setShowInputTimestampPicker] = useState(false);
  const [sortBy, setSortBy] = useState<{ column: ColumnId; direction: SortDirection } | null>(null);

  const columns = useMemo(
    () => (Object.keys(COLUMN_LABELS) as ColumnId[]).filter((columnId) => visibleColumns[columnId]),
    [visibleColumns]
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.validation_status).filter(Boolean))),
    [items]
  );

  const filteredItems = useMemo(() => {
    const normalized = Object.fromEntries(
      (Object.entries(filters) as Array<[ColumnId, string]>).map(([key, value]) => [key, value.trim().toLowerCase()])
    ) as Record<ColumnId, string>;

    return items.filter((item) => {
      if (normalized.vk_number && !item.vk_number.toLowerCase().includes(normalized.vk_number)) return false;
      if (dateFilterFrom && (item.date_reported ?? '') < dateFilterFrom) return false;
      if (dateFilterTo && (item.date_reported ?? '') > dateFilterTo) return false;
      if (inputTimestampFilterFrom || inputTimestampFilterTo) {
        const itemTimestamp = item.input_timestamp ? new Date(item.input_timestamp).getTime() : NaN;
        if (!Number.isFinite(itemTimestamp)) return false;

        if (inputTimestampFilterFrom) {
          const fromTimestamp = new Date(inputTimestampFilterFrom).getTime();
          if (Number.isFinite(fromTimestamp) && itemTimestamp < fromTimestamp) return false;
        }

        if (inputTimestampFilterTo) {
          const toTimestamp = new Date(inputTimestampFilterTo).getTime();
          if (Number.isFinite(toTimestamp) && itemTimestamp > toTimestamp) return false;
        }
      }
      const wimiText = (item.wimi_shortcut ?? item.user_id ?? '').toLowerCase();
      if (normalized.user_id && !wimiText.includes(normalized.user_id)) return false;
      if (normalized.validation_status && item.validation_status.toLowerCase() !== normalized.validation_status) return false;
      return true;
    });
  }, [dateFilterFrom, dateFilterTo, filters, inputTimestampFilterFrom, inputTimestampFilterTo, items]);

  const itemOrderByVk = useMemo(() => new Map(items.map((item, index) => [item.vk_number, index])), [items]);

  const sortedItems = useMemo(() => {
    if (!sortBy) return filteredItems;

    const directionFactor = sortBy.direction === 'asc' ? 1 : -1;

    const getSortValue = (item: ControlItem): number | string => {
      switch (sortBy.column) {
        case 'vk_number':
          return item.vk_number.toLowerCase();
        case 'date_reported':
          return item.date_reported ? new Date(item.date_reported).getTime() : -Infinity;
        case 'input_timestamp':
          return item.input_timestamp ? new Date(item.input_timestamp).getTime() : -Infinity;
        case 'user_id':
          return (item.wimi_shortcut ?? item.user_id ?? '').toLowerCase();
        case 'validation_status':
          return (item.validation_status ?? '').toLowerCase();
        default:
          return '';
      }
    };

    return [...filteredItems].sort((left, right) => {
      const leftValue = getSortValue(left);
      const rightValue = getSortValue(right);

      if (leftValue < rightValue) return -1 * directionFactor;
      if (leftValue > rightValue) return 1 * directionFactor;

      return (itemOrderByVk.get(left.vk_number) ?? 0) - (itemOrderByVk.get(right.vk_number) ?? 0);
    });
  }, [filteredItems, itemOrderByVk, sortBy]);

  function toggleSort(column: ColumnId) {
    setSortBy((previous) => {
      if (!previous || previous.column !== column) {
        return { column, direction: 'asc' };
      }
      return { column, direction: previous.direction === 'asc' ? 'desc' : 'asc' };
    });
  }

  function getSortIndicator(column: ColumnId): string {
    if (!sortBy || sortBy.column !== column) return '↕';
    return sortBy.direction === 'asc' ? '↑' : '↓';
  }

  useEffect(() => {
    if (!onExportStateChange) return;
    const exportColumns = columns.map((columnId) => COLUMN_LABELS[columnId]);
    const exportRows = sortedItems.map((item) => {
      const row: Record<string, unknown> = {};
      columns.forEach((columnId) => {
        if (columnId === 'date_reported') {
          row[COLUMN_LABELS[columnId]] = formatIsoDateToGerman(item.date_reported);
          return;
        }
        if (columnId === 'input_timestamp') {
          row[COLUMN_LABELS[columnId]] = item.input_timestamp ? new Date(item.input_timestamp).toLocaleString() : '';
          return;
        }
        if (columnId === 'user_id') {
          row[COLUMN_LABELS[columnId]] = item.wimi_shortcut ?? item.user_id ?? '';
          return;
        }
        row[COLUMN_LABELS[columnId]] = item[columnId];
      });
      return row;
    });
    onExportStateChange({ columns: exportColumns, rows: exportRows });
  }, [columns, onExportStateChange, sortedItems]);

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setFilters({
                vk_number: '',
                date_reported: '',
                input_timestamp: '',
                user_id: '',
                validation_status: '',
              });
              setDateFilterFrom('');
              setDateFilterTo('');
              setInputTimestampFilterFrom('');
              setInputTimestampFilterTo('');
              setShowDateReportedPicker(false);
              setShowInputTimestampPicker(false);
            }}
            className="px-3 py-1.5 rounded text-sm font-medium bg-white border border-stone-200 hover:bg-stone-100"
          >
            Reset filters
          </button>
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
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-stone-200 bg-stone-50">
              {columns.map((columnId) => (
                <th key={columnId} className="text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide">
                  <button
                    type="button"
                    onClick={() => toggleSort(columnId)}
                    className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-stone-200 text-xs font-semibold uppercase tracking-wide"
                    title="Sort"
                  >
                    {COLUMN_LABELS[columnId]}
                    <span className="text-[10px] text-stone-400">{getSortIndicator(columnId)}</span>
                  </button>
                  {columnId === 'date_reported' && (
                    <button
                      type="button"
                      onClick={() => setShowDateReportedPicker((previous) => !previous)}
                      className="rounded px-1 py-0.5 text-[10px] text-stone-400 hover:bg-stone-200"
                      title="Toggle date range picker"
                    >
                      {showDateReportedPicker ? '▲' : '▼'}
                    </button>
                  )}
                  {columnId === 'input_timestamp' && (
                    <button
                      type="button"
                      onClick={() => setShowInputTimestampPicker((previous) => !previous)}
                      className="rounded px-1 py-0.5 text-[10px] text-stone-400 hover:bg-stone-200"
                      title="Toggle input timestamp range picker"
                    >
                      {showInputTimestampPicker ? '▲' : '▼'}
                    </button>
                  )}
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
                  ) : columnId === 'date_reported' ? (
                    <div className="space-y-1">
                      {showDateReportedPicker ? (
                        <>
                          <input
                            type="date"
                            value={dateFilterFrom}
                            onChange={(e) => setDateFilterFrom(e.target.value)}
                            className="w-full text-xs border border-stone-200 rounded px-2 py-1 bg-white"
                            title="Date Reported from"
                          />
                          <input
                            type="date"
                            value={dateFilterTo}
                            onChange={(e) => setDateFilterTo(e.target.value)}
                            className="w-full text-xs border border-stone-200 rounded px-2 py-1 bg-white"
                            title="Date Reported to"
                          />
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowDateReportedPicker(true)}
                          className="w-full text-left text-[11px] text-stone-500 border border-dashed border-stone-300 rounded px-2 py-1 hover:bg-stone-50"
                        >
                          Filter
                        </button>
                      )}
                    </div>
                  ) : columnId === 'input_timestamp' ? (
                    <div className="space-y-1">
                      {showInputTimestampPicker ? (
                        <>
                          <input
                            type="datetime-local"
                            value={inputTimestampFilterFrom}
                            onChange={(e) => setInputTimestampFilterFrom(e.target.value)}
                            className="w-full text-xs border border-stone-200 rounded px-2 py-1 bg-white"
                            title="Input Timestamp from"
                          />
                          <input
                            type="datetime-local"
                            value={inputTimestampFilterTo}
                            onChange={(e) => setInputTimestampFilterTo(e.target.value)}
                            className="w-full text-xs border border-stone-200 rounded px-2 py-1 bg-white"
                            title="Input Timestamp to"
                          />
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setShowInputTimestampPicker(true)}
                          className="w-full text-left text-[11px] text-stone-500 border border-dashed border-stone-300 rounded px-2 py-1 hover:bg-stone-50"
                        >
                          Filter
                        </button>
                      )}
                    </div>
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
            {sortedItems.map((item) => (
              <tr key={item.vk_number} className="border-b border-stone-100 last:border-0 hover:bg-stone-50">
                {columns.map((columnId) => {
                  if (columnId === 'vk_number') {
                    return (
                      <td key={columnId} className="px-4 py-2.5 font-mono text-xs text-stone-700">
                        {item.vk_number}
                      </td>
                    );
                  }
                  if (columnId === 'date_reported') {
                    return (
                      <td key={columnId} className="px-4 py-2.5 font-mono text-xs text-stone-600">
                        {formatIsoDateToGerman(item.date_reported)}
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
                    <td key={columnId} className="px-4 py-2.5 text-stone-400">
                      —
                    </td>
                  );
                })}
              </tr>
            ))}
            {sortedItems.length === 0 && (
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
