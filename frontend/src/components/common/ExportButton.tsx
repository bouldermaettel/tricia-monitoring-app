import { exportCasesCsv, exportCasesXlsx } from '../../services/exports';

export function ExportButton() {
  return (
    <div>
      <button onClick={() => exportCasesCsv()}>Export CSV</button>
      <button onClick={() => exportCasesXlsx()}>Export XLSX</button>
    </div>
  );
}
