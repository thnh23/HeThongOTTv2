import React, { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Swords,
  Trophy,
  Upload,
  Sparkles,
  CheckCircle2,
  ArrowRight,
  BookOpen,
  ShieldCheck,
  Radio,
  FileCode,
  Target,
  Zap,
  RotateCcw,
  Calendar,
  Award,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  Search,
  GraduationCap,
  GitBranch,
  Check,
} from 'lucide-react';
import { BoardSVG } from '@/shared/components/BoardSVG/BoardSVG.jsx';
import { Countdown } from '@/shared/components/Countdown/Countdown.jsx';
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
  const navigate = useNavigate();
  const [activePresetId, setActivePresetId] = useState(TACTICAL_PRESETS[0].id);
  const [boardState, setBoardState] = useState(TACTICAL_PRESETS[0].board);
  const [selectedSq, setSelectedSq] = useState(TACTICAL_PRESETS[0].selectedSq);
  const [lastMove, setLastMove] = useState(TACTICAL_PRESETS[0].lastMove);
  const [statusMessage, setStatusMessage] = useState(TACTICAL_PRESETS[0].desc);
  const [isStarterKitOpen, setIsStarterKitOpen] = useState(false);
  const [openFaqId, setOpenFaqId] = useState(0);

  // Hero Search State
  const [studentSearchId, setStudentSearchId] = useState('');

  const handleHeroSearch = (e) => {
    e.preventDefault();
    if (studentSearchId.trim()) {
      navigate(`/leaderboard?q=${encodeURIComponent(studentSearchId.trim())}`);
    } else {
      navigate('/leaderboard');
    }
  };

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

    // 3. Click on an empty square that is NOT a legal move -> Clear selection
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
          <span className="ticker-badge">UET 2026</span>
          <span className="ticker-text">Đấu Trường Thuật Toán &amp; Game Chiến Thuật OTTv2 • Khoa CNTT - VNU-UET • 13 Vòng Swiss</span>
        </div>

        <h1 className="hero-title">
          Đấu Trường Thuật Toán &amp; Game Chiến Thuật <br />
          <span className="gradient-text">Oẳn Tù Tì v2 (OTTv2)</span>
        </h1>

        <p className="hero-subtitle">
          Sân chơi lập trình trí tuệ nhân tạo đối kháng 9×9 dành cho sinh viên Khoa CNTT - VNU-UET. Chấm thi tự động
          trên Sandbox cô lập an toàn, phân hạng công bằng qua 13 Vòng Thụy Sĩ (Swiss System) và Vòng Chung Kết Top 32 Knockout.
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
            <span>Nộp Bot &amp; Kiểm Thử</span>
          </Link>
          <Link id="hero-leaderboard-btn" to="/leaderboard" className="btn btn-outline">
            <Trophy size={18} />
            <span>Bảng Xếp Hạng 13 Vòng</span>
          </Link>
          <Link to="/live" className="btn btn-outline">
            <Radio size={16} color="var(--rose-600)" className="animate-pulse" />
            <span>Xem Trực Tiếp</span>
          </Link>
        </div>

        {/* Hero Search Widget */}
        <div className="hero-search-container glass-card">
          <div className="hero-search-header">
            <Search size={18} className="search-header-icon" />
            <span className="search-header-title">Tra Cứu Nhanh Thí Sinh &amp; Kết Quả Thi Đấu</span>
            <span className="search-header-badge">Trực Tuyến</span>
          </div>

          <form className="hero-search-form" onSubmit={handleHeroSearch}>
            <div className="hero-search-input-wrap">
              <input
                id="hero-student-search-input"
                type="text"
                className="hero-search-input"
                placeholder="Nhập Mã Sinh Viên (vd: 21020001) hoặc Tên Bot để tra cứu thứ hạng, bàn đấu..."
                value={studentSearchId}
                onChange={(e) => setStudentSearchId(e.target.value)}
                aria-label="Tra cứu thông tin theo mã sinh viên hoặc tên bot"
              />
            </div>
            <button type="submit" className="btn btn-primary hero-search-btn">
              <Search size={16} />
              <span>Tra Cứu</span>
            </button>
          </form>

          <div className="hero-search-hints">
            <span className="hints-label">Gợi ý nhanh:</span>
            <button
              type="button"
              className="hint-chip"
              onClick={() => {
                setStudentSearchId('21020001');
                navigate('/leaderboard?q=21020001');
              }}
            >
              21020001
            </button>
            <button
              type="button"
              className="hint-chip"
              onClick={() => {
                setStudentSearchId('22020456');
                navigate('/leaderboard?q=22020456');
              }}
            >
              22020456
            </button>
            <button
              type="button"
              className="hint-chip"
              onClick={() => {
                setStudentSearchId('23021999');
                navigate('/leaderboard?q=23021999');
              }}
            >
              23021999
            </button>
            <Link to="/leaderboard" className="hint-link">
              <span>Xem bảng tổng sắp toàn giải</span>
              <ArrowRight size={13} />
            </Link>
          </div>
        </div>

        {/* Countdown to Submission Deadline */}
        <div style={{ maxWidth: '680px', margin: '1.5rem auto 0', width: '100%' }}>
          <Countdown
            targetDate="2026-11-20T23:59:59"
            title="Đồng Hồ Đếm Ngược: Hạn Chót Nộp Bot Vòng Bảng"
          />
        </div>

        {/* 4 Stats Summary Cards */}
        <div className="hero-stats">
          <div className="stat-card glass-card">
            <span className="stat-value gradient-text">9 × 9</span>
            <span className="stat-label">Bàn Cờ Chiến Thuật</span>
            <span className="stat-sublabel">36 quân cờ đối kháng</span>
          </div>
          <div className="stat-card glass-card">
            <span className="stat-value gradient-blue">13 Vòng</span>
            <span className="stat-label">Hệ Thống Thụy Sĩ</span>
            <span className="stat-sublabel">Ghép cặp cân bằng (3-1-0)</span>
          </div>
          <div className="stat-card glass-card">
            <span className="stat-value" style={{ color: 'var(--amber-600)' }}>Top 32</span>
            <span className="stat-label">Vòng Chung Kết</span>
            <span className="stat-sublabel">Knockout &amp; Ô Chướng Ngại</span>
          </div>
          <div className="stat-card glass-card">
            <span className="stat-value" style={{ color: 'var(--emerald-600)' }}>10.0</span>
            <span className="stat-label">Điểm A+ Học Phần</span>
            <span className="stat-sublabel">Thang điểm minh bạch</span>
          </div>
        </div>
      </section>

      {/* Academic Integrity & AI Policy Banner */}
      <section className="integrity-section">
        <div className="integrity-card glass-card">
          <div className="integrity-header">
            <div className="integrity-icon-wrap">
              <ShieldCheck size={28} />
            </div>
            <div>
              <div className="integrity-badge">Chuẩn Mực Kỹ Sư UET</div>
              <h2 className="integrity-title">Chính Sách Liêm Chính Học Thuật &amp; Kiểm Soát AI</h2>
              <p className="integrity-subtitle">
                Giải đấu đề cao tư duy giải thuật độc lập và tác phong kỹ sư phần mềm. Nghiêm cấm mọi hành vi gian lận hoặc sao chép mã nguồn không trung thực.
              </p>
            </div>
          </div>

          <div className="integrity-grid">
            <div className="integrity-pillar">
              <div className="pillar-num">01</div>
              <h4>Mã Nguồn Tự Lập Trình</h4>
              <p>
                Sinh viên tự viết hàm đánh giá thế cờ và thuật toán. Được dùng AI để tìm hiểu ý tưởng hoặc sửa lỗi cú pháp, tuyệt đối không copy 100% code mà không hiểu bản chất.
              </p>
            </div>

            <div className="integrity-pillar">
              <div className="pillar-num">02</div>
              <h4>Tối Thiểu 4–5 Git Commits</h4>
              <p>
                Repository GitHub nộp qua Google Form phải thể hiện rõ lịch sử commit liên tục qua các ngày/tuần (Khởi tạo ➔ Heuristic ➔ Tìm kiếm nước đi ➔ Tối ưu). Không chấp nhận repo chỉ có 1 commit duy nhất.
              </p>
            </div>

            <div className="integrity-pillar">
              <div className="pillar-num">03</div>
              <h4>Quét Cây Cú Pháp MOSS</h4>
              <p>
                Toàn bộ bài nộp được đối chiếu cây cú pháp trừu tượng (AST) qua hệ thống MOSS Stanford. Phát hiện sao chép giữa các sinh viên sẽ lập tức bị hủy kết quả và nhận 0 điểm.
              </p>
            </div>

            <div className="integrity-pillar">
              <div className="pillar-num">04</div>
              <h4>Vấn Đáp Bảo Vệ Top 32</h4>
              <p>
                32 thí sinh xuất sắc nhất lọt vào Vòng Chung Kết bắt buộc trải qua 5 phút phỏng vấn trực tiếp với Hội đồng Giảng viên để xác nhận quyền tác giả trước khi nhận điểm 10.0 A+.
              </p>
            </div>
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
            <Zap size={16} color="var(--amber-600)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--amber-900)' }}>
              {statusMessage}
            </p>
          </div>

          <ul className="rules-key-points">
            <li>
              <CheckCircle2 size={16} color="var(--emerald-600)" />
              <span><strong>Mã W1 / B1:</strong> Ăn sạch hoàn toàn 1 loại quân của đối phương</span>
            </li>
            <li>
              <CheckCircle2 size={16} color="var(--primary-600)" />
              <span><strong>Mã W2 / B2:</strong> Đưa quân vào ô góc đích (Trắng vào <code>i9</code>, Đen vào <code>a1</code>)</span>
            </li>
            <li>
              <CheckCircle2 size={16} color="var(--amber-600)" />
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

      {/* Progressive Grading Scale Section */}
      <section className="grading-section">
        <div className="section-header">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <GraduationCap size={18} color="var(--primary-600)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Quy Đổi Điểm Học Phần
            </span>
          </div>
          <h2 className="section-title">Thang Điểm Lũy Tiến 13 Vòng Swiss</h2>
          <p className="section-subtitle">
            Cơ chế tính điểm công bằng, minh bạch dựa trên số trận thắng và thứ hạng thực tế sau 13 vòng đấu Thụy Sĩ
          </p>
        </div>

        <div className="grading-grid">
          {/* Floor Tier */}
          <div className="grading-card glass-card">
            <div className="grading-score-badge floor-badge">6.5 – 7.0 ĐIỂM</div>
            <h3 className="grading-title">Mức Sàn Tiêu Chuẩn</h3>
            <p className="grading-desc">
              Hoàn thành sản phẩm và tham gia đầy đủ giải đấu.
            </p>
            <ul className="grading-reqs">
              <li><Check size={15} color="var(--primary-600)" /> Nộp repo GitHub hợp lệ, tối thiểu 4 commits</li>
              <li><Check size={15} color="var(--primary-600)" /> Bot vượt qua Sandbox test không bị crash</li>
              <li><Check size={15} color="var(--primary-600)" /> Tham gia đầy đủ 13 vòng đấu không bỏ cuộc</li>
            </ul>
          </div>

          {/* Moderate Tier */}
          <div className="grading-card glass-card">
            <div className="grading-score-badge moderate-badge">7.5 ĐIỂM</div>
            <h3 className="grading-title">Mức Khá</h3>
            <p className="grading-desc">
              Bot có thuật toán cơ bản, biết né nước ăn và tấn công mục tiêu.
            </p>
            <ul className="grading-reqs">
              <li><Check size={15} color="var(--primary-600)" /> Đạt từ <strong>4 – 5 trận thắng</strong> trong 13 vòng</li>
              <li><Check size={15} color="var(--primary-600)" /> Có hàm Heuristic đánh giá số quân hai bên</li>
              <li><Check size={15} color="var(--primary-600)" /> Không bị lỗi timeout 2.0s / nước đi</li>
            </ul>
          </div>

          {/* Good Tier */}
          <div className="grading-card glass-card">
            <div className="grading-score-badge good-badge">8.5 ĐIỂM</div>
            <h3 className="grading-title">Mức Khá – Giỏi</h3>
            <p className="grading-desc">
              Bot có chiến lược di chuyển chiếm lĩnh trung tâm và tranh đoạt góc.
            </p>
            <ul className="grading-reqs">
              <li><Check size={15} color="var(--primary-600)" /> Đạt từ <strong>6 – 7 trận thắng</strong> trong 13 vòng</li>
              <li><Check size={15} color="var(--primary-600)" /> Tìm kiếm nhìn trước 1–2 nước cờ</li>
              <li><Check size={15} color="var(--primary-600)" /> Xử lý tốt các tình huống phòng thủ góc W2/B2</li>
            </ul>
          </div>

          {/* Very Good Tier */}
          <div className="grading-card glass-card">
            <div className="grading-score-badge high-badge">9.0 ĐIỂM</div>
            <h3 className="grading-title">Mức Giỏi</h3>
            <p className="grading-desc">
              Thứ hạng cao trong Top 20% toàn giải đấu.
            </p>
            <ul className="grading-reqs">
              <li><Check size={15} color="var(--primary-600)" /> Đạt từ <strong>8 – 9 trận thắng</strong> trong 13 vòng</li>
              <li><Check size={15} color="var(--primary-600)" /> Áp dụng Minimax hoặc Alpha-Beta Pruning</li>
              <li><Check size={15} color="var(--primary-600)" /> Tối ưu tốc độ thực thi mượt mà</li>
            </ul>
          </div>

          {/* Excellent Tier */}
          <div className="grading-card glass-card">
            <div className="grading-score-badge elite-badge">9.5 ĐIỂM</div>
            <h3 className="grading-title">Mức Xuất Sắc</h3>
            <p className="grading-desc">
              Tiệm cận Top 32 kỳ thủ hạt giống hàng đầu của toàn khóa.
            </p>
            <ul className="grading-reqs">
              <li><Check size={15} color="var(--primary-600)" /> Đạt từ <strong>10 – 11 trận thắng</strong> trong 13 vòng</li>
              <li><Check size={15} color="var(--primary-600)" /> Hệ số phụ Buchholz / Sonneborn-Berger cao</li>
              <li><Check size={15} color="var(--primary-600)" /> Cấu trúc code sạch, chú thích tường minh</li>
            </ul>
          </div>

          {/* Top 32 Grand Final Tier */}
          <div className="grading-card grand-card glass-card">
            <div className="grading-score-badge gold-badge">10.0 ĐIỂM (A+)</div>
            <h3 className="grading-title">Top 32 Chung Kết</h3>
            <p className="grading-desc">
              Vinh danh 32 cờ thủ xuất sắc nhất khoa bước vào Vòng Chung Kết.
            </p>
            <ul className="grading-reqs">
              <li><Check size={15} color="var(--amber-600)" /> Lọt vào <strong>Top 32</strong> sau 13 vòng Swiss</li>
              <li><Check size={15} color="var(--amber-600)" /> Vượt qua 5 phút vấn đáp kỹ thuật Hội đồng</li>
              <li><Check size={15} color="var(--amber-600)" /> Nâng cấp Bot v2 thích ứng ô chướng ngại vật</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Tournament Schedule Section */}
      <section className="timeline-section">
        <div className="section-header">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Calendar size={18} color="var(--primary-600)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Lịch Trình Chi Tiết
            </span>
          </div>
          <h2 className="section-title">Lộ Trình Giải Đấu 2 Ngày Tập Trung</h2>
          <p className="section-subtitle">Kế hoạch thi đấu và vận hành tinh gọn, chính xác từng vòng đấu</p>
        </div>

        <div className="timeline-track-grid">
          <div className="timeline-step-card glass-card">
            <div className="timeline-step-header">
              <span className="timeline-step-num">Giai Đoạn 1</span>
              <div className="timeline-step-icon">
                <FileCode size={18} color="var(--primary-600)" />
              </div>
            </div>
            <h3 className="timeline-step-title">Chuẩn Bị &amp; Nộp Link Repo</h3>
            <p className="timeline-step-desc">
              Sinh viên tải Starter Kit, viết Bot bằng Python, kiểm tra cục bộ qua script test. Đẩy code lên GitHub và nộp link repository qua Google Form trước hạn chót.
            </p>
          </div>

          <div className="timeline-step-card glass-card">
            <div className="timeline-step-header">
              <span className="timeline-step-num">Ngày 1 (Trọn Vẹn 1 Ngày)</span>
              <div className="timeline-step-icon">
                <Swords size={18} color="var(--primary-600)" />
              </div>
            </div>
            <h3 className="timeline-step-title">Vòng Swiss 13 Vòng &amp; Chốt Top 32</h3>
            <p className="timeline-step-desc">
              Tổ chức toàn bộ 13 vòng Thụy Sĩ trong 1 ngày duy nhất. Chấm điểm tự động trên cụm máy phân tán, cập nhật BXH realtime và chính thức chốt danh sách Top 32 kỳ thủ hạt giống.
            </p>
          </div>

          <div className="timeline-step-card glass-card">
            <div className="timeline-step-header">
              <span className="timeline-step-num">1 Tuần Đổi Code (7 Ngày)</span>
              <div className="timeline-step-icon">
                <Target size={18} color="var(--primary-600)" />
              </div>
            </div>
            <h3 className="timeline-step-title">Nâng Cấp Thuật Toán Bot v2</h3>
            <p className="timeline-step-desc">
              Công bố bản đồ bổ sung ô chướng ngại vật mới. Top 32 thí sinh có trọn vẹn 1 tuần nghiên cứu, thay đổi mã nguồn và tối ưu giải thuật tìm đường trước khi bước vào Chung kết.
            </p>
          </div>

          <div className="timeline-step-card glass-card">
            <div className="timeline-step-header">
              <span className="timeline-step-num">Sau 1 Tuần (Chung Kết)</span>
              <div className="timeline-step-icon">
                <Trophy size={18} color="var(--amber-600)" />
              </div>
            </div>
            <h3 className="timeline-step-title">Chung Kết Top 32 &amp; Trao Giải</h3>
            <p className="timeline-step-desc">
              Top 32 nộp Bot v2 thi đấu Knockout BO2 đổi phe trên bàn cờ có ô cản. Vấn đáp chuyên môn 5 phút xác thực tác quyền trước Hội đồng và trao cúp Vô địch.
            </p>
          </div>
        </div>
      </section>

      {/* Feature Highlights Grid */}
      <section className="features-showcase-section">
        <div className="section-header">
          <h2 className="section-title">Đặc Điểm Nổi Bật Của Hệ Thống</h2>
          <p className="section-subtitle">Nền tảng thi đấu cờ thuật toán tự động, công bằng và bảo mật tuyệt đối</p>
        </div>

        <div className="features-grid">
          <div className="feature-card glass-card">
            <div className="feature-icon-wrap icon-cyan">
              <ShieldCheck size={24} />
            </div>
            <h3>Sandbox Cô Lập An Toàn</h3>
            <p>
              Mỗi bot chạy trong một tiến trình riêng biệt không mạng, tước bỏ biến môi trường nhạy cảm, dập tắt timeout 2.0s bằng <code>proc.kill()</code> dứt điểm.
            </p>
          </div>

          <div className="feature-card glass-card">
            <div className="feature-icon-wrap icon-purple">
              <Swords size={24} />
            </div>
            <h3>Hệ Thống Thụy Sĩ 13 Vòng</h3>
            <p>
              Thuật toán ghép cặp Swiss System chuẩn FIDE. Thí sinh thi đấu đủ 13 vòng gặp đối thủ cùng trình độ, không bị loại sớm, phản ánh trung thực thực lực.
            </p>
          </div>

          <div className="feature-card glass-card">
            <div className="feature-icon-wrap icon-rose">
              <Radio size={24} />
            </div>
            <h3>Trực Tiếp &amp; Replay Tương Tác</h3>
            <p>
              Tường thuật trực tiếp các bàn đấu tâm điểm theo thời gian thực và xem lại chi tiết từng nước cờ với bàn cờ đồ họa SVG tương tác cao.
            </p>
          </div>

          <div className="feature-card glass-card">
            <div className="feature-icon-wrap icon-amber">
              <GitBranch size={24} />
            </div>
            <h3>Liêm Chính Học Thuật Tự Động</h3>
            <p>
              Tự động đối chiếu cây cú pháp trừu tượng AST qua MOSS Stanford, kiểm tra lịch sử Git commit minh bạch và phỏng vấn kỹ thuật Top 32.
            </p>
          </div>
        </div>
      </section>

      {/* Tournament Prizes Section */}
      <section className="prizes-section">
        <div className="section-header">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Award size={18} color="var(--amber-600)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--amber-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Vinh Danh &amp; Phần Thưởng
            </span>
          </div>
          <h2 className="section-title">Cơ Cấu Giải Thưởng Danh Dự</h2>
          <p className="section-subtitle">Ghi nhận xứng đáng tài năng và nỗ lực sáng tạo của những cờ thủ xuất sắc nhất</p>
        </div>

        <div className="prizes-grid">
          <div className="prize-card gold glass-card">
            <div className="prize-badge-icon">🥇</div>
            <span className="prize-tier-tag">Vô Địch Giải Đấu</span>
            <h3 className="prize-title">Giải Nhất (Gold)</h3>
            <p className="prize-reward">
              Cúp OTTv2 Champion mạ vàng, Giấy khen của Khoa CNTT và điểm 10.0 A+ tuyệt đối học phần.
            </p>
          </div>

          <div className="prize-card silver glass-card">
            <div className="prize-badge-icon">🥈</div>
            <span className="prize-tier-tag">Á Quân Toàn Giải</span>
            <h3 className="prize-title">Giải Nhì (Silver)</h3>
            <p className="prize-reward">
              Kỷ niệm chương mạ bạc, Giấy khen Á quân và điểm 10.0 A+ học phần.
            </p>
          </div>

          <div className="prize-card bronze glass-card">
            <div className="prize-badge-icon">🥉</div>
            <span className="prize-tier-tag">Top 3 &amp; Top 4</span>
            <h3 className="prize-title">Giải Ba (Bronze)</h3>
            <p className="prize-reward">
              Kỷ niệm chương đồng danh dự, Giấy khen và điểm 10.0 A+ học phần.
            </p>
          </div>

          <div className="prize-card special glass-card">
            <div className="prize-badge-icon">⭐</div>
            <span className="prize-tier-tag">Giải Kỹ Thuật Độc Quyền</span>
            <h3 className="prize-title">Best Algorithm</h3>
            <p className="prize-reward">
              Vinh danh thuật toán heuristic / minimax độc đáo nhất cùng lịch sử Git commit chuẩn mực kỹ sư phần mềm.
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Accordion Section */}
      <section className="faq-section">
        <div className="section-header">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <HelpCircle size={18} color="var(--primary-600)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--primary-700)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Giải Đáp Thắc Mắc
            </span>
          </div>
          <h2 className="section-title">Câu Hỏi Thường Gặp (FAQ)</h2>
          <p className="section-subtitle">Những điều thí sinh cần nắm vững trước khi bước vào 13 vòng đấu Swiss</p>
        </div>

        <div className="faq-list">
          {[
            {
              id: 0,
              q: 'Thể thức Thụy Sĩ (Swiss System) 13 vòng hoạt động như thế nào? Thua có bị loại ngay không?',
              a: 'Không! Thể thức Thụy Sĩ đảm bảo mọi thí sinh đều được thi đấu trọn vẹn cả 13 vòng đấu mà không bao giờ bị loại sớm. Sau mỗi vòng, hệ thống sẽ tự động ghép cặp các bot có cùng điểm số với nhau (người thắng gặp người thắng, người thua gặp người thua). Điều này giúp các trận đấu luôn cân tài cân sức và phản ánh chính xác trình độ.',
            },
            {
              id: 1,
              q: 'Nộp bài qua GitHub và Google Form có yêu cầu gì về quyền truy cập và Git commit?',
              a: 'Sinh viên cần fork hoặc tạo repository từ template mẫu, bắt buộc để chế độ Public để máy chấm tự động tải mã nguồn. Trong repo bắt buộc phải có tối thiểu 4–5 commits thể hiện tiến trình làm bài qua các ngày. Không chấp nhận repo chỉ có 1 commit duy nhất.',
            },
            {
              id: 2,
              q: 'Tôi có thể sử dụng AI (ChatGPT, Claude, Copilot) khi làm bài thi không?',
              a: 'Bạn được phép sử dụng AI để giải thích lý thuyết giải thuật, tìm hiểu cú pháp Python hoặc gợi ý cách debug lỗi. Tuy nhiên, toàn bộ logic thuật toán Heuristic hoặc Minimax phải do bạn tự hiểu và làm chủ. Mọi bài thi đều được quét cây cú pháp AST qua hệ thống MOSS Stanford và Top 32 phải trải qua 5 phút phỏng vấn trực tiếp trước Hội đồng.',
            },
            {
              id: 3,
              q: 'Thời gian giới hạn cho mỗi nước đi (timeout) là bao nhiêu? Nếu bot bị crash thì sao?',
              a: 'Thời gian tối đa cho mỗi nước đi là 2.0 giây. Nếu bot của bạn chạy quá thời gian (timeout) hoặc sinh ngoại lệ lỗi (crash), tiến trình con sẽ bị Sandbox dập tắt ngay lập tức và bị xử thua ván đấu đó. Hãy dùng script test cục bộ đi kèm trong Starter Kit để đảm bảo bot chạy ổn định.',
            },
            {
              id: 4,
              q: 'Vòng Chung Kết Top 32 có gì đặc biệt so với 13 vòng Swiss?',
              a: 'Ngay sau khi kết thúc 13 vòng Swiss và chốt danh sách Top 32 trong ngày thi đấu thứ nhất, Ban Tổ Chức sẽ công bố một bản đồ bàn cờ 9×9 mới có bổ sung các ô chướng ngại vật cố định (quân cờ không thể đi vào). 32 thí sinh sẽ có trọn vẹn 01 tuần để nghiên cứu, thay đổi mã nguồn nâng cấp thuật toán (Bot v2) và thi đấu Knockout trực tiếp tại Hội trường.',
            },
          ].map((faq) => {
            const isOpen = openFaqId === faq.id;
            return (
              <div key={faq.id} className={`faq-item ${isOpen ? 'open' : ''}`}>
                <button
                  type="button"
                  className="faq-question-btn"
                  onClick={() => setOpenFaqId(isOpen ? null : faq.id)}
                  aria-expanded={isOpen}
                >
                  <span>{faq.q}</span>
                  {isOpen ? <ChevronUp size={18} color="var(--primary-600)" /> : <ChevronDown size={18} />}
                </button>
                {isOpen && (
                  <div className="faq-answer-content">
                    <p style={{ margin: 0 }}>{faq.a}</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* Starter Kit Modal */}
      <StarterKitModal isOpen={isStarterKitOpen} onClose={() => setIsStarterKitOpen(false)} />
    </div>
  );
}

export default HomePage;
