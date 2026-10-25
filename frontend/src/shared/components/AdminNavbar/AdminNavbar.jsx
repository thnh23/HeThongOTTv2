import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ShieldCheck, Eye, LogOut, Swords, Layers, ExternalLink } from 'lucide-react';
import { useAuth } from '@/shared/context/AuthContext.jsx';
import './AdminNavbar.css';

export function AdminNavbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="admin-navbar">
      <div className="admin-navbar-container">
        {/* Brand */}
        <div className="admin-navbar-brand-group">
          <Link to="/admin" className="admin-brand-link">
            <div className="admin-brand-icon">
              <ShieldCheck size={20} color="#000000" />
            </div>
            <div className="admin-brand-text">
              <span className="admin-brand-title">OTTv2</span>
              <span className="admin-brand-subtitle">ADMIN CONSOLE</span>
            </div>
          </Link>
          <span className="admin-badge-btc">BAN TỔ CHỨC</span>
        </div>

        {/* Center Tag / Admin Workflow */}
        <div className="admin-navbar-center">
          <span className="admin-system-tag">
            <Layers size={14} color="var(--amber-400)" />
            <span>HỆ THỐNG ĐIỀU HÀNH 4 GIAI ĐOẠN</span>
          </span>
        </div>

        {/* Right Actions */}
        <div className="admin-navbar-actions">
          {/* Switch to Regular User View */}
          <Link
            to="/"
            className="btn btn-student-view"
            title="Xem trang web dưới góc nhìn của Thí sinh / Khách"
          >
            <Eye size={15} />
            <span>Xem Trang Thí Sinh</span>
            <ExternalLink size={13} style={{ opacity: 0.7 }} />
          </Link>

          {/* Admin User Info */}
          <div className="admin-user-info" title={user?.email || 'Tài khoản Quản trị BTC'}>
            <span className="admin-user-dot" />
            <span className="admin-user-name">{user?.name || 'Ban Tổ Chức'}</span>
          </div>

          {/* Logout */}
          <button
            type="button"
            className="btn btn-admin-logout"
            onClick={handleLogout}
            title="Đăng xuất khỏi trang quản trị"
          >
            <LogOut size={15} />
            <span>Thoát</span>
          </button>
        </div>
      </div>
    </header>
  );
}
