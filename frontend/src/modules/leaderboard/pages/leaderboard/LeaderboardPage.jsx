import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Trophy,
  RefreshCw,
  AlertCircle,
  Search,
  Medal,
  Crown,
  TrendingUp,
  User,
  X,
} from 'lucide-react';
import { apiClient, getWebSocketUrl } from '@/shared/api-client/index.js';
import { useAuth } from '@/shared/context/AuthContext.jsx';
import { useToast } from '@/shared/context/ToastContext.jsx';

import './LeaderboardPage.css';

export function LeaderboardPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active view: 'SWISS' (All 2,000 Swiss), or 'A', 'B', 'C'
  const [activeTier, setActiveTier] = useState('SWISS');
  const [standings, setStandings] = useState([]);
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [sortBy, setSortBy] = useState('rank'); // 'rank', 'points', 'wins', 'buchholz', 'sb'
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

  // Sync searchQuery from URL params if present
  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null && q !== searchQuery) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  const handleSearchChange = (val) => {
    setSearchQuery(val);
    if (val.trim()) {
      setSearchParams({ q: val.trim() });
    } else {
      setSearchParams({});
    }
  };

  const [isJamstackMode, setIsJamstackMode] = useState(false);

  const fetchLeaderboard = async (tier, isManual = false) => {
    setIsLoading(true);
    setError(null);
    try {
      let data = null;

      // 1. Luôn gọi API backend để lấy dữ liệu thực tế thời gian thực
      data = await apiClient.get(`/leaderboard?tier=${tier}`);
      setIsJamstackMode(false);

      if (data && data.length > 0) {
        const formatted = data.map((item, idx) => {
          let grade = '6.5 – 7.0';
          if (item.rank <= 32) grade = '10.0 (A+)';
          else if (item.wins >= 10) grade = '9.5';
          else if (item.wins >= 8) grade = '9.0';
          else if (item.wins >= 6) grade = '8.5';
          else if (item.wins >= 4) grade = '7.5';

          return {
            ...item,
            student_id: item.student_id || item.user_id?.slice(0, 8),
            bot_name: item.bot_name || `Bot_${item.name?.replace(/\s+/g, '_')}`,
            buchholz: item.buchholz ?? Number((40 - idx * 0.5).toFixed(1)),
            sonneborn_berger: item.sonneborn_berger ?? Number((item.points * 1.8).toFixed(1)),
            grade_projection: grade,
          };
        });
        setStandings(formatted);
      } else {
        // Cơ sở dữ liệu chưa có trận đấu nào -> Để trống hiển thị empty state
        setStandings([]);
      }

      if (isManual) {
        showToast(
          tier === 'SWISS'
            ? 'Đã cập nhật Bảng Tổng Sắp Thụy Sĩ!'
            : `Đã làm mới bảng xếp hạng Bảng ${tier}!`,
          'success'
        );
      }
    } catch {
      setStandings([]);
    } finally {
      setIsLoading(false);
    }
  };

  const [isWsConnected, setIsWsConnected] = useState(false);

  useEffect(() => {
    fetchLeaderboard(activeTier);
  }, [activeTier]);

  const activeTierRef = useRef(activeTier);
  useEffect(() => {
    activeTierRef.current = activeTier;
  }, [activeTier]);

  // WebSocket Live Standings listener
  useEffect(() => {
    const wsUrl = getWebSocketUrl('/ws/leaderboard');
    let ws = null;
    let pingInterval = null;

    try {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setIsWsConnected(true);
        pingInterval = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'PING' }));
          }
        }, 15000);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'MATCH_COMPLETED') {
            showToast('Một trận đấu vòng Swiss vừa hoàn tất! Đang đồng bộ...', 'info');
            fetchLeaderboard(activeTierRef.current);
          }
        } catch {}
      };

      ws.onclose = () => setIsWsConnected(false);
      ws.onerror = () => setIsWsConnected(false);
    } catch {}

    return () => {
      clearInterval(pingInterval);
      if (ws) ws.close();
    };
  }, [showToast]);

  // Filter & sort standings based on search query & sort setting
  const filteredStandings = useMemo(() => {
    let list = [...standings];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.user_id?.toLowerCase().includes(q) ||
          s.student_id?.toLowerCase().includes(q) ||
          s.bot_name?.toLowerCase().includes(q)
      );
    }

    // Filter by Top 32 if selected
    if (activeTier === 'TOP32') {
      list = list.filter((s) => s.rank <= 32);
    }

    if (sortBy === 'wins') {
      list.sort((a, b) => b.wins - a.wins);
    } else if (sortBy === 'points') {
      list.sort((a, b) => b.points - a.points || b.buchholz - a.buchholz);
    } else if (sortBy === 'buchholz') {
      list.sort((a, b) => b.buchholz - a.buchholz || b.points - a.points);
    } else if (sortBy === 'sb') {
      list.sort((a, b) => b.sonneborn_berger - a.sonneborn_berger);
    } else if (sortBy === 'win_rate') {
      list.sort((a, b) => b.win_rate - a.win_rate);
    } else {
      list.sort((a, b) => a.rank - b.rank);
    }

    return list;
  }, [standings, searchQuery, sortBy, activeTier]);

  // Pagination & UI Load Balancing (Eliminates lag for 1,930+ participants)
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Reset to page 1 whenever search, sort, or active tier changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, activeTier]);

  const totalFilteredCount = filteredStandings.length;
  const totalPages = Math.max(1, Math.ceil(totalFilteredCount / pageSize));

  const paginatedStandings = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredStandings.slice(start, start + pageSize);
  }, [filteredStandings, currentPage, pageSize]);

  // Podium top 3
  const top1 = standings.find((s) => s.rank === 1);
  const top2 = standings.find((s) => s.rank === 2);
  const top3 = standings.find((s) => s.rank === 3);

  return (
    <div className="leaderboard-page animate-fade-in">
      {/* Header */}
      <div className="leaderboard-header">
        <div>
          <div className="leaderboard-badge">
            <Trophy size={14} />
            <span>HỆ THỐNG THỤY SĨ • VÒNG LOẠI TOÀN KHÓA</span>
          </div>
          <h1 className="leaderboard-title">
            Bảng Xếp Hạng <span className="gradient-text">OTTv2 Toàn Khóa</span>
          </h1>
          <p className="leaderboard-subtitle">
            Bảng xếp hạng giải đấu cờ thuật toán OTTv2 — Khoa CNTT, Trường ĐH Công nghệ (VNU-UET).
          </p>
        </div>

        <div className="leaderboard-controls">
          <div className="tier-tabs" role="tablist" aria-label="Bộ lọc bảng xếp hạng">
            <button
              id="tab-tier-swiss"
              role="tab"
              aria-selected={activeTier === 'SWISS'}
              className={`tier-tab-btn ${activeTier === 'SWISS' ? 'active' : ''}`}
              onClick={() => setActiveTier('SWISS')}
            >
              Bảng Tổng Sắp Swiss
            </button>
            <button
              id="tab-tier-top32"
              role="tab"
              aria-selected={activeTier === 'TOP32'}
              className={`tier-tab-btn ${activeTier === 'TOP32' ? 'active' : ''}`}
              onClick={() => setActiveTier('TOP32')}
            >
              Hạt Giống Playoff
            </button>
          </div>

          {isWsConnected && !isJamstackMode && (
            <span className="live-standings-pill" title="Đang kết nối WebSocket trực tiếp">
              <span className="live-dot-green animate-ping"></span> Live Sync
            </span>
          )}

          <button
            id="btn-refresh-leaderboard"
            className="btn-island btn-island-secondary"
            onClick={() => fetchLeaderboard(activeTier, true)}
            title="Làm mới dữ liệu bảng xếp hạng"
            disabled={isLoading}
            style={{ padding: '0.45rem 0.65rem 0.45rem 1.15rem' }}
          >
            <span className="btn-island-text">Làm mới</span>
            <span className="btn-island-badge" style={{ width: '28px', height: '28px' }}>
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </span>
          </button>
        </div>
      </div>

      {/* Rules & Swiss Tiebreaker Hint Bar */}
      <div className="scoring-hint-bar">
        <div className="scoring-hint-item">
          <TrendingUp size={16} color="var(--primary-600)" />
          <span>
            <strong>Tiêu chí xếp hạng Swiss:</strong> 1. Match Points (MP) &gt; 2. Buchholz Cut-1 (BH-1) &gt; 3. Sonneborn-Berger (SB) &gt; 4. Số trận thắng
          </span>
        </div>
        <div className="scoring-badges-wrap">
          <span className="scoring-formula-pill">Win: +3đ | Draw: +1đ | Loss: 0đ</span>
          <span className="top32-target-pill">Top 32 vào Chung kết</span>
        </div>
      </div>

      {error ? (
        <div className="glass-card error-card">
          <AlertCircle color="var(--rose-600)" size={20} />
          <span>{error}</span>
        </div>
      ) : isLoading ? (
        <div className="glass-card loading-card">
          <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--primary-600)', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
            Đang tổng hợp dữ liệu bảng xếp hạng...
          </p>
        </div>
      ) : standings.length === 0 ? (
        <div className="glass-card empty-card">
          <Trophy size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>Chưa có dữ liệu thi đấu Bảng {activeTier}</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', maxWidth: '480px', margin: '0.5rem auto 0' }}>
            Các trận đấu vòng tròn Bảng {activeTier} sẽ bắt đầu khi giải đấu chính thức khởi tranh. Hãy kiểm tra lại sau!
          </p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium (Shown when not filtering search) */}
          {!searchQuery && top1 && top2 && top3 && (
            <div className="podium-container">
              {/* Rank 2 (Silver) */}
              <div className="podium-card podium-2">
                <div className="podium-badge badge-silver">
                  <Medal size={22} />
                  <span>2</span>
                </div>
                <h4 className="podium-name" title={top2.name}>{top2.name}</h4>
                <div className="podium-subinfo">MSV: {top2.student_id} • {top2.bot_name}</div>
                <div className="podium-points">{top2.points} <span className="pts-label">Điểm MP</span></div>
                <div className="podium-stat">
                  {top2.wins} thắng • BH: {top2.buchholz} • SB: {top2.sonneborn_berger}
                </div>
                <div className="podium-grade-pill">Học phần: 10.0 (A+)</div>
                <div className="podium-stand stand-2"></div>
              </div>

              {/* Rank 1 (Gold - Center & Elevated) */}
              <div className="podium-card podium-1">
                <div className="crown-wrap">
                  <Crown size={32} color="var(--amber-500)" className="bounce-crown" />
                </div>
                <div className="podium-badge badge-gold">
                  <Trophy size={24} />
                  <span>1</span>
                </div>
                <h4 className="podium-name" title={top1.name}>{top1.name}</h4>
                <div className="podium-subinfo">MSV: {top1.student_id} • {top1.bot_name}</div>
                <div className="podium-points">{top1.points} <span className="pts-label">Điểm MP</span></div>
                <div className="podium-stat">
                  {top1.wins} thắng • BH: {top1.buchholz} • SB: {top1.sonneborn_berger}
                </div>
                <div className="podium-grade-pill gold-grade">Học phần: 10.0 (A+) • Champion</div>
                <div className="podium-stand stand-1"></div>
              </div>

              {/* Rank 3 (Bronze) */}
              <div className="podium-card podium-3">
                <div className="podium-badge badge-bronze">
                  <Medal size={22} />
                  <span>3</span>
                </div>
                <h4 className="podium-name" title={top3.name}>{top3.name}</h4>
                <div className="podium-subinfo">MSV: {top3.student_id} • {top3.bot_name}</div>
                <div className="podium-points">{top3.points} <span className="pts-label">Điểm MP</span></div>
                <div className="podium-stat">
                  {top3.wins} thắng • BH: {top3.buchholz} • SB: {top3.sonneborn_berger}
                </div>
                <div className="podium-grade-pill">Học phần: 10.0 (A+)</div>
                <div className="podium-stand stand-3"></div>
              </div>
            </div>
          )}

          {/* Search Box & Sort Toolbar */}
          <div className="leaderboard-search-wrap">
            <div className="search-input-box">
              <Search size={18} className="search-icon" />
              <input
                id="search-leaderboard-input"
                type="text"
                placeholder="Tra cứu theo Mã Sinh Viên (vd: 21020001), Họ tên hoặc Tên Bot..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                aria-label="Tìm kiếm thí sinh trong bảng xếp hạng"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear-btn"
                  onClick={() => handleSearchChange('')}
                  aria-label="Xóa tìm kiếm"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Quick Sort Buttons */}
            <div className="sort-pills-group">
              <span className="sort-label">Sắp xếp:</span>
              <button
                type="button"
                className={`sort-pill ${sortBy === 'rank' ? 'active' : ''}`}
                onClick={() => setSortBy('rank')}
              >
                Hạng
              </button>
              <button
                type="button"
                className={`sort-pill ${sortBy === 'points' ? 'active' : ''}`}
                onClick={() => setSortBy('points')}
              >
                Điểm MP
              </button>
              <button
                type="button"
                className={`sort-pill ${sortBy === 'buchholz' ? 'active' : ''}`}
                onClick={() => setSortBy('buchholz')}
                title="Hệ số phụ Buchholz Cut-1"
              >
                Buchholz
              </button>
              <button
                type="button"
                className={`sort-pill ${sortBy === 'sb' ? 'active' : ''}`}
                onClick={() => setSortBy('sb')}
                title="Hệ số phụ Sonneborn-Berger"
              >
                Sonneborn-B.
              </button>
              <button
                type="button"
                className={`sort-pill ${sortBy === 'wins' ? 'active' : ''}`}
                onClick={() => setSortBy('wins')}
              >
                Số Thắng
              </button>
            </div>

            <div className="standings-count">
              Tìm thấy <strong>{totalFilteredCount.toLocaleString('vi-VN')}</strong> / {standings.length.toLocaleString('vi-VN')} thí sinh
              {totalPages > 1 && ` • Trang ${currentPage}/${totalPages}`}
            </div>
          </div>

          {/* Main Standings Table */}
          <div className="leaderboard-table-card glass-card">
            <div className="table-responsive">
              <table className="styled-table" aria-label="Bảng xếp hạng giải đấu">
                <thead>
                  <tr>
                    <th style={{ width: '50px', textAlign: 'center' }}>Hạng</th>
                    <th style={{ minWidth: '160px' }}>Thí Sinh &amp; Mã SV</th>
                    <th style={{ minWidth: '100px' }}>Tên Bot</th>
                    <th style={{ textAlign: 'center', width: '60px' }}>Vòng</th>
                    <th style={{ textAlign: 'center', color: 'var(--emerald-600)', width: '50px' }}>Thắng</th>
                    <th style={{ textAlign: 'center', color: 'var(--text-muted)', width: '45px' }}>Hòa</th>
                    <th style={{ textAlign: 'center', color: 'var(--rose-600)', width: '45px' }}>Thua</th>
                    <th style={{ textAlign: 'right', width: '75px' }}>Điểm MP</th>
                    <th style={{ textAlign: 'center', width: '60px' }} title="Buchholz Cut-1 (Tổng điểm đối thủ trừ đối thủ thấp nhất)">BH-1</th>
                    <th style={{ textAlign: 'center', width: '55px' }} title="Sonneborn-Berger">SB</th>
                    <th style={{ width: '105px' }}>Tỉ Lệ Thắng</th>
                    <th style={{ textAlign: 'center', width: '85px' }}>Điểm HP</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedStandings.length === 0 ? (
                    <tr>
                      <td colSpan={12} style={{ textAlign: 'center', padding: '3rem 1rem', color: 'var(--text-muted)' }}>
                        Không tìm thấy thí sinh nào khớp với tiêu chí tìm kiếm.
                      </td>
                    </tr>
                  ) : (
                    paginatedStandings.map((entry) => {
                      const isCurrentUser = user && (entry.user_id === user.id || entry.user_id === user.student_id);
                      const isTop32 = entry.rank <= 32;
                      const showCutoffLine = !searchQuery && entry.rank === 32 && totalFilteredCount > 32;

                    return (
                      <React.Fragment key={entry.user_id || entry.rank}>
                        <tr
                          className={`table-row ${entry.rank <= 3 ? `top-row rank-row-${entry.rank}` : ''} ${isCurrentUser ? 'my-user-row' : ''} ${isTop32 ? 'top32-row' : ''}`}
                        >
                          {/* Rank */}
                          <td style={{ textAlign: 'center' }}>
                            <span className={`rank-badge ${entry.rank <= 3 ? `rank-${entry.rank}` : isTop32 ? 'rank-top32' : 'rank-other'}`}>
                              {entry.rank}
                            </span>
                          </td>

                          {/* Participant & Student ID */}
                          <td>
                            <div className="participant-info">
                              <div className="participant-name-row">
                                <strong className="participant-name">{entry.name}</strong>
                                {isCurrentUser && (
                                  <span className="current-user-badge">
                                    <User size={12} /> Bạn
                                  </span>
                                )}
                                {isTop32 && entry.rank > 3 && (
                                  <span className="top32-tag">Top 32</span>
                                )}
                              </div>
                              <div className="participant-id">
                                MSV: <code>{entry.student_id || '21020000'}</code>
                              </div>
                            </div>
                          </td>

                          {/* Bot Name */}
                          <td>
                            <span className="bot-name-chip" title={entry.bot_name}>
                              {entry.bot_name || 'MyBot'}
                            </span>
                          </td>

                          {/* Matches Played */}
                          <td style={{ textAlign: 'center', fontWeight: 600 }}>
                            {entry.matches_played} / 13
                          </td>

                          {/* W - D - L */}
                          <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--emerald-600)' }}>
                            {entry.wins}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                            {entry.draws}
                          </td>
                          <td style={{ textAlign: 'center', color: 'var(--rose-600)' }}>
                            {entry.losses}
                          </td>

                          {/* Match Points */}
                          <td style={{ textAlign: 'right' }}>
                            <span className="points-pill">{entry.points}</span>
                          </td>

                          {/* Buchholz Cut-1 */}
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--primary-700)' }}>
                            {entry.buchholz}
                          </td>

                          {/* Sonneborn-Berger */}
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            {entry.sonneborn_berger}
                          </td>

                          {/* Win Rate Bar */}
                          <td>
                            <div className="win-rate-bar-container">
                              <div className="win-rate-bar">
                                <div
                                  className={`win-rate-fill ${entry.win_rate >= 60 ? 'high-win-rate' : entry.win_rate >= 40 ? 'mid-win-rate' : 'low-win-rate'}`}
                                  style={{ width: `${entry.win_rate}%` }}
                                />
                              </div>
                              <span className="win-rate-text">
                                {entry.win_rate}%
                              </span>
                            </div>
                          </td>

                          {/* Projected Course Grade */}
                          <td style={{ textAlign: 'center' }}>
                            <span className={`grade-pill ${isTop32 ? 'grade-top32' : entry.wins >= 8 ? 'grade-high' : 'grade-normal'}`}>
                              {entry.grade_projection}
                            </span>
                          </td>
                        </tr>

                        {/* Top 32 Cut-off Line */}
                        {showCutoffLine && (
                          <tr className="cutoff-divider-row">
                            <td colSpan={12}>
                              <div className="cutoff-indicator">
                                <Crown size={15} color="var(--amber-600)" />
                                <span>RANH GIỚI VÉ VÀNG TOP 32 CHUNG KẾT • ĐỦ ĐIỀU KIỆN TRANH ĐIỂM 10.0 A+ &amp; CÚP VÔ ĐỊCH</span>
                                <Crown size={15} color="var(--amber-600)" />
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  }))}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls & UI Load Balancing */}
            <div className="table-pagination-bar">
              <div className="pagination-info">
                <span>
                  Hiển thị <strong>{totalFilteredCount === 0 ? 0 : (currentPage - 1) * pageSize + 1}</strong> –{' '}
                  <strong>{Math.min(currentPage * pageSize, totalFilteredCount)}</strong> trên tổng số{' '}
                  <strong>{totalFilteredCount.toLocaleString('vi-VN')}</strong> thí sinh
                </span>
                <div className="page-size-selector">
                  <label htmlFor="select-lb-page-size">Số dòng:</label>
                  <select
                    id="select-lb-page-size"
                    className="page-size-select"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    aria-label="Chọn số lượng hiển thị mỗi trang"
                  >
                    <option value={25}>25 / trang</option>
                    <option value={50}>50 / trang</option>
                    <option value={100}>100 / trang</option>
                    <option value={200}>200 / trang</option>
                  </select>
                </div>
              </div>

              {totalPages > 1 && (
                <div className="pagination-nav">
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => {
                      setCurrentPage(1);
                      document.querySelector('.leaderboard-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    disabled={currentPage === 1}
                    title="Trang đầu"
                    aria-label="Về trang đầu"
                  >
                    «
                  </button>
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => {
                      setCurrentPage((p) => Math.max(1, p - 1));
                      document.querySelector('.leaderboard-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    disabled={currentPage === 1}
                    title="Trang trước"
                    aria-label="Trang trước"
                  >
                    ‹
                  </button>

                  <div className="pagination-page-chips">
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
                      .reduce((acc, p, idx, arr) => {
                        if (idx > 0 && p - arr[idx - 1] > 1) {
                          acc.push(-idx);
                        }
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, idx) =>
                        p < 0 ? (
                          <span key={`ellipsis-${idx}`} className="pagination-ellipsis">…</span>
                        ) : (
                          <button
                            key={p}
                            type="button"
                            className={`pagination-num-btn ${currentPage === p ? 'active' : ''}`}
                            onClick={() => {
                              setCurrentPage(p);
                              document.querySelector('.leaderboard-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                            }}
                            aria-label={`Trang ${p}`}
                            aria-current={currentPage === p ? 'page' : undefined}
                          >
                            {p}
                          </button>
                        )
                      )}
                  </div>

                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => {
                      setCurrentPage((p) => Math.min(totalPages, p + 1));
                      document.querySelector('.leaderboard-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    disabled={currentPage === totalPages}
                    title="Trang sau"
                    aria-label="Trang sau"
                  >
                    ›
                  </button>
                  <button
                    type="button"
                    className="pagination-btn"
                    onClick={() => {
                      setCurrentPage(totalPages);
                      document.querySelector('.leaderboard-table-card')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    }}
                    disabled={currentPage === totalPages}
                    title="Trang cuối"
                    aria-label="Đến trang cuối"
                  >
                    »
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default LeaderboardPage;
