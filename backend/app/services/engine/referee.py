"""
OTTv2 Match Referee & Replay Generator
======================================
Trọng tài điều phối toàn bộ ván đấu giữa hai bot:
  1. Khởi tạo bàn cờ 9×9
  2. Quản lý vòng lặp các lượt đi qua Sandbox
  3. Kiểm tra tính hợp lệ của từng nước đi theo OTTv2 rules
  4. Bắt lỗi bot: Timeout (>300ms), Crash, Vi phạm an ninh, Đi phạm luật -> xử thua T1
  5. Phát hiện điều kiện kết thúc: W1, W2, D1, D2
  6. Tạo bản ghi Replay JSON đầy đủ
"""

import time
import uuid
from typing import Callable, Tuple, Optional, List, Dict, Any
from dataclasses import dataclass, field

from app.services.engine.board import (
    BoardState, create_initial_board, parse_square, square_to_str, is_in_bounds
)
from app.services.engine.rules import (
    step, parse_move, is_legal_move, check_game_over, EndCode
)
from app.services.sandbox import execute_bot_move, BotExecutionResult


@dataclass
class MatchResult:
    """Kết quả chi tiết của 1 ván đấu."""
    match_id: str
    bot_white_name: str
    bot_black_name: str
    winner: Optional[str]               # 'W', 'B', hoặc None (hòa)
    end_code: str                       # 'W1', 'W2', 'D1', 'D2', 'T1'
    total_moves: int = 0
    duration_ms: int = 0
    moves: List[Dict[str, Any]] = field(default_factory=list)
    states: List[Dict[str, Any]] = field(default_factory=list)
    reason: str = ""
    obstacles: List[str] = field(default_factory=list)

    def to_replay_dict(self) -> dict:
        return {
            "match_id": self.match_id,
            "bot_white": self.bot_white_name,
            "bot_black": self.bot_black_name,
            "winner": self.winner,
            "end_code": self.end_code,
            "total_moves": self.total_moves,
            "duration_ms": self.duration_ms,
            "reason": self.reason,
            "obstacles": self.obstacles,
            "moves": self.moves,
            "states": self.states,
        }


