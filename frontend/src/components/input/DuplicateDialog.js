import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { AlertTriangle, X } from 'lucide-react';
export function DuplicateDialog({ open, vkNumber, onClose, onEditExisting }) {
    if (!open)
        return null;
    function handleEditExisting() {
        const normalized = vkNumber?.trim();
        if (!normalized || !onEditExisting) {
            onClose();
            return;
        }
        onEditExisting(normalized);
    }
    return (_jsx("div", { role: "dialog", "aria-label": "duplicate-dialog", className: "fixed inset-0 z-50 flex items-center justify-center bg-stone-900/50", children: _jsxs("div", { className: "bg-white rounded-2xl shadow-xl border border-stone-200 p-6 w-full max-w-sm mx-4", children: [_jsxs("div", { className: "flex items-start justify-between mb-4", children: [_jsxs("div", { className: "flex items-center gap-3", children: [_jsx("div", { className: "w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center", children: _jsx(AlertTriangle, { size: 18, className: "text-amber-600" }) }), _jsx("h2", { className: "text-base font-semibold text-stone-900", children: "Duplicate VK Number" })] }), _jsx("button", { onClick: onClose, className: "text-stone-400 hover:text-stone-700 transition-colors", children: _jsx(X, { size: 18 }) })] }), _jsx("p", { className: "text-sm text-stone-600 mb-6", children: "A case with this VK number already exists. Please edit the existing entry or cancel to start over." }), _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { onClick: onClose, className: "px-4 py-2 text-sm font-medium text-stone-600 hover:text-stone-900 border border-stone-200 rounded-lg transition-colors", children: "Cancel" }), _jsx("button", { onClick: handleEditExisting, className: "px-4 py-2 text-sm font-medium bg-stone-900 text-white rounded-lg hover:bg-stone-700 transition-colors", children: "Edit existing" })] })] }) }));
}
