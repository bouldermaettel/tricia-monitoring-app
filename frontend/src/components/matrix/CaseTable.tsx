import { useEffect, useMemo, useState } from 'react';
import { Check, MessageSquare, MinusCircle, Pencil, Tag, Trash2, X } from 'lucide-react';
import { useCaseAuditTrail } from '../../hooks/useCases';
import { formatIsoDateToGerman } from '../../utils/date';

type CaseItem = {
  id: string;
  vk_number: string;
  wimi_shortcut?: string;
  date_reported?: string;
  device_name?: string;
  tricia_s?: number;
  user_s?: number;
  tricia_d?: number;
  user_d?: number;
  category_code?: string;
  risk_level?: string;
  is_excluded?: boolean;
  is_reviewed?: boolean;
  has_edits?: boolean;
};

type ColumnId =
  | 'vk_number'
  | 'wimi_shortcut'
  | 'date_reported'
  | 'device_name'
  | 'tricia_s'
  | 'user_s'
  | 'tricia_d'
  | 'user_d'
  | 'category_code'
  | 'comment'
  | 'is_excluded'
  | 'is_reviewed'
  | 'actions';

type EditValues = {
  device_name: string;
  tricia_s: number;
  tricia_d: number;
  user_s: number;
  user_d: number;
};

type AuditEvent = {
  id: number;
  actor_id?: string | null;
  action: string;
  created_at: string;
  changes: Record<string, { from: string | number | boolean | null; to: string | number | boolean | null }>;
};

type Props = {
  items: CaseItem[];
  onMarkReviewed?: (id: string, isReviewed: boolean) => void;
  onToggleExcluded?: (id: string, current: boolean) => void;
  onSetCategory?: (id: string, category: string) => void;
  onAddComment?: (id: string, text: string) => void;
  onEditCase?: (id: string, payload: Partial<EditValues>) => void | Promise<unknown>;
  onDeleteCase?: (id: string) => void;
  onExportStateChange?: (payload: { columns: string[]; rows: Array<Record<string, unknown>> }) => void;
};

const CATEGORY_OPTIONS = [
  { value: '', label: '—' },
  { value: 'no_issue', label: 'Kein Problem' },
  { value: 'monitor', label: 'Beobachtung' },
  { value: 'problem', label: 'Problem' },
];

const COLUMN_LABELS: Record<ColumnId, string> = {
  vk_number: 'VK',
  wimi_shortcut: 'WIMI',
  date_reported: 'Date Reported',
  device_name: 'Device',
  tricia_s: 'TRI-S',
  user_s: 'WIMI-S',
  tricia_d: 'TRI-D',
  user_d: 'WIMI-D',
  category_code: 'Category',
  comment: 'Comment',
  is_excluded: 'Excl.',
  is_reviewed: 'Reviewed',
  actions: 'Edit',
};

const COLUMN_DB_NAMES: Record<ColumnId, string> = {
  vk_number: 'vk_number',
  wimi_shortcut: 'wimi_shortcut',
  date_reported: 'date_reported',
  device_name: 'device_name',
  tricia_s: 'tricia_s',
  user_s: 'user_s',
  tricia_d: 'tricia_d',
  user_d: 'user_d',
  category_code: 'category_code',
  comment: 'comment_text',
  is_excluded: 'is_excluded',
  is_reviewed: 'is_reviewed',
  actions: 'has_edits',
};

function deviation(a?: number, b?: number) {
  if (a === undefined || b === undefined) return 0;
  return Math.abs(a - b);
}

function rowColor(item: CaseItem) {
  const devS = deviation(item.tricia_s, item.user_s);
  const devD = deviation(item.tricia_d, item.user_d);
  const maxDev = Math.max(devS, devD);
  if (maxDev > 1) {
    return item.risk_level === 'false_low'
      ? 'bg-red-50 border-l-2 border-l-red-500'
      : 'bg-orange-50 border-l-2 border-l-orange-400';
  }
  return 'bg-emerald-50/50';
}

