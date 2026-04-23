import { Download } from 'lucide-react';
import { exportCasesCsv, exportCasesXlsx } from '../../services/exports';

export function ExportButton() {
  return (
    <div className="flex gap-2">
      <button
        onClick={() => exportCasesCsv()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
      >
        <Download size={14} />
        CSV
      </button>
      <button
        onClick={() => exportCasesXlsx()}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
      >
        <Download size={14} />
        XLSX
      </button>
    </div>
  );
}
