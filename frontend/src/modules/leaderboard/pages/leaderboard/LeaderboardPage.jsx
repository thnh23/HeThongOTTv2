import React, { useState, useEffect, useMemo } from 'react';
import {
  Trophy,
  RefreshCw,
  AlertCircle,
  Search,
  Medal,
  Crown,
  HelpCircle,
  TrendingUp,
  User,
  ArrowUpDown,
} from 'lucide-react';
import { apiClient, getWebSocketUrl } from '@/shared/api-client/index.js';
import { useAuth } from '@/shared/context/AuthContext.jsx';
import { useToast } from '@/shared/context/ToastContext.jsx';

import './LeaderboardPage.css';

export function LeaderboardPage() {
  const { user } = useAuth();
  const [activeTier, setActiveTier] = useState('A');
  const [standings, setStandings] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState('rank'); // 'rank', 'wins', 'win_rate'
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const { showToast } = useToast();

  const fetchLeaderboard = async (tier, isManual = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await apiClient.get(`/leaderboard?tier=${tier}`);
      setStandings(data || []);
      if (isManual) {
        showToast(`Đã làm mới bảng xếp hạng Bảng ${tier}!`, 'success');
      }
    } catch (err) {
      const msg = err.message || 'Không thể tải bảng xếp hạng';
      setError(msg);
      showToast(msg, 'error');
    } finally {
      setIsLoading(false);
    }
  };

  const [isWsConnected, setIsWsConnected] = useState(false);

  useEffect(() => {
    fetchLeaderboard(activeTier);
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
            showToast('Một trận đấu vừa kết thúc! Đang cập nhật điểm số...', 'info');
            fetchLeaderboard(activeTier);
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
  }, [activeTier, showToast]);

  // Filter & sort standings based on search query & sort setting
  const filteredStandings = useMemo(() => {
    let list = [...standings];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (s) =>
          s.name?.toLowerCase().includes(q) ||
          s.user_id?.toLowerCase().includes(q)
      );
    }

    if (sortBy === 'wins') {
      list.sort((a, b) => b.wins - a.wins);
    } else if (sortBy === 'win_rate') {
      list.sort((a, b) => b.win_rate - a.win_rate);
    } else {
      list.sort((a, b) => a.rank - b.rank);
    }

    return list;
  }, [standings, searchQuery, sortBy]);

  // Podium top 3
  const top1 = standings.find((s) => s.rank === 1);
  const top2 = standings.find((s) => s.rank === 2);
  const top3 = standings.find((s) => s.rank === 3);

  return (
    <div className="leaderboard-page animate-fade-in">
      {/* Header */}
      <div className="leaderboard-header">
        <div>
          <h1 style={{ fontSize: '2.2rem', display: 'flex', alignItems: 'center', gap: '0.6rem', margin: 0 }}>
            <Trophy color="var(--amber-400)" />
            <span>Bảng Xếp Hạng <span className="gradient-text">OTTv2</span></span>
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.35rem', fontSize: '0.95rem' }}>
            Hệ thống tính điểm chuẩn: Thắng (+3 điểm) • Hòa (+1 điểm) • Thua (0 điểm)
          </p>
        </div>

        <div className="leaderboard-controls">
          <div className="tier-tabs" role="tablist" aria-label="Chọn bảng đấu">
            {['A', 'B', 'C'].map((tier) => (
              <button
                key={tier}
                id={`tab-tier-${tier.toLowerCase()}`}
                role="tab"
                aria-selected={activeTier === tier}
                className={`tier-tab-btn ${activeTier === tier ? 'active' : ''}`}
                onClick={() => setActiveTier(tier)}
              >
                Bảng {tier}
              </button>
            ))}
          </div>

          {isWsConnected && (
            <span className="live-standings-pill" title="Đang kết nối WebSocket trực tiếp">
              <span className="live-dot-green animate-ping"></span> Live Sync
            </span>
          )}

          <button
            id="btn-refresh-leaderboard"
            className="btn btn-outline btn-sm"
            onClick={() => fetchLeaderboard(activeTier, true)}
            title="Làm mới dữ liệu"
            disabled={isLoading}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
        </div>
      </div>

      {/* Rules & Tiebreaker Hint Bar */}
      <div className="scoring-hint-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <TrendingUp size={16} color="var(--cyan-400)" />
          <span><strong>Tiêu chí xếp hạng:</strong> 1. Tổng điểm ➔ 2. Đối đầu trực tiếp ➔ 3. Tỉ lệ thắng</span>
        </div>
        <span className="scoring-formula-pill">Win: 3đ | Draw: 1đ | Loss: 0đ</span>
      </div>

      {error ? (
        <div className="glass-card" style={{ borderColor: 'var(--rose-500)', display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '2rem' }}>
          <AlertCircle color="var(--rose-500)" size={20} />
          <span>{error}</span>
        </div>
      ) : isLoading ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem 1rem', marginBottom: '2rem' }}>
          <RefreshCw className="animate-spin" size={32} style={{ color: 'var(--cyan-400)', margin: '0 auto 1rem' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Đang tổng hợp dữ liệu Bảng {activeTier}...</p>
        </div>
      ) : standings.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
          <Trophy size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>Chưa có dữ liệu thi đấu Bảng {activeTier}</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', maxWidth: '480px', margin: '0.5rem auto 0' }}>
            Các trận đấu vòng tròn Bảng {activeTier} sẽ bắt đầu khi giải đấu chính thức khởi tranh. Hãy kiểm tra lại sau!
          </p>
        </div>
      ) : (
        <>
          {/* Top 3 Podium (Only when not filtering and have at least 3) */}
          {!searchQuery && top1 && top2 && top3 && (
            <div className="podium-container">
              {/* Rank 2 (Silver) */}
              <div className="podium-card podium-2">
                <div className="podium-badge badge-silver">
                  <Medal size={20} />
                  <span>2</span>
                </div>
                <h4 className="podium-name">{top2.name}</h4>
                <div className="podium-points">{top2.points} <span className="pts-label">điểm</span></div>
                <div className="podium-stat">{top2.wins} thắng • {top2.win_rate}%</div>
                <div className="podium-stand stand-2"></div>
              </div>

              {/* Rank 1 (Gold - Center & Elevated) */}
              <div className="podium-card podium-1">
                <div className="crown-wrap">
                  <Crown size={28} color="var(--amber-400)" className="bounce-crown" />
                </div>
                <div className="podium-badge badge-gold">
                  <Trophy size={22} />
                  <span>1</span>
                </div>
                <h4 className="podium-name">{top1.name}</h4>
                <div className="podium-points">{top1.points} <span className="pts-label">điểm</span></div>
                <div className="podium-stat">{top1.wins} thắng • {top1.win_rate}%</div>
                <div className="podium-stand stand-1"></div>
              </div>

              {/* Rank 3 (Bronze) */}
              <div className="podium-card podium-3">
                <div className="podium-badge badge-bronze">
                  <Medal size={20} />
                  <span>3</span>
                </div>
                <h4 className="podium-name">{top3.name}</h4>
                <div className="podium-points">{top3.points} <span className="pts-label">điểm</span></div>
                <div className="podium-stat">{top3.wins} thắng • {top3.win_rate}%</div>
                <div className="podium-stand stand-3"></div>
              </div>
            </div>
          )}

          {/* Search Box & Sort Toolbar */}
          <div className="leaderboard-search-wrap">
            <div className="search-input-box" style={{ flex: 1, minWidth: '240px' }}>
              <Search size={18} className="search-icon" />
              <input
                id="search-leaderboard-input"
                type="text"
                placeholder="Tìm kiếm theo tên thí sinh hoặc bot..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Tìm kiếm thí sinh trong bảng xếp hạng"
              />
              {searchQuery && (
                <button
                  className="search-clear-btn"
                  onClick={() => setSearchQuery('')}
                  aria-label="Xóa tìm kiếm"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Quick Sort Buttons */}
            <div className="sort-pills-group">
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Xếp theo:</span>
              <button
                className={`sort-pill ${sortBy === 'rank' ? 'active' : ''}`}
                onClick={() => setSortBy('rank')}
              >
                Hạng
              </button>
              <button
                className={`sort-pill ${sortBy === 'wins' ? 'active' : ''}`}
                onClick={() => setSortBy('wins')}
              >
                Số Trận Thắng
              </button>
              <button
                className={`sort-pill ${sortBy === 'win_rate' ? 'active' : ''}`}
                onClick={() => setSortBy('win_rate')}
              >
                Tỉ Lệ Thắng
              </button>
            </div>

            <div className="standings-count">
              Hiển thị <strong>{filteredStandings.length}</strong> / {standings.length} thí sinh
            </div>
          </div>

          {/* Main Standings Table */}
          <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
            <div className="table-responsive" style={{ margin: 0 }}>
              <table className="styled-table" aria-label={`Bảng xếp hạng Bảng ${activeTier}`}>
                <thead>
                  <tr>
                    <th style={{ width: '80px', textAlign: 'center' }}>Hạng</th>
                    <th>Thí Sinh / Đội Thi</th>
                    <th style={{ textAlign: 'center' }}>Bảng</th>
                    <th style={{ textAlign: 'center' }}>Số Trận</th>
                    <th style={{ textAlign: 'center', color: 'var(--emerald-400)' }}>Thắng</th>
                    <th style={{ textAlign: 'center' }}>Hòa</th>
                    <th style={{ textAlign: 'center', color: 'var(--rose-500)' }}>Thua</th>
                    <th style={{ textAlign: 'right' }}>Tổng Điểm</th>
                    <th style={{ minWidth: '140px' }}>Tỉ Lệ Thắng</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStandings.map((entry) => {
                    const isCurrentUser = user && (entry.user_id === user.id || entry.user_id === user.student_id);
                    return (
                      <tr
                        key={entry.user_id}
                        className={`${entry.rank <= 3 ? `top-row rank-row-${entry.rank}` : ''} ${isCurrentUser ? 'my-user-row' : ''}`}
                      >
                        <td style={{ textAlign: 'center' }}>
                          <span className={`rank-badge ${entry.rank <= 3 ? `rank-${entry.rank}` : 'rank-other'}`}>
                            {entry.rank === 1 ? '🥇' : entry.rank === 2 ? '🥈' : entry.rank === 3 ? '🥉' : entry.rank}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                            <strong style={{ fontSize: '0.975rem', color: isCurrentUser ? 'var(--cyan-300)' : '#fff' }}>
                              {entry.name}
                            </strong>
                            {isCurrentUser && (
                              <span className="current-user-badge">
                                <User size={12} /> Bạn
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className={`tier-pill tier-${entry.tier}`}>
                            Bảng {entry.tier}
                          </span>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{entry.matches_played}</td>
                        <td style={{ textAlign: 'center', fontWeight: 700, color: 'var(--emerald-400)' }}>{entry.wins}</td>
                        <td style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{entry.draws}</td>
                        <td style={{ textAlign: 'center', color: 'var(--rose-500)' }}>{entry.losses}</td>
                        <td style={{ textAlign: 'right' }}>
                          <span className="points-pill">{entry.points}</span>
                        </td>
                        <td>
                          <div className="win-rate-bar-container">
                            <div className="win-rate-bar">
                              <div
                                className={`win-rate-fill ${entry.win_rate >= 60 ? 'high-win-rate' : entry.win_rate >= 40 ? 'mid-win-rate' : 'low-win-rate'}`}
                                style={{ width: `${entry.win_rate}%` }}
                              />
                            </div>
                            <span style={{ fontSize: '0.85rem', fontWeight: 600, width: '42px', textAlign: 'right' }}>
                              {entry.win_rate}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
