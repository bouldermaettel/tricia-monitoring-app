import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { InputDashboard } from '../../src/pages/InputDashboard';

const createMutateAsync = vi.fn().mockResolvedValue({ id: '1' });
const exportImportTemplateXlsx = vi.fn().mockResolvedValue(new Blob(['template']));

vi.mock('../../src/hooks/useCases', () => ({
  useCreateCase: () => ({ mutateAsync: createMutateAsync, isPending: false, isError: false }),
}));

vi.mock('../../src/services/exports', () => ({
  exportImportTemplateXlsx: () => exportImportTemplateXlsx(),
}));

describe('InputDashboard', () => {
  beforeEach(() => {
    createMutateAsync.mockClear();
    exportImportTemplateXlsx.mockClear();
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
    await user.click(screen.getByText('Save'));

    expect(createMutateAsync).toHaveBeenCalledWith({
      vk_number: 'Vk_20211123_023',
      device_name: 'Device-1',
      tricia_s: 1,
      tricia_p: 1,
      tricia_d: 1,
      user_s: 1,
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
      user_d: 5,
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
});
