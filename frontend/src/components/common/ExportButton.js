import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Download } from 'lucide-react';
import { exportVisibleTableCsv, exportVisibleTableXlsx } from '../../services/exports';
function triggerDownload(blob, fileName) {
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
export function ExportButton({ columns, rows, fileNamePrefix }) {
    const disabled = rows.length === 0 || columns.length === 0;
    async function handleCsvExport() {
        const blob = await exportVisibleTableCsv(columns, rows);
        triggerDownload(blob, `${fileNamePrefix}.csv`);
    }
    async function handleXlsxExport() {
        const blob = await exportVisibleTableXlsx(columns, rows);
        triggerDownload(blob, `${fileNamePrefix}.xlsx`);
    }
    return (_jsxs("div", { className: "flex gap-2", children: [_jsxs("button", { onClick: handleCsvExport, disabled: disabled, className: "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors", children: [_jsx(Download, { size: 14 }), "CSV"] }), _jsxs("button", { onClick: handleXlsxExport, disabled: disabled, className: "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors", children: [_jsx(Download, { size: 14 }), "XLSX"] })] }));
}
