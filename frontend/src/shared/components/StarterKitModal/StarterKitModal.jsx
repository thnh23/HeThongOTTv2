import React, { useState } from 'react';
import { Download, Copy, Check, X, FileCode, FileText, FolderArchive, Sparkles } from 'lucide-react';
import JSZip from 'jszip';
import { useToast } from '@/shared/context/ToastContext.jsx';
import './StarterKitModal.css';

const BOT_TEMPLATE = `"""
OTTv2 Starter Bot Template
Đấu Trường Trí Tuệ Nhân Tạo — Khoa CNTT - UET 2026
"""

import random
from typing import Tuple
from app.services.engine.board import BoardState, square_to_str
from app.services.engine.rules import get_legal_moves

def choose_move(state: BoardState) -> Tuple[str, str]:
    """
    Quyết định nước đi tiếp theo của Bot.
    
    Args:
        state: Trạng thái bàn cờ BoardState hiện tại
        
    Returns:
        tuple[str, str]: ("e5", "f6") - tọa độ ô đi và ô đến
    """
    legal_moves = get_legal_moves(state)
    if not legal_moves:
        return ("", "")
    
    # Chiến thuật cơ bản: Ưu tiên ăn quân đối phương nếu có thể
    # Bàn cờ 12x12: Kéo (S) ăn Bao (P), Bao (P) ăn Búa (R), Búa (R) ăn Kéo (S)
    capturing_moves = []
    for (fc, fr), (tc, tr) in legal_moves:
        target_piece = state.board[tr][tc]
        if target_piece != '.':
            capturing_moves.append(((fc, fr), (tc, tr)))
            
    if capturing_moves:
        (fc, fr), (tc, tr) = random.choice(capturing_moves)
    else:
        (fc, fr), (tc, tr) = random.choice(legal_moves)
        
    return (square_to_str(fc, fr), square_to_str(tc, tr))
`;

const PROMPTS_TEMPLATE = `# Nhật Ký Prompt Engineering (T08)
**Sinh viên / Nhóm:** [Điền họ và tên - MSSV]
**Bảng đấu:** [Bảng A / B / C]
**Mô hình AI sử dụng:** Claude 3.5 Sonnet / GPT-4o / Gemini 1.5 Pro

---

## 1. Mục Tiêu Chiến Thuật
- Xây dựng hàm lượng giá heuristic cân bằng giữa phòng thủ và săn quân.
- Tối ưu thuật toán minimax kết hợp cắt tỉa Alpha-Beta trong giới hạn thời gian (5s/nước, 120s tổng trận).

## 2. Lịch Sử Các Phiên Prompting

### Phiên 1: Khởi tạo luật và bộ sinh nước đi
- **Prompt:** "Tôi đang tham gia giải đấu cờ OTTv2 (Oẳn Tù Tì 12x12). Hãy viết hàm Python kiểm tra nước đi hợp lệ cho quân Kéo, Búa, Bao..."
- **Phản hồi từ AI:** [Tóm tắt câu trả lời]
- **Điều chỉnh của sinh viên:** Sửa lại logic tọa độ theo chuẩn 0-indexed và xử lý trường hợp ô cấm.

### Phiên 2: Xây dựng hàm lượng giá bàn cờ
- **Prompt:** "Thiết kế hàm evaluate_state(state, my_color) đánh giá ưu thế dựa trên số lượng quân, vị trí kiểm soát trung tâm..."
- **Phản hồi từ AI:** [Tóm tắt câu trả lời]
- **Điều chỉnh của sinh viên:** Thêm trọng số phạt nếu quân Kéo đi vào tầm ngắm của Búa đối phương.
`;

const REPORT_TEMPLATE = `# Báo Cáo Chiến Thuật Bot Cờ OTTv2
**Sinh viên thực hiện:** [Họ và tên - MSSV]
**Lớp môn học:** Lập Trình Mạng (INT3304) - Học kỳ II, 2026

---

## 1. Kiến Trúc & Thuật Toán
- **Thuật toán chính:** [Minimax Alpha-Beta / Heuristic Rule-Based / Monte Carlo Tree Search]
- **Độ sâu tìm kiếm:** [Depth 3 - 4]
- **Chiến lược quản lý thời gian:**
  - Khai cuộc (Nước 1 - 20): 1.5s/nước
  - Trung cuộc (Nước 21 - 80): 3.5s/nước
  - Tàn cuộc: 1.0s/nước

## 2. Hàm Lượng Giá (Heuristic Function)
$$Score = W_1 \\times PieceCount + W_2 \\times Mobility + W_3 \\times PositionalAdvantage$$

## 3. Kết Quả Thử Nghiệm
- Thử nghiệm 20 trận với GreedyBot: Thắng 16, Hòa 2, Thua 2.
- Tỉ lệ thắng trung bình: 80%.
`;

