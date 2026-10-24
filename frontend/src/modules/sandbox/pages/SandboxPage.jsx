import React, { useState, useEffect, useRef } from 'react';
import {
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
  Code2,
  Cpu,
  Trash2,
  Layers,
  Clock,
  Swords,
  Award,
} from 'lucide-react';
import { BoardSVG } from '@/shared/components/BoardSVG/BoardSVG.jsx';
import { INITIAL_BOARD } from '@/shared/constants/gameState.js';
import { apiClient } from '@/shared/api-client/index.js';
import './SandboxPage.css';

const DEFAULT_OBSTACLES = ['d4', 'd6', 'f4', 'f6', 'e5'];

export function SandboxPage() {
  const [activeTab, setActiveTab] = useState('standard'); // 'standard' | 'obstacle'
  const [standardOpponent, setStandardOpponent] = useState('greedy'); // 'greedy' | 'random'
  const [botCode, setBotCode] = useState('');
  const [obstacles, setObstacles] = useState(DEFAULT_OBSTACLES);

  // Execution & Replay
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef(null);

  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setResult(null);
    setErrorMsg('');
    setCurrentStepIndex(0);
    setIsPlaying(false);
  };

  useEffect(() => {
    if (isPlaying) {
      playIntervalRef.current = setInterval(() => {
        setCurrentStepIndex((prev) => {
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

  const handleRunTest = async () => {
    if (!botCode.trim()) {
      setErrorMsg('Vui lòng dán mã nguồn bot.py có hàm choose_move(state).');
      return;
    }

    setIsRunning(true);
    setErrorMsg('');
    setResult(null);
    setCurrentStepIndex(0);
    setIsPlaying(false);

    try {
      const payload = {
        mode: activeTab,
        opponent: activeTab === 'obstacle' ? 'obstacle' : standardOpponent,
        bot_code: botCode,
        obstacles: activeTab === 'obstacle' ? obstacles : [],
      };

      const res = await apiClient.post('/submit/benchmark-sandbox', payload);
      setResult(res);
      setCurrentStepIndex(0);
    } catch (err) {
      setErrorMsg(err.message || 'Lỗi thực thi. Kiểm tra lại mã nguồn.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleToggleObstacle = (sq) => {
    if (obstacles.includes(sq)) {
      setObstacles(obstacles.filter((o) => o !== sq));
    } else {
      setObstacles([...obstacles, sq]);
    }
  };

  const handleResetObstacles = () => {
    setObstacles(DEFAULT_OBSTACLES);
  };

  const replayStates = result?.replay?.states || [];
  const replayMoves = result?.replay?.moves || [];
  const activeObstacles = activeTab === 'obstacle' ? (result?.obstacles || obstacles) : [];
  const currentState = replayStates[currentStepIndex] || {
    board: INITIAL_BOARD,
    current_player: 'W',
    obstacles: activeObstacles,
  };
  const currentMove = currentStepIndex > 0 ? replayMoves[currentStepIndex - 1] : null;

  return (
    <div className="sandbox-page-container">
      {/* Header */}
      <div className="sandbox-header-banner">
        <div className="sandbox-title-wrap">
          <h1 className="sandbox-title">Đấu Thử Bot</h1>
          <span className="sandbox-latency-tag">
            <Clock size={13} /> ≤ 200ms
          </span>
        </div>
        <p className="sandbox-subtitle">
          Kiểm tra tính hợp lệ và độ trễ của bot trước khi thi đấu.
        </p>

        {/* Tab Selection */}
        <div className="sandbox-tab-bar" role="tablist">
          <button
            id="tab-standard-practice"
            className={`sandbox-tab-btn ${activeTab === 'standard' ? 'active' : ''}`}
            onClick={() => handleTabChange('standard')}
            role="tab"
            aria-selected={activeTab === 'standard'}
          >
            <Swords size={16} />
            <span>Bàn cờ chuẩn 9×9</span>
          </button>

          <button
            id="tab-obstacle-practice"
            className={`sandbox-tab-btn ${activeTab === 'obstacle' ? 'active' : ''}`}
            onClick={() => handleTabChange('obstacle')}
            role="tab"
            aria-selected={activeTab === 'obstacle'}
          >
            <Shield size={16} />
            <span>Bàn cờ ô cản 9×9 (Top 32)</span>
          </button>
        </div>
      </div>

      {/* Main Workspace */}
      <div className="sandbox-workspace-grid">
        {/* Left: Code Editor */}
        <div className="sandbox-editor-panel glass-card">
          <div className="panel-header">
            <div className="panel-title-group">
              <Code2 size={18} className="icon-navy" />
              <h2>Mã nguồn bot</h2>
            </div>
            <div className="editor-top-actions">
              <span className="direct-paste-badge">Dán trực tiếp</span>
              {botCode && (
                <button
                  type="button"
                  className="btn-clear-code"
                  onClick={() => setBotCode('')}
                  title="Xóa mã nguồn"
                >
                  <Trash2 size={13} />
                  <span>Xóa</span>
                </button>
              )}
            </div>
          </div>

          {/* Config Bar */}
          <div className="config-bar">
            {activeTab === 'standard' ? (
              <div className="opponent-selector-group">
                <span className="config-label">Đối thủ:</span>
                <button
                  type="button"
                  className={`btn-toggle-choice ${standardOpponent === 'greedy' ? 'active' : ''}`}
                  onClick={() => setStandardOpponent('greedy')}
                >
                  GreedyBot
                </button>
                <button
                  type="button"
                  className={`btn-toggle-choice ${standardOpponent === 'random' ? 'active' : ''}`}
                  onClick={() => setStandardOpponent('random')}
                >
                  RandomBot
                </button>
              </div>
            ) : (
              <div className="obstacle-config-group">
                <div className="obs-summary">
                  <span className="config-label">Ô cản ({obstacles.length}):</span>
                  <div className="obstacle-chips-row">
                    {obstacles.map((sq) => (
                      <span
                        key={sq}
                        className="obs-chip clickable"
                        onClick={() => handleToggleObstacle(sq)}
                        title="Bấm để gỡ bỏ"
                      >
                        {sq.toUpperCase()} ✕
                      </span>
                    ))}
                    <button
                      type="button"
                      className="btn-reset-obs"
                      onClick={handleResetObstacles}
                      title="Về 5 ô cản mặc định"
                    >
                      <RotateCcw size={12} /> Mặc định
                    </button>
                  </div>
                </div>
                <p className="obs-tip">Click ô trên bàn cờ để bật/tắt ô cản.</p>
              </div>
            )}
          </div>

          {/* Code Editor */}
          <div className="code-editor-wrapper">
            <textarea
              id="sandbox-code-editor"
              className="code-textarea"
              value={botCode}
              onChange={(e) => setBotCode(e.target.value)}
              placeholder="Dán mã nguồn bot.py (bắt buộc có hàm choose_move)..."
              spellCheck="false"
              rows={17}
            />
          </div>

          {/* Action Trigger */}
          <div className="editor-footer">
            <button
              id="btn-run-sandbox"
              type="button"
              className={`btn-run-test ${isRunning ? 'loading' : ''}`}
              onClick={handleRunTest}
              disabled={isRunning}
            >
              {isRunning ? (
                <>
                  <span className="spinner-border" />
                  Đang chạy...
                </>
              ) : (
                <>
                  <Play size={16} fill="currentColor" />
                  Đấu thử
                </>
              )}
            </button>
            <span className="editor-footer-hint">
              Timeout 2s/nước • RAM 128MB • Không mạng
            </span>
          </div>

          {errorMsg && (
            <div className="sandbox-error-banner animate-fade-in">
              <AlertTriangle size={16} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Right: Board & Results */}
        <div className="sandbox-preview-panel glass-card">
          {result ? (
            <div className="benchmark-results-summary animate-fade-in">
              <div
                className={`result-verdict-card ${
                  result.winner === 'W'
                    ? 'verdict-win'
                    : result.winner === 'B'
                    ? 'verdict-loss'
                    : 'verdict-draw'
                }`}
              >
                <div className="verdict-icon">
                  {result.winner === 'W' ? (
                    <Award size={24} />
                  ) : result.winner === 'B' ? (
                    <AlertTriangle size={24} />
                  ) : (
                    <Swords size={24} />
                  )}
                </div>
                <div className="verdict-text">
                  <div className="verdict-title">
                    {result.winner === 'W'
                      ? 'Thắng'
                      : result.winner === 'B'
                      ? 'Thua'
                      : 'Hòa'}
                  </div>
                  <div className="verdict-reason">
                    Mã: <strong>{result.end_code}</strong> • {result.reason}
                  </div>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="metrics-cards-grid">
                <div className="metric-card">
                  <div className="metric-header">
                    <Clock size={14} />
                    <span>Độ trễ TB</span>
                  </div>
                  <div className="metric-value">
                    {result.average_move_time_ms} <span className="unit">ms</span>
                  </div>
                  <span
                    className={`metric-badge ${
                      result.is_latency_compliant ? 'badge-success' : 'badge-danger'
                    }`}
                  >
                    {result.is_latency_compliant ? '✓ Đạt (≤200ms)' : '✕ Quá 200ms'}
                  </span>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <Gauge size={14} />
                    <span>Độ trễ Max</span>
                  </div>
                  <div className="metric-value">
                    {result.max_move_time_ms} <span className="unit">ms</span>
                  </div>
                  <span className="metric-hint">Nước lâu nhất</span>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <Layers size={14} />
                    <span>Nước đi</span>
                  </div>
                  <div className="metric-value">{result.total_moves}</div>
                  <span className="metric-hint">{result.duration_ms}ms</span>
                </div>

                {activeTab === 'obstacle' && (
                  <div className="metric-card">
                    <div className="metric-header">
                      <Shield size={14} />
                      <span>Ô cản</span>
                    </div>
                    <div className="metric-value" style={{ fontSize: '1rem', marginTop: '0.2rem' }}>
                      {result.is_obstacle_compliant ? 'Hợp lệ' : 'Phạm luật'}
                    </div>
                    <span
                      className={`metric-badge ${
                        result.is_obstacle_compliant ? 'badge-success' : 'badge-danger'
                      }`}
                    >
                      {result.is_obstacle_compliant ? '✓ Đạt' : '✕ Thua T1'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="benchmark-placeholder-banner">
              <Cpu size={20} className="icon-navy" />
              <span>Chưa có ván đấu. Bấm <strong>"Đấu thử"</strong> để bắt đầu.</span>
            </div>
          )}

          {/* SVG Board */}
          <div className="board-viewer-card">
            <div className="board-center-wrapper">
              <BoardSVG
                boardState={currentState}
                obstacles={activeObstacles}
                lastMove={currentMove ? { from: currentMove.from, to: currentMove.to } : null}
                onSquareClick={activeTab === 'obstacle' ? handleToggleObstacle : () => {}}
                size={430}
              />
            </div>

            {/* Replay Controls */}
            {replayStates.length > 0 && (
              <div className="replay-controls-toolbar">
                <div className="playback-buttons">
                  <button
                    type="button"
                    className="btn-replay-ctrl"
                    onClick={() => setCurrentStepIndex(0)}
                    disabled={currentStepIndex === 0}
                    title="Về đầu"
                  >
                    <SkipBack size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn-replay-ctrl"
                    onClick={() => setCurrentStepIndex((p) => Math.max(0, p - 1))}
                    disabled={currentStepIndex === 0}
                    title="Lùi"
                  >
                    <ChevronLeft size={15} />
                  </button>
                  <button
                    type="button"
                    className={`btn-replay-play ${isPlaying ? 'playing' : ''}`}
                    onClick={() => setIsPlaying(!isPlaying)}
                    title={isPlaying ? 'Dừng' : 'Phát'}
                  >
                    {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                  </button>
                  <button
                    type="button"
                    className="btn-replay-ctrl"
                    onClick={() => setCurrentStepIndex((p) => Math.min(replayStates.length - 1, p + 1))}
                    disabled={currentStepIndex >= replayStates.length - 1}
                    title="Tiếp"
                  >
                    <ChevronRight size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn-replay-ctrl"
                    onClick={() => setCurrentStepIndex(replayStates.length - 1)}
                    disabled={currentStepIndex >= replayStates.length - 1}
                    title="Về cuối"
                  >
                    <SkipForward size={15} />
                  </button>
                </div>

                {/* Slider */}
                <div className="step-slider-group">
                  <input
                    type="range"
                    min={0}
                    max={replayStates.length - 1}
                    value={currentStepIndex}
                    onChange={(e) => setCurrentStepIndex(Number(e.target.value))}
                    className="replay-range-slider"
                  />
                  <span className="step-counter">
                    {currentStepIndex}/{replayStates.length - 1}
                  </span>
                </div>

                {/* Current move info */}
                <div className="current-move-badge">
                  {currentMove ? (
                    <span>
                      Nước {currentStepIndex}:{' '}
                      <strong>{currentMove.player === 'W' ? 'Trắng' : 'Đen'}</strong>{' '}
                      <code>
                        {currentMove.from} → {currentMove.to}
                      </code>{' '}
                      ({currentMove.duration_ms || 0}ms)
                    </span>
                  ) : (
                    <span>Bàn cờ ban đầu</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default SandboxPage;
