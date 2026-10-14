"""
OTTv2 Rules Module
==================
Triển khai toàn bộ luật chơi OTTv2:
  - Tính nước đi hợp lệ
  - Thực hiện nước đi
  - Phát hiện điều kiện kết thúc ván (W1, W2, D1, D2)

Luật tóm tắt:
  - Bàn 9×9, di chuyển 1 ô theo 8 hướng
  - Cùng loại: không ăn nhau (chặn đường)
  - Khác loại: kẻ mạnh hơn (theo R-S-P) ăn kẻ yếu; kẻ yếu không vào được ô kẻ mạnh
  - Thắng W1: ăn hết sạch 1 loại quân của đối phương
  - Thắng W2: đưa quân vào ô đích (i9 cho Trắng, a1 cho Đen)
  - Hòa D2: lặp thế 3 lần hoặc quá 200 nước
  - Thua D1: hết nước hợp lệ (cấu hình được)
"""

from __future__ import annotations
from enum import Enum
from typing import Optional
from .board import (
    BoardState, Piece, BEATS, DIRECTIONS,
    WHITE_GOAL, BLACK_GOAL,
    is_in_bounds, parse_square, square_to_str,
    PIECE_TYPES,
)


# ────────────────────────────────────────────────
# Game result
# ────────────────────────────────────────────────

class EndCode(str, Enum):
    W1 = "W1"   # Mất sạch một loại quân
    W2 = "W2"   # Quân vào ô đích
    D1 = "D1"   # Hết nước hợp lệ
    D2 = "D2"   # Lặp thế / quá 200 nước


class GameResult:
    """Kết quả ván đấu."""
    def __init__(
        self,
        winner: Optional[str],   # 'W', 'B', hoặc None (hòa)
        end_code: EndCode,
        description: str = "",
    ):
        self.winner = winner
        self.end_code = end_code
        self.description = description

    def is_draw(self) -> bool:
        return self.winner is None

    def __repr__(self):
        return (
            f"GameResult(winner={self.winner!r}, "
            f"end_code={self.end_code}, desc={self.description!r})"
        )


# ────────────────────────────────────────────────
# Move = ((from_col, from_row), (to_col, to_row))
# ────────────────────────────────────────────────

Move = tuple[tuple[int, int], tuple[int, int]]


def parse_move(from_sq: str, to_sq: str) -> Move:
    """Chuyển ký hiệu ("e5", "f6") → Move."""
    return parse_square(from_sq), parse_square(to_sq)


# ────────────────────────────────────────────────
# Capture logic
# ────────────────────────────────────────────────

def can_capture(attacker_type: str, defender_type: str) -> bool:
    """
    Trả về True nếu attacker có thể ăn defender.

    - Cùng loại       → False (chặn đường)
    - Attacker mạnh hơn → True  (ăn quân)
    - Defender mạnh hơn → False (không thể vào)
    """
    if attacker_type == defender_type:
        return False
    return BEATS[attacker_type] == defender_type


def is_square_accessible(
    attacker: Piece,
    target_square: tuple[int, int],
    state: BoardState,
) -> bool:
    """
    Kiểm tra quân `attacker` có thể di chuyển đến `target_square` không.

    - Ô trống: luôn được
    - Ô có quân địch: chỉ được nếu attacker ăn được defender
    - Ô có quân mình: không được
    """
    occupant = state.board.get(target_square)
    if occupant is None:
        return True
    if occupant.player == attacker.player:
        return False
    # Quân địch
    return can_capture(attacker.piece_type, occupant.piece_type)


# ────────────────────────────────────────────────
# Legal moves
# ────────────────────────────────────────────────

def get_legal_moves(state: BoardState) -> list[Move]:
    """
    Trả về danh sách tất cả nước đi hợp lệ của current_player.
    """
    moves: list[Move] = []
    player = state.current_player

    for (col, row), piece in state.board.items():
        if piece.player != player:
            continue
        for dx, dy in DIRECTIONS:
            nc, nr = col + dx, row + dy
            if not is_in_bounds(nc, nr):
                continue
            if is_square_accessible(piece, (nc, nr), state):
                moves.append(((col, row), (nc, nr)))

    return moves


def get_legal_moves_from(state: BoardState, from_sq: str) -> list[str]:
    """
    Trả về danh sách ô đích hợp lệ từ ô `from_sq` (ký hiệu).
    Dùng cho demo bàn cờ tương tác.
    """
    from_pos = parse_square(from_sq)
    piece = state.board.get(from_pos)
    if piece is None or piece.player != state.current_player:
        return []

    result = []
    for dx, dy in DIRECTIONS:
        nc, nr = from_pos[0] + dx, from_pos[1] + dy
        if not is_in_bounds(nc, nr):
            continue
        if is_square_accessible(piece, (nc, nr), state):
            result.append(square_to_str(nc, nr))
    return result


