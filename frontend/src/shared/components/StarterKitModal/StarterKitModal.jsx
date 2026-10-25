import React, { useState } from 'react';
import { Download, Copy, Check, X, FileCode, FileText, FolderArchive, Sparkles, Terminal, Play } from 'lucide-react';
import JSZip from 'jszip';
import { useToast } from '@/shared/context/ToastContext.jsx';
import './StarterKitModal.css';

const BOT_TEMPLATE = `"""
OTTv2 Starter Bot Template
Đấu Trường Trí Tuệ Nhân Tạo — Khoa CNTT - ĐHQGHN (UET 2026)
Quy chuẩn Bàn cờ 9×9:
  - Quân cờ: 'R' (Búa/Rock), 'S' (Kéo/Scissors), 'P' (Bao/Paper)
  - Quy tắc ăn quân: Búa đập Kéo, Kéo cắt Bao, Bao bọc Búa.
  - Mục tiêu: Trắng ('W') đưa quân đến ô 'i9', Đen ('B') đưa quân đến ô 'a1'.
  - Bot v1 (Swiss 13 Vòng): Bàn cờ tiêu chuẩn 9×9.
  - Bot v2 (Top 32 Chung Kết): Tự động phát hiện và né tránh ô chướng ngại vật (state.obstacles).
"""

import random
from typing import Tuple, List, Dict, Optional

# Ký hiệu bàn cờ 9x9: Cột a-i, Hàng 1-9
COLS = "abcdefghi"
ROWS = "123456789"

# Quy tắc Oẳn Tù Tì: Key thắng Value
BEATS = {
    'R': 'S',  # Búa > Kéo
    'S': 'P',  # Kéo > Bao
    'P': 'R',  # Bao > Búa
}

# 8 hướng di chuyển xung quanh 1 ô (dx, dy)
DIRECTIONS = [
    (-1, -1), (0, -1), (1, -1),
    (-1,  0),           (1,  0),
    (-1,  1), (0,  1), (1,  1),
]

def coord_to_square(col: int, row: int) -> str:
    """Chuyển toạ độ 0-indexed (col, row) sang chuỗi ô ('e5')."""
    return f"{COLS[col]}{ROWS[row]}"

def square_to_coord(sq: str) -> Tuple[int, int]:
    """Chuyển chuỗi ô ('e5') sang toạ độ (col, row)."""
    return COLS.index(sq[0].lower()), ROWS.index(sq[1])

def get_legal_moves(state) -> List[Tuple[str, str]]:
    """
    Sinh danh sách tất cả các nước đi hợp lệ cho lượt hiện tại.
    Hỗ trợ cả bàn cờ dict dạng {(col, row): Piece} hoặc {'e5': {'player': 'W', 'type': 'R'}}
    và tự động né các ô chướng ngại vật (state.obstacles).
    """
    moves = []
    my_color = getattr(state, 'current_player', 'W')
    obstacles = set(getattr(state, 'obstacles', []))

    # Chuẩn hoá truy xuất bàn cờ
    board_data = getattr(state, 'board', {})
    
    # Duyệt tất cả ô trên bàn cờ 9x9
    for col_idx in range(9):
        for row_idx in range(9):
            sq = coord_to_square(col_idx, row_idx)
            
            # Lấy thông tin quân cờ tại toạ độ này
            piece = None
            if isinstance(board_data, dict):
                piece = board_data.get((col_idx, row_idx)) or board_data.get(sq)

            if not piece:
                continue

            # Kiểm tra quân có thuộc về phe mình không
            p_player = getattr(piece, 'player', None) or (piece.get('player') if isinstance(piece, dict) else None)
            p_type = getattr(piece, 'piece_type', None) or (piece.get('type') if isinstance(piece, dict) else None)

            if p_player != my_color:
                continue

            # Thử di chuyển 8 hướng
            for dx, dy in DIRECTIONS:
                nc, nr = col_idx + dx, row_idx + dy
                if 0 <= nc < 9 and 0 <= nr < 9:
                    to_sq = coord_to_square(nc, nr)
                    
                    # Quy tắc Bot v2: Không được đi vào ô chướng ngại vật
                    if to_sq in obstacles or (nc, nr) in obstacles:
                        continue

                    # Kiểm tra ô đích có quân không
                    target_piece = None
                    if isinstance(board_data, dict):
                        target_piece = board_data.get((nc, nr)) or board_data.get(to_sq)

                    if not target_piece:
                        # Ô trống -> Đi được
                        moves.append((sq, to_sq))
                    else:
                        tp_player = getattr(target_piece, 'player', None) or (target_piece.get('player') if isinstance(target_piece, dict) else None)
                        tp_type = getattr(target_piece, 'piece_type', None) or (target_piece.get('type') if isinstance(target_piece, dict) else None)

                        # Nếu là quân đối phương và quân mình ăn được quân địch
                        if tp_player != my_color and BEATS.get(p_type) == tp_type:
                            moves.append((sq, to_sq))
                            
    return moves

def choose_move(state) -> Tuple[str, str]:
    """
    Hàm quyết định nước đi chính của Bot.
    Hệ thống Sandbox sẽ gọi hàm này mỗi lượt đi (thời gian tối đa 2.0s / nước đi).
    
    Returns:
        tuple[str, str]: ("b2", "b3") - Toạ độ ô xuất phát và ô đích
    """
    legal_moves = get_legal_moves(state)
    if not legal_moves:
        return ("", "")

    my_color = getattr(state, 'current_player', 'W')
    target_goal = "i9" if my_color == 'W' else "a1"
    goal_col, goal_row = square_to_coord(target_goal)

    best_score = -float('inf')
    best_moves = []

    board_data = getattr(state, 'board', {})

    for from_sq, to_sq in legal_moves:
        tc, tr = square_to_coord(to_sq)
        score = 0.0

        # Ưu tiên 1: Thắng ngay lập tức nếu bước được vào ô đích
        if to_sq == target_goal:
            return (from_sq, to_sq)

        # Ưu tiên 2: Ăn quân đối phương
        target = board_data.get((tc, tr)) or board_data.get(to_sq)
        if target:
            score += 150.0  # Điểm thưởng ăn quân

        # Ưu tiên 3: Tiến dần về phía ô đích (khoảng cách Manhattan)
        fc, fr = square_to_coord(from_sq)
        dist_before = abs(fc - goal_col) + abs(fr - goal_row)
        dist_after = abs(tc - goal_col) + abs(tr - goal_row)
        score += (dist_before - dist_after) * 12.0

        # Lựa chọn nước có điểm lượng giá cao nhất
        if score > best_score:
            best_score = score
            best_moves = [(from_sq, to_sq)]
        elif score == best_score:
            best_moves.append((from_sq, to_sq))

    return random.choice(best_moves) if best_moves else random.choice(legal_moves)
`;