def play_match(
    bot_white_fn: Callable[[BoardState], Tuple[str, str]],
    bot_black_fn: Callable[[BoardState], Tuple[str, str]],
    bot_white_name: str = "White",
    bot_black_name: str = "Black",
    timeout_sec: float = 0.3,
    max_moves: int = 200,
    match_id: Optional[str] = None,
    obstacles: Optional[any] = None,
) -> MatchResult:
    """
    Điều phối một ván đấu trọn vẹn giữa hai bot.
    Áp dụng giới hạn cứng timeout_sec (mặc định 0.3s / 300ms mỗi nước đi, quá giờ xử thua T1).
    """
    if match_id is None:
        match_id = str(uuid.uuid4())

    state = create_initial_board(obstacles=obstacles)
    moves_history: List[Dict[str, Any]] = []
    states_history: List[Dict[str, Any]] = [state.to_dict()]

    start_total_time = time.perf_counter()
    turn_counter = 1


    winner: Optional[str] = None
    end_code: str = EndCode.D2.value
    reason: str = ""

    while state.move_count < max_moves:
        current_player = state.current_player
        opponent = 'B' if current_player == 'W' else 'W'
        active_bot_fn = bot_white_fn if current_player == 'W' else bot_black_fn
        active_bot_name = bot_white_name if current_player == 'W' else bot_black_name

        # 1. Gọi bot trong Sandbox
        bot_res: BotExecutionResult = execute_bot_move(
            active_bot_fn, state, timeout_sec=timeout_sec
        )

        if not bot_res.is_success or bot_res.duration_ms > int(timeout_sec * 1000):
            # Bot lỗi: timeout (>300ms) / crash / security violation -> Xử thua T1
            winner = opponent
            end_code = "T1"
            err_msg = bot_res.error_message or f"Vượt quá thời gian {int(timeout_sec * 1000)}ms ({bot_res.duration_ms}ms)"
            reason = f"{active_bot_name} ({current_player}) bị xử thua T1: {err_msg}"
            moves_history.append({
                "turn": turn_counter,
                "player": current_player,
                "from": None,
                "to": None,
                "captured": None,
                "duration_ms": bot_res.duration_ms,
                "error": err_msg,
            })
            break

        from_sq, to_sq = bot_res.move

        # 2. Kiểm tra tính hợp lệ của tọa độ và nước đi
        try:
            fc, fr = parse_square(from_sq)
            tc, tr = parse_square(to_sq)
            move_tuple = ((fc, fr), (tc, tr))
        except Exception:
            # Tọa độ ô cờ không hợp lệ
            winner = opponent
            end_code = "T1"
            reason = f"{active_bot_name} ({current_player}) bị xử thua T1 do tọa độ không hợp lệ: {from_sq} -> {to_sq}"
            moves_history.append({
                "turn": turn_counter,
                "player": current_player,
                "from": from_sq,
                "to": to_sq,
                "captured": None,
                "duration_ms": bot_res.duration_ms,
                "error": "Tọa độ ô cờ nằm ngoài bàn 9×9",
            })
            break

        if not is_legal_move(state, move_tuple):
            # Đi phạm luật (T07 hoặc đi vào ô chướng ngại vật)
            winner = opponent
            end_code = "T1"
            if (tc, tr) in state.obstacles:
                reason = f"{active_bot_name} ({current_player}) bị xử thua T1 do đi vào ô chướng ngại vật: {from_sq} -> {to_sq}"
                err_msg = "Nước đi vào ô chướng ngại vật cấm"
            else:
                reason = f"{active_bot_name} ({current_player}) bị xử thua T1 do đi nước không hợp lệ: {from_sq} -> {to_sq}"
                err_msg = "Nước đi phạm luật OTTv2"
            moves_history.append({
                "turn": turn_counter,
                "player": current_player,
                "from": from_sq,
                "to": to_sq,
                "captured": None,
                "duration_ms": bot_res.duration_ms,
                "error": err_msg,
            })
            break

        # 3. Ghi nhận quân bị ăn nếu có
        target_piece = state.board.get((tc, tr))
        captured_type = target_piece.piece_type if target_piece else None

        # 4. Thực hiện nước đi qua engine
        try:
            new_state, game_res = step(state, from_sq, to_sq)
        except Exception as e:
            winner = opponent
            end_code = "T1"
            reason = f"Lỗi engine khi thực hiện nước đi: {str(e)}"
            break

        state = new_state
        states_history.append(state.to_dict())

        moves_history.append({
            "turn": turn_counter,
            "player": current_player,
            "from": from_sq,
            "to": to_sq,
            "captured": captured_type,
            "duration_ms": bot_res.duration_ms,
        })
        turn_counter += 1

        # 5. Kiểm tra kết thúc ván
        if game_res is not None:
            winner = game_res.winner
            end_code = game_res.end_code.value
            reason = game_res.description
            break

    # Nếu hết vòng lặp mà chưa có kết quả (quá 200 nước)
    if winner is None and end_code != "T1" and state.move_count >= max_moves:
        end_code = EndCode.D2.value
        reason = f"Hòa theo luật D2: Ván đấu vượt quá {max_moves} nước đi."

    total_duration_ms = int((time.perf_counter() - start_total_time) * 1000)

    return MatchResult(
        match_id=match_id,
        bot_white_name=bot_white_name,
        bot_black_name=bot_black_name,
        winner=winner,
        end_code=end_code,
        total_moves=state.move_count,
        duration_ms=total_duration_ms,
        moves=moves_history,
        states=states_history,
        reason=reason,
        obstacles=[square_to_str(c, r) for c, r in sorted(state.obstacles)],
    )
