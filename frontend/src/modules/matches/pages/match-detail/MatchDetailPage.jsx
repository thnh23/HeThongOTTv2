import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Clock,
  Trophy,
  AlertCircle,
  RefreshCw,
  Keyboard,
  Info,
  Download,
  Radio,
} from 'lucide-react';
import { apiClient } from '@/shared/api-client/index.js';
import { useToast } from '@/shared/context/ToastContext.jsx';
import { BoardSVG } from '@/shared/components/BoardSVG/BoardSVG.jsx';
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge.jsx';
import './MatchDetailPage.css';

const END_CODE_EXPLANATIONS = {
  W1: 'Trắng Thắng do Đen mất toàn bộ quân Kéo (✂️)',
  W2: 'Trắng Thắng do Đen mất toàn bộ quân Búa (👊)',
  W3: 'Trắng Thắng do Đen mất toàn bộ quân Bao (✋)',
  W4: 'Trắng Thắng do Đen không còn nước đi hợp lệ',
  W5: 'Trắng Thắng do Đen quá thời gian (Timeout)',
  W6: 'Trắng Thắng do Đen vi phạm quy tắc / lỗi mã nguồn',
  B1: 'Đen Thắng do Trắng mất toàn bộ quân Kéo (✂️)',
  B2: 'Đen Thắng do Trắng mất toàn bộ quân Búa (👊)',
  B3: 'Đen Thắng do Trắng mất toàn bộ quân Bao (✋)',
  B4: 'Đen Thắng do Trắng không còn nước đi hợp lệ',
  B5: 'Đen Thắng do Trắng quá thời gian (Timeout)',
  B6: 'Đen Thắng do Trắng vi phạm quy tắc / lỗi mã nguồn',
  T1: 'Hòa cờ do đạt tối đa 200 nước đi (T1)',
  T2: 'Hòa cờ do lặp lại trạng thái 3 lần (3-fold repetition)',
  T3: 'Hòa cờ do cả hai bên không còn khả năng ăn quân đối phương',
};