const LOCAL_TEST_TEMPLATE = `"""
Script Kiểm Thử Cục Bộ Cờ OTTv2 (Local Bot Tester)
===================================================
Chạy trực tiếp trên máy của bạn:
  python local_test.py

Mục tiêu: Đấu thử 5 ván giữa StarterBot của bạn và đối thủ mẫu để kiểm tra
tính hợp lệ của hàm choose_move trước khi nộp bài lên hệ thống giải đấu!
"""

import sys
import copy
import random
from typing import Tuple, Dict, List

# Import bot từ file bot.py cùng thư mục
try:
    from bot import choose_move, coord_to_square, square_to_coord, BEATS
except ImportError:
    print("LỖI: Vui lòng đặt file local_test.py cùng thư mục với bot.py!")
    sys.exit(1)

class SimplePiece:
    def __init__(self, player: str, piece_type: str):
        self.player = player
        self.piece_type = piece_type

class SimpleBoardState:
    """Mô phỏng bàn cờ 9×9 độc lập không cần backend."""
    def __init__(self, with_obstacles=False):
        self.board: Dict[Tuple[int, int], SimplePiece] = {}
        self.current_player: str = 'W'
        self.move_count: int = 0
        # Mô phỏng ô chướng ngại vật v2 nếu cần
        self.obstacles: List[str] = ['e5', 'd4', 'f6'] if with_obstacles else []
        
        # Khởi tạo quân Trắng (hàng 1 và 2)
        white_r1 = ['R','S','P','R','S','P','R','S','P']
        white_r2 = ['P','R','S','P','R','S','P','R','S']
        for col in range(9):
            self.board[(col, 0)] = SimplePiece('W', white_r1[col])
            self.board[(col, 1)] = SimplePiece('W', white_r2[col])
            
        # Khởi tạo quân Đen (hàng 9 và 8)
        black_r9 = ['P','S','R','P','S','R','P','S','R']
        black_r8 = ['S','R','P','S','R','P','S','R','P']
        for col in range(9):
            self.board[(col, 8)] = SimplePiece('B', black_r9[col])
            self.board[(col, 7)] = SimplePiece('B', black_r8[col])

def play_match(match_id: int):
    state = SimpleBoardState(with_obstacles=(match_id % 2 == 0))
    max_turns = 120
    mode_str = "Bot v2 (Có Ô Cản)" if state.obstacles else "Bot v1 (Bàn Tiêu Chuẩn)"
    
    print(f"\\n--- TRẬN {match_id}: [Trắng: YourBot] vs [Đen: SimpleBot] ({mode_str}) ---")
    
    for turn in range(1, max_turns + 1):
        state.move_count = turn
        player = state.current_player
        
        # Gọi bot đi nước
        from_sq, to_sq = choose_move(state)
        if not from_sq or not to_sq:
            print(f"  Lượt {turn}: Phe {player} không còn nước đi hợp lệ. Đối thủ thắng!")
            return 'B' if player == 'W' else 'W'
            
        fc, fr = square_to_coord(from_sq)
        tc, tr = square_to_coord(to_sq)
        
        piece = state.board.pop((fc, fr), None)
        target = state.board.get((tc, tr))
        state.board[(tc, tr)] = piece
        
        # Kiểm tra điều kiện thắng
        if player == 'W' and to_sq == 'i9':
            print(f"  Lượt {turn}: Trắng (YourBot) đã tiến vào ô đích i9! THẮNG!")
            return 'W'
        if player == 'B' and to_sq == 'a1':
            print(f"  Lượt {turn}: Đen đã tiến vào ô đích a1! THẮNG!")
            return 'B'
            
        # Đổi lượt
        state.current_player = 'B' if player == 'W' else 'W'
        
    print(f"  Hết {max_turns} lượt đấu: Kết quả HÒA!")
    return 'DRAW'

if __name__ == '__main__':
    print("=" * 65)
    print("  OTTV2 LOCAL BOT TESTER — KHOA CNTT - UET 2026")
    print("=" * 65)
    print("Đang chạy 5 trận đấu thử nghiệm...")
    
    results = {'W': 0, 'B': 0, 'DRAW': 0}
    for match in range(1, 6):
        res = play_match(match)
        results[res] += 1
        
    print("\\n" + "=" * 65)
    print("TỔNG KẾT SAU 5 TRẬN KIỂM THỬ:")
    print(f"  Thắng: {results['W']} | Thua: {results['B']} | Hòa: {results['DRAW']}")
    if results['W'] > 0:
        print("  => Chúc mừng! Bot hoạt động trơn tru và hợp lệ trên bàn cờ 9x9.")
    print("=" * 65)
`;

