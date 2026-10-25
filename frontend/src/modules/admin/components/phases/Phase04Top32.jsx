import {
  Trophy,
  Check,
  Award,
  ShieldCheck,
  RefreshCw,
  Users,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { KnockoutBracket } from '../bracket/KnockoutBracket.jsx';

export function Phase04Top32({
  top32Obstacles,
  top32Announcement,
  setTop32Announcement,
  top32Seeds,
  toggleObstacleCell,
  handleSaveTop32Config,
  isSavingObstacles,
  bracketData,
  onRunRound,
  isRunningRound,
  onResetBracket,
  onFinalizeSeeds,
  isFinalizingSeeds,
}) {
  const rounds = bracketData?.rounds || {};
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

  // Xác định vòng đấu hiện tại cần kích hoạt
  let activeRoundKey = 'r32';
  let activeRoundName = 'Vòng 1/16';
  let activeRoundCount = 16;
  let isAllFinished = false;

  if (!isR32Done) {
    activeRoundKey = 'r32';
    activeRoundName = 'Vòng 1/16';
    activeRoundCount = 16;
  } else if (!isR16Done) {
    activeRoundKey = 'r16';
    activeRoundName = 'Vòng 1/8';
    activeRoundCount = 8;
  } else if (!isQfDone) {
    activeRoundKey = 'qf';
    activeRoundName = 'Tứ Kết';
    activeRoundCount = 4;
  } else if (!isSfDone) {
    activeRoundKey = 'sf';
    activeRoundName = 'Bán Kết';
    activeRoundCount = 2;
  } else if (!isFinalDone) {
    activeRoundKey = 'final';
    activeRoundName = 'Chung Kết & Tranh Hạng Ba';
    activeRoundCount = 2;
  } else {
    isAllFinished = true;
    activeRoundName = 'Đã Hoàn Tất';
    activeRoundCount = 0;
  }

  return (
    <section className="doppelrand-shell phase-container animate-fade-in">
      <div className="doppelrand-core phase-core">
        {/* Phase Header */}
        <div className="phase-header-bar">
          <div>
            <div className="phase-eyebrow">
              <span className="eyebrow-number">GIAI ĐOẠN 04</span>
              <span>VÒNG CHUNG KẾT PLAYOFF</span>
            </div>
            <h2 className="phase-title">Vòng Chung Kết &amp; Địa Hình Ô Cản</h2>
            <p className="phase-subtitle">
              Thiết lập vị trí chướng ngại vật trên bàn cờ và điều hành nhánh đấu loại trực tiếp.
            </p>
          </div>

          <div className="top32-header-actions">
            {!isAllFinished ? (
              <button
                type="button"
                className="btn-island btn-island-primary"
                onClick={() => onRunRound(activeRoundKey)}
                disabled={isRunningRound || r32Matches.length === 0}
                title={`Kích hoạt thi đấu tự động các cặp trận ${activeRoundName} (${activeRoundCount} trận BO2)`}
              >
                <span className="btn-island-text">
                  {isRunningRound ? 'Đang thi đấu trận...' : `⚡ Kích Hoạt Thi Đấu: ${activeRoundName}`}
                </span>
                <span className="btn-island-badge">
                  {isRunningRound ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Zap size={14} />
                  )}
                </span>
              </button>
            ) : (
              <div className="btn-island btn-island-primary" style={{ cursor: 'default' }}>
                <span className="btn-island-text">ĐÃ XÁC ĐỊNH NHÀ VÔ ĐỊCH 🏆</span>
                <span className="btn-island-badge">
                  <Trophy size={14} />
                </span>
              </div>
            )}

            {!isAllFinished && (
              <button
                type="button"
                className="btn-island btn-island-secondary"
                onClick={() => onRunRound(activeRoundKey, true)}
                disabled={isRunningRound || r32Matches.length === 0}
                title={`Đấu lại toàn bộ các cặp trận của ${activeRoundName}`}
              >
                <span className="btn-island-text">Đấu Lại Vòng Này</span>
                <span className="btn-island-badge">
                  <RotateCcw size={14} />
                </span>
              </button>
            )}

            <button
              type="button"
              className="btn-island btn-island-secondary"
              onClick={onFinalizeSeeds}
              disabled={isFinalizingSeeds || isRunningRound}
              title="Chốt danh sách hạt giống từ bảng xếp hạng Swiss và tạo nhánh đấu"
            >
              <span className="btn-island-text">
                {isFinalizingSeeds ? 'Đang chốt hạt giống...' : 'Chốt Danh Sách Hạt Giống'}
              </span>
              <span className="btn-island-badge">
                {isFinalizingSeeds ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <ShieldCheck size={14} />
                )}
              </span>
            </button>
          </div>
        </div>

        {/* Top 32 Config Grid */}
        <div className="top32-layout-grid">
          {/* Interactive 9x9 Obstacle Board */}
          <div className="board-interactive-column">
            <div className="board-legend-bar">
              <h4 className="board-title">Bản đồ ô cản bàn cờ (Nhấp để bật/tắt):</h4>
              <span className="board-count-pill">{top32Obstacles.length} Ô Cản Đã Chọn</span>
            </div>

            <div className="obstacles-chessboard-wrap">
              {['9', '8', '7', '6', '5', '4', '3', '2', '1'].map((row) =>
                ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'].map((col) => {
                  const sq = `${col}${row}`;
                  const isObs = top32Obstacles.includes(sq);
                  const isGoal = sq === 'i9' || sq === 'a1';

                  return (
                    <button
                      key={sq}
                      type="button"
                      disabled={isGoal}
                      className={`board-square-btn ${isObs ? 'obstacle' : ''} ${isGoal ? 'goal' : ''}`}
                      onClick={() => toggleObstacleCell(sq)}
                      title={isGoal ? `Ô đích ${sq} cố định` : `Ô ${sq}: ${isObs ? 'Ô CẢN' : 'Bình thường'}`}
                    >
                      {isObs ? 'X' : isGoal ? 'G' : sq}
                    </button>
                  );
                })
              )}
            </div>

            <div className="board-selected-preview">
              <span>Danh sách ô cản:</span>
              <strong>{top32Obstacles.join(', ') || 'Chưa chọn ô nào'}</strong>
            </div>
          </div>

          {/* Announcement & Top 32 Seeds Roster */}
          <div className="top32-config-column">
            <div className="announcement-card">
              <label htmlFor="top32-announcement-input" className="field-label">
                <span>Thông báo đổi luật cho thí sinh:</span>
              </label>
              <textarea
                id="top32-announcement-input"
                rows={4}
                className="styled-textarea"
                value={top32Announcement}
                onChange={(e) => setTop32Announcement(e.target.value)}
                placeholder="Thông báo danh sách tọa độ ô cản, thời hạn nộp bot v2..."
              />
              <div className="announcement-actions">
                <button
                  type="button"
                  className="btn-island btn-island-primary"
                  onClick={handleSaveTop32Config}
                  disabled={isSavingObstacles}
                >
                  <span className="btn-island-text">
                    {isSavingObstacles ? 'Đang lưu cấu hình...' : 'Lưu Cấu Hình Ô Cản'}
                  </span>
                  <span className="btn-island-badge">
                    <Check size={14} className={isSavingObstacles ? 'animate-spin' : ''} />
                  </span>
                </button>
              </div>
            </div>

            {/* Top 32 Seeds Preview */}
            <div className="seeds-roster-box">
              <div className="seeds-header">
                <h5>
                  <Users size={14} style={{ display: 'inline', marginRight: 4 }} />
                  Hạt Giống Đã Chốt ({top32Seeds.length} thí sinh):
                </h5>
              </div>
              <div className="seeds-list-scroll">
                {top32Seeds.length === 0 ? (
                  <div className="empty-seeds-note">
                    Chưa có hạt giống nào được chốt. Nhấp nút <strong>&quot;Chốt Danh Sách Hạt Giống&quot;</strong> ở trên để tạo nhánh đấu.
                  </div>
                ) : (
                  top32Seeds.map((s) => (
                    <div key={s.seed} className="seed-row">
                      <div className="seed-candidate">
                        <strong className="seed-num">#{s.seed}</strong>
                        <span>
                          {s.name} ({s.student_id || 'N/A'})
                        </span>
                      </div>
                      <span className="seed-stats">
                        {s.swiss_wins || 0} thắng • {s.swiss_points || 0} pts
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Visual Knockout Bracket */}
        <KnockoutBracket
          bracket={bracketData}
          onRunRound={onRunRound}
          isRunningRound={isRunningRound}
          onResetBracket={onResetBracket}
        />
      </div>
    </section>
  );
}

export default Phase04Top32;
