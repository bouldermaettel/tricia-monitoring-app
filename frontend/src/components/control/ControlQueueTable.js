import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { formatIsoDateToGerman } from '../../utils/date';
const DELAY_COLORS = {
    on_time: 'bg-emerald-100 text-emerald-700',
    slightly_late: 'bg-amber-100 text-amber-700',
    late: 'bg-orange-100 text-orange-700',
    very_late: 'bg-red-100 text-red-700',
};
export function ControlQueueTable({ items }) {
    if (items.length === 0) {
        return (_jsx("div", { className: "rounded-xl border border-stone-200 bg-white p-8 text-center text-stone-400 text-sm", children: "No entries for the selected period." }));
    }
    return (_jsx("div", { className: "rounded-xl border border-stone-200 bg-white overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-stone-200 bg-stone-50", children: [_jsx("th", { className: "text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "VK Number" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "Analysis Date" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "Input Timestamp" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "WiMi" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "Status" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "Delay" })] }) }), _jsx("tbody", { children: items.map((item) => (_jsxs("tr", { className: "border-b border-stone-100 last:border-0 hover:bg-stone-50", children: [_jsx("td", { className: "px-4 py-2.5 font-mono text-xs text-stone-700", children: item.vk_number }), _jsx("td", { className: "px-4 py-2.5 font-mono text-xs text-stone-600", children: formatIsoDateToGerman(item.analysis_date) }), _jsx("td", { className: "px-4 py-2.5 font-mono text-xs text-stone-600", children: item.input_timestamp ? new Date(item.input_timestamp).toLocaleString() : '—' }), _jsx("td", { className: "px-4 py-2.5 text-stone-700", children: item.user_id ?? '—' }), _jsx("td", { className: "px-4 py-2.5", children: _jsx("span", { className: "text-xs text-stone-500", children: item.validation_status }) }), _jsx("td", { className: "px-4 py-2.5", children: _jsx("span", { className: `inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${DELAY_COLORS[item.delay_bucket] ?? 'bg-stone-100 text-stone-600'}`, children: item.delay_bucket.replace(/_/g, ' ') }) })] }, item.vk_number))) })] }) }) }));
}
