import React from 'react';
import { BookOpen, Award, ShieldAlert, Cpu, CheckCircle } from 'lucide-react';
import './RulesPage.css';

export function RulesPage() {
  return (
    <div className="rules-page animate-fade-in">
      <div className="rules-header">
        <h1 className="rules-title">
          Quy Chuẩn Luật Chơi <span className="gradient-text">OTTv2</span>
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>
          Đặc tả chính thức về bàn cờ, cơ chế di chuyển, luật ăn quân và chuẩn giao thức bot.
        </p>
      </div>

      <div className="rules-grid">
        <div className="glass-card rule-box">
          <h3><BookOpen size={20} /> 1. Bàn cờ & Quân cờ</h3>
          <p>
            Bàn cờ có kích thước <strong>9 × 9 ô vuông</strong> (cột từ <code>a</code> đến <code>i</code>, hàng từ <code>1</code> đến <code>9</code>).
          </p>
          <p>Mỗi đấu thủ điều khiển 18 quân cờ thuộc 3 loại:</p>
          <ul style={{ paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
            <li>👊 <strong>Búa (Rock - R):</strong> 6 quân</li>
            <li>✂️ <strong>Kéo (Scissors - S):</strong> 6 quân</li>
            <li>✋ <strong>Bao (Paper - P):</strong> 6 quân</li>
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
