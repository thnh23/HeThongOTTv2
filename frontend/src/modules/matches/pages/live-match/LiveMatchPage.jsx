import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Radio,
  Clock,
  Trophy,
  Wifi,
  WifiOff,
  ExternalLink,
  ChevronRight,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Copy,
  Check,
  Filter,
  Pause,
  Play,
} from 'lucide-react';
import { BoardSVG } from '@/shared/components/BoardSVG/BoardSVG.jsx';
import { useToast } from '@/shared/context/ToastContext.jsx';
import { apiClient, getWebSocketUrl } from '@/shared/api-client/index.js';
import { soundFx } from '@/shared/services/soundFx.js';
import './LiveMatchPage.css';

const COLS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'];

function getInitialBoardState() {
  const board = {};
  const w1 = ['R', 'S', 'P', 'R', 'S', 'P', 'R', 'S', 'P'];
  const w2 = ['P', 'R', 'S', 'P', 'R', 'S', 'P', 'R', 'S'];
  const b9 = ['P', 'S', 'R', 'P', 'S', 'R', 'P', 'S', 'R'];
  const b8 = ['S', 'R', 'P', 'S', 'R', 'P', 'S', 'R', 'P'];
  COLS.forEach((col, idx) => {
    board[`${col}1`] = { player: 'W', type: w1[idx] };
    board[`${col}2`] = { player: 'W', type: w2[idx] };
    board[`${col}8`] = { player: 'B', type: b8[idx] };
    board[`${col}9`] = { player: 'B', type: b9[idx] };
  });
  return board;
}

const END_CODE_EXPLANATIONS = {
  W1: 'Trắng Thắng do Đen mất toàn bộ 1 loại quân (Kéo ✂️ / Búa 👊 / Bao ✋)',
  W2: 'Trắng Thắng do đưa quân vào ô đích i9 👑',
  W4: 'Trắng Thắng do Đen không còn nước đi hợp lệ (Stalemate)',
  W5: 'Trắng Thắng do Đen quá thời gian (Timeout)',
  W6: 'Trắng Thắng do Đen vi phạm quy tắc / ném ngoại lệ',
  B1: 'Đen Thắng do Trắng mất toàn bộ 1 loại quân (Kéo ✂️ / Búa 👊 / Bao ✋)',
  B2: 'Đen Thắng do đưa quân vào ô đích a1 🎯',
  B4: 'Đen Thắng do Trắng không còn nước đi hợp lệ (Stalemate)',
  B5: 'Đen Thắng do Trắng quá thời gian (Timeout)',
  B6: 'Đen Thắng do Trắng vi phạm quy tắc / ném ngoại lệ',
  D1: 'Bên hết nước đi bị xử thua',
  D2: 'Hòa cờ do vượt quá 200 nước hoặc lặp thế 3 lần',
  T1: 'Bot bị quá giờ (timeout) hoặc lỗi cú pháp',
};