export function CaseTable({ items, onMarkReviewed, onToggleExcluded, onSetCategory, onAddComment, onEditCase, onDeleteCase, onExportStateChange }: Props) {
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({ device_name: '', tricia_s: 1, tricia_d: 1, user_s: 1, user_d: 1 });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [changedCaseIds, setChangedCaseIds] = useState<Record<string, boolean>>({});
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnId, boolean>>({
    vk_number: true,
    wimi_shortcut: true,
    date_reported: true,
    device_name: true,
    tricia_s: true,
    user_s: true,
    tricia_d: true,
    user_d: true,
    category_code: true,
    comment: true,
    is_excluded: true,
    is_reviewed: true,
    actions: true,
  });
  const [filters, setFilters] = useState<Record<ColumnId, string>>({
    vk_number: '',
    wimi_shortcut: '',
    date_reported: '',
    device_name: '',
    tricia_s: '',
    user_s: '',
    tricia_d: '',
    user_d: '',
    category_code: '',
    comment: '',
    is_excluded: '',
    is_reviewed: '',
    actions: '',
  });
  const emptyFilters: Record<ColumnId, string> = {
    vk_number: '',
    wimi_shortcut: '',
    date_reported: '',
    device_name: '',
    tricia_s: '',
    user_s: '',
    tricia_d: '',
    user_d: '',
    category_code: '',
    comment: '',
    is_excluded: '',
    is_reviewed: '',
    actions: '',
  };

  function startEdit(item: CaseItem) {
    setEditingId(item.id);
    setEditValues({
      device_name: item.device_name ?? '',
      tricia_s: item.tricia_s ?? 1,
      tricia_d: item.tricia_d ?? 1,
      user_s: item.user_s ?? 1,
      user_d: item.user_d ?? 1,
    });
  }

  async function commitEdit(id: string) {
    if (!onEditCase) return;
    setIsSavingEdit(true);
    try {
      await Promise.resolve(onEditCase(id, editValues));
      setChangedCaseIds((previous) => ({ ...previous, [id]: true }));
      await auditTrail.refetch();
    } finally {
      setIsSavingEdit(false);
    }
  }

  function handleDelete(item: CaseItem) {
    if (window.confirm(`Delete case ${item.vk_number}? This cannot be undone.`)) {
      onDeleteCase?.(item.id);
    }
  }

  const columns = useMemo(
    () => (Object.keys(COLUMN_LABELS) as ColumnId[]).filter((columnId) => visibleColumns[columnId]),
    [visibleColumns]
  );

  const categoryOptions = useMemo(
    () => Array.from(new Set(items.map((item) => item.category_code).filter(Boolean))) as string[],
    [items]
  );

  const filteredItems = useMemo(() => {
    const normalized = Object.fromEntries(
      (Object.entries(filters) as Array<[ColumnId, string]>).map(([key, value]) => [key, value.trim().toLowerCase()])
    ) as Record<ColumnId, string>;

    const matchesNumeric = (value: number | undefined, term: string) =>
      term === '' || (value !== undefined && String(value) === term);

    return items.filter((item) => {
      const isEdited = Boolean(changedCaseIds[item.id] || item.has_edits);
      if (normalized.vk_number && !item.vk_number.toLowerCase().includes(normalized.vk_number)) return false;
      if (normalized.wimi_shortcut && !(item.wimi_shortcut ?? '').toLowerCase().includes(normalized.wimi_shortcut)) return false;
      if (normalized.date_reported) {
        const isoDate = item.date_reported ?? '';
        const deDate = formatIsoDateToGerman(item.date_reported).toLowerCase();
        if (!isoDate.toLowerCase().includes(normalized.date_reported) && !deDate.includes(normalized.date_reported)) {
          return false;
        }
      }
      if (normalized.device_name && !(item.device_name ?? '').toLowerCase().includes(normalized.device_name)) return false;
      if (!matchesNumeric(item.tricia_s, normalized.tricia_s)) return false;
      if (!matchesNumeric(item.user_s, normalized.user_s)) return false;
      if (!matchesNumeric(item.tricia_d, normalized.tricia_d)) return false;
      if (!matchesNumeric(item.user_d, normalized.user_d)) return false;
      if (normalized.category_code && (item.category_code ?? '').toLowerCase() !== normalized.category_code) return false;
      if (normalized.comment && !(commentInputs[item.id] ?? '').toLowerCase().includes(normalized.comment)) return false;
      if (normalized.is_excluded) {
        const expected = normalized.is_excluded === 'yes';
        if (Boolean(item.is_excluded) !== expected) return false;
      }
      if (normalized.is_reviewed) {
        const expected = normalized.is_reviewed === 'yes';
        if (Boolean(item.is_reviewed) !== expected) return false;
      }
      if (normalized.actions) {
        if (normalized.actions === 'edited' && !isEdited) return false;
        if (normalized.actions === 'not_edited' && isEdited) return false;
      }
      return true;
    });
  }, [changedCaseIds, commentInputs, filters, items]);

  useEffect(() => {
    if (!onExportStateChange) return;
    const exportColumns = columns.map((columnId) => COLUMN_DB_NAMES[columnId]);
    const exportRows = filteredItems.map((item) => {
      const row: Record<string, unknown> = {};
      columns.forEach((columnId) => {
        if (columnId === 'comment') {
          row[COLUMN_DB_NAMES[columnId]] = commentInputs[item.id] ?? '';
          return;
        }
        if (columnId === 'actions') {
          row[COLUMN_DB_NAMES[columnId]] = Boolean(changedCaseIds[item.id] || item.has_edits);
          return;
        }
        row[COLUMN_DB_NAMES[columnId]] = item[columnId as keyof CaseItem] ?? '';
      });
      return row;
    });
    onExportStateChange({ columns: exportColumns, rows: exportRows });
  }, [changedCaseIds, columns, commentInputs, filteredItems, onExportStateChange]);

  const editingItem = useMemo(
    () => items.find((item) => item.id === editingId) ?? null,
    [editingId, items]
  );
  const auditTrail = useCaseAuditTrail(editingId ?? undefined, 100);
  const wimiAuditEvents = useMemo(() => {
    const events = (auditTrail.data?.items ?? []) as AuditEvent[];
    const shortcut = editingItem?.wimi_shortcut?.trim().toLowerCase();
    if (!shortcut) return events;
    return events.filter((event) => {
      const actor = (event.actor_id ?? '').trim().toLowerCase();
      return actor === shortcut || actor.includes(shortcut);
    });
  }, [auditTrail.data?.items, editingItem?.wimi_shortcut]);
  const auditEventsToShow = wimiAuditEvents.length > 0 ? wimiAuditEvents : ((auditTrail.data?.items ?? []) as AuditEvent[]);

  const S_OPTS = [1, 3, 5, 8, 10];
  const D_OPTS = [1, 5, 10];

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-stone-400 text-sm">
        No cases for the selected filters.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-stone-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between gap-3">
        <span className="text-xs text-stone-500">
          Showing {filteredItems.length} of {items.length} cases
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilters(emptyFilters)}
            className="px-3 py-1.5 rounded text-sm font-medium bg-white border border-stone-200 hover:bg-stone-100"
          >
            Reset filters
          </button>
          <details className="relative">
            <summary className="list-none cursor-pointer px-3 py-1.5 rounded text-sm font-medium bg-white border border-stone-200 hover:bg-stone-100">
              Columns
            </summary>
            <div className="absolute right-0 z-10 mt-1 w-60 rounded-lg border border-stone-200 bg-white shadow-lg p-3 flex flex-col gap-2">
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
                <th
                  key={columnId}
                  className={`px-3 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide ${
                    columnId === 'tricia_s' ||
                    columnId === 'user_s' ||
                    columnId === 'tricia_d' ||
                    columnId === 'user_d' ||
                    columnId === 'is_excluded' ||
                    columnId === 'is_reviewed'
                      ? 'text-center'
                      : 'text-left'
                  }`}
                >
                  {COLUMN_LABELS[columnId]}
                </th>
              ))}
            </tr>
            <tr className="border-b border-stone-200 bg-white">
              {columns.map((columnId) => (
                <th key={columnId} className="px-3 py-2">
                  {columnId === 'category_code' ? (
                    <select
                      value={filters.category_code}
                      onChange={(e) => setFilters((previous) => ({ ...previous, category_code: e.target.value }))}
                      className="w-full text-xs border border-stone-200 rounded px-2 py-1 bg-white"
                    >
                      <option value="">All</option>
                      {categoryOptions.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  ) : columnId === 'is_excluded' || columnId === 'is_reviewed' ? (
                    <select
                      value={filters[columnId]}
                      onChange={(e) => setFilters((previous) => ({ ...previous, [columnId]: e.target.value }))}
                      className="w-full text-xs border border-stone-200 rounded px-2 py-1 bg-white"
                    >
                      <option value="">All</option>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  ) : columnId === 'actions' ? (
                    <select
                      value={filters.actions}
                      onChange={(e) => setFilters((previous) => ({ ...previous, actions: e.target.value }))}
                      className="w-full text-xs border border-stone-200 rounded px-2 py-1 bg-white"
                    >
                      <option value="">All</option>
                      <option value="edited">Edited</option>
                      <option value="not_edited">Not edited</option>
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
            {filteredItems.map((item) => {
              return (
              <tr key={item.id} className={`border-b border-stone-100 last:border-0 ${rowColor(item)}`}>
                {columns.map((columnId) => {
                  if (columnId === 'vk_number') {
                    return <td key={columnId} className="px-4 py-2.5 font-mono text-xs text-stone-700">{item.vk_number}</td>;
                  }
                  if (columnId === 'wimi_shortcut') {
                    return <td key={columnId} className="px-4 py-2.5 font-mono text-xs text-stone-700">{item.wimi_shortcut ?? '—'}</td>;
                  }
                  if (columnId === 'date_reported') {
                    return <td key={columnId} className="px-4 py-2.5 font-mono text-xs text-stone-600">{formatIsoDateToGerman(item.date_reported)}</td>;
                  }
                  if (columnId === 'device_name') {
                    return <td key={columnId} className="px-4 py-2.5 text-stone-700">{item.device_name ?? '—'}</td>;
                  }
                  if (columnId === 'tricia_s') {
                    return <td key={columnId} className="px-3 py-2.5 text-center font-mono">{item.tricia_s ?? '—'}</td>;
                  }
                  if (columnId === 'user_s') {
                    return <td key={columnId} className="px-3 py-2.5 text-center font-mono font-semibold">{item.user_s ?? '—'}</td>;
                  }
                  if (columnId === 'tricia_d') {
                    return <td key={columnId} className="px-3 py-2.5 text-center font-mono">{item.tricia_d ?? '—'}</td>;
                  }
                  if (columnId === 'user_d') {
                    return <td key={columnId} className="px-3 py-2.5 text-center font-mono font-semibold">{item.user_d ?? '—'}</td>;
                  }
                  if (columnId === 'category_code') {
                    return (
                      <td key={columnId} className="px-3 py-2.5">
                        {onSetCategory ? (
                          <select
                            value={item.category_code ?? ''}
                            onChange={(e) => onSetCategory(item.id, e.target.value)}
                            className="text-xs border border-stone-200 rounded px-1.5 py-1 bg-white outline-none focus:border-amber-400 cursor-pointer"
                          >
                            {CATEGORY_OPTIONS.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <span className="flex items-center gap-1 text-xs text-stone-500">
                            <Tag size={12} />
                            {item.category_code ?? '—'}
                          </span>
                        )}
                      </td>
                    );
                  }
                  if (columnId === 'comment') {
                    return (
                      <td key={columnId} className="px-3 py-2.5">
                        {onAddComment ? (
                          <div className="flex gap-1">
                            <input
                              value={commentInputs[item.id] ?? ''}
                              onChange={(e) => setCommentInputs((p) => ({ ...p, [item.id]: e.target.value }))}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && commentInputs[item.id]?.trim()) {
                                  onAddComment(item.id, commentInputs[item.id]);
                                  setCommentInputs((p) => ({ ...p, [item.id]: '' }));
                                }
                              }}
                              placeholder="Add…"
                              className="text-xs border border-stone-200 rounded px-2 py-1 w-28 outline-none focus:border-amber-400"
                            />
                            <button
                              onClick={() => {
                                if (commentInputs[item.id]?.trim()) {
                                  onAddComment(item.id, commentInputs[item.id]);
                                  setCommentInputs((p) => ({ ...p, [item.id]: '' }));
                                }
                              }}
                              className="text-stone-400 hover:text-stone-700"
                              title="Submit comment"
                            >
                              <MessageSquare size={13} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-400">—</span>
                        )}
                      </td>
                    );
                  }
                  if (columnId === 'is_excluded') {
                    return (
                      <td key={columnId} className="px-3 py-2.5 text-center">
                        <button
                          onClick={() => onToggleExcluded?.(item.id, item.is_excluded ?? false)}
                          title="Toggle Streichresultat"
                          className={`transition-colors ${
                            item.is_excluded ? 'text-red-500 hover:text-red-700' : 'text-stone-300 hover:text-stone-500'
                          }`}
                        >
                          <MinusCircle size={16} />
                        </button>
                      </td>
                    );
                  }
                  if (columnId === 'actions') {
                    return (
                      <td key={columnId} className="px-3 py-2.5 text-center">
                        <div className="flex items-center gap-1 justify-center">
                          {onEditCase && (
                            <button
                              onClick={() => startEdit(item)}
                              title="Edit"
                              className={`transition-colors ${
                                (changedCaseIds[item.id] || item.has_edits) ? 'text-red-500 hover:text-red-700' : 'text-stone-400 hover:text-amber-600'
                              }`}
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          {onDeleteCase && (
                            <button onClick={() => handleDelete(item)} title="Delete" className="text-stone-300 hover:text-red-500 transition-colors">
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  }
                  // default: is_reviewed
                  return (
                    <td key={columnId} className="px-3 py-2.5 text-center">
                      <button
                        onClick={() => onMarkReviewed?.(item.id, item.is_reviewed ?? false)}
                        title={item.is_reviewed ? 'Mark as not reviewed' : 'Mark reviewed'}
                        className={`transition-colors ${
                          item.is_reviewed ? 'text-emerald-500 hover:text-emerald-700' : 'text-stone-300 hover:text-emerald-400'
                        }`}
                      >
                        <Check size={16} />
                      </button>
                    </td>
                  );
                })}
              </tr>
              );
            })}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={Math.max(columns.length, 1)} className="px-4 py-8 text-center text-sm text-stone-400">
                  No cases match the selected table filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editingItem && (
        <div
          role="dialog"
          aria-label="case-edit-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4"
          onClick={() => setEditingId(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[88vh] overflow-hidden rounded-2xl bg-white border border-stone-200 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <div>
                <h3 className="text-base font-semibold text-stone-900">Edit case {editingItem.vk_number}</h3>
                <p className="text-xs text-stone-500">WIMI: {editingItem.wimi_shortcut ?? '—'}</p>
              </div>
              <button onClick={() => setEditingId(null)} className="text-stone-400 hover:text-stone-700">
                <X size={18} />
              </button>
            </div>
            <div className="grid gap-0 md:grid-cols-2">
              <section className="p-5 border-b md:border-b-0 md:border-r border-stone-200 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-xs text-stone-600 sm:col-span-2">
                    Device
                    <input
                      value={editValues.device_name}
                      onChange={(e) => setEditValues((previous) => ({ ...previous, device_name: e.target.value }))}
                      className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm"
                    />
                  </label>
                  <label className="text-xs text-stone-600">
                    TRI-S
                    <select
                      value={editValues.tricia_s}
                      onChange={(e) => setEditValues((previous) => ({ ...previous, tricia_s: Number(e.target.value) }))}
                      className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm font-mono"
                    >
                      {S_OPTS.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-stone-600">
                    WIMI-S
                    <select
                      value={editValues.user_s}
                      onChange={(e) => setEditValues((previous) => ({ ...previous, user_s: Number(e.target.value) }))}
                      className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm font-mono"
                    >
                      {S_OPTS.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-stone-600">
                    TRI-D
                    <select
                      value={editValues.tricia_d}
                      onChange={(e) => setEditValues((previous) => ({ ...previous, tricia_d: Number(e.target.value) }))}
                      className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm font-mono"
                    >
                      {D_OPTS.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                  <label className="text-xs text-stone-600">
                    WIMI-D
                    <select
                      value={editValues.user_d}
                      onChange={(e) => setEditValues((previous) => ({ ...previous, user_d: Number(e.target.value) }))}
                      className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm font-mono"
                    >
                      {D_OPTS.map((value) => <option key={value} value={value}>{value}</option>)}
                    </select>
                  </label>
                </div>
                <div className="flex items-center justify-end gap-2 pt-2">
                  <button
                    onClick={() => setEditingId(null)}
                    className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => commitEdit(editingItem.id)}
                    disabled={isSavingEdit}
                    className="rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700 disabled:opacity-60"
                  >
                    {isSavingEdit ? 'Saving...' : 'Save changes'}
                  </button>
                </div>
              </section>
              <section className="p-5 max-h-[60vh] overflow-y-auto">
                <h4 className="text-sm font-semibold text-stone-800 mb-2">Audit trail</h4>
                {auditTrail.isLoading && <p className="text-xs text-stone-500">Loading audit trail...</p>}
                {!auditTrail.isLoading && auditEventsToShow.length === 0 && (
                  <p className="text-xs text-stone-500">No logged updates for this case yet.</p>
                )}
                <div className="space-y-2">
                  {auditEventsToShow.map((event) => (
                    <div key={event.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-stone-500">
                        {event.action} by {event.actor_id ?? 'unknown'} at {new Date(event.created_at).toLocaleString('de-DE')}
                      </p>
                      <ul className="mt-2 space-y-1">
                        {Object.entries(event.changes ?? {}).map(([field, delta]) => (
                          <li key={field} className="text-xs text-stone-700 font-mono">
                            {field}: {String(delta?.from ?? '—')} {'->'} {String(delta?.to ?? '—')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
