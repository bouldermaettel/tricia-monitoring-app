import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { Check, MessageSquare, MinusCircle, Pencil, Tag, Trash2, X } from 'lucide-react';
import { useCaseAuditTrail } from '../../hooks/useCases';
import { formatIsoDateToGerman } from '../../utils/date';
const CATEGORY_OPTIONS = [
    { value: '', label: '—' },
    { value: 'no_issue', label: 'Kein Problem' },
    { value: 'monitor', label: 'Beobachtung' },
    { value: 'problem', label: 'Problem' },
];
const COLUMN_LABELS = {
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
const COLUMN_DB_NAMES = {
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
function deviation(a, b) {
    if (a === undefined || b === undefined)
        return 0;
    return Math.abs(a - b);
}
function rowColor(item) {
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
export function CaseTable({ items, onMarkReviewed, onToggleExcluded, onSetCategory, onAddComment, onEditCase, onDeleteCase, onExportStateChange }) {
    const [commentInputs, setCommentInputs] = useState({});
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({ device_name: '', tricia_s: 1, tricia_d: 1, user_s: 1, user_d: 1 });
    const [isSavingEdit, setIsSavingEdit] = useState(false);
    const [changedCaseIds, setChangedCaseIds] = useState({});
    const [visibleColumns, setVisibleColumns] = useState({
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
    const [filters, setFilters] = useState({
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
    const emptyFilters = {
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
    function startEdit(item) {
        setEditingId(item.id);
        setEditValues({
            device_name: item.device_name ?? '',
            tricia_s: item.tricia_s ?? 1,
            tricia_d: item.tricia_d ?? 1,
            user_s: item.user_s ?? 1,
            user_d: item.user_d ?? 1,
        });
    }
    async function commitEdit(id) {
        if (!onEditCase)
            return;
        setIsSavingEdit(true);
        try {
            await Promise.resolve(onEditCase(id, editValues));
            setChangedCaseIds((previous) => ({ ...previous, [id]: true }));
            await auditTrail.refetch();
        }
        finally {
            setIsSavingEdit(false);
        }
    }
    function handleDelete(item) {
        if (window.confirm(`Delete case ${item.vk_number}? This cannot be undone.`)) {
            onDeleteCase?.(item.id);
        }
    }
    const columns = useMemo(() => Object.keys(COLUMN_LABELS).filter((columnId) => visibleColumns[columnId]), [visibleColumns]);
    const categoryOptions = useMemo(() => Array.from(new Set(items.map((item) => item.category_code).filter(Boolean))), [items]);
    const filteredItems = useMemo(() => {
        const normalized = Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, value.trim().toLowerCase()]));
        const matchesNumeric = (value, term) => term === '' || (value !== undefined && String(value) === term);
        return items.filter((item) => {
            const isEdited = Boolean(changedCaseIds[item.id] || item.has_edits);
            if (normalized.vk_number && !item.vk_number.toLowerCase().includes(normalized.vk_number))
                return false;
            if (normalized.wimi_shortcut && !(item.wimi_shortcut ?? '').toLowerCase().includes(normalized.wimi_shortcut))
                return false;
            if (normalized.date_reported) {
                const isoDate = item.date_reported ?? '';
                const deDate = formatIsoDateToGerman(item.date_reported).toLowerCase();
                if (!isoDate.toLowerCase().includes(normalized.date_reported) && !deDate.includes(normalized.date_reported)) {
                    return false;
                }
            }
            if (normalized.device_name && !(item.device_name ?? '').toLowerCase().includes(normalized.device_name))
                return false;
            if (!matchesNumeric(item.tricia_s, normalized.tricia_s))
                return false;
            if (!matchesNumeric(item.user_s, normalized.user_s))
                return false;
            if (!matchesNumeric(item.tricia_d, normalized.tricia_d))
                return false;
            if (!matchesNumeric(item.user_d, normalized.user_d))
                return false;
            if (normalized.category_code && (item.category_code ?? '').toLowerCase() !== normalized.category_code)
                return false;
            if (normalized.comment && !(commentInputs[item.id] ?? '').toLowerCase().includes(normalized.comment))
                return false;
            if (normalized.is_excluded) {
                const expected = normalized.is_excluded === 'yes';
                if (Boolean(item.is_excluded) !== expected)
                    return false;
            }
            if (normalized.is_reviewed) {
                const expected = normalized.is_reviewed === 'yes';
                if (Boolean(item.is_reviewed) !== expected)
                    return false;
            }
            if (normalized.actions) {
                if (normalized.actions === 'edited' && !isEdited)
                    return false;
                if (normalized.actions === 'not_edited' && isEdited)
                    return false;
            }
            return true;
        });
    }, [changedCaseIds, commentInputs, filters, items]);
    useEffect(() => {
        if (!onExportStateChange)
            return;
        const exportColumns = columns.map((columnId) => COLUMN_DB_NAMES[columnId]);
        const exportRows = filteredItems.map((item) => {
            const row = {};
            columns.forEach((columnId) => {
                if (columnId === 'comment') {
                    row[COLUMN_DB_NAMES[columnId]] = commentInputs[item.id] ?? '';
                    return;
                }
                if (columnId === 'actions') {
                    row[COLUMN_DB_NAMES[columnId]] = Boolean(changedCaseIds[item.id] || item.has_edits);
                    return;
                }
                row[COLUMN_DB_NAMES[columnId]] = item[columnId] ?? '';
            });
            return row;
        });
        onExportStateChange({ columns: exportColumns, rows: exportRows });
    }, [changedCaseIds, columns, commentInputs, filteredItems, onExportStateChange]);
    const editingItem = useMemo(() => items.find((item) => item.id === editingId) ?? null, [editingId, items]);
    const auditTrail = useCaseAuditTrail(editingId ?? undefined, 100);
    const wimiAuditEvents = useMemo(() => {
        const events = (auditTrail.data?.items ?? []);
        const shortcut = editingItem?.wimi_shortcut?.trim().toLowerCase();
        if (!shortcut)
            return events;
        return events.filter((event) => {
            const actor = (event.actor_id ?? '').trim().toLowerCase();
            return actor === shortcut || actor.includes(shortcut);
        });
    }, [auditTrail.data?.items, editingItem?.wimi_shortcut]);
    const auditEventsToShow = wimiAuditEvents.length > 0 ? wimiAuditEvents : (auditTrail.data?.items ?? []);
    const S_OPTS = [1, 3, 5, 8, 10];
    const D_OPTS = [1, 5, 10];
    if (items.length === 0) {
        return (_jsx("div", { className: "rounded-xl border border-stone-200 bg-white p-8 text-center text-stone-400 text-sm", children: "No cases for the selected filters." }));
    }
    return (_jsxs("div", { className: "rounded-xl border border-stone-200 bg-white overflow-hidden", children: [_jsxs("div", { className: "px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between gap-3", children: [_jsxs("span", { className: "text-xs text-stone-500", children: ["Showing ", filteredItems.length, " of ", items.length, " cases"] }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("button", { onClick: () => setFilters(emptyFilters), className: "px-3 py-1.5 rounded text-sm font-medium bg-white border border-stone-200 hover:bg-stone-100", children: "Reset filters" }), _jsxs("details", { className: "relative", children: [_jsx("summary", { className: "list-none cursor-pointer px-3 py-1.5 rounded text-sm font-medium bg-white border border-stone-200 hover:bg-stone-100", children: "Columns" }), _jsx("div", { className: "absolute right-0 z-10 mt-1 w-60 rounded-lg border border-stone-200 bg-white shadow-lg p-3 flex flex-col gap-2", children: Object.keys(COLUMN_LABELS).map((columnId) => (_jsxs("label", { className: "flex items-center gap-2 text-sm text-stone-700", children: [_jsx("input", { type: "checkbox", checked: visibleColumns[columnId], onChange: (e) => setVisibleColumns((previous) => ({
                                                        ...previous,
                                                        [columnId]: e.target.checked,
                                                    })) }), _jsx("span", { children: COLUMN_LABELS[columnId] })] }, columnId))) })] })] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsxs("thead", { children: [_jsx("tr", { className: "border-b border-stone-200 bg-stone-50", children: columns.map((columnId) => (_jsx("th", { className: `px-3 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide ${columnId === 'tricia_s' ||
                                            columnId === 'user_s' ||
                                            columnId === 'tricia_d' ||
                                            columnId === 'user_d' ||
                                            columnId === 'is_excluded' ||
                                            columnId === 'is_reviewed'
                                            ? 'text-center'
                                            : 'text-left'}`, children: COLUMN_LABELS[columnId] }, columnId))) }), _jsx("tr", { className: "border-b border-stone-200 bg-white", children: columns.map((columnId) => (_jsx("th", { className: "px-3 py-2", children: columnId === 'category_code' ? (_jsxs("select", { value: filters.category_code, onChange: (e) => setFilters((previous) => ({ ...previous, category_code: e.target.value })), className: "w-full text-xs border border-stone-200 rounded px-2 py-1 bg-white", children: [_jsx("option", { value: "", children: "All" }), categoryOptions.map((value) => (_jsx("option", { value: value, children: value }, value)))] })) : columnId === 'is_excluded' || columnId === 'is_reviewed' ? (_jsxs("select", { value: filters[columnId], onChange: (e) => setFilters((previous) => ({ ...previous, [columnId]: e.target.value })), className: "w-full text-xs border border-stone-200 rounded px-2 py-1 bg-white", children: [_jsx("option", { value: "", children: "All" }), _jsx("option", { value: "yes", children: "Yes" }), _jsx("option", { value: "no", children: "No" })] })) : columnId === 'actions' ? (_jsxs("select", { value: filters.actions, onChange: (e) => setFilters((previous) => ({ ...previous, actions: e.target.value })), className: "w-full text-xs border border-stone-200 rounded px-2 py-1 bg-white", children: [_jsx("option", { value: "", children: "All" }), _jsx("option", { value: "edited", children: "Edited" }), _jsx("option", { value: "not_edited", children: "Not edited" })] })) : (_jsx("input", { value: filters[columnId], onChange: (e) => setFilters((previous) => ({ ...previous, [columnId]: e.target.value })), placeholder: "Filter...", className: "w-full text-xs border border-stone-200 rounded px-2 py-1" })) }, columnId))) })] }), _jsxs("tbody", { children: [filteredItems.map((item) => {
                                    return (_jsx("tr", { className: `border-b border-stone-100 last:border-0 ${rowColor(item)}`, children: columns.map((columnId) => {
                                            if (columnId === 'vk_number') {
                                                return _jsx("td", { className: "px-4 py-2.5 font-mono text-xs text-stone-700", children: item.vk_number }, columnId);
                                            }
                                            if (columnId === 'wimi_shortcut') {
                                                return _jsx("td", { className: "px-4 py-2.5 font-mono text-xs text-stone-700", children: item.wimi_shortcut ?? '—' }, columnId);
                                            }
                                            if (columnId === 'date_reported') {
                                                return _jsx("td", { className: "px-4 py-2.5 font-mono text-xs text-stone-600", children: formatIsoDateToGerman(item.date_reported) }, columnId);
                                            }
                                            if (columnId === 'device_name') {
                                                return _jsx("td", { className: "px-4 py-2.5 text-stone-700", children: item.device_name ?? '—' }, columnId);
                                            }
                                            if (columnId === 'tricia_s') {
                                                return _jsx("td", { className: "px-3 py-2.5 text-center font-mono", children: item.tricia_s ?? '—' }, columnId);
                                            }
                                            if (columnId === 'user_s') {
                                                return _jsx("td", { className: "px-3 py-2.5 text-center font-mono font-semibold", children: item.user_s ?? '—' }, columnId);
                                            }
                                            if (columnId === 'tricia_d') {
                                                return _jsx("td", { className: "px-3 py-2.5 text-center font-mono", children: item.tricia_d ?? '—' }, columnId);
                                            }
                                            if (columnId === 'user_d') {
                                                return _jsx("td", { className: "px-3 py-2.5 text-center font-mono font-semibold", children: item.user_d ?? '—' }, columnId);
                                            }
                                            if (columnId === 'category_code') {
                                                return (_jsx("td", { className: "px-3 py-2.5", children: onSetCategory ? (_jsx("select", { value: item.category_code ?? '', onChange: (e) => onSetCategory(item.id, e.target.value), className: "text-xs border border-stone-200 rounded px-1.5 py-1 bg-white outline-none focus:border-amber-400 cursor-pointer", children: CATEGORY_OPTIONS.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) })) : (_jsxs("span", { className: "flex items-center gap-1 text-xs text-stone-500", children: [_jsx(Tag, { size: 12 }), item.category_code ?? '—'] })) }, columnId));
                                            }
                                            if (columnId === 'comment') {
                                                return (_jsx("td", { className: "px-3 py-2.5", children: onAddComment ? (_jsxs("div", { className: "flex gap-1", children: [_jsx("input", { value: commentInputs[item.id] ?? '', onChange: (e) => setCommentInputs((p) => ({ ...p, [item.id]: e.target.value })), onKeyDown: (e) => {
                                                                    if (e.key === 'Enter' && commentInputs[item.id]?.trim()) {
                                                                        onAddComment(item.id, commentInputs[item.id]);
                                                                        setCommentInputs((p) => ({ ...p, [item.id]: '' }));
                                                                    }
                                                                }, placeholder: "Add\u2026", className: "text-xs border border-stone-200 rounded px-2 py-1 w-28 outline-none focus:border-amber-400" }), _jsx("button", { onClick: () => {
                                                                    if (commentInputs[item.id]?.trim()) {
                                                                        onAddComment(item.id, commentInputs[item.id]);
                                                                        setCommentInputs((p) => ({ ...p, [item.id]: '' }));
                                                                    }
                                                                }, className: "text-stone-400 hover:text-stone-700", title: "Submit comment", children: _jsx(MessageSquare, { size: 13 }) })] })) : (_jsx("span", { className: "text-xs text-stone-400", children: "\u2014" })) }, columnId));
                                            }
                                            if (columnId === 'is_excluded') {
                                                return (_jsx("td", { className: "px-3 py-2.5 text-center", children: _jsx("button", { onClick: () => onToggleExcluded?.(item.id, item.is_excluded ?? false), title: "Toggle Streichresultat", className: `transition-colors ${item.is_excluded ? 'text-red-500 hover:text-red-700' : 'text-stone-300 hover:text-stone-500'}`, children: _jsx(MinusCircle, { size: 16 }) }) }, columnId));
                                            }
                                            if (columnId === 'actions') {
                                                return (_jsx("td", { className: "px-3 py-2.5 text-center", children: _jsxs("div", { className: "flex items-center gap-1 justify-center", children: [onEditCase && (_jsx("button", { onClick: () => startEdit(item), title: "Edit", className: `transition-colors ${(changedCaseIds[item.id] || item.has_edits) ? 'text-red-500 hover:text-red-700' : 'text-stone-400 hover:text-amber-600'}`, children: _jsx(Pencil, { size: 14 }) })), onDeleteCase && (_jsx("button", { onClick: () => handleDelete(item), title: "Delete", className: "text-stone-300 hover:text-red-500 transition-colors", children: _jsx(Trash2, { size: 14 }) }))] }) }, columnId));
                                            }
                                            // default: is_reviewed
                                            return (_jsx("td", { className: "px-3 py-2.5 text-center", children: _jsx("button", { onClick: () => onMarkReviewed?.(item.id, item.is_reviewed ?? false), title: item.is_reviewed ? 'Mark as not reviewed' : 'Mark reviewed', className: `transition-colors ${item.is_reviewed ? 'text-emerald-500 hover:text-emerald-700' : 'text-stone-300 hover:text-emerald-400'}`, children: _jsx(Check, { size: 16 }) }) }, columnId));
                                        }) }, item.id));
                                }), filteredItems.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: Math.max(columns.length, 1), className: "px-4 py-8 text-center text-sm text-stone-400", children: "No cases match the selected table filters." }) }))] })] }) }), editingItem && (_jsx("div", { role: "dialog", "aria-label": "case-edit-dialog", className: "fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50 p-4", onClick: () => setEditingId(null), children: _jsxs("div", { className: "w-full max-w-5xl max-h-[88vh] overflow-hidden rounded-2xl bg-white border border-stone-200 shadow-2xl", onClick: (e) => e.stopPropagation(), children: [_jsxs("div", { className: "flex items-center justify-between border-b border-stone-200 px-5 py-4", children: [_jsxs("div", { children: [_jsxs("h3", { className: "text-base font-semibold text-stone-900", children: ["Edit case ", editingItem.vk_number] }), _jsxs("p", { className: "text-xs text-stone-500", children: ["WIMI: ", editingItem.wimi_shortcut ?? '—'] })] }), _jsx("button", { onClick: () => setEditingId(null), className: "text-stone-400 hover:text-stone-700", children: _jsx(X, { size: 18 }) })] }), _jsxs("div", { className: "grid gap-0 md:grid-cols-2", children: [_jsxs("section", { className: "p-5 border-b md:border-b-0 md:border-r border-stone-200 space-y-4", children: [_jsxs("div", { className: "grid gap-3 sm:grid-cols-2", children: [_jsxs("label", { className: "text-xs text-stone-600 sm:col-span-2", children: ["Device", _jsx("input", { value: editValues.device_name, onChange: (e) => setEditValues((previous) => ({ ...previous, device_name: e.target.value })), className: "mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm" })] }), _jsxs("label", { className: "text-xs text-stone-600", children: ["TRI-S", _jsx("select", { value: editValues.tricia_s, onChange: (e) => setEditValues((previous) => ({ ...previous, tricia_s: Number(e.target.value) })), className: "mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm font-mono", children: S_OPTS.map((value) => _jsx("option", { value: value, children: value }, value)) })] }), _jsxs("label", { className: "text-xs text-stone-600", children: ["WIMI-S", _jsx("select", { value: editValues.user_s, onChange: (e) => setEditValues((previous) => ({ ...previous, user_s: Number(e.target.value) })), className: "mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm font-mono", children: S_OPTS.map((value) => _jsx("option", { value: value, children: value }, value)) })] }), _jsxs("label", { className: "text-xs text-stone-600", children: ["TRI-D", _jsx("select", { value: editValues.tricia_d, onChange: (e) => setEditValues((previous) => ({ ...previous, tricia_d: Number(e.target.value) })), className: "mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm font-mono", children: D_OPTS.map((value) => _jsx("option", { value: value, children: value }, value)) })] }), _jsxs("label", { className: "text-xs text-stone-600", children: ["WIMI-D", _jsx("select", { value: editValues.user_d, onChange: (e) => setEditValues((previous) => ({ ...previous, user_d: Number(e.target.value) })), className: "mt-1 w-full rounded border border-stone-300 px-2 py-1.5 text-sm font-mono", children: D_OPTS.map((value) => _jsx("option", { value: value, children: value }, value)) })] })] }), _jsxs("div", { className: "flex items-center justify-end gap-2 pt-2", children: [_jsx("button", { onClick: () => setEditingId(null), className: "rounded-lg border border-stone-300 px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100", children: "Cancel" }), _jsx("button", { onClick: () => commitEdit(editingItem.id), disabled: isSavingEdit, className: "rounded-lg bg-stone-900 px-3 py-1.5 text-sm text-white hover:bg-stone-700 disabled:opacity-60", children: isSavingEdit ? 'Saving...' : 'Save changes' })] })] }), _jsxs("section", { className: "p-5 max-h-[60vh] overflow-y-auto", children: [_jsx("h4", { className: "text-sm font-semibold text-stone-800 mb-2", children: "Audit trail" }), auditTrail.isLoading && _jsx("p", { className: "text-xs text-stone-500", children: "Loading audit trail..." }), !auditTrail.isLoading && auditEventsToShow.length === 0 && (_jsx("p", { className: "text-xs text-stone-500", children: "No logged updates for this case yet." })), _jsx("div", { className: "space-y-2", children: auditEventsToShow.map((event) => (_jsxs("div", { className: "rounded-lg border border-stone-200 bg-stone-50 p-3", children: [_jsxs("p", { className: "text-[11px] uppercase tracking-wide text-stone-500", children: [event.action, " by ", event.actor_id ?? 'unknown', " at ", new Date(event.created_at).toLocaleString('de-DE')] }), _jsx("ul", { className: "mt-2 space-y-1", children: Object.entries(event.changes ?? {}).map(([field, delta]) => (_jsxs("li", { className: "text-xs text-stone-700 font-mono", children: [field, ": ", String(delta?.from ?? '—'), " ", '->', " ", String(delta?.to ?? '—')] }, field))) })] }, event.id))) })] })] })] }) }))] }));
}
