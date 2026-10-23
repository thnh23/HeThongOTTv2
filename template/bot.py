"""
OTTv2 Bot — Mã Nguồn Chiến Thuật Cờ Oẳn Tù Tì v2
=================================================
Môn học: Lập Trình Mạng (INT3304) — Khoa CNTT, Trường ĐH Công nghệ (VNU-UET)

QUY ĐỊNH BẮT BUỘC:
  1. Thí sinh triển khai logic tại hàm `choose_move(state)`.
  2. Hàm trả về tuple 2 phần tử (tọa độ ô xuất phát, tọa độ ô đích), ví dụ: ('e2', 'e3').
  3. Thời gian tính toán cho mỗi nước đi tối đa 2.0 giây.
  4. TUYỆT ĐỐI KHÔNG sử dụng thư viện mạng (socket, requests, urllib, http, v.v.).
  5. TUYỆT ĐỐI KHÔNG hard-code API key hoặc thông tin nhạy cảm.
"""

from typing import Tuple, Dict, Any, List


def choose_move(state: Any) -> Tuple[str, str]:
    """
    Quyết định nước đi tiếp theo trên bàn cờ OTTv2 9×9.

    Tham số:
      state: Đối tượng BoardState chứa:
        - current_player: 'W' (quân Trắng) hoặc 'B' (quân Đen)
        - move_count: Số thứ tự nước đi hiện tại (1..200)
        - board: dict tọa độ ô -> Piece (piece_type: 'R'/'P'/'S', player: 'W'/'B')
        - obstacles: set tọa độ ô cản cấm đi vào (ví dụ: {'d4', 'e5', 'f6'})
        - get_legal_moves_for(player): danh sách toàn bộ nước đi hợp lệ ((fc, fr), (tc, tr))

    Trả về:
      Tuple dạng ('e2', 'e3') biểu diễn nước đi từ ô 'e2' tới ô 'e3'.
    """
    # Lấy toàn bộ nước đi hợp lệ cho quân của mình
    legal_moves = state.get_legal_moves_for(state.current_player)
    
    if not legal_moves:
        # Trường hợp không còn nước đi hợp lệ
        return ('a1', 'a1')

    # TODO: Thí sinh cài đặt thuật toán tìm kiếm Minimax, Alpha-Beta, MCTS hoặc Heuristic
    # Gợi ý Heuristic:
    #   1. Ưu tiên ăn quân có giá trị theo luật Oẳn Tù Tì (Kéo ăn Bao, Bao ăn Búa, Búa ăn Kéo).
    #   2. Tránh di chuyển vào ô bị đối thủ đe dọa ăn lại ngay nước sau.
    #   3. Tránh tuyệt đối các ô chướng ngại vật (state.obstacles).
    #   4. Kiểm soát các ô trung tâm (cột d, e, f; hàng 4, 5, 6).

    # Chiến thuật cơ bản mặc định: Chọn nước đi đầu tiên trong danh sách hợp lệ
    (fc, fr), (tc, tr) = legal_moves[0]
    col_names = "abcdefghi"
    from_sq = f"{col_names[fc]}{fr + 1}"
    to_sq = f"{col_names[tc]}{tr + 1}"

    return (from_sq, to_sq)
