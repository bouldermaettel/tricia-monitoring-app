import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
export function ConfusionMatrixGrid({ title = 'Confusion Matrix — WiMi ground truth (rows) vs. Tricia prediction (cols)', cells, onCellToggle, selectedCells = [], rowAxisLabel, columnAxisLabel, }) {
    const allValues = [...new Set(cells.flatMap((c) => [c.expected_value, c.observed_value]))].sort((a, b) => a - b);
    const cellMap = new Map();
    cells.forEach((c) => cellMap.set(`${c.expected_value}-${c.observed_value}`, c));
    const selectedSet = new Set(selectedCells.map((cell) => `${cell.expected}-${cell.observed}`));
    if (allValues.length === 0) {
        return (_jsx("div", { className: "rounded-xl border border-stone-200 bg-white p-12 text-center text-stone-400 text-sm", children: "No matrix data for the selected period." }));
    }
    return (_jsxs("div", { className: "rounded-xl border border-stone-200 bg-white p-6", children: [_jsx("h2", { className: "text-sm font-semibold text-stone-500 uppercase tracking-wide mb-4", children: title }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("div", { className: "inline-flex items-center gap-3", children: [rowAxisLabel && (_jsx("div", { className: "text-xs font-semibold text-stone-500 tracking-wide [writing-mode:vertical-rl] rotate-180", children: rowAxisLabel })), _jsxs("div", { className: "inline-flex flex-col items-center", children: [_jsxs("table", { className: "border-collapse", children: [_jsx("thead", { children: _jsxs("tr", { children: [_jsx("th", { className: "p-2 text-xs text-stone-400 font-medium w-12" }), allValues.map((v) => (_jsx("th", { className: "p-2 text-xs text-stone-500 font-semibold text-center w-20", children: v }, v)))] }) }), _jsx("tbody", { children: allValues.map((expected) => (_jsxs("tr", { children: [_jsx("th", { className: "p-2 text-xs text-stone-500 font-semibold text-right pr-4", children: expected }), allValues.map((observed) => {
                                        const cell = cellMap.get(`${expected}-${observed}`);
                                        const isSelected = selectedSet.has(`${expected}-${observed}`);
                                        const isDiag = expected === observed;
                                        const isWimiHigherThanTricia = expected > observed;
                                        const hasData = cell && cell.case_count > 0;
                                        let colorClass;
                                        if (!hasData) {
                                            colorClass = 'bg-stone-50 text-stone-300 border-stone-100';
                                        }
                                        else if (isDiag) {
                                            colorClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100';
                                        }
                                        else if (isWimiHigherThanTricia) {
                                            colorClass = 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100';
                                        }
                                        else {
                                            colorClass = 'bg-yellow-50 text-yellow-700 border-yellow-200 hover:bg-yellow-100';
                                        }
                                        return (_jsx("td", { className: "p-1", children: _jsx("button", { onClick: () => hasData && onCellToggle(expected, observed), disabled: !hasData, className: `w-16 h-14 rounded-lg border font-mono text-sm font-semibold transition-all ${colorClass} ${isSelected ? 'ring-2 ring-amber-400 ring-offset-1 scale-105 shadow-md' : 'hover:scale-105'} disabled:cursor-default`, children: cell?.case_count ?? '—' }) }, observed));
                                    })] }, expected))) })] }), columnAxisLabel && (_jsx("div", { className: "mt-2 text-xs font-semibold text-stone-500 tracking-wide", children: columnAxisLabel }))] })] }) })] }));
}
