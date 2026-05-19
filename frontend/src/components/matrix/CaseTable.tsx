import { useEffect, useMemo, useState } from 'react';
import { Check, MessageSquare, MinusCircle, Pencil, Tag, X } from 'lucide-react';
import { useCaseAuditTrail } from '../../hooks/useCases';
import { formatIsoDateToGerman } from '../../utils/date';
import { downloadCaseAuditTrailXlsx } from '../../services/cases';

type CaseItem = {
  id: string;
  vk_number: string;
  wimi_shortcut?: string;
  date_reported?: string;
  device_name?: string;
  tricia_s?: number;
  tricia_p?: number;
  user_s?: number;
  tricia_d?: number;
  user_d?: number;
  category_code?: string;
  risk_level?: string;
  is_excluded?: boolean;
  is_reviewed?: boolean;
  comment_text?: string;
  has_edits?: boolean;
};

type ColumnId =
  | 'vk_number'
  | 'wimi_shortcut'
  | 'date_reported'
  | 'device_name'
  | 'tricia_p'
  | 'tricia_s'
  | 'user_s'
  | 'tricia_d'
  | 'user_d'
  | 'category_code'
  | 'comment'
  | 'is_excluded'
  | 'is_reviewed'
  | 'actions';

type SortDirection = 'asc' | 'desc';

