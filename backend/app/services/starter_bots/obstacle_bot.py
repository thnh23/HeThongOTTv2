"""
Starter Bot: ObstacleBot (Top 32 Finals Standard)
=================================================
Bot nâng cấp nhận diện và né tránh ô chướng ngại vật (state.obstacles):
  1. Sử dụng BFS tìm đường ngắn nhất vòng qua các ô chướng ngại vật đến ô đích (W2).
  2. Ưu tiên cao nhất: Nước đi thắng ngay (vào ô đích W2 hoặc ăn quân cuối W1).
  3. Ưu tiên thứ hai: Ăn quân đối phương hợp lệ theo luật Oẳn Tù Tì.
  4. Tránh nước đi tiến vào tầm kiểm soát của quân khắc chế đối phương.
  5. Né tuyệt đối các ô chướng ngại vật (state.obstacles).
"""

from collections import deque
import random
from typing import Tuple, List, Dict, Optional, Set

from app.services.engine.board import (
    BoardState, square_to_str, WHITE_GOAL, BLACK_GOAL, BEATS,
    DIRECTIONS, BOARD_SIZE, parse_square
)
from app.services.engine.rules import get_legal_moves, step


def _compute_bfs_distances(goal: Tuple[int, int], obstacles: Set[Tuple[int, int]]) -> Dict[Tuple[int, int], int]:
    """
    Tính khoảng cách bước đi ngắn nhất từ mọi ô trên bàn cờ đến ô đích,
    vòng qua các ô chướng ngại vật bằng thuật toán BFS 8 hướng.
    """
    distances: Dict[Tuple[int, int], int] = {goal: 0}
    queue = deque([goal])

    while queue:
        cur = queue.popleft()
        cur_dist = distances[cur]

        for dx, dy in DIRECTIONS:
            nx, ny = cur[0] + dx, cur[1] + dy
            if 0 <= nx < BOARD_SIZE and 0 <= ny < BOARD_SIZE:
                pos = (nx, ny)
                if pos in obstacles:
                    continue
                if pos not in distances:
                    distances[pos] = cur_dist + 1
                    queue.append(pos)

    return distances


def choose_move(state: BoardState) -> Tuple[str, str]:
    """
    Chọn nước đi tối ưu trên bản đồ có chướng ngại vật.
    """
    legal_moves = get_legal_moves(state)
    if not legal_moves:
        return ("", "")

    current_player = state.current_player
    opponent = 'B' if current_player == 'W' else 'W'
    goal_coord = WHITE_GOAL if current_player == 'W' else BLACK_GOAL

    # Chuẩn hoá tập ô chướng ngại vật thành set of (col, row)
    raw_obstacles = getattr(state, 'obstacles', set())
    obs_set: Set[Tuple[int, int]] = set()
    for o in raw_obstacles:
        if isinstance(o, str):
            try:
                obs_set.add(parse_square(o))
            except Exception:
                pass
        elif isinstance(o, (tuple, list)) and len(o) == 2:
            obs_set.add((int(o[0]), int(o[1])))

    # Tính bản đồ khoảng cách BFS từ ô đích quanh ô cản
    bfs_dist = _compute_bfs_distances(goal_coord, obs_set)

    best_score = -float('inf')
    best_moves: List[Tuple[Tuple[int, int], Tuple[int, int]]] = []

    for move in legal_moves:
        (fc, fr), (tc, tr) = move
        from_str = square_to_str(fc, fr)
        to_str = square_to_str(tc, tr)

        # Bảo hiểm tuyệt đối: không bao giờ chọn nước đi vào ô cản
        if (tc, tr) in obs_set:
            continue

        score = 0.0

        # 1. Thử nghiệm trên bản sao: Thắng ngay lập tức?
        try:
            _, result = step(state, from_str, to_str)
            if result is not None:
                if result.winner == current_player:
                    return (from_str, to_str)
                elif result.is_draw():
                    score -= 80.0
        except Exception:
            continue

        # 2. Đánh giá ăn quân
        target_piece = state.board.get((tc, tr))
        my_piece = state.board.get((fc, fr))
        if target_piece and my_piece and target_piece.player == opponent:
            if BEATS.get(my_piece.piece_type) == target_piece.piece_type:
                score += 150.0

        # 3. Tiến gần ô đích thông qua BFS tránh ô cản
        dist_before = bfs_dist.get((fc, fr), 99)
        dist_after = bfs_dist.get((tc, tr), 99)

        if dist_after < dist_before:
            score += 25.0 * (dist_before - dist_after)
        elif dist_after > dist_before:
            score -= 15.0

        # Khuyến khích tiếp cận ô đích (khoảng cách càng nhỏ càng cộng điểm)
        score += max(0, 20 - dist_after) * 2.0

        # 4. Kiểm tra an toàn: Ô đích đến có bị đối phương ăn ở nước kế tiếp không?
        if my_piece:
            for dx, dy in DIRECTIONS:
                adj_c, adj_r = tc + dx, tr + dy
                adj_piece = state.board.get((adj_c, adj_r))
                if adj_piece and adj_piece.player == opponent:
                    if BEATS.get(adj_piece.piece_type) == my_piece.piece_type:
                        # Quân địch mạnh hơn ở sát bên cạnh -> nguy cơ bị ăn
                        score -= 35.0

        if score > best_score:
            best_score = score
            best_moves = [move]
        elif score == best_score:
            best_moves.append(move)

    if not best_moves:
        best_moves = legal_moves

    chosen = random.choice(best_moves)
    (fc, fr), (tc, tr) = chosen
    return (square_to_str(fc, fr), square_to_str(tc, tr))
