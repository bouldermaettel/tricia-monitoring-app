import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { Download, FileText } from 'lucide-react';
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
function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}
function buildMatrixTable(section) {
    const allValues = [...new Set(section.cells.flatMap((cell) => [cell.expected_value, cell.observed_value]))].sort((a, b) => a - b);
    const matrix = new Map();
    section.cells.forEach((cell) => matrix.set(`${cell.expected_value}-${cell.observed_value}`, cell.case_count));
    if (allValues.length === 0) {
        return `<p class="empty-note">No matrix data for this selection.</p>`;
    }
    const header = allValues.map((value) => `<th>${escapeHtml(value)}</th>`).join('');
    const rows = allValues
        .map((expected) => {
        const columns = allValues
            .map((observed) => {
            const key = `${expected}-${observed}`;
            const count = matrix.get(key) ?? 0;
            const level = expected === observed ? 'diag' : expected > observed ? 'false-low' : 'false-high';
            return `<td class="${level}">${count}</td>`;
        })
            .join('');
        return `<tr><th>${escapeHtml(expected)}</th>${columns}</tr>`;
    })
        .join('');
    return `
    <div class="axis-label">${escapeHtml(section.rowAxisLabel)} vs ${escapeHtml(section.columnAxisLabel)}</div>
    <table class="matrix-table">
      <thead>
        <tr><th></th>${header}</tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>
  `;
}
function buildReportHtml({ generatedAt, filters, matrixSections, tableColumns, tableRows, }) {
    const filterRows = Object.entries(filters)
        .map(([key, value]) => `<tr><td>${escapeHtml(key)}</td><td>${escapeHtml(value)}</td></tr>`)
        .join('');
    const tableHeader = tableColumns.map((column) => `<th>${escapeHtml(column)}</th>`).join('');
    const tableBody = tableRows
        .map((row) => {
        const cells = tableColumns.map((column) => `<td>${escapeHtml(row[column] ?? '')}</td>`).join('');
        return `<tr>${cells}</tr>`;
    })
        .join('');
    const matrixHtml = matrixSections
        .map((section) => `
      <section class="matrix-section">
        <h3>${escapeHtml(section.title)}</h3>
        ${buildMatrixTable(section)}
      </section>
    `)
        .join('');
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Matrix Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; color: #1c1917; }
    h1, h2, h3 { margin: 0 0 8px 0; }
    p { margin: 0 0 8px 0; }
    .meta { color: #57534e; font-size: 12px; margin-bottom: 16px; }
    .section { margin-bottom: 20px; page-break-inside: avoid; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #d6d3d1; padding: 6px 8px; font-size: 12px; }
    th { background: #f5f5f4; text-align: left; }
    .matrix-table th, .matrix-table td { text-align: center; width: 44px; }
    .axis-label { font-size: 12px; color: #57534e; margin: 6px 0; }
    .diag { background: #ecfdf5; }
    .false-low { background: #fef2f2; }
    .false-high { background: #fefce8; }
    .matrix-section { margin-bottom: 20px; }
    .empty-note { font-size: 12px; color: #78716c; margin: 6px 0; }
    .table-wrap { overflow: auto; max-width: 100%; }
    @media print {
      body { margin: 12mm; }
      .section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Matrix Dashboard Report</h1>
  <p class="meta">Generated at: ${escapeHtml(generatedAt)}</p>
  <section class="section">
    <h2>Active Filters</h2>
    <table>
      <thead><tr><th>Filter</th><th>Value</th></tr></thead>
      <tbody>${filterRows}</tbody>
    </table>
  </section>
  <section class="section">
    <h2>Confusion Matrices</h2>
    ${matrixHtml}
  </section>
  <section class="section">
    <h2>Filtered Data (${escapeHtml(tableRows.length)} rows)</h2>
    <div class="table-wrap">
      <table>
        <thead><tr>${tableHeader}</tr></thead>
        <tbody>${tableBody}</tbody>
      </table>
    </div>
  </section>
</body>
</html>`;
}
export function MatrixReportExportButton({ fileNamePrefix, generatedAt, filters, matrixSections, tableColumns, tableRows, }) {
    const disabled = tableColumns.length === 0;
    function getHtml() {
        return buildReportHtml({
            generatedAt,
            filters,
            matrixSections,
            tableColumns,
            tableRows,
        });
    }
    function exportHtml() {
        const html = getHtml();
        const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
        triggerDownload(blob, `${fileNamePrefix}.html`);
    }
    function exportPdf() {
        const html = getHtml();
        const printWindow = window.open('', '_blank');
        if (!printWindow)
            return;
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
        printWindow.focus();
        printWindow.print();
    }
    return (_jsxs("div", { className: "flex gap-2", children: [_jsxs("button", { onClick: exportHtml, disabled: disabled, className: "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors", children: [_jsx(FileText, { size: 14 }), "Report HTML"] }), _jsxs("button", { onClick: exportPdf, disabled: disabled, className: "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors", children: [_jsx(Download, { size: 14 }), "Report PDF"] })] }));
}
