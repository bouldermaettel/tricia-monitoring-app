import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { AppShell } from '../components/common/AppShell';
import { ExportButton } from '../components/common/ExportButton';
import { DelaySummary } from '../components/control/DelaySummary';
import { ControlQueueTable } from '../components/control/ControlQueueTable';
import { useControlQueue } from '../hooks/useControlQueue';
export function ControlDashboard() {
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const queue = useControlQueue({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
    });
    return (_jsxs(AppShell, { children: [_jsxs("div", { className: "flex items-center justify-between mb-6", children: [_jsx("h1", { className: "text-2xl font-bold text-stone-900", children: "Control Dashboard" }), _jsx(ExportButton, {})] }), _jsxs("div", { className: "flex flex-col gap-6", children: [_jsx("div", { className: "bg-white border border-stone-200 rounded-xl p-4 flex flex-wrap items-end gap-4", children: _jsxs("div", { className: "flex flex-col gap-1.5", children: [_jsx("span", { className: "text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "Period" }), _jsxs("div", { className: "flex items-center gap-2", children: [_jsx("input", { type: "date", value: dateFrom, onChange: (e) => setDateFrom(e.target.value), className: "text-sm border border-stone-200 rounded-lg px-3 py-2 outline-none focus:border-amber-400 transition-colors" }), _jsx("span", { className: "text-stone-400", children: "\u2192" }), _jsx("input", { type: "date", value: dateTo, onChange: (e) => setDateTo(e.target.value), className: "text-sm border border-stone-200 rounded-lg px-3 py-2 outline-none focus:border-amber-400 transition-colors" }), (dateFrom || dateTo) && (_jsx("button", { onClick: () => { setDateFrom(''); setDateTo(''); }, className: "text-sm text-stone-400 hover:text-stone-700 underline", children: "Clear" }))] })] }) }), _jsx(DelaySummary, { items: queue.data?.items ?? [] }), _jsx(ControlQueueTable, { items: queue.data?.items ?? [] })] })] }));
}
