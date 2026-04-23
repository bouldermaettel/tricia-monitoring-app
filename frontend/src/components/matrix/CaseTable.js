import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Check, MessageSquare, MinusCircle, Tag } from 'lucide-react';
const CATEGORY_OPTIONS = [
    { value: '', label: '—' },
    { value: 'no_issue', label: 'Kein Problem' },
    { value: 'monitor', label: 'Beobachtung' },
    { value: 'problem', label: 'Problem' },
];
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
export function CaseTable({ items, onMarkReviewed, onToggleExcluded, onSetCategory, onAddComment }) {
    const [commentInputs, setCommentInputs] = useState({});
    if (items.length === 0) {
        return (_jsx("div", { className: "rounded-xl border border-stone-200 bg-white p-8 text-center text-stone-400 text-sm", children: "No cases for the selected filters." }));
    }
    return (_jsx("div", { className: "rounded-xl border border-stone-200 bg-white overflow-hidden", children: _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { children: _jsxs("tr", { className: "border-b border-stone-200 bg-stone-50", children: [_jsx("th", { className: "text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "VK" }), _jsx("th", { className: "text-left px-4 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "Device" }), _jsx("th", { className: "text-center px-3 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "TRI-S" }), _jsx("th", { className: "text-center px-3 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "WIMI-S" }), _jsx("th", { className: "text-center px-3 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "TRI-D" }), _jsx("th", { className: "text-center px-3 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "WIMI-D" }), _jsx("th", { className: "text-left px-3 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "Category" }), _jsx("th", { className: "text-left px-3 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "Comment" }), _jsx("th", { className: "text-center px-3 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "Excl." }), _jsx("th", { className: "text-center px-3 py-3 text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "\u2713" })] }) }), _jsx("tbody", { children: items.map((item) => (_jsxs("tr", { className: `border-b border-stone-100 last:border-0 ${rowColor(item)}`, children: [_jsx("td", { className: "px-4 py-2.5 font-mono text-xs text-stone-700", children: item.vk_number }), _jsx("td", { className: "px-4 py-2.5 text-stone-700", children: item.device_name ?? '—' }), _jsx("td", { className: "px-3 py-2.5 text-center font-mono", children: item.tricia_s ?? '—' }), _jsx("td", { className: "px-3 py-2.5 text-center font-mono font-semibold", children: item.user_s ?? '—' }), _jsx("td", { className: "px-3 py-2.5 text-center font-mono", children: item.tricia_d ?? '—' }), _jsx("td", { className: "px-3 py-2.5 text-center font-mono font-semibold", children: item.user_d ?? '—' }), _jsx("td", { className: "px-3 py-2.5", children: onSetCategory ? (_jsx("select", { value: item.category_code ?? '', onChange: (e) => onSetCategory(item.id, e.target.value), className: "text-xs border border-stone-200 rounded px-1.5 py-1 bg-white outline-none focus:border-amber-400 cursor-pointer", children: CATEGORY_OPTIONS.map((o) => (_jsx("option", { value: o.value, children: o.label }, o.value))) })) : (_jsxs("span", { className: "flex items-center gap-1 text-xs text-stone-500", children: [_jsx(Tag, { size: 12 }), item.category_code ?? '—'] })) }), _jsx("td", { className: "px-3 py-2.5", children: onAddComment ? (_jsxs("div", { className: "flex gap-1", children: [_jsx("input", { value: commentInputs[item.id] ?? '', onChange: (e) => setCommentInputs((p) => ({ ...p, [item.id]: e.target.value })), onKeyDown: (e) => {
                                                    if (e.key === 'Enter' && commentInputs[item.id]?.trim()) {
                                                        onAddComment(item.id, commentInputs[item.id]);
                                                        setCommentInputs((p) => ({ ...p, [item.id]: '' }));
                                                    }
                                                }, placeholder: "Add\u2026", className: "text-xs border border-stone-200 rounded px-2 py-1 w-28 outline-none focus:border-amber-400" }), _jsx("button", { onClick: () => {
                                                    if (commentInputs[item.id]?.trim()) {
                                                        onAddComment(item.id, commentInputs[item.id]);
                                                        setCommentInputs((p) => ({ ...p, [item.id]: '' }));
                                                    }
                                                }, className: "text-stone-400 hover:text-stone-700", title: "Submit comment", children: _jsx(MessageSquare, { size: 13 }) })] })) : (_jsx("span", { className: "text-xs text-stone-400", children: "\u2014" })) }), _jsx("td", { className: "px-3 py-2.5 text-center", children: _jsx("button", { onClick: () => onToggleExcluded?.(item.id, item.is_excluded ?? false), title: "Toggle Streichresultat", className: `transition-colors ${item.is_excluded ? 'text-red-500 hover:text-red-700' : 'text-stone-300 hover:text-stone-500'}`, children: _jsx(MinusCircle, { size: 16 }) }) }), _jsx("td", { className: "px-3 py-2.5 text-center", children: _jsx("button", { onClick: () => onMarkReviewed?.(item.id, item.is_reviewed ?? false), title: item.is_reviewed ? 'Mark as not reviewed' : 'Mark reviewed', className: `transition-colors ${item.is_reviewed ? 'text-emerald-500 hover:text-emerald-700' : 'text-stone-300 hover:text-emerald-400'}`, children: _jsx(Check, { size: 16 }) }) })] }, item.id))) })] }) }) }));
}
