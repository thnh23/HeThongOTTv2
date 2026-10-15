import React, { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Swords,
  Trophy,
  Upload,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  Download,
  BookOpen,
  Cpu,
  ShieldCheck,
  Radio,
  FileCode,
  Flame,
  Target,
  Zap,
  RotateCcw,
} from 'lucide-react';
import { BoardSVG } from '@/shared/components/BoardSVG/BoardSVG.jsx';
import { StarterKitModal } from '@/shared/components/StarterKitModal/index.js';
import {
  INITIAL_BOARD,
  getSquareMoveDetails,
  PIECE_NAMES,
  WHITE_GOAL,
  BLACK_GOAL,
} from '@/shared/constants/gameState.js';
import { soundFx } from '@/shared/services/soundFx.js';
import './HomePage.css';

const TACTICAL_PRESETS = [
  {
    id: 'initial',
    name: 'Khởi Đầu 9×9',
    icon: '⚔️',
    board: INITIAL_BOARD,
    selectedSq: 'b2',
    lastMove: null,
    desc: 'Thế cờ 9×9 khởi đầu tiêu chuẩn: 18 quân Trắng (hàng 1-2, đi trước) và 18 quân Đen (hàng 8-9). Quân Búa Trắng tại b2 có 3 nước tiến hợp lệ vào hàng 3.',
  },
  {
    id: 'rock_scissors',
    name: '👊 Búa Ăn Kéo',
    icon: '👊',
    board: {
      ...INITIAL_BOARD,
      e5: { player: 'W', type: 'R' },
      e6: { player: 'B', type: 'S' },
    },
    selectedSq: 'e5',
    lastMove: { from: 'e4', to: 'e5', player: 'W' },
    desc: 'Búa Trắng ở ô e5 tấn công Kéo Đen ở ô e6 (ô viền đỏ) theo quy tắc Búa đập Kéo! Hãy nhấp vào ô e6 để thực hiện nước ăn quân.',
  },
  {
    id: 'white_goal',
    name: '👑 Chạy Đích i9',
    icon: '👑',
    board: {
      ...INITIAL_BOARD,
      h8: { player: 'W', type: 'P' },
    },
    selectedSq: 'h8',
    lastMove: { from: 'g7', to: 'h8', player: 'W' },
    desc: 'Quân Bao Trắng ở h8 chỉ cần 1 bước tiến chéo vào ô góc i9 (ô viền đỏ W2) ăn Búa Đen là giành chiến thắng ngay lập tức (Mã W2)!',
  },
  {
    id: 'black_goal',
    name: '🎯 Đột Phá a1',
    icon: '🎯',
    board: {
      ...INITIAL_BOARD,
      b2: { player: 'B', type: 'P' },
    },
    selectedSq: 'b2',
    lastMove: { from: 'c3', to: 'b2', player: 'B' },
    desc: 'Quân Bao Đen ở b2 áp sát và ăn Búa Trắng tại ô góc a1 (ô viền đỏ B2) là kết liễu trận đấu (Mã B2)!',
  },
];

