import React, { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Swords,
  Clock,
  PlayCircle,
  RefreshCw,
  AlertCircle,
  Radio,
  Search,
  Trophy,
  X,
  ChevronLeft,
  ChevronRight,
  GitBranch,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { useToast } from '@/shared/context/ToastContext.jsx';
import { useAuth } from '@/shared/context/AuthContext.jsx';
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge.jsx';
import './MatchesListPage.css';

export function MatchesListPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState([]);
  const [roundFilter, setRoundFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [totalMatches, setTotalMatches] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const { showToast } = useToast();

  const fetchMatches = async (isManual = false) => {
    setIsLoading(true);
    setError(null);
    try {
      let path = `/matches?page=${page}&page_size=${pageSize}`;
      if (roundFilter) path += `&round_num=${encodeURIComponent(roundFilter)}`;
      if (statusFilter) path += `&status=${encodeURIComponent(statusFilter)}`;

      const res = await apiClient.get(path);
      setMatches(res.items || []);
      setTotalMatches(res.total ?? (res.items || []).length);
      setTotalPages(res.total_pages ?? Math.max(1, Math.ceil((res.total || 0) / pageSize)));
      if (isManual) {
        showToast('Đã làm mới danh sách trận đấu!', 'success');
      }
    } catch (err) {
      const msg = err.message || 'Không thể tải danh sách trận đấu';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMatches();
  }, [page, pageSize, roundFilter, statusFilter]);

  const handleRoundChange = (newRound) => {
    setRoundFilter(newRound);
    setPage(1);
  };

  const handleStatusChange = (newStatus) => {
    setStatusFilter(newStatus);
    setPage(1);
  };

  const handlePageSizeChange = (newSize) => {
    setPageSize(Number(newSize));
    setPage(1);
  };

  // Filter matches by search query locally on current page
  const filteredMatches = useMemo(() => {
    if (!searchQuery.trim()) return matches;
    const q = searchQuery.toLowerCase();
    return matches.filter(
      (m) =>
        m.bot_a_name?.toLowerCase().includes(q) ||
        m.bot_b_name?.toLowerCase().includes(q) ||
        m.id?.toLowerCase().includes(q) ||
        m.round_label?.toLowerCase().includes(q)
    );
  }, [matches, searchQuery]);

  // Statistics calculation for current page & total
  const stats = useMemo(() => {
    const running = matches.filter((m) => m.status === 'running').length;
    const done = matches.filter((m) => m.status === 'done').length;
    return { running, done };
  }, [matches]);

  const isFinalsMatch = (m) => {
    if (!m) return false;
    return (
      m.round_num === 'finals' ||
      /^(R32_|R16_|QF_|SF_|FINAL_)/.test(m.id || '')
    );
  };

  return (
    <div className="matches-page animate-fade-in">
      <div className="matches-header">
        <div>
          <h1 style={{ fontSize: '2.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
            <Swords color="var(--primary-400)" />
            <span>Lịch Đấu, Replay & <span className="gradient-text">Live Board</span></span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem' }}>
            Theo dõi trực tiếp qua WebSocket (Sprint 4) hoặc xem lại toàn bộ lịch sử nước đi.
          </p>
        </div>

        <div className="matches-top-actions">
          <Link to="/matches/live" className="btn btn-outline" id="btn-goto-live-hub">
            <Radio size={16} color="var(--rose-400)" className="animate-pulse" />
            <span>Kênh Trực Tiếp Live</span>
          </Link>
          <button
            id="btn-refresh-matches"
            className="btn btn-outline"
            onClick={() => fetchMatches(true)}
            disabled={isLoading}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="matches-stats-bar">
        <div className="matches-stat-pill">
          <span>Tổng số:</span>
          <strong>{totalMatches} trận</strong>
        </div>
        <div className="matches-stat-pill">
          <span>Trang này:</span>
          <strong>{matches.length} trận</strong>
        </div>
        {stats.running > 0 && (
          <div className="matches-stat-pill running">
            <span className="live-dot animate-ping" />
            <span>Đang trực tiếp:</span>
            <strong>{stats.running} trận</strong>
          </div>
        )}
        <div className="matches-stat-pill">
          <span>Đã hoàn thành:</span>
          <strong>{stats.done} trận</strong>
        </div>
      </div>

      {/* Filter Bar with Tabs and Search */}
      <div className="filter-bar">
        {/* Swiss Tournament Rounds & Finals Tabs */}
        <div className="tier-filter-tabs">
          {[
            { id: '', label: 'Tất Cả Vòng' },
            { id: '1', label: 'Vòng 1' },
            { id: '8', label: 'Vòng 8' },
            { id: '13', label: 'Vòng 13 (Chốt Top 32)' },
            { id: 'finals', label: 'Chung Kết Top 32' },
          ].map((t) => (
            <button
              key={t.id}
              className={`filter-tab-btn ${roundFilter === t.id ? 'active' : ''}`}
              onClick={() => handleRoundChange(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Status Filter */}
        <select
          id="select-filter-status"
          className="select-filter"
          value={statusFilter}
          onChange={(e) => handleStatusChange(e.target.value)}
        >
          <option value="">Tất cả Trạng thái</option>
          <option value="running">Đang diễn ra (Live)</option>
          <option value="done">Đã hoàn thành</option>
          <option value="pending">Chờ đấu</option>
        </select>

        {/* Search */}
        <div className="search-input-box" style={{ flex: 1, minWidth: '200px' }}>
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Tìm theo tên bot, mã trận, vòng..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="search-clear-btn" onClick={() => setSearchQuery('')} aria-label="Xóa tìm kiếm">
              <X size={14} />
            </button>
          )}
        </div>

        <button
          className="btn btn-outline btn-sm"
          onClick={() => fetchMatches(true)}
          disabled={isLoading}
          title="Làm mới danh sách"
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

      {/* Special Banner when viewing Finals */}
      {roundFilter === 'finals' && (
        <div className="finals-highlight-banner glass-card">
          <div className="finals-banner-info">
            <Trophy size={28} className="finals-trophy-icon" />
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', color: 'var(--amber-400)' }}>
                Vòng Chung Kết Knockout — 32 Đội Xuất Sắc Nhất
              </h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Các cặp đấu diễn ra theo thể thức BO2 (lượt đi và lượt về đổi màu quân). Danh sách bên dưới là các trận đấu chính thức với tỷ số tổng thể.
              </p>
            </div>
          </div>
          {user?.is_admin && (
            <Link to="/admin" className="btn btn-outline btn-sm" style={{ borderColor: 'var(--amber-500)', color: 'var(--amber-400)' }}>
              <GitBranch size={14} />
              <span>Cây Nhánh & Mô Phỏng Top 32</span>
            </Link>
          )}
        </div>
      )}

      {error ? (
        <div className="glass-card" style={{ borderColor: 'var(--rose-500)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
          <AlertCircle color="var(--rose-500)" size={20} />
          <span>{error}</span>
        </div>
      ) : isLoading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem' }}>
          <RefreshCw className="animate-spin" size={28} style={{ color: 'var(--cyan-400)', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Đang tải danh sách trận đấu...</p>
        </div>
      ) : filteredMatches.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem' }}>
          <Swords size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
          {searchQuery || roundFilter || statusFilter ? (
            <>
              <h3>Không tìm thấy trận đấu nào phù hợp</h3>
              <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
                Không có kết quả nào khớp với bộ lọc hoặc từ khóa tìm kiếm hiện tại.
              </p>
              <button
                className="btn btn-outline btn-sm"
                onClick={() => {
                  setSearchQuery('');
                  setRoundFilter('');
                  setStatusFilter('');
                  setPage(1);
                }}
              >
                <span>Xóa bộ lọc</span>
              </button>
            </>
          ) : (
            <>
              <h3>Chưa có trận đấu nào trong hệ thống</h3>
              <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', margin: '0.5rem auto 1.5rem', lineHeight: 1.6 }}>
                Hệ thống giải đấu hiện chưa có ván đấu nào được ghi nhận. Khi Ban tổ chức khởi tạo bốc thăm vòng Swiss hoặc kích hoạt Chung kết Top 32, danh sách trận đấu sẽ hiển thị tại đây.
              </p>
              <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link to="/matches/live" className="btn btn-primary btn-sm">
                  <Radio size={15} />
                  <span>Kênh Trực Tiếp Live</span>
                </Link>
                <Link to="/leaderboard" className="btn btn-outline btn-sm">
                  <span>Bảng Xếp Hạng</span>
                </Link>
                {user?.is_admin && (
                  <Link to="/admin" className="btn btn-outline btn-sm" style={{ color: 'var(--amber-400)', borderColor: 'var(--amber-500)' }}>
                    <span>Trang Quản Trị BTC</span>
                  </Link>
                )}
              </div>
            </>
          )}
        </div>
      ) : (
        <>
          <div className="matches-grid">
            {filteredMatches.map((m) => {
              const finalsMatch = isFinalsMatch(m);
              const label = m.round_label || (m.round_num ? (m.round_num === 'finals' ? 'Chung Kết' : `Vòng ${m.round_num} Swiss`) : 'Trận Đấu');

              return (
                <div key={m.id} className={`glass-card match-card ${finalsMatch ? 'match-card-finals' : ''}`}>
                  <div className="match-opponents">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <span className={`tier-pill ${finalsMatch ? 'tier-pill-finals' : ''}`}>
                        {label}
                      </span>
                      {m.status === 'running' && (
                        <span className="live-pill">
                          <span className="live-dot animate-ping"></span> LIVE
                        </span>
                      )}
                      <span className="match-id-badge">{m.id}</span>
                    </div>

                    <div className={`bot-tag bot-white-tag ${m.winner === 'W' ? 'bot-winner' : ''}`}>
                      <span className="mini-tag mini-tag-white">W</span>
                      <span className="bot-name">{m.bot_a_name || 'Bot White'}</span>
                      {m.winner === 'W' && (
                        <span className="winner-crown" title="Thắng trận">
                          <Trophy size={13} />
                        </span>
                      )}
                    </div>

                    <span className="vs-badge">VS</span>

                    <div className={`bot-tag bot-black-tag ${m.winner === 'B' ? 'bot-winner' : ''}`}>
                      <span className="mini-tag mini-tag-black">B</span>
                      <span className="bot-name">{m.bot_b_name || 'Bot Black'}</span>
                      {m.winner === 'B' && (
                        <span className="winner-crown" title="Thắng trận">
                          <Trophy size={13} />
                        </span>
                      )}
                    </div>

                    {/* Quick BO2 game links for finals */}
                    {finalsMatch && (
                      <div className="bo2-subgames">
                        <span className="bo2-label">Ván:</span>
                        <Link
                          to={`/matches/${m.id}_G1`}
                          className="bo2-game-pill"
                          title={`Xem ván 1: ${m.bot_a_name} (Trắng) vs ${m.bot_b_name} (Đen)`}
                        >
                          V1
                        </Link>
                        <Link
                          to={`/matches/${m.id}_G2`}
                          className="bo2-game-pill"
                          title={`Xem ván 2 (đổi màu): ${m.bot_b_name} (Trắng) vs ${m.bot_a_name} (Đen)`}
                        >
                          V2
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="match-meta">
                    <StatusBadge status={m.end_code || m.status} />

                    <div className="meta-item">
                      <Clock size={15} />
                      <span>{m.total_moves} nước</span>
                    </div>

                    {m.status === 'running' ? (
                      <Link
                        id={`btn-view-live-${m.id}`}
                        to={`/matches/${m.id}/live`}
                        className="btn btn-primary btn-sm"
                      >
                        <Radio size={14} className="animate-pulse" />
                        <span>Xem Trực Tiếp</span>
                      </Link>
                    ) : (
                      <div style={{ display: 'flex', gap: '0.45rem' }}>
                        <Link
                          id={`btn-view-match-${m.id}`}
                          to={`/matches/${m.id}`}
                          className="btn btn-outline btn-sm"
                        >
                          <PlayCircle size={15} />
                          <span>Replay</span>
                        </Link>
                        <Link
                          to={`/matches/${m.id}/live`}
                          className="btn btn-outline btn-xs"
                          title="Xem lại giao diện Live"
                        >
                          <Radio size={13} />
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pagination-bar glass-card">
              <div className="pagination-info">
                <span>
                  Trang <strong>{page}</strong> / <strong>{totalPages}</strong> — Tổng <strong>{totalMatches}</strong> trận
                </span>
              </div>

              <div className="pagination-nav">
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1 || isLoading}
                  aria-label="Trang trước"
                >
                  <ChevronLeft size={14} />
                  <span>Trước</span>
                </button>

                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) {
                      acc.push('...');
                    }
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`ellipsis-${idx}`} className="pagination-ellipsis">
                        ...
                      </span>
                    ) : (
                      <button
                        key={p}
                        className={`pagination-num-btn ${page === p ? 'active' : ''}`}
                        onClick={() => setPage(p)}
                        disabled={isLoading}
                      >
                        {p}
                      </button>
                    )
                  )}

                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages || isLoading}
                  aria-label="Trang sau"
                >
                  <span>Sau</span>
                  <ChevronRight size={14} />
                </button>
              </div>

              <div className="pagination-size-selector">
                <span>Hiển thị:</span>
                <select
                  value={pageSize}
                  onChange={(e) => handlePageSizeChange(e.target.value)}
                  className="select-page-size"
                >
                  <option value={25}>25 / trang</option>
                  <option value={50}>50 / trang</option>
                  <option value={100}>100 / trang</option>
                  <option value={200}>200 / trang</option>
                </select>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
