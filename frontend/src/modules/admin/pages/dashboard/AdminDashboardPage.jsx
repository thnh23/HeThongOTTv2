import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  ShieldCheck,
  Users,
  Trophy,
  Upload,
  Play,
  RotateCcw,
  Search,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Award,
  Radio,
  FileCode,
  LogIn,
  Sliders,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { useAuth } from '@/shared/context/AuthContext.jsx';
import { useToast } from '@/shared/context/ToastContext.jsx';
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge.jsx';
import { GradeReviewModal } from '../../components/GradeReviewModal/GradeReviewModal.jsx';
import './AdminDashboardPage.css';

export function AdminDashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [stats, setStats] = useState(null);
  const [tournamentStatus, setTournamentStatus] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [tierFilter, setTierFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Modal review state
  const [selectedUserForReview, setSelectedUserForReview] = useState(null);
  const [isStartingTournament, setIsStartingTournament] = useState(null); // 'A', 'B', 'C'
  const [isSyncingData, setIsSyncingData] = useState(false);

  const handleSyncSeedData = async () => {
    if (!window.confirm('Bạn có muốn đồng bộ lại toàn bộ dữ liệu bài nộp mẫu cho 9 thí sinh (Bảng A, B, C) vào cơ sở dữ liệu hiện tại?')) {
      return;
    }
    setIsSyncingData(true);
    try {
      showToast('Đang đồng bộ dữ liệu bài nộp mẫu lên cơ sở dữ liệu...', 'info');
      const res = await apiClient.post('/admin/seed-data');
      showToast(res.message || 'Đồng bộ bài nộp mẫu thành công!', 'success');
      fetchDashboardData();
    } catch (err) {
      showToast(err.message || 'Lỗi khi đồng bộ dữ liệu bài nộp', 'error');
    } finally {
      setIsSyncingData(false);
    }
  };

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, tourneyRes, usersRes] = await Promise.all([
        apiClient.get('/admin/stats'),
        apiClient.get('/admin/tournament/status'),
        apiClient.get('/admin/users'),
      ]);
      setStats(statsRes);
      setTournamentStatus(tourneyRes);
      setUsersList(usersRes || []);
    } catch (err) {
      // ignore or show error
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Filter students list
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const matchTier = !tierFilter || u.tier === tierFilter;
      const matchSearch =
        !searchQuery ||
        u.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchTier && matchSearch;
    });
  }, [usersList, tierFilter, searchQuery]);

  // Handle Tier update directly in table
  const handleChangeTier = async (userId, newTier) => {
    try {
      await apiClient.put(`/admin/users/${userId}/tier`, { tier: newTier });
      showToast(`Đã chuyển thí sinh sang Bảng ${newTier}!`, 'success');
      fetchDashboardData();
    } catch (err) {
      showToast('Lỗi khi đổi bảng: ' + err.message, 'error');
    }
  };

  // Handle start tournament
  const handleStartTournament = async (tier) => {
    setIsStartingTournament(tier);
    try {
      showToast(`Đang ghép cặp vòng tròn và khởi chạy giải đấu Bảng ${tier}...`, 'info');
      const res = await apiClient.post('/admin/tournament/start', {
        tier,
        move_delay_sec: 0.5,
      });

      showToast(res.message || `Giải đấu Bảng ${tier} đã khởi chạy!`, 'success');
      fetchDashboardData();
    } catch (err) {
      showToast(err.message || 'Không thể khởi chạy giải đấu', 'error');
    } finally {
      setIsStartingTournament(null);
    }
  };

  return (
    <div className="admin-page animate-fade-in">
      {/* Admin Header */}
      <div className="admin-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="admin-badge-icon">
              <ShieldCheck size={22} color="var(--amber-400)" />
            </div>
            <h1 style={{ fontSize: '2.2rem', margin: 0 }}>
              Bảng Điều Khiển <span className="gradient-text">Ban Tổ Chức (Admin)</span>
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Hội đồng chấm thi • Quản lý vòng tròn Round-Robin • Chấm hồ sơ AI & vấn đáp hiểu code (Sprint 5)
          </p>
        </div>

        <button
          id="btn-admin-refresh"
          className="btn btn-outline btn-sm"
          onClick={fetchDashboardData}
          disabled={isLoading}
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          <span>Làm mới dữ liệu</span>
        </button>
      </div>

      {/* Stats Cards Grid */}
      <div className="admin-stats-grid">
        <div className="glass-card stat-metric-card">
          <div className="stat-metric-header">
            <span className="stat-metric-title">Tổng Thí Sinh</span>
            <Users size={18} color="var(--primary-400)" />
          </div>
          <div className="stat-metric-value">{stats?.users?.total || usersList.length}</div>
          <div className="tier-breakdown-pills">
            <span className="breakdown-pill">A: {stats?.users?.tier_counts?.A || 0}</span>
            <span className="breakdown-pill">B: {stats?.users?.tier_counts?.B || 0}</span>
            <span className="breakdown-pill">C: {stats?.users?.tier_counts?.C || 0}</span>
          </div>
        </div>

        <div className="glass-card stat-metric-card">
          <div className="stat-metric-header">
            <span className="stat-metric-title">Gói Bài Nộp</span>
            <Upload size={18} color="var(--cyan-400)" />
          </div>
          <div className="stat-metric-value">{stats?.submissions?.valid || 0} <span className="stat-metric-sub">/ {stats?.submissions?.total || 0}</span></div>
          <span style={{ fontSize: '0.8rem', color: 'var(--emerald-400)' }}>
            ✓ Đã qua kiểm tra T08/T09
          </span>
        </div>

        <div className="glass-card stat-metric-card">
          <div className="stat-metric-header">
            <span className="stat-metric-title">Trận Đấu Vòng Tròn</span>
            <Trophy size={18} color="var(--amber-400)" />
          </div>
          <div className="stat-metric-value">{stats?.matches?.done || 0} <span className="stat-metric-sub">/ {stats?.matches?.total || 0}</span></div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Đang chạy: {stats?.matches?.running || 0} • Chờ: {stats?.matches?.pending || 0}
          </span>
        </div>

        <div className="glass-card stat-metric-card">
          <div className="stat-metric-header">
            <span className="stat-metric-title">Đã Chấm Vấn Đáp</span>
            <Award size={18} color="var(--emerald-400)" />
          </div>
          <div className="stat-metric-value">
            {stats?.users?.reviewed_count || 0}
            <span className="stat-metric-sub"> / {usersList.length}</span>
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--cyan-400)' }}>
            Hồ sơ AI + Vấn đáp 10p
          </span>
        </div>
      </div>

      {/* Tournament Hub (Round-Robin Controller per Tier) */}
      <div className="glass-card tournament-hub-card" style={{ marginBottom: '2.5rem' }}>
        <div className="hub-header">
          <div>
            <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
              <Trophy size={20} color="var(--amber-400)" />
              <span>Điều Hành Giải Đấu Vòng Tròn (Round-Robin)</span>
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
              Mỗi cặp thí sinh thi đấu 2 ván đổi phe (Trắng - Đen, Đen - Trắng) theo đúng quy định Bảng 10.
            </p>
          </div>
          <Link to="/matches" className="btn btn-outline btn-sm">
            <Radio size={14} />
            <span>Mở Bảng Thi Đấu & Live</span>
          </Link>
        </div>

        <div className="tournament-tiers-grid">
          {['A', 'B', 'C'].map((tier) => {
            const tStatus = tournamentStatus?.[tier] || {
              total_matches: 0,
              done_matches: 0,
              running_matches: 0,
              progress_percent: 0,
            };

            const tierUsers = usersList.filter((u) => u.tier === tier && !u.is_admin);
            const submittedCount = tStatus.submitted_players !== undefined
              ? tStatus.submitted_players
              : tierUsers.filter((u) => u.has_submission).length;
            const totalCount = tStatus.total_players !== undefined
              ? tStatus.total_players
              : tierUsers.length;
            const canStart = submittedCount >= 2;

            const isStarting = isStartingTournament === tier;

            return (
              <div key={tier} className="tournament-tier-box">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                  <span className={`tier-badge-large tier-${tier}`}>BẢNG {tier}</span>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Tiến độ: <strong>{tStatus.progress_percent}%</strong>
                  </span>
                </div>

                {/* Progress bar */}
                <div className="tournament-progress-track">
                  <div
                    className="tournament-progress-fill"
                    style={{ width: `${tStatus.progress_percent}%` }}
                  ></div>
                </div>

                <div className="tier-match-stats">
                  <span>Tổng: {tStatus.total_matches} trận</span>
                  <span>Đã xong: {tStatus.done_matches}</span>
                  {tStatus.running_matches > 0 && (
                    <span style={{ color: 'var(--rose-500)', fontWeight: 600 }}>
                      🔴 Đang đấu: {tStatus.running_matches}
                    </span>
                  )}
                </div>

                {/* Submission eligibility indicator */}
                <div
                  style={{
                    marginTop: '0.75rem',
                    padding: '0.45rem 0.65rem',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: canStart ? 'rgba(16, 185, 129, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                    border: `1px solid ${canStart ? 'rgba(16, 185, 129, 0.25)' : 'rgba(245, 158, 11, 0.25)'}`,
                  }}
                  title={canStart ? `${submittedCount} thí sinh đã nộp bài hợp lệ và sẵn sàng thi đấu` : 'Cần tối thiểu 2 thí sinh có bài nộp hợp lệ để ghép trận vòng tròn'}
                >
                  <span style={{ color: canStart ? 'var(--emerald-400)' : 'var(--amber-400)', fontWeight: 600 }}>
                    {canStart ? '✓ Đủ điều kiện ghép' : '⚠ Chưa đủ bài nộp'}
                  </span>
                  <strong style={{ color: '#fff', fontFamily: 'var(--font-mono)' }}>
                    {submittedCount}/{totalCount} đã nộp
                  </strong>
                </div>

                <button
                  id={`btn-start-tournament-${tier.toLowerCase()}`}
                  className="btn btn-primary btn-sm"
                  style={{
                    width: '100%',
                    justifyContent: 'center',
                    marginTop: '0.75rem',
                    opacity: canStart ? 1 : 0.65,
                    cursor: canStart ? 'pointer' : 'not-allowed',
                  }}
                  onClick={() => {
                    if (!canStart) {
                      showToast(
                        `Bảng ${tier} mới có ${submittedCount}/${totalCount} thí sinh nộp bài. Cần tối thiểu 2 thí sinh có bài nộp hợp lệ để ghép trận!`,
                        'warning'
                      );
                      return;
                    }
                    handleStartTournament(tier);
                  }}
                  disabled={isStarting}
                >
                  {isStarting ? (
                    <>
                      <RefreshCw size={15} className="animate-spin" />
                      <span>Đang khởi chạy...</span>
                    </>
                  ) : (
                    <>
                      <Play size={15} />
                      <span>
                        {!canStart
                          ? `Cần tối thiểu 2 bài nộp (${submittedCount}/2)`
                          : tStatus.total_matches > 0
                          ? `Tạo Lượt Mới (${submittedCount} bot)`
                          : `Ghép Trận Bảng ${tier} (${submittedCount} bot)`}
                      </span>
                    </>
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Students & Grading Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="students-table-toolbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Users size={18} />
              <span>Danh Sách Thí Sinh & Điểm Số Chi Tiết</span>
            </h3>

            <div className="tier-select-wrapper">
              <select
                className="select-filter"
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
              >
                <option value="">Tất cả Bảng (A, B, C)</option>
                <option value="A">Bảng A</option>
                <option value="B">Bảng B</option>
                <option value="C">Bảng C</option>
              </select>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleSyncSeedData}
              disabled={isSyncingData}
              title="Đồng bộ lại toàn bộ dữ liệu bài nộp mẫu cho 9 thí sinh lên CSDL (Production/Render)"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <RefreshCw size={14} className={isSyncingData ? 'animate-spin' : ''} />
              <span>{isSyncingData ? 'Đang đồng bộ...' : 'Đồng Bộ Bài Nộp Mẫu'}</span>
            </button>

            <div className="search-input-box" style={{ maxWidth: '300px' }}>
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Tìm theo tên hoặc email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="table-responsive" style={{ margin: 0 }}>
          <table className="styled-table" aria-label="Bảng điểm thí sinh">
            <thead>
              <tr>
                <th>Thí Sinh</th>
                <th style={{ textAlign: 'center' }}>Bảng Đấu</th>
                <th style={{ textAlign: 'center' }}>Bài Nộp</th>
                <th style={{ textAlign: 'center' }} title="Trọng số 30-50%">Điểm Bot</th>
                <th style={{ textAlign: 'center' }} title="Hồ sơ AI T08 (15-25%)">Hồ Sơ AI</th>
                <th style={{ textAlign: 'center' }} title="Vấn đáp 10 phút (20-30%)">Vấn Đáp</th>
                <th style={{ textAlign: 'center' }} title="Báo cáo tự đánh giá (15%)">Báo Cáo</th>
                <th style={{ textAlign: 'right' }}>Tổng Kết</th>
                <th style={{ textAlign: 'center' }}>Hội Đồng Chấm</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    Không tìm thấy thí sinh nào phù hợp.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <strong style={{ color: '#fff', fontSize: '0.95rem' }}>{u.name}</strong>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                        {u.email}
                      </div>
                    </td>

                    {/* Quick Tier change dropdown */}
                    <td style={{ textAlign: 'center' }}>
                      <select
                        className={`tier-inline-select tier-${u.tier}`}
                        value={u.tier || 'A'}
                        onChange={(e) => handleChangeTier(u.id, e.target.value)}
                        title="Bấm để thay đổi phân bảng"
                      >
                        <option value="A">Bảng A</option>
                        <option value="B">Bảng B</option>
                        <option value="C">Bảng C</option>
                      </select>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      {u.has_submission ? (
                        <span
                          style={{ color: 'var(--emerald-400)', fontSize: '0.85rem', fontWeight: 600 }}
                          title="Bài nộp hợp lệ - Sẵn sàng tham gia ghép trận"
                        >
                          ✓ Đã nộp
                        </span>
                      ) : (
                        <span
                          style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}
                          title="Chưa nộp bài - Hệ thống không ghép trận thí sinh này"
                        >
                          Chưa nộp
                        </span>
                      )}
                    </td>

                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                      {u.score_bot || '0.0'}
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                      {u.score_ai_profile || '0.0'}
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                      {u.score_interview || '0.0'}
                    </td>
                    <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                      {u.score_report || '0.0'}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <span className="admin-final-score-pill">
                        {u.final_score}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <button
                        id={`btn-review-user-${u.id}`}
                        className="btn btn-outline btn-xs btn-review-action"
                        onClick={() => setSelectedUserForReview(u)}
                        title="Mở giao diện chấm điểm hồ sơ AI và vấn đáp"
                      >
                        <Award size={14} color="var(--amber-400)" />
                        <span>Chấm Điểm</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grade Review Modal */}
      <GradeReviewModal
        isOpen={!!selectedUserForReview}
        user={selectedUserForReview}
        onClose={() => setSelectedUserForReview(null)}
        onGraded={() => {
          fetchDashboardData();
        }}
      />
    </div>
  );
}