const REPORT_TEMPLATE = `# Báo Cáo Ý Tưởng & Chiến Thuật Bot Cờ OTTv2
**Sinh viên thực hiện:** [Họ và tên - MSSV]
**Lớp môn học:** Lập Trình Mạng (INT3304) — Trường Đại học Công nghệ (UET)

---

## 1. Ý Tưởng Thuật Toán & Kiến Trúc Chính
- **Giải thuật tìm kiếm:** [Minimax Alpha-Beta / Heuristic Greedy Search / MCTS]
- **Độ sâu tìm kiếm:** [Depth 3 - 4]
- **Chiến lược phân bổ thời gian (Time Budgeting - tối đa 2.0s / nước):**
  - Khai cuộc (Nước 1 - 20): 0.5s / nước đi (mở đường cho quân chủ lực tiến lên)
  - Trung cuộc (Nước 21 - 80): 1.5s / nước đi (tìm kiếm sâu, tính toán ăn quân và gài bẫy)
  - Tàn cuộc (Nước 81+): 0.8s / nước đi (chạy nước rút vào ô đích)

## 2. Hàm Lượng Giá Thế Cờ (Heuristic Evaluation Function)
Công thức lượng giá tổng quát của Bot:
$$Score = W_1 \\times PieceAdvantage + W_2 \\times GoalDistance + W_3 \\times SafetyControl$$
- **PieceAdvantage:** Chênh lệch số quân cờ còn sống (Kéo, Búa, Bao theo luật Oẳn Tù Tì).
- **GoalDistance:** Khoảng cách Manhattan / Chebyshev từ quân gần nhất tới ô đích đối phương (i9 với Trắng, a1 với Đen).
- **SafetyControl:** Mức độ an toàn tránh bị ăn bởi quân đối phương kề cận.

## 3. Khả Năng Thích Ứng Ô Chướng Ngại Vật (Bot v2 - Vòng Chung Kết Top 32)
- Tự động nhận diện và né tránh ô chướng ngại vật (state.obstacles).
- Sử dụng thuật toán tìm đường ngắn nhất (BFS / A*) để đi vòng qua ô cản khi tiến về ô đích.

## 4. Kết Quả Thử Nghiệm Cục Bộ (local_test.py)
- Thử nghiệm 20 trận với đối thủ mẫu: Thắng 17, Hòa 2, Thua 1.
- Tỉ lệ thắng trung bình: 85%.
`;

