import React, { useState, useMemo } from 'react';
import { BookOpen, Award, ShieldAlert, Cpu, CheckCircle, Target, Compass, Sparkles, Swords } from 'lucide-react';
import { BoardSVG } from '@/shared/components/BoardSVG/BoardSVG.jsx';
import {
  INITIAL_BOARD,
  PIECE_SYMBOLS,
  PIECE_NAMES,
  BEATS,
  WHITE_GOAL,
  BLACK_GOAL,
  getSquareMoveDetails,
} from '@/shared/constants/gameState.js';
import './RulesPage.css';

export function RulesPage() {
  const [selectedSquare, setSelectedSquare] = useState('f2');

  const moveDetails = useMemo(() => {
    return getSquareMoveDetails(INITIAL_BOARD, selectedSquare);
  }, [selectedSquare]);

  const handleSquareClick = (sq) => {
    setSelectedSquare(sq);
  };

  const currentPiece = INITIAL_BOARD[selectedSquare];
  const isWhiteGoal = selectedSquare === WHITE_GOAL;
  const isBlackGoal = selectedSquare === BLACK_GOAL;

  return (
    <div className="rules-page animate-fade-in">
      <div className="rules-header">
        <h1 className="rules-title">
          Quy Chuẩn Luật Chơi <span className="gradient-text">OTTv2</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
          Đặc tả chính thức về bàn cờ 9×9, cơ chế di chuyển 8 hướng, luật ăn quân và điều kiện thắng cuộc.
        </p>
      </div>

      {/* Interactive Starting Board Layout */}
      <div className="glass-card rules-interactive-board">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '1rem' }}>
          <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--cyan-400)', fontSize: '1.25rem', margin: 0 }}>
            <Sparkles size={22} />
            Thế Trận Khởi Đầu Bàn Cờ 9×9 (Trực Quan &amp; Tương Tác)
          </h3>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Nhấp vào quân bất kỳ để xem nước đi hợp lệ và quy tắc chặn quân.
          </span>
        </div>

        <div className="board-preview-layout">
          {/* Interactive SVG Board */}
          <div className="board-preview-svg-wrapper">
            <BoardSVG
              boardState={INITIAL_BOARD}
              selectedSquare={selectedSquare}
              highlightedSquares={moveDetails.emptyMoves}
              capturableSquares={moveDetails.captureMoves.map((c) => c.sq)}
              onSquareClick={handleSquareClick}
              size={480}
            />
          </div>

          {/* Board Inspector & Layout Guide */}
          <div className="board-preview-info">
            {/* Selected Square Inspector */}
            <div className="board-info-block inspector-card-active" style={{ borderLeft: '4px solid var(--amber-400)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                <h4 style={{ color: 'var(--amber-400)', margin: 0 }}>
                  <Target size={18} />
                  Chi Tiết Ô: <code>{selectedSquare}</code>
                </h4>
                {isWhiteGoal && (
                  <span className="goal-tag gold-tag">ĐÍCH TRẮNG (W2)</span>
                )}
                {isBlackGoal && (
                  <span className="goal-tag cyan-tag">ĐÍCH ĐEN (B2)</span>
                )}
              </div>

              {currentPiece ? (
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <span style={{ fontSize: '2rem' }}>{PIECE_SYMBOLS[currentPiece.type]}</span>
                    <div>
                      <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)' }}>
                        {PIECE_NAMES[currentPiece.type]} ({currentPiece.type})
                      </div>
                      <span
                        className="inspect-badge"
                        style={{
                          background: currentPiece.player === 'W' ? '#FFFFFF' : '#0B1120',
                          color: currentPiece.player === 'W' ? '#0F172A' : '#38BDF8',
                          border: currentPiece.player === 'B' ? '1px solid #38BDF8' : '1px solid #CBD5E1',
                        }}
                      >
                        {currentPiece.player === 'W' ? 'Phe Trắng (Đi trước)' : 'Phe Đen'}
                      </span>
                    </div>
                  </div>

                  {/* Combat rule note */}
                  <div className="combat-power-pill">
                    <Swords size={14} style={{ color: 'var(--amber-400)', flexShrink: 0 }} />
                    <span>
                      {PIECE_NAMES[currentPiece.type]} <strong>ăn được {PIECE_NAMES[BEATS[currentPiece.type]]}</strong> • Không ăn được quân cùng loại • Bị kẻ mạnh hơn chặn
                    </span>
                  </div>

                  {/* Legal Moves List */}
                  <div className="analysis-group">
                    <div className="analysis-header" style={{ color: 'var(--emerald-400)' }}>
                      <CheckCircle size={15} />
                      Nước đi hợp lệ ({moveDetails.legalMoves.length} ô):
                    </div>
                    {moveDetails.legalMoves.length > 0 ? (
                      <div className="square-chips-list">
                        {moveDetails.emptyMoves.map((sq) => (
                          <span key={sq} className="chip empty-move">
                            ● {sq} (ô trống)
                          </span>
                        ))}
                        {moveDetails.captureMoves.map((c) => (
                          <span key={c.sq} className="chip capture-move">
                            Ăn {c.piece.type} tại {c.sq}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <div className="empty-analysis-notice">
                        Không có ô hợp lệ nào (Bị quây kín bởi quân mình ở khai cuộc).
                      </div>
                    )}
                  </div>

                  {/* Friendly Blocked Explanation */}
                  {moveDetails.blockedFriendly.length > 0 && (
                    <div className="analysis-group">
                      <div className="analysis-header" style={{ color: 'var(--text-muted)' }}>
                        <ShieldAlert size={15} />
                        Bị chặn bởi quân cùng phe ({moveDetails.blockedFriendly.length} ô):
                      </div>
                      <div className="square-chips-list">
                        {moveDetails.blockedFriendly.map((b) => (
                          <span key={b.sq} className="chip friendly-blocked-chip">
                            Chặn tại {b.sq} ({b.piece.type})
                          </span>
                        ))}
                      </div>
                      <p className="analysis-subtext">
                        <em>Luật OTTv2: Không được di chuyển vào ô đang có quân cùng phe.</em>
                      </p>
                    </div>
                  )}

                  {/* Goal Explanations when clicking a goal square */}
                  {isWhiteGoal && (
                    <div className="goal-callout gold">
                      <strong>Ô i9 là Đích của Trắng (Mã W2):</strong> Ban đầu do quân Đen <code>{currentPiece.type}</code> chốt giữ. Khi phe Trắng tiến được bất kỳ quân nào vào ô này, Trắng lập tức thắng ván đấu.
                    </div>
                  )}
                  {isBlackGoal && (
                    <div className="goal-callout cyan">
                      <strong>Ô a1 là Đích của Đen (Mã B2):</strong> Ban đầu do quân Trắng <code>{currentPiece.type}</code> chốt giữ. Khi phe Đen tiến được bất kỳ quân nào vào ô này, Đen lập tức thắng ván đấu.
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p style={{ color: 'var(--text-secondary)' }}>
                    Ô <code>{selectedSquare}</code> là ô trống trong thế trận khởi đầu (Khu vực trung tâm từ hàng 3 đến hàng 7).
                  </p>
                  {isWhiteGoal && (
                    <div className="goal-callout gold">
                      <strong>Ô i9 là Đích của Trắng (Mã W2):</strong> Trắng chỉ cần đưa quân vào ô này là thắng ván đấu.
                    </div>
                  )}
                  {isBlackGoal && (
                    <div className="goal-callout cyan">
                      <strong>Ô a1 là Đích của Đen (Mã B2):</strong> Đen chỉ cần đưa quân vào ô này là thắng ván đấu.
                    </div>
                  )}
                  <p style={{ color: 'var(--cyan-400)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                    Nhấp vào một quân cờ ở hàng 1, 2 (Trắng) hoặc hàng 8, 9 (Đen) để xem nước đi hợp lệ.
                  </p>
                </div>
              )}
            </div>

            {/* Black Team Starting Position */}
            <div className="board-info-block">
              <h4 style={{ color: '#BE123C' }}>
                Phe Đen (Black) — Hàng 8 &amp; 9 (18 Quân)
              </h4>
              <p>• <strong>Hàng 9:</strong> P – S – R – P – S – R – P – S – R (Bao, Kéo, Búa xen kẽ)</p>
              <p>• <strong>Hàng 8:</strong> S – R – P – S – R – P – S – R – P (Kéo, Búa, Bao xen kẽ)</p>
            </div>

            {/* White Team Starting Position */}
            <div className="board-info-block">
              <h4 style={{ color: '#1E3A8A' }}>
                Phe Trắng (White) — Hàng 1 &amp; 2 (18 Quân)
                <span style={{ fontSize: '0.75rem', color: '#047857', marginLeft: 'auto', fontWeight: 'bold' }}>
                  ● ĐI TRƯỚC
                </span>
              </h4>
              <p>• <strong>Hàng 2:</strong> P – R – S – P – R – S – P – R – S (Bao, Búa, Kéo xen kẽ)</p>
              <p>• <strong>Hàng 1:</strong> R – S – P – R – S – P – R – S – P (Búa, Kéo, Bao xen kẽ)</p>
            </div>

            {/* Win Goal Square Reminder */}
            <div className="board-info-block" style={{ background: 'rgba(99, 102, 241, 0.08)', borderColor: 'rgba(99, 102, 241, 0.3)' }}>
              <h4 style={{ color: 'var(--indigo-400)' }}>
                <Compass size={18} />
                Ô Góc Đích Chiến Thắng (Mã W2)
              </h4>
              <p>
                <strong>Trắng vào ô <code>i9</code></strong> (góc trên bên phải): Thắng ngay lập tức.
              </p>
              <p>
                <strong>Đen vào ô <code>a1</code></strong> (góc dưới bên trái): Thắng ngay lập tức.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="rules-grid">
        <div className="glass-card rule-box">
          <h3><BookOpen size={20} /> 1. Bàn cờ &amp; Quân cờ</h3>
          <p>
            Bàn cờ có kích thước <strong>9 × 9 ô vuông</strong> (cột từ <code>a</code> đến <code>i</code>, hàng từ <code>1</code> đến <code>9</code>).
          </p>
          <p>Mỗi đấu thủ điều khiển 18 quân cờ thuộc 3 loại:</p>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <li><strong>Búa (Rock - R):</strong> 6 quân</li>
            <li><strong>Kéo (Scissors - S):</strong> 6 quân</li>
            <li><strong>Bao (Paper - P):</strong> 6 quân</li>
          </ul>
        </div>

        <div className="glass-card rule-box">
          <h3><Award size={20} /> 2. Di chuyển & Ăn quân</h3>
          <p>
            Mỗi lượt, đấu thủ chọn 1 quân của mình di chuyển <strong>đúng 1 ô theo 8 hướng</strong> (ngang, dọc, chéo — tương tự quân Vua trong cờ vua).
          </p>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <li><strong>Khác loại:</strong> Kẻ mạnh hơn ăn kẻ yếu (Búa ăn Kéo, Kéo ăn Bao, Bao ăn Búa). Kẻ yếu không được đi vào ô của kẻ mạnh.</li>
            <li><strong>Cùng loại:</strong> Hai quân cùng loại (ví dụ Búa gặp Búa) <strong>không thể ăn nhau</strong>, chỉ đứng chặn đường.</li>
            <li><strong>Quân mình:</strong> Không được đi vào ô đã có quân cùng phe.</li>
          </ul>
        </div>
      </div>


      {/* End Codes Table */}
      <div className="glass-card" style={{ marginBottom: '2.5rem' }}>
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary-400)' }}>
          <ShieldAlert size={20} /> Bảng Mã Điều Kiện Kết Thúc Ván Đấu
        </h3>

        <div className="table-responsive">
          <table className="styled-table">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Điều Kiện Kích Hoạt</th>
                <th>Kết Quả</th>
                <th>Ý Nghĩa Chiến Thuật</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong style={{ color: 'var(--emerald-400)' }}>W1</strong></td>
                <td>Một bên bị ăn hết sạch 1 loại quân (toàn bộ Kéo, hoặc toàn bộ Búa, hoặc toàn bộ Bao)</td>
                <td>Bên kia thắng ngay</td>
                <td>Bảo toàn lực lượng, bảo vệ quân chủng sắp hết</td>
              </tr>
              <tr>
                <td><strong style={{ color: 'var(--cyan-400)' }}>W2</strong></td>
                <td>Quân Trắng vào ô <code>i9</code> HOẶC quân Đen vào ô <code>a1</code></td>
                <td>Bên có quân vào đích thắng ngay</td>
                <td>Chiến thuật chạy đua ô góc đích (corner rush)</td>
              </tr>
              <tr>
                <td><strong style={{ color: 'var(--amber-400)' }}>D1</strong></td>
                <td>Bên tới lượt đi nhưng không còn bất kỳ nước đi hợp lệ nào</td>
                <td>Bên hết nước bị xử thua</td>
                <td>Chiến thuật vây hãm (stalemate defeat)</td>
              </tr>
              <tr>
                <td><strong style={{ color: 'var(--text-secondary)' }}>D2</strong></td>
                <td>Lặp lại thế cờ 3 lần HOẶC ván đấu vượt quá 200 nước</td>
                <td>Hòa (mỗi bên +1 điểm)</td>
                <td>Tránh các vòng lặp vô tận</td>
              </tr>
              <tr>
                <td><strong style={{ color: 'var(--rose-500)' }}>T1</strong></td>
                <td>Bot bị quá giờ (timeout), crash ném ngoại lệ hoặc trả nước sai luật</td>
                <td>Bot đó bị xử thua ngay</td>
                <td>Đảm bảo sự ổn định của hệ thống giải đấu</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Bot Protocol */}
      <div className="glass-card">
        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem', color: 'var(--primary-400)' }}>
          <Cpu size={20} /> Giao Thức Lập Trình Bot (Python)
        </h3>
        <p style={{ color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          File <code>bot.py</code> nộp lên bắt buộc phải định nghĩa hàm <code>choose_move(state)</code> trả về tuple tọa độ ô xuất phát và ô đến:
        </p>

        <pre className="code-snippet">
{`# bot.py mẫu tiêu chuẩn cho thí sinh
from typing import Tuple

def choose_move(state) -> Tuple[str, str]:
    """
    Args:
        state: Đối tượng BoardState chứa:
          - state.board: dict[(col, row) -> Piece]
          - state.current_player: 'W' hoặc 'B'
          - state.move_count: số nước đã đi
    
    Returns:
        tuple[str, str]: ("e2", "e3") - tọa độ ô đi và ô đến (chữ thường)
    """
    # Viết logic chiến thuật của bạn tại đây
    return ("e2", "e3")
`}
        </pre>
      </div>
    </div>
  );
}