export function HomePage() {
  const [activePresetId, setActivePresetId] = useState(TACTICAL_PRESETS[0].id);
  const [boardState, setBoardState] = useState(TACTICAL_PRESETS[0].board);
  const [selectedSq, setSelectedSq] = useState(TACTICAL_PRESETS[0].selectedSq);
  const [lastMove, setLastMove] = useState(TACTICAL_PRESETS[0].lastMove);
  const [statusMessage, setStatusMessage] = useState(TACTICAL_PRESETS[0].desc);
  const [isStarterKitOpen, setIsStarterKitOpen] = useState(false);

  // Calculate real legal moves and combat targets using OTTv2 official rules
  const moveDetails = useMemo(() => {
    return getSquareMoveDetails(boardState, selectedSq);
  }, [boardState, selectedSq]);

  const highlighted = moveDetails.emptyMoves;
  const capturable = useMemo(() => moveDetails.captureMoves.map((c) => c.sq), [moveDetails]);

  const handleSquareClick = (sq, piece) => {
    const isLegalEmpty = moveDetails.emptyMoves.includes(sq);
    const isCapturable = moveDetails.captureMoves.some((c) => c.sq === sq);

    // 1. Move or capture piece if currently selected piece can legally go to 'sq'
    if (selectedSq && (isLegalEmpty || isCapturable)) {
      const movingPiece = boardState[selectedSq];
      const capturedPiece = boardState[sq];

      const newBoard = { ...boardState };
      delete newBoard[selectedSq];
      newBoard[sq] = movingPiece;

      const newMove = {
        from: selectedSq,
        to: sq,
        player: movingPiece.player,
        captured: capturedPiece ? capturedPiece.type : null,
      };

      setBoardState(newBoard);
      setSelectedSq(sq);
      setLastMove(newMove);

      const isWhiteWinW2 = sq === WHITE_GOAL && movingPiece.player === 'W';
      const isBlackWinB2 = sq === BLACK_GOAL && movingPiece.player === 'B';

      if (isWhiteWinW2) {
        soundFx.playVictory();
        setStatusMessage('👑 CHIẾN THẮNG MÃ W2: Quân Trắng đã đột phá thành công vào ô góc đích i9!');
      } else if (isBlackWinB2) {
        soundFx.playVictory();
        setStatusMessage('🎯 CHIẾN THẮNG MÃ B2: Quân Đen đã kết liễu trận đấu khi tiến vào ô đích a1!');
      } else if (isCapturable) {
        soundFx.playCapture();
        setStatusMessage(
          `⚔️ ĂN QUÂN THÀNH CÔNG: ${PIECE_NAMES[movingPiece.type]} ăn ${PIECE_NAMES[capturedPiece.type]} tại ô ${sq}!`
        );
      } else {
        soundFx.playMove();
        setStatusMessage(
          `Đã di chuyển ${movingPiece.player === 'W' ? 'Trắng' : 'Đen'} ${PIECE_NAMES[movingPiece.type]} từ ${selectedSq} tới ${sq}.`
        );
      }
      return;
    }

    // 2. Click on an existing piece -> Select this piece and highlight its legal moves
    if (piece) {
      setSelectedSq(sq);
      soundFx.playMove();
      const details = getSquareMoveDetails(boardState, sq);
      const totalLegal = details.emptyMoves.length + details.captureMoves.length;
      if (totalLegal > 0) {
        setStatusMessage(
          `Đang chọn ${piece.player === 'W' ? 'Trắng' : 'Đen'} ${PIECE_NAMES[piece.type]} tại ${sq}: có ${totalLegal} nước hợp lệ (ô xanh: đi được, ô đỏ: ăn quân). Nhấp ô xanh/đỏ để đi thử!`
        );
      } else {
        setStatusMessage(
          `Quân ${piece.player === 'W' ? 'Trắng' : 'Đen'} ${PIECE_NAMES[piece.type]} tại ${sq} đang bị chặn kín bởi quân cùng phe (0 nước hợp lệ).`
        );
      }
      return;
    }

    // 3. Click on an empty square that is NOT a legal move -> Clear selection, do NOT highlight empty square!
    setSelectedSq(null);
    setStatusMessage(`Ô ${sq} là ô trống. Hãy nhấp vào một quân cờ để xem nước đi hợp lệ hoặc điều khiển nước cờ.`);
  };

  const handleSelectPreset = (preset) => {
    setActivePresetId(preset.id);
    setBoardState(preset.board);
    setSelectedSq(preset.selectedSq);
    setLastMove(preset.lastMove);
    setStatusMessage(preset.desc);

    if (preset.id === 'rock_scissors') {
      soundFx.playCapture();
    } else if (preset.id.includes('goal')) {
      soundFx.playVictory();
    } else {
      soundFx.playMove();
    }
  };

  const handleResetCurrentPreset = () => {
    const currentPreset = TACTICAL_PRESETS.find((p) => p.id === activePresetId) || TACTICAL_PRESETS[0];
    handleSelectPreset(currentPreset);
  };

  return (
    <div className="home-page animate-fade-in">
      {/* Hero Section */}
      <section className="home-hero">
        <div className="hero-ticker">
          <span className="ticker-badge">HOT 2026</span>
          <span className="ticker-text">Giải Đấu OTTv2 Chính Thức Mở Cổng Nộp Bot & Thi Đấu Round-Robin</span>
        </div>

        <h1 className="hero-title">
          Đấu Trường Trí Tuệ <br />
          <span className="gradient-text">Oẳn Tù Tì v2 (OTTv2)</span>
        </h1>

        <p className="hero-subtitle">
          Lập trình bot cờ Búa - Kéo - Bao trên bàn 9×9, kiểm thử tự động trong Sandbox cô lập,
          thi đấu vòng tròn phân hạng và rèn luyện kỹ năng Prompt Engineering chuẩn công nghiệp.
        </p>

        <div className="hero-cta">
          <button
            id="hero-starter-kit-btn"
            className="btn btn-primary"
            onClick={() => setIsStarterKitOpen(true)}
          >
            <Sparkles size={18} />
            <span>Tải Starter Kit (.ZIP)</span>
          </button>
          <Link id="hero-submit-btn" to="/submit" className="btn btn-secondary">
            <Upload size={18} />
            <span>Nộp Bot & Chạy Thử</span>
          </Link>
          <Link id="hero-leaderboard-btn" to="/leaderboard" className="btn btn-outline">
            <Trophy size={18} />
            <span>Bảng Xếp Hạng</span>
          </Link>
          <Link to="/matches" className="btn btn-outline">
            <Radio size={16} color="var(--rose-500)" className="animate-pulse" />
            <span>Xem Trực Tiếp</span>
          </Link>
        </div>

        {/* Stats Summary */}
        <div className="hero-stats">
          <div className="stat-card glass-card">
            <span className="stat-value gradient-text">9 × 9</span>
            <span className="stat-label">Bàn Cờ Chiến Thuật</span>
          </div>
          <div className="stat-card glass-card">
            <span className="stat-value gradient-cyan">3 Bảng</span>
            <span className="stat-label">Phân Hạng A / B / C</span>
          </div>
          <div className="stat-card glass-card">
            <span className="stat-value" style={{ color: 'var(--amber-400)' }}>100%</span>
            <span className="stat-label">Sandbox Tự Động</span>
          </div>
          <div className="stat-card glass-card">
            <span className="stat-value" style={{ color: 'var(--emerald-400)' }}>T08 & T09</span>
            <span className="stat-label">Chuẩn Nộp & Bảo Mật</span>
          </div>
        </div>
      </section>

      {/* Interactive Board Preview Section */}
      <section className="interactive-section glass-card">
        <div className="preview-info">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="preview-tag">Bàn Cờ Thử Nghiệm Tương Tác</span>
            <span className="scenario-badge">Tình Huống Mẫu</span>
          </div>

          <h2>Trải nghiệm luật OTTv2 trực quan</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Mỗi bên gồm các quân Búa 👊, Kéo ✂️, Bao ✋ (18 quân/bên). Quân cờ di chuyển 1 ô theo 8 hướng.
            Cùng loại chặn nhau; khác loại thì quy tắc Búa đập Kéo, Kéo cắt Bao, Bao bọc Búa.
          </p>

          {/* Tactical Scenario Quick Presets */}
          <div className="preset-selector-wrap">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.4rem' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                Chọn tình huống chiến thuật:
              </span>
              <button
                type="button"
                className="btn btn-outline btn-xs"
                onClick={handleResetCurrentPreset}
                style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                title="Khôi phục lại thế cờ ban đầu"
              >
                <RotateCcw size={12} />
                <span>Đặt lại</span>
              </button>
            </div>
            <div className="preset-buttons-grid">
              {TACTICAL_PRESETS.map((p) => (
                <button
                  key={p.id}
                  className={`preset-btn ${activePresetId === p.id ? 'active' : ''}`}
                  onClick={() => handleSelectPreset(p)}
                >
                  <span className="preset-icon">{p.icon}</span>
                  <span>{p.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Dynamic Scenario Callout */}
          <div className="scenario-callout">
            <Zap size={16} color="var(--amber-400)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, fontSize: '0.875rem', color: '#fff' }}>
              {statusMessage}
            </p>
          </div>

          <ul className="rules-key-points">
            <li>
              <CheckCircle2 size={16} color="var(--emerald-400)" />
              <span><strong>Mã W1 / B1:</strong> Ăn sạch hoàn toàn 1 loại quân của đối phương</span>
            </li>
            <li>
              <CheckCircle2 size={16} color="var(--cyan-400)" />
              <span><strong>Mã W2 / B2:</strong> Đưa quân vào ô góc đích (Trắng vào <code>i9</code>, Đen vào <code>a1</code>)</span>
            </li>
            <li>
              <CheckCircle2 size={16} color="var(--amber-400)" />
              <span><strong>Chống Cháy Giờ (D2):</strong> Giới hạn 200 nước đi hoặc lặp thế 3 lần</span>
            </li>
          </ul>

          <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.75rem' }}>
            <Link to="/rules" className="btn btn-secondary btn-sm">
              <BookOpen size={15} />
              <span>Xem Quy Chuẩn Kỹ Thuật Đầy Đủ</span>
            </Link>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <BoardSVG
            boardState={boardState}
            selectedSquare={selectedSq}
            highlightedSquares={highlighted}
            capturableSquares={capturable}
            lastMove={lastMove}
            onSquareClick={handleSquareClick}
            size={480}
          />
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="features-showcase-section">
        <div className="section-header">
          <h2 className="section-title">Hệ Sinh Thái Thi Đấu Hiện Đại</h2>
          <p className="section-subtitle">Được thiết kế chuẩn mực dành cho sinh viên công nghệ thông tin UET</p>
        </div>

        <div className="features-grid">
          <div className="feature-card glass-card">
            <div className="feature-icon-wrap icon-cyan">
              <Cpu size={24} />
            </div>
            <h3>Sandbox Cô Lập 100%</h3>
            <p>
              Mỗi bot chạy trong môi trường Sandbox cô lập không thể truy cập Internet, ngăn chặn rò rỉ mã nguồn và tài nguyên hệ thống.
            </p>
          </div>

          <div className="feature-card glass-card">
            <div className="feature-icon-wrap icon-purple">
              <Swords size={24} />
            </div>
            <h3>Vòng Tròn Round-Robin</h3>
            <p>
              Tự động ghép cặp thi đấu 2 lượt đổi phe (Trắng - Đen và Đen - Trắng), đảm bảo tính công bằng và khách quan tối đa.
            </p>
          </div>

          <div className="feature-card glass-card">
            <div className="feature-icon-wrap icon-rose">
              <Radio size={24} />
            </div>
            <h3>WebSocket Trực Tiếp & Replay</h3>
            <p>
              Theo dõi trực tiếp từng mili-giây nước cờ hoặc xem lại toàn bộ lịch sử ván đấu với bảng phân tích quân số trực quan.
            </p>
          </div>

          <div className="feature-card glass-card">
            <div className="feature-icon-wrap icon-amber">
              <ShieldCheck size={24} />
            </div>
            <h3>Bảo Mật T08 & T09</h3>
            <p>
              Kiểm tra hồ sơ Prompt Engineering và quét tự động rò rỉ API key (OpenAI/Anthropic/Google) trước khi kích hoạt bài thi.
            </p>
          </div>
        </div>
      </section>

      {/* Tiers Classification Section */}
      <section>
        <div className="section-header">
          <h2 className="section-title">3 Bảng Thi Đấu Công Bằng</h2>
          <p className="section-subtitle">Phù hợp với mọi mức độ từ người mới bắt đầu đến lập trình nâng cao</p>
        </div>

        <div className="tiers-grid">
          {/* Tier A */}
          <div className="tier-card glass-card">
            <div>
              <div className="tier-header">
                <span className="tier-badge-large tier-A">BẢNG A</span>
                <span className="tier-score-range">0 – 39 Điểm Test</span>
              </div>
              <h3 className="tier-name">Bảng Khởi Động</h3>
              <p className="tier-desc">
                Dành cho sinh viên mới tiếp cận Python. Tập trung hiểu cấu trúc dữ liệu, vòng lặp và mở rộng từ RandomBot có sẵn trong Starter Kit.
              </p>
            </div>
            <ul className="tier-features">
              <li><CheckCircle2 size={16} color="var(--cyan-400)" /> Có sẵn Starter Kit & RandomBot</li>
              <li><CheckCircle2 size={16} color="var(--cyan-400)" /> Thời gian 2.0 giây / nước đi</li>
              <li><CheckCircle2 size={16} color="var(--cyan-400)" /> Trọng số cao ở nhật ký học tập (PROMPTS.md)</li>
            </ul>
            <div style={{ marginTop: '1.25rem' }}>
              <button
                className="btn btn-outline btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
                onClick={() => setIsStarterKitOpen(true)}
              >
                <span>Tải Starter Kit Bảng A</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>

          {/* Tier B */}
          <div className="tier-card glass-card">
            <div>
              <div className="tier-header">
                <span className="tier-badge-large tier-B">BẢNG B</span>
                <span className="tier-score-range">40 – 74 Điểm Test</span>
              </div>
              <h3 className="tier-name">Bảng Tiến Phát</h3>
              <p className="tier-desc">
                Đã nắm vững nền tảng cơ bản. Sinh viên tự xây dựng hàm đánh giá thế cờ (heuristic) và nhìn trước 1–2 nước cờ đối kháng.
              </p>
            </div>
            <ul className="tier-features">
              <li><CheckCircle2 size={16} color="var(--violet-500)" /> Cung cấp Engine luật & Khung bot</li>
              <li><CheckCircle2 size={16} color="var(--violet-500)" /> Thời gian 1.0 giây / nước đi</li>
              <li><CheckCircle2 size={16} color="var(--violet-500)" /> Chiến thuật Greedy hoặc Heuristic search</li>
            </ul>
            <div style={{ marginTop: '1.25rem' }}>
              <Link
                to="/submit"
                className="btn btn-outline btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span>Nộp Bot Bảng B</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          {/* Tier C */}
          <div className="tier-card glass-card">
            <div>
              <div className="tier-header">
                <span className="tier-badge-large tier-C">BẢNG C</span>
                <span className="tier-score-range">75 – 100 Điểm Test</span>
              </div>
              <h3 className="tier-name">Bảng Thử Thách</h3>
              <p className="tier-desc">
                Dành cho thí sinh xuất sắc. Tự do cài đặt thuật toán Minimax, Alpha-Beta Pruning hoặc tối ưu tốc độ tính toán ma trận.
              </p>
            </div>
            <ul className="tier-features">
              <li><CheckCircle2 size={16} color="var(--amber-400)" /> Bắt buộc có lịch sử Git commit (T08)</li>
              <li><CheckCircle2 size={16} color="var(--amber-400)" /> Thời gian 0.5 giây / nước đi</li>
              <li><CheckCircle2 size={16} color="var(--amber-400)" /> Tỉ trọng điểm trận đấu cao nhất (50%)</li>
            </ul>
            <div style={{ marginTop: '1.25rem' }}>
              <Link
                to="/submit"
                className="btn btn-primary btn-sm"
                style={{ width: '100%', justifyContent: 'center' }}
              >
                <span>Thách Thức Bảng C</span>
                <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Starter Kit Modal */}
      <StarterKitModal isOpen={isStarterKitOpen} onClose={() => setIsStarterKitOpen(false)} />
    </div>
  );
}