# ────────────────────────────────────────────────
# Apply move
# ────────────────────────────────────────────────

def apply_move(state: BoardState, move: Move) -> BoardState:
    """
    Thực hiện nước đi và trả về trạng thái mới.
    KHÔNG kiểm tra tính hợp lệ — gọi is_legal_move() trước.

    Side effect: cập nhật position_history và move_count.
    """
    (fc, fr), (tc, tr) = move
    new_state = state.copy()

    piece = new_state.board.pop((fc, fr))
    new_state.board[(tc, tr)] = piece      # ghi đè (ăn quân nếu có)

    # Đổi lượt
    new_state.current_player = 'B' if state.current_player == 'W' else 'W'
    new_state.move_count += 1
    new_state.last_move = move

    # Cập nhật lịch sử thế cờ
    snap = new_state.to_snapshot()
    new_state.position_history.append(snap)

    return new_state


def is_legal_move(state: BoardState, move: Move) -> bool:
    """Kiểm tra move có nằm trong danh sách nước đi hợp lệ không."""
    return move in get_legal_moves(state)


# ────────────────────────────────────────────────
# Win / draw detection
# ────────────────────────────────────────────────

def check_game_over(state: BoardState) -> Optional[GameResult]:
    """
    Kiểm tra ván đấu đã kết thúc chưa.
    Gọi sau mỗi nước đi (state đã được cập nhật).

    Thứ tự kiểm tra:
      1. W2 — quân mới vào ô đích
      2. W1 — đối thủ mất sạch 1 loại quân
      3. D2 — lặp thế 3 lần hoặc > 200 nước
      4. D1 — current_player hết nước đi

    Trả về None nếu ván chưa kết thúc.
    """
    # ── W2: Kiểm tra ô đích ──────────────────────
    if state.last_move is not None:
        _, to_pos = state.last_move
        mover = 'W' if state.current_player == 'B' else 'B'   # người vừa đi
        if mover == 'W' and to_pos == WHITE_GOAL:
            return GameResult('W', EndCode.W2, f"Trắng đưa quân vào ô i9")
        if mover == 'B' and to_pos == BLACK_GOAL:
            return GameResult('B', EndCode.W2, f"Đen đưa quân vào ô a1")

    # ── W1: Kiểm tra mất sạch một loại quân ─────
    for player in ('W', 'B'):
        opponent = 'B' if player == 'W' else 'W'
        counts = state.get_piece_counts(opponent)
        for piece_type, cnt in counts.items():
            if cnt == 0:
                piece_names = {'R': 'Búa', 'S': 'Kéo', 'P': 'Bao'}
                return GameResult(
                    player, EndCode.W1,
                    f"{player} thắng: {piece_names[piece_type]} của {opponent} bị ăn hết"
                )

    # ── D2: Lặp thế hoặc quá 200 nước ───────────
    if state.move_count > 200:
        return GameResult(None, EndCode.D2, "Quá 200 nước — hòa")

    snap = state.to_snapshot()
    if state.position_history.count(snap) >= 3:
        return GameResult(None, EndCode.D2, "Lặp thế 3 lần — hòa")

    # ── D1: Hết nước hợp lệ ──────────────────────
    if len(get_legal_moves(state)) == 0:
        loser = state.current_player
        winner = 'B' if loser == 'W' else 'W'
        return GameResult(winner, EndCode.D1, f"{loser} hết nước đi")

    return None   # Ván chưa kết thúc


# ────────────────────────────────────────────────
# Convenience: validate + apply
# ────────────────────────────────────────────────

class InvalidMoveError(Exception):
    """Nước đi không hợp lệ."""
    pass


def step(state: BoardState, from_sq: str, to_sq: str) -> tuple[BoardState, Optional[GameResult]]:
    """
    API chính để thực hiện một nước đi.

    Args:
        state:   Trạng thái hiện tại
        from_sq: Ô xuất phát  (ví dụ "e5")
        to_sq:   Ô đến        (ví dụ "f6")

    Returns:
        (new_state, result)
        result = None nếu ván chưa kết thúc

    Raises:
        InvalidMoveError nếu nước đi không hợp lệ
    """
    move = parse_move(from_sq, to_sq)

    if not is_legal_move(state, move):
        piece = state.board.get(move[0])
        raise InvalidMoveError(
            f"Nước đi không hợp lệ: {from_sq}→{to_sq} "
            f"(quân tại {from_sq}: {piece})"
        )

    new_state = apply_move(state, move)
    result = check_game_over(new_state)
    return new_state, result
