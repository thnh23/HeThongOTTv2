"""
Engine mô phỏng ván đấu trực tiếp, đo thời gian Sandbox, kiểm tra ô cản và Live-stream WebSocket.
"""

import asyncio
from datetime import datetime
from typing import List, Optional

from app.websocket.manager import ws_manager
from app.services.engine.board import create_initial_board, parse_square, square_to_str
from app.services.engine.rules import step, is_legal_move, EndCode
from app.services.sandbox import execute_bot_move, BotExecutionResult
from app.services.engine.referee import MatchResult


async def play_single_game_live_async(
    parent_match_id: str,
    bot_white_fn,
    bot_black_fn,
    bot_white_name: str,
    bot_black_name: str,
    obstacles: List[str],
    timeout_sec: float = 0.3,
    max_moves: int = 200,
) -> MatchResult:
    """
    Chạy 1 ván đấu trực tiếp, phát sóng qua WebSocket cho các khán giả trên máy khác đang xem live.
    - Kiểm tra tính hợp lệ của nước đi và ô cản.
    - Xử thua Forfeit T1 nếu bot tính toán quá timeout_sec hoặc crash.
    """
    state = create_initial_board(obstacles=obstacles)
    moves_history = []
    states_history = [state.to_dict()]

    start_total_time = datetime.utcnow()
    turn_counter = 1

    winner: Optional[str] = None
    end_code: str = EndCode.D2.value
    reason: str = ""

    # Cập nhật trạng thái bàn cờ ban đầu lên memory để người vào sau bắt kịp tức thì
    ws_manager.active_matches[parent_match_id] = state.to_dict()

    has_spectators = (parent_match_id in ws_manager.match_rooms and len(ws_manager.match_rooms[parent_match_id]) > 0)
    await asyncio.sleep(0.1 if has_spectators else 0.005)

    while state.move_count < max_moves:
        current_player = state.current_player
        opponent = 'B' if current_player == 'W' else 'W'
        active_bot_fn = bot_white_fn if current_player == 'W' else bot_black_fn
        active_bot_name = bot_white_name if current_player == 'W' else bot_black_name

        # Gọi bot trong Sandbox an toàn
        bot_res: BotExecutionResult = execute_bot_move(active_bot_fn, state, timeout_sec=timeout_sec)

        if not bot_res.is_success or bot_res.duration_ms > int(timeout_sec * 1000):
            winner = opponent
            end_code = "T1"
            err_msg = bot_res.error_message or f"Quá thời gian quy định {int(timeout_sec * 1000)}ms"
            reason = f"{active_bot_name} ({current_player}) xử thua T1: {err_msg}"
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
        try:
            fc, fr = parse_square(from_sq)
            tc, tr = parse_square(to_sq)
            move_tuple = ((fc, fr), (tc, tr))
        except Exception:
            winner = opponent
            end_code = "T1"
            reason = f"{active_bot_name} ({current_player}) xử thua T1 do tọa độ không hợp lệ: {from_sq} -> {to_sq}"
            break

        if not is_legal_move(state, move_tuple):
            winner = opponent
            end_code = "T1"
            if (tc, tr) in state.obstacles:
                reason = f"{active_bot_name} ({current_player}) xử thua T1 do đi vào ô cản cấm: {from_sq} -> {to_sq}"
            else:
                reason = f"{active_bot_name} ({current_player}) xử thua T1 do đi sai luật: {from_sq} -> {to_sq}"
            break

        target_piece = state.board.get((tc, tr))
        captured_type = target_piece.piece_type if target_piece else None

        try:
            new_state, game_res = step(state, from_sq, to_sq)
        except Exception as e:
            winner = opponent
            end_code = "T1"
            reason = f"Lỗi engine: {str(e)}"
            break

        state = new_state
        state_dict = state.to_dict()
        states_history.append(state_dict)
        ws_manager.active_matches[parent_match_id] = state_dict

        move_record = {
            "turn": turn_counter,
            "player": current_player,
            "from": from_sq,
            "to": to_sq,
            "captured": captured_type,
            "duration_ms": bot_res.duration_ms,
        }
        moves_history.append(move_record)

        # Phát sóng nước đi thời gian thực cho khán giả đang theo dõi
        await ws_manager.broadcast_to_match(parent_match_id, {
            "type": "MOVE",
            "match_id": parent_match_id,
            "turn": turn_counter,
            "player": current_player,
            "from": from_sq,
            "to": to_sq,
            "captured": captured_type,
            "board": state_dict,
            "duration_ms": bot_res.duration_ms,
            "timestamp": datetime.utcnow().isoformat(),
        })

        turn_counter += 1

        if game_res is not None:
            winner = game_res.winner
            end_code = game_res.end_code.value
            reason = game_res.description
            break

        # Nếu có khán giả trên máy khác đang xem thì delay 0.25s để thấy trực quan, ngược lại chạy siêu tốc 0.005s
        has_spectators = (parent_match_id in ws_manager.match_rooms and len(ws_manager.match_rooms[parent_match_id]) > 0)
        await asyncio.sleep(0.25 if has_spectators else 0.005)

    if winner is None and end_code != "T1" and state.move_count >= max_moves:
        end_code = EndCode.D2.value
        reason = f"Hòa cờ theo luật D2: Ván đấu vượt quá {max_moves} nước đi."

    total_duration_ms = int((datetime.utcnow() - start_total_time).total_seconds() * 1000)

    return MatchResult(
        match_id=parent_match_id,
        bot_white_name=bot_white_name,
        bot_black_name=bot_black_name,
        winner=winner,
        end_code=end_code,
        total_moves=len(moves_history),
        duration_ms=total_duration_ms,
        moves=moves_history,
        states=states_history,
        reason=reason,
        obstacles=[square_to_str(c, r) for c, r in sorted(state.obstacles)],
    )
