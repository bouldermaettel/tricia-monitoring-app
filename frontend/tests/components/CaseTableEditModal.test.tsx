import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { CaseTable } from '../../src/components/matrix/CaseTable';

vi.mock('../../src/hooks/useCases', () => ({
  useCaseAuditTrail: () => ({ data: { items: [] }, isLoading: false, refetch: vi.fn() }),
}));

vi.mock('../../src/services/cases', () => ({
  downloadCaseAuditTrailXlsx: vi.fn(),
}));

describe('CaseTable edit modal', () => {
  it('groups TRI fields on the left and corresponding WIMI fields on the right', async () => {
    render(
      <CaseTable
        items={[{
          id: 'case-1',
          vk_number: 'VK-1',
          device_name: 'Device A',
          tricia_s: 3,
          tricia_p: 5,
          tricia_d: 10,
          user_s: 3,
          user_p: 5,
          user_d: 10,
        }]}
        onEditCase={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByTitle('Edit'));

    const dialog = await screen.findByRole('dialog', { name: 'case-edit-dialog' });
    const fieldColumns = dialog.querySelectorAll('section:first-child > div > div.space-y-3') as NodeListOf<HTMLElement>;

    await waitFor(() => expect(fieldColumns).toHaveLength(2));
    const labelText = (label: HTMLLabelElement) => label.childNodes[0].textContent?.trim();
    expect(Array.from(fieldColumns[0].querySelectorAll('label')).map(labelText)).toEqual([
      'TRI-S',
      'TRI-P',
      'TRI-D',
    ]);
    expect(Array.from(fieldColumns[1].querySelectorAll('label')).map(labelText)).toEqual([
      'WIMI-S',
      'WIMI-P',
      'WIMI-D',
    ]);

    expect(within(fieldColumns[0]).getByText('TRI-S')).toBeInTheDocument();
    expect(within(fieldColumns[1]).getByText('WIMI-S')).toBeInTheDocument();
  });
});