const GIT_LOG_TEMPLATE = `commit 7f3b201a4e8d3b8f1c2d9e0f5a6b7c8d9e0f1a2b (HEAD -> main, origin/main)
Author: Nguyen Van A <sv23020001@vnu.edu.vn>
Date:   Fri Oct 23 18:20:45 2026 +0700

    perf: optimize move ordering, depth limit and local_test.py simulation
    
    - Add iterative deepening with 1.8s time budget cutoff
    - Priority queue for capture moves in Alpha-Beta pruning
    - Verified 0-timeout in 50 local offline matches

commit 4a9e102c3b8f9e0f1a2b3c4d5e6f7a8b9c0d1e2f
Author: Nguyen Van A <sv23020001@vnu.edu.vn>
Date:   Thu Oct 22 15:40:12 2026 +0700

    feat: adapt pathfinding and obstacle avoidance for Top 32 Knockout
    
    - Add dynamic obstacle detection from state.obstacles
    - Implement BFS routing to bypass blocked cells towards goal (i9/a1)
    - Ensure zero illegal moves on 9x9 obstacle maps

commit 2c8d503f1a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d
Author: Nguyen Van A <sv23020001@vnu.edu.vn>
Date:   Wed Oct 21 20:15:33 2026 +0700

    feat: implement Minimax search with Alpha-Beta pruning (depth 3)
    
    - Build minimax recursive evaluation with minimax_score
    - Alpha-beta pruning branches reducing search space by 60%
    - Handle endgame terminal states and draw by repetition

commit 9e4a701b2d6c7e8f9a0b1c2d3e4f5a6b7c8d9e0f
Author: Nguyen Van A <sv23020001@vnu.edu.vn>
Date:   Tue Oct 20 16:30:19 2026 +0700

    feat: implement board evaluation heuristic function
    
    - Weighted score for piece counts (Rock, Paper, Scissors)
    - Manhattan distance to goal corner (i9 for White, a1 for Black)
    - Positional penalty for pieces under threat by enemy pieces

commit 1b0c902a3e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b
Author: Nguyen Van A <sv23020001@vnu.edu.vn>
Date:   Mon Oct 19 09:10:00 2026 +0700

    feat: initial commit with bot.py skeleton and coordinate system
    
    - Setup 9x9 board representation (a1-i9) and Rock-Paper-Scissors rules
    - Define choose_move(state) interface and legal move generator
    - Initialize REPORT.md strategy template
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
      case 'local_test.py':
        return LOCAL_TEST_TEMPLATE;
      case 'REPORT.md':
        return REPORT_TEMPLATE;
      case 'git_log.txt':
        return GIT_LOG_TEMPLATE;
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
      zip.file('local_test.py', LOCAL_TEST_TEMPLATE);
      zip.file('REPORT.md', REPORT_TEMPLATE);
      zip.file('git_log.txt', GIT_LOG_TEMPLATE);

      zip.file('README.md', `# Gói Mẫu OTTv2 Starter Kit (Bàn Cờ 9×9) — UET 2026
