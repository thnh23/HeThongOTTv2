"""
OTTv2 Board Module
==================
Quản lý trạng thái bàn cờ 9×9.

Biểu diễn bàn cờ:
  - Toạ độ: (col, row) với col ∈ [0,8], row ∈ [0,8]
  - col 0 = 'a', col 8 = 'i'
  - row 0 = '1', row 8 = '9'
  - Ví dụ: "e5" → (4, 4)

Quân cờ:
  - Player: 'W' (Trắng) hoặc 'B' (Đen)
  - Type:   'R' (Búa), 'S' (Kéo), 'P' (Bao)
  - Piece:  namedtuple(player, piece_type)
"""

from __future__ import annotations
from dataclasses import dataclass, field
from typing import Optional
import copy

# ────────────────────────────────────────────────
# Constants
# ────────────────────────────────────────────────

COLS = "abcdefghi"   # 9 cột
ROWS = "123456789"   # 9 hàng
BOARD_SIZE = 9

PIECE_TYPES = ('R', 'S', 'P')  # Búa, Kéo, Bao
PLAYERS = ('W', 'B')

# Rock-Paper-Scissors: key BEATS value
BEATS: dict[str, str] = {
    'R': 'S',   # Búa > Kéo
    'S': 'P',   # Kéo > Bao
    'P': 'R',   # Bao > Búa
}

# 8 hướng di chuyển (dx, dy)
DIRECTIONS = [
    (-1, -1), (0, -1), (1, -1),
    (-1,  0),           (1,  0),
    (-1,  1), (0,  1), (1,  1),
]

# Ô đích thắng
WHITE_GOAL = (8, 8)   # i9
BLACK_GOAL = (0, 0)   # a1


# ────────────────────────────────────────────────
# Piece
# ────────────────────────────────────────────────

@dataclass(frozen=True)
class Piece:
    player: str      # 'W' | 'B'
    piece_type: str  # 'R' | 'S' | 'P'

    def __post_init__(self):
        assert self.player in PLAYERS, f"Invalid player: {self.player}"
        assert self.piece_type in PIECE_TYPES, f"Invalid type: {self.piece_type}"

    def __repr__(self):
        return f"{self.player}{self.piece_type}"


# ────────────────────────────────────────────────
# Obstacle Set
# ────────────────────────────────────────────────

class ObstacleSet(set):
    """
    Set chứa toạ độ ô chướng ngại vật, hỗ trợ kiểm tra membership
    bằng cả tuple toạ độ (col, row) lẫn chuỗi ký hiệu ô cờ ("e5", "d4").
    """
    def __contains__(self, item: object) -> bool:
        if super().__contains__(item):
            return True
        if isinstance(item, str):
            try:
                c, r = parse_square(item)
                return super().__contains__((c, r))
            except Exception:
                return False
        elif isinstance(item, (tuple, list)) and len(item) == 2:
            try:
                c, r = int(item[0]), int(item[1])
                return super().__contains__((c, r)) or super().__contains__(square_to_str(c, r))
            except Exception:
                return False
        return False



# ────────────────────────────────────────────────
# Board State
# ────────────────────────────────────────────────