export function MatchDetailPage() {
  const { id } = useParams();
  const { showToast } = useToast();
  const [replay, setReplay] = useState(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const timerRef = useRef(null);
  const activeMoveItemRef = useRef(null);

  const handleExportReplay = () => {
    if (!replay) return;
    try {
      const jsonString = `data:text/json;charset=utf-8,${encodeURIComponent(
        JSON.stringify(replay, null, 2)
      )}`;
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', jsonString);
      downloadAnchor.setAttribute('download', `replay_${replay.match_id || id}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      showToast('Đã tải xuống file Replay JSON thành công!', 'success');
    } catch {
      showToast('Không thể tải file Replay', 'error');
    }
  };

  useEffect(() => {
    async function loadReplay() {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiClient.get(`/matches/${id}/replay`);
        setReplay(data);
        setCurrentStep(data.states?.length > 0 ? data.states.length - 1 : 0);
      } catch (err) {
        setError(err.message || 'Không thể tải Replay trận đấu');
      } finally {
        setIsLoading(false);
      }
    }
    loadReplay();
  }, [id]);

  // Auto-play animation loop
  useEffect(() => {
    if (!isPlaying || !replay) return;

    const intervalMs = Math.round(1000 / speed);
    timerRef.current = setInterval(() => {
      setCurrentStep((prev) => {
        if (prev >= replay.states.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, intervalMs);

    return () => clearInterval(timerRef.current);
  }, [isPlaying, speed, replay]);

  // Auto-scroll active move item into view
  useEffect(() => {
    if (activeMoveItemRef.current) {
      activeMoveItemRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
      });
    }
  }, [currentStep]);

  // Keyboard navigation shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Don't intercept if user is typing in an input
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;

      const total = replay?.moves?.length || 0;

      if (e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((p) => !p);
      } else if (e.code === 'ArrowLeft') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentStep((p) => Math.max(0, p - 1));
      } else if (e.code === 'ArrowRight') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentStep((p) => Math.min(total, p + 1));
      } else if (e.code === 'Home') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentStep(0);
      } else if (e.code === 'End') {
        e.preventDefault();
        setIsPlaying(false);
        setCurrentStep(total);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [replay]);

  const currentBoardState = replay?.states?.[currentStep] || {};
  const currentMove = currentStep > 0 ? replay?.moves?.[currentStep - 1] : null;
  const totalMoves = replay?.moves?.length || 0;

  // Calculate remaining piece counts for White and Black
  const pieceCounts = useMemo(() => {
    if (!currentBoardState.board) {
      return { white: { R: 2, S: 2, P: 2 }, black: { r: 2, s: 2, p: 2 } };
    }
    const counts = {
      white: { R: 0, S: 0, P: 0 },
      black: { r: 0, s: 0, p: 0 },
    };
    for (const row of currentBoardState.board) {
      for (const ch of row) {
        if (ch === 'R') counts.white.R++;
        else if (ch === 'S') counts.white.S++;
        else if (ch === 'P') counts.white.P++;
        else if (ch === 'r') counts.black.r++;
        else if (ch === 's') counts.black.s++;
        else if (ch === 'p') counts.black.p++;
      }
    }
    return counts;
  }, [currentBoardState]);

  if (isLoading) {
    return (
      <div className="glass-card" style={{ textAlign: 'center', padding: '4rem 1rem' }}>
        <RefreshCw size={32} className="animate-spin" style={{ color: 'var(--cyan-400)', margin: '0 auto 1rem' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Đang tải dữ liệu Replay ván đấu...</p>
      </div>
    );
  }

  if (error || !replay) {
    return (
      <div className="glass-card" style={{ borderColor: 'var(--rose-500)', textAlign: 'center', padding: '3rem 1rem' }}>
        <AlertCircle size={40} color="var(--rose-500)" style={{ margin: '0 auto 1rem' }} />
        <h3>{error || 'Không tìm thấy dữ liệu trận đấu'}</h3>
        <div style={{ marginTop: '1.5rem' }}>
          <Link to="/matches" className="btn btn-outline btn-sm">
            <ArrowLeft size={16} />
            <span>Quay lại danh sách</span>
          </Link>
        </div>
      </div>
    );
  }

  const endExplanation = END_CODE_EXPLANATIONS[replay.end_code] || `Kết thúc với mã ${replay.end_code}`;

  return (
    <div className="match-detail-page animate-fade-in">
      {/* Top Header Bar */}
      <div className="match-detail-nav">
        <Link to="/matches" className="btn btn-outline btn-sm">
          <ArrowLeft size={16} />
          <span>Danh sách trận</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          <button
            id="btn-export-replay-json"
            className="btn btn-outline btn-sm"
            onClick={handleExportReplay}
            title="Tải xuống toàn bộ file Replay định dạng JSON"
          >
            <Download size={15} />
            <span>Xuất JSON</span>
          </button>
          <span className={`tier-pill tier-${replay.tier}`}>Bảng {replay.tier}</span>
          <StatusBadge status={replay.end_code} />
        </div>
      </div>

      {/* Match Matchup Banner with Live Piece Count */}
      <div className="glass-card matchup-banner">
        {/* White Team */}
        <div className="player-summary player-white">
          <div className="team-avatar white-avatar">W</div>
          <div>
            <div className="player-title">{replay.bot_a_name || 'Bot White'}</div>
            <div className="player-subtitle">Quân Trắng (Đi trước)</div>
            {/* White Remaining Pieces */}
            <div className="piece-pills">
              <span className={`piece-pill ${pieceCounts.white.R === 0 ? 'zero' : ''}`} title="Búa (R)">
                👊 {pieceCounts.white.R}/2
              </span>
              <span className={`piece-pill ${pieceCounts.white.S === 0 ? 'zero' : ''}`} title="Kéo (S)">
                ✂️ {pieceCounts.white.S}/2
              </span>
              <span className={`piece-pill ${pieceCounts.white.P === 0 ? 'zero' : ''}`} title="Bao (P)">
                ✋ {pieceCounts.white.P}/2
              </span>
            </div>
          </div>
        </div>

        {/* Center Match Outcome */}
        <div className="matchup-center-outcome">
          <div className="outcome-text">
            {replay.winner === 'W' ? (
              <span className="text-white-win">Trắng Thắng 🏆</span>
            ) : replay.winner === 'B' ? (
              <span className="text-black-win">Đen Thắng 🏆</span>
            ) : (
              <span className="text-draw">Hòa Cờ 🤝</span>
            )}
          </div>
          <div className="outcome-subtext">
            {replay.total_moves} nước đi • {(replay.duration_ms / 1000).toFixed(2)}s
          </div>
          <div className="end-reason-badge" title={endExplanation}>
            <Info size={13} />
            <span>{endExplanation}</span>
          </div>
        </div>

        {/* Black Team */}
        <div className="player-summary player-black">
          <div className="team-avatar black-avatar">B</div>
          <div style={{ textAlign: 'right' }}>
            <div className="player-title text-cyan">{replay.bot_b_name || 'Bot Black'}</div>
            <div className="player-subtitle">Quân Đen</div>
            {/* Black Remaining Pieces */}
            <div className="piece-pills" style={{ justifyContent: 'flex-end' }}>
              <span className={`piece-pill ${pieceCounts.black.r === 0 ? 'zero' : ''}`} title="Búa (r)">
                👊 {pieceCounts.black.r}/2
              </span>
              <span className={`piece-pill ${pieceCounts.black.s === 0 ? 'zero' : ''}`} title="Kéo (s)">
                ✂️ {pieceCounts.black.s}/2
              </span>
              <span className={`piece-pill ${pieceCounts.black.p === 0 ? 'zero' : ''}`} title="Bao (p)">
                ✋ {pieceCounts.black.p}/2
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Keyboard Shortcuts Prompt */}
      <div className="keyboard-hints-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
          <Keyboard size={15} color="var(--cyan-400)" />
          <span><strong>Phím tắt điều khiển:</strong></span>
        </div>
        <div className="key-badges">
          <span><kbd>Space</kbd> Phát / Dừng</span>
          <span><kbd>←</kbd> Nước trước</span>
          <span><kbd>→</kbd> Nước sau</span>
          <span><kbd>Home</kbd> Đầu trận</span>
          <span><kbd>End</kbd> Cuối trận</span>
        </div>
      </div>

      {/* Replay Player Layout */}
      <div className="replay-layout">
        {/* Left Col: Board & Player Controls */}
        <div className="replay-board-col">
          <BoardSVG
            boardState={currentBoardState}
            lastMove={currentMove}
            size={520}
          />

          {/* Controls Bar */}
          <div className="glass-card replay-controls">
            {/* Scrubber slider */}
            <div className="scrubber-container">
              <span className="step-counter-text">
                Nước {currentStep}/{totalMoves}
              </span>
              <input
                id="replay-slider"
                type="range"
                min="0"
                max={totalMoves}
                value={currentStep}
                onChange={(e) => {
                  setIsPlaying(false);
                  setCurrentStep(parseInt(e.target.value, 10));
                }}
                className="replay-slider"
                aria-label="Thanh trượt nước đi Replay"
              />
            </div>

            {/* Playback action buttons */}
            <div className="playback-buttons">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <button
                  id="btn-replay-start"
                  className="btn btn-outline btn-sm"
                  onClick={() => { setIsPlaying(false); setCurrentStep(0); }}
                  title="Về đầu ván (Home)"
                  aria-label="Về đầu ván"
                >
                  <SkipBack size={15} />
                </button>
                <button
                  id="btn-replay-prev"
                  className="btn btn-outline btn-sm"
                  onClick={() => { setIsPlaying(false); setCurrentStep((p) => Math.max(0, p - 1)); }}
                  title="Nước trước (←)"
                  aria-label="Nước trước"
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  id="btn-replay-play"
                  className="btn btn-primary btn-sm"
                  style={{ minWidth: '95px' }}
                  onClick={() => setIsPlaying(!isPlaying)}
                  title="Phát/Tạm dừng (Space)"
                  aria-label={isPlaying ? 'Tạm dừng replay' : 'Phát replay'}
                >
                  {isPlaying ? <><Pause size={15} /> Tạm dừng</> : <><Play size={15} /> Phát</>}
                </button>
                <button
                  id="btn-replay-next"
                  className="btn btn-outline btn-sm"
                  onClick={() => { setIsPlaying(false); setCurrentStep((p) => Math.min(totalMoves, p + 1)); }}
                  title="Nước sau (→)"
                  aria-label="Nước sau"
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  id="btn-replay-end"
                  className="btn btn-outline btn-sm"
                  onClick={() => { setIsPlaying(false); setCurrentStep(totalMoves); }}
                  title="Đến cuối ván (End)"
                  aria-label="Đến cuối ván"
                >
                  <SkipForward size={15} />
                </button>
              </div>

              {/* Speed selector */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <label htmlFor="select-replay-speed" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Tốc độ:
                </label>
                <select
                  id="select-replay-speed"
                  className="speed-select"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                >
                  <option value="0.5">0.5x</option>
                  <option value="1">1.0x</option>
                  <option value="2">2.0x</option>
                  <option value="4">4.0x</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Right Col: Move History Sidebar */}
        <div className="glass-card moves-sidebar">
          <div className="moves-header">
            <span>Nhật Ký Nước Đi ({totalMoves})</span>
            <Clock size={16} color="var(--text-muted)" />
          </div>

          <ul className="moves-list" role="list">
            <li
              ref={currentStep === 0 ? activeMoveItemRef : null}
              className={`move-item ${currentStep === 0 ? 'active' : ''}`}
              onClick={() => { setIsPlaying(false); setCurrentStep(0); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  setIsPlaying(false);
                  setCurrentStep(0);
                }
              }}
            >
              <span>Vị trí ban đầu</span>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>00</span>
            </li>

            {replay.moves?.map((m, idx) => {
              const stepIndex = idx + 1;
              const isSelected = currentStep === stepIndex;
              return (
                <li
                  key={`move-${stepIndex}`}
                  ref={isSelected ? activeMoveItemRef : null}
                  className={`move-item ${isSelected ? 'active' : ''}`}
                  onClick={() => { setIsPlaying(false); setCurrentStep(stepIndex); }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setIsPlaying(false);
                      setCurrentStep(stepIndex);
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{
                      fontWeight: 700,
                      color: m.player === 'W' ? '#fff' : '#38BDF8',
                      fontSize: '0.8rem',
                      width: '18px',
                    }}>
                      {m.player === 'W' ? 'W' : 'B'}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                      {m.from} → {m.to}
                    </span>
                    {m.captured && (
                      <span className="captured-piece-tag">
                        ăn {m.captured === 'R' ? 'Búa 👊' : m.captured === 'S' ? 'Kéo ✂️' : 'Bao ✋'}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    #{stepIndex}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
