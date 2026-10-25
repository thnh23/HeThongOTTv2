import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { LogIn, AlertCircle, RefreshCw, Zap, Swords, ShieldCheck, Info } from 'lucide-react';
import { useAuth } from '@/shared/context/AuthContext.jsx';
import { useToast } from '@/shared/context/ToastContext.jsx';
import './LoginPage.css';

export function LoginPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialMode = searchParams.get('mode') === 'admin' ? 'admin' : 'student';
  const [loginRole, setLoginRole] = useState(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  // Đồng bộ tab khi URL thay đổi (ví dụ: truy cập /login?mode=admin)
  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'admin') {
      setLoginRole('admin');
    } else {
      setLoginRole('student');
    }
  }, [searchParams]);

  const handleSwitchRole = (newRole) => {
    if (newRole === loginRole) return;
    setLoginRole(newRole);
    setError(null);
    setEmail('');
    setPassword('');
    if (newRole === 'admin') {
      setSearchParams({ mode: 'admin' });
    } else {
      setSearchParams({});
    }
  };

  const handleQuickFillStudent = () => {
    setEmail('22021118');
    setPassword('22021118');
    showToast('Đã điền tài khoản mẫu Thí sinh (MSSV: 22021118)!', 'info');
  };

  const handleQuickFillAdmin = () => {
    setEmail('admin@uet.vnu.edu.vn');
    setPassword('admin123');
    showToast('Đã điền tài khoản Quản trị BTC (Admin)!', 'info');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const userData = await login(email, password);
      showToast('Đăng nhập thành công! Chào mừng bạn.', 'success');
      if (userData?.is_admin) {
        navigate('/admin');
      } else {
        navigate('/profile');
      }
    } catch (err) {
      const msg = err.message || 'Mã sinh viên hoặc mật khẩu không chính xác';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const isAdminTab = loginRole === 'admin';

  return (
    <div className="auth-page animate-fade-in">
      <div className="glass-card auth-card">
        {/* Role Switcher Tabs */}
        <div className="auth-role-tabs login-role-tabs" role="tablist">
          <button
            type="button"
            id="tab-login-student"
            role="tab"
            aria-selected={!isAdminTab}
            className={`auth-role-tab role-tab-btn ${!isAdminTab ? 'active' : ''}`}
            onClick={() => handleSwitchRole('student')}
          >
            <Swords size={18} />
            <span>Thí Sinh UET</span>
          </button>
          <button
            type="button"
            id="tab-login-admin"
            role="tab"
            aria-selected={isAdminTab}
            className={`auth-role-tab role-tab-btn ${isAdminTab ? 'active admin-active admin' : ''}`}
            onClick={() => handleSwitchRole('admin')}
          >
            <ShieldCheck size={18} />
            <span>Ban Tổ Chức (Admin)</span>
          </button>
        </div>

        <div className="auth-header">
          <div className="auth-icon-wrap" style={isAdminTab ? { borderColor: '#F59E0B' } : {}}>
            {isAdminTab ? (
              <ShieldCheck size={28} color="#F59E0B" />
            ) : (
              <LogIn size={28} color="var(--primary-400)" />
            )}
          </div>
          <h2>{isAdminTab ? 'Cổng Quản Trị Giải Đấu' : 'Đăng Nhập Thí Sinh'}</h2>
          <p>
            {isAdminTab
              ? 'Hệ thống điều phối 13 vòng Swiss & Vòng Chung Kết Top 32'
              : 'Đăng nhập để xem lịch sử đấu, kết quả thẩm định và cập nhật hồ sơ cá nhân'}
          </p>

          {/* Quick-fill helper box */}
          <div className="quick-fill-box" style={{ marginTop: '0.75rem' }}>
            <span className="quick-fill-label">
              <Zap size={13} />
              Tài khoản mẫu:
            </span>
            {isAdminTab ? (
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={handleQuickFillAdmin}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Điền nhanh Admin: <code>admin123</code> (admin@uet.vnu.edu.vn)
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={handleQuickFillStudent}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                Điền mẫu Thí sinh: <code>22021118</code> / Mật khẩu: <code>22021118</code>
              </button>
            )}
          </div>
        </div>

        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: '1.25rem' }}>
            <AlertCircle size={16} color="var(--rose-500)" />
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="input-login-email" className="form-label">
              {isAdminTab ? 'Email Ban Tổ Chức' : 'Mã sinh viên (MSSV) hoặc Email VNU'}
            </label>
            <input
              id="input-login-email"
              type="text"
              required
              className="form-input"
              placeholder={isAdminTab ? 'admin@uet.vnu.edu.vn' : '2202xxxx hoặc email@vnu.edu.vn'}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="input-login-password" className="form-label">
              Mật khẩu {isAdminTab ? 'Quản trị' : '(Mặc định là MSSV)'}
            </label>
            <input
              id="input-login-password"
              type="password"
              required
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          <button
            id="btn-submit-login"
            type="submit"
            className="btn btn-primary"
            style={{
              width: '100%',
              marginTop: '0.5rem',
              ...(isAdminTab ? { background: '#F59E0B', color: '#000000', borderColor: '#000000' } : {}),
            }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Đang xử lý đăng nhập...</span>
              </>
            ) : (
              <span>{isAdminTab ? 'Đăng Nhập Quản Trị Viên BTC' : 'Đăng Nhập Thí Sinh'}</span>
            )}
          </button>
        </form>

        <div className="auth-footer">
          {isAdminTab ? (
            <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              Khu vực bảo mật dành riêng cho Giám Khảo &amp; Ban Tổ Chức OTTv2
            </span>
          ) : (
            <div
              style={{
                background: 'var(--bg-surface-elevated)',
                border: '1.5px dashed var(--border-bright)',
                padding: '0.75rem 0.9rem',
                textAlign: 'left',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem' }}>
                <Info size={16} color="var(--primary-400)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  <span style={{ color: 'var(--text-primary)', fontWeight: 700 }}>Thông tin tài khoản thí sinh:</span>
                  <div style={{ marginTop: '0.25rem' }}>
                    Tài khoản được cấp tự động từ biểu mẫu Google Form nộp bài của BTC.<br />
                    • <strong>Tên đăng nhập:</strong> Mã sinh viên (MSSV) hoặc Email VNU<br />
                    • <strong>Mật khẩu khởi tạo:</strong> Mã sinh viên (MSSV)<br />
                    <em>(Sau khi đăng nhập, thí sinh có thể vào tab Profile để đổi mật khẩu cá nhân)</em>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