@dataclass
class BoardState:
    """
    Trạng thái đầy đủ của ván đấu.

    Attributes:
        board:         dict[(col, row) → Piece]
        current_player: 'W' | 'B'
        move_count:    số nước đã đi
        position_history: list[frozenset] để phát hiện lặp thế
        last_move:     ((from_col, from_row), (to_col, to_row)) | None
        obstacles:     ObstacleSet chứa toạ độ các ô chướng ngại vật cấm đi vào
    """
    board: dict[tuple[int, int], Piece] = field(default_factory=dict)
    current_player: str = 'W'
    move_count: int = 0
    position_history: list[frozenset] = field(default_factory=list)
    last_move: Optional[tuple] = None
    obstacles: ObstacleSet = field(default_factory=ObstacleSet)

    def copy(self) -> BoardState:
        """Trả về bản sao sâu của trạng thái."""
        new = BoardState(
            board=copy.copy(self.board),
            current_player=self.current_player,
            move_count=self.move_count,
            position_history=list(self.position_history),
            last_move=self.last_move,
            obstacles=ObstacleSet(self.obstacles),
        )
        return new

    def to_snapshot(self) -> frozenset:
        """
        Chuyển trạng thái thành frozenset để so sánh lặp thế.
        Bao gồm cả current_player và ô chướng ngại vật.
        """
        items = [(pos, repr(piece)) for pos, piece in self.board.items()]
        items.append(('_turn', self.current_player))
        if self.obstacles:
            items.append(('_obs', tuple(sorted(self.obstacles))))
        return frozenset(items)

    def get_piece_counts(self, player: str) -> dict[str, int]:
        """Đếm số quân theo loại của một bên."""
        counts = {t: 0 for t in PIECE_TYPES}
        for piece in self.board.values():
            if piece.player == player:
                counts[piece.piece_type] += 1
        return counts

    def to_dict(self) -> dict:
        """Chuyển trạng thái bàn cờ sang dict JSON-serializable để phục vụ Replay và API."""
        board_dict = {
            square_to_str(c, r): {"player": piece.player, "type": piece.piece_type}
            for (c, r), piece in self.board.items()
        }
        return {
            "board": board_dict,
            "current_player": self.current_player,
            "move_count": self.move_count,
            "white_pieces": self.get_piece_counts('W'),
            "black_pieces": self.get_piece_counts('B'),
            "obstacles": [square_to_str(c, r) for c, r in sorted(self.obstacles)],
        }

    def get_legal_moves_for(self, player: Optional[str] = None) -> list[tuple[tuple[int, int], tuple[int, int]]]:
        """
        Trả về danh sách các nước đi hợp lệ ((from_col, from_row), (to_col, to_row))
        cho quân của `player` ('W' hoặc 'B'). Nếu player là None, lấy cho current_player.
        """
        from app.services.engine.rules import get_legal_moves
        target_player = player or self.current_player
        old_player = self.current_player
        self.current_player = target_player
        try:
            return get_legal_moves(self)
        finally:
            self.current_player = old_player


# ────────────────────────────────────────────────
# Notation helpers
# ────────────────────────────────────────────────

def parse_square(sq: str) -> tuple[int, int]:
    """
    Chuyển ký hiệu ô ("e5") → (col_idx, row_idx).
    "a1" → (0, 0), "i9" → (8, 8)
    Raises ValueError nếu ký hiệu không hợp lệ.
    """
    if len(sq) != 2:
        raise ValueError(f"Invalid square notation: '{sq}'")
    col_ch = sq[0].lower()
    row_ch = sq[1]
    if col_ch not in COLS:
        raise ValueError(f"Invalid column: '{col_ch}'")
    if row_ch not in ROWS:
        raise ValueError(f"Invalid row: '{row_ch}'")
    return COLS.index(col_ch), ROWS.index(row_ch)


def square_to_str(col: int, row: int) -> str:
    """Chuyển (col_idx, row_idx) → ký hiệu ô ("e5")."""
    return f"{COLS[col]}{ROWS[row]}"


def is_in_bounds(col: int, row: int) -> bool:
    """Kiểm tra toạ độ có nằm trong bàn cờ 9×9."""
    return 0 <= col < BOARD_SIZE and 0 <= row < BOARD_SIZE


# ────────────────────────────────────────────────
# Initial board setup
# ────────────────────────────────────────────────

def create_initial_board(
    obstacles: Optional[any] = None,
) -> BoardState:
    """
    Tạo bàn cờ ban đầu theo rules.json:

    White (Trắng) — hàng 1 và 2 (row_idx 0, 1):
      Row 1 (idx=0): R S P R S P R S P
      Row 2 (idx=1): P R S P R S P R S

    Black (Đen) — hàng 9 và 8 (row_idx 8, 7):
      Row 9 (idx=8): P S R P S R P S R
      Row 8 (idx=7): S R P S R P S R P

    Args:
        obstacles: Danh sách các ô chướng ngại vật (chuỗi "e5" hoặc toạ độ (col, row)).
    """
    board: dict[tuple[int, int], Piece] = {}

    white_row1 = ['R','S','P','R','S','P','R','S','P']
    white_row2 = ['P','R','S','P','R','S','P','R','S']
    black_row9 = ['P','S','R','P','S','R','P','S','R']
    black_row8 = ['S','R','P','S','R','P','S','R','P']

    for col in range(BOARD_SIZE):
        board[(col, 0)] = Piece('W', white_row1[col])
        board[(col, 1)] = Piece('W', white_row2[col])
        board[(col, 8)] = Piece('B', black_row9[col])
        board[(col, 7)] = Piece('B', black_row8[col])

    obs_set = ObstacleSet()
    if obstacles:
        for obs in obstacles:
            if isinstance(obs, str):
                try:
                    obs_set.add(parse_square(obs))
                except Exception:
                    pass
            elif isinstance(obs, (tuple, list)) and len(obs) == 2:
                obs_set.add((int(obs[0]), int(obs[1])))

    state = BoardState(board=board, current_player='W', obstacles=obs_set)
    state.position_history.append(state.to_snapshot())
    return state

