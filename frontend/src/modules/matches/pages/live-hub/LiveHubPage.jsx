import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Radio,
  Swords,
  PlayCircle,
  RefreshCw,
  Clock,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { useToast } from '@/shared/context/ToastContext.jsx';
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge.jsx';
import './LiveHubPage.css';

export function LiveHubPage() {
  const [runningMatches, setRunningMatches] = useState([]);
  const [recentDoneMatches, setRecentDoneMatches] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const fetchLiveMatches = async () => {
    setIsLoading(true);
    try {
      const [runningRes, doneRes] = await Promise.all([
        apiClient.get('/matches?status=running&page_size=10'),
        apiClient.get('/matches?status=done&page_size=6'),
      ]);
      const running = runningRes.items || [];
      setRunningMatches(running);
      setRecentDoneMatches(doneRes.items || []);

      // If exactly 1 match is running, optionally redirect or inform user
      if (running.length === 1) {
        // Just inform or let user choose
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchLiveMatches();
    const interval = setInterval(fetchLiveMatches, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleLaunchLiveSimulate = async () => {
    setIsSimulating(true);
    try {
      showToast('Đang khởi tạo trận đấu Live giữa GreedyBot và RandomBot...', 'info');
      const res = await apiClient.post('/matches/simulate', {
        tier: 'A',
        bot_a_name: 'GreedyBot (White)',
        bot_b_name: 'RandomBot (Black)',
        move_delay_sec: 0.6,
      });

      showToast('Trận đấu đã bắt đầu! Đang mở phòng xem trực tiếp...', 'success');
      navigate(`/matches/${res.match_id}/live`);
    } catch (err) {
      showToast('Không thể khởi chạy trận đấu: ' + err.message, 'error');
    } finally {
      setIsSimulating(false);
    }
  };

  return (
    <div className="live-hub-page animate-fade-in">
      <div className="live-hub-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div className="live-hub-pulse-badge">
              <Radio size={20} color="#fff" className="animate-pulse" />
            </div>
            <h1 style={{ fontSize: '2.2rem', margin: 0 }}>
              Kênh Trực Tiếp <span className="gradient-text">Ván Đấu Live (WebSocket)</span>
            </h1>
          </div>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.4rem', fontSize: '1rem' }}>
            Theo dõi từng nước cờ thời gian thực qua giao thức WebSocket streaming với độ trễ thấp.
          </p>
        </div>

        <div className="live-hub-actions">
          <button
            id="btn-live-hub-refresh"
            className="btn btn-outline btn-sm"
            onClick={fetchLiveMatches}
            disabled={isLoading}
          >
            <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
            <span>Làm mới</span>
          </button>
          <button
            id="btn-live-hub-simulate"
            className="btn btn-primary btn-sm"
            onClick={handleLaunchLiveSimulate}
            disabled={isSimulating}
          >
            {isSimulating ? (
              <>
                <RefreshCw size={15} className="animate-spin" />
                <span>Đang khởi tạo...</span>
              </>
            ) : (
              <>
                <Radio size={15} className="animate-pulse" />
                <span>Khởi Chạy Trận Đấu Mẫu</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Active Live Matches Section */}
      <div className="live-section-wrap">
        <div className="section-title-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="live-dot animate-ping"></span>
            <h2 style={{ fontSize: '1.3rem', margin: 0 }}>
              Đang Phát Trực Tiếp ({runningMatches.length})
            </h2>
          </div>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Tự động cập nhật mỗi 5 giây
          </span>
        </div>

        {isLoading && runningMatches.length === 0 ? (
          <div className="glass-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <RefreshCw className="animate-spin" size={28} style={{ color: 'var(--cyan-400)', margin: '0 auto 1rem' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Đang tìm kiếm luồng phát trực tiếp...</p>
          </div>
        ) : runningMatches.length === 0 ? (
          <div className="glass-card empty-live-card">
            <Radio size={48} color="var(--rose-400)" style={{ margin: '0 auto 1rem', opacity: 0.6 }} />
            <h3>Hiện không có trận đấu nào đang phát sóng</h3>
            <p style={{ color: 'var(--text-secondary)', maxWidth: '520px', margin: '0.5rem auto 1.5rem', lineHeight: 1.6 }}>
              Giải đấu đang tạm nghỉ giữa các cặp đấu, hoặc chưa có trận mới được khởi chạy. Bạn có thể bấm nút bên dưới để tạo ngay 1 trận live mô phỏng giữa GreedyBot và RandomBot!
            </p>
            <button className="btn btn-primary" onClick={handleLaunchLiveSimulate} disabled={isSimulating}>
              <Radio size={16} />
              <span>Khởi Chạy 1 Trận Đấu Mẫu Ngay</span>
            </button>
          </div>
        ) : (
          <div className="live-matches-grid">
            {runningMatches.map((m) => (
              <div key={m.id} className="glass-card live-match-card-active">
                <div className="live-card-badge-row">
                  <span className={`tier-pill tier-${m.tier}`}>Bảng {m.tier}</span>
                  <span className="live-status-pill">
                    <span className="live-dot animate-ping" />
                    <span>ĐANG TRỰC TIẾP</span>
                  </span>
                </div>

                <div className="live-card-players">
                  <div className="live-player-item white">
                    <span className="player-side-icon">⚪</span>
                    <span className="player-label-name">{m.bot_a_name || 'Bot White'}</span>
                  </div>
                  <span className="live-vs-text">VS</span>
                  <div className="live-player-item black">
                    <span className="player-side-icon">🔴</span>
                    <span className="player-label-name">{m.bot_b_name || 'Bot Black'}</span>
                  </div>
                </div>

                <div className="live-card-meta">
                  <div className="meta-point">
                    <Clock size={14} />
                    <span>{m.total_moves} nước đi</span>
                  </div>
                  <Link
                    id={`btn-open-live-${m.id}`}
                    to={`/matches/${m.id}/live`}
                    className="btn btn-primary btn-sm"
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <Radio size={15} className="animate-pulse" />
                    <span>Vào Xem Trực Tiếp</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recently Completed Matches */}
      {recentDoneMatches.length > 0 && (
        <div className="recent-done-section">
          <div className="section-title-row">
            <h2 style={{ fontSize: '1.25rem', margin: 0 }}>Ván Đấu Vừa Hoàn Thành</h2>
            <Link to="/matches" className="view-all-link">
              <span>Xem tất cả trận đấu</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          <div className="recent-matches-grid">
            {recentDoneMatches.map((m) => (
              <div key={m.id} className="glass-card recent-match-card">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                  <span className={`tier-pill tier-${m.tier}`}>Bảng {m.tier}</span>
                  <StatusBadge status={m.end_code || 'done'} />
                </div>

                <div className="recent-opponents-text">
                  <span style={{ fontWeight: m.winner === 'W' ? 700 : 400, color: m.winner === 'W' ? 'var(--cyan-400)' : 'inherit' }}>
                    {m.bot_a_name} {m.winner === 'W' && '🏆'}
                  </span>
                  <span className="vs-muted">vs</span>
                  <span style={{ fontWeight: m.winner === 'B' ? 700 : 400, color: m.winner === 'B' ? 'var(--cyan-400)' : 'inherit' }}>
                    {m.bot_b_name} {m.winner === 'B' && '🏆'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '0.75rem' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    {m.total_moves} nước
                  </span>
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Link to={`/matches/${m.id}`} className="btn btn-outline btn-xs">
                      <PlayCircle size={13} />
                      <span>Replay</span>
                    </Link>
                    <Link to={`/matches/${m.id}/live`} className="btn btn-outline btn-xs" title="Xem lại luồng Live">
                      <Radio size={12} />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
