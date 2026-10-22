// @vitest-environment happy-dom
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MatrixReportExportButton } from '../../src/components/matrix/MatrixReportExportButton';

const sections = ['Severity Matrix', 'Probability Matrix', 'Detectability Matrix', 'Risk Class Matrix'].map(title => ({
  title, rowAxisLabel: 'WiMi', columnAxisLabel: 'Tricia',
  cells: [{ expected_value: 1, observed_value: 1, case_count: 75 }],
}));
const fullRows = Array.from({ length: 75 }, (_, i) => ({ vk_number: `VK-${i + 1}`, device_name: 'matching' }));
const props = {
  fileNamePrefix: 'report', generatedAt: 'today', filters: { device_name: 'matching' },
  matrixSections: sections, tableColumns: ['vk_number', 'device_name'], tableRows: fullRows.slice(0, 25),
};
let downloaded: Blob | undefined;
const write = vi.fn();
const print = vi.fn();
const close = vi.fn();

beforeEach(() => {
  downloaded = undefined;
  write.mockReset(); print.mockReset(); close.mockReset();
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  vi.spyOn(URL, 'createObjectURL').mockImplementation(blob => { downloaded = blob as Blob; return 'blob:report'; });
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  vi.spyOn(window, 'open').mockReturnValue({ document: { open: vi.fn(), write, close: vi.fn(), images: [] }, focus: vi.fn(), print, close } as unknown as Window);
});
afterEach(() => vi.restoreAllMocks());

for (const format of ['HTML', 'PDF']) {
  it(`${format} uses all resolved rows and freezes the report snapshot while loading`, async () => {
    let resolve!: (data: { columns: string[]; rows: typeof fullRows }) => void;
    const onBeforeExport = vi.fn(() => new Promise<{ columns: string[]; rows: typeof fullRows }>(done => { resolve = done; }));
    const view = render(<MatrixReportExportButton {...props} onBeforeExport={onBeforeExport} />);
    fireEvent.click(screen.getByRole('button', { name: `Report ${format}` }));
    expect(screen.getAllByRole('button').every(button => (button as HTMLButtonElement).disabled)).toBe(true);
    if (format === 'PDF') expect(window.open).toHaveBeenCalledTimes(1);
    view.rerender(<MatrixReportExportButton {...props} filters={{ device_name: 'changed' }} matrixSections={[]} onBeforeExport={onBeforeExport} />);
    resolve({ columns: props.tableColumns, rows: fullRows });
    await waitFor(() => expect(format === 'HTML' ? downloaded : print.mock.calls.length).toBeTruthy());
    const html = format === 'HTML' ? await downloaded!.text() : String(write.mock.calls[0][0]);
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = Array.from(doc.querySelectorAll('table')).at(-1)!.querySelectorAll('tbody tr');
    expect(rows.length).toBe(75);
    expect(rows[74].textContent).toContain('VK-75');
    expect(html).toContain('75 filtered case rows');
    expect(html).not.toContain('changed');
    for (const section of sections) expect(html).toContain(section.title);
  });

  it(`${format} stops on fetch failure instead of exporting the current page`, async () => {
    render(<MatrixReportExportButton {...props} onBeforeExport={async () => { throw new Error('network'); }} />);
    fireEvent.click(screen.getByRole('button', { name: `Report ${format}` }));
    await screen.findByRole('alert');
    expect(downloaded).toBeUndefined();
    expect(write).not.toHaveBeenCalled();
    if (format === 'PDF') expect(close).toHaveBeenCalled();
  });
}

it('exports an empty filtered result without falling back to visible rows', async () => {
  render(<MatrixReportExportButton {...props} onBeforeExport={async () => ({ columns: props.tableColumns, rows: [] })} />);
  fireEvent.click(screen.getByRole('button', { name: 'Report HTML' }));
  await waitFor(() => expect(downloaded).toBeDefined());
  const html = await downloaded!.text();
  expect(html).toContain('0 filtered case rows');
  expect(html).not.toContain('VK-1');
});
