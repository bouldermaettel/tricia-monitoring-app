import { exportImportTemplateXlsx, getExportColumnName } from '../../src/services/exports';
import { apiClient } from '../../src/services/api';

vi.mock('../../src/services/api', () => ({
  apiClient: {
    post: vi.fn().mockResolvedValue({ data: new Blob(['template']) }),
    get: vi.fn(),
  },
}));

describe('exportImportTemplateXlsx', () => {
  it('requests the reduced canonical import template columns', async () => {
    await exportImportTemplateXlsx();

    expect(apiClient.post).toHaveBeenCalledWith(
      '/exports/table.xlsx',
      {
        columns: ['vk_number', 'device_name', 'TRI-S', 'TRI-P', 'TRI-D', 'WIMI-S', 'WIMI-D'],
        rows: [],
      },
      { responseType: 'blob' },
    );
  });

  it('maps matrix export fields to the same canonical names used by the template', () => {
    expect(getExportColumnName('vk_number')).toBe('vk_number');
    expect(getExportColumnName('device_name')).toBe('device_name');
    expect(getExportColumnName('tricia_s')).toBe('TRI-S');
    expect(getExportColumnName('tricia_p')).toBe('TRI-P');
    expect(getExportColumnName('tricia_d')).toBe('TRI-D');
    expect(getExportColumnName('user_s')).toBe('WIMI-S');
    expect(getExportColumnName('user_d')).toBe('WIMI-D');
  });
});
