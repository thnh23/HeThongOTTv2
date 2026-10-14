"""
Starter Bot: GreedyBot
======================
Bot chơi cờ theo thuật toán tham lam (Heuristic Greedy):
  1. Ưu tiên cao nhất: Nước đi thắng ngay (vào ô đích W2 hoặc ăn quân cuối W1)
  2. Ưu tiên thứ hai: Nước ăn quân đối phương
  3. Ưu tiên thứ ba: Nước di chuyển tiến gần về ô đích của mình
  4. Tránh nước đi nguy hiểm nếu có lựa chọn an toàn
"""

import random
from typing import Tuple, List
from app.services.engine.board import (
    BoardState, square_to_str, WHITE_GOAL, BLACK_GOAL, BEATS
)
from app.services.engine.rules import get_legal_moves, step, EndCode


def choose_move(state: BoardState) -> Tuple[str, str]:
    """
    Chọn nước đi tốt nhất theo heuristic.
    """
    legal_moves = get_legal_moves(state)
    if not legal_moves:
        return ("", "")

    current_player = state.current_player
    goal_coord = WHITE_GOAL if current_player == 'W' else BLACK_GOAL
    gc, gr = goal_coord

    best_score = -float('inf')
    best_moves: List[Tuple[Tuple[int, int], Tuple[int, int]]] = []

    for move in legal_moves:
        (fc, fr), (tc, tr) = move
        from_str = square_to_str(fc, fr)
        to_str = square_to_str(tc, tr)

        score = 0.0

        # Thử đi nước này trên bản sao state
        try:
            _, result = step(state, from_str, to_str)
            if result is not None:
                if result.winner == current_player:
                    # Thắng ngay lập tức!
                    return (from_str, to_str)
                elif result.is_draw():
                    score -= 50
        except Exception:
            continue

        # Đánh giá ăn quân
        target_piece = state.board.get((tc, tr))
        my_piece = state.board.get((fc, fr))
        if target_piece and my_piece and target_piece.player != current_player:
            if BEATS.get(my_piece.piece_type) == target_piece.piece_type:
                # Ăn quân thành công
                score += 100.0

        # Khoảng cách Chebyshev tới ô đích (càng gần ô đích điểm càng cao)
        dist_before = max(abs(fc - gc), abs(fr - gr))
        dist_after = max(abs(tc - gc), abs(tr - gr))
        if dist_after < dist_before:
            score += 15.0 * (dist_before - dist_after)
        elif dist_after > dist_before:
            score -= 10.0

        # Giữ khoảng cách Manhattan phụ trợ
        manhattan_diff = (abs(fc - gc) + abs(fr - gr)) - (abs(tc - gc) + abs(tr - gr))
        score += 2.0 * manhattan_diff

        if score > best_score:
            best_score = score
            best_moves = [move]
        elif score == best_score:
            best_moves.append(move)

    chosen = random.choice(best_moves) if best_moves else random.choice(legal_moves)
    (fc, fr), (tc, tr) = chosen
    return (square_to_str(fc, fr), square_to_str(tc, tr))
