import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useMemo } from 'react';
import { AppShell } from '../components/common/AppShell';
import { ExportButton } from '../components/common/ExportButton';
import { DelaySummary } from '../components/control/DelaySummary';
import { ControlQueueTable } from '../components/control/ControlQueueTable';
import { useControlQueue } from '../hooks/useControlQueue';
import { useImportOverride } from '../state/importOverride';
const EMPTY_ITEMS = [];
const DATE_WINDOWS = [
    { value: '3M', label: '3 Months' },
    { value: '6M', label: '6 Months' },
    { value: '12M', label: '12 Months' },
    { value: 'ALL', label: 'All Time' },
    { value: 'CUSTOM', label: 'Custom' },
];
function getDateParams(window, dateFrom, dateTo) {
    if (window === 'ALL')
        return {};
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
    const [dateWindow, setDateWindow] = useState('3M');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const dateParams = getDateParams(dateWindow, dateFrom || undefined, dateTo || undefined);
    const overrideControlItems = useImportOverride((s) => s.controlItems);
    const overrideSourceFile = useImportOverride((s) => s.sourceFileName);
    const clearPreviewData = useImportOverride((s) => s.clearPreviewData);
    const isOverrideActive = Boolean(overrideSourceFile);
    const queue = useControlQueue(dateParams, { enabled: !isOverrideActive });
    const [exportState, setExportState] = useState({
        columns: [],
        rows: [],
    });
    const activeItems = useMemo(() => isOverrideActive
        ? overrideControlItems.filter((item) => {
            if (dateParams.start_date && item.analysis_date < String(dateParams.start_date))
                return false;
            if (dateParams.end_date && item.analysis_date > String(dateParams.end_date))
                return false;
            return true;
        })
        : queue.data?.items ?? EMPTY_ITEMS, 
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isOverrideActive, overrideControlItems, dateParams.start_date, dateParams.end_date, queue.data]);
    return (_jsxs(AppShell, { children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h1", { className: "text-2xl font-bold text-stone-900", children: "Control Dashboard" }), _jsx(ExportButton, { columns: exportState.columns, rows: exportState.rows, fileNamePrefix: "control-table" })] }), isOverrideActive && (_jsxs("div", { className: "mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800 flex items-center justify-between gap-3", children: [_jsxs("span", { children: ["Using uploaded dataset from ", overrideSourceFile ?? 'file upload', " for control queue."] }), _jsx("button", { className: "underline", onClick: clearPreviewData, children: "Clear" })] })), _jsxs("div", { className: "flex flex-col gap-6", children: [_jsx("div", { className: "bg-white border border-stone-200 rounded-xl p-4 flex flex-wrap items-end gap-4", children: _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("span", { className: "text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "Period" }), _jsx("div", { className: "flex gap-1", children: DATE_WINDOWS.map(({ value, label }) => (_jsx("button", { onClick: () => setDateWindow(value), className: `px-3 py-1.5 rounded text-sm font-medium transition-colors ${dateWindow === value
                                            ? 'bg-stone-900 text-white'
                                            : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`, children: label }, value))) }), dateWindow === 'CUSTOM' && (_jsxs("div", { className: "flex items-center gap-2 mt-1", children: [_jsx("input", { type: "date", value: dateFrom, onChange: (e) => setDateFrom(e.target.value), className: "text-sm border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400" }), _jsx("span", { className: "text-stone-400 text-sm", children: "\u2192" }), _jsx("input", { type: "date", value: dateTo, onChange: (e) => setDateTo(e.target.value), className: "text-sm border border-stone-200 rounded-lg px-2 py-1 outline-none focus:border-amber-400" })] }))] }) }), _jsx(DelaySummary, { items: activeItems }), _jsx(ControlQueueTable, { items: activeItems, onExportStateChange: setExportState })] })] }));
}
