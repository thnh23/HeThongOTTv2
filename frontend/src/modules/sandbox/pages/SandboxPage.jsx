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
  Sparkles,
  Terminal,
  Code2,
  Cpu,
  Trash2,
  FileCode,
  Layers,
  Zap,
  Info,
  Clock,
  Swords,
  Award,
} from 'lucide-react';
import { BoardSVG } from '@/shared/components/BoardSVG/BoardSVG.jsx';
import { apiClient } from '@/shared/api-client/index.js';
import './SandboxPage.css';

const DEFAULT_OBSTACLES = ['d4', 'd6', 'f4', 'f6', 'e5'];

const CODE_TEMPLATES = {
  random: `from app.services.engine.rules import get_legal_moves
from app.services.engine.board import square_to_str
import random

def choose_move(state):
    """
    RandomBot: Chọn ngẫu nhiên một nước đi hợp lệ.
    Phù hợp làm nền tảng kiểm thử tốc độ và cú pháp.
    """
    moves = get_legal_moves(state)
    if not moves:
        return ("", "")
    (fc, fr), (tc, tr) = random.choice(moves)
    return (square_to_str(fc, fr), square_to_str(tc, tr))
`,
  greedy: `from app.services.engine.rules import get_legal_moves
from app.services.engine.board import square_to_str, TARGET_SQUARE

def choose_move(state):
    """
    GreedyBot: Ưu tiên tiến vào ô đích W2 và ăn quân đối phương.
    Mẫu chuẩn mực cho Vòng thi đấu Swiss.
    """
    moves = get_legal_moves(state)
    if not moves:
        return ("", "")

    player = state.get("current_player", "W")
    target = TARGET_SQUARE[player]

    # 1. Nếu có nước đi trực tiếp vào ô đích -> Thắng ngay (W2)
    for (fc, fr), (tc, tr) in moves:
        if (tc, tr) == target:
            return (square_to_str(fc, fr), square_to_str(tc, tr))

    # 2. Ưu tiên ăn quân đối phương
    grid = state.get("grid", {})
    opponent = "B" if player == "W" else "W"
    captures = []
    for (fc, fr), (tc, tr) in moves:
        dest_val = grid.get((tc, tr)) or grid.get(f"{tc},{tr}")
        if dest_val and opponent in str(dest_val):
            captures.append(((fc, fr), (tc, tr)))
    if captures:
        (fc, fr), (tc, tr) = captures[0]
        return (square_to_str(fc, fr), square_to_str(tc, tr))

    # 3. Tiến gần nhất về ô đích của đối thủ
    def dist(pos):
        return abs(pos[0] - target[0]) + abs(pos[1] - target[1])

    best_move = min(moves, key=lambda m: dist(m[1]))
    (fc, fr), (tc, tr) = best_move
    return (square_to_str(fc, fr), square_to_str(tc, tr))
`,
  obstacle: `from app.services.engine.rules import get_legal_moves
from app.services.engine.board import square_to_str, TARGET_SQUARE

def choose_move(state):
    """
    ObstacleBot: Tự động phát hiện và né tránh toàn bộ ô chướng ngại vật.
    Dành riêng cho Tuần Đệm nâng cấp Bot v2 Top 32.
    """
    moves = get_legal_moves(state)
    if not moves:
        return ("", "")

    player = state.get("current_player", "W")
    target = TARGET_SQUARE[player]
    obstacles = set(state.get("obstacles", []))

    # Lọc các nước đi an toàn không chạm vào ô cản
    safe_moves = []
    for (fc, fr), (tc, tr) in moves:
        sq_str = square_to_str(tc, tr)
        if sq_str not in obstacles:
            safe_moves.append(((fc, fr), (tc, tr)))

    valid_candidates = safe_moves if safe_moves else moves

    # Ưu tiên nước gần ô đích nhất
    def dist(pos):
        return abs(pos[0] - target[0]) + abs(pos[1] - target[1])

    best_move = min(valid_candidates, key=lambda m: dist(m[1]))
    (fc, fr), (tc, tr) = best_move
    return (square_to_str(fc, fr), square_to_str(tc, tr))
`,
};

