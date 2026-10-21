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
  Laptop,
  Check,
  Zap,
  ArrowRight,
  ExternalLink,
  Download,
  Edit2,
  GitBranch,
  Bot,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { useAuth } from '@/shared/context/AuthContext.jsx';
import { useToast } from '@/shared/context/ToastContext.jsx';
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge.jsx';
import { GradeReviewModal } from '../../components/GradeReviewModal/GradeReviewModal.jsx';
import { EditUserModal } from '../../components/EditUserModal/index.js';
import './AdminDashboardPage.css';

export function AdminDashboardPage() {
  const { user, isAuthenticated } = useAuth();
  const { showToast } = useToast();

  const [stats, setStats] = useState(null);
  const [tournamentStatus, setTournamentStatus] = useState(null);
  const [swissStatus, setSwissStatus] = useState(null);
  const [usersList, setUsersList] = useState([]);
  const [submissionFilter, setSubmissionFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  // Tournament Controller: Swiss 13 Vòng
  const [selectedSwissRound, setSelectedSwissRound] = useState(1);
  const [isPairingSwiss, setIsPairingSwiss] = useState(false);
  const [isPublishingSwiss, setIsPublishingSwiss] = useState(false);

  // Modals state
  const [selectedUserForReview, setSelectedUserForReview] = useState(null);
  const [selectedUserForEdit, setSelectedUserForEdit] = useState(null);
  const [isSyncingData, setIsSyncingData] = useState(false);

  const fetchDashboardData = async () => {
    setIsLoading(true);
    try {
      const [statsRes, swissRes, usersRes] = await Promise.all([
        apiClient.get('/admin/stats').catch(() => null),
        apiClient.get('/admin/swiss/status').catch(() => null),
        apiClient.get('/admin/users').catch(() => []),
      ]);
      setStats(statsRes);
      setSwissStatus(swissRes);
      setUsersList(usersRes || []);
    } catch (err) {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Filter students list by search and submission status
  const filteredUsers = useMemo(() => {
    return usersList.filter((u) => {
      const matchSubmission =
        !submissionFilter ||
        (submissionFilter === 'submitted' ? u.has_submission : !u.has_submission);
      const query = searchQuery.toLowerCase().trim();
      const matchSearch =
        !query ||
        u.name?.toLowerCase().includes(query) ||
        u.email?.toLowerCase().includes(query) ||
        u.student_id?.toLowerCase().includes(query) ||
        u.bot_name?.toLowerCase().includes(query) ||
        u.class_name?.toLowerCase().includes(query);
      return matchSubmission && matchSearch;
    });
  }, [usersList, submissionFilter, searchQuery]);

  // Handle Swiss Pairing
  const handleTriggerSwissPair = async () => {
    setIsPairingSwiss(true);
    try {
      showToast(`Đang bốc thăm ghép cặp Vòng ${selectedSwissRound} (2.000 SV) và cắt 10 Chunks...`, 'info');
      const res = await apiClient.post('/admin/swiss/pair', {
        round_num: Number(selectedSwissRound),
        num_chunks: 10,
        player_count: 2000,
      });
      showToast(res.message || `Đã ghép cặp thành công Vòng ${selectedSwissRound}!`, 'success');
      fetchDashboardData();
    } catch (err) {
      showToast(err.message || 'Lỗi khi ghép cặp Swiss', 'error');
    } finally {
      setIsPairingSwiss(false);
    }
  };

  // Handle Swiss Publish
  const handleTriggerSwissPublish = async () => {
    setIsPublishingSwiss(true);
    try {
      showToast(`Đang hợp nhất kết quả Vòng ${selectedSwissRound}, tính Buchholz / SB và xuất bản...`, 'info');
      const res = await apiClient.post('/admin/swiss/publish', {
        round_num: Number(selectedSwissRound),
      });
      showToast(res.message || `Xuất bản bảng xếp hạng Vòng ${selectedSwissRound} thành công!`, 'success');
      fetchDashboardData();
    } catch (err) {
      showToast(err.message || 'Lỗi khi xuất bản kết quả Swiss', 'error');
    } finally {
      setIsPublishingSwiss(false);
    }
  };

  const handleSyncSeedData = async () => {
    if (!window.confirm('Bạn có muốn đồng bộ lại toàn bộ dữ liệu bài nộp mẫu cho các thí sinh vào cơ sở dữ liệu hiện tại?')) {
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

  return (
    <div className="admin-page animate-fade-in">
      {/* Admin Header */}
      <div className="admin-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="admin-badge-icon">
              <ShieldCheck size={22} color="var(--primary-700)" />
            </div>
            <h1 className="admin-title">
              Bảng Điều Khiển <span className="gradient-text">Ban Tổ Chức (Admin)</span>
            </h1>
          </div>
          <p className="admin-subtitle">
            Hội đồng Chấm thi • Điều hành Giải đấu Thụy Sĩ (Swiss 13 Vòng) • Quản lý Cụm 10 Máy Chấm Phân Tán
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleSyncSeedData}
            disabled={isSyncingData}
            title="Đồng bộ lại dữ liệu thí sinh mẫu"
          >
            <RotateCcw size={14} className={isSyncingData ? 'animate-spin' : ''} />
            <span>Nạp Dữ Liệu Mẫu</span>
          </button>
          <button
            id="btn-admin-refresh"
            className="btn btn-outline btn-sm"
            onClick={fetchDashboardData}
            disabled={isLoading}
          >
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Stats Cards Grid */}
      <div className="admin-stats-grid">
        <div className="glass-card stat-metric-card">
          <div className="stat-metric-header">
            <span className="stat-metric-title">Tổng Thí Sinh</span>
            <Users size={18} color="var(--primary-600)" />
          </div>
          <div className="stat-metric-value">{swissStatus?.total_players || 2000}</div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Toàn bộ sinh viên Khoa CNTT - UET
          </span>
        </div>

        <div className="glass-card stat-metric-card">
          <div className="stat-metric-header">
            <span className="stat-metric-title">Thể Thức Thi Đấu</span>
            <Trophy size={18} color="var(--amber-600)" />
          </div>
          <div className="stat-metric-value">13 Vòng</div>
          <span style={{ fontSize: '0.8rem', color: 'var(--primary-700)', fontWeight: 600 }}>
            Hệ Thống Thụy Sĩ (Swiss System)
          </span>
        </div>

        <div className="glass-card stat-metric-card">
          <div className="stat-metric-header">
            <span className="stat-metric-title">Cụm Máy Chấm</span>
            <Laptop size={18} color="var(--emerald-600)" />
          </div>
          <div className="stat-metric-value">10 Máy</div>
          <span style={{ fontSize: '0.8rem', color: 'var(--emerald-700)', fontWeight: 600 }}>
            100 trận/chunk • Chấm phân tán 0đ
          </span>
        </div>

        <div className="glass-card stat-metric-card">
          <div className="stat-metric-header">
            <span className="stat-metric-title">Vòng Chung Kết</span>
            <Award size={18} color="var(--primary-600)" />
          </div>
          <div className="stat-metric-value">Top 32</div>
          <span style={{ fontSize: '0.8rem', color: 'var(--amber-700)', fontWeight: 600 }}>
            Knockout &amp; Ô chướng ngại vật
          </span>
        </div>
      </div>

      {/* SWISS TOURNAMENT CONTROLLER */}
      <div className="glass-card tournament-hub-card" style={{ marginBottom: '2.5rem' }}>
          <div className="hub-header">
            <div>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.35rem' }}>
                <span className="swiss-hub-badge">SWISS ENGINE CONTROLLER</span>
                <span className="round-badge">VÒNG {selectedSwissRound} / 13</span>
              </div>
              <h3 style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                Điều Hành Giải Đấu Thụy Sĩ (Swiss System)
              </h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.25rem', margin: 0 }}>
                Tự động bốc thăm theo điểm số, cắt nhỏ 1.000 trận thành 10 file chunk cho 10 máy chấm sinh viên và hợp nhất xuất bản bảng xếp hạng Jamstack.
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Chọn Vòng:</span>
                <select
                  className="swiss-round-select"
                  value={selectedSwissRound}
                  onChange={(e) => setSelectedSwissRound(Number(e.target.value))}
                  aria-label="Chọn vòng đấu Swiss"
                >
                  {Array.from({ length: 13 }, (_, i) => i + 1).map((r) => (
                    <option key={r} value={r}>Vòng {r}</option>
                  ))}
                </select>
              </div>

              <Link to="/leaderboard" className="btn btn-outline btn-sm">
                <ExternalLink size={14} />
                <span>Xem Bảng Xếp Hạng</span>
              </Link>
            </div>
          </div>

          {/* Swiss 3-Step Action Workflow */}
          <div className="swiss-actions-row">
            {/* Step 1: Pair */}
            <div className="swiss-step-box">
              <div className="step-box-header">
                <span className="step-number">BƯỚC 1</span>
                <h4>Ghép Cặp &amp; Cắt Chunk</h4>
              </div>
              <p className="step-desc">
                Ghép 1.000 trận theo nhóm điểm, tránh đối thủ cũ và chia đều thành 10 file chunk (chunk_01 .. chunk_10).
              </p>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleTriggerSwissPair}
                disabled={isPairingSwiss}
              >
                <Zap size={14} className={isPairingSwiss ? 'animate-spin' : ''} />
                <span>{isPairingSwiss ? 'Đang ghép cặp...' : `Bốc Thăm Vòng ${selectedSwissRound}`}</span>
              </button>
            </div>

            {/* Step 2: Distribute & Monitor */}
            <div className="swiss-step-box">
              <div className="step-box-header">
                <span className="step-number">BƯỚC 2</span>
                <h4>Phân Bổ 10 Máy Chấm</h4>
              </div>
              <p className="step-desc">
                10 laptop sinh viên chạy <code>run_batch.py</code> độc lập qua Sandbox (mỗi máy 100 trận, ~2-3 phút xong).
              </p>
              <div className="chunk-progress-summary">
                <span>Tiến độ nộp kết quả:</span>
                <strong>{swissStatus?.results_ready || 0} / 10 Máy Chấm</strong>
              </div>
            </div>

            {/* Step 3: Merge & Publish */}
            <div className="swiss-step-box">
              <div className="step-box-header">
                <span className="step-number">BƯỚC 3</span>
                <h4>Hợp Nhất &amp; Xuất Bản</h4>
              </div>
              <p className="step-desc">
                Cập nhật điểm Match Points (3-1-0), tính hệ số Buchholz / SB, chốt Top 32 và xuất file JSON tĩnh.
              </p>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={handleTriggerSwissPublish}
                disabled={isPublishingSwiss}
              >
                <CheckCircle2 size={14} className={isPublishingSwiss ? 'animate-spin' : ''} />
                <span>{isPublishingSwiss ? 'Đang xuất bản...' : `Hợp Nhất &amp; Xuất Bản Vòng ${selectedSwissRound}`}</span>
              </button>
            </div>
          </div>

          {/* 10 Chunks Cluster Monitor Grid */}
          <div className="chunks-monitor-wrap">
            <h4 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <Laptop size={16} color="var(--primary-700)" />
              <span>Trạng Thái Cụm 10 Máy Chấm Phân Tán (Vòng {selectedSwissRound})</span>
            </h4>

            <div className="chunks-grid">
              {Array.from({ length: 10 }, (_, i) => i + 1).map((chunkId) => {
                const isReady = (swissStatus?.results_ready || 0) >= chunkId;
                return (
                  <div key={chunkId} className={`chunk-card ${isReady ? 'chunk-done' : 'chunk-pending'}`}>
                    <div className="chunk-card-header">
                      <span className="chunk-id-tag">MÁY #{String(chunkId).padStart(2, '0')}</span>
                      {isReady ? (
                        <span className="chunk-status-pill done">✓ Xong</span>
                      ) : (
                        <span className="chunk-status-pill waiting">Chờ nộp</span>
                      )}
                    </div>
                    <div className="chunk-matches-num">100 Trận</div>
                    <div className="chunk-file-name">chunk_{String(chunkId).padStart(2, '0')}.json</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      {/* Students List & Grading Review Table */}
      <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
        <div className="students-table-toolbar">
          <div>
            <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800 }}>Danh Sách Thí Sinh &amp; Chấm Thi</h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Hiển thị {filteredUsers.length} / {usersList.length} thí sinh
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <div className="admin-search-wrap">
              <Search size={15} color="var(--text-muted)" />
              <input
                type="text"
                placeholder="Tìm kiếm theo tên hoặc email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="admin-search-input"
              />
            </div>

            <select
              className="admin-filter-select"
              value={submissionFilter}
              onChange={(e) => setSubmissionFilter(e.target.value)}
              aria-label="Lọc theo trạng thái nộp bot"
            >
              <option value="">Tất Cả Thí Sinh</option>
              <option value="submitted">Đã Nộp Bot (Hợp Lệ)</option>
              <option value="pending">Chưa Nộp Bot</option>
            </select>
          </div>
        </div>

        <div className="table-responsive" style={{ margin: 0 }}>
          <table className="styled-table" aria-label="Bảng quản lý thí sinh">
            <thead>
              <tr>
                <th>Thí Sinh / MSSV / Lớp</th>
                <th>Bot &amp; GitHub</th>
                <th style={{ textAlign: 'center' }}>Bài Nộp</th>
                <th style={{ textAlign: 'center' }}>Swiss 13 Vòng</th>
                <th style={{ textAlign: 'center' }}>Điểm HP Đề Xuất</th>
                <th style={{ textAlign: 'center' }}>Hội Đồng Chấm (Bot / AI / VD / BC)</th>
                <th style={{ textAlign: 'center' }}>Điểm Tổng</th>
                <th style={{ textAlign: 'center' }}>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                    Không tìm thấy thí sinh phù hợp
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '0.92rem' }}>{u.name}</strong>
                          {u.is_top32 && (
                            <span className="swiss-hub-badge" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                              ★ TOP 32
                            </span>
                          )}
                          {u.is_admin && <span className="admin-tag">Admin</span>}
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {u.student_id ? <code>MSSV: {u.student_id}</code> : <span style={{ color: 'var(--text-muted)' }}>Chưa có MSSV</span>}
                          {u.class_name && <span> • {u.class_name}</span>}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{u.email}</div>
                      </div>
                    </td>

                    <td>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, color: 'var(--primary-700)' }}>
                          <Bot size={13} />
                          <span>{u.bot_name || 'Chưa đặt tên'}</span>
                        </div>
                        {u.github_repo_url ? (
                          <a
                            href={u.github_repo_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', color: 'var(--cyan-400)', marginTop: '2px' }}
                          >
                            <GitBranch size={11} />
                            <span>GitHub Repo</span>
                            <ExternalLink size={10} />
                          </a>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Chưa liên kết</span>
                        )}
                      </div>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className={`submission-status-badge ${u.has_submission ? 'valid' : 'none'}`}>
                        {u.has_submission ? '✓ Đã Nộp' : 'Chưa Nộp'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                        {u.swiss_wins || 0} <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>/ 13 thắng</span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {u.swiss_points || 0} pts
                      </div>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span
                        className="admin-final-score-pill"
                        style={{
                          background: u.projected_grade_10 >= 8.5 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(59, 130, 246, 0.12)',
                          borderColor: u.projected_grade_10 >= 8.5 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(59, 130, 246, 0.35)',
                          color: u.projected_grade_10 >= 8.5 ? '#10b981' : '#3b82f6',
                          fontWeight: 700,
                        }}
                      >
                        {u.projected_grade_10 !== undefined && u.projected_grade_10 !== null
                          ? `${Number(u.projected_grade_10).toFixed(1)} / 10`
                          : '—'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        {u.score_bot || 0} • {u.score_ai_profile || 0} • {u.score_interview || 0} • {u.score_report || 0}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <span className="admin-final-score-pill">
                        {u.final_score !== undefined ? u.final_score : '—'}
                      </span>
                    </td>

                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-xs"
                          onClick={() => setSelectedUserForEdit(u)}
                          title="Chỉnh sửa thông tin thí sinh"
                        >
                          <Edit2 size={12} />
                          <span>Sửa</span>
                        </button>
                        <button
                          type="button"
                          className="btn btn-secondary btn-xs btn-review-action"
                          onClick={() => setSelectedUserForReview(u)}
                          title="Hội đồng chấm điểm và đánh giá"
                        >
                          <Award size={12} />
                          <span>Chấm</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grade Review Modal */}
      {selectedUserForReview && (
        <GradeReviewModal
          user={selectedUserForReview}
          isOpen={!!selectedUserForReview}
          onClose={() => setSelectedUserForReview(null)}
          onGraded={() => {
            fetchDashboardData();
            setSelectedUserForReview(null);
          }}
        />
      )}

      {/* Edit User Modal */}
      {selectedUserForEdit && (
        <EditUserModal
          user={selectedUserForEdit}
          isOpen={!!selectedUserForEdit}
          onClose={() => setSelectedUserForEdit(null)}
          onUpdated={() => {
            fetchDashboardData();
            setSelectedUserForEdit(null);
          }}
          onDeleted={() => {
            fetchDashboardData();
            setSelectedUserForEdit(null);
          }}
        />
      )}
    </div>
  );
}

export default AdminDashboardPage;
