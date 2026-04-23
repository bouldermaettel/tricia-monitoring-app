import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './auth';
import { InputDashboard } from '../pages/InputDashboard';
import { MatrixDashboard } from '../pages/MatrixDashboard';
import { ControlDashboard } from '../pages/ControlDashboard';
import { UserManagement } from '../pages/UserManagement';
import { LoginPage } from '../pages/LoginPage';
function ProtectedRoute({ children }) {
    const { session } = useAuth();
    if (!session) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    return children;
}
function AdminRoute({ children }) {
    const { session } = useAuth();
    if (!session) {
        return _jsx(Navigate, { to: "/login", replace: true });
    }
    if (session.role !== 'admin') {
        return _jsx(Navigate, { to: "/input", replace: true });
    }
    return children;
}
export function AppRouter() {
    const { session } = useAuth();
    return (_jsx(BrowserRouter, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(Navigate, { to: session ? '/input' : '/login', replace: true }) }), _jsx(Route, { path: "/login", element: _jsx(LoginPage, {}) }), _jsx(Route, { path: "/input", element: (_jsx(ProtectedRoute, { children: _jsx(InputDashboard, {}) })) }), _jsx(Route, { path: "/matrix", element: (_jsx(ProtectedRoute, { children: _jsx(MatrixDashboard, {}) })) }), _jsx(Route, { path: "/control", element: (_jsx(ProtectedRoute, { children: _jsx(ControlDashboard, {}) })) }), _jsx(Route, { path: "/users", element: (_jsx(AdminRoute, { children: _jsx(UserManagement, {}) })) })] }) }));
}
