import { render, waitFor } from '@testing-library/react';
import { CaseTable } from '../../src/components/matrix/CaseTable';

vi.mock('../../src/hooks/useCases', () => ({
  useCaseAuditTrail: () => ({ data: { items: [] }, isLoading: false }),
}));

vi.mock('../../src/services/cases', () => ({
  downloadCaseAuditTrailXlsx: vi.fn(),
}));

describe('CaseTable export state', () => {
  it('maps overlapping matrix export fields to the shared canonical names', async () => {
    const onExportStateChange = vi.fn();

    render(
      <CaseTable
        items={[
          {
            id: 'case-1',
            vk_number: 'VK-1',
            wimi_shortcut: 'mam',
            date_reported: '2026-06-01',
            device_name: 'Device A',
            tricia_p: 5,
            tricia_s: 3,
            user_s: 3,
            tricia_d: 10,
            user_d: 10,
            category_code: 'monitor',
            is_excluded: false,
            is_reviewed: true,
            comment_text: 'ready',
            has_edits: false,
          },
        ]}
        onExportStateChange={onExportStateChange}
      />,
    );

    await waitFor(() => {
      expect(onExportStateChange).toHaveBeenCalled();
    });

    const lastPayload = onExportStateChange.mock.calls.at(-1)?.[0];
    expect(lastPayload).toBeDefined();

    expect(lastPayload.columns).toEqual(
      expect.arrayContaining(['vk_number', 'device_name', 'TRI-S', 'TRI-P', 'TRI-D', 'WIMI-S', 'WIMI-D']),
    );
    expect(lastPayload.columns).not.toEqual(expect.arrayContaining(['tricia_s', 'tricia_p', 'tricia_d', 'user_s', 'user_d']));

    expect(lastPayload.rows[0]).toMatchObject({
      vk_number: 'VK-1',
      device_name: 'Device A',
      'TRI-S': 3,
      'TRI-P': 5,
      'TRI-D': 10,
      'WIMI-S': 3,
      'WIMI-D': 10,
      _case_id: 'case-1',
    });
  });
});
