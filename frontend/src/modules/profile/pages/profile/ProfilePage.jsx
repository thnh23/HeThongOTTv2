import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  User,
  Award,
  Trophy,
  Swords,
  Upload,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  PlayCircle,
  FileCode,
  ShieldCheck,
  Calendar,
  Sparkles,
  ArrowRight,
  TrendingUp,
  LogIn,
  Check,
  X,
  GitBranch,
  Edit3,
  Key,
  BookOpen,
  Cpu,
  ExternalLink,
  Lock,
  Info,
  Radio,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { useAuth } from '@/shared/context/AuthContext.jsx';
import { useToast } from '@/shared/context/ToastContext.jsx';
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge.jsx';
import './ProfilePage.css';

export function ProfilePage() {
  const { user, isAuthenticated, isLoading: isAuthLoading, reloadUser, updateProfile, changePassword } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('matches'); // 'matches' | 'submissions' | 'rules'
  const [matchFilter, setMatchFilter] = useState('all'); // 'all' | 'win' | 'draw' | 'loss' | 'finals'
  const [matchHistory, setMatchHistory] = useState([]);
  const [submissionHistory, setSubmissionHistory] = useState([]);
  const [tierStanding, setTierStanding] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  // Edit Profile / Change Password Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState('profile'); // 'profile' | 'password'
  const [isSaving, setIsSaving] = useState(false);
  const [profileForm, setProfileForm] = useState({
    name: '',
    student_id: '',
    class_name: '',
    bot_name: '',
    github_repo_url: '',
  });
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: '',
  });

  const loadUserData = async () => {
    if (!user?.id) return;
    setIsLoadingData(true);
    try {
      const [matchesRes, subsRes, standingsRes] = await Promise.allSettled([
        apiClient.get(`/leaderboard/${user.id}/history`),
        apiClient.get('/submit/history'),
        apiClient.get('/leaderboard'),
      ]);

      if (matchesRes.status === 'fulfilled') {
        setMatchHistory(matchesRes.value || []);
      }
      if (subsRes.status === 'fulfilled') {
        setSubmissionHistory(subsRes.value || []);
      }
      if (standingsRes.status === 'fulfilled' && Array.isArray(standingsRes.value)) {
        const myStanding = standingsRes.value.find((s) => s.user_id === user.id);
        setTierStanding(myStanding || null);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingData(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      loadUserData();
      setProfileForm({
        name: user.name || '',
        student_id: user.student_id || '',
        class_name: user.class_name || '',
        bot_name: user.bot_name || '',
        github_repo_url: user.github_repo_url || '',
      });
    }
  }, [isAuthenticated, user?.id]);

  // Statistics calculation
  const matchStats = useMemo(() => {
    if (tierStanding) {
      return {
        played: tierStanding.matches_played,
        wins: tierStanding.wins,
        draws: tierStanding.draws,
        losses: tierStanding.losses,
        points: tierStanding.points,
        winRate: tierStanding.win_rate,
        rank: tierStanding.rank,
      };
    }
    const played = matchHistory.length;
    const wins = matchHistory.filter((m) => m.result === 'win').length;
    const draws = matchHistory.filter((m) => m.result === 'draw').length;
    const losses = matchHistory.filter((m) => m.result === 'loss').length;
    const points = wins * 3 + draws * 1;
    const winRate = played > 0 ? ((wins / played) * 100).toFixed(1) : '0.0';
    return { played, wins, draws, losses, points, winRate, rank: '-' };
  }, [tierStanding, matchHistory]);

  const activeSubmission = useMemo(() => {
    return submissionHistory.find((s) => s.is_active) || submissionHistory[0] || null;
  }, [submissionHistory]);

  // Projected grade based on Swiss tournament performance & Top 32
  const projectedGrade = useMemo(() => {
    if (user?.projected_grade_10) return user.projected_grade_10;
    if (user?.is_top32) return '10.0 (A+)';
    const wins = user?.swiss_wins || matchStats.wins || 0;
    if (wins >= 10) return '9.5 (A+)';
    if (wins >= 8) return '9.0 (A)';
    if (wins >= 6) return '8.5 (B+)';
    if (wins >= 4) return '7.5 (B)';
    return '6.5 – 7.0 (C+/B)';
  }, [user, matchStats.wins]);

  const gradeRating = useMemo(() => {
    if (user?.is_top32) return { label: 'Top 32 Chung Kết (A+)', color: 'var(--amber-400)' };
    const wins = user?.swiss_wins || matchStats.wins || 0;
    if (wins >= 10) return { label: 'Xuất Sắc (9.5)', color: 'var(--emerald-400)' };
    if (wins >= 8) return { label: 'Giỏi (9.0)', color: 'var(--cyan-400)' };
    if (wins >= 6) return { label: 'Khá Giỏi (8.5)', color: 'var(--primary-400)' };
    if (wins >= 4) return { label: 'Khá (7.5)', color: 'var(--amber-400)' };
    return { label: 'Đạt Chuẩn (6.5 – 7.0)', color: 'var(--text-muted)' };
  }, [user, matchStats.wins]);

  // Filtered match history
  const filteredMatches = useMemo(() => {
    if (matchFilter === 'all') return matchHistory;
    if (matchFilter === 'finals') {
      return matchHistory.filter(
        (m) =>
          m.round_label?.toLowerCase().includes('chung kết') ||
          /^(R32_|R16_|QF_|SF_|FINAL_)/.test(m.match_id || '')
      );
    }
    return matchHistory.filter((m) => m.result === matchFilter);
  }, [matchHistory, matchFilter]);

  // Handle Save Profile
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (updateProfile) {
        await updateProfile(profileForm);
      } else {
        await apiClient.put('/auth/profile', profileForm);
        if (reloadUser) await reloadUser();
      }
      showToast('Cập nhật thông tin hồ sơ thành công!', 'success');
      setIsModalOpen(false);
    } catch (err) {
      showToast(err.message || 'Không thể cập nhật hồ sơ', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Change Password
  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      showToast('Mật khẩu xác nhận không khớp!', 'error');
      return;
    }
    if (passwordForm.new_password.length < 6) {
      showToast('Mật khẩu mới phải có tối thiểu 6 ký tự!', 'error');
      return;
    }
    setIsSaving(true);
    try {
      if (changePassword) {
        await changePassword(passwordForm.old_password, passwordForm.new_password);
      } else {
        await apiClient.post('/auth/change-password', {
          old_password: passwordForm.old_password,
          new_password: passwordForm.new_password,
        });
      }
      showToast('Đổi mật khẩu thành công!', 'success');
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' });
      setIsModalOpen(false);
    } catch (err) {
      showToast(err.message || 'Không thể đổi mật khẩu', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="profile-page animate-fade-in" style={{ textAlign: 'center', padding: '4rem' }}>
        <RefreshCw size={28} className="animate-spin" style={{ color: 'var(--cyan-400)', margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Đang tải thông tin cá nhân...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="profile-page animate-fade-in">
        <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1.5rem', maxWidth: '580px', margin: '2rem auto' }}>
          <User size={48} color="var(--primary-400)" style={{ margin: '0 auto 1rem' }} />
          <h2 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>Yêu Cầu Đăng Nhập</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.25rem', lineHeight: 1.6 }}>
            Vui lòng đăng nhập bằng tài khoản sinh viên UET để xem hồ sơ cá nhân, kết quả phân hạng, lịch sử thi đấu và điểm tổng kết.
          </p>
          <div style={{ background: 'var(--bg-surface-elevated)', border: '1px dashed var(--border-bright)', padding: '0.65rem 0.85rem', marginBottom: '1.5rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            💡 Tài khoản được cấp tự động từ Google Form nộp bài. Tên đăng nhập &amp; mật khẩu mặc định là <strong>MSSV</strong>.
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link to="/login" className="btn btn-primary">
              <LogIn size={16} />
              <span>Đăng Nhập Ngay</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const isTop32 = Boolean(user?.is_top32);

  return (
    <div className="profile-page animate-fade-in">
      {/* Profile Header Card */}
      <div className={`glass-card profile-hero-card ${isTop32 ? 'hero-top32' : ''}`}>
        <div className="profile-hero-content">
          <div className="profile-avatar-wrap">
            <div className={`profile-avatar-circle ${isTop32 ? 'avatar-gold' : ''}`}>
              <span className="profile-avatar-emoji">
                {isTop32 ? <Trophy size={32} color="var(--amber-400)" /> : <Swords size={28} color="var(--cyan-400)" />}
              </span>
            </div>
            <span className={`profile-tier-badge ${isTop32 ? 'tier-top32' : 'tier-A'}`}>
              {isTop32 ? '🏆 HẠT GIỐNG TOP 32' : '⚔️ 13 VÒNG SWISS'}
            </span>
          </div>

          <div className="profile-identity">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 className="profile-name">{user?.name}</h1>
              {user?.is_admin && (
                <span className="admin-pill">
                  <ShieldCheck size={13} />
                  <span>Ban Tổ Chức (Admin)</span>
                </span>
              )}
              {isTop32 && (
                <span className="gold-pill">
                  <Sparkles size={13} />
                  <span>Chung Kết BO2</span>
                </span>
              )}
            </div>

            <p className="profile-email">
              <code>{user?.email}</code>
            </p>

            {/* Academic & Bot Identity Tags */}
            <div className="profile-meta-tags">
              <span className="profile-meta-item">
                <User size={14} color="var(--primary-400)" />
                <span>MSSV: <strong>{user?.student_id || 'Chưa cập nhật'}</strong></span>
              </span>
              <span className="profile-meta-item">
                <BookOpen size={14} color="var(--purple-400)" />
                <span>Lớp: <strong>{user?.class_name || 'INT3304 (Lập trình mạng)'}</strong></span>
              </span>
              <span className="profile-meta-item">
                <Cpu size={14} color="var(--cyan-400)" />
                <span>Tên Bot: <strong>{user?.bot_name || 'Bot_' + (user?.name || '').replace(/\s+/g, '_')}</strong></span>
              </span>
              {user?.github_repo_url ? (
                <a
                  href={user.github_repo_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="profile-meta-item profile-repo-link"
                  title="Mở repository GitHub của thí sinh"
                >
                  <GitBranch size={14} />
                  <span>{user.github_repo_url.replace(/^https?:\/\/github\.com\//, '')}</span>
                  <ExternalLink size={11} />
                </a>
              ) : (
                <span className="profile-meta-item text-muted">
                  <GitBranch size={14} />
                  <span>Chưa cấu hình Repo GitHub</span>
                </span>
              )}
            </div>

            {/* Integrity & Code Audit Indicators */}
            <div className="profile-audit-tags">
              <span className={`audit-badge ${user?.commit_count >= 4 ? 'audit-pass' : 'audit-warn'}`} title="Yêu cầu tối thiểu 4 commits trong quá trình phát triển">
                <GitBranch size={12} />
                <span>{user?.commit_count || 0} commits Git</span>
              </span>
              <span className="audit-badge audit-neutral" title="Tỷ lệ trùng lặp mã nguồn theo thuật toán MOSS AST">
                <ShieldCheck size={12} />
                <span>MOSS AST: {user?.moss_similarity ? `${user.moss_similarity}%` : '0.0%'}</span>
              </span>
              <span className="audit-badge audit-neutral">
                <Calendar size={12} />
                <span>Gia nhập: {user?.registered_at ? new Date(user.registered_at).toLocaleDateString('vi-VN') : 'Kỳ thi 2026'}</span>
              </span>
            </div>
          </div>
        </div>

        <div className="profile-hero-actions">
          <button
            id="btn-profile-edit"
            className="btn btn-primary btn-sm"
            onClick={() => {
              setProfileForm({
                name: user?.name || '',
                student_id: user?.student_id || '',
                class_name: user?.class_name || '',
                bot_name: user?.bot_name || '',
                github_repo_url: user?.github_repo_url || '',
              });
              setModalTab('profile');
              setIsModalOpen(true);
            }}
          >
            <Edit3 size={14} />
            <span>Chỉnh Sửa Hồ Sơ</span>
          </button>
          <button
            id="btn-profile-refresh"
            className="btn btn-outline btn-sm"
            onClick={() => {
              loadUserData();
              if (reloadUser) reloadUser();
            }}
            disabled={isLoadingData}
            title="Làm mới dữ liệu hồ sơ"
          >
            <RefreshCw size={14} className={isLoadingData ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
          <Link to="/submit" className="btn btn-outline btn-sm">
            <Upload size={14} />
            <span>Cổng Nộp Bot</span>
          </Link>
          <Link to="/sandbox" className="btn btn-outline btn-sm">
            <Cpu size={14} />
            <span>Đấu Thử Sandbox</span>
          </Link>
        </div>
      </div>

      {/* Special Top 32 Qualification Callout */}
      {isTop32 && (
        <div className="glass-card top32-qualified-banner animate-slide-down">
          <div className="top32-banner-header">
            <Trophy size={28} className="gold-text" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--amber-400)' }}>
                Chúc mừng bạn đã xuất sắc lọt vào Vòng Chung Kết Top 32!
              </h3>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Bạn được bảo lưu mức điểm học phần tối đa <strong>10.0 (A+)</strong>. Theo đúng quy chế, bạn có <strong>01 tuần làm việc độc lập</strong> để nghiên cứu bản đồ Ô chướng ngại vật, nâng cấp giải thuật tìm đường và nộp phiên bản <strong>"Bot v2"</strong> thi đấu đối kháng BO2 đổi phe.
              </p>
            </div>
          </div>
          <div className="top32-banner-actions">
            <Link to="/matches?round_num=finals" className="btn btn-primary btn-sm">
              <Swords size={14} />
              <span>Xem Cây Nhánh Top 32</span>
            </Link>
            <Link to="/sandbox" className="btn btn-outline btn-sm" style={{ borderColor: 'var(--amber-500)', color: 'var(--amber-400)' }}>
              <Cpu size={14} />
              <span>Môi Trường Thử Nghiệm Ô Cản</span>
            </Link>
          </div>
        </div>
      )}

      {/* Performance & Scores Grid */}
      <div className="profile-metrics-grid">
        {/* Tournament Performance Stats */}
        <div className="glass-card metric-panel">
          <div className="metric-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Trophy size={18} color="var(--amber-400)" />
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Thành Tích 13 Vòng Swiss</h3>
            </div>
            <Link to="/leaderboard" className="view-all-link">
              <span>Xem BXH</span>
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="stats-kpi-row">
            <div className="kpi-box">
              <span className="kpi-label">Thứ Hạng</span>
              <span className="kpi-value gold-text">
                {matchStats.rank !== '-' ? `#${matchStats.rank}` : '#-'}
              </span>
            </div>
            <div className="kpi-box">
              <span className="kpi-label">Tổng Điểm</span>
              <span className="kpi-value cyan-text">{matchStats.points} pts</span>
            </div>
            <div className="kpi-box">
              <span className="kpi-label">Tỉ Lệ Thắng</span>
              <span className="kpi-value emerald-text">{matchStats.winRate}%</span>
            </div>
          </div>

          <div className="match-record-breakdown">
            <div className="record-chip win-chip">
              <strong>{matchStats.wins}</strong> Thắng (+3đ)
            </div>
            <div className="record-chip draw-chip">
              <strong>{matchStats.draws}</strong> Hòa (+1đ)
            </div>
            <div className="record-chip loss-chip">
              <strong>{matchStats.losses}</strong> Thua (0đ)
            </div>
          </div>
        </div>

        {/* Official Swiss Tournament Achievement & Projected Grade */}
        <div className="glass-card metric-panel grade-panel">
          <div className="metric-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={18} color="var(--amber-400)" />
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Điểm Học Phần Đề Xuất (Swiss)</h3>
            </div>
            <span className="grade-rating-pill" style={{ color: gradeRating.color }}>
              ● {gradeRating.label}
            </span>
          </div>

          <div className="composite-score-row">
            <div>
              <span className="composite-label">Điểm Dự Phóng Học Phần UET</span>
              <div className="composite-number-wrap">
                <span className="composite-number">{projectedGrade}</span>
                <span className="composite-max">/ 10</span>
              </div>
            </div>
            <div className="tier-weights-indicator">
              <span>Tiêu chuẩn xếp loại:</span>
              <code>Lũy tiến theo số trận thắng 13 vòng Swiss &amp; Top 32</code>
            </div>
          </div>

          <div className="sub-scores-bars">
            <div className="sub-score-item">
              <div className="sub-score-info">
                <span>1. Số trận thắng Swiss</span>
                <strong>{user?.swiss_wins || matchStats.wins || 0} / 13 vòng</strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill cyan-fill"
                  style={{ width: `${Math.min(100, (((user?.swiss_wins || matchStats.wins || 0) / 13) * 100))}%` }}
                ></div>
              </div>
            </div>

            <div className="sub-score-item">
              <div className="sub-score-info">
                <span>2. Điểm tích lũy Swiss</span>
                <strong>{user?.swiss_points || matchStats.points || 0} pts</strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill purple-fill"
                  style={{ width: `${Math.min(100, (((user?.swiss_points || matchStats.points || 0) / 39) * 100))}%` }}
                ></div>
              </div>
            </div>

            <div className="sub-score-item">
              <div className="sub-score-info">
                <span>3. Hệ số Buchholz Cut-1</span>
                <strong>{user?.buchholz || 0}</strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill emerald-fill"
                  style={{ width: `${Math.min(100, (user?.buchholz || 0))}%` }}
                ></div>
              </div>
            </div>

            <div className="sub-score-item">
              <div className="sub-score-info">
                <span>4. Hệ số Sonneborn-Berger</span>
                <strong>{user?.sonneborn_berger || 0}</strong>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill amber-fill"
                  style={{ width: `${Math.min(100, (user?.sonneborn_berger || 0))}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation: Matches History vs Submissions vs Tournament Rules */}
      <div className="profile-tabs-wrap">
        <button
          className={`profile-tab-btn ${activeTab === 'matches' ? 'active' : ''}`}
          onClick={() => setActiveTab('matches')}
        >
          <Swords size={16} />
          <span>Lịch Sử Trận Đấu ({matchHistory.length})</span>
        </button>
        <button
          className={`profile-tab-btn ${activeTab === 'submissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('submissions')}
        >
          <Upload size={16} />
          <span>Lịch Sử Nộp Bài ({submissionHistory.length})</span>
        </button>
        <button
          className={`profile-tab-btn ${activeTab === 'rules' ? 'active' : ''}`}
          onClick={() => setActiveTab('rules')}
        >
          <BookOpen size={16} />
          <span>Quy Chế Điểm &amp; Lộ Trình</span>
        </button>
      </div>

      {/* Tab 1 Content: Matches History */}
      {activeTab === 'matches' && (
        <div className="tab-pane animate-fade-in">
          {/* Sub-filter Bar for matches */}
          <div className="match-subfilter-bar">
            {[
              { id: 'all', label: `Tất cả (${matchHistory.length})` },
              { id: 'win', label: `Chiến thắng (${matchHistory.filter((m) => m.result === 'win').length})` },
              { id: 'draw', label: `Hòa cờ (${matchHistory.filter((m) => m.result === 'draw').length})` },
              { id: 'loss', label: `Thất bại (${matchHistory.filter((m) => m.result === 'loss').length})` },
              {
                id: 'finals',
                label: `Chung kết (${
                  matchHistory.filter(
                    (m) =>
                      m.round_label?.toLowerCase().includes('chung kết') ||
                      /^(R32_|R16_|QF_|SF_|FINAL_)/.test(m.match_id || '')
                  ).length
                })`,
              },
            ].map((f) => (
              <button
                key={f.id}
                className={`filter-tab-btn ${matchFilter === f.id ? 'active' : ''}`}
                onClick={() => setMatchFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {filteredMatches.length === 0 ? (
            <div className="glass-card empty-tab-card">
              <Swords size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
              <h4>Không tìm thấy trận đấu nào phù hợp</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '480px', margin: '0.5rem auto 1.5rem' }}>
                {matchFilter === 'all'
                  ? 'Khi Ban tổ chức khởi chạy các vòng đấu Swiss, các trận đấu của bot bạn sẽ tự động xuất hiện tại đây.'
                  : 'Không có trận đấu nào khớp với bộ lọc đã chọn.'}
              </p>
              {matchFilter !== 'all' ? (
                <button className="btn btn-outline btn-sm" onClick={() => setMatchFilter('all')}>
                  <span>Xem tất cả trận đấu</span>
                </button>
              ) : (
                <Link to="/matches" className="btn btn-outline btn-sm">
                  <span>Khám phá các trận đấu khác</span>
                </Link>
              )}
            </div>
          ) : (
            <div className="profile-matches-list">
              {filteredMatches.map((m) => {
                const isFinals =
                  m.round_label?.toLowerCase().includes('chung kết') ||
                  /^(R32_|R16_|QF_|SF_|FINAL_)/.test(m.match_id || '');

                return (
                  <div key={m.match_id} className={`glass-card match-history-card ${isFinals ? 'match-finals-card' : ''}`}>
                    <div className="match-history-main">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className={`result-tag result-${m.result}`}>
                          {m.result === 'win' ? 'CHIẾN THẮNG (+3Đ)' : m.result === 'loss' ? 'THẤT BẠI (0Đ)' : 'HÒA CỜ (+1Đ)'}
                        </span>
                        <span className={`round-tag ${isFinals ? 'round-tag-finals' : ''}`}>
                          {m.round_label || 'Vòng Swiss'}
                        </span>
                        <span className="history-match-id">{m.match_id}</span>
                      </div>

                      <div className="match-players-flow">
                        <span className="side-badge">
                          Phe:{' '}
                          <strong style={{ color: m.played_as === 'White' ? '#FFFFFF' : 'var(--cyan-400)' }}>
                            {m.played_as === 'White' ? 'Trắng (W)' : 'Đen (B)'}
                          </strong>
                        </span>
                        <span className="vs-sign">vs</span>
                        <span className="opponent-name">
                          Đối thủ: <strong>{m.opponent_name}</strong>
                        </span>
                      </div>

                      <div className="match-specs">
                        <StatusBadge status={m.end_code || 'done'} />
                        <span className="spec-item">
                          <Clock size={13} />
                          <span>{m.total_moves} nước</span>
                        </span>
                        {m.played_at && (
                          <span className="spec-item">
                            <span>
                              {new Date(m.played_at).toLocaleTimeString('vi-VN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                          </span>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <Link
                        id={`btn-profile-replay-${m.match_id}`}
                        to={`/matches/${m.match_id}`}
                        className="btn btn-outline btn-sm btn-replay"
                      >
                        <PlayCircle size={15} />
                        <span>Xem Replay</span>
                      </Link>
                      <Link
                        to={`/matches/${m.match_id}/live`}
                        className="btn btn-outline btn-xs"
                        title="Xem lại giao diện phát sóng Live"
                      >
                        <Radio size={13} />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 2 Content: Submissions History */}
      {activeTab === 'submissions' && (
        <div className="tab-pane animate-fade-in">
          {submissionHistory.length === 0 ? (
            <div className="glass-card empty-tab-card">
              <Upload size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
              <h4>Bạn chưa nộp gói bài thi nào</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '480px', margin: '0.5rem auto 1.5rem' }}>
                Chuẩn bị gói nén <code>.ZIP</code> gồm <code>bot.py</code>, <code>REPORT.md</code> và <code>git_log.txt</code> (hoặc đường link GitHub repo) để nộp bài.
              </p>
              <Link to="/submit" className="btn btn-primary btn-sm">
                <Upload size={14} />
                <span>Đến Cổng Nộp Bài Ngay</span>
              </Link>
            </div>
          ) : (
            <div className="profile-subs-list">
              {submissionHistory.map((s) => {
                const isValid = s.status === 'valid' || s.is_valid;
                const v = s.validation || {};
                return (
                  <div key={s.id} className={`glass-card sub-card ${s.is_active ? 'sub-active' : ''}`}>
                    <div className="sub-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                        <span className={`sub-status-pill ${isValid ? 'valid' : 'invalid'}`}>
                          {isValid ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                          <span>{isValid ? 'Hợp Lệ (T08/T09)' : 'Chưa Hợp Lệ'}</span>
                        </span>
                        {s.is_active && (
                          <span className="active-sub-tag">
                            ⭐ Gói thi đấu chính thức
                          </span>
                        )}
                        {s.github_url && (
                          <a
                            href={s.github_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="sub-repo-link"
                          >
                            <GitBranch size={13} />
                            <span>{s.github_url.replace(/^https?:\/\/github\.com\//, '')}</span>
                          </a>
                        )}
                      </div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Nộp lúc: {new Date(s.submitted_at).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    {/* File validation checklist */}
                    <div className="sub-checklist-chips">
                      <span className={`file-chip ${v.bot_py ? 'ok' : 'fail'}`}>
                        {v.bot_py ? <Check size={12} /> : <X size={12} />} bot.py
                      </span>
                      <span className={`file-chip ${v.choose_move_fn ? 'ok' : 'fail'}`}>
                        {v.choose_move_fn ? <Check size={12} /> : <X size={12} />} choose_move(state)
                      </span>
                      <span className={`file-chip ${v.report_md ? 'ok' : 'fail'}`}>
                        {v.report_md ? <Check size={12} /> : <X size={12} />} REPORT.md (Ý Tưởng)
                      </span>
                      <span className={`file-chip ${v.git_log ? 'ok' : 'fail'}`}>
                        {v.git_log ? <Check size={12} /> : <X size={12} />} Git History (≥4 commits)
                      </span>
                    </div>

                    {/* Test run summary if available */}
                    {s.test_run_result && (
                      <div className="sub-testrun-box">
                        <span style={{ fontWeight: 600, color: 'var(--cyan-400)', fontSize: '0.85rem' }}>
                          Kết quả đấu thử Sandbox (GreedyBot):
                        </span>
                        <span style={{ fontSize: '0.85rem', color: '#fff', marginLeft: '0.5rem' }}>
                          Trạng thái: <strong>{s.test_run_result.status}</strong> • Mã: {s.test_run_result.end_code} • {s.test_run_result.moves || s.test_run_result.total_moves || 0} nước
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Tab 3 Content: Official Grading Policy & Roadmap */}
      {activeTab === 'rules' && (
        <div className="tab-pane animate-fade-in">
          <div className="glass-card rules-card">
            <h3 style={{ margin: 0, fontSize: '1.25rem', color: 'var(--primary-400)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BookOpen size={20} />
              <span>Thang Điểm Học Phần &amp; Tiêu Chuẩn Xếp Loại UET</span>
            </h3>
            <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '1.25rem', lineHeight: 1.6 }}>
              Áp dụng theo quy chế thi môn Lập trình mạng (INT3304) — Trường Đại học Công nghệ, ĐHQGHN. Điểm môn học được lũy tiến theo số trận thắng qua 13 vòng Swiss và thành tích tại Vòng Chung Kết Top 32.
            </p>

            <div className="rules-table-wrap">
              <table className="rules-table">
                <thead>
                  <tr>
                    <th>Số trận thắng Swiss</th>
                    <th>Điểm Hệ 10</th>
                    <th>Điểm Chữ UET</th>
                    <th>Ý Nghĩa Học Vụ &amp; Trình Độ Heuristic</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>Dưới 4 thắng (thi đấu đủ 13 vòng)</strong></td>
                    <td><strong className="cyan-text">6.5 – 7.0</strong></td>
                    <td><strong>C+ / B</strong></td>
                    <td>Điểm sàn: Hoàn thành đúng hạn, tuân thủ liêm chính &amp; thi đấu nghiêm túc</td>
                  </tr>
                  <tr>
                    <td><strong>4 – 5 trận thắng</strong></td>
                    <td><strong className="cyan-text">7.5</strong></td>
                    <td><strong>B</strong></td>
                    <td>Đạt yêu cầu môn học, bot có heuristic kiểm soát bàn cờ cơ bản</td>
                  </tr>
                  <tr>
                    <td><strong>6 – 7 trận thắng</strong></td>
                    <td><strong className="cyan-text">8.0 – 8.5</strong></td>
                    <td><strong>B+ / A</strong></td>
                    <td>Khá giỏi: Bot có Minimax cắt tỉa Alpha-Beta và chiến thuật tốt</td>
                  </tr>
                  <tr>
                    <td><strong>8 – 9 trận thắng</strong></td>
                    <td><strong className="cyan-text">9.0</strong></td>
                    <td><strong>A</strong></td>
                    <td>Xuất sắc: Kiểm soát 4 ô góc (W2), cơ chế lật quân sâu và tối ưu thời gian</td>
                  </tr>
                  <tr>
                    <td><strong>10 – 11 trận thắng</strong></td>
                    <td><strong className="emerald-text">9.5</strong></td>
                    <td><strong>A+</strong></td>
                    <td>Đỉnh cao: Thuật toán có chiều sâu, đánh bại hầu hết đối thủ trong toàn khóa</td>
                  </tr>
                  <tr className="row-top32">
                    <td><strong>🏆 Lọt vào Top 32</strong></td>
                    <td><strong className="gold-text">10.0 Tối đa</strong></td>
                    <td><strong className="gold-text">A+</strong></td>
                    <td>Điểm 10 tuyệt đối + Vinh danh bảng vàng UET + Thi đấu Vòng Chung Kết BO2</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="rules-notes-box">
              <h4 style={{ margin: '0 0 0.5rem', fontSize: '0.95rem', color: 'var(--amber-400)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Info size={16} />
                <span>Tiêu chuẩn liêm chính học thuật &amp; Xác thực tác quyền:</span>
              </h4>
              <ul style={{ margin: 0, paddingLeft: '1.25rem', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: 1.7 }}>
                <li><strong>Git History:</strong> Bắt buộc có tối thiểu 4 commits ghi nhận tiến độ phát triển để chứng minh sinh viên tự viết mã nguồn.</li>
                <li><strong>MOSS AST:</strong> Hệ thống kiểm tra chống sao chép cấu trúc mã nguồn. Tỷ lệ tương đồng an toàn là dưới 30%.</li>
                <li><strong>Phỏng vấn vấn đáp Top 32:</strong> 32 thí sinh lọt vào vòng Chung kết sẽ có buổi phỏng vấn 5 phút trước Hội đồng Chấm thi để giải thích thuật toán trước khi công nhận kết quả trao giải.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Edit Profile & Change Password Modal */}
      {isModalOpen && (
        <div className="modal-backdrop animate-fade-in" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content glass-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                {modalTab === 'profile' ? <Edit3 size={18} color="var(--primary-400)" /> : <Key size={18} color="var(--amber-400)" />}
                <h3 style={{ margin: 0, fontSize: '1.15rem' }}>
                  {modalTab === 'profile' ? 'Cập Nhật Thông Tin Cá Nhân' : 'Đổi Mật Khẩu'}
                </h3>
              </div>
              <button className="modal-close-btn" onClick={() => setIsModalOpen(false)} aria-label="Đóng">
                <X size={18} />
              </button>
            </div>

            {/* Modal Tab Switcher */}
            <div className="modal-tabs">
              <button
                className={`modal-tab-btn ${modalTab === 'profile' ? 'active' : ''}`}
                onClick={() => setModalTab('profile')}
              >
                <User size={14} />
                <span>Hồ Sơ Sinh Viên</span>
              </button>
              <button
                className={`modal-tab-btn ${modalTab === 'password' ? 'active' : ''}`}
                onClick={() => setModalTab('password')}
              >
                <Lock size={14} />
                <span>Đổi Mật Khẩu</span>
              </button>
            </div>

            {modalTab === 'profile' ? (
              <form onSubmit={handleSaveProfile} className="modal-form">
                <div className="form-group">
                  <label>Họ và Tên Thí Sinh</label>
                  <input
                    type="text"
                    required
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                    placeholder="Nguyễn Văn A"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Mã Số Sinh Viên (MSSV)</label>
                    <input
                      type="text"
                      value={profileForm.student_id}
                      onChange={(e) => setProfileForm({ ...profileForm, student_id: e.target.value })}
                      placeholder="2202xxxx"
                    />
                  </div>
                  <div className="form-group">
                    <label>Lớp Khóa Học</label>
                    <input
                      type="text"
                      value={profileForm.class_name}
                      onChange={(e) => setProfileForm({ ...profileForm, class_name: e.target.value })}
                      placeholder="INT3304 2"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Tên Bot Thi Đấu</label>
                  <input
                    type="text"
                    value={profileForm.bot_name}
                    onChange={(e) => setProfileForm({ ...profileForm, bot_name: e.target.value })}
                    placeholder="AlphaOtt_v2"
                  />
                </div>

                <div className="form-group">
                  <label>Đường Link GitHub Repository</label>
                  <input
                    type="url"
                    value={profileForm.github_repo_url}
                    onChange={(e) => setProfileForm({ ...profileForm, github_repo_url: e.target.value })}
                    placeholder="https://github.com/username/ottv2-bot"
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    Repo công khai hoặc đã cấp quyền cho tài khoản máy chấm BTC.
                  </small>
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setIsModalOpen(false)}>
                    <span>Hủy</span>
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={isSaving}>
                    {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Check size={14} />}
                    <span>{isSaving ? 'Đang lưu...' : 'Lưu Thay Đổi'}</span>
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleChangePassword} className="modal-form">
                <div className="form-group">
                  <label>Mật Khẩu Hiện Tại</label>
                  <input
                    type="password"
                    required
                    value={passwordForm.old_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, old_password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>

                <div className="form-group">
                  <label>Mật Khẩu Mới (Tối thiểu 6 ký tự)</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.new_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>

                <div className="form-group">
                  <label>Xác Nhận Mật Khẩu Mới</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={passwordForm.confirm_password}
                    onChange={(e) => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                    placeholder="••••••••"
                  />
                </div>

                <div className="modal-actions">
                  <button type="button" className="btn btn-outline btn-sm" onClick={() => setIsModalOpen(false)}>
                    <span>Hủy</span>
                  </button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={isSaving}>
                    {isSaving ? <RefreshCw size={14} className="animate-spin" /> : <Lock size={14} />}
                    <span>{isSaving ? 'Đang cập nhật...' : 'Đổi Mật Khẩu'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
