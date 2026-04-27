import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ChangePasswordPage } from '../../src/pages/ChangePasswordPage';

const navigateMock = vi.fn();
const signOutMock = vi.fn();
const updateSessionMock = vi.fn();

const useAuthMock = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../src/app/auth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../src/services/auth', () => ({
  changePassword: vi.fn(),
}));

describe('ChangePasswordPage', () => {
  beforeEach(() => {
    navigateMock.mockReset();
    signOutMock.mockReset();
    updateSessionMock.mockReset();
    useAuthMock.mockReset();
  });

  it('navigates back on cancel for a regular signed-in user', async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({
      session: {
        role: 'user',
        mustChangePassword: false,
      },
      updateSession: updateSessionMock,
      signOut: signOutMock,
    });

    render(
      <MemoryRouter>
        <ChangePasswordPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(navigateMock).toHaveBeenCalledWith('/input', { replace: true });
    expect(signOutMock).not.toHaveBeenCalled();
  });

  it('signs out on cancel when the user must change password first', async () => {
    const user = userEvent.setup();
    useAuthMock.mockReturnValue({
      session: {
        role: 'admin',
        mustChangePassword: true,
      },
      updateSession: updateSessionMock,
      signOut: signOutMock,
    });

    render(
      <MemoryRouter>
        <ChangePasswordPage />
      </MemoryRouter>
    );

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(signOutMock).toHaveBeenCalled();
    expect(navigateMock).not.toHaveBeenCalled();
  });
});