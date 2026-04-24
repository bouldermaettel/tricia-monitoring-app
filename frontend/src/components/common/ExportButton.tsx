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
  fileNamePrefix: string;
};

export function ExportButton({ columns, rows, fileNamePrefix }: Props) {
  const disabled = rows.length === 0 || columns.length === 0;

  async function handleCsvExport() {
    const blob = await exportVisibleTableCsv(columns, rows);
    triggerDownload(blob, `${fileNamePrefix}.csv`);
  }

  async function handleXlsxExport() {
    const blob = await exportVisibleTableXlsx(columns, rows);
    triggerDownload(blob, `${fileNamePrefix}.xlsx`);
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={handleCsvExport}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
      >
        <Download size={14} />
        CSV
      </button>
      <button
        onClick={handleXlsxExport}
        disabled={disabled}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
      >
        <Download size={14} />
        XLSX
      </button>
    </div>
  );
}
