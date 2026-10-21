import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogIn, AlertCircle, RefreshCw, Zap } from 'lucide-react';
import { useAuth } from '@/shared/context/AuthContext.jsx';
import { useToast } from '@/shared/context/ToastContext.jsx';
import './LoginPage.css';

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { login } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleQuickFill = () => {
    setEmail('studentA@uet.vnu.edu.vn');
    setPassword('pass123');
    showToast('Đã điền tài khoản mẫu Sinh viên UET!', 'info');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await login(email, password);
      showToast('Đăng nhập thành công! Chào mừng bạn.', 'success');
      navigate('/submit');
    } catch (err) {
      const msg = err.message || 'Email hoặc mật khẩu không chính xác';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="auth-page animate-fade-in">
      <div className="glass-card auth-card">
        <div className="auth-header">
          <div className="auth-icon-badge">
            <LogIn size={22} color="var(--primary-400)" />
          </div>
          <h1 className="auth-title">Đăng Nhập Thí Sinh</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Chào mừng trở lại với đấu trường cờ AI OTTv2
          </p>
        </div>

        {/* Quick Fill for easy testing & demo */}
        <div className="quick-fill-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.825rem', color: 'var(--cyan-400)', fontWeight: 600 }}>
            <Zap size={14} />
            <span>Tài khoản kiểm thử nhanh (Demo):</span>
          </div>
          <button
            type="button"
            className="btn btn-outline btn-xs"
            onClick={handleQuickFill}
            style={{ width: '100%', justifyContent: 'center', marginTop: '0.4rem' }}
          >
            Điền mẫu: <code>studentA@uet.vnu.edu.vn</code>
          </button>
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
              Email sinh viên / trường
            </label>
            <input
              id="input-login-email"
              type="email"
              required
              className="form-input"
              placeholder="ten@student.vnu.edu.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="input-login-password" className="form-label">
              Mật khẩu
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
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Đang xử lý đăng nhập...</span>
              </>
            ) : (
              <span>Đăng Nhập</span>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Chưa có tài khoản?{' '}
          <Link to="/register">Đăng ký tham gia ngay</Link>
        </div>
      </div>
    </div>
  );
}