export function SandboxPage() {
  // Mode: 'standard' (Swiss 9x9) | 'obstacle' (Top 32 9x9 with obstacles)
  const [activeTab, setActiveTab] = useState('standard');
  const [standardOpponent, setStandardOpponent] = useState('greedy'); // 'greedy' | 'random'
  const [botCode, setBotCode] = useState(CODE_TEMPLATES.greedy);
  const [obstacles, setObstacles] = useState(DEFAULT_OBSTACLES);

  // Execution & Replay states
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playIntervalRef = useRef(null);

  // Handle auto-switch starter template when switching tabs
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
    setResult(null);
    setErrorMsg('');
    setCurrentStepIndex(0);
    setIsPlaying(false);
    if (newTab === 'obstacle' && botCode === CODE_TEMPLATES.greedy) {
      setBotCode(CODE_TEMPLATES.obstacle);
    } else if (newTab === 'standard' && botCode === CODE_TEMPLATES.obstacle) {
      setBotCode(CODE_TEMPLATES.greedy);
    }
  };

  // Replay auto playback
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

  // Execute test match
  const handleRunTest = async () => {
    if (!botCode.trim()) {
      setErrorMsg('Vui lòng dán mã nguồn bot.py có hàm choose_move(state) trước khi chạy thử nghiệm.');
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
      setErrorMsg(err.message || 'Không thể thực thi Sandbox. Vui lòng kiểm tra mã nguồn hoặc kết nối máy chủ.');
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

  // Extract replay state
  const replayStates = result?.replay?.states || [];
  const replayMoves = result?.replay?.moves || [];
  const activeObstacles = activeTab === 'obstacle' ? (result?.obstacles || obstacles) : [];
  const currentState = replayStates[currentStepIndex] || {
    board: [
      'RRSSPP...',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '.........',
      '...ppssrr',
    ],
    current_player: 'W',
    obstacles: activeObstacles,
  };
  const currentMove = currentStepIndex > 0 ? replayMoves[currentStepIndex - 1] : null;

  return (
    <div className="sandbox-page-container">
      {/* Page Header */}
      <div className="sandbox-header-banner">
        <div className="sandbox-badge-wrap">
          <span className="sandbox-tag">
            <Cpu size={14} /> Phân Môi Trường Sandbox Cô Lập
          </span>
          <span className="sandbox-latency-tag">
            <Clock size={14} /> Tiêu Chuẩn &le; 200ms
          </span>
        </div>
        <h1 className="sandbox-title">Sân Đấu Thử Nghiệm Sandbox Lab</h1>
        <p className="sandbox-subtitle">
          Thử nghiệm logic di chuyển, kiểm tra thời gian tính toán và thẩm định tính tuân thủ luật thi đấu trước khi nộp bài chính thức.
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
            <Swords size={18} />
            <div className="tab-btn-text">
              <span className="tab-title">Bàn Cờ Chuẩn 9×9 (Vòng Swiss)</span>
              <span className="tab-desc">Luật cờ tiêu chuẩn, đấu tập với GreedyBot hoặc RandomBot</span>
            </div>
          </button>

          <button
            id="tab-obstacle-practice"
            className={`sandbox-tab-btn ${activeTab === 'obstacle' ? 'active' : ''}`}
            onClick={() => handleTabChange('obstacle')}
            role="tab"
            aria-selected={activeTab === 'obstacle'}
          >
            <Shield size={18} />
            <div className="tab-btn-text">
              <span className="tab-title">Bàn Cờ Ô Cản 9×9 (Tuần Đệm Top 32)</span>
              <span className="tab-desc">Chướng ngại vật cố định, né vật cản đối đầu ObstacleBot</span>
            </div>
          </button>
        </div>
      </div>

      {/* Main Workspace Layout */}
      <div className="sandbox-workspace-grid">
        {/* Left Column: Code Editor & Setup */}
        <div className="sandbox-editor-panel glass-card">
          <div className="panel-header">
            <div className="panel-title-group">
              <Code2 size={20} className="icon-gold" />
              <h2>Mã Nguồn Bot (Dán Trực Tiếp)</h2>
            </div>
            <div className="template-actions">
              <button
                type="button"
                className="btn-template"
                onClick={() => setBotCode(CODE_TEMPLATES.greedy)}
                title="Nạp code GreedyBot mẫu"
              >
                <Zap size={14} /> Nạp GreedyBot
              </button>
              <button
                type="button"
                className="btn-template"
                onClick={() => setBotCode(CODE_TEMPLATES.random)}
                title="Nạp code RandomBot mẫu"
              >
                <FileCode size={14} /> Nạp RandomBot
              </button>
              {activeTab === 'obstacle' && (
                <button
                  type="button"
                  className="btn-template highlight"
                  onClick={() => setBotCode(CODE_TEMPLATES.obstacle)}
                  title="Nạp code ObstacleBot mẫu"
                >
                  <Shield size={14} /> Nạp ObstacleBot v2
                </button>
              )}
              <button
                type="button"
                className="btn-template btn-danger-soft"
                onClick={() => setBotCode('')}
                title="Xóa mã nguồn"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Opponent & Board Config Options */}
          <div className="config-bar">
            {activeTab === 'standard' ? (
              <div className="opponent-selector-group">
                <span className="config-label">Chọn Đối Thủ Máy:</span>
                <button
                  type="button"
                  className={`btn-toggle-choice ${standardOpponent === 'greedy' ? 'active' : ''}`}
                  onClick={() => setStandardOpponent('greedy')}
                >
                  <Zap size={14} /> GreedyBot (Chuẩn Mực Ăn Quân)
                </button>
                <button
                  type="button"
                  className={`btn-toggle-choice ${standardOpponent === 'random' ? 'active' : ''}`}
                  onClick={() => setStandardOpponent('random')}
                >
                  <FileCode size={14} /> RandomBot (Ngẫu Nhiên)
                </button>
              </div>
            ) : (
              <div className="obstacle-config-group">
                <div className="obs-summary">
                  <span className="config-label">
                    Ô Chướng Ngại Vật ({obstacles.length} ô):
                  </span>
                  <div className="obstacle-chips-row">
                    {obstacles.map((sq) => (
                      <span
                        key={sq}
                        className="obs-chip clickable"
                        onClick={() => handleToggleObstacle(sq)}
                        title="Bấm để gỡ bỏ ô này"
                      >
                        {sq.toUpperCase()} ✕
                      </span>
                    ))}
                    <button
                      type="button"
                      className="btn-reset-obs"
                      onClick={handleResetObstacles}
                      title="Khôi phục 5 ô cản mặc định"
                    >
                      <RotateCcw size={12} /> Đặt lại
                    </button>
                  </div>
                </div>
                <p className="obs-tip">
                  💡 Bạn có thể click trực tiếp vào các ô trên bàn cờ bên phải để bật/tắt ô chướng ngại vật.
                </p>
              </div>
            )}
          </div>

          {/* Code Textarea Editor */}
          <div className="code-editor-wrapper">
            <textarea
              id="sandbox-code-editor"
              className="code-textarea"
              value={botCode}
              onChange={(e) => setBotCode(e.target.value)}
              placeholder="Dán toàn bộ mã nguồn bot.py của bạn vào đây (bắt buộc phải có def choose_move(state):)..."
              spellCheck="false"
              rows={18}
            />
          </div>

          {/* Action Trigger Button */}
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
                  Đang Đấu Thử Nghiệm Trong Sandbox...
                </>
              ) : (
                <>
                  <Play size={18} fill="currentColor" />
                  Chạy Thử Nghiệm Ngay (Run Test)
                </>
              )}
            </button>
            <span className="editor-footer-hint">
              Tiến trình Sandbox bảo vệ tuyệt đối: Timeout 2s/nước, giới hạn RAM 128MB, ngắt kết nối mạng.
            </span>
          </div>

          {errorMsg && (
            <div className="sandbox-error-banner animate-fade-in">
              <AlertTriangle size={18} />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Right Column: Results & Interactive SVG Board */}
        <div className="sandbox-preview-panel glass-card">
          {/* Header Status & Performance Cards */}
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
                    <Award size={28} />
                  ) : result.winner === 'B' ? (
                    <AlertTriangle size={28} />
                  ) : (
                    <Swords size={28} />
                  )}
                </div>
                <div className="verdict-text">
                  <span className="verdict-label">KẾT QUẢ VÁN ĐẤU</span>
                  <h3 className="verdict-title">
                    {result.winner === 'W'
                      ? 'Thí Sinh Chiến Thắng 🎉'
                      : result.winner === 'B'
                      ? `${result.opponent_name} Chiến Thắng`
                      : 'Hòa Cờ (Draw)'}
                  </h3>
                  <p className="verdict-reason">
                    Mã kết thúc: <strong>{result.end_code}</strong> — {result.reason}
                  </p>
                </div>
              </div>

              {/* Metric Cards Row */}
              <div className="metrics-cards-grid">
                <div className="metric-card">
                  <div className="metric-header">
                    <Clock size={16} />
                    <span>Độ Trễ Trung Bình</span>
                  </div>
                  <div className="metric-value">
                    {result.average_move_time_ms} <span className="unit">ms</span>
                  </div>
                  <span
                    className={`metric-badge ${
                      result.is_latency_compliant ? 'badge-success' : 'badge-danger'
                    }`}
                  >
                    {result.is_latency_compliant
                      ? '✓ Đạt chuẩn (≤200ms)'
                      : '⚠ Nguy cơ Timeout (>200ms)'}
                  </span>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <Gauge size={16} />
                    <span>Thời Gian Max</span>
                  </div>
                  <div className="metric-value">
                    {result.max_move_time_ms} <span className="unit">ms</span>
                  </div>
                  <span className="metric-hint">Nước đi lâu nhất</span>
                </div>

                <div className="metric-card">
                  <div className="metric-header">
                    <Layers size={16} />
                    <span>Tổng Nước Đi</span>
                  </div>
                  <div className="metric-value">{result.total_moves}</div>
                  <span className="metric-hint">Thời gian: {result.duration_ms}ms</span>
                </div>

                {activeTab === 'obstacle' && (
                  <div className="metric-card">
                    <div className="metric-header">
                      <Shield size={16} />
                      <span>Luật Ô Cản</span>
                    </div>
                    <div className="metric-value" style={{ fontSize: '1.1rem', marginTop: '0.2rem' }}>
                      {result.is_obstacle_compliant ? 'Tuân Thủ 100%' : 'Phạm Luật'}
                    </div>
                    <span
                      className={`metric-badge ${
                        result.is_obstacle_compliant ? 'badge-success' : 'badge-danger'
                      }`}
                    >
                      {result.is_obstacle_compliant ? '✓ Hợp lệ' : '✕ Bị xử thua T1'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="benchmark-placeholder-banner">
              <Terminal size={24} className="icon-accent" />
              <div>
                <h4>Chưa có dữ liệu ván đấu</h4>
                <p>
                  Nhấn <strong>"Chạy Thử Nghiệm Ngay"</strong> để khởi chạy ván cờ với đối thủ mẫu và theo dõi toàn bộ nước đi trực quan.
                </p>
              </div>
            </div>
          )}

          {/* SVG Board Container */}
          <div className="board-viewer-card">
            <div className="board-center-wrapper">
              <BoardSVG
                boardState={currentState}
                obstacles={activeObstacles}
                lastMove={currentMove ? { from: currentMove.from, to: currentMove.to } : null}
                onSquareClick={activeTab === 'obstacle' ? handleToggleObstacle : () => {}}
                size={450}
              />
            </div>

            {/* Replay Controls Toolbar */}
            {replayStates.length > 0 && (
              <div className="replay-controls-toolbar">
                <div className="playback-buttons">
                  <button
                    type="button"
                    className="btn-replay-ctrl"
                    onClick={() => setCurrentStepIndex(0)}
                    disabled={currentStepIndex === 0}
                    title="Về nước đi đầu tiên"
                  >
                    <SkipBack size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-replay-ctrl"
                    onClick={() => setCurrentStepIndex((p) => Math.max(0, p - 1))}
                    disabled={currentStepIndex === 0}
                    title="Nước trước"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    type="button"
                    className={`btn-replay-play ${isPlaying ? 'playing' : ''}`}
                    onClick={() => setIsPlaying(!isPlaying)}
                    title={isPlaying ? 'Tạm dừng' : 'Tự động phát'}
                  >
                    {isPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}
                  </button>
                  <button
                    type="button"
                    className="btn-replay-ctrl"
                    onClick={() => setCurrentStepIndex((p) => Math.min(replayStates.length - 1, p + 1))}
                    disabled={currentStepIndex >= replayStates.length - 1}
                    title="Nước kế tiếp"
                  >
                    <ChevronRight size={16} />
                  </button>
                  <button
                    type="button"
                    className="btn-replay-ctrl"
                    onClick={() => setCurrentStepIndex(replayStates.length - 1)}
                    disabled={currentStepIndex >= replayStates.length - 1}
                    title="Đến nước cuối cùng"
                  >
                    <SkipForward size={16} />
                  </button>
                </div>

                {/* Step Slider */}
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
                    {currentStepIndex} / {replayStates.length - 1}
                  </span>
                </div>

                {/* Current Move Details */}
                <div className="current-move-badge">
                  {currentMove ? (
                    <span>
                      Nước #{currentStepIndex}:{' '}
                      <strong>{currentMove.player === 'W' ? 'Trắng (Thí sinh)' : 'Đen (Máy)'}</strong>{' '}
                      <code>
                        {currentMove.from} → {currentMove.to}
                      </code>{' '}
                      ({currentMove.duration_ms || 0}ms)
                    </span>
                  ) : (
                    <span>Bàn cờ ban đầu (Nước 0)</span>
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
