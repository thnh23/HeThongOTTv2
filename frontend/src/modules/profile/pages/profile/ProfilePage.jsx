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
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { useAuth } from '@/shared/context/AuthContext.jsx';
import { useToast } from '@/shared/context/ToastContext.jsx';
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge.jsx';
import './ProfilePage.css';

const TOURNAMENT_WEIGHTS = { bot: 40, ai: 20, interview: 25, report: 15 };

export function ProfilePage() {
  const { user, isAuthenticated, isLoading: isAuthLoading } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('matches'); // 'matches' | 'submissions'
  const [matchHistory, setMatchHistory] = useState([]);
  const [submissionHistory, setSubmissionHistory] = useState([]);
  const [tierStanding, setTierStanding] = useState(null);
  const [isLoadingData, setIsLoadingData] = useState(true);

  const weights = TOURNAMENT_WEIGHTS;

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

  // Rating badge based on final score
  const finalScore = user?.final_score ?? 0;
  const gradeRating = useMemo(() => {
    if (finalScore >= 90) return { label: 'Xuất Sắc', color: 'var(--emerald-400)' };
    if (finalScore >= 80) return { label: 'Giỏi', color: 'var(--cyan-400)' };
    if (finalScore >= 70) return { label: 'Khá', color: 'var(--primary-400)' };
    if (finalScore >= 50) return { label: 'Đạt', color: 'var(--amber-400)' };
    return { label: 'Đang Chấm', color: 'var(--text-muted)' };
  }, [finalScore]);

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
          <p style={{ color: 'var(--text-secondary)', marginBottom: '1.75rem', lineHeight: 1.6 }}>
            Vui lòng đăng nhập bằng tài khoản sinh viên UET để xem hồ sơ cá nhân, kết quả phân hạng, lịch sử thi đấu và điểm tổng kết.
          </p>
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <Link to="/login" className="btn btn-primary">
              <LogIn size={16} />
              <span>Đăng Nhập Ngay</span>
            </Link>
            <Link to="/register" className="btn btn-outline">
              <span>Đăng Ký Tài Khoản</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="profile-page animate-fade-in">
      {/* Profile Header Card */}
      <div className="glass-card profile-hero-card">
        <div className="profile-hero-content">
          <div className="profile-avatar-wrap">
            <div className="profile-avatar-circle">
              <span className="profile-avatar-emoji">
                ⚔️
              </span>
            </div>
            <span className="profile-tier-badge tier-A">13 Vòng Swiss</span>
          </div>

          <div className="profile-identity">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <h1 className="profile-name">{user?.name}</h1>
              {user?.is_admin && (
                <span className="admin-pill">
                  <ShieldCheck size={13} />
                  <span>Ban Tổ Chức</span>
                </span>
              )}
            </div>
            <p className="profile-email">
              <code>{user?.email}</code>
            </p>
            <div className="profile-meta-tags">
              <span className="profile-meta-item">
                <Calendar size={14} />
                <span>Gia nhập: {new Date(user?.registered_at).toLocaleDateString('vi-VN')}</span>
              </span>
              <span className="profile-meta-item">
                <Sparkles size={14} color="var(--cyan-400)" />
                <span>
                  Điểm Test Đầu Vào:{' '}
                  <strong style={{ color: '#fff' }}>
                    {user?.test_score !== null && user?.test_score !== undefined ? `${user.test_score} đ` : 'Chưa thi'}
                  </strong>
                </span>
              </span>
            </div>
          </div>
        </div>

        <div className="profile-hero-actions">
          <button
            id="btn-profile-refresh"
            className="btn btn-outline btn-sm"
            onClick={loadUserData}
            disabled={isLoadingData}
            title="Làm mới dữ liệu hồ sơ"
          >
            <RefreshCw size={14} className={isLoadingData ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
          <Link to="/submit" className="btn btn-primary btn-sm">
            <Upload size={14} />
            <span>Cổng Nộp Bot</span>
          </Link>
        </div>
      </div>

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
              <span className="kpi-value cyan-text">{matchStats.points}</span>
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

        {/* Official Grading & Composite Score Card */}
        <div className="glass-card metric-panel grade-panel">
          <div className="metric-panel-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Award size={18} color="var(--emerald-400)" />
              <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Điểm Thành Phần (Hội Đồng Chấm)</h3>
            </div>
            <span className="grade-rating-pill" style={{ color: gradeRating.color }}>
              ● {gradeRating.label}
            </span>
          </div>

          <div className="composite-score-row">
            <div>
              <span className="composite-label">Điểm Tổng Kết Học Phần</span>
              <div className="composite-number-wrap">
                <span className="composite-number">{finalScore}</span>
                <span className="composite-max">/ 100</span>
              </div>
            </div>
            <div className="tier-weights-indicator">
              <span>Trọng số học phần:</span>
              <code>Bot {weights.bot}% • AI {weights.ai}% • Vấn đáp {weights.interview}% • Báo cáo {weights.report}%</code>
            </div>
          </div>

          <div className="sub-scores-bars">
            <div className="sub-score-item">
              <div className="sub-score-info">
                <span>1. Hiệu quả Bot ({weights.bot}%)</span>
                <strong>{user?.score_bot || 0} / 100</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill cyan-fill" style={{ width: `${user?.score_bot || 0}%` }}></div>
              </div>
            </div>

            <div className="sub-score-item">
              <div className="sub-score-info">
                <span>2. Hồ sơ Prompt AI (T08) ({weights.ai}%)</span>
                <strong>{user?.score_ai_profile || 0} / 100</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill purple-fill" style={{ width: `${user?.score_ai_profile || 0}%` }}></div>
              </div>
            </div>

            <div className="sub-score-item">
              <div className="sub-score-info">
                <span>3. Vấn đáp hiểu code 10p ({weights.interview}%)</span>
                <strong>{user?.score_interview || 0} / 100</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill emerald-fill" style={{ width: `${user?.score_interview || 0}%` }}></div>
              </div>
            </div>

            <div className="sub-score-item">
              <div className="sub-score-info">
                <span>4. Báo cáo tự đánh giá ({weights.report}%)</span>
                <strong>{user?.score_report || 0} / 100</strong>
              </div>
              <div className="progress-track">
                <div className="progress-fill amber-fill" style={{ width: `${user?.score_report || 0}%` }}></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation: Matches History vs Submissions */}
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
      </div>

      {/* Tab 1 Content: Matches History */}
      {activeTab === 'matches' && (
        <div className="tab-pane animate-fade-in">
          {matchHistory.length === 0 ? (
            <div className="glass-card empty-tab-card">
              <Swords size={40} color="var(--text-muted)" style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
              <h4>Chưa có trận đấu nào được ghi nhận</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', maxWidth: '480px', margin: '0.5rem auto 1.5rem' }}>
                Khi Ban tổ chức khởi chạy các vòng đấu Swiss, các trận đấu của bot bạn sẽ tự động xuất hiện tại đây.
              </p>
              <Link to="/matches" className="btn btn-outline btn-sm">
                <span>Khám phá các trận đấu khác</span>
              </Link>
            </div>
          ) : (
            <div className="profile-matches-list">
              {matchHistory.map((m) => (
                <div key={m.match_id} className="glass-card match-history-card">
                  <div className="match-history-main">
                    <span className={`result-tag result-${m.result}`}>
                      {m.result === 'win' ? 'CHIẾN THẮNG' : m.result === 'loss' ? 'THẤT BẠI' : 'HÒA CỜ'}
                    </span>

                    <div className="match-players-flow">
                      <span className="side-badge">
                        Phe: <strong>{m.played_as === 'White' ? '⚪ Trắng' : '🔴 Đen'}</strong>
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
                          <span>{new Date(m.played_at).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <Link
                    id={`btn-profile-replay-${m.match_id}`}
                    to={`/matches/${m.match_id}`}
                    className="btn btn-outline btn-sm btn-replay"
                  >
                    <PlayCircle size={15} />
                    <span>Xem Replay</span>
                  </Link>
                </div>
              ))}
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
                Chuẩn bị gói nén <code>.ZIP</code> gồm <code>bot.py</code>, <code>PROMPTS.md</code>, <code>REPORT.md</code> và thư mục <code>chat_history/</code> để nộp bài.
              </p>
              <Link to="/submit" className="btn btn-primary btn-sm">
                <Upload size={14} />
                <span>Đến Cổng Nộp Bài Ngay</span>
              </Link>
            </div>
          ) : (
            <div className="profile-subs-list">
              {submissionHistory.map((s, idx) => {
                const isValid = s.status === 'valid' || s.is_valid;
                const v = s.validation || {};
                return (
                  <div key={s.id} className={`glass-card sub-card ${s.is_active ? 'sub-active' : ''}`}>
                    <div className="sub-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                        <span className={`sub-status-pill ${isValid ? 'valid' : 'invalid'}`}>
                          {isValid ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                          <span>{isValid ? 'Hợp Lệ (T08/T09)' : 'Chưa Hợp Lệ'}</span>
                        </span>
                        {s.is_active && (
                          <span className="active-sub-tag">
                            ★ Gói thi đấu chính thức
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        Nộp lúc: {new Date(s.submitted_at).toLocaleString('vi-VN')}
                      </span>
                    </div>

                    {/* File validation chips */}
                    <div className="sub-checklist-chips">
                      <span className={`file-chip ${v.bot_py ? 'ok' : 'fail'}`}>
                        {v.bot_py ? '✓' : '✕'} bot.py
                      </span>
                      <span className={`file-chip ${v.choose_move_fn ? 'ok' : 'fail'}`}>
                        {v.choose_move_fn ? '✓' : '✕'} choose_move(state)
                      </span>
                      <span className={`file-chip ${v.prompts_md ? 'ok' : 'fail'}`}>
                        {v.prompts_md ? '✓' : '✕'} PROMPTS.md
                      </span>
                      <span className={`file-chip ${v.chat_history ? 'ok' : 'fail'}`}>
                        {v.chat_history ? '✓' : '✕'} chat_history/
                      </span>
                      <span className={`file-chip ${v.report_md ? 'ok' : 'fail'}`}>
                        {v.report_md ? '✓' : '✕'} REPORT.md
                      </span>
                      <span className={`file-chip ${v.git_log ? 'ok' : 'fail'}`}>
                        {v.git_log ? '✓' : '✕'} Git History (≥4 commits)
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
    </div>
  );
}