type EditValues = {
  device_name: string;
  tricia_s: number;
  tricia_p: number;
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

type RiskCategory = {
  label: string;
  min_value: number;
  max_value: number;
};

type Props = {
  items: CaseItem[];
  riskCategories?: RiskCategory[];
  acceptanceThreshold?: number;
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
  tricia_p: 'TRI-P',
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
  tricia_p: 'tricia_p',
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

const AUDIT_FIELD_LABELS: Record<string, string> = {
  tricia_s: 'TRI-S',
  tricia_p: 'TRI-P',
  tricia_d: 'TRI-D',
  user_s: 'WIMI-S',
  user_d: 'WIMI-D',
  category_code: 'Category',
  is_excluded: 'Excluded',
  is_reviewed: 'Reviewed',
  risk_level: 'Risk Level',
  device_name: 'Device Name',
  analysis_date: 'Analysis Date',
  validation_status: 'Validation Status',
  comment_text: 'Comment',
  vk_number: 'VK Number',
};

function deviation(a?: number, b?: number) {
  if (a === undefined || b === undefined) return 0;
  return Math.abs(a - b);
}

function resolveRiskCategoryIndex(value: number, categories: RiskCategory[]): number | null {
  const categoryIndex = categories.findIndex((category) => value >= category.min_value && value <= category.max_value);
  return categoryIndex >= 0 ? categoryIndex + 1 : null;
}

function rowColor(item: CaseItem, categories: RiskCategory[], acceptanceThreshold: number) {
  if (
    item.tricia_s === undefined ||
    item.tricia_d === undefined ||
    item.tricia_p === undefined ||
    item.user_s === undefined ||
    item.user_d === undefined
  ) {
    return 'bg-stone-50';
  }

  const expectedClass = resolveRiskCategoryIndex(item.user_s * item.user_d * item.tricia_p, categories);
  const observedClass = resolveRiskCategoryIndex(item.tricia_s * item.tricia_d * item.tricia_p, categories);
  if (expectedClass === null || observedClass === null) {
    return 'bg-stone-50';
  }

  if (expectedClass === observedClass) {
    return 'bg-emerald-50';
  }

  if (Math.abs(expectedClass - observedClass) <= acceptanceThreshold) {
    return 'bg-lime-50';
  }

  if (expectedClass > observedClass) {
    return 'bg-red-50';
  }

  return 'bg-yellow-50';
}

function getCommentCellValue(item: CaseItem, draft: string | undefined) {
  const next = draft?.trim();
  if (next) return next;
  return item.comment_text ?? '';
}

function formatAuditCell(events: AuditEvent[]): string {
  if (!events.length) return '';

  const lines: string[] = [];
  const ordered = [...events].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  ordered.forEach((event) => {
    const timestamp = new Date(event.created_at).toLocaleString('de-DE');
    const changes = event.changes ?? {};
    const entries = Object.entries(changes);

    if (entries.length === 0) {
      lines.push(`${timestamp} | ${event.action}`);
      return;
    }

    entries.forEach(([field, delta]) => {
      const label = AUDIT_FIELD_LABELS[field] ?? field;
      const fromValue = delta?.from ?? '—';
      const toValue = delta?.to ?? '—';
      lines.push(`${timestamp} | ${label}: ${String(fromValue)} -> ${String(toValue)}`);
    });
  });

  return lines.join('\n');
}

export function CaseTable({
  items,
  riskCategories = [],
  acceptanceThreshold = 1,
  onMarkReviewed,
  onToggleExcluded,
  onSetCategory,
  onAddComment,
  onEditCase,
  onDeleteCase,
  onExportStateChange,
}: Props) {
  const [commentInputs, setCommentInputs] = useState<Record<string, string>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({ device_name: '', tricia_s: 1, tricia_p: 1, tricia_d: 1, user_s: 1, user_d: 1 });
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [changedCaseIds, setChangedCaseIds] = useState<Record<string, boolean>>({});
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnId, boolean>>({
    vk_number: true,
    wimi_shortcut: true,
    date_reported: true,
    device_name: true,
    tricia_p: true,
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
    tricia_p: '',
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
  const [dateFilterFrom, setDateFilterFrom] = useState('');
  const [dateFilterTo, setDateFilterTo] = useState('');
  const [showDateColumnPicker, setShowDateColumnPicker] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
  const [bulkDeleteModalOpen, setBulkDeleteModalOpen] = useState(false);
  const [bulkDeleteIds, setBulkDeleteIds] = useState<string[]>([]);
  const [isDeletingSelected, setIsDeletingSelected] = useState(false);
  const [sortBy, setSortBy] = useState<{ column: ColumnId; direction: SortDirection } | null>(null);
  const emptyFilters: Record<ColumnId, string> = {
    vk_number: '',
    wimi_shortcut: '',
    date_reported: '',
    device_name: '',
    tricia_p: '',
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
    setEditError(null);
    setEditValues({
      device_name: item.device_name ?? '',
      tricia_s: item.tricia_s ?? 1,
      tricia_p: item.tricia_p ?? 1,
      tricia_d: item.tricia_d ?? 1,
      user_s: item.user_s ?? 1,
      user_d: item.user_d ?? 1,
    });
  }

  async function commitEdit(id: string) {
    if (!onEditCase) return;
    setIsSavingEdit(true);
    setEditError(null);
    try {
      await Promise.resolve(onEditCase(id, editValues));
      setChangedCaseIds((previous) => ({ ...previous, [id]: true }));
      await auditTrail.refetch();
    } catch (error) {
      let message = 'Failed to save changes. Please try again.';
      if (typeof error === 'object' && error !== null) {
        const maybeResponse = (error as { response?: { data?: { detail?: unknown } } }).response;
        const detail = maybeResponse?.data?.detail;
        if (typeof detail === 'string' && detail.trim()) {
          message = detail;
        } else if (Array.isArray(detail) && detail.length > 0) {
          const first = detail[0] as { msg?: string };
          if (typeof first?.msg === 'string' && first.msg.trim()) {
            message = first.msg;
          }
        }
      }
      setEditError(message);
    } finally {
      setIsSavingEdit(false);
    }
  }

  function toggleCaseSelection(itemId: string, itemIndex: number, shiftKey: boolean) {
    setSelectedCaseIds((previous) => {
      const next = new Set(previous);
      const isAlreadySelected = next.has(itemId);
      if (!shiftKey || lastSelectedIndex === null) {
        if (isAlreadySelected) {
          next.delete(itemId);
        } else {
          next.add(itemId);
        }
        return next;
      }

      const start = Math.min(lastSelectedIndex, itemIndex);
      const end = Math.max(lastSelectedIndex, itemIndex);
      const rangeIds = sortedItems.slice(start, end + 1).map((item) => item.id);
      if (isAlreadySelected) {
        rangeIds.forEach((id) => next.delete(id));
      } else {
        rangeIds.forEach((id) => next.add(id));
      }
      return next;
    });
    setLastSelectedIndex(itemIndex);
  }

  function selectAllVisible() {
    setSelectedCaseIds((previous) => {
      const next = new Set(previous);
      sortedItems.forEach((item) => next.add(item.id));
      return next;
    });
    setLastSelectedIndex(sortedItems.length > 0 ? 0 : null);
  }

  function deselectAll() {
    setSelectedCaseIds(new Set());
    setLastSelectedIndex(null);
  }

  function deleteSelected() {
    if (!onDeleteCase) return;
    const selectedVisibleIds = sortedItems.filter((item) => selectedCaseIds.has(item.id)).map((item) => item.id);
    if (selectedVisibleIds.length === 0) return;
    setBulkDeleteIds(selectedVisibleIds);
    setBulkDeleteModalOpen(true);
  }

  async function confirmBulkDelete() {
    if (!onDeleteCase || bulkDeleteIds.length === 0) return;
    setIsDeletingSelected(true);
    try {
      await Promise.all(bulkDeleteIds.map((id) => Promise.resolve(onDeleteCase(id))));
      setSelectedCaseIds(new Set());
      setLastSelectedIndex(null);
      setBulkDeleteModalOpen(false);
      setBulkDeleteIds([]);
    } finally {
      setIsDeletingSelected(false);
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
      if (dateFilterFrom && (item.date_reported ?? '') < dateFilterFrom) return false;
      if (dateFilterTo && (item.date_reported ?? '') > dateFilterTo) return false;
      if (normalized.device_name && !(item.device_name ?? '').toLowerCase().includes(normalized.device_name)) return false;
      if (!matchesNumeric(item.tricia_s, normalized.tricia_s)) return false;
      if (!matchesNumeric(item.tricia_p, normalized.tricia_p)) return false;
      if (!matchesNumeric(item.user_s, normalized.user_s)) return false;
      if (!matchesNumeric(item.tricia_d, normalized.tricia_d)) return false;
      if (!matchesNumeric(item.user_d, normalized.user_d)) return false;
      if (normalized.category_code && (item.category_code ?? '').toLowerCase() !== normalized.category_code) return false;
      if (normalized.comment && !getCommentCellValue(item, commentInputs[item.id]).toLowerCase().includes(normalized.comment)) return false;
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
  }, [changedCaseIds, commentInputs, dateFilterFrom, dateFilterTo, filters, items]);

  const itemOrderById = useMemo(() => new Map(items.map((item, index) => [item.id, index])), [items]);

  const sortedItems = useMemo(() => {
    if (!sortBy) return filteredItems;

    const directionFactor = sortBy.direction === 'asc' ? 1 : -1;

    const getSortValue = (item: CaseItem): number | string => {
      switch (sortBy.column) {
        case 'vk_number':
          return item.vk_number.toLowerCase();
        case 'wimi_shortcut':
          return (item.wimi_shortcut ?? '').toLowerCase();
        case 'date_reported':
          return item.date_reported ? new Date(item.date_reported).getTime() : -Infinity;
        case 'device_name':
          return (item.device_name ?? '').toLowerCase();
        case 'tricia_p':
          return item.tricia_p ?? -Infinity;
        case 'tricia_s':
          return item.tricia_s ?? -Infinity;
        case 'user_s':
          return item.user_s ?? -Infinity;
        case 'tricia_d':
          return item.tricia_d ?? -Infinity;
        case 'user_d':
          return item.user_d ?? -Infinity;
        case 'category_code':
          return (item.category_code ?? '').toLowerCase();
        case 'comment':
          return getCommentCellValue(item, commentInputs[item.id]).toLowerCase();
        case 'is_excluded':
          return item.is_excluded ? 1 : 0;
        case 'is_reviewed':
          return item.is_reviewed ? 1 : 0;
        case 'actions':
          return changedCaseIds[item.id] || item.has_edits ? 1 : 0;
        default:
          return '';
      }
    };

    return [...filteredItems].sort((left, right) => {
      const leftValue = getSortValue(left);
      const rightValue = getSortValue(right);

      if (leftValue < rightValue) return -1 * directionFactor;
      if (leftValue > rightValue) return 1 * directionFactor;

      return (itemOrderById.get(left.id) ?? 0) - (itemOrderById.get(right.id) ?? 0);
    });
  }, [changedCaseIds, commentInputs, filteredItems, itemOrderById, sortBy]);

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
    const visibleSet = new Set(sortedItems.map((item) => item.id));
    setSelectedCaseIds((previous) => {
      const next = new Set(Array.from(previous).filter((id) => visibleSet.has(id)));
      if (next.size === previous.size) return previous;
      return next;
    });
  }, [sortedItems]);

  useEffect(() => {
    if (!onExportStateChange) return;

    const exportColumns = columns.map((columnId) => COLUMN_DB_NAMES[columnId]);

    const exportRows = sortedItems.map((item) => {
      const row: Record<string, unknown> = {};
      columns.forEach((columnId) => {
        if (columnId === 'comment') {
          row[COLUMN_DB_NAMES[columnId]] = getCommentCellValue(item, commentInputs[item.id]);
          return;
        }
        if (columnId === 'actions') {
          row[COLUMN_DB_NAMES[columnId]] = Boolean(changedCaseIds[item.id] || item.has_edits);
          return;
        }
        row[COLUMN_DB_NAMES[columnId]] = item[columnId as keyof CaseItem] ?? '';
      });
      // hidden field used by lazy audit enrichment on export click
      row._case_id = item.id;
      return row;
    });

    onExportStateChange({ columns: exportColumns, rows: exportRows });
  }, [changedCaseIds, columns, commentInputs, onExportStateChange, sortedItems]);

  const editingItem = useMemo(
    () => items.find((item) => item.id === editingId) ?? null,
    [editingId, items]
  );
  const auditTrail = useCaseAuditTrail(editingId ?? undefined, 100);
  const auditEventsToShow = (auditTrail.data?.items ?? []) as AuditEvent[];

  function displayActor(event: AuditEvent): string {
    const raw = (event.actor_id ?? '').trim();
    if (raw && raw.toLowerCase() !== 'system') return raw;
    const fallback = editingItem?.wimi_shortcut?.trim();
    return fallback || raw || 'unknown';
  }

  const S_OPTS = [1, 3, 5, 8, 10];
  const D_OPTS = [1, 5, 10];
  const selectedVisibleCount = sortedItems.filter((item) => selectedCaseIds.has(item.id)).length;
  const allVisibleSelected = sortedItems.length > 0 && selectedVisibleCount === sortedItems.length;

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
          {onDeleteCase && (
            <>
            </>
          )}
          <button
            onClick={() => {
              setFilters(emptyFilters);
              setDateFilterFrom('');
              setDateFilterTo('');
              setShowDateColumnPicker(false);
            }}
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
              {onDeleteCase && (
                <th className="px-3 py-2 text-left align-top">
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={deleteSelected}
                      disabled={selectedVisibleCount === 0}
                      className="px-2 py-1 rounded text-xs font-medium bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 w-fit whitespace-normal max-w-[70px]"
                    >
                      Delete<br />selected ({selectedVisibleCount})
                    </button>
                  </div>
                </th>
              )}
              {columns.map((columnId) => (
                <th
                  key={columnId}
                  className={`px-3 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide ${
                    columnId === 'tricia_s' ||
                    columnId === 'tricia_p' ||
                    columnId === 'user_s' ||
                    columnId === 'tricia_d' ||
                    columnId === 'user_d' ||
                    columnId === 'is_excluded' ||
                    columnId === 'is_reviewed'
                      ? 'text-center'
                      : 'text-left'
                  }`}
                >
                  <div className="inline-flex items-center gap-1">
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
                        onClick={() => setShowDateColumnPicker((previous) => !previous)}
                        className="rounded px-1 py-0.5 text-[10px] text-stone-400 hover:bg-stone-200"
                        title="Toggle date range picker"
                      >
                        {showDateColumnPicker ? '▲' : '▼'}
                      </button>
                    )}
                  </div>
                </th>
              ))}
            </tr>
            <tr className="border-b border-stone-200 bg-white">
              {onDeleteCase && (
                <th className="px-3 py-2 text-center">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={(e) => (e.target.checked ? selectAllVisible() : deselectAll())}
                    aria-label="select-all-visible-cases"
                  />
                </th>
              )}
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
                  ) : columnId === 'date_reported' ? (
                    <div className="space-y-1">
                      {showDateColumnPicker ? (
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
                          onClick={() => setShowDateColumnPicker(true)}
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
            {sortedItems.map((item, itemIndex) => {
              return (
              <tr key={item.id} className={`border-b border-stone-100 last:border-0 ${rowColor(item, riskCategories, acceptanceThreshold)}`}>
                {onDeleteCase && (
                  <td className="px-3 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={selectedCaseIds.has(item.id)}
                      onChange={(e) => toggleCaseSelection(item.id, itemIndex, (e.nativeEvent as MouseEvent).shiftKey)}
                      aria-label={`select-case-${item.id}`}
                    />
                  </td>
                )}
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
                  if (columnId === 'tricia_p') {
                    return <td key={columnId} className="px-3 py-2.5 text-center font-mono">{item.tricia_p ?? '—'}</td>;
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
                    const draftValue = commentInputs[item.id] ?? '';
                    const savedValue = item.comment_text ?? '';
                    return (
                      <td key={columnId} className="px-3 py-2.5">
                        {onAddComment ? (
                          <div className="space-y-1.5">
                            <div className="text-[11px] text-stone-600 truncate max-w-[15rem]" title={savedValue || 'No saved comment'}>
                              {savedValue || 'No saved comment'}
                            </div>
                            <div className="flex gap-1">
                              <input
                                value={draftValue}
                                onChange={(e) => setCommentInputs((p) => ({ ...p, [item.id]: e.target.value }))}
                                onKeyDown={(e) => {
                                  const text = draftValue.trim();
                                  if (e.key === 'Enter' && text) {
                                    onAddComment(item.id, text);
                                    setCommentInputs((p) => ({ ...p, [item.id]: '' }));
                                  }
                                }}
                                placeholder="Add…"
                                className="text-xs border border-stone-200 rounded px-2 py-1 w-28 outline-none focus:border-amber-400"
                              />
                              <button
                                onClick={() => {
                                  const text = draftValue.trim();
                                  if (text) {
                                    onAddComment(item.id, text);
                                    setCommentInputs((p) => ({ ...p, [item.id]: '' }));
                                  }
                                }}
                                className="text-stone-400 hover:text-stone-700"
                                title="Submit comment"
                              >
                                <MessageSquare size={13} />
                              </button>
                            </div>
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
            {sortedItems.length === 0 && (
              <tr>
                <td colSpan={Math.max(columns.length + (onDeleteCase ? 1 : 0), 1)} className="px-4 py-8 text-center text-sm text-stone-400">
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
                    TRI-P
                    <select
                      value={editValues.tricia_p}
                      onChange={(e) => setEditValues((previous) => ({ ...previous, tricia_p: Number(e.target.value) }))}
                      className="mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm font-mono"
                    >
                      {D_OPTS.map((value) => <option key={value} value={value}>{value}</option>)}
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
                  {editError && (
                    <p className="mr-auto text-xs text-red-600">{editError}</p>
                  )}
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
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-stone-800">Audit trail</h4>
                  {auditEventsToShow.length > 0 && (
                    <button
                      onClick={() => downloadCaseAuditTrailXlsx(editingItem.id, editingItem.vk_number)}
                      className="rounded border border-stone-300 px-2 py-1 text-xs text-stone-600 hover:bg-stone-100"
                    >
                      Export Excel
                    </button>
                  )}
                </div>
                {auditTrail.isLoading && <p className="text-xs text-stone-500">Loading audit trail...</p>}
                {!auditTrail.isLoading && auditEventsToShow.length === 0 && (
                  <p className="text-xs text-stone-500">No logged updates for this case yet.</p>
                )}
                <div className="space-y-2">
                  {auditEventsToShow.map((event) => (
                    <div key={event.id} className="rounded-lg border border-stone-200 bg-stone-50 p-3">
                      <p className="text-[11px] uppercase tracking-wide text-stone-500">
                        {event.action} by {displayActor(event)} at {new Date(event.created_at).toLocaleString('de-DE')}
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
      {bulkDeleteModalOpen && (
        <div
          role="dialog"
          aria-label="bulk-delete-dialog"
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4"
          onClick={() => !isDeletingSelected && setBulkDeleteModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-semibold text-stone-900">Delete selected records?</h3>
            <p className="mt-2 text-sm text-stone-600">
              You are about to delete {bulkDeleteIds.length} selected case{bulkDeleteIds.length === 1 ? '' : 's'}. This cannot be undone.
            </p>
            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setBulkDeleteModalOpen(false)}
                disabled={isDeletingSelected}
                className="rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmBulkDelete}
                disabled={isDeletingSelected}
                className="rounded-lg bg-red-600 px-3 py-1.5 text-sm text-white hover:bg-red-500 disabled:opacity-60"
              >
                {isDeletingSelected ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
