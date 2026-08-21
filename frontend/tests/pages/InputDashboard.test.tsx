import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useImportOverride } from '../../src/state/importOverride';
import { InputDashboard } from '../../src/pages/InputDashboard';

const createMutateAsync = vi.fn().mockResolvedValue({ id: '1' });
const exportImportTemplateXlsx = vi.fn().mockResolvedValue(new Blob(['template']));
const previewImport = vi.fn();
const uploadImport = vi.fn();

vi.mock('../../src/hooks/useCases', () => ({
  useCreateCase: () => ({ mutateAsync: createMutateAsync, isPending: false, isError: false }),
}));

vi.mock('../../src/services/exports', () => ({
  exportImportTemplateXlsx: () => exportImportTemplateXlsx(),
}));

vi.mock('../../src/services/imports', () => ({
  previewImport: (file: File) => previewImport(file),
  uploadImport: (file: File, duplicateAction?: 'error' | 'replace' | 'skip') => uploadImport(file, duplicateAction),
}));

vi.mock('../../src/app/auth', () => ({
  useAuth: () => ({
    session: {
      token: 'token',
      refreshToken: 'refresh',
      tokenType: 'bearer',
      expiresAt: Date.now() + 60_000,
      refreshExpiresAt: Date.now() + 120_000,
      actorId: 'user-1',
      externalKey: 'user-1',
      acronym: 'mam',
      displayName: 'Max Mustermann',
      role: 'user',
      mustChangePassword: false,
    },
    signIn: vi.fn(),
    updateSession: vi.fn(),
    signOut: vi.fn(),
  }),
}));

