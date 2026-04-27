import { render, screen } from '@testing-library/react';
import { AppRouter } from '../../src/app/router';

const useAuthMock = vi.fn();

vi.mock('../../src/app/auth', () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock('../../src/pages/LoginPage', () => ({
  LoginPage: () => <div>Login Page</div>,
}));

vi.mock('../../src/pages/ChangePasswordPage', () => ({
  ChangePasswordPage: () => <div>Change Password Page</div>,
}));

vi.mock('../../src/pages/InputDashboard', () => ({
  InputDashboard: () => <div>Input Dashboard</div>,
}));

vi.mock('../../src/pages/MatrixDashboard', () => ({
  MatrixDashboard: () => <div>Matrix Dashboard</div>,
}));

vi.mock('../../src/pages/ControlDashboard', () => ({
  ControlDashboard: () => <div>Control Dashboard</div>,
}));

vi.mock('../../src/pages/UserManagement', () => ({
  UserManagement: () => <div>User Management Page</div>,
}));

describe('AppRouter password route', () => {
  beforeEach(() => {
    window.history.pushState({}, '', '/');
    useAuthMock.mockReset();
  });

  it('allows a signed-in user to visit change-password directly', () => {
    window.history.pushState({}, '', '/change-password');
    useAuthMock.mockReturnValue({
      session: {
        role: 'user',
        mustChangePassword: false,
      },
    });

    render(<AppRouter />);

    expect(screen.getByText('Change Password Page')).toBeInTheDocument();
  });

  it('forces a first-login user onto change-password', () => {
    window.history.pushState({}, '', '/input');
    useAuthMock.mockReturnValue({
      session: {
        role: 'user',
        mustChangePassword: true,
      },
    });

    render(<AppRouter />);

    expect(screen.getByText('Change Password Page')).toBeInTheDocument();
  });
});