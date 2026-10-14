"""
Live Match Runner with WebSocket Streaming
Chạy trận đấu trực tiếp từng lượt và phát sóng thời gian thực qua WebSocket.
"""

import asyncio
import time
import json
from datetime import datetime
from typing import Callable, Tuple, Optional

from app.services.engine.board import BoardState, create_initial_board, parse_square
from app.services.engine.rules import step, is_legal_move, EndCode
from app.services.sandbox import execute_bot_move, BotExecutionResult
from app.websocket.manager import ws_manager
from app.database import SessionLocal
from app.models.user import User
from app.models.match import Match, Replay



async def run_live_match_async(
    match_id: str,
    bot_white_fn: Callable[[BoardState], Tuple[str, str]],
    bot_black_fn: Callable[[BoardState], Tuple[str, str]],
    bot_white_name: str = "White",
    bot_black_name: str = "Black",
    move_delay_sec: float = 0.6,
    max_moves: int = 200,
):
    """
    Chạy trận đấu trực tiếp, phát sóng qua WebSocket cho khán giả theo dõi.
    """
    state = create_initial_board()
    moves_history = []
    states_history = [state.to_dict()]

    start_total_time = time.perf_counter()
    turn_counter = 1

    winner: Optional[str] = None
    end_code: str = EndCode.D2.value
    reason: str = ""

    # 1. Update Match status in DB to 'running'
    db = SessionLocal()
    try:
        match_obj = db.query(Match).filter(Match.id == match_id).first()
        if match_obj:
            match_obj.status = "running"
            db.commit()
    finally:
        db.close()

    # Track active board state for instant spectator catchup
    ws_manager.active_matches[match_id] = state.to_dict()

    # Broadcast Match Start
    await ws_manager.broadcast_to_match(match_id, {
        "type": "MATCH_START",
        "match_id": match_id,
        "bot_white": bot_white_name,
        "bot_black": bot_black_name,
        "board": state.to_dict(),
        "timestamp": datetime.utcnow().isoformat(),
    })

    has_spectators = match_id in ws_manager.match_rooms and len(ws_manager.match_rooms[match_id]) > 0
    await asyncio.sleep(move_delay_sec if has_spectators else 0.05)


    while state.move_count < max_moves:
        current_player = state.current_player
        opponent = 'B' if current_player == 'W' else 'W'
        active_bot_fn = bot_white_fn if current_player == 'W' else bot_black_fn
        active_bot_name = bot_white_name if current_player == 'W' else bot_black_name

        # Execute bot move in sandbox
        bot_res: BotExecutionResult = execute_bot_move(active_bot_fn, state, timeout_sec=2.0)

        if not bot_res.is_success:
            winner = opponent
            end_code = "T1"
            reason = f"{active_bot_name} ({current_player}) bị xử thua T1: {bot_res.error_message}"
            break

        from_sq, to_sq = bot_res.move

        # Check square bounds and legality
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
            reason = f"{active_bot_name} ({current_player}) xử thua T1 do đi sai luật: {from_sq} -> {to_sq}"
            break

        # Check captured piece
        target_piece = state.board.get((tc, tr))
        captured_type = target_piece.piece_type if target_piece else None

        # Step engine
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
        ws_manager.active_matches[match_id] = state_dict

        move_record = {
            "turn": turn_counter,
            "player": current_player,
            "from": from_sq,
            "to": to_sq,
            "captured": captured_type,
            "duration_ms": bot_res.duration_ms,
        }
        moves_history.append(move_record)

        # Broadcast Move to spectators
        await ws_manager.broadcast_to_match(match_id, {
            "type": "MOVE",
            "match_id": match_id,
            "turn": turn_counter,
            "player": current_player,
            "from": from_sq,
            "to": to_sq,
            "captured": captured_type,
            "board": state.to_dict(),
            "duration_ms": bot_res.duration_ms,
            "timestamp": datetime.utcnow().isoformat(),
        })

        turn_counter += 1

        if game_res is not None:
            winner = game_res.winner
            end_code = game_res.end_code.value
            reason = game_res.description
            break

        # Delay between turns for realistic live spectating
        has_spectators = match_id in ws_manager.match_rooms and len(ws_manager.match_rooms[match_id]) > 0
        actual_delay = move_delay_sec if has_spectators else min(move_delay_sec, 0.02)
        await asyncio.sleep(actual_delay)

    # If timeout or 200 moves reached
    if winner is None and end_code != "T1" and state.move_count >= max_moves:
        end_code = EndCode.D2.value
        reason = f"Hòa cờ theo luật D2: Ván đấu vượt quá {max_moves} nước đi."

    total_duration_ms = int((time.perf_counter() - start_total_time) * 1000)

    # 2. Persist Match & Replay to Database
    db = SessionLocal()
    try:
        match_obj = db.query(Match).filter(Match.id == match_id).first()
        if match_obj:
            match_obj.status = "done"
            match_obj.winner = winner
            match_obj.end_code = end_code
            match_obj.total_moves = state.move_count
            match_obj.duration_ms = total_duration_ms
            match_obj.played_at = datetime.utcnow()

            # Save or update Replay
            existing_replay = db.query(Replay).filter(Replay.match_id == match_id).first()
            if not existing_replay:
                replay_obj = Replay(
                    match_id=match_id,
                    moves_json=json.dumps(moves_history, ensure_ascii=False),
                    states_json=json.dumps(states_history, ensure_ascii=False),
                )
                db.add(replay_obj)
            else:
                existing_replay.moves_json = json.dumps(moves_history, ensure_ascii=False)
                existing_replay.states_json = json.dumps(states_history, ensure_ascii=False)

            db.commit()
    finally:
        db.close()

    # Clean up active board from memory
    ws_manager.active_matches.pop(match_id, None)

    # 3. Broadcast GAME_OVER to match spectators
    await ws_manager.broadcast_to_match(match_id, {
        "type": "GAME_OVER",
        "match_id": match_id,
        "winner": winner,
        "end_code": end_code,
        "reason": reason,
        "total_moves": state.move_count,
        "duration_ms": total_duration_ms,
        "timestamp": datetime.utcnow().isoformat(),
    })

    # 4. Broadcast Leaderboard update event
    await ws_manager.broadcast_leaderboard({
        "type": "MATCH_COMPLETED",
        "match_id": match_id,
        "winner": winner,
        "timestamp": datetime.utcnow().isoformat(),
    })
