import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Award, Zap, RotateCcw, CheckCircle2, Play, Radio } from 'lucide-react';
import './KnockoutBracket.css';

export function KnockoutBracket({
  bracket,
  onRunRound,
  isRunningRound,
  onResetBracket,
}) {
  const rounds = bracket?.rounds || {};
  const podium = bracket?.podium || {};

  const r32Matches = rounds.r32 || [];
  const r16Matches = rounds.r16 || [];
  const qfMatches = rounds.qf || [];
  const sfMatches = rounds.sf || [];
  const finalMatches = rounds.final || [];

  const isR32Done = r32Matches.length > 0 && r32Matches.every((m) => m.status === 'completed');
  const isR16Done = r16Matches.length > 0 && r16Matches.every((m) => m.status === 'completed');
  const isQfDone = qfMatches.length > 0 && qfMatches.every((m) => m.status === 'completed');
  const isSfDone = sfMatches.length > 0 && sfMatches.every((m) => m.status === 'completed');
  const isFinalDone = finalMatches.length > 0 && finalMatches.every((m) => m.status === 'completed');

  const renderPlayer = (player, score, isWinner) => {
    if (!player) {
      return (
        <div className="bracket-player-row empty">
          <div className="bracket-player-info">
            <span className="bracket-seed-badge">-</span>
            <span className="bracket-player-name">Chờ xác định...</span>
          </div>
          <span className="bracket-score-badge">-</span>
        </div>
      );
    }

    return (
      <div className={`bracket-player-row ${isWinner ? 'is-winner' : ''}`}>
        <div className="bracket-player-info" title={`${player.name} (${player.student_id || ''}) - Bot: ${player.bot_name || ''}`}>
          <span className="bracket-seed-badge">#{player.seed || '-'}</span>
          <span className="bracket-player-name">{player.name}</span>
        </div>
        <span className="bracket-score-badge">{Number(score || 0).toFixed(1)}</span>
      </div>
    );
  };

  const renderMatch = (match) => {
    const isCompleted = match.status === 'completed' || match.status === 'done';
    const isRunning = match.status === 'running';
    const isWinnerA = isCompleted && match.winner_id && match.player_a?.id === match.winner_id;
    const isWinnerB = isCompleted && match.winner_id && match.player_b?.id === match.winner_id;

    return (
      <div key={match.id} className={`bracket-match-card ${isCompleted ? 'completed' : isRunning ? 'running' : ''}`}>
        <div className="bracket-match-top">
          <span className="bracket-match-label">{match.label || match.id}</span>
          <span className={`match-status-badge ${isCompleted ? 'done' : isRunning ? 'live' : 'wait'}`}>
            {isCompleted ? 'ĐÃ ĐẤU' : isRunning ? 'LIVE' : 'CHỜ ĐẤU'}
          </span>
        </div>
        <div className="bracket-match-body">
          {renderPlayer(match.player_a, match.score_a, isWinnerA)}
          {renderPlayer(match.player_b, match.score_b, isWinnerB)}
        </div>
        <div className="bracket-match-actions">
          {isCompleted && (
            <div className="bracket-actions-row">
              <Link to={`/matches/${match.id}`} className="bracket-action-link replay" title="Xem Replay ván đấu">
                <Play size={11} fill="currentColor" /> Replay
              </Link>
              {match.game_results && match.game_results.length > 0 && (
                <div className="bracket-game-pills">
                  <Link to={`/matches/${match.id}_G1`} className="bracket-game-pill" title="Xem Ván 1">
                    V1
                  </Link>
                  <Link to={`/matches/${match.id}_G2`} className="bracket-game-pill" title="Xem Ván 2">
                    V2
                  </Link>
                </div>
              )}
            </div>
          )}
          {isRunning && (
            <Link to={`/matches/${match.id}/live`} className="bracket-action-link live" title="Xem trực tiếp trận đấu">
              <Radio size={11} className="animate-pulse" /> Xem Live
            </Link>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bracket-container">
      {/* Control Action Bar */}
      <div className="bracket-controls-bar">
        <div className="bracket-controls-left">
          <h3 className="bracket-title">
            <Trophy size={18} className="text-amber-500" />
            <span>Sơ Đồ Phân Nhánh Knockout Top 32</span>
          </h3>
          <span className="bracket-badge-live">BO2 Đổi Phe • Địa Hình Ô Cản</span>
        </div>

        <div className="bracket-actions-group">
          {!isR32Done && (
            <button
              type="button"
              className="bracket-btn-run"
              onClick={() => onRunRound('r32')}
              disabled={isRunningRound || r32Matches.length === 0}
              title="Chạy tự động 16 trận BO2 vòng 1/16 với bot và ô cản"
            >
              <Zap size={14} />
              <span>{isRunningRound ? 'Đang thi đấu...' : 'Chạy Vòng 1/16 (16 Trận)'}</span>
            </button>
          )}

          {isR32Done && !isR16Done && (
            <button
              type="button"
              className="bracket-btn-run"
              onClick={() => onRunRound('r16')}
              disabled={isRunningRound}
              title="Chạy tự động 8 trận BO2 vòng 1/8"
            >
              <Zap size={14} />
              <span>{isRunningRound ? 'Đang thi đấu...' : 'Chạy Vòng 1/8 (8 Trận)'}</span>
            </button>
          )}

          {isR16Done && !isQfDone && (
            <button
              type="button"
              className="bracket-btn-run"
              onClick={() => onRunRound('qf')}
              disabled={isRunningRound}
              title="Chạy tự động 4 trận BO2 Tứ Kết"
            >
              <Zap size={14} />
              <span>{isRunningRound ? 'Đang thi đấu...' : 'Chạy Tứ Kết (4 Trận)'}</span>
            </button>
          )}

          {isQfDone && !isSfDone && (
            <button
              type="button"
              className="bracket-btn-run"
              onClick={() => onRunRound('sf')}
              disabled={isRunningRound}
              title="Chạy tự động 2 trận BO2 Bán Kết"
            >
              <Zap size={14} />
              <span>{isRunningRound ? 'Đang thi đấu...' : 'Chạy Bán Kết (2 Trận)'}</span>
            </button>
          )}

          {isSfDone && !isFinalDone && (
            <button
              type="button"
              className="bracket-btn-run"
              onClick={() => onRunRound('final')}
              disabled={isRunningRound}
              title="Chạy trận Chung Kết & Tranh Hạng Ba"
            >
              <Trophy size={14} />
              <span>{isRunningRound ? 'Đang thi đấu...' : 'Chạy Chung Kết & Tranh Hạng 3'}</span>
            </button>
          )}

          <button
            type="button"
            className="bracket-btn-reset"
            onClick={onResetBracket}
            disabled={isRunningRound}
            title="Đặt lại toàn bộ trạng thái nhánh đấu"
          >
            <RotateCcw size={13} />
            <span>Reset Nhánh Đấu</span>
          </button>
        </div>
      </div>

      {/* Podium Card (Displayed when Podium exists) */}
      {podium?.champion && (
        <div className="podium-banner-card animate-fade-in">
          <div className="podium-banner-header">
            <Trophy size={20} className="text-amber-500" />
            <h4 className="podium-banner-title">Bục Vinh Quang Vòng Chung Kết OTTv2 Tournament</h4>
          </div>

          <div className="podium-grid">
            {/* Quán Quân */}
            <div className="podium-item champion">
              <span className="podium-rank-tag gold">
                <Trophy size={13} /> Quán Quân (Cúp Vàng)
              </span>
              <strong className="podium-player-name">{podium.champion.name}</strong>
              <span className="podium-player-sub">
                MSSV: {podium.champion.student_id || 'N/A'} • Bot: {podium.champion.bot_name || 'N/A'}
              </span>
            </div>

            {/* Á Quân */}
            {podium.runner_up && (
              <div className="podium-item">
                <span className="podium-rank-tag silver">
                  <Award size={13} /> Á Quân (Huy Chương Bạc)
                </span>
                <strong className="podium-player-name">{podium.runner_up.name}</strong>
                <span className="podium-player-sub">
                  MSSV: {podium.runner_up.student_id || 'N/A'} • Bot: {podium.runner_up.bot_name || 'N/A'}
                </span>
              </div>
            )}

            {/* Hạng Ba */}
            {podium.third_place && (
              <div className="podium-item">
                <span className="podium-rank-tag bronze">
                  <Award size={13} /> Hạng Ba (Huy Chương Đồng)
                </span>
                <strong className="podium-player-name">{podium.third_place.name}</strong>
                <span className="podium-player-sub">
                  MSSV: {podium.third_place.student_id || 'N/A'} • Bot: {podium.third_place.bot_name || 'N/A'}
                </span>
              </div>
            )}

            {/* Hạng Bốn */}
            {podium.fourth_place && (
              <div className="podium-item">
                <span className="podium-rank-tag fourth">
                  <CheckCircle2 size={13} /> Hạng Tư (Top 4)
                </span>
                <strong className="podium-player-name">{podium.fourth_place.name}</strong>
                <span className="podium-player-sub">
                  MSSV: {podium.fourth_place.student_id || 'N/A'} • Bot: {podium.fourth_place.bot_name || 'N/A'}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bracket Tree View */}
      <div className="bracket-tree-scroll">
        <div className="bracket-rounds-row">
          {/* Round 1/16 */}
          <div className="bracket-round-column">
            <div className="bracket-round-header">
              <div className="bracket-round-name">Vòng 1/16</div>
              <div className="bracket-round-sub">16 Trận • BO2 Cản</div>
              <div className="bracket-round-actions-mini">
                {!isR32Done ? (
                  <button
                    type="button"
                    className="round-mini-btn run"
                    onClick={() => onRunRound('r32')}
                    disabled={isRunningRound || r32Matches.length === 0}
                    title="Chạy thi đấu 16 trận Vòng 1/16"
                  >
                    <Zap size={10} /> Chạy
                  </button>
                ) : (
                  <button
                    type="button"
                    className="round-mini-btn rerun"
                    onClick={() => onRunRound('r32', true)}
                    disabled={isRunningRound}
                    title="Đấu lại 16 trận Vòng 1/16"
                  >
                    <RotateCcw size={10} /> Đấu lại
                  </button>
                )}
              </div>
            </div>
            <div className="bracket-matches-list">
              {r32Matches.map((m) => renderMatch(m))}
            </div>
          </div>

          {/* Round 1/8 */}
          <div className="bracket-round-column">
            <div className="bracket-round-header">
              <div className="bracket-round-name">Vòng 1/8</div>
              <div className="bracket-round-sub">8 Trận • BO2 Cản</div>
              <div className="bracket-round-actions-mini">
                {!isR16Done ? (
                  <button
                    type="button"
                    className="round-mini-btn run"
                    onClick={() => onRunRound('r16')}
                    disabled={isRunningRound || r16Matches.length === 0}
                    title="Chạy thi đấu 8 trận Vòng 1/8"
                  >
                    <Zap size={10} /> Chạy
                  </button>
                ) : (
                  <button
                    type="button"
                    className="round-mini-btn rerun"
                    onClick={() => onRunRound('r16', true)}
                    disabled={isRunningRound}
                    title="Đấu lại 8 trận Vòng 1/8"
                  >
                    <RotateCcw size={10} /> Đấu lại
                  </button>
                )}
              </div>
            </div>
            <div className="bracket-matches-list">
              {r16Matches.map((m) => renderMatch(m))}
            </div>
          </div>

          {/* Quarter-Finals */}
          <div className="bracket-round-column">
            <div className="bracket-round-header">
              <div className="bracket-round-name">Tứ Kết</div>
              <div className="bracket-round-sub">4 Trận • BO2 Cản</div>
              <div className="bracket-round-actions-mini">
                {!isQfDone ? (
                  <button
                    type="button"
                    className="round-mini-btn run"
                    onClick={() => onRunRound('qf')}
                    disabled={isRunningRound || qfMatches.length === 0}
                    title="Chạy thi đấu 4 trận Tứ Kết"
                  >
                    <Zap size={10} /> Chạy
                  </button>
                ) : (
                  <button
                    type="button"
                    className="round-mini-btn rerun"
                    onClick={() => onRunRound('qf', true)}
                    disabled={isRunningRound}
                    title="Đấu lại 4 trận Tứ Kết"
                  >
                    <RotateCcw size={10} /> Đấu lại
                  </button>
                )}
              </div>
            </div>
            <div className="bracket-matches-list">
              {qfMatches.map((m) => renderMatch(m))}
            </div>
          </div>

          {/* Semi-Finals */}
          <div className="bracket-round-column">
            <div className="bracket-round-header">
              <div className="bracket-round-name">Bán Kết</div>
              <div className="bracket-round-sub">2 Trận • BO2 Cản</div>
              <div className="bracket-round-actions-mini">
                {!isSfDone ? (
                  <button
                    type="button"
                    className="round-mini-btn run"
                    onClick={() => onRunRound('sf')}
                    disabled={isRunningRound || sfMatches.length === 0}
                    title="Chạy thi đấu 2 trận Bán Kết"
                  >
                    <Zap size={10} /> Chạy
                  </button>
                ) : (
                  <button
                    type="button"
                    className="round-mini-btn rerun"
                    onClick={() => onRunRound('sf', true)}
                    disabled={isRunningRound}
                    title="Đấu lại 2 trận Bán Kết"
                  >
                    <RotateCcw size={10} /> Đấu lại
                  </button>
                )}
              </div>
            </div>
            <div className="bracket-matches-list">
              {sfMatches.map((m) => renderMatch(m))}
            </div>
          </div>

          {/* Grand Final & 3rd Place */}
          <div className="bracket-round-column">
            <div className="bracket-round-header">
              <div className="bracket-round-name">Chung Kết</div>
              <div className="bracket-round-sub">Tranh Cúp &amp; Hạng Ba</div>
              <div className="bracket-round-actions-mini">
                {!isFinalDone ? (
                  <button
                    type="button"
                    className="round-mini-btn run"
                    onClick={() => onRunRound('final')}
                    disabled={isRunningRound || finalMatches.length === 0}
                    title="Chạy trận Chung Kết & Tranh Hạng Ba"
                  >
                    <Trophy size={10} /> Chạy
                  </button>
                ) : (
                  <button
                    type="button"
                    className="round-mini-btn rerun"
                    onClick={() => onRunRound('final', true)}
                    disabled={isRunningRound}
                    title="Đấu lại Chung Kết"
                  >
                    <RotateCcw size={10} /> Đấu lại
                  </button>
                )}
              </div>
            </div>
            <div className="bracket-matches-list">
              {finalMatches.map((m) => renderMatch(m))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default KnockoutBracket;
