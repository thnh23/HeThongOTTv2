import React, { useState } from 'react';
import { Download, Copy, Check, X, FileCode, FileText, FolderArchive, Sparkles, Terminal } from 'lucide-react';
import JSZip from 'jszip';
import { useToast } from '@/shared/context/ToastContext.jsx';
import './StarterKitModal.css';

const BOT_TEMPLATE = `"""
OTTv2 Starter Bot Template
Đấu Trường Trí Tuệ Nhân Tạo — Khoa CNTT - UET 2026
Bàn cờ 9x9: Kéo (S) ăn Bao (P), Bao (P) ăn Búa (R), Búa (R) ăn Kéo (S)
"""

import random
from typing import Tuple

COLS = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']
ROWS = ['1', '2', '3', '4', '5', '6', '7', '8', '9']

def choose_move(state) -> Tuple[str, str]:
    """
    Quyết định nước đi tiếp theo của Bot.
    
    Args:
        state: Trạng thái bàn cờ BoardState hiện tại:
          - state.board: dict[(col, row) -> Piece] hoặc 2D list
          - state.current_player: 'W' hoặc 'B'
          - state.move_count: số nước đã đi
          
    Returns:
        tuple[str, str]: ("b2", "b3") - Tọa độ ô xuất phát và ô đích (chữ thường)
    """
    # Lấy danh sách các nước đi hợp lệ
    # Bạn có thể tự sinh nước đi hoặc dùng rules engine có sẵn
    # Dưới đây là logic mẫu: Ưu tiên ăn quân đối phương nếu nằm trong tầm ngắm
    legal_moves = []
    
    # Duyệt tìm các quân cờ của phe mình
    # và tìm nước đi 1 ô theo 8 hướng
    # Gợi ý: Hãy xây dựng hàm minimax với alpha-beta pruning để bứt phá Top 32!
    
    # Nước đi mặc định mẫu
    return ("b2", "b3")
`;

const PROMPTS_TEMPLATE = `# Nhật Ký Prompt Engineering (T08)
**Sinh viên / Nhóm:** [Điền họ và tên - MSSV]
**Giải đấu:** Giải Đấu Cờ Thuật Toán OTTv2 (13 Vòng Swiss & Top 32)
**Mô hình AI sử dụng:** Claude 3.5 Sonnet / GPT-4o / Gemini 2.5 Pro

---

## 1. Mục Tiêu Chiến Thuật
- Xây dựng hàm lượng giá heuristic cân bằng giữa phòng thủ và săn quân trên bàn cờ 9x9.
- Kiểm soát các ô trung tâm và bảo vệ ô góc đích (i9 đối với Trắng, a1 đối với Đen).
- Tối ưu thuật toán Minimax kết hợp cắt tỉa Alpha-Beta trong giới hạn thời gian (2.0s / nước đi).

## 2. Lịch Sử Các Phiên Prompting

### Phiên 1: Khởi tạo luật và bộ sinh nước đi 9x9
- **Prompt:** "Tôi đang tham gia giải đấu cờ OTTv2 (Oẳn Tù Tì 9x9 bàn cờ). Hãy viết hàm Python kiểm tra nước đi hợp lệ cho quân Kéo, Búa, Bao..."
- **Phản hồi từ AI:** [Tóm tắt câu trả lời]
- **Điều chỉnh của sinh viên:** Sửa lại logic tọa độ theo chuẩn 0-indexed và xử lý trường hợp cùng loại chỉ chặn đường chứ không ăn nhau.

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
  - Khai cuộc (Nước 1 - 20): 0.5s/nước
  - Trung cuộc (Nước 21 - 80): 1.5s/nước
  - Tàn cuộc: 0.5s/nước

## 2. Hàm Lượng Giá (Heuristic Function)
$$Score = W_1 \\times PieceCount + W_2 \\times Mobility + W_3 \\times GoalDistance$$

## 3. Kết Quả Thử Nghiệm
- Thử nghiệm 20 trận với GreedyBot trong Sandbox: Thắng 16, Hòa 2, Thua 2.
- Tỉ lệ thắng trung bình: 80%.
`;

const CHAT_SAMPLE = `User: Hãy hướng dẫn cách viết bot cờ OTTv2 (9x9) bằng Python.
Assistant: Dưới đây là cấu trúc cơ bản của một bot chơi cờ OTTv2:
1. Nhận trạng thái bàn cờ 9x9 (Hàng 1-9, Cột a-i).
2. Liệt kê các nước đi hợp lệ theo 8 hướng.
3. Áp dụng quy tắc Oẳn Tù Tì: Búa đập Kéo, Kéo cắt Bao, Bao bọc Búa.
4. Sử dụng minimax hoặc heuristic để chọn nước tối ưu.
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

      zip.file('README.md', `# Gói Mẫu OTTv2 Starter Kit (Bàn Cờ 9×9)
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
              <p className="modal-subtitle">Gói mẫu chuẩn T08 cho sinh viên UET bàn cờ 9×9 — Tải về và thi đấu ngay</p>
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
            <span className="hint-pill">✓ Bàn cờ 9×9 OTTv2</span>
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
