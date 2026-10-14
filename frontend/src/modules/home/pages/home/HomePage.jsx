import React, { useState } from 'react';
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
} from 'lucide-react';
import { BoardSVG } from '@/shared/components/BoardSVG/BoardSVG.jsx';
import { StarterKitModal } from '@/shared/components/StarterKitModal/index.js';
import './HomePage.css';

// Initial demo board representation (12x12 corner display)
const DEMO_BOARD = {
  a1: { player: 'W', type: 'R' }, b1: { player: 'W', type: 'S' }, c1: { player: 'W', type: 'P' },
  d1: { player: 'W', type: 'R' }, e1: { player: 'W', type: 'S' }, f1: { player: 'W', type: 'P' },
  a2: { player: 'W', type: 'P' }, b2: { player: 'W', type: 'R' }, c2: { player: 'W', type: 'S' },
  a11: { player: 'B', type: 'S' }, b11: { player: 'B', type: 'R' }, c11: { player: 'B', type: 'P' },
  a12: { player: 'B', type: 'P' }, b12: { player: 'B', type: 'S' }, c12: { player: 'B', type: 'R' },
  d12: { player: 'B', type: 'S' }, e12: { player: 'B', type: 'R' }, f12: { player: 'B', type: 'P' },
};

export function HomePage() {
  const [selectedSq, setSelectedSq] = useState('b2');
  const [highlighted, setHighlighted] = useState(['b3', 'a3', 'c3']);
  const [isStarterKitOpen, setIsStarterKitOpen] = useState(false);

  const handleSquareClick = (sq, piece) => {
    setSelectedSq(sq);
    if (piece) {
      setHighlighted([]);
    }
  };

  return (
    <div className="home-page animate-fade-in">
      {/* Hero Section */}
      <section className="home-hero">
        <div className="hero-tag">
          <Sparkles size={15} />
          <span>Đấu Trường AI Bot Dành Cho Sinh Viên UET 2026</span>
        </div>

        <h1 className="hero-title">
          Đấu Trường Trí Tuệ <br />
          <span className="gradient-text">Oán Thù Tương Tàn v2 (OTTv2)</span>
        </h1>

        <p className="hero-subtitle">
          Lập trình bot cờ Búa - Kéo - Bao trên bàn 12×12, kiểm thử tự động trong Sandbox cô lập,
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
        </div>

        {/* Stats Summary */}
        <div className="hero-stats">
          <div className="stat-card glass-card">
            <span className="stat-value gradient-text">12 × 12</span>
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
          <span className="preview-tag">Bàn Cờ Thử Nghiệm Tương Tác</span>
          <h2>Trải nghiệm luật OTTv2 trực quan</h2>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7 }}>
            Mỗi bên gồm các quân Búa 👊, Kéo ✂️, Bao ✋. Quân cờ di chuyển 1 ô theo 8 hướng.
            Cùng loại chặn nhau; khác loại thì quy tắc Búa đập Kéo, Kéo cắt Bao, Bao bọc Búa.
          </p>
          <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginTop: '0.5rem' }}>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={18} color="var(--emerald-400)" />
              <span><strong>Thắng Tuyệt Đối:</strong> Ăn hết sạch 1 loại quân của đối phương (W1, W2, W3)</span>
            </li>
            <li style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <CheckCircle2 size={18} color="var(--emerald-400)" />
              <span><strong>Chống Cháy Giờ:</strong> Giới hạn 200 nước đi (T1) tránh ván đấu bế tắc</span>
            </li>
          </ul>
          <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
            <Link to="/rules" className="btn btn-secondary btn-sm">
              <BookOpen size={15} />
              <span>Xem Quy Chuẩn Kỹ Thuật</span>
            </Link>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <BoardSVG
            boardState={DEMO_BOARD}
            selectedSquare={selectedSq}
            highlightedSquares={highlighted}
            onSquareClick={handleSquareClick}
            size={460}
          />
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
          </div>
        </div>
      </section>

      {/* Starter Kit Modal */}
      <StarterKitModal isOpen={isStarterKitOpen} onClose={() => setIsStarterKitOpen(false)} />
    </div>
  );
}
