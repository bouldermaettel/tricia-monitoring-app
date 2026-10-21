import { exportImportTemplateXlsx } from '../../src/services/exports';
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
});
