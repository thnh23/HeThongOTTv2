import React, { useState, useEffect } from 'react';
import { NavLink, Link, useNavigate, useLocation } from 'react-router-dom';
import {
  Trophy,
  Swords,
  Upload,
  BookOpen,
  LogIn,
  LogOut,
  User as UserIcon,
  Sparkles,
  Menu,
  X,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { StarterKitModal } from '../StarterKitModal/index.js';
import './Navbar.css';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isStarterKitOpen, setIsStarterKitOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setMobileMenuOpen(false);
        setIsStarterKitOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <>
      <header className="navbar">
        <div className="navbar-container">
          <Link to="/" className="navbar-brand">
            <div className="brand-icon">⚔️</div>
            <span>OTTv2</span>
            <span className="brand-badge">UET 2026</span>
          </Link>

          {/* Desktop Nav */}
          <nav className="navbar-desktop-nav" aria-label="Điều hướng chính">
            <ul className="navbar-nav">
              <li>
                <NavLink to="/rules" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <BookOpen size={16} />
                  <span>Luật Chơi</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/leaderboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Trophy size={16} />
                  <span>Bảng Xếp Hạng</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/matches" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Swords size={16} />
                  <span>Trận Đấu</span>
                </NavLink>
              </li>
              <li>
                <NavLink to="/submit" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                  <Upload size={16} />
                  <span>Cổng Nộp Bài</span>
                </NavLink>
              </li>
              {user?.is_admin && (
                <li>
                  <NavLink
                    id="nav-admin-link"
                    to="/admin"
                    className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
                    style={{ color: 'var(--amber-400)' }}
                  >
                    <ShieldCheck size={16} color="var(--amber-400)" />
                    <span>Admin BTC</span>
                  </NavLink>
                </li>
              )}
            </ul>
          </nav>

          {/* Desktop Actions */}
          <div className="navbar-actions">
            <button
              id="btn-starter-kit"
              className="btn btn-starter-kit"
              onClick={() => setIsStarterKitOpen(true)}
              title="Xem và tải Bộ Khởi Động Bot (Starter Kit)"
            >
              <Sparkles size={15} color="var(--cyan-400)" />
              <span>Starter Kit</span>
            </button>

            {isAuthenticated ? (
              <div className="user-profile-group">
                <div className="user-badge" title={`Đang đăng nhập: ${user?.student_id || user?.email}`}>
                  <UserIcon size={14} color="var(--primary-400)" />
                  <span className="user-name">{user?.name}</span>
                  {user?.tier && (
                    <span className={`tier-pill tier-${user.tier}`}>
                      Bảng {user.tier}
                    </span>
                  )}
                </div>
                <button
                  id="btn-logout"
                  className="btn btn-outline btn-sm btn-logout"
                  onClick={handleLogout}
                  title="Đăng xuất"
                >
                  <LogOut size={15} />
                  <span className="logout-text">Thoát</span>
                </button>
              </div>
            ) : (
              <div className="guest-actions">
                <Link id="nav-login-btn" to="/login" className="btn btn-outline btn-sm">
                  <LogIn size={15} />
                  <span>Đăng Nhập</span>
                </Link>
                <Link id="nav-register-btn" to="/register" className="btn btn-primary btn-sm">
                  <span>Đăng Ký</span>
                </Link>
              </div>
            )}

            {/* Mobile Hamburger Button */}
            <button
              className="mobile-hamburger-btn"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Đóng menu' : 'Mở menu'}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Drawer */}
        {mobileMenuOpen && (
          <div className="mobile-drawer animate-fade-in" role="dialog" aria-modal="true">
            <nav className="mobile-nav-links">
              <NavLink to="/rules" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <BookOpen size={18} />
                <span>Luật Chơi (Rules)</span>
              </NavLink>
              <NavLink to="/leaderboard" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <Trophy size={18} />
                <span>Bảng Xếp Hạng (Leaderboard)</span>
              </NavLink>
              <NavLink to="/matches" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <Swords size={18} />
                <span>Trận Đấu & Trực Tiếp (Matches)</span>
              </NavLink>
              <NavLink to="/submit" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`}>
                <Upload size={18} />
                <span>Cổng Nộp Bài (Submission Portal)</span>
              </NavLink>
              {user?.is_admin && (
                <NavLink to="/admin" className={({ isActive }) => `mobile-nav-item ${isActive ? 'active' : ''}`} style={{ color: 'var(--amber-400)' }}>
                  <ShieldCheck size={18} color="var(--amber-400)" />
                  <span>Admin Ban Tổ Chức</span>
                </NavLink>
              )}
            </nav>

            <div className="mobile-drawer-footer">
              <button
                className="btn btn-starter-kit"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => {
                  setMobileMenuOpen(false);
                  setIsStarterKitOpen(true);
                }}
              >
                <Sparkles size={16} color="var(--cyan-400)" />
                <span>Bộ Khởi Động (Starter Kit .ZIP)</span>
              </button>

              {isAuthenticated ? (
                <button
                  className="btn btn-outline"
                  style={{ width: '100%', justifyContent: 'center', marginTop: '0.75rem' }}
                  onClick={handleLogout}
                >
                  <LogOut size={16} />
                  <span>Đăng Xuất ({user?.name})</span>
                </button>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
                  <Link to="/login" className="btn btn-outline" style={{ justifyContent: 'center' }}>
                    <LogIn size={15} />
                    <span>Đăng Nhập</span>
                  </Link>
                  <Link to="/register" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                    <span>Đăng Ký</span>
                  </Link>
                </div>
              )}
            </div>
          </div>
        )}
      </header>

      {/* Starter Kit Modal */}
      <StarterKitModal
        isOpen={isStarterKitOpen}
        onClose={() => setIsStarterKitOpen(false)}
      />
    </>
  );
}
