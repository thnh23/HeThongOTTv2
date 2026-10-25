import React from 'react';
import { BrowserRouter, useLocation, Link } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/shared/context/AuthContext.jsx';
import { ToastProvider } from '@/shared/context/ToastContext.jsx';
import { Navbar } from '@/shared/components/Navbar/Navbar.jsx';
import { AdminNavbar } from '@/shared/components/AdminNavbar/index.js';
import { Footer } from '@/shared/components/Footer/Footer.jsx';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary/ErrorBoundary.jsx';
import { AppRouter } from '@/app/Router.jsx';
import '@/shared/styles/global.css';

function AppLayout() {
  const location = useLocation();
  const { user } = useAuth();
  const isAdminRoute = location.pathname.startsWith('/admin');

  // Dedicated Admin Layout (Only for authenticated Admins)
  if (isAdminRoute && user?.is_admin) {
    return (
      <div className="app-container admin-mode">
        <AdminNavbar />
        <main className="main-content admin-main">
          <AppRouter />
        </main>
        <footer className="admin-bottom-bar">
          <div className="admin-bottom-container">
            <span>© 2026 OTTv2 Ban Tổ Chức • Khoa CNTT, Đại học Công Nghệ (VNU-UET)</span>
            <span className="admin-build-badge">ADMIN CONSOLE v2.4</span>
          </div>
        </footer>
      </div>
    );
  }

  // Dedicated Public / Student Layout
  return (
    <div className="app-container">
      {user?.is_admin && (
        <aside className="admin-top-banner" aria-label="Thông báo chuyển đổi chế độ xem">
          <div className="admin-top-banner-content">
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span className="admin-banner-indicator" />
              <span>CHẾ ĐỘ QUẢN TRỊ: Bạn đang duyệt website ở góc nhìn Thí Sinh</span>
            </div>
            <Link to="/admin" className="admin-banner-link">
              Quay Lại Bảng Quản Trị BTC →
            </Link>
          </div>
        </aside>
      )}
      <Navbar />
      <main className="main-content">
        <AppRouter />
      </main>
      <Footer />
    </div>
  );
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <AppLayout />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
