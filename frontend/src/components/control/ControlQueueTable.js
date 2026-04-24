import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useState } from 'react';
import { formatIsoDateToGerman } from '../../utils/date';
const DELAY_COLORS = {
    on_time: 'bg-emerald-100 text-emerald-700',
    slightly_late: 'bg-amber-100 text-amber-700',
    late: 'bg-orange-100 text-orange-700',
    very_late: 'bg-red-100 text-red-700',
};
const COLUMN_LABELS = {
    vk_number: 'VK Number',
    analysis_date: 'Analysis Date',
    input_timestamp: 'Input Timestamp',
    user_id: 'WiMi',
    validation_status: 'Status',
    delay_bucket: 'Delay',
};
export function ControlQueueTable({ items, onExportStateChange, }) {
    const [visibleColumns, setVisibleColumns] = useState({
        vk_number: true,
        analysis_date: true,
        input_timestamp: true,
        user_id: true,
        validation_status: true,
        delay_bucket: true,
    });
    const [filters, setFilters] = useState({
        vk_number: '',
        analysis_date: '',
        input_timestamp: '',
        user_id: '',
        validation_status: '',
        delay_bucket: '',
    });
    const columns = useMemo(() => Object.keys(COLUMN_LABELS).filter((columnId) => visibleColumns[columnId]), [visibleColumns]);
    const statusOptions = useMemo(() => Array.from(new Set(items.map((item) => item.validation_status).filter(Boolean))), [items]);
    const delayOptions = useMemo(() => Array.from(new Set(items.map((item) => item.delay_bucket).filter(Boolean))), [items]);
    const filteredItems = useMemo(() => {
        const normalized = Object.fromEntries(Object.entries(filters).map(([key, value]) => [key, value.trim().toLowerCase()]));
        return items.filter((item) => {
            if (normalized.vk_number && !item.vk_number.toLowerCase().includes(normalized.vk_number))
                return false;
            if (normalized.analysis_date) {
                const isoDate = item.analysis_date ?? '';
                const deDate = formatIsoDateToGerman(item.analysis_date).toLowerCase();
                if (!isoDate.toLowerCase().includes(normalized.analysis_date) && !deDate.includes(normalized.analysis_date)) {
                    return false;
                }
            }
            if (normalized.input_timestamp) {
                const text = item.input_timestamp ? new Date(item.input_timestamp).toLocaleString().toLowerCase() : '';
                if (!text.includes(normalized.input_timestamp))
                    return false;
            }
            const wimiText = (item.wimi_shortcut ?? item.user_id ?? '').toLowerCase();
            if (normalized.user_id && !wimiText.includes(normalized.user_id))
                return false;
            if (normalized.validation_status && item.validation_status.toLowerCase() !== normalized.validation_status)
                return false;
            if (normalized.delay_bucket && item.delay_bucket.toLowerCase() !== normalized.delay_bucket)
                return false;
            return true;
        });
    }, [filters, items]);
    useEffect(() => {
        if (!onExportStateChange)
            return;
        const exportColumns = columns.map((columnId) => COLUMN_LABELS[columnId]);
        const exportRows = filteredItems.map((item) => {
            const row = {};
            columns.forEach((columnId) => {
                if (columnId === 'analysis_date') {
                    row[COLUMN_LABELS[columnId]] = formatIsoDateToGerman(item.analysis_date);
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
                if (columnId === 'delay_bucket') {
                    row[COLUMN_LABELS[columnId]] = item.delay_bucket.replace(/_/g, ' ');
                    return;
                }
                row[COLUMN_LABELS[columnId]] = item[columnId];
            });
            return row;
        });
        onExportStateChange({ columns: exportColumns, rows: exportRows });
    }, [columns, filteredItems, onExportStateChange]);
    if (items.length === 0) {
        return (_jsx("div", { className: "rounded-xl border border-stone-200 bg-white p-8 text-center text-stone-400 text-sm", children: "No entries for the selected period." }));
    }
    return (_jsxs("div", { className: "rounded-xl border border-stone-200 bg-white overflow-hidden", children: [_jsxs("div", { className: "px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between gap-3", children: [_jsxs("span", { className: "text-xs text-stone-500", children: ["Showing ", filteredItems.length, " of ", items.length, " entries"] }), _jsxs("details", { className: "relative", children: [_jsx("summary", { className: "list-none cursor-pointer px-3 py-1.5 rounded text-sm font-medium bg-white border border-stone-200 hover:bg-stone-100", children: "Columns" }), _jsx("div", { className: "absolute right-0 z-10 mt-1 w-56 rounded-lg border border-stone-200 bg-white shadow-lg p-3 flex flex-col gap-2", children: Object.keys(COLUMN_LABELS).map((columnId) => (_jsxs("label", { className: "flex items-center gap-2 text-sm text-stone-700", children: [_jsx("input", { type: "checkbox", checked: visibleColumns[columnId], onChange: (e) => setVisibleColumns((previous) => ({
                                                ...previous,
                                                [columnId]: e.target.checked,
                                            })) }), _jsx("span", { children: COLUMN_LABELS[columnId] })] }, columnId))) })] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsxs("thead", { children: [_jsx("tr", { className: "border-b border-stone-200 bg-stone-50", children: columns.map((columnId) => (_jsx("th", { className: "text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: COLUMN_LABELS[columnId] }, columnId))) }), _jsx("tr", { className: "border-b border-stone-200 bg-white", children: columns.map((columnId) => (_jsx("th", { className: "px-4 py-2", children: columnId === 'validation_status' ? (_jsxs("select", { value: filters.validation_status, onChange: (e) => setFilters((previous) => ({ ...previous, validation_status: e.target.value })), className: "w-full text-xs border border-stone-200 rounded px-2 py-1 bg-white", children: [_jsx("option", { value: "", children: "All" }), statusOptions.map((status) => (_jsx("option", { value: status, children: status }, status)))] })) : columnId === 'delay_bucket' ? (_jsxs("select", { value: filters.delay_bucket, onChange: (e) => setFilters((previous) => ({ ...previous, delay_bucket: e.target.value })), className: "w-full text-xs border border-stone-200 rounded px-2 py-1 bg-white", children: [_jsx("option", { value: "", children: "All" }), delayOptions.map((delay) => (_jsx("option", { value: delay, children: delay.replace(/_/g, ' ') }, delay)))] })) : (_jsx("input", { value: filters[columnId], onChange: (e) => setFilters((previous) => ({ ...previous, [columnId]: e.target.value })), placeholder: "Filter...", className: "w-full text-xs border border-stone-200 rounded px-2 py-1" })) }, columnId))) })] }), _jsxs("tbody", { children: [filteredItems.map((item) => (_jsx("tr", { className: "border-b border-stone-100 last:border-0 hover:bg-stone-50", children: columns.map((columnId) => {
                                        if (columnId === 'vk_number') {
                                            return (_jsx("td", { className: "px-4 py-2.5 font-mono text-xs text-stone-700", children: item.vk_number }, columnId));
                                        }
                                        if (columnId === 'analysis_date') {
                                            return (_jsx("td", { className: "px-4 py-2.5 font-mono text-xs text-stone-600", children: formatIsoDateToGerman(item.analysis_date) }, columnId));
                                        }
                                        if (columnId === 'input_timestamp') {
                                            return (_jsx("td", { className: "px-4 py-2.5 font-mono text-xs text-stone-600", children: item.input_timestamp ? new Date(item.input_timestamp).toLocaleString() : '—' }, columnId));
                                        }
                                        if (columnId === 'user_id') {
                                            return (_jsx("td", { className: "px-4 py-2.5 text-stone-700", children: item.wimi_shortcut ?? item.user_id ?? '—' }, columnId));
                                        }
                                        if (columnId === 'validation_status') {
                                            return (_jsx("td", { className: "px-4 py-2.5", children: _jsx("span", { className: "text-xs text-stone-500", children: item.validation_status }) }, columnId));
                                        }
                                        return (_jsx("td", { className: "px-4 py-2.5", children: _jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${DELAY_COLORS[item.delay_bucket] ?? 'bg-stone-100 text-stone-600'}`, children: item.delay_bucket.replace(/_/g, ' ') }) }, columnId));
                                    }) }, item.vk_number))), filteredItems.length === 0 && (_jsx("tr", { children: _jsx("td", { colSpan: Math.max(columns.length, 1), className: "px-4 py-8 text-center text-sm text-stone-400", children: "No entries match the selected filters." }) }))] })] }) })] }));
}