describe('InputDashboard', () => {
  beforeEach(() => {
    createMutateAsync.mockClear();
    exportImportTemplateXlsx.mockClear();
    previewImport.mockReset();
    uploadImport.mockReset();
    useImportOverride.getState().clearPreviewData();
    if (!('createObjectURL' in URL)) {
      Object.defineProperty(URL, 'createObjectURL', {
        writable: true,
        value: vi.fn(() => 'blob:template'),
      });
    } else {
      vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:template');
    }
    if (!('revokeObjectURL' in URL)) {
      Object.defineProperty(URL, 'revokeObjectURL', {
        writable: true,
        value: vi.fn(),
      });
    } else {
      vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    }
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders a single save control', () => {
    const client = new QueryClient();
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InputDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByText('Input Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Save')).toBeInTheDocument();
  });

  it('saves directly when the save button is pressed', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InputDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText('vk-number'), 'Vk_20211123_023');
    await user.type(screen.getByLabelText('device-name'), 'Device-1');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    expect(createMutateAsync).toHaveBeenCalledWith({
      vk_number: 'Vk_20211123_023',
      device_name: 'Device-1',
      tricia_s: 1,
      tricia_p: 1,
      tricia_d: 1,
      user_s: 1,
      user_p: 1,
      user_d: 1,
      validation_status: 'saved',
    });
    expect(screen.getByText('Case saved. Form cleared — ready for next entry.')).toBeInTheDocument();
  });

  it('allows only discrete category selections for S, D, and P', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InputDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const selects = screen.getAllByRole('combobox');

    await user.type(screen.getByLabelText('vk-number'), 'Vk_20211123_023');
    await user.type(screen.getByLabelText('device-name'), 'Device-1');
    await user.selectOptions(selects[0], '8');
    await user.selectOptions(selects[1], '5');
    await user.selectOptions(selects[2], '10');
    await user.selectOptions(selects[3], '10');
    await user.selectOptions(selects[4], '5');
    await user.click(screen.getByText('Save'));

    expect(createMutateAsync).toHaveBeenCalledWith({
      vk_number: 'Vk_20211123_023',
      device_name: 'Device-1',
      tricia_s: 8,
      tricia_p: 5,
      tricia_d: 10,
      user_s: 10,
      user_p: 5,
      user_d: 10,
      validation_status: 'saved',
    });
  });

  it('shows warning modal and blocks save when VK number format is invalid', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InputDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText('vk-number'), 'Vk_20240523_01');
    await user.type(screen.getByLabelText('device-name'), 'Device-1');
    await user.click(screen.getByText('Save'));

    expect(screen.getByRole('dialog', { name: 'invalid-vk-format-dialog' })).toBeInTheDocument();
    expect(screen.getByText('Incorrect VK-NR format')).toBeInTheDocument();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('shows warning modal and blocks save when VK number has an invalid coded date', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InputDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText('vk-number'), 'Vk_20251503_001');
    await user.type(screen.getByLabelText('device-name'), 'Device-1');
    await user.click(screen.getByText('Save'));

    expect(screen.getByRole('dialog', { name: 'invalid-vk-format-dialog' })).toBeInTheDocument();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('shows duplicate dialog when backend returns wrapped duplicate error message', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();

    createMutateAsync.mockRejectedValueOnce({
      response: {
        data: {
          error: { message: 'Duplicate vk_number' },
        },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InputDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText('vk-number'), 'Vk_20211115_001');
    await user.type(screen.getByLabelText('device-name'), 'Device-1');
    await user.click(screen.getByText('Save'));

    expect(screen.getByRole('dialog', { name: 'duplicate-dialog' })).toBeInTheDocument();
    expect(screen.queryByText('Save failed. Check the VK number format and required fields.')).not.toBeInTheDocument();
  });

  it('shows duplicate dialog on HTTP 409 even without explicit message payload', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();

    createMutateAsync.mockRejectedValueOnce({
      response: {
        status: 409,
        data: {},
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InputDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText('vk-number'), 'Vk_20211115_001');
    await user.type(screen.getByLabelText('device-name'), 'Device-1');
    await user.click(screen.getByText('Save'));

    expect(screen.getByRole('dialog', { name: 'duplicate-dialog' })).toBeInTheDocument();
    expect(screen.queryByText('Save failed. Check the VK number format and required fields.')).not.toBeInTheDocument();
  });

  it('downloads an empty upload template from the input tab upload controls', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InputDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.click(screen.getByRole('button', { name: 'Download template' }));

    expect(exportImportTemplateXlsx).toHaveBeenCalledTimes(1);
  });

  it('shows an upload validation modal with the backend message', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();

    previewImport.mockRejectedValueOnce({
      response: {
        data: {
          detail: "Row 2: column 'TRI-S' must be one of [1, 3, 5, 8, 10].",
        },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InputDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const file = new File(['vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D'], 'bad.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('import-file'), file);
    await user.click(screen.getByRole('button', { name: 'Analyze only' }));

    const dialog = await screen.findByRole('dialog', { name: 'import-error-dialog' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("Row 2: column 'TRI-S' must be one of [1, 3, 5, 8, 10].")).toBeInTheDocument();
  });

  it('shows missing-column errors returned in backend error.message payloads', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();

    previewImport.mockRejectedValueOnce({
      response: {
        data: {
          error: {
            message: 'Invalid import file format (missing columns: wimi-d)',
          },
        },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InputDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const file = new File(['vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S'], 'missing-column.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('import-file'), file);
    await user.click(screen.getByRole('button', { name: 'Analyze only' }));

    const dialog = await screen.findByRole('dialog', { name: 'import-error-dialog' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Invalid import file format (missing columns: wimi-d)')).toBeInTheDocument();
  });

  it('shows all duplicate VK numbers returned by the backend', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();

    previewImport.mockRejectedValueOnce({
      response: {
        data: {
          error: {
            message: "VK-NR 'Vk_20240523_911' is already in the database.\nVK-NR 'Vk_20240523_912' is already in the database.",
          },
        },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InputDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const file = new File(['vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D'], 'duplicate.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('import-file'), file);
    await user.click(screen.getByRole('button', { name: 'Analyze only' }));

    const dialog = await screen.findByRole('dialog', { name: 'import-error-dialog' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText("VK-NR 'Vk_20240523_911' is already in the database.")).toBeInTheDocument();
    expect(within(dialog).getByText("VK-NR 'Vk_20240523_912' is already in the database.")).toBeInTheDocument();
  });

  it('asks for duplicate resolution and retries import with skip', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();

    uploadImport
      .mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            detail: {
              code: 'duplicate_vk_conflict',
              duplicates: ['Vk_20240523_001'],
            },
          },
        },
      })
      .mockResolvedValueOnce({
        imported_rows: 3,
        total_rows: 4,
        skipped_rows: 1,
        replaced_rows: 0,
      });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InputDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const file = new File(['vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D'], 'duplicate.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('import-file'), file);
    await user.click(screen.getByRole('button', { name: 'Import' }));

    const dialog = await screen.findByRole('dialog', { name: 'import-duplicate-dialog' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Vk_20240523_001')).toBeInTheDocument();

    await user.click(within(dialog).getByRole('button', { name: 'Skip existing, only import new cases' }));

    expect(uploadImport).toHaveBeenNthCalledWith(1, file, 'error');
    expect(uploadImport).toHaveBeenNthCalledWith(2, file, 'skip');
    expect(await screen.findByText('Imported 3 of 4 rows from duplicate.csv (1 skipped).')).toBeInTheDocument();
  });

  it('asks for duplicate resolution and retries import with replace', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();

    uploadImport
      .mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            detail: {
              code: 'duplicate_vk_conflict',
              duplicates: ['Vk_20240523_001'],
            },
          },
        },
      })
      .mockResolvedValueOnce({
        imported_rows: 4,
        total_rows: 4,
        skipped_rows: 0,
        replaced_rows: 1,
      });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InputDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const file = new File(['vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D'], 'duplicate.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('import-file'), file);
    await user.click(screen.getByRole('button', { name: 'Import' }));

    const dialog = await screen.findByRole('dialog', { name: 'import-duplicate-dialog' });
    await user.click(within(dialog).getByRole('button', { name: 'Overwrite existing' }));

    expect(uploadImport).toHaveBeenNthCalledWith(1, file, 'error');
    expect(uploadImport).toHaveBeenNthCalledWith(2, file, 'replace');
    expect(await screen.findByText('Imported 4 of 4 rows from duplicate.csv (1 replaced).')).toBeInTheDocument();
  });

  it('opens duplicate chooser from legacy duplicate validation message', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();

    uploadImport.mockRejectedValueOnce({
      response: {
        status: 422,
        data: {
          error: {
            message: "VK-NR 'Vk_20240523_001' is already in the database.",
          },
        },
      },
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InputDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    const file = new File(['vk_number,device_name,TRI-S,TRI-P,TRI-D,WIMI-S,WIMI-D'], 'duplicate.csv', { type: 'text/csv' });
    await user.upload(screen.getByLabelText('import-file'), file);
    await user.click(screen.getByRole('button', { name: 'Import' }));

    const dialog = await screen.findByRole('dialog', { name: 'import-duplicate-dialog' });
    expect(dialog).toBeInTheDocument();
    expect(within(dialog).getByText('Vk_20240523_001')).toBeInTheDocument();
  });

  it('uses the signed-in acronym for preview-import save entries', async () => {
    const user = userEvent.setup();
    const client = new QueryClient();

    useImportOverride.getState().setPreviewData({
      sourceFileName: 'sample.csv',
      sourceFile: new File(['csv'], 'sample.csv', { type: 'text/csv' }),
      cases: [],
      controlItems: [],
    });

    render(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <InputDashboard />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await user.type(screen.getByLabelText('vk-number'), 'Vk_20211123_023');
    await user.type(screen.getByLabelText('device-name'), 'Device-1');
    await user.click(screen.getByText('Save to analysis'));

    const state = useImportOverride.getState();
    expect(state.cases[0]?.wimi_shortcut).toBe('mam');
    expect(state.controlItems[0]?.wimi_shortcut).toBe('mam');
    expect(state.controlItems[0]?.user_id).toBe('mam');
  });
});
