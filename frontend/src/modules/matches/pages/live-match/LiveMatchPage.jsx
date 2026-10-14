import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Radio,
  Clock,
  Trophy,
  AlertCircle,
  Wifi,
  WifiOff,
  Sparkles,
  ExternalLink,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { BoardSVG } from '@/shared/components/BoardSVG/BoardSVG.jsx';
import { StatusBadge } from '@/shared/components/StatusBadge/StatusBadge.jsx';
import { useToast } from '@/shared/context/ToastContext.jsx';
import { getWebSocketUrl } from '@/shared/api-client/index.js';
import './LiveMatchPage.css';


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
    current_board: {},
    moves: [],
    last_move: null,
    reason: '',
  });

  const wsRef = useRef(null);
  const moveFeedEndRef = useRef(null);

  // Auto-scroll live feed
  useEffect(() => {
    if (moveFeedEndRef.current) {
      moveFeedEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [matchData.moves]);

  // WebSocket Connection
  useEffect(() => {
    const wsUrl = getWebSocketUrl(`/ws/live/${id}`);

    let isUnmounted = false;
    let pingInterval = null;


    const connect = () => {
      setConnectionStatus('connecting');
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
              current_board: msg.current_board || {},
              moves: msg.moves || [],
              last_move: msg.moves && msg.moves.length > 0 ? msg.moves[msg.moves.length - 1] : null,
            }));
          } else if (msg.type === 'MATCH_START') {
            setMatchData((prev) => ({
              ...prev,
              status: 'running',
              bot_white: msg.bot_white || prev.bot_white,
              bot_black: msg.bot_black || prev.bot_black,
              current_board: msg.board || {},
              moves: [],
              last_move: null,
            }));
            showToast('Trận đấu đã chính thức khởi tranh!', 'info');
          } else if (msg.type === 'MOVE') {
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
          }
        } catch {
          // ignore parse error
        }
      };

      ws.onclose = () => {
        if (isUnmounted) return;
        setConnectionStatus('disconnected');
        clearInterval(pingInterval);
      };

      ws.onerror = () => {
        if (isUnmounted) return;
        setConnectionStatus('disconnected');
      };
    };

    connect();

    return () => {
      isUnmounted = true;
      clearInterval(pingInterval);
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [id, showToast]);

  // Calculate live piece counts
  const pieceCounts = useMemo(() => {
    const boardState = matchData.current_board?.board || matchData.current_board;
    if (!boardState) {
      return { white: { R: 2, S: 2, P: 2 }, black: { r: 2, s: 2, p: 2 } };
    }
    const counts = {
      white: { R: 0, S: 0, P: 0 },
      black: { r: 0, s: 0, p: 0 },
    };

    if (Array.isArray(boardState)) {
      boardState.forEach((row) => {
        for (const ch of row) {
          if (ch === 'R') counts.white.R++;
          else if (ch === 'S') counts.white.S++;
          else if (ch === 'P') counts.white.P++;
          else if (ch === 'r') counts.black.r++;
          else if (ch === 's') counts.black.s++;
          else if (ch === 'p') counts.black.p++;
        }
      });
    } else if (typeof boardState === 'object') {
      Object.values(boardState).forEach((p) => {
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

  const endExplanation = matchData.end_code
    ? END_CODE_EXPLANATIONS[matchData.end_code] || `Mã kết thúc: ${matchData.end_code}`
    : '';

  return (
    <div className="live-match-page animate-fade-in">
      {/* Top Navbar */}
      <div className="live-nav-bar">
        <Link to="/matches" className="btn btn-outline btn-sm">
          <ArrowLeft size={16} />
          <span>Danh sách trận</span>
        </Link>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
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
              <Wifi size={15} color="var(--emerald-400)" />
            ) : (
              <WifiOff size={15} color="var(--rose-500)" />
            )}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {connectionStatus === 'connected' ? 'WebSocket OK' : 'Đang kết nối...'}
            </span>
          </div>

          <Link to={`/matches/${id}`} className="btn btn-outline btn-xs">
            <span>Mở Replay Chi Tiết</span>
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
            <div className="player-subtitle">Quân Trắng (Đi trước)</div>
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

        {/* Center Live Status */}
        <div className="live-center-status">
          {matchData.status === 'running' ? (
            <>
              <div className="live-turn-title">
                Đang thi đấu • Nước {matchData.total_moves}
              </div>
              <div className="active-turn-hint">
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
            <div className="player-subtitle">Quân Đen</div>
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

      {/* Main Live Board & Move Feed Layout */}
      <div className="live-layout">
        {/* Left Col: Live Board */}
        <div className="live-board-col">
          <BoardSVG
            boardState={matchData.current_board}
            lastMove={matchData.last_move}
            size={520}
          />

          {matchData.status === 'done' && (
            <div className="glass-card live-game-over-box animate-fade-in">
              <Trophy size={24} color="var(--amber-400)" />
              <div>
                <strong>Trận đấu đã khép lại ({matchData.total_moves} nước)</strong>
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
              <span>Dòng Nước Đi Trực Tiếp ({matchData.moves.length})</span>
            </div>
            {matchData.status === 'running' && (
              <span className="live-feed-badge">Live Stream</span>
            )}
          </div>

          <div className="feed-list" role="log" aria-live="polite">
            <div className="feed-item feed-init">
              <span className="feed-turn">00</span>
              <span>Trận đấu khởi tạo tại Sandbox</span>
            </div>

            {matchData.moves.map((m, idx) => (
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
