"""
Starter Bot: RandomBot
======================
Bot chơi cờ ngẫu nhiên: Chọn 1 nước hợp lệ bất kỳ từ danh sách get_legal_moves.
Phù hợp làm bot mẫu cho Bảng A hoặc bot kiểm thử hệ thống.
"""

import random
from typing import Tuple
from app.services.engine.board import BoardState, square_to_str
from app.services.engine.rules import get_legal_moves


def choose_move(state: BoardState) -> Tuple[str, str]:
    """
    Chọn 1 nước đi ngẫu nhiên trong danh sách nước hợp lệ.
    
    Returns:
        tuple[str, str]: ("e5", "f6") - tọa độ ô đi và ô đến
    """
    legal_moves = get_legal_moves(state)
    if not legal_moves:
        return ("", "")
    
    (fc, fr), (tc, tr) = random.choice(legal_moves)
    return (square_to_str(fc, fr), square_to_str(tc, tr))
