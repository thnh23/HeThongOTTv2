import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Swords,
  Clock,
  PlayCircle,
  Filter,
  RefreshCw,
  AlertCircle,
  Radio,
  Sparkles,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { useToast } from '@/shared/context/ToastContext.jsx';
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge.jsx';
import './MatchesListPage.css';

export function MatchesListPage() {
  const [matches, setMatches] = useState([]);
  const [tierFilter, setTierFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSimulating, setIsSimulating] = useState(false);
  const [error, setError] = useState(null);

  const { showToast } = useToast();
  const navigate = useNavigate();

  const fetchMatches = async (isManual = false) => {
    setIsLoading(true);
    setError(null);
    try {
      let path = '/matches?page=1&page_size=50';
      if (tierFilter) path += `&tier=${tierFilter}`;
      if (statusFilter) path += `&status=${statusFilter}`;

      const res = await apiClient.get(path);
      setMatches(res.items || []);
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
  }, [tierFilter, statusFilter]);

  // Launch a new live simulated match
  const handleLaunchLiveMatch = async () => {
    setIsSimulating(true);
    try {
      showToast('Đang khởi tạo trận đấu Live giữa GreedyBot và RandomBot...', 'info');
      const res = await apiClient.post('/matches/simulate', {
        tier: 'A',
        bot_a_name: 'GreedyBot (White)',
        bot_b_name: 'RandomBot (Black)',
        move_delay_sec: 0.6,
      });

      showToast('Trận đấu đã bắt đầu! Đang mở luồng xem trực tiếp...', 'success');
      navigate(`/matches/${res.match_id}/live`);
    } catch (err) {
      showToast('Không thể khởi chạy trận đấu: ' + err.message, 'error');
    } finally {
      setIsSimulating(false);
    }
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
          <button
            id="btn-launch-live-match"
            className="btn btn-primary"
            onClick={handleLaunchLiveMatch}
            disabled={isSimulating}
          >
            {isSimulating ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                <span>Đang khởi chạy...</span>
              </>
            ) : (
              <>
                <Radio size={16} color="#fff" className="animate-pulse" />
                <span>Khởi Chạy Trận Đấu Live</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <select
          id="select-filter-tier"
          className="select-filter"
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
        >
          <option value="">Tất cả Bảng</option>
          <option value="A">Bảng A</option>
          <option value="B">Bảng B</option>
          <option value="C">Bảng C</option>
        </select>

        <select
          id="select-filter-status"
          className="select-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Tất cả Trạng thái</option>
          <option value="running">🔴 Đang diễn ra (Live)</option>
          <option value="done">Đã hoàn thành</option>
          <option value="pending">Chờ đấu</option>
        </select>

        <button
          id="btn-refresh-matches"
          className="btn btn-outline btn-sm"
          onClick={() => fetchMatches(true)}
          disabled={isLoading}
        >
          <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
          <span>Làm mới</span>
        </button>
      </div>

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
      ) : matches.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '3.5rem' }}>
          <Swords size={48} style={{ color: 'var(--text-muted)', margin: '0 auto 1rem', opacity: 0.5 }} />
          <h3>Không có trận đấu nào phù hợp</h3>
          <p style={{ color: 'var(--text-muted)', marginTop: '0.5rem', marginBottom: '1.5rem' }}>
            Hãy bấm vào nút "Khởi Chạy Trận Đấu Live" ở trên để tạo một trận đấu trực tiếp mẫu!
          </p>
          <button className="btn btn-primary btn-sm" onClick={handleLaunchLiveMatch}>
            <Radio size={15} />
            <span>Tạo Trận Đấu Mẫu Ngay</span>
          </button>
        </div>
      ) : (
        <div className="matches-grid">
          {matches.map((m) => (
            <div key={m.id} className="glass-card match-card">
              <div className="match-opponents">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <span className={`tier-pill tier-${m.tier}`}>Bảng {m.tier}</span>
                  {m.status === 'running' && (
                    <span className="live-pill">
                      <span className="live-dot animate-ping"></span> LIVE
                    </span>
                  )}
                </div>

                <div className="bot-tag bot-white-tag">
                  <span className="mini-tag mini-tag-white">W</span>
                  <span className="bot-name">{m.bot_a_name || 'Bot White'}</span>
                </div>

                <span className="vs-badge">VS</span>

                <div className="bot-tag bot-black-tag">
                  <span className="mini-tag mini-tag-black">B</span>
                  <span className="bot-name">{m.bot_b_name || 'Bot Black'}</span>
                </div>
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
                  <div style={{ display: 'flex', gap: '0.4rem' }}>
                    <Link
                      id={`btn-view-match-${m.id}`}
                      to={`/matches/${m.id}`}
                      className="btn btn-outline btn-sm"
                    >
                      <PlayCircle size={15} />
                      <span>Xem Replay</span>
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
          ))}
        </div>
      )}
    </div>
  );
}
