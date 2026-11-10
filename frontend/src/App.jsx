import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import LandingPage from './pages/Landing.jsx';
import LoginPage from './pages/Login.jsx';
import RegisterPage from './pages/Register.jsx';

// Dashboards are loaded on demand so the public pages (landing, sign-in, sign-up) stay light.
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard.jsx'));
const CargoDashboard = lazy(() => import('./pages/cargo/CargoDashboard.jsx'));
const CustomerDashboard = lazy(() => import('./pages/customer/CustomerDashboard.jsx'));

const dashboardFallback = <p className="empty-table" role="status" style={{ padding: 32 }}>Loading your dashboard…</p>;

export default function App() {
  return (
    <BrowserRouter>
      <Suspense fallback={dashboardFallback}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/customer/dashboard" element={<CustomerDashboard />} />
          <Route path="/cargo/dashboard" element={<CargoDashboard />} />
          <Route path="/" element={<LandingPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
