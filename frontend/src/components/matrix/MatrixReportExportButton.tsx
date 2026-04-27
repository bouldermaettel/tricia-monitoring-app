import { useState } from 'react';
import { Download, FileText } from 'lucide-react';

type MatrixCell = {
  expected_value: number;
  observed_value: number;
  case_count: number;
};

type MatrixSection = {
  title: string;
  rowAxisLabel: string;
  columnAxisLabel: string;
  cells: MatrixCell[];
};

type Props = {
  fileNamePrefix: string;
  generatedAt: string;
  filters: Record<string, string | boolean | undefined>;
  matrixSections: MatrixSection[];
  tableColumns: string[];
  tableRows: Array<Record<string, unknown>>;
};

type ReportHtmlParams = Omit<Props, 'fileNamePrefix'> & { matrixImageData: (string | null)[] };

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

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getMatrixValues(section: MatrixSection) {
  const allValues = [...new Set(section.cells.flatMap((cell) => [cell.expected_value, cell.observed_value]))].sort((a, b) => a - b);
  const matrix = new Map<string, number>();
  section.cells.forEach((cell) => matrix.set(`${cell.expected_value}-${cell.observed_value}`, cell.case_count));
  return { allValues, matrix };
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + w - radius, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
  ctx.lineTo(x + w, y + h - radius);
  ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
  ctx.lineTo(x + radius, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function matrixToImageDataUrl(section: MatrixSection): string | null {
  const { allValues, matrix } = getMatrixValues(section);
  if (allValues.length === 0) {
    return null;
  }

  const canvas = document.createElement('canvas');
  const size = 980;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  const gridSize = 700;
  const originX = 190;
  const originY = 140;
  const cellSize = gridSize / allValues.length;
  const fontFamily = 'Inter, Segoe UI, Arial, sans-serif';

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, size, size);

  ctx.fillStyle = '#111827';
  ctx.font = `700 30px ${fontFamily}`;
  ctx.fillText(section.title, originX, 56);

  ctx.fillStyle = '#667085';
  ctx.font = `500 18px ${fontFamily}`;
  ctx.fillText(`${section.rowAxisLabel} vs ${section.columnAxisLabel}`, originX, 88);

  drawRoundedRect(ctx, originX, originY, gridSize, gridSize, 18);
  ctx.fillStyle = '#f8fafc';
  ctx.fill();
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.stroke();

  for (let i = 0; i < allValues.length; i += 1) {
    const expected = allValues[i];
    for (let j = 0; j < allValues.length; j += 1) {
      const observed = allValues[j];
      const x = originX + j * cellSize;
      const y = originY + i * cellSize;
      const count = matrix.get(`${expected}-${observed}`) ?? 0;
      const color =
        expected === observed ? '#DCFCE7' : expected > observed ? '#FEE2E2' : '#FEF3C7';
      const textColor =
        expected === observed ? '#166534' : expected > observed ? '#991B1B' : '#92400E';
      ctx.fillStyle = color;
      ctx.fillRect(x, y, cellSize, cellSize);
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, cellSize, cellSize);
      ctx.fillStyle = textColor;
      ctx.font = `700 ${Math.max(14, Math.floor(cellSize * 0.3))}px ${fontFamily}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(count), x + cellSize / 2, y + cellSize / 2);
    }
  }

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#475467';
  ctx.font = `600 18px ${fontFamily}`;
  for (let j = 0; j < allValues.length; j += 1) {
    const x = originX + j * cellSize + cellSize / 2;
    ctx.fillText(String(allValues[j]), x, originY - 22);
  }
  for (let i = 0; i < allValues.length; i += 1) {
    const y = originY + i * cellSize + cellSize / 2;
    ctx.fillText(String(allValues[i]), originX - 24, y);
  }

  ctx.save();
  ctx.translate(54, originY + gridSize / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#475467';
  ctx.font = `700 20px ${fontFamily}`;
  ctx.fillText(section.rowAxisLabel, 0, 0);
  ctx.restore();

  ctx.fillStyle = '#475467';
  ctx.font = `700 20px ${fontFamily}`;
  ctx.textAlign = 'center';
  ctx.fillText(section.columnAxisLabel, originX + gridSize / 2, originY + gridSize + 40);

  return canvas.toDataURL('image/png');
}

function buildReportHtml({
  generatedAt,
  filters,
  matrixSections,
  tableColumns,
  tableRows,
  matrixImageData,
}: ReportHtmlParams): string {
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
    .map(
      (section, index) => `
      <section class="matrix-section">
        <h3>${escapeHtml(section.title)}</h3>
        ${
          matrixImageData[index]
            ? `<img src="${matrixImageData[index]}" alt="${escapeHtml(section.title)}" class="matrix-image" />`
            : `<p class="empty-note">No matrix data for this selection.</p>`
        }
      </section>
    `
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Matrix Report</title>
  <style>
    :root {
      --bg: #f5f8ff;
      --card: #ffffff;
      --text: #111827;
      --muted: #667085;
      --line: #e4e7ec;
      --header: #eef2ff;
      --accent: #4f46e5;
      --diag-bg: #e7f8ef;
      --diag-text: #0f5132;
      --low-bg: #fdecec;
      --low-text: #842029;
      --high-bg: #fff7da;
      --high-text: #7a4b00;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Inter, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      background: radial-gradient(circle at top right, #dbeafe 0%, var(--bg) 45%, #f8fafc 100%);
      color: var(--text);
      padding: 28px;
    }
    h1, h2, h3 { margin: 0; }
    .page {
      max-width: 1240px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 18px;
    }
    .hero {
      background: linear-gradient(135deg, #3730a3 0%, #4f46e5 55%, #6366f1 100%);
      border-radius: 16px;
      padding: 18px 20px;
      color: #eef2ff;
      box-shadow: 0 10px 30px rgba(79, 70, 229, 0.18);
    }
    .hero h1 {
      font-size: 24px;
      letter-spacing: 0.2px;
      margin-bottom: 6px;
    }
    .meta {
      font-size: 12px;
      color: #dbeafe;
      margin: 0;
    }
    .section {
      background: var(--card);
      border: 1px solid var(--line);
      border-radius: 14px;
      padding: 16px;
      box-shadow: 0 4px 14px rgba(15, 23, 42, 0.05);
      page-break-inside: avoid;
    }
    .section h2 {
      font-size: 16px;
      margin-bottom: 12px;
      color: #1f2937;
    }
    table {
      border-collapse: separate;
      border-spacing: 0;
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
    }
    th, td {
      border-bottom: 1px solid var(--line);
      border-right: 1px solid var(--line);
      padding: 8px 10px;
      font-size: 12px;
    }
    tr:last-child td, tr:last-child th { border-bottom: none; }
    tr th:last-child, tr td:last-child { border-right: none; }
    th {
      background: var(--header);
      color: #344054;
      text-align: left;
      font-weight: 700;
      letter-spacing: 0.1px;
    }
    tbody tr:nth-child(even) td {
      background: #fcfcfd;
    }
    .matrix-section { margin-bottom: 14px; }
    .matrix-section:last-child { margin-bottom: 0; }
    .matrix-section h3 {
      font-size: 14px;
      margin-bottom: 8px;
      color: #111827;
    }
    .matrix-image {
      width: min(100%, 760px);
      display: block;
      border: 1px solid #e4e7ec;
      border-radius: 12px;
      background: #fff;
      box-shadow: 0 4px 10px rgba(15, 23, 42, 0.06);
    }
    .empty-note {
      font-size: 12px;
      color: #6b7280;
      margin: 8px 0 0 0;
    }
    .table-wrap {
      overflow: auto;
      max-width: 100%;
      border-radius: 10px;
    }
    @media print {
      body {
        margin: 0;
        padding: 10mm;
        background: #fff;
      }
      .hero {
        box-shadow: none;
      }
      .section { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="hero">
      <h1>Matrix Dashboard Report</h1>
      <p class="meta">Generated at ${escapeHtml(generatedAt)} • ${escapeHtml(tableRows.length)} filtered case rows</p>
    </div>
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
      <h2>Filtered Data</h2>
      <div class="table-wrap">
        <table>
          <thead><tr>${tableHeader}</tr></thead>
          <tbody>${tableBody}</tbody>
        </table>
      </div>
    </section>
  </div>
</body>
</html>`;
}

export function MatrixReportExportButton({
  fileNamePrefix,
  generatedAt,
  filters,
  matrixSections,
  tableColumns,
  tableRows,
}: Props) {
  const disabled = tableColumns.length === 0;
  const [isGenerating, setIsGenerating] = useState(false);

  async function getHtml() {
    const matrixImageData = matrixSections.map((section) => matrixToImageDataUrl(section));
    return buildReportHtml({
      generatedAt,
      filters,
      matrixSections,
      tableColumns,
      tableRows,
      matrixImageData,
    });
  }

  async function exportHtml() {
    setIsGenerating(true);
    try {
      const html = await getHtml();
      const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
      triggerDownload(blob, `${fileNamePrefix}.html`);
    } finally {
      setIsGenerating(false);
    }
  }

  async function exportPdf() {
    setIsGenerating(true);
    try {
      const html = await getHtml();
      const printWindow = window.open('', '_blank');
      if (!printWindow) {
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
      const waitForImages = () =>
        new Promise<void>((resolve) => {
          const images = Array.from(printWindow.document.images);
          if (images.length === 0) {
            resolve();
            return;
          }
          let loaded = 0;
          const done = () => {
            loaded += 1;
            if (loaded >= images.length) resolve();
          };
          images.forEach((img) => {
            if (img.complete) {
              done();
            } else {
              img.addEventListener('load', done, { once: true });
              img.addEventListener('error', done, { once: true });
            }
          });
          window.setTimeout(resolve, 1500);
        });
      await waitForImages();
      printWindow.focus();
      printWindow.print();
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex gap-2">
      <button
        onClick={exportHtml}
        disabled={disabled || isGenerating}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
      >
        <FileText size={14} />
        {isGenerating ? 'Generating...' : 'Report HTML'}
      </button>
      <button
        onClick={exportPdf}
        disabled={disabled || isGenerating}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-stone-600 border border-stone-200 rounded-lg hover:bg-stone-50 transition-colors"
      >
        <Download size={14} />
        {isGenerating ? 'Generating...' : 'Report PDF'}
      </button>
    </div>
  );
}
