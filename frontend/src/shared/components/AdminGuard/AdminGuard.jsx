import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldAlert, LogIn, Home, RefreshCw, LogOut } from 'lucide-react';
import { useAuth } from '@/shared/context/AuthContext.jsx';
import './AdminGuard.css';

export function AdminGuard({ children }) {
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const navigate = useNavigate();

  if (isLoading) {
    return (
      <div className="admin-guard-container">
        <div className="admin-guard-card">
          <RefreshCw size={36} className="admin-guard-spinner" />
          <h2 className="admin-guard-title">ĐANG KIỂM TRA QUYỀN HẠN...</h2>
          <p className="admin-guard-text">Hệ thống đang xác thực danh tính Ban Tổ Chức.</p>
        </div>
      </div>
    );
  }

  // Case 1: Chưa đăng nhập
  if (!isAuthenticated) {
    return (
      <div className="admin-guard-container">
        <div className="admin-guard-card">
          <div className="admin-guard-icon-box warn">
            <ShieldAlert size={44} color="#F59E0B" />
          </div>
          <span className="admin-guard-pill warn">YÊU CẦU XÁC THỰC BTC</span>
          <h1 className="admin-guard-title">KHU VỰC QUẢN TRỊ BẢO MẬT</h1>
          <p className="admin-guard-text">
            Trang này chỉ dành riêng cho Ban Tổ Chức giải đấu OTTv2 để điều hành bốc thăm Swiss, nhập dữ liệu và chấm bài.
          </p>
          <div className="admin-guard-actions">
            <Link to="/login?mode=admin" className="btn btn-primary">
              <LogIn size={16} />
              <span>Đăng Nhập Tài Khoản Admin</span>
            </Link>
            <Link to="/" className="btn btn-outline">
              <Home size={16} />
              <span>Quay Lại Cổng Thí Sinh</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Case 2: Đã đăng nhập nhưng không phải Admin (Thí sinh thường)
  if (!user?.is_admin) {
    return (
      <div className="admin-guard-container">
        <div className="admin-guard-card">
          <div className="admin-guard-icon-box danger">
            <ShieldAlert size={44} color="#EF4444" />
          </div>
          <span className="admin-guard-pill danger">MÃ LỖI 403: CẤM TRUY CẬP</span>
          <h1 className="admin-guard-title">BẠN KHÔNG CÓ QUYỀN QUẢN TRỊ</h1>
          <p className="admin-guard-text">
            Bạn đang đăng nhập dưới tư cách <strong>Thí Sinh</strong>: <code>{user?.email || user?.name}</code>.
            Giao diện này chỉ dành riêng cho Ban Giám Khảo &amp; Ban Tổ Chức.
          </p>
          <div className="admin-guard-actions">
            <Link to="/" className="btn btn-primary">
              <Home size={16} />
              <span>Về Trang Chủ Thí Sinh</span>
            </Link>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => {
                logout();
                navigate('/login?mode=admin');
              }}
            >
              <LogOut size={16} />
              <span>Đăng Xuất &amp; Đổi Tài Khoản</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Case 3: Là Admin hợp lệ -> Render trang Admin
  return <>{children}</>;
}