const CHAT_SAMPLE = `User: Hãy hướng dẫn cách viết bot cờ OTTv2 bằng Python.
Assistant: Dưới đây là cấu trúc cơ bản của một bot chơi cờ OTTv2:
1. Nhận trạng thái bàn cờ 12x12.
2. Liệt kê các nước đi hợp lệ.
3. Sử dụng minimax hoặc heuristic để chọn nước tối ưu.
`;

export function StarterKitModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('bot.py');
  const [copied, setCopied] = useState(false);
  const [isDownloadingZip, setIsDownloadingZip] = useState(false);
  const { showToast } = useToast();

  if (!isOpen) return null;

  const getActiveContent = () => {
    switch (activeTab) {
      case 'bot.py':
        return BOT_TEMPLATE;
      case 'PROMPTS.md':
        return PROMPTS_TEMPLATE;
      case 'REPORT.md':
        return REPORT_TEMPLATE;
      default:
        return BOT_TEMPLATE;
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(getActiveContent());
      setCopied(true);
      showToast(`Đã sao chép nội dung ${activeTab} vào bộ nhớ tạm!`, 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Không thể sao chép tự động', 'error');
    }
  };

  const handleDownloadZip = async () => {
    setIsDownloadingZip(true);
    try {
      const zip = new JSZip();
      zip.file('bot.py', BOT_TEMPLATE);
      zip.file('PROMPTS.md', PROMPTS_TEMPLATE);
      zip.file('REPORT.md', REPORT_TEMPLATE);
      
      const chatFolder = zip.folder('chat_history');
      chatFolder.file('session_1_chatgpt.txt', CHAT_SAMPLE);

      zip.file('README.md', `# Gói Mẫu OTTv2 Starter Kit
Đã bao gồm đầy đủ cấu trúc hợp lệ theo tiêu chuẩn T08:
- bot.py (Hàm choose_move)
- PROMPTS.md (Nhật ký Prompt Engineering)
- REPORT.md (Báo cáo chiến thuật)
- chat_history/ (Lịch sử tương tác AI)

Bạn có thể chỉnh sửa code và nén lại thành .zip để nộp trực tiếp trên hệ thống!`);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ottv2_starter_kit.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Đã tải gói Starter Kit (ottv2_starter_kit.zip) thành công!', 'success');
    } catch (err) {
      showToast('Lỗi khi tạo gói ZIP: ' + err.message, 'error');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge">
              <Sparkles size={20} color="var(--cyan-400)" />
            </div>
            <div>
              <h2 id="modal-title" className="modal-title">Bộ Khởi Động Bot (Starter Kit)</h2>
              <p className="modal-subtitle">Gói mẫu chuẩn T08 cho sinh viên UET — Tải về và thi đấu ngay</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Đóng cửa sổ">
            <X size={20} />
          </button>
        </div>

        <div className="modal-banner">
          <div className="banner-text">
            <strong>💡 Gói nộp bài hợp lệ cần gì?</strong>
            <span> File <code>bot.py</code> (hàm <code>choose_move</code>), <code>PROMPTS.md</code>, <code>REPORT.md</code>, và thư mục <code>chat_history/</code>.</span>
          </div>
          <button
            id="btn-download-starter-zip"
            className="btn btn-primary btn-sm"
            onClick={handleDownloadZip}
            disabled={isDownloadingZip}
          >
            <Download size={15} />
            <span>{isDownloadingZip ? 'Đang nén file...' : 'Tải Trọn Gói .ZIP'}</span>
          </button>
        </div>

        <div className="modal-tabs">
          <button
            className={`tab-btn ${activeTab === 'bot.py' ? 'active' : ''}`}
            onClick={() => setActiveTab('bot.py')}
          >
            <FileCode size={16} />
            <span>bot.py</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'PROMPTS.md' ? 'active' : ''}`}
            onClick={() => setActiveTab('PROMPTS.md')}
          >
            <FileText size={16} />
            <span>PROMPTS.md (T08)</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'REPORT.md' ? 'active' : ''}`}
            onClick={() => setActiveTab('REPORT.md')}
          >
            <FileText size={16} />
            <span>REPORT.md</span>
          </button>
        </div>

        <div className="code-preview-wrap">
          <div className="code-toolbar">
            <span className="code-filename">{activeTab}</span>
            <button className="btn btn-outline btn-xs" onClick={handleCopy}>
              {copied ? <Check size={14} color="var(--emerald-400)" /> : <Copy size={14} />}
              <span>{copied ? 'Đã sao chép' : 'Sao chép mã'}</span>
            </button>
          </div>
          <pre className="code-block">
            <code>{getActiveContent()}</code>
          </pre>
        </div>

        <div className="modal-footer">
          <div className="checklist-hints">
            <span className="hint-pill">✓ Chuẩn PEP-8</span>
            <span className="hint-pill">✓ Quét an ninh API key (T09)</span>
            <span className="hint-pill">✓ Tương thích Sandbox</span>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
