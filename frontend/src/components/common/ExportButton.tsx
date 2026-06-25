import { useState } from 'react';
import { Download } from 'lucide-react';
import { exportVisibleTableCsv, exportVisibleTableXlsx } from '../../services/exports';

function triggerDownload(blob: Blob, fileName: string) {
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

type Props = {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  filters?: Record<string, unknown>;
  fileNamePrefix: string;
  /** Optional async hook called before each export. Receives current columns/rows and
   *  returns enriched columns/rows (e.g. to lazily add audit trail data). */
  onBeforeExport?: (
    columns: string[],
    rows: Array<Record<string, unknown>>
  ) => Promise<{ columns: string[]; rows: Array<Record<string, unknown>> }>;
};

export function ExportButton({ columns, rows, filters, fileNamePrefix, onBeforeExport }: Props) {
  const [loading, setLoading] = useState(false);
  const disabled = (rows.length === 0 && !filters) || columns.length === 0 || loading;

  async function resolveData() {
    if (onBeforeExport) {
      return onBeforeExport(columns, rows);
    }
    return { columns, rows };
  }

  async function handleCsvExport() {
    setLoading(true);
    try {
      const data = await resolveData();
      const blob = await exportVisibleTableCsv(data.columns, data.rows, filters);
      triggerDownload(blob, `${fileNamePrefix}.csv`);
    } finally {
      setLoading(false);
    }
  }

  async function handleXlsxExport() {
    setLoading(true);
    try {
      const data = await resolveData();
      const blob = await exportVisibleTableXlsx(data.columns, data.rows, filters);
      triggerDownload(blob, `${fileNamePrefix}.xlsx`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleCsvExport}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
      >
        <Download size={14} />
        {loading ? 'Exporting…' : 'CSV'}
      </button>
      <button
        onClick={handleXlsxExport}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors disabled:opacity-50"
      >
        <Download size={14} />
        {loading ? 'Exporting…' : 'XLSX'}
      </button>
    </div>
  );
}