export function LiveMatchPage() {
  const { id } = useParams();
  const { showToast } = useToast();

  const [connectionStatus, setConnectionStatus] = useState('connecting'); // connecting, connected, disconnected
  const [matchData, setMatchData] = useState({
    match_id: id,
    tier: 'A',
    status: 'running',
    bot_white: 'White',
    bot_black: 'Black',
    winner: null,
    end_code: null,
    total_moves: 0,
    current_board: getInitialBoardState(),
    moves: [],
    last_move: null,
    reason: '',
  });

  const [soundEnabled, setSoundEnabled] = useState(soundFx.enabled);
  const [isCinemaMode, setIsCinemaMode] = useState(false);
  const [filterCapturesOnly, setFilterCapturesOnly] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedMoves, setCopiedMoves] = useState(false);

  const wsRef = useRef(null);
  const moveFeedEndRef = useRef(null);

  // Auto-scroll live feed when enabled
  useEffect(() => {
    if (autoScroll && moveFeedEndRef.current) {
      moveFeedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [matchData.moves, autoScroll]);

  const toggleSound = () => {
    const next = soundFx.toggleSound();
    setSoundEnabled(next);
    showToast(next ? 'Đã bật âm thanh hiệu ứng!' : 'Đã tắt âm thanh!', 'info');
  };

  const copyMoveHistory = () => {
    if (!matchData.moves || matchData.moves.length === 0) return;
    const text = matchData.moves
      .map((m) => `#${m.turn} [${m.player}] ${m.from} -> ${m.to}${m.captured ? ` (ăn ${m.captured})` : ''}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopiedMoves(true);
    showToast('Đã sao chép lịch sử nước đi vào clipboard!', 'success');
    setTimeout(() => setCopiedMoves(false), 2000);
  };

  // REST API Sync Fallback (Loads match metadata and final replay if done)
  const fetchMatchFromRest = async () => {
    try {
      const matchRes = await apiClient.get(`/matches/${id}`);
      if (matchRes) {
        setMatchData((prev) => ({
          ...prev,
          tier: matchRes.tier || prev.tier,
          status: matchRes.status || prev.status,
          bot_white: matchRes.bot_a_name || prev.bot_white,
          bot_black: matchRes.bot_b_name || prev.bot_black,
          winner: matchRes.winner,
          end_code: matchRes.end_code,
          total_moves: matchRes.total_moves || prev.total_moves,
        }));
      }

      if (matchRes?.status === 'done' || matchRes?.status === 'error') {
        const replayRes = await apiClient.get(`/matches/${id}/replay`);
        if (replayRes?.states && replayRes.states.length > 0) {
          const finalState = replayRes.states[replayRes.states.length - 1];
          setMatchData((prev) => ({
            ...prev,
            status: 'done',
            moves: replayRes.moves || [],
            current_board: finalState,
            last_move: replayRes.moves && replayRes.moves.length > 0 ? replayRes.moves[replayRes.moves.length - 1] : null,
            total_moves: replayRes.total_moves,
          }));
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchMatchFromRest();
  }, [id]);

  // WebSocket Connection with Auto-reconnect
  useEffect(() => {
    const wsUrl = getWebSocketUrl(`/ws/live/${id}`);

    let isUnmounted = false;
    let pingInterval = null;
    let reconnectTimeout = null;

    const connect = () => {
      if (isUnmounted) return;
      setConnectionStatus('connecting');
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;

        ws.onopen = () => {
          if (isUnmounted) return;
          setConnectionStatus('connected');
          showToast('Đã kết nối luồng trực tiếp ván đấu!', 'success');

          // Heartbeat ping
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'PING' }));
            }
          }, 15000);
        };

        ws.onmessage = (event) => {
          if (isUnmounted) return;
          try {
            const msg = JSON.parse(event.data);

            if (msg.type === 'INIT_MATCH_STATE') {
              setMatchData((prev) => ({
                ...prev,
                tier: msg.tier || prev.tier,
                status: msg.status || prev.status,
                bot_white: msg.bot_white || prev.bot_white,
                bot_black: msg.bot_black || prev.bot_black,
                winner: msg.winner,
                end_code: msg.end_code,
                total_moves: msg.total_moves || 0,
                current_board: msg.current_board && Object.keys(msg.current_board).length > 0 ? msg.current_board : prev.current_board,
                moves: msg.moves || prev.moves,
                last_move: msg.moves && msg.moves.length > 0 ? msg.moves[msg.moves.length - 1] : prev.last_move,
              }));
            } else if (msg.type === 'MATCH_START') {
              setMatchData((prev) => ({
                ...prev,
                status: 'running',
                bot_white: msg.bot_white || prev.bot_white,
                bot_black: msg.bot_black || prev.bot_black,
                current_board: msg.board || prev.current_board,
                moves: [],
                last_move: null,
              }));
              showToast('Trận đấu đã chính thức khởi tranh!', 'info');
            } else if (msg.type === 'MOVE') {
              if (msg.captured) {
                soundFx.playCapture();
              } else {
                soundFx.playMove();
              }

              setMatchData((prev) => {
                const newMove = {
                  turn: msg.turn,
                  player: msg.player,
                  from: msg.from,
                  to: msg.to,
                  captured: msg.captured,
                  duration_ms: msg.duration_ms,
                };
                return {
                  ...prev,
                  total_moves: msg.turn,
                  current_board: msg.board || prev.current_board,
                  moves: [...prev.moves, newMove],
                  last_move: newMove,
                };
              });
            } else if (msg.type === 'GAME_OVER') {
              soundFx.playVictory();
              setMatchData((prev) => ({
                ...prev,
                status: 'done',
                winner: msg.winner,
                end_code: msg.end_code,
                reason: msg.reason,
                total_moves: msg.total_moves,
              }));
              const winText = msg.winner === 'W' ? 'Trắng Thắng' : msg.winner === 'B' ? 'Đen Thắng' : 'Hòa Cờ';
              showToast(`Ván đấu kết thúc: ${winText} (${msg.end_code})`, 'success');
              fetchMatchFromRest();
            }
          } catch {
            // ignore parse error
          }
        };

        ws.onclose = () => {
          if (isUnmounted) return;
          setConnectionStatus('disconnected');
          clearInterval(pingInterval);
          reconnectTimeout = setTimeout(connect, 3000);
        };

        ws.onerror = () => {
          if (isUnmounted) return;
          setConnectionStatus('disconnected');
          try { ws.close(); } catch {}
        };
      } catch {
        setConnectionStatus('disconnected');
        reconnectTimeout = setTimeout(connect, 3000);
      }
    };

    connect();

    // Fallback polling every 4 seconds if WebSocket is not connected
    const pollInterval = setInterval(() => {
      if (wsRef.current?.readyState !== WebSocket.OPEN) {
        fetchMatchFromRest();
      }
    }, 4000);

    return () => {
      isUnmounted = true;
      clearInterval(pingInterval);
      clearInterval(pollInterval);
      clearTimeout(reconnectTimeout);
      if (wsRef.current) {
        try { wsRef.current.close(); } catch {}
      }
    };
  }, [id]);

  // Calculate live piece counts
  const pieceCounts = useMemo(() => {
    const raw = matchData.current_board?.board || matchData.current_board;
    if (!raw || Object.keys(raw).length === 0) {
      return { white: { R: 6, S: 6, P: 6 }, black: { r: 6, s: 6, p: 6 } };
    }

    if (matchData.current_board?.white_pieces && matchData.current_board?.black_pieces) {
      return {
        white: matchData.current_board.white_pieces,
        black: {
          r: matchData.current_board.black_pieces.R || 0,
          s: matchData.current_board.black_pieces.S || 0,
          p: matchData.current_board.black_pieces.P || 0,
        },
      };
    }

    const counts = {
      white: { R: 0, S: 0, P: 0 },
      black: { r: 0, s: 0, p: 0 },
    };

    if (Array.isArray(raw)) {
      raw.forEach((row) => {
        if (typeof row === 'string') {
          for (const ch of row) {
            if (ch === 'R') counts.white.R++;
            else if (ch === 'S') counts.white.S++;
            else if (ch === 'P') counts.white.P++;
            else if (ch === 'r') counts.black.r++;
            else if (ch === 's') counts.black.s++;
            else if (ch === 'p') counts.black.p++;
          }
        }
      });
    } else if (typeof raw === 'object' && raw !== null) {
      Object.values(raw).forEach((p) => {
        if (!p) return;
        if (p.player === 'W') {
          if (p.type === 'R') counts.white.R++;
          else if (p.type === 'S') counts.white.S++;
          else if (p.type === 'P') counts.white.P++;
        } else if (p.player === 'B') {
          if (p.type === 'R') counts.black.r++;
          else if (p.type === 'S') counts.black.s++;
          else if (p.type === 'P') counts.black.p++;
        }
      });
    }
    return counts;
  }, [matchData.current_board]);

  const totalWhitePieces = pieceCounts.white.R + pieceCounts.white.S + pieceCounts.white.P;
  const totalBlackPieces = pieceCounts.black.r + pieceCounts.black.s + pieceCounts.black.p;
  const totalOnBoard = totalWhitePieces + totalBlackPieces || 1;
  const whitePercent = Math.round((totalWhitePieces / totalOnBoard) * 100);

  const displayedMoves = useMemo(() => {
    if (!filterCapturesOnly) return matchData.moves;
    return matchData.moves.filter((m) => !!m.captured);
  }, [matchData.moves, filterCapturesOnly]);

  const endExplanation = matchData.end_code
    ? END_CODE_EXPLANATIONS[matchData.end_code] || `Mã kết thúc: ${matchData.end_code}`
    : '';

  return (
    <div className={`live-match-page animate-fade-in ${isCinemaMode ? 'cinema-mode-active' : ''}`}>
      {/* Top Navbar */}
      <div className="live-nav-bar">
        <Link to="/matches" className="btn btn-outline btn-sm">
          <ArrowLeft size={16} />
          <span>Danh sách trận</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
          {/* Sound Toggle */}
          <button
            className={`btn btn-outline btn-xs btn-sound-live ${soundEnabled ? 'active' : ''}`}
            onClick={toggleSound}
            title={soundEnabled ? 'Tắt âm thanh hiệu ứng' : 'Bật âm thanh hiệu ứng'}
            aria-label="Chuyển đổi âm thanh"
          >
            {soundEnabled ? <Volume2 size={15} color="var(--cyan-400)" /> : <VolumeX size={15} color="var(--text-muted)" />}
            <span className="live-opt-label">{soundEnabled ? 'Âm thanh: Bật' : 'Âm thanh: Tắt'}</span>
          </button>

          {/* Cinema Mode Toggle */}
          <button
            className="btn btn-outline btn-xs"
            onClick={() => setIsCinemaMode((prev) => !prev)}
            title={isCinemaMode ? 'Thoát chế độ rạp chiếu' : 'Chế độ rạp chiếu (Toàn màn hình)'}
            aria-label="Chế độ rạp chiếu"
          >
            {isCinemaMode ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span className="live-opt-label">{isCinemaMode ? 'Thu nhỏ' : 'Rạp chiếu'}</span>
          </button>

          {/* Live indicator badge */}
          {matchData.status === 'running' ? (
            <div className="live-pulse-badge">
              <span className="live-dot animate-ping"></span>
              <Radio size={14} />
              <span>TRỰC TIẾP</span>
            </div>
          ) : (
            <div className="live-ended-badge">
              <Trophy size={14} />
              <span>ĐÃ KẾT THÚC</span>
            </div>
          )}

          {/* WebSocket Connection status indicator */}
          <div className="ws-status-badge" title={connectionStatus}>
            {connectionStatus === 'connected' ? (
              <Wifi size={14} color="var(--emerald-400)" />
            ) : (
              <WifiOff size={14} color="var(--rose-500)" />
            )}
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
              {connectionStatus === 'connected' ? 'WS OK' : 'Đang kết nối...'}
            </span>
          </div>

          <Link to={`/matches/${id}`} className="btn btn-outline btn-xs">
            <span>Mở Replay</span>
            <ExternalLink size={13} />
          </Link>
        </div>
      </div>

      {/* Live Matchup Banner */}
      <div className="glass-card live-matchup-card">
        {/* White Team */}
        <div className="player-summary player-white">
          <div className="team-avatar white-avatar">W</div>
          <div>
            <div className="player-title">{matchData.bot_white}</div>
            <div className="player-subtitle">Quân Trắng (Đi trước) • {totalWhitePieces}/18 quân</div>
            <div className="piece-pills">
              <span className={`piece-pill ${pieceCounts.white.R === 0 ? 'zero' : ''}`} title="Búa (R)">
                👊 {pieceCounts.white.R}/6
              </span>
              <span className={`piece-pill ${pieceCounts.white.S === 0 ? 'zero' : ''}`} title="Kéo (S)">
                ✂️ {pieceCounts.white.S}/6
              </span>
              <span className={`piece-pill ${pieceCounts.white.P === 0 ? 'zero' : ''}`} title="Bao (P)">
                ✋ {pieceCounts.white.P}/6
              </span>
            </div>
          </div>
        </div>

        {/* Center Live Status */}
        <div className="live-center-status">
          <div className="esports-vs-tag">VS</div>
          {matchData.status === 'running' ? (
            <>
              <div className="live-turn-title">
                Đang thi đấu • Nước #{matchData.total_moves}
              </div>
              <div className="active-turn-hint">
                <span className="live-thinking-dot animate-pulse"></span>
                Lượt:{' '}
                <strong>
                  {matchData.last_move?.player === 'W' ? 'Đen đang tính...' : 'Trắng đang tính...'}
                </strong>
              </div>
            </>
          ) : (
            <>
              <div className="outcome-text">
                {matchData.winner === 'W' ? (
                  <span className="text-white-win">Trắng Thắng 🏆</span>
                ) : matchData.winner === 'B' ? (
                  <span className="text-black-win">Đen Thắng 🏆</span>
                ) : (
                  <span className="text-draw">Hòa Cờ 🤝</span>
                )}
              </div>
              <div className="end-reason-badge" title={endExplanation}>
                {endExplanation}
              </div>
            </>
          )}
        </div>

        {/* Black Team */}
        <div className="player-summary player-black">
          <div className="team-avatar black-avatar">B</div>
          <div style={{ textAlign: 'right' }}>
            <div className="player-title text-cyan">{matchData.bot_black}</div>
            <div className="player-subtitle">Quân Đen • {totalBlackPieces}/18 quân</div>
            <div className="piece-pills" style={{ justifyContent: 'flex-end' }}>
              <span className={`piece-pill ${pieceCounts.black.r === 0 ? 'zero' : ''}`} title="Búa (r)">
                👊 {pieceCounts.black.r}/6
              </span>
              <span className={`piece-pill ${pieceCounts.black.s === 0 ? 'zero' : ''}`} title="Kéo (s)">
                ✂️ {pieceCounts.black.s}/6
              </span>
              <span className={`piece-pill ${pieceCounts.black.p === 0 ? 'zero' : ''}`} title="Bao (p)">
                ✋ {pieceCounts.black.p}/6
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Material Advantage Progress Bar */}
      <div className="material-balance-container">
        <div className="material-balance-labels">
          <span style={{ color: '#FFFFFF', fontWeight: 600 }}>Trắng: {totalWhitePieces} quân</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Tương Quan Lực Lượng</span>
          <span style={{ color: 'var(--cyan-400)', fontWeight: 600 }}>Đen: {totalBlackPieces} quân</span>
        </div>
        <div className="material-balance-track">
          <div
            className="material-balance-fill-white"
            style={{ width: `${whitePercent}%` }}
            title={`Trắng chiếm ${whitePercent}% quân số`}
          />
          <div
            className="material-balance-fill-black"
            style={{ width: `${100 - whitePercent}%` }}
            title={`Đen chiếm ${100 - whitePercent}% quân số`}
          />
        </div>
      </div>

      {/* Main Live Board & Move Feed Layout */}
      <div className="live-layout">
        {/* Left Col: Live Board */}
        <div className="live-board-col">
          <BoardSVG
            boardState={matchData.current_board}
            lastMove={matchData.last_move}
            size={isCinemaMode ? 620 : 520}
          />

          {matchData.status === 'done' && (
            <div className="glass-card live-game-over-box animate-fade-in">
              <Trophy size={26} color="var(--amber-400)" />
              <div style={{ flex: 1 }}>
                <strong style={{ fontSize: '1.05rem', color: '#fff' }}>Trận đấu đã khép lại ({matchData.total_moves} nước)</strong>
                <p style={{ margin: '0.2rem 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                  {matchData.reason || endExplanation}
                </p>
              </div>
              <Link to={`/matches/${id}`} className="btn btn-primary btn-sm">
                <span>Xem Toàn Bộ Replay</span>
                <ChevronRight size={15} />
              </Link>
            </div>
          )}
        </div>

        {/* Right Col: Live Moves Stream Feed */}
        <div className="glass-card live-feed-sidebar">
          <div className="feed-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Clock size={16} color="var(--cyan-400)" />
              <span>Nước Đi ({displayedMoves.length})</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              {/* Filter Captures */}
              <button
                className={`btn btn-outline btn-xs ${filterCapturesOnly ? 'active' : ''}`}
                onClick={() => setFilterCapturesOnly((prev) => !prev)}
                title={filterCapturesOnly ? 'Hiển thị tất cả nước' : 'Chỉ hiển thị nước ăn quân'}
                aria-label="Lọc nước ăn quân"
              >
                <Filter size={12} />
                <span>{filterCapturesOnly ? 'Đang lọc' : 'Ăn quân'}</span>
              </button>

              {/* Auto scroll lock */}
              <button
                className={`btn btn-outline btn-xs ${!autoScroll ? 'active' : ''}`}
                onClick={() => setAutoScroll((prev) => !prev)}
                title={autoScroll ? 'Đang tự cuộn xuống (Bấm để dừng)' : 'Đã dừng tự cuộn (Bấm để tiếp tục)'}
                aria-label="Tự động cuộn"
              >
                {autoScroll ? <Pause size={12} /> : <Play size={12} />}
              </button>

              {/* Copy moves */}
              <button
                className="btn btn-outline btn-xs"
                onClick={copyMoveHistory}
                title="Sao chép toàn bộ nước đi"
                aria-label="Sao chép nước đi"
              >
                {copiedMoves ? <Check size={12} color="var(--emerald-400)" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          <div className="feed-list" role="log" aria-live="polite">
            <div className="feed-item feed-init">
              <span className="feed-turn">00</span>
              <span>Trận đấu khởi tạo tại Sandbox</span>
            </div>

            {displayedMoves.map((m, idx) => (
              <div key={idx} className="feed-item feed-move animate-fade-in">
                <span className="feed-turn">#{m.turn}</span>
                <div className="feed-move-info">
                  <span className={`feed-player player-tag-${m.player}`}>
                    {m.player === 'W' ? 'Trắng' : 'Đen'}
                  </span>
                  <span className="feed-notation">
                    {m.from} → {m.to}
                  </span>
                  {m.captured && (
                    <span className="feed-captured-tag">
                      ăn {m.captured === 'R' ? 'Búa 👊' : m.captured === 'S' ? 'Kéo ✂️' : 'Bao ✋'}
                    </span>
                  )}
                </div>
                <span className="feed-duration">
                  {m.duration_ms !== undefined ? `${m.duration_ms}ms` : ''}
                </span>
              </div>
            ))}
            <div ref={moveFeedEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
}
