import { ReactElement } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { InputDashboard } from '../pages/InputDashboard';
import { MatrixDashboard } from '../pages/MatrixDashboard';
import { ControlDashboard } from '../pages/ControlDashboard';
import { UserManagement } from '../pages/UserManagement';
import { LoginPage } from '../pages/LoginPage';
import { ChangePasswordPage } from '../pages/ChangePasswordPage';

function getDefaultRoute(session: { role: string; mustChangePassword: boolean } | null): string {
  if (!session) return '/login';
  if (session.mustChangePassword) return '/change-password';
  return '/input';
}

function ProtectedRoute({ children }: { children: ReactElement }) {
  const { session } = useAuth();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (session.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  return children;
}

function AdminRoute({ children }: { children: ReactElement }) {
  const { session } = useAuth();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  if (session.role !== 'admin') {
    return <Navigate to="/input" replace />;
  }
  if (session.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }
  return children;
}

function PasswordChangeRoute({ children }: { children: ReactElement }) {
  const { session } = useAuth();
  if (!session) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export function AppRouter() {
  const { session } = useAuth();

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to={getDefaultRoute(session)} replace />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/change-password"
          element={(
            <PasswordChangeRoute>
              <ChangePasswordPage />
            </PasswordChangeRoute>
          )}
        />
        <Route
          path="/input"
          element={(
            <ProtectedRoute>
              <InputDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/matrix"
          element={(
            <ProtectedRoute>
              <MatrixDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/control"
          element={(
            <ProtectedRoute>
              <ControlDashboard />
            </ProtectedRoute>
          )}
        />
        <Route
          path="/users"
          element={(
            <AdminRoute>
              <UserManagement />
            </AdminRoute>
          )}
        />
      </Routes>
    </BrowserRouter>
  );
}
