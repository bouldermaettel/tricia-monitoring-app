import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { InputDashboard } from '../pages/InputDashboard';
import { MatrixDashboard } from '../pages/MatrixDashboard';
import { ControlDashboard } from '../pages/ControlDashboard';

export function AppRouter() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/input" replace />} />
        <Route path="/input" element={<InputDashboard />} />
        <Route path="/matrix" element={<MatrixDashboard />} />
        <Route path="/control" element={<ControlDashboard />} />
      </Routes>
    </BrowserRouter>
  );
}
