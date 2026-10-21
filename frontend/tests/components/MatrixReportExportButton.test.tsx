import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MatrixReportExportButton } from '../../src/components/matrix/MatrixReportExportButton';

describe('MatrixReportExportButton', () => {
  it('uses pre-export rows so reports include all filtered pages', async () => {
    const write = vi.fn();
    const open = vi.fn();
    const close = vi.fn();
    const focus = vi.fn();
    const print = vi.fn();
    const onBeforeExport = vi.fn(async () => ({
      columns: ['vk_number'],
      rows: [{ vk_number: 'VK-1' }, { vk_number: 'VK-2' }],
    }));

    const printWindow = {
      document: {
        open,
        write,
        close,
        images: [],
      },
      focus,
      print,
    } as unknown as Window;

    const openSpy = vi.spyOn(window, 'open').mockReturnValue(printWindow);

    render(
      <MatrixReportExportButton
        fileNamePrefix="matrix-report"
        generatedAt="21.10.2026, 11:41:00"
        filters={{}}
        matrixSections={[]}
        tableColumns={['vk_number']}
        tableRows={[{ vk_number: 'VK-1' }]}
        onBeforeExport={onBeforeExport}
      />,
    );

    await userEvent.click(screen.getByRole('button', { name: 'Report PDF' }));

    await waitFor(() => {
      expect(onBeforeExport).toHaveBeenCalledWith(['vk_number'], [{ vk_number: 'VK-1' }]);
      expect(write).toHaveBeenCalledTimes(1);
      expect(write.mock.calls[0][0]).toContain('VK-2');
      expect(write.mock.calls[0][0]).toContain('2 filtered case rows');
      expect(print).toHaveBeenCalledTimes(1);
    });

    openSpy.mockRestore();
  });
});
