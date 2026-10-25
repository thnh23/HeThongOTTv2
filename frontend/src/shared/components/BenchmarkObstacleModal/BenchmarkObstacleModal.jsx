import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Shield,
  Gauge,
  CheckCircle2,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  Info,
  Terminal,
  Code2,
} from 'lucide-react';
import { BoardSVG } from '../BoardSVG/BoardSVG';
import { apiClient } from '@/shared/api-client/index.js';
import { useAuth } from '@/shared/context/AuthContext.jsx';
import './BenchmarkObstacleModal.css';


const DEFAULT_OBSTACLES = ['d4', 'd6', 'f4', 'f6', 'e5'];

export function BenchmarkObstacleModal({ isOpen, onClose, initialStudentId = '' }) {
  const { user } = useAuth();
  const [studentId, setStudentId] = useState('');
  const [obstacles, setObstacles] = useState(DEFAULT_OBSTACLES);
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  // Replay state
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef(null);

  // Tab mode: 'repo' (auto from MSSV) or 'code' (direct snippet)
  const [mode, setMode] = useState('repo');
  const [botCode, setBotCode] = useState('');

  useEffect(() => {
    if (isOpen) {
      if (initialStudentId) {
        setStudentId(initialStudentId);
      } else if (user?.student_id) {
        setStudentId(user.student_id);
      }
      // Load top 32 obstacles from public submit endpoint
      apiClient.get('/submit/benchmark-obstacle/config')
        .then(res => {
          if (res?.obstacles && Array.isArray(res.obstacles)) {
            setObstacles(res.obstacles);
          }
        })
        .catch(() => {
          // Keep defaults
        });
    } else {
      setIsPlaying(false);
      clearInterval(playIntervalRef.current);
    }
  }, [isOpen, user]);

  // Handle auto playback
  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentStepIndex(prev => {
          const maxSteps = result?.replay?.states?.length ? result.replay.states.length - 1 : 0;
          if (prev >= maxSteps) {
            setIsPlaying(false);
            return prev;
          }
          return prev + 1;
        });
      }, 700);
    } else {
      clearInterval(playIntervalRef.current);
    }
    return () => clearInterval(playIntervalRef.current);
  }, [isPlaying, result]);

  if (!isOpen) return null;

  const handleToggleObstacle = (sq) => {
    if (obstacles.includes(sq)) {
      setObstacles(obstacles.filter(o => o !== sq));
    } else {
      setObstacles([...obstacles, sq]);
    }
  };

  const handleResetObstacles = () => {
    setObstacles(DEFAULT_OBSTACLES);
  };

  const handleRunBenchmark = async () => {
    setIsRunning(true);
    setErrorMsg('');
    setResult(null);
    setCurrentStepIndex(0);
    setIsPlaying(false);

    try {
      const payload = {
        obstacles: obstacles,
      };

      if (mode === 'code' && botCode.trim()) {
        payload.bot_code = botCode;
      } else if (studentId.trim()) {
        payload.student_id = studentId.trim();
      }

      const res = await apiClient.post('/submit/benchmark-obstacle', payload);
      setResult(res);
      setCurrentStepIndex(0);
    } catch (err) {
      setErrorMsg(err.message || 'Không thể chạy benchmark. Hãy kiểm tra kết nối.');
    } finally {
      setIsRunning(false);
    }
  };

  // Extract replay current view
  const replayStates = result?.replay?.states || [];
  const replayMoves = result?.replay?.moves || [];
  const currentState = replayStates[currentStepIndex] || { obstacles: obstacles };
  const currentMove = currentStepIndex > 0 ? replayMoves[currentStepIndex - 1] : null;

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div className="benchmark-modal-container glass-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="benchmark-modal-header">
          <div className="header-title-wrap">
            <div className="benchmark-icon-badge">
              <Shield size={24} color="var(--amber-400)" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem' }}>Sandbox Benchmark Top 32</h2>
                <span className="badge-amber">Đổi Luật Ô Cản</span>
              </div>
              <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Thẩm định Bot v2 đối đầu ObstacleBot: Đo độ trễ tính toán (&le; 300ms) và kiểm tra tính tuân thủ ô cấm.
              </p>
            </div>
          </div>
          <button className="btn-icon-close" onClick={onClose} title="Đóng">
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="benchmark-modal-body">
          {/* Left Column: Config & Controls */}
          <div className="benchmark-controls-col">
            {/* Mode Selector */}
            <div className="mode-toggle-group">
              <button
                className={`mode-btn ${mode === 'repo' ? 'active' : ''}`}
                onClick={() => setMode('repo')}
              >
                <Terminal size={15} />
                <span>Kho Mã Nguồn (Repo)</span>
              </button>
              <button
                className={`mode-btn ${mode === 'code' ? 'active' : ''}`}
                onClick={() => setMode('code')}
              >
                <Code2 size={15} />
                <span>Dán Code bot.py Trực Tiếp</span>
              </button>
            </div>

            {mode === 'repo' ? (
              <div className="control-field">
                <label>Mã Sinh Viên (MSSV) của bạn:</label>
                <input
                  type="text"
                  className="benchmark-input"
                  placeholder="Ví dụ: 22028100..."
                  value={studentId}
                  onChange={e => setStudentId(e.target.value)}
                />
                <span className="field-hint">
                  Hệ thống tự động liên kết với repo <code>ottv2-{studentId || '<MaSV>'}</code> hoặc bản nộp đã thẩm định của bạn.
                </span>
              </div>
            ) : (
              <div className="control-field">
                <label>Mã nguồn Python có hàm <code>choose_move(state)</code>:</label>
                <textarea
                  className="benchmark-code-input"
                  rows={6}
                  placeholder={`def choose_move(state):\n    # Bot v2 né ô chướng ngại vật (state.obstacles)\n    moves = get_legal_moves(state)\n    return moves[0] if moves else ('', '')`}
                  value={botCode}
                  onChange={e => setBotCode(e.target.value)}
                />
              </div>
            )}

            {/* Obstacles config */}
            <div className="control-field">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label style={{ margin: 0 }}>Cấu Hình Ô Chướng Ngại Vật ({obstacles.length} ô):</label>
                <button className="btn-link-reset" onClick={handleResetObstacles}>
                  <RotateCcw size={12} />
                  <span>Khôi phục mặc định</span>
                </button>
              </div>
              <div className="obstacle-chips-wrap">
                {obstacles.map(sq => (
                  <span key={sq} className="obstacle-chip">
                    {sq}
                    <button onClick={() => handleToggleObstacle(sq)} title="Bỏ ô này">×</button>
                  </span>
                ))}
                {obstacles.length === 0 && (
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Chưa có ô cản nào</span>
                )}
              </div>
              <span className="field-hint">
                Ô cấm tiêu chuẩn Top 32: <code>d4, d6, f4, f6, e5</code>. Quân cờ không được phép đi vào các ô này.
              </span>
            </div>

            {/* Run Button */}
            <button
              className="btn btn-primary btn-run-benchmark"
              disabled={isRunning}
              onClick={handleRunBenchmark}
            >
              {isRunning ? (
                <>
                  <div className="spinner-border spinner-border-sm" />
                  <span>Đang chạy Sandbox Benchmark...</span>
                </>
              ) : (
                <>
                  <Sparkles size={18} />
                  <span>Khởi Chạy Benchmark (Sandbox Cô Lập)</span>
                </>
              )}
            </button>

            {errorMsg && (
              <div className="benchmark-error-banner animate-fade-in">
                <AlertTriangle size={16} color="var(--rose-400)" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Metrics Report (when finished) */}
            {result && (
              <div className="benchmark-metrics-card animate-fade-in">
                <h4 style={{ margin: '0 0 0.75rem', fontSize: '1rem', color: 'var(--amber-400)' }}>
                  Chỉ Số Hiệu Năng &amp; Tuân Thủ (Audit)
                </h4>

                <div className="metrics-grid">
                  <div className="metric-box">
                    <span className="metric-label">Độ trễ trung bình</span>
                    <strong className="metric-val">{result.average_move_time_ms} ms</strong>
                    <span className={`compliance-tag ${result.is_latency_compliant ? 'pass' : 'fail'}`}>
                      {result.is_latency_compliant ? 'Đạt chuẩn (≤300ms)' : 'Vượt 300ms (Thua T1)'}
                    </span>
                  </div>

                  <div className="metric-box">
                    <span className="metric-label">Tuân thủ ô cấm</span>
                    <strong className="metric-val">
                      {result.is_obstacle_compliant ? '100% Hợp lệ' : 'Vi phạm ô cản'}
                    </strong>
                    <span className={`compliance-tag ${result.is_obstacle_compliant ? 'pass' : 'fail'}`}>
                      {result.is_obstacle_compliant ? 'Không phạm luật' : 'Xử thua T1'}
                    </span>
                  </div>

                  <div className="metric-box">
                    <span className="metric-label">Kết quả vs ObstacleBot</span>
                    <strong className="metric-val">
                      {result.winner === 'W' ? 'Thắng (White)' : result.winner === 'B' ? 'Thua (Black)' : 'Hòa cờ'}
                    </strong>
                    <span className="compliance-tag info">
                      Mã: {result.end_code}
                    </span>
                  </div>

                  <div className="metric-box">
                    <span className="metric-label">Tổng số nước</span>
                    <strong className="metric-val">{result.total_moves} nước</strong>
                    <span className="compliance-tag info">
                      {result.duration_ms} ms
                    </span>
                  </div>
                </div>

                {result.reason && (
                  <div className="result-reason-text">
                    <Info size={14} color="var(--cyan-400)" style={{ flexShrink: 0, marginTop: '2px' }} />
                    <span>{result.reason}</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right Column: Board & Replay Viewer */}
          <div className="benchmark-board-col">
            <div className="board-preview-wrap">
              <BoardSVG
                boardState={currentState}
                obstacles={currentState.obstacles || obstacles}
                lastMove={currentMove ? { from: currentMove.from, to: currentMove.to } : null}
                size={420}
              />
            </div>

            {/* Replay Controller */}
            {result?.replay && (
              <div className="replay-controls-card">
                <div className="replay-info-row">
                  <span className="turn-label">
                    Nước {currentStepIndex} / {replayStates.length - 1}
                  </span>
                  {currentMove && (
                    <span className="move-detail-pill">
                      Lượt {currentMove.player === 'W' ? 'Trắng' : 'Đen'}: <strong>{currentMove.from} &rarr; {currentMove.to}</strong> ({currentMove.duration_ms}ms)
                    </span>
                  )}
                </div>

                <div className="replay-scrubber-row">
                  <input
                    type="range"
                    min={0}
                    max={replayStates.length > 0 ? replayStates.length - 1 : 0}
                    value={currentStepIndex}
                    onChange={e => setCurrentStepIndex(Number(e.target.value))}
                    className="replay-slider"
                  />
                </div>

                <div className="replay-btn-group">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setCurrentStepIndex(0)}
                    disabled={currentStepIndex === 0}
                    title="Về đầu ván"
                  >
                    <SkipBack size={15} />
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setCurrentStepIndex(prev => Math.max(0, prev - 1))}
                    disabled={currentStepIndex === 0}
                    title="Lùi 1 nước"
                  >
                    <ChevronLeft size={17} />
                  </button>
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => setIsPlaying(!isPlaying)}
                    title={isPlaying ? 'Tạm dừng' : 'Tự động chạy'}
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} />}
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setCurrentStepIndex(prev => Math.min(replayStates.length - 1, prev + 1))}
                    disabled={currentStepIndex >= replayStates.length - 1}
                    title="Tiến 1 nước"
                  >
                    <ChevronRight size={17} />
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => setCurrentStepIndex(replayStates.length - 1)}
                    disabled={currentStepIndex >= replayStates.length - 1}
                    title="Đến cuối ván"
                  >
                    <SkipForward size={15} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