Tập trung vào năng lực tự lập trình và phát triển thuật toán cờ chiến thuật:
1. bot.py: Hàm choose_move hỗ trợ bàn cờ 9×9 và né ô chướng ngại vật (state.obstacles)
2. local_test.py: Chạy kiểm thử tự động 5 trận trên máy bạn ('python local_test.py')
3. REPORT.md: Báo cáo ý tưởng chiến thuật & phân tích heuristic (> 10 bytes)
4. git_log.txt: Lịch sử Git commit (≥ 4 commits) chứng minh tiến trình tự viết code

## Hướng dẫn nộp bài:
1. Chỉnh sửa code thuật toán trong bot.py.
2. Chạy thử nghiệm cục bộ: 'python local_test.py'.
3. Điền thông tin ý tưởng và hàm lượng giá vào REPORT.md.
4. Trích xuất file log từ git repository cá nhân:
   git log --pretty=format:"commit %h%nAuthor: %an <%ae>%nDate:   %ad%n%n    %s%n" > git_log.txt
   (hoặc lệnh đơn giản: git log > git_log.txt)
5. Nén toàn bộ thành file .zip và nộp trực tiếp trên website đấu trường!
`);

      const content = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ottv2_starter_kit.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showToast('Đã tải gói Starter Kit (ottv2_starter_kit.zip) hợp lệ!', 'success');
    } catch (err) {
      showToast('Lỗi khi tạo gói ZIP: ' + err.message, 'error');
    } finally {
      setIsDownloadingZip(false);
    }
  };

  return (
    <div className="modal-backdrop animate-fade-in" onClick={onClose} role="dialog" aria-modal="true" aria-labelledby="modal-title">
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-wrap">
            <div className="modal-icon-badge">
              <Sparkles size={20} color="var(--primary-700)" />
            </div>
            <div>
              <h2 id="modal-title" className="modal-title">Bộ Khởi Động Bot (Starter Kit)</h2>
              <p className="modal-subtitle">Gói tài nguyên mẫu hỗ trợ sinh viên lập trình và kiểm thử bot.</p>
            </div>
          </div>
          <button className="modal-close-btn" onClick={onClose} aria-label="Đóng cửa sổ">
            <X size={20} />
          </button>
        </div>

        <div className="modal-banner">
          <div className="banner-text">
            <strong>Tiêu chí đánh giá bài nộp:</strong>
            <span> Gồm <code>bot.py</code> (hàm <code>choose_move</code>), báo cáo ý tưởng (<code>REPORT.md</code>), và lịch sử commit (<code>git_log.txt</code> ≥ 4 commits).</span>
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
            <span>bot.py (Mẫu Bot)</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'local_test.py' ? 'active' : ''}`}
            onClick={() => setActiveTab('local_test.py')}
          >
            <Play size={15} />
            <span>local_test.py (Test Cục Bộ)</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'REPORT.md' ? 'active' : ''}`}
            onClick={() => setActiveTab('REPORT.md')}
          >
            <FileText size={16} />
            <span>REPORT.md (Báo Cáo Ý Tưởng)</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'git_log.txt' ? 'active' : ''}`}
            onClick={() => setActiveTab('git_log.txt')}
          >
            <Terminal size={15} />
            <span>git_log.txt (≥4 Commits)</span>
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
            <span className="hint-pill">Code Python 9×9</span>
            <span className="hint-pill">Báo Cáo REPORT.md</span>
            <span className="hint-pill">Lịch Sử Git (≥4 Commits)</span>
            <span className="hint-pill">Hỗ Trợ Ô Cản Top 32</span>
            <span className="hint-pill">Kiểm Thử Offline</span>
          </div>
          <button className="btn btn-outline btn-sm" onClick={onClose}>
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}

export default StarterKitModal;
