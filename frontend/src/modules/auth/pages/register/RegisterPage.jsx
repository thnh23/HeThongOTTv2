import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { UserPlus, AlertCircle, RefreshCw } from 'lucide-react';
import { useAuth } from '@/shared/context/AuthContext.jsx';
import { useToast } from '@/shared/context/ToastContext.jsx';
import '../login/LoginPage.css';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const { register } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      await register(name, email, password);
      showToast('Đăng ký tài khoản thành công! Bạn có thể nộp bài ngay.', 'success');
      navigate('/submit');
    } catch (err) {
      const msg = err.message || 'Lỗi khi đăng ký tài khoản';
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
            <UserPlus size={22} color="var(--primary-400)" />
          </div>
          <h1 className="auth-title">Đăng Ký Tham Gia</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Tạo tài khoản thí sinh để tham gia giải đấu OTTv2
          </p>
        </div>

        {error && (
          <div className="auth-error" role="alert" style={{ marginBottom: '1.25rem' }}>
            <AlertCircle size={16} color="var(--rose-500)" />
            <span>{error}</span>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="input-register-name" className="form-label">
              Họ và tên thí sinh
            </label>
            <input
              id="input-register-name"
              type="text"
              required
              className="form-input"
              placeholder="Nguyễn Văn A"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoComplete="name"
            />
          </div>

          <div className="form-group">
            <label htmlFor="input-register-email" className="form-label">
              Email sinh viên / trường
            </label>
            <input
              id="input-register-email"
              type="email"
              required
              className="form-input"
              placeholder="a.nguyen@student.vnu.edu.vn"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label htmlFor="input-register-password" className="form-label">
              Mật khẩu (ít nhất 6 ký tự)
            </label>
            <input
              id="input-register-password"
              type="password"
              required
              minLength={6}
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>

          <button
            id="btn-submit-register"
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
            disabled={isLoading}
          >
            {isLoading ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Đang tạo tài khoản...</span>
              </>
            ) : (
              <span>Tạo Tài Khoản Dự Thi</span>
            )}
          </button>
        </form>

        <div className="auth-footer">
          Đã có tài khoản?{' '}
          <Link to="/login">Đăng nhập</Link>
        </div>
      </div>
    </div>
  );
}
