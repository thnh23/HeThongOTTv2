"""
Bộ điều phối thi đấu Knockout BO2 (Best of 2 đổi bên, ván phụ Blitz tiebreaker 0.1s),
ghi CSDL SQLite cho Match & Replay, và thông báo sự kiện qua WebSocket.
"""

import json
from datetime import datetime
from typing import List, Dict, Any
from sqlalchemy.orm import Session

from app.models.user import User
from app.models.match import Match, Replay
from app.websocket.manager import ws_manager
from app.features.admin.common import get_bot_for_user
from app.services.engine.board import create_initial_board
from .simulation import play_single_game_live_async


async def execute_match_bo2_async(match: Dict[str, Any], db: Session, obstacles: List[str]) -> Dict[str, Any]:
    """
    Thực thi 1 cặp đấu Knockout theo thể thức BO2 đổi phe trên bàn cờ có ô chướng ngại vật:
    - Ván 1: Player A (Trắng) vs Player B (Đen)
    - Ván 2: Player B (Trắng) vs Player A (Đen)
    - Nếu hòa sau 2 ván (1-1): Ván phụ cờ chớp Blitz 0.1s timeout phân định thắng bại.
    Đồng thời tạo bản ghi thật trong CSDL SQLite (Match, Replay) và phát sóng live WebSocket.
    """
    p_a = match.get("player_a")
    p_b = match.get("player_b")

    if not p_a or not p_b:
        return match

    m_id = match["id"]
    user_a = db.query(User).filter(User.id == p_a["id"]).first()
    user_b = db.query(User).filter(User.id == p_b["id"]).first()

    if not user_a or not user_b:
        return match

    # 1. Cập nhật trận đấu trong CSDL sang trạng thái 'running'
    db_match = db.query(Match).filter(Match.id == m_id).first()
    if not db_match:
        db_match = Match(
            id=m_id,
            tier="A",
            bot_a_id=user_a.id,
            bot_b_id=user_b.id,
            status="running",
            created_at=datetime.utcnow(),
        )
        db.add(db_match)
    else:
        db_match.status = "running"
        db_match.bot_a_id = user_a.id
        db_match.bot_b_id = user_b.id
    db.commit()

    # 2. Phát sóng MATCH_START qua WebSocket
    init_board_dict = create_initial_board(obstacles=obstacles).to_dict()
    ws_manager.active_matches[m_id] = init_board_dict
    await ws_manager.broadcast_to_match(m_id, {
        "type": "MATCH_START",
        "match_id": m_id,
        "bot_white": user_a.name,
        "bot_black": user_b.name,
        "board": init_board_dict,
        "timestamp": datetime.utcnow().isoformat(),
    })

    bot_a_fn, bot_a_name = get_bot_for_user(user_a, db)
    bot_b_fn, bot_b_name = get_bot_for_user(user_b, db)

    score_a = 0.0
    score_b = 0.0
    game_results = []
    g1_result = None
    g2_result = None

    # Xử thua Forfeit T1 nếu thiếu bot
    if bot_a_fn is None and bot_b_fn is not None:
        score_a = 0.0
        score_b = 2.0
        game_results.append({"game": 1, "winner": "B", "reason": f"Thí sinh A ({bot_a_name}) bị xử thua T1 do thiếu bot."})
        game_results.append({"game": 2, "winner": "B", "reason": f"Thí sinh A ({bot_a_name}) bị xử thua T1 do thiếu bot."})
    elif bot_b_fn is None and bot_a_fn is not None:
        score_a = 2.0
        score_b = 0.0
        game_results.append({"game": 1, "winner": "W", "reason": f"Thí sinh B ({bot_b_name}) bị xử thua T1 do thiếu bot."})
        game_results.append({"game": 2, "winner": "W", "reason": f"Thí sinh B ({bot_b_name}) bị xử thua T1 do thiếu bot."})
    elif bot_a_fn is None and bot_b_fn is None:
        score_a = 1.0
        score_b = 0.0
        game_results.append({"game": 1, "winner": "W", "reason": "Cả 2 thí sinh đều thiếu bot, phân định theo ưu tiên hạt giống."})
    else:
        # Ván 1: Player A (White) vs Player B (Black)
        g1_result = await play_single_game_live_async(
            parent_match_id=m_id,
            bot_white_fn=bot_a_fn,
            bot_black_fn=bot_b_fn,
            bot_white_name=user_a.name,
            bot_black_name=user_b.name,
            obstacles=obstacles,
            timeout_sec=0.3,
        )
        if g1_result.winner == "W":
            score_a += 1.0
        elif g1_result.winner == "B":
            score_b += 1.0
        else:
            score_a += 0.5
            score_b += 0.5

        game_results.append({
            "game": 1,
            "white": user_a.name,
            "black": user_b.name,
            "winner": g1_result.winner,
            "end_code": g1_result.end_code,
            "total_moves": g1_result.total_moves,
            "reason": g1_result.reason,
        })

        # Lưu bản ghi Ván 1 (G1) vào DB
        g1_id = f"{m_id}_G1"
        db_g1 = db.query(Match).filter(Match.id == g1_id).first()
        if not db_g1:
            db_g1 = Match(
                id=g1_id,
                tier="A",
                bot_a_id=user_a.id,
                bot_b_id=user_b.id,
                status="done",
                winner=g1_result.winner,
                end_code=g1_result.end_code,
                total_moves=g1_result.total_moves,
                duration_ms=g1_result.duration_ms,
                played_at=datetime.utcnow(),
            )
            db.add(db_g1)
        else:
            db_g1.status = "done"
            db_g1.winner = g1_result.winner
            db_g1.end_code = g1_result.end_code
            db_g1.total_moves = g1_result.total_moves
            db_g1.duration_ms = g1_result.duration_ms
            db_g1.played_at = datetime.utcnow()

        rep_g1 = db.query(Replay).filter(Replay.match_id == g1_id).first()
        if not rep_g1:
            rep_g1 = Replay(
                match_id=g1_id,
                moves_json=json.dumps(g1_result.moves, ensure_ascii=False),
                states_json=json.dumps(g1_result.states, ensure_ascii=False),
            )
            db.add(rep_g1)
        else:
            rep_g1.moves_json = json.dumps(g1_result.moves, ensure_ascii=False)
            rep_g1.states_json = json.dumps(g1_result.states, ensure_ascii=False)

        # Ván 2: Player B (White) vs Player A (Black) — Đổi bên
        g2_result = await play_single_game_live_async(
            parent_match_id=m_id,
            bot_white_fn=bot_b_fn,
            bot_black_fn=bot_a_fn,
            bot_white_name=user_b.name,
            bot_black_name=user_a.name,
            obstacles=obstacles,
            timeout_sec=0.3,
        )
        if g2_result.winner == "W":
            score_b += 1.0
        elif g2_result.winner == "B":
            score_a += 1.0
        else:
            score_a += 0.5
            score_b += 0.5

        game_results.append({
            "game": 2,
            "white": user_b.name,
            "black": user_a.name,
            "winner": g2_result.winner,
            "end_code": g2_result.end_code,
            "total_moves": g2_result.total_moves,
            "reason": g2_result.reason,
        })

        # Lưu bản ghi Ván 2 (G2) vào DB
        g2_id = f"{m_id}_G2"
        db_g2 = db.query(Match).filter(Match.id == g2_id).first()
        if not db_g2:
            db_g2 = Match(
                id=g2_id,
                tier="A",
                bot_a_id=user_b.id,
                bot_b_id=user_a.id,
                status="done",
                winner=g2_result.winner,
                end_code=g2_result.end_code,
                total_moves=g2_result.total_moves,
                duration_ms=g2_result.duration_ms,
                played_at=datetime.utcnow(),
            )
            db.add(db_g2)
        else:
            db_g2.status = "done"
            db_g2.winner = g2_result.winner
            db_g2.end_code = g2_result.end_code
            db_g2.total_moves = g2_result.total_moves
            db_g2.duration_ms = g2_result.duration_ms
            db_g2.played_at = datetime.utcnow()

        rep_g2 = db.query(Replay).filter(Replay.match_id == g2_id).first()
        if not rep_g2:
            rep_g2 = Replay(
                match_id=g2_id,
                moves_json=json.dumps(g2_result.moves, ensure_ascii=False),
                states_json=json.dumps(g2_result.states, ensure_ascii=False),
            )
            db.add(rep_g2)
        else:
            rep_g2.moves_json = json.dumps(g2_result.moves, ensure_ascii=False)
            rep_g2.states_json = json.dumps(g2_result.states, ensure_ascii=False)

        # Nếu hòa sau 2 ván (1-1): Đánh ván phụ Blitz cờ chớp 0.1s
        if score_a == score_b:
            g3_result = await play_single_game_live_async(
                parent_match_id=m_id,
                bot_white_fn=bot_a_fn,
                bot_black_fn=bot_b_fn,
                bot_white_name=f"{user_a.name} (Blitz)",
                bot_black_name=f"{user_b.name} (Blitz)",
                obstacles=obstacles,
                timeout_sec=0.1,
            )
            if g3_result.winner == "W":
                score_a += 0.5
            elif g3_result.winner == "B":
                score_b += 0.5
            else:
                if p_a.get("seed", 99) < p_b.get("seed", 99):
                    score_a += 0.1
                else:
                    score_b += 0.1

            game_results.append({
                "game": 3,
                "type": "Blitz Tiebreaker",
                "winner": g3_result.winner,
                "end_code": g3_result.end_code,
                "reason": g3_result.reason,
            })

    winner_player = p_a if score_a > score_b else p_b
    loser_player = p_b if score_a > score_b else p_a

    # 3. Cập nhật trận đấu chính trong CSDL sang 'done'
    db_match.status = "done"
    db_match.winner = "W" if score_a > score_b else "B"
    db_match.end_code = g1_result.end_code if g1_result else "W1"
    total_moves_count = (g1_result.total_moves if g1_result else 0) + (g2_result.total_moves if g2_result else 0)
    total_duration = (g1_result.duration_ms if g1_result else 0) + (g2_result.duration_ms if g2_result else 0)
    db_match.total_moves = total_moves_count
    db_match.duration_ms = total_duration
    db_match.played_at = datetime.utcnow()

    # Replay tổng thể cho trận đấu chính
    main_moves = g1_result.moves if g1_result else []
    main_states = g1_result.states if g1_result else []
    rep_main = db.query(Replay).filter(Replay.match_id == m_id).first()
    if not rep_main:
        rep_main = Replay(
            match_id=m_id,
            moves_json=json.dumps(main_moves, ensure_ascii=False),
            states_json=json.dumps(main_states, ensure_ascii=False),
        )
        db.add(rep_main)
    else:
        rep_main.moves_json = json.dumps(main_moves, ensure_ascii=False)
        rep_main.states_json = json.dumps(main_states, ensure_ascii=False)
    db.commit()

    # 4. Gỡ khỏi danh sách trận live và broadcast GAME_OVER
    ws_manager.active_matches.pop(m_id, None)
    await ws_manager.broadcast_to_match(m_id, {
        "type": "GAME_OVER",
        "match_id": m_id,
        "winner": db_match.winner,
        "end_code": db_match.end_code,
        "reason": f"Tỉ số BO2: {score_a} - {score_b}. {winner_player['name']} thắng chung cuộc.",
        "total_moves": db_match.total_moves,
        "duration_ms": db_match.duration_ms,
        "timestamp": datetime.utcnow().isoformat(),
    })
    await ws_manager.broadcast_leaderboard({
        "type": "MATCH_COMPLETED",
        "match_id": m_id,
        "winner": db_match.winner,
        "timestamp": datetime.utcnow().isoformat(),
    })

    # 5. Cập nhật cấu trúc bracket JSON
    match["score_a"] = round(score_a, 1)
    match["score_b"] = round(score_b, 1)
    match["status"] = "completed"
    match["winner_id"] = winner_player["id"]
    match["winner_name"] = winner_player["name"]
    match["winner_seed"] = winner_player.get("seed")
    match["loser_id"] = loser_player["id"]
    match["loser_name"] = loser_player["name"]
    match["loser_seed"] = loser_player.get("seed")
    match["game_results"] = game_results
    return match
