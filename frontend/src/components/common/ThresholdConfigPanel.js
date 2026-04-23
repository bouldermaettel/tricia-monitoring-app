import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Settings } from 'lucide-react';
import { useThresholds, useUpdateThresholds } from '../../hooks/useThresholds';
export function ThresholdConfigPanel() {
    const { data } = useThresholds();
    const update = useUpdateThresholds();
    const [acceptance, setAcceptance] = useState(data?.acceptance_threshold ?? 1);
    const [problem, setProblem] = useState(data?.problem_threshold ?? 3);
    const [open, setOpen] = useState(false);
    return (_jsxs("div", { className: "bg-white border border-stone-200 rounded-xl", children: [_jsxs("button", { onClick: () => setOpen((v) => !v), className: "flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-stone-600 hover:text-stone-900 transition-colors", children: [_jsx(Settings, { size: 15 }), "Threshold Configuration", _jsx("span", { className: "ml-auto text-stone-400", children: open ? '▲' : '▼' })] }), open && (_jsxs("div", { className: "border-t border-stone-100 px-4 py-4 flex flex-wrap items-end gap-6", children: [_jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "Acceptance threshold" }), _jsxs("p", { className: "text-xs text-stone-400 mb-1", children: ["Current: ", data?.acceptance_threshold ?? '—'] }), _jsx("input", { type: "number", min: 0, max: 5, value: acceptance, onChange: (e) => setAcceptance(Number(e.target.value)), className: "w-24 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" })] }), _jsxs("div", { className: "flex flex-col gap-1", children: [_jsx("label", { className: "text-xs font-semibold text-stone-500 uppercase tracking-wide", children: "Problem threshold" }), _jsxs("p", { className: "text-xs text-stone-400 mb-1", children: ["Current: ", data?.problem_threshold ?? '—'] }), _jsx("input", { type: "number", min: 0, max: 5, value: problem, onChange: (e) => setProblem(Number(e.target.value)), className: "w-24 border border-stone-200 rounded-lg px-3 py-2 text-sm font-mono outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-100" })] }), _jsx("button", { onClick: () => update.mutate({
                            config_key: 'default',
                            acceptance_threshold: acceptance,
                            problem_threshold: problem,
                            include_excluded_default: false,
                        }), disabled: update.isPending, className: "px-4 py-2 bg-stone-900 text-white text-sm font-medium rounded-lg hover:bg-stone-700 disabled:opacity-50 transition-colors", children: update.isPending ? 'Saving…' : 'Save' })] }))] }));
}
